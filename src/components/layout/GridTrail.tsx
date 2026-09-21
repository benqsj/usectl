"use client";

import { useEffect, useRef } from "react";
import {
  LINE_THICKNESS_PX,
  columnCenterX,
  gridMetrics,
  nearestColumn,
  nearestRow,
  readScale,
  rowTopY,
  type GridMetrics,
} from "@/lib/grid";
import { GRID_EFFECT_DEFAULTS, type GridEffectParams } from "@/lib/gridEffect/config";
import { getRegions, type GridRegion } from "@/lib/gridEffect/marks";

const MAX_DPR = 2;
// Below this a trail segment is fully invisible — no point drawing it.
const MIN_ALPHA = 0.01;
// Hard cap on the buffer regardless of fade time, purely as a safety net against unbounded growth.
const MAX_POINTS = 900;

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

function regionRectCSS(region: GridRegion, m: GridMetrics) {
  return {
    left: columnCenterX(region.left, m),
    right: columnCenterX(region.right, m),
    // Same vertical centre the cross arms use — see marks.ts / GridCanvas's mark placement.
    top: rowTopY(region.top, m) + LINE_THICKNESS_PX / 2,
    bottom: rowTopY(region.bottom, m) + LINE_THICKNESS_PX / 2,
  };
}

/**
 * The pointer trail: a pen-like `#11a32a` stroke that runs ON the grid lines while the cursor is
 * inside a section's own "4 crosses" region, fading out shortly after (grid-trail.md, the
 * "ხაზებზე გასწორებული" variant chosen from a 7-way demo — §3). The pen only ever sits on an
 * intersection and moves in right angles: a horizontal leg along the row it just left, then a
 * vertical leg along the column it just entered — never a diagonal, and never off a real line.
 *
 * On its OWN 2D canvas, not in the grid's WebGL shader — see grid-trail.md §2 for why: the grid's
 * rest state is measured to within one grey level and a separate layer can't regress it, a glowing
 * polyline is two lines of Canvas 2D versus a per-pixel distance-to-polyline loop in GLSL, and the
 * trail is short-lived/local while the grid is static — different lifetimes, different layers.
 * Rendered by BackgroundLines.tsx directly on top of GridCanvas.
 *
 * Cost: no pointer listener at all under reduced motion / a coarse pointer, and the rAF loop only
 * runs while at least one trail point hasn't yet faded out — idle, or the pointer anywhere outside
 * every region, draws zero frames.
 */
