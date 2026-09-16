// Shared constants for the page's background grid (see BackgroundLines.tsx) — anything that needs to align with the
// grid (e.g. HeroSection's corner cross marks) should import from here instead of hardcoding its own copy of these
// numbers, so the two can't silently drift apart.

export const CANVAS_WIDTH_REF = 1920; // Figma canvas reference width
export const vw = (px: number) => `${(px / CANVAS_WIDTH_REF) * 100}vw`;

export const INSET_VW = vw(99); // content container inset — must stay in sync with Header.tsx's own left/right padding
export const COLUMN_PITCH = vw(82); // vertical line spacing
export const ROW_PITCH = vw(114); // horizontal line spacing
export const HEADER_HEIGHT_PX = 96; // Header.tsx h-24 — fixed, doesn't scale

// x position (from the viewport's left edge) of vertical column line number `i` (0-indexed)
export const columnX = (i: number) => `calc(${INSET_VW} + ${i} * ${COLUMN_PITCH})`;

// y position (from the header's bottom edge, i.e. add HEADER_HEIGHT_PX for a page-absolute value) of horizontal row
// line number `j` (1-indexed — row 1 is the first line below the header)
export const rowY = (j: number) => `calc(${j} * ${ROW_PITCH})`;
