"use client";

import { useEffect, useRef } from "react";
import {
  LINE_ALPHA,
  LINE_THICKNESS_PX,
  MIDDLE_COLUMNS_NARROW,
  MIDDLE_COLUMNS_WIDE,
  WIDE_BREAKPOINT_PX,
  columnCenterX,
  gridMetrics,
  readScale,
  rowTopY,
  type GridMetrics,
} from "@/lib/grid";
import {
  GRID_EFFECT_DEFAULTS,
  MAX_MARKS,
  MAX_REGIONS,
  resolveFillColor,
  type GridEffectParams,
} from "@/lib/gridEffect/config";
import { getMarks, getRegions, subscribeMarks, type GridRegion } from "@/lib/gridEffect/marks";
import type { GridRenderer } from "@/lib/gridEffect/renderer";

const MAX_DPR = 2;
// Below this, a region's glow is treated as fully settled — cheap enough that chasing the last
// 0.2% with more frames would just be wasted draws.
const INTENSITY_EPSILON = 0.002;

interface RegionRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function regionRectCSS(region: GridRegion, m: GridMetrics): RegionRect {
  return {
    left: columnCenterX(region.left, m),
    right: columnCenterX(region.right, m),
    // Same vertical centre the cross arms use — see marks.ts / GridCanvas's own mark placement.
    top: rowTopY(region.top, m) + LINE_THICKNESS_PX / 2,
    bottom: rowTopY(region.bottom, m) + LINE_THICKNESS_PX / 2,
  };
}

/**
 * The background grid, drawn on a WebGL2 canvas.
 *
 * CSS first, canvas second: the gradient layers next to this one (CssGridLines) are what paints on
 * first paint and what stays if anything here fails. Only once WebGL2 is up AND a frame is
 * actually on screen does this set `data-grid-canvas="on"` on its parent, which is what hides
 * them (see globals.css). So there is never a frame with two grids, and never one with none.
 *
 * The grid itself never moves (grid-glow.md, 2026-09-21 — an earlier version bent the lines around
 * the cursor; the user asked for that to stop). What this canvas still earns its keep for: a soft
 * glow that follows the pointer while it sits inside a section's own "4 crosses" region (see
 * lib/gridEffect/marks.ts, useGridMarks) — everywhere else, this renders the identical static grid
 * the CSS fallback does.
 *
 * Cost, since "won't it make the site heavier" was the question that shaped this: the renderer is
 * behind a dynamic import so it is not in the first-paint bundle, the pointer listener is passive
 * and only records a position plus a cheap rect hit-test, and the rAF loop stops itself the moment
 * every region's glow has reached its target and nothing is easing — an idle page, or the pointer
 * moving anywhere outside every region, draws zero frames.
 */
