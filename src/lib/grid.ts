// Shared constants for the page's background grid (see BackgroundLines.tsx) — anything that needs
// to align with the grid should import from here instead of hardcoding its own copy of these
// numbers, so the two can't silently drift apart.

export const CANVAS_WIDTH_REF = 1920; // Figma canvas reference width

// The narrowest width the design scales down to — below it --s stops shrinking (see globals.css).
export const SCALE_FLOOR_WIDTH = 1024; // was 1280; lowered 2026-09-29 so 1024-1279 tablets (landscape) get the whole desktop scene scaled to fit instead of clipped at the right edge
export const SCALE_FLOOR = SCALE_FLOOR_WIDTH / CANVAS_WIDTH_REF; // 0.53333

// THE way to write a design measurement in CSS. `s(136)` means "136px at 1920, proportionally less
// below, proportionally more above" — see the --s comment in globals.css. It works anywhere a length
// does: inline styles, Tailwind arbitrary values (`text-[calc(var(--s)*136)]`), inside calc().
export const s = (px: number) => `calc(var(--s) * ${px})`;

// The historical name for the same thing.
export const vw = (px: number) => s(px);

// The same factor as a NUMBER, for the GSAP/JS side (px offsets, pin distances). Reads the
// resolved custom property so the CSS stays the single source of truth; the innerWidth fallback
// covers non-browser paths and mirrors the formula in globals.css.
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

export const NUM_COLUMNS = 22; // 1722 / 82 + 1, matches the confirmed x=99..1820 span
export const LINE_THICKNESS_PX = 2; // thicker than a hairline on purpose — with fluid (vw) pitch, 1px lines land on fractional device pixels and anti-alias unevenly (some crisp, some blurry); 2px makes that variance much less noticeable
export const LINE_ALPHA = 0.02;
export const LINE_COLOR = `rgba(255,255,255,${LINE_ALPHA})`;

// Explicit hide-lists for vertical columns — replaces four failed CSS-mask attempts (mask-composite, data-URI SVG
// mask, inline SVG mask with userSpaceOnUse, inline SVG mask with objectBoundingBox — see PROJECT.md for why).
// Column numbers are 1-indexed left to right (BackgroundLines' data-col attribute matches).
// "Start" columns (2-3) sit under the header logo; "middle" columns (9-14 wide / 8-15 narrow) sit under the header
// nav text. The middle gap continues for exactly one row below the header, then the rest of the page shows the
// full, unbroken grid.
export const START_COLUMNS = new Set([2, 3]);
export const MIDDLE_COLUMNS_WIDE = new Set([9, 10, 11, 12, 13, 14]); // hidden at >=1800px (FullHD-ish)
export const MIDDLE_COLUMNS_NARROW = new Set([8, 9, 10, 11, 12, 13, 14, 15]); // hidden below 1800px

export const HEADER_HIDE_WIDE = new Set([...START_COLUMNS, ...MIDDLE_COLUMNS_WIDE]);
export const HEADER_HIDE_NARROW = new Set([...START_COLUMNS, ...MIDDLE_COLUMNS_NARROW]);
