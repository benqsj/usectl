// Shared "cut top-left corner" treatment used across the page's bordered section cards (Pricing,
// Footer, and — per an explicit "make it consistent everywhere" request, 2026-09-18 — every other
// bordered card too). Centralized here so the chamfer size can't silently drift between sections,
// and so every card gets the SAME fix for the same underlying bug: `clip-path` only clips what an
// element already paints — it does NOT draw a new border stroke along the diagonal it cuts. A card
// with no background fill of its own (transparent, just `border`) needs an explicit diagonal
// accent element bridging the two clipped ends, or the "cut" is genuinely invisible (an empty gap,
// not a line) — see PROJECT.md for the full diagnosis (found first on a since-reverted BuildSection
// attempt, then again on Pricing's own older, pre-existing chamfer).
import { s } from "@/lib/grid";
export const CHAMFER_PX = 64;

// The cut is a design measurement like any other, so it goes through the page's scale (see
// globals.css / lib/grid.ts) rather than staying a hard 64px — at 1280 an unscaled 64px corner
// reads as an oversized bite out of a card that is itself two-thirds the size.
const chamfer = (px: number) => s(px);

// The 5-point polygon that clips a box's top-left corner at `px` (defaults to the shared size).
export function chamferClipPath(px: number = CHAMFER_PX): string {
  const c = chamfer(px);
  return `polygon(${c} 0, 100% 0, 100% 100%, 0 100%, 0 ${c})`;
}

// Inline style for the diagonal accent div that makes the clip-path cut actually visible — render
// it as `<div aria-hidden="true" className="pointer-events-none absolute bg-white/10" style={chamferDiagonalStyle()} />`,
// as the first child of the chamfered element (so it's positioned relative to it).
export function chamferDiagonalStyle(px: number = CHAMFER_PX) {
  return {
    width: chamfer(px * Math.SQRT2),
    height: 1,
    top: chamfer(px / 2),
    left: chamfer(px / 2),
    transform: "translate(-50%, -50%) rotate(-45deg)",
  } as const;
}