export function GridCanvas({ params, className }: { params?: Partial<GridEffectParams>; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<GridEffectParams>(GRID_EFFECT_DEFAULTS);
  const requestRef = useRef<(() => void) | null>(null);

  // Runs after every render (no dependency array on purpose): the lab page edits these live, and a
  // parameter change has to repaint even when the loop has parked itself.
  useEffect(() => {
    paramsRef.current = { ...GRID_EFFECT_DEFAULTS, ...params };
    requestRef.current?.();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const layer = canvas.parentElement;

    let renderer: GridRenderer | null = null;
    let disposed = false;
    let raf = 0;
    let lastTime = 0;
    let firstFrameShown = false;
    let metrics: GridMetrics = gridMetrics();
    let hiddenMask = 0;
    let dprQuery: MediaQueryList | null = null;

    const marksBuffer = new Float32Array(MAX_MARKS * 4);
    const regionsBuffer = new Float32Array(MAX_REGIONS * 4);
    const regionGlowBuffer = new Float32Array(MAX_REGIONS);
    // Per-owner hover intensity, eased 0<->1 toward whichever single region the pointer is
    // currently inside (or 0 for all of them once it leaves every region).
    const regionIntensity = new Map<string, { current: number; target: number }>();

    // Parked far off-screen so nothing glows until the pointer is actually seen.
    const cursor = { targetX: -1e5, targetY: -1e5, x: -1e5, y: -1e5 };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    // Same media query the `min-[1800px]:` / `max-[1799px]:` classes evaluate, so the canvas and
    // the CSS fallback can never disagree about which columns are hidden.
    const wideViewport = window.matchMedia(`(min-width: ${WIDE_BREAKPOINT_PX}px)`);

    const request = () => {
      if (raf || disposed || document.hidden) return;
      raf = requestAnimationFrame(frame);
    };
    requestRef.current = request;

    const computeHiddenMask = () => {
      const columns = wideViewport.matches ? MIDDLE_COLUMNS_WIDE : MIDDLE_COLUMNS_NARROW;
      let mask = 0;
      for (const n of columns) mask |= 1 << (n - 1);
      return mask;
    };

    // Which region (if any) contains (x, y) — plain arithmetic against the CURRENT metrics, no DOM
    // reads. A region whose crosses have faded out (opacity 0) is not hoverable.
    const hitRegion = (x: number, y: number): string | null => {
      for (const region of getRegions()) {
        if (region.opacity <= 0) continue;
        const rect = regionRectCSS(region, metrics);
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return region.ownerId;
      }
      return null;
    };

    // Every known region's target intensity: 1 for whichever is hovered, 0 for the rest. Also
    // drops any owner that no longer publishes a region at all.
    const syncRegionTargets = (hoveredId: string | null) => {
      const seen = new Set<string>();
      for (const region of getRegions()) {
        seen.add(region.ownerId);
        const state = regionIntensity.get(region.ownerId) ?? { current: 0, target: 0 };
        state.target = region.ownerId === hoveredId ? 1 : 0;
        regionIntensity.set(region.ownerId, state);
      }
      for (const id of regionIntensity.keys()) {
        if (!seen.has(id)) regionIntensity.delete(id);
      }
    };

    const anyIntensityLive = (): boolean => {
      for (const state of regionIntensity.values()) {
        if (state.current > INTENSITY_EPSILON || state.target > INTENSITY_EPSILON) return true;
      }
      return false;
    };

    const syncSize = () => {
      if (!renderer) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      renderer.resize(canvas.clientWidth, canvas.clientHeight, dpr);
      metrics = gridMetrics(canvas.clientWidth, readScale());
      hiddenMask = computeHiddenMask();
      armDprWatch(dpr);
      request();
    };

    // devicePixelRatio changes (dragging the window to another display, browser zoom) fire no event
    // of their own — the standard trick is a resolution media query re-armed at the new value.
    const armDprWatch = (dpr: number) => {
      dprQuery?.removeEventListener("change", syncSize);
      dprQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);
      dprQuery.addEventListener("change", syncSize);
    };

    function frame(now: number) {
      raf = 0;
      if (disposed || !renderer) return;
      const p = paramsRef.current;

      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 1 / 60;
      lastTime = now;

      // Reduced motion and touch both get the static grid and its crosses — just no glow, and no
      // pointer tracking to pay for (the listeners are never even attached, below).
      const motionless = reduceMotion.matches || coarsePointer.matches;
      let mouseSettled = true;
      let intensitiesSettled = true;

      if (motionless) {
        for (const state of regionIntensity.values()) {
          state.current = 0;
          state.target = 0;
        }
      } else {
        // Frame-rate independent: `easing` is the fraction covered in one 60fps frame.
        const follow = 1 - Math.pow(1 - p.easing, dt * 60);
        cursor.x += (cursor.targetX - cursor.x) * follow;
        cursor.y += (cursor.targetY - cursor.y) * follow;
        mouseSettled = Math.hypot(cursor.targetX - cursor.x, cursor.targetY - cursor.y) < 0.1;
        if (mouseSettled) {
          cursor.x = cursor.targetX;
          cursor.y = cursor.targetY;
        }

        const fade = p.glowFadeMs > 0 ? 1 - Math.pow(0.001, (dt * 1000) / p.glowFadeMs) : 1;
        for (const state of regionIntensity.values()) {
          state.current += (state.target - state.current) * fade;
          if (Math.abs(state.target - state.current) < INTENSITY_EPSILON) state.current = state.target;
          else intensitiesSettled = false;
        }
      }

      // Marks are stored as grid indices, so they are turned into pixels here, against the CURRENT
      // metrics, every frame — which is why a resize can never leave one off its line.
      const marks = getMarks();
      const markCount = Math.min(marks.length, MAX_MARKS);
      marksBuffer.fill(0);
      for (let i = 0; i < markCount; i++) {
        const mark = marks[i];
        marksBuffer[i * 4] = columnCenterX(mark.col, metrics);
        // + half a line so the arms sit on the middle of the 2px row line, which is drawn downwards
        // from rowTopY rather than centred on it.
        marksBuffer[i * 4 + 1] = rowTopY(mark.row, metrics) + LINE_THICKNESS_PX / 2;
        marksBuffer[i * 4 + 2] = p.markArmPx * metrics.k * mark.scale;
        marksBuffer[i * 4 + 3] = p.markAlpha * mark.opacity;
      }

      const regions = getRegions();
      const regionCount = Math.min(regions.length, MAX_REGIONS);
      regionsBuffer.fill(0);
      regionGlowBuffer.fill(0);
      for (let i = 0; i < regionCount; i++) {
        const region = regions[i];
        const rect = regionRectCSS(region, metrics);
        regionsBuffer[i * 4] = rect.left;
        regionsBuffer[i * 4 + 1] = rect.top;
        regionsBuffer[i * 4 + 2] = rect.right;
        regionsBuffer[i * 4 + 3] = rect.bottom;
        const intensity = motionless ? 0 : (regionIntensity.get(region.ownerId)?.current ?? 0);
        regionGlowBuffer[i] = intensity * region.opacity;
      }

      renderer.draw({
        mouseX: cursor.x,
        mouseY: cursor.y,
        metrics,
        lineAlpha: LINE_ALPHA,
        halfThickness: LINE_THICKNESS_PX / 2,
        hiddenMask,
        marks: marksBuffer,
        markCount,
        markHalfThickness: (p.markThicknessPx * metrics.k) / 2,
        regions: regionsBuffer,
        regionGlow: regionGlowBuffer,
        regionCount,
        glowRadius: p.glowRadiusPx * metrics.k,
        lineGlowAlpha: p.lineGlowAlpha,
        fillAlpha: p.fillAlpha,
        fillColor: resolveFillColor(p.fillColor),
        regionFeather: p.regionFeatherPx * metrics.k,
        markGlowBoost: p.markGlowBoost,
      });

      if (!firstFrameShown) {
        firstFrameShown = true;
        // One frame later, so the canvas has definitely composited before the CSS grid disappears.
        requestAnimationFrame(() => {
          if (!disposed) layer?.setAttribute("data-grid-canvas", "on");
        });
      }

      if (!motionless && (!mouseSettled || !intensitiesSettled)) request();
      else lastTime = 0;
    }

    const onPointerMove = (event: PointerEvent) => {
      cursor.targetX = event.clientX;
      cursor.targetY = event.clientY;
      const wasLive = anyIntensityLive();
      const hoveredId = hitRegion(cursor.targetX, cursor.targetY);
      if (hoveredId && !wasLive) {
        // Entering a region from cold: snap the eased position to the cursor instead of letting it
        // sweep in from wherever it last was (or the off-screen parking spot).
        cursor.x = cursor.targetX;
        cursor.y = cursor.targetY;
      }
      syncRegionTargets(hoveredId);
      // The whole point: moving the mouse over the rest of the page must draw zero frames.
      if (hoveredId || anyIntensityLive()) request();
    };
    const onPointerGone = () => {
      syncRegionTargets(null);
      request();
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else {
        lastTime = 0;
        request();
      }
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      // Hand the page straight back to the CSS grid rather than leaving a dead canvas over it.
      layer?.removeAttribute("data-grid-canvas");
      canvas.style.display = "none";
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      renderer = null;
    };

    const resizeObserver = new ResizeObserver(syncSize);
    const unsubscribeMarks = subscribeMarks(request);

    canvas.addEventListener("webglcontextlost", onContextLost);
    window.addEventListener("resize", syncSize);
    document.addEventListener("visibilitychange", onVisibility);
    wideViewport.addEventListener("change", syncSize);
    if (!reduceMotion.matches && !coarsePointer.matches) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("mouseleave", onPointerGone);
      window.addEventListener("blur", onPointerGone);
    }
    // A user switching either of these mid-session should get the other behaviour without a reload.
    reduceMotion.addEventListener("change", request);
    coarsePointer.addEventListener("change", request);

    void import("@/lib/gridEffect/renderer").then(({ createGridRenderer }) => {
      if (disposed) return;
      renderer = createGridRenderer(canvas);
      // No WebGL2: leave the attribute off and the CSS grid keeps the page looking exactly as it
      // does today. Nothing else to undo.
      if (!renderer) return;
      resizeObserver.observe(canvas);
      syncSize();
    });

    return () => {
      disposed = true;
      requestRef.current = null;
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      unsubscribeMarks();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      window.removeEventListener("resize", syncSize);
      document.removeEventListener("visibilitychange", onVisibility);
      wideViewport.removeEventListener("change", syncSize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("mouseleave", onPointerGone);
      window.removeEventListener("blur", onPointerGone);
      reduceMotion.removeEventListener("change", request);
      coarsePointer.removeEventListener("change", request);
      dprQuery?.removeEventListener("change", syncSize);
      layer?.removeAttribute("data-grid-canvas");
      renderer?.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={`absolute inset-0 h-full w-full ${className ?? ""}`} />;
}
