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
import { GRID_EFFECT_DEFAULTS, MAX_MARKS, type GridEffectParams } from "@/lib/gridEffect/config";
import { getMarks, subscribeMarks } from "@/lib/gridEffect/marks";
import type { GridRenderer } from "@/lib/gridEffect/renderer";

const MAX_DPR = 2;

/**
 * The background grid, drawn on a WebGL2 canvas so it can bend around the cursor.
 *
 * CSS first, canvas second: the gradient layers next to this one (CssGridLines) are what paints on
 * first paint and what stays if anything here fails. Only once WebGL2 is up AND a frame is
 * actually on screen does this set `data-grid-canvas="on"` on its parent, which is what hides
 * them (see globals.css). So there is never a frame with two grids, and never one with none.
 *
 * Cost, since "won't it make the site heavier" was the question that shaped this: the renderer is
 * behind a dynamic import so it is not in the first-paint bundle, the pointer listener is passive
 * and only records a position, and the rAF loop stops itself the moment the eased cursor has
 * caught up and nothing is fading — an idle page draws zero frames.
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

    const startedAt = performance.now();
    const marksBuffer = new Float32Array(MAX_MARKS * 4);

    // Parked far off-screen so nothing is deformed until the pointer is actually seen.
    const cursor = { targetX: -1e5, targetY: -1e5, x: -1e5, y: -1e5, active: 0, targetActive: 0 };

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

      // Reduced motion and touch both get the grid, and the crosses on their exact lines — just no
      // deformation, and no pointer tracking to pay for.
      const motionless = reduceMotion.matches || coarsePointer.matches;
      let settled = true;
      if (motionless) {
        cursor.active = 0;
        cursor.targetActive = 0;
      } else {
        // Frame-rate independent: `easing` is the fraction covered in one 60fps frame.
        const follow = 1 - Math.pow(1 - p.easing, dt * 60);
        cursor.x += (cursor.targetX - cursor.x) * follow;
        cursor.y += (cursor.targetY - cursor.y) * follow;
        const fade = p.activeFadeMs > 0 ? 1 - Math.pow(0.001, (dt * 1000) / p.activeFadeMs) : 1;
        cursor.active += (cursor.targetActive - cursor.active) * fade;

        settled =
          Math.hypot(cursor.targetX - cursor.x, cursor.targetY - cursor.y) < 0.1 &&
          Math.abs(cursor.targetActive - cursor.active) < 0.002;
        if (settled) {
          cursor.x = cursor.targetX;
          cursor.y = cursor.targetY;
          cursor.active = cursor.targetActive;
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

      renderer.draw({
        mouseX: cursor.x,
        mouseY: cursor.y,
        active: motionless ? 0 : cursor.active,
        time: (now - startedAt) / 1000,
        radius: p.radius * metrics.k,
        strength: p.strength * metrics.k,
        sign: p.variant === "push" ? -1 : 1,
        variant: p.variant === "ripple" ? 1 : 0,
        rippleFreq: p.rippleFreq,
        rippleSpeed: p.rippleSpeed,
        metrics,
        lineAlpha: LINE_ALPHA,
        halfThickness: LINE_THICKNESS_PX / 2,
        hiddenMask,
        marks: marksBuffer,
        markCount,
        markHalfThickness: (p.markThicknessPx * metrics.k) / 2,
      });

      if (!firstFrameShown) {
        firstFrameShown = true;
        // One frame later, so the canvas has definitely composited before the CSS grid disappears.
        requestAnimationFrame(() => {
          if (!disposed) layer?.setAttribute("data-grid-canvas", "on");
        });
      }

      // The ripple variant is the one thing that animates without any input, so it keeps the loop
      // alive — but only while the effect is actually showing.
      const rippling = p.variant === "ripple" && cursor.active > 0.002;
      if (!motionless && (!settled || rippling)) request();
      else lastTime = 0;
    }

    const onPointerMove = (event: PointerEvent) => {
      // First sighting: start the eased position AT the cursor instead of letting it sweep in from
      // the off-screen parking spot.
      if (cursor.targetActive === 0 && cursor.active < 0.002) {
        cursor.x = event.clientX;
        cursor.y = event.clientY;
      }
      cursor.targetX = event.clientX;
      cursor.targetY = event.clientY;
      cursor.targetActive = 1;
      request();
    };
    const onPointerGone = () => {
      cursor.targetActive = 0;
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
