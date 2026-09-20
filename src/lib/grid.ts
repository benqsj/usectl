// Shared constants for the page's background grid (see BackgroundLines.tsx) — anything that needs to align with the
// grid (e.g. HeroSection's corner cross marks) should import from here instead of hardcoding its own copy of these
// numbers, so the two can't silently drift apart.

export const CANVAS_WIDTH_REF = 1920; // Figma canvas reference width

// The narrowest width the design scales down to — below it --s stops shrinking (see globals.css).
export const SCALE_FLOOR_WIDTH = 1280;
export const SCALE_FLOOR = SCALE_FLOOR_WIDTH / CANVAS_WIDTH_REF; // 0.66667

// THE way to write a design measurement in CSS. `s(136)` means "136px at 1920, proportionally less
// below, proportionally more above" — see the --s comment in globals.css. It works anywhere a length
// does: inline styles, Tailwind arbitrary values (`text-[calc(var(--s)*136)]`), inside calc().
export const s = (px: number) => `calc(var(--s) * ${px})`;

// The historical name for the same thing. This used to emit `px / 1920 * 100vw`, which is precisely
// what --s resolves to from 1280 upwards — so every existing call site behaves identically at and
// above the floor, and merely stops shrinking below it.
export const vw = (px: number) => s(px);

// The same factor as a NUMBER, for the GSAP/JS side (px offsets, pin distances, model widths — see
// responsive-scaling.md). Reads the resolved custom property so the CSS stays the single source of
// truth; the innerWidth fallback covers non-browser paths and mirrors the formula in globals.css.
export const readScale = (): number => {
  if (typeof window === "undefined") return 1;
  const raw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--s"));
  if (Number.isFinite(raw) && raw > 0) return raw;
  return Math.max(SCALE_FLOOR, window.innerWidth / CANVAS_WIDTH_REF);
};

export const INSET_VW = vw(99); // content container inset — must stay in sync with Header.tsx's own left/right padding
export const COLUMN_PITCH = vw(82); // vertical line spacing
export const ROW_PITCH = vw(114); // horizontal line spacing
export const HEADER_HEIGHT_PX = 96; // Header.tsx h-24 — fixed on purpose, does NOT scale

// x position (from the viewport's left edge) of vertical column line number `i` (0-indexed)
export const columnX = (i: number) => `calc(${INSET_VW} + ${i} * ${COLUMN_PITCH})`;

// y position (from the header's bottom edge, i.e. add HEADER_HEIGHT_PX for a page-absolute value) of horizontal row
// line number `j` (1-indexed — row 1 is the first line below the header)
export const rowY = (j: number) => `calc(${j} * ${ROW_PITCH})`;

// ---------------------------------------------------------------------------------------------
// Shape of the grid, as plain numbers.
//
// Everything above emits CSS strings for markup; everything below is the SAME geometry as numbers,
// for the WebGL layer that draws the grid (see lib/gridEffect/) and for anything that needs to
// snap to it in JS. Both sides read these constants, so the canvas and the CSS fallback cannot
// drift apart.
// ---------------------------------------------------------------------------------------------

export const NUM_COLUMNS = 22; // 1722 / 82 + 1, matches the confirmed x=99..1820 span
export const LINE_THICKNESS_PX = 2; // thicker than a hairline on purpose — with fluid (vw) pitch, 1px lines land on fractional device pixels and anti-alias unevenly (some crisp, some blurry); 2px makes that variance much less noticeable
export const LINE_ALPHA = 0.02;
export const LINE_COLOR = `rgba(255,255,255,${LINE_ALPHA})`;

// The one breakpoint the grid's hide-lists switch on. Evaluate it with matchMedia (NOT
// innerWidth arithmetic) so the JS/canvas side flips at the exact same pixel as the
// `min-[1800px]:` / `max-[1799px]:` Tailwind classes do.
export const WIDE_BREAKPOINT_PX = 1800;
export const isWideViewport = () =>
  typeof window !== "undefined" && window.matchMedia(`(min-width: ${WIDE_BREAKPOINT_PX}px)`).matches;

// Explicit hide-lists for vertical columns — replaces four failed CSS-mask attempts (mask-composite, data-URI SVG
// mask, inline SVG mask with userSpaceOnUse, inline SVG mask with objectBoundingBox — see PROJECT.md for why).
// Column numbers are 1-indexed left to right (BackgroundLines' data-col attribute matches).
// "Start" columns (2-3) sit under the header logo — computed from its fixed-px box (130px offset, 150px wide, see
// Header.tsx), not yet user-confirmed. "Middle" columns (9-14 wide / 8-15 narrow) sit under the header nav text —
// user-counted by eye, trustworthy. The middle gap continues for exactly one row below the header (2026-09-17,
// corrected from an earlier version that continued it for the whole page — user only wanted the first occurrence),
// then the rest of the page shows the full, unbroken grid.
export const START_COLUMNS = new Set([2, 3]);
export const MIDDLE_COLUMNS_WIDE = new Set([9, 10, 11, 12, 13, 14]); // hidden at >=1800px (FullHD-ish)
export const MIDDLE_COLUMNS_NARROW = new Set([8, 9, 10, 11, 12, 13, 14, 15]); // hidden below 1800px

export const HEADER_HIDE_WIDE = new Set([...START_COLUMNS, ...MIDDLE_COLUMNS_WIDE]);
export const HEADER_HIDE_NARROW = new Set([...START_COLUMNS, ...MIDDLE_COLUMNS_NARROW]);

export interface GridMetrics {
  /** the resolved --s factor */
  k: number;
  /** the layer's own width in CSS px (viewport width excluding a classic scrollbar) */
  width: number;
  inset: number;
  colPitch: number;
  rowPitch: number;
  /** fixed 96px — the header does NOT scale */
  header: number;
  /** y of the first horizontal line; also where the "columns only" band under the header ends */
  firstRowY: number;
  /** right edge of the column container — the last column's centre sits exactly on it */
  containerRight: number;
}

export function gridMetrics(
  width: number = typeof document === "undefined" ? CANVAS_WIDTH_REF : document.documentElement.clientWidth,
  k: number = readScale(),
): GridMetrics {
  const inset = 99 * k;
  const rowPitch = 114 * k;
  return {
    k,
    width,
    inset,
    colPitch: 82 * k,
    rowPitch,
    header: HEADER_HEIGHT_PX,
    firstRowY: HEADER_HEIGHT_PX + rowPitch,
    containerRight: width - inset,
  };
}

/** x (CSS px, from the viewport's left edge) of the centre of column `n`, 1-indexed */
export const columnCenterX = (n: number, m: GridMetrics) => m.inset + (n - 1) * m.colPitch;

/** y (CSS px, page top) of horizontal row line `j`, 1-indexed. The line covers [y, y + 2]. */
export const rowTopY = (j: number, m: GridMetrics) => m.header + j * m.rowPitch;

/** the column whose centre is closest to `x`, clamped into 1..NUM_COLUMNS */
export const nearestColumn = (x: number, m: GridMetrics) =>
  Math.min(NUM_COLUMNS, Math.max(1, Math.round((x - m.inset) / m.colPitch) + 1));

/** the row line closest to `y`, clamped to 1 (row 0 would be inside the header) */
export const nearestRow = (y: number, m: GridMetrics) => Math.max(1, Math.round((y - m.header) / m.rowPitch));
