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
 * The background grid, drawn on a WebGL2 canvas.
 *
 * CSS first, canvas second: the gradient layers next to this one (CssGridLines) are what paints on
 * first paint and what stays if anything here fails. Only once WebGL2 is up AND a frame is
 * actually on screen does this set `data-grid-canvas="on"` on its parent, which is what hides
 * them (see globals.css). So there is never a frame with two grids, and never one with none.
 *
 * The grid itself never moves and never changes colour (grid-trail.md, 2026-09-21 — an earlier
 * version bent the lines around the cursor, a later one brightened them near it; the user asked
 * for neither). This canvas takes NO pointer input at all — it redraws only on resize, DPR change,
 * a breakpoint crossing, or when the published cross marks change (a section fading its own
 * crosses in/out). The pointer trail lives on its own layer, `GridTrail.tsx`, painted on top.
 *
 * Cost: the renderer is behind a dynamic import so it is not in the first-paint bundle, and there
 * is no per-frame loop at all beyond the handful of frames a mark fade actually needs — an idle
 * page draws zero frames, same as before there was ever a pointer effect here.
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
    let firstFrameShown = false;
    let metrics: GridMetrics = gridMetrics();
    let hiddenMask = 0;
    let dprQuery: MediaQueryList | null = null;

    const marksBuffer = new Float32Array(MAX_MARKS * 4);

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

    function frame() {
      raf = 0;
      if (disposed || !renderer) return;
      const p = paramsRef.current;

      // Marks are stored as grid indices, so they are turned into pixels here, against the CURRENT
      // metrics, every frame — which is why a resize can never leave one off its line. Invisible
      // marks (opacity 0 — a frame whose step isn't current) are filtered out BEFORE the cap, so a
      // page with more owners than MAX_MARKS never drops a mark that's actually on screen in favour
      // of one that isn't (grid-trail.md §7).
      const marks = getMarks().filter((mark) => mark.opacity > 0);
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
    }

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else {
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
      dprQuery?.removeEventListener("change", syncSize);
      layer?.removeAttribute("data-grid-canvas");
      renderer?.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={`absolute inset-0 h-full w-full ${className ?? ""}`} />;
}
