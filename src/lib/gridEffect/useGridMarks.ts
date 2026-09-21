"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import type { RefObject } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  NUM_COLUMNS,
  columnCenterX,
  gridMetrics,
  nearestColumn,
  nearestRow,
  readScale,
  rowTopY,
} from "@/lib/grid";
import { clearMarks, setMarks, type GridMark, type GridRegionInput } from "./marks";

export interface AnchorBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface GridMarksOptions {
  /**
   * Design px the cross should sit outside the anchor's left/right edge, before snapping.
   * ZERO means "whichever intersection is nearest that edge, inside or outside" — which is what
   * the hero wants vertically, its marks landing on the model box's own top and bottom edges.
   * NEGATIVE pulls the target inside the box. `minGap` only applies to a positive (outward) gap:
   * a zero or negative gap is an explicit request not to be pushed away.
   */
  gapX: number;
  /** design px above/below the anchor, before snapping; 0 = nearest, negative = inside */
  gapY: number;
  /** design px — never let an OUTWARD snap land closer than this to the anchor's box */
  minGap?: number;
  /**
   * Supply the anchor's viewport box yourself instead of letting the hook call
   * getBoundingClientRect(). Needed where the rect the marks should be snapped to is not the rect
   * the element happens to have when this runs — e.g. the hero, whose model is mid-transform for
   * most of its pin and whose section is position:fixed while pinned.
   */
  box?: () => AnchorBox | null;
  /**
   * Publish the rectangle spanned by these 4 crosses as a region too, for GridTrail.tsx to draw
   * the pointer trail inside (grid-trail.md §2/§3). Default true — every existing caller gets the
   * trail with no changes of its own.
   */
  trail?: boolean;
  /**
   * `"edge"` (default) — the existing gapX/gapY snap, plus the viewport-centre mirror rule.
   * `"center"` — ignores gapX/gapY entirely: finds the tightest enclosing column/row pair that
   * clears the box by `minGap`, then checks stepping either edge out by one more line and keeps
   * whichever pair leaves the most EQUAL gap on both sides (ties keep the tighter pair). For
   * content that isn't centred on the viewport, so the plain mirror trick doesn't apply
   * (grid-trail.md §7) — e.g. a diagram sitting in a card's own column, not the page centre.
   */
  fit?: "edge" | "center";
}

export interface GridMarksHandle {
  /**
   * Re-read the anchor's viewport box and re-snap. Cheap but it DOES force layout, so call it at
   * moments, never per frame: mount, resize and ScrollTrigger refresh are wired up here already;
   * a pinned section should also call it when its pin activates, because that is when the anchor
   * finally stops moving relative to the viewport.
   */
  refreshAnchor: () => void;
  /** per-frame safe: only changes how the existing marks look, never where they are */
  setAppearance: (appearance: { opacity: number; scale?: number }) => void;
}

const DEFAULT_MIN_GAP = 24;

// `fit: "center"` axis solver. `lo0`/`hi0` are the tightest enclosing pair (already stepped out to
// clear the box by `minGap`); this only ever considers stepping ONE further line out on either
// side, since a second step would only make the gap more lopsided, never less. Grid pitch is fixed,
// so a perfectly equal gap is not always possible — this returns whichever of the (up to 4)
// candidate pairs comes closest, preferring the tighter one on a tie.
function fitCenterAxis(
  lo0: number,
  hi0: number,
  loMin: number,
  hiMax: number,
  centerAt: (i: number) => number,
  boxLo: number,
  boxHi: number,
): { lo: number; hi: number } {
  const los = [lo0, Math.max(loMin, lo0 - 1)];
  const his = [hi0, Math.min(hiMax, hi0 + 1)];
  let best = { lo: lo0, hi: hi0 };
  let bestDiff = Infinity;
  let bestSpread = Infinity;
  for (const lo of los) {
    for (const hi of his) {
      if (lo >= hi) continue;
      const gapLo = boxLo - centerAt(lo);
      const gapHi = centerAt(hi) - boxHi;
      const diff = Math.abs(gapLo - gapHi);
      const spread = lo0 - lo + (hi - hi0);
      if (diff < bestDiff - 1e-6 || (Math.abs(diff - bestDiff) <= 1e-6 && spread < bestSpread)) {
        best = { lo, hi };
        bestDiff = diff;
        bestSpread = spread;
      }
    }
  }
  return best;
}

/**
 * Turns an element's box into four cross marks sitting on real grid intersections around it.
 *
 * The crosses used to be `cross.svg` images positioned by hand-tuned offsets, and they drifted off
 * the lines at every width that was not the one they were tuned at — because the content is laid
 * out by one rule (fixed px per breakpoint, viewport-height centring while pinned) and the grid by
 * another (vw-fluid, viewport-fixed). Two coordinate systems only coincide where you tuned them.
 * Snapping to the nearest intersection instead means the gap to the anchor varies a little between
 * screen sizes — accepted — but the cross is always exactly on the lines. See
 * background-line-animations.md §2 and §5.
 */
