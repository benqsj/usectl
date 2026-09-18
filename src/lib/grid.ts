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
