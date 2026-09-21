// Every knob the grid effect has, in one place — the lab page (/lab/lines) edits this shape live,
// and BackgroundLines.tsx ships the values the user picked there.
//
// 2026-09-21 (grid-trail.md): the mouse deformation, and then the glow that briefly replaced it,
// are both gone. The grid canvas itself is now fully static — it never reads the pointer at all.
// What is left is a separate pen-like TRAIL (GridTrail.tsx, its own 2D canvas) that draws behind the
// pointer while it is inside a section's own 4-cross region, in `#11a32a`, fading shortly after.

export interface GridEffectParams {
  /** cross marks: half-length of one arm, in design px (scaled by --s) */
  markArmPx: number;
  /** cross marks: arm thickness, design px. 2 = exactly as thick as a grid line */
  markThicknessPx: number;
  /** cross marks: peak alpha. 0.3 matches cross.svg's own stroke opacity */
  markAlpha: number;

  // --- pointer trail (grid-trail.md §3/§4) ---
  /** design px — stroke width of the trail */
  trailThicknessPx: number;
  /** ms — how long a point along the trail takes to fade out once drawn */
  trailFadeMs: number;
  /** design px — shadowBlur radius around the stroke */
  trailGlowPx: number;
  /** 0..1 — how much the pen tip lags the raw pointer position; frame-rate independent, higher = laggier */
  trailSmoothing: number;
}

export const GRID_EFFECT_DEFAULTS: GridEffectParams = {
  markArmPx: 16,
  markThicknessPx: 2,
  markAlpha: 0.3,
  // Chosen 2026-09-21 in an interactive demo (see grid-trail.md §3) — the demo's own slider values
  // (2.5 / 350ms / 26 / 0.40), converted to design px at 1920 so this project's own `k` reproduces
  // what the user looked at.
  trailThicknessPx: 3.7,
  trailFadeMs: 350,
  trailGlowPx: 35,
  trailSmoothing: 0.4,
};

// Must match the u_marks[] array size in shader.ts. Hero (4) + the machine wordmark (4) + the
// machine steps-card's four own frames (4 each, grid-trail.md §7) = 24 at once, mid-scroll through
// the machine screen — 32 leaves headroom for the build section's still-open TODO on top of that.
export const MAX_MARKS = 32;