export function useGridMarks(
  anchorRef: RefObject<HTMLElement | null>,
  options: GridMarksOptions,
): GridMarksHandle {
  const ownerId = useId();
  // Kept in a ref so a caller passing an inline options object does not re-run everything below on
  // every render; written in an effect rather than during render (react-hooks/refs).
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const appearanceRef = useRef({ opacity: 0, scale: 1 });
  const cellsRef = useRef<{ col: number; row: number }[]>([]);
  const regionCellsRef = useRef<{ left: number; right: number; top: number; bottom: number } | null>(null);

  const publish = useCallback(() => {
    const { opacity, scale } = appearanceRef.current;
    const marks: GridMark[] = cellsRef.current.map((cell) => ({ ...cell, opacity, scale }));
    const cells = regionCellsRef.current;
    const region: GridRegionInput | null = cells ? { ...cells, opacity } : null;
    setMarks(ownerId, marks, region);
  }, [ownerId]);

  const refreshAnchor = useCallback(() => {
    const el = anchorRef.current;
    const { gapX, gapY, minGap = DEFAULT_MIN_GAP, box, trail = true, fit = "edge" } = optionsRef.current;
    const rect = box ? box() : el?.getBoundingClientRect();
    if (!rect) return;
    if (rect.right - rect.left === 0 && rect.bottom - rect.top === 0) return;

    const k = readScale();
    const m = gridMetrics(undefined, k);
    const gx = gapX * k;
    const gy = gapY * k;
    const mg = minGap * k;

    let left: number;
    let right: number;
    let top: number;
    let bottom: number;

    if (fit === "center") {
      // Tightest pair that clears the box by `minGap` on each axis, then check ONE step further
      // out on either edge for whichever pair leaves the most equal gap either side — see
      // fitCenterAxis. No viewport-centre mirror here: this anchor usually isn't centred on the
      // page at all (a diagram inside a card's own column, say), so that trick doesn't apply.
      let l0 = nearestColumn(rect.left, m);
      while (l0 > 1 && columnCenterX(l0, m) > rect.left - mg) l0 -= 1;
      let r0 = nearestColumn(rect.right, m);
      while (r0 < NUM_COLUMNS && columnCenterX(r0, m) < rect.right + mg) r0 += 1;
      const cols = fitCenterAxis(l0, r0, 1, NUM_COLUMNS, (i) => columnCenterX(i, m), rect.left, rect.right);
      left = cols.lo;
      right = cols.hi;

      let t0 = nearestRow(rect.top, m);
      while (t0 > 1 && rowTopY(t0, m) > rect.top - mg) t0 -= 1;
      let b0 = nearestRow(rect.bottom, m);
      while (rowTopY(b0, m) < rect.bottom + mg) b0 += 1;
      const rows = fitCenterAxis(t0, b0, 1, Infinity, (j) => rowTopY(j, m), rect.top, rect.bottom);
      top = rows.lo;
      bottom = rows.hi;
    } else {
      // Left: the intersection nearest the requested gap, stepped one more column out if the snap
      // pulled it in too close to (or inside) the anchor. The step-out only applies to an OUTWARD
      // gap — a negative gap is an explicit "I want this inside the box".
      left = nearestColumn(rect.left - gx, m);
      if (gx > 0) while (left > 1 && columnCenterX(left, m) > rect.left - mg) left -= 1;

      right = nearestColumn(rect.right + gx, m);
      if (gx > 0) while (right < NUM_COLUMNS && columnCenterX(right, m) < rect.right + mg) right += 1;

      // The grid is symmetric about the viewport centre, so for an anchor that is itself centred
      // (everything this is used on so far) the exact mirror guarantees a symmetric pair — worth
      // more than half a column of extra accuracy on one side.
      const anchorCentre = (rect.left + rect.right) / 2;
      if (Math.abs(anchorCentre - m.width / 2) < m.colPitch / 2) {
        right = NUM_COLUMNS + 1 - left;
      }

      top = nearestRow(rect.top - gy, m);
      if (gy > 0) while (top > 1 && rowTopY(top, m) > rect.top - mg) top -= 1;

      bottom = nearestRow(rect.bottom + gy, m);
      if (gy > 0) while (rowTopY(bottom, m) < rect.bottom + mg) bottom += 1;
    }

    cellsRef.current = [
      { col: left, row: top },
      { col: right, row: top },
      { col: left, row: bottom },
      { col: right, row: bottom },
    ];
    regionCellsRef.current = trail ? { left, right, top, bottom } : null;
    publish();
  }, [anchorRef, publish]);

  const setAppearance = useCallback(
    ({ opacity, scale }: { opacity: number; scale?: number }) => {
      const current = appearanceRef.current;
      const nextScale = scale ?? current.scale;
      if (current.opacity === opacity && current.scale === nextScale) return;
      current.opacity = opacity;
      current.scale = nextScale;
      publish();
    },
    [publish],
  );

  useEffect(() => {
    refreshAnchor();
    const onResize = () => refreshAnchor();
    window.addEventListener("resize", onResize);
    // Any ScrollTrigger refresh means the page was re-measured — pins were reverted and rebuilt, so
    // the anchor may well sit somewhere else now.
    ScrollTrigger.addEventListener("refresh", refreshAnchor);
    return () => {
      window.removeEventListener("resize", onResize);
      ScrollTrigger.removeEventListener("refresh", refreshAnchor);
      clearMarks(ownerId);
    };
  }, [refreshAnchor, ownerId]);

  return { refreshAnchor, setAppearance };
}