export function GridTrail({ params, className }: { params?: Partial<GridEffectParams>; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<GridEffectParams>(GRID_EFFECT_DEFAULTS);

  useEffect(() => {
    paramsRef.current = { ...GRID_EFFECT_DEFAULTS, ...params };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    // Neither "no canvas, no listeners" case has anything left to animate — bail out before ever
    // touching the 2D context.
    if (reduceMotion.matches || coarsePointer.matches) return;

    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    // Re-bound to a variable TS can prove is non-null inside the closures below (`const` narrowing
    // does not propagate into nested function bodies).
    const ctx: CanvasRenderingContext2D = ctx2d;

    let disposed = false;
    let raf = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let metrics: GridMetrics = gridMetrics();
    let trailColor = "#11a32a";
    let dprQuery: MediaQueryList | null = null;

    const points: TrailPoint[] = [];
    let activeRegion: GridRegion | null = null;
    let hasTip = false;
    let tipX = 0;
    let tipY = 0;
    let targetX = 0;
    let targetY = 0;
    // The last grid cell (indices, not pixels) the pen actually landed on — null means the next
    // committed point starts a fresh stroke rather than continuing one.
    let lastCol: number | null = null;
    let lastRow: number | null = null;
    let lastFrameTime = 0;

    const request = () => {
      if (raf || disposed || document.hidden) return;
      raf = requestAnimationFrame(frame);
    };

    const readTrailColor = () => {
      const value = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim();
      trailColor = value || "#11a32a";
    };

    const hitRegion = (x: number, y: number): GridRegion | null => {
      for (const region of getRegions()) {
        if (region.opacity <= 0) continue;
        const rect = regionRectCSS(region, metrics);
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return region;
      }
      return null;
    };

    const clearCanvas = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    };

    const resetPen = () => {
      hasTip = false;
      points.length = 0;
      activeRegion = null;
      lastCol = null;
      lastRow = null;
    };

    const syncSize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      metrics = gridMetrics(canvas.clientWidth, readScale());
      readTrailColor();
      armDprWatch(dpr);
      // A resize can move every region rect, and the drawing buffer was just wiped by the width/
      // height assignment above — either way there is nothing sane left to keep on screen.
      resetPen();
    };

    const armDprWatch = (nextDpr: number) => {
      dprQuery?.removeEventListener("change", syncSize);
      dprQuery = window.matchMedia(`(resolution: ${nextDpr}dppx)`);
      dprQuery.addEventListener("change", syncSize);
    };

    function frame(now: number) {
      raf = 0;
      if (disposed) return;
      const p = paramsRef.current;
      const dt = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.1) : 1 / 60;
      lastFrameTime = now;

      if (hasTip && activeRegion) {
        // Frame-rate independent, same shape as the grid's old cursor easing: `trailSmoothing` is
        // how much of the gap to the raw pointer is LEFT after one 60fps frame (bigger = laggier).
        // This is what a fast flick "settles" through a cell rather than committing instantly.
        const follow = 1 - Math.pow(p.trailSmoothing, dt * 60);
        tipX += (targetX - tipX) * follow;
        tipY += (targetY - tipY) * follow;

        // The pen only ever sits on an intersection — clamped to the region's own bounds (grid
        // indices, same ones the marks use) so the stroke can never step outside the crosses'
        // rectangle; the clip() below is then a safety net, not the mechanism.
        const region = activeRegion;
        const col = Math.min(region.right, Math.max(region.left, nearestColumn(tipX, metrics)));
        const row = Math.min(region.bottom, Math.max(region.top, nearestRow(tipY, metrics)));
        const cellPoint = (c: number, r: number) => ({
          x: columnCenterX(c, metrics),
          // Same row-line centre the cross arms use.
          y: rowTopY(r, metrics) + LINE_THICKNESS_PX / 2,
        });

        if (lastCol === null || lastRow === null) {
          points.push({ ...cellPoint(col, row), t: now });
        } else if (col !== lastCol || row !== lastRow) {
          if (col !== lastCol && row !== lastRow) {
            // Horizontal leg along the row just left, to the new column — then the vertical leg
            // (pushed next) lands on the new row. Never a diagonal: each leg lies on a real line.
            points.push({ ...cellPoint(col, lastRow), t: now });
          }
          points.push({ ...cellPoint(col, row), t: now });
        }
        if (points.length > MAX_POINTS) points.splice(0, points.length - MAX_POINTS);
        lastCol = col;
        lastRow = row;
      }

      // Drop anything that has fully faded — this is what lets the loop stop on its own.
      while (points.length && now - points[0].t > p.trailFadeMs) points.shift();

      clearCanvas();

      const region = activeRegion ? (getRegions().find((r) => r.ownerId === activeRegion?.ownerId) ?? null) : null;
      const regionOpacity = region?.opacity ?? 0;

      if (points.length >= 2 && region && regionOpacity > 0) {
        const rect = regionRectCSS(region, metrics);
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.beginPath();
        ctx.rect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
        ctx.clip();

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = p.trailThicknessPx * metrics.k;
        ctx.strokeStyle = trailColor;
        ctx.shadowColor = trailColor;
        ctx.shadowBlur = p.trailGlowPx * metrics.k;

        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i];
          const b = points[i + 1];
          const age = now - (a.t + b.t) / 2;
          const alpha = Math.max(0, 1 - age / p.trailFadeMs) * regionOpacity;
          if (alpha < MIN_ALPHA) continue;
          ctx.globalAlpha = Math.min(alpha, 1);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // The whole point: this keeps going only as long as there is an actual stroke fading out.
      if (points.length) request();
    }

    const onPointerMove = (event: PointerEvent) => {
      const region = hitRegion(event.clientX, event.clientY);
      if (!region) {
        // Outside every region: lift the pen so the next stroke starts fresh instead of rubber-
        // banding in from wherever it last was. Whatever is already drawn keeps fading on its own
        // — no frame needs requesting for THIS event.
        hasTip = false;
        return;
      }
      activeRegion = region;
      targetX = event.clientX;
      targetY = event.clientY;
      if (!hasTip) {
        // Entering a region from cold: start the tip exactly at the pointer instead of sweeping in
        // from wherever it last was, and mark the next committed point as a fresh stroke.
        tipX = targetX;
        tipY = targetY;
        lastCol = null;
        lastRow = null;
        hasTip = true;
      }
      request();
    };

    const onScroll = () => {
      // Regions are viewport-space and only valid while their section is pinned — a stroke left
      // hanging mid-scroll would read as detached from the crosses it was drawn inside.
      resetPen();
      request();
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        resetPen();
      }
    };

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(canvas);
    syncSize();

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", syncSize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", syncSize);
      document.removeEventListener("visibilitychange", onVisibility);
      dprQuery?.removeEventListener("change", syncSize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ""}`}
    />
  );
}
