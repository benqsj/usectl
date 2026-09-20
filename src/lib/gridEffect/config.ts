// Every knob the grid effect has, in one place — the lab page (/lab/lines) edits this shape live,
// and BackgroundLines.tsx ships the values the user picked there.
//
// Chosen 2026-09-20 in the lab: variant "pull", radius 220, strength 16, easing 0.12
// (see background-line-animations.md §6).

export type GridEffectVariant = "pull" | "push" | "ripple";

export interface GridEffectParams {
  /** pull = lines bend TOWARDS the cursor, push = away, ripple = oscillating wake */
  variant: GridEffectVariant;
  /** CSS px — how far from the cursor the deformation is still felt (gaussian falloff) */
  radius: number;
  /** CSS px — how far a line is displaced at the cursor */
  strength: number;
  /** lerp factor per frame at 60fps; made frame-rate independent in GridCanvas */
  easing: number;
  /** how long the whole effect fades in/out when the pointer enters/leaves the window */
  activeFadeMs: number;
  /** ripple only */
  rippleFreq: number;
  rippleSpeed: number;
  /** cross marks: half-length of one arm, in design px (scaled by --s) */
  markArmPx: number;
  /** cross marks: arm thickness, design px. 2 = exactly as thick as a grid line */
  markThicknessPx: number;
  /** cross marks: peak alpha. 0.3 matches cross.svg's own stroke opacity */
  markAlpha: number;
}

export const GRID_EFFECT_DEFAULTS: GridEffectParams = {
  variant: "pull",
  radius: 220,
  strength: 16,
  easing: 0.12,
  activeFadeMs: 300,
  rippleFreq: 0.05,
  rippleSpeed: 3,
  markArmPx: 16,
  markThicknessPx: 2,
  markAlpha: 0.3,
};

// Must match the u_marks[] array size in shader.ts. Hero and the machine screen are 4 each, i.e.
// exactly 8 — headroom so that adding a third section (the infrastructure card and the build
// section are both open TODOs) cannot silently drop marks off the end.
export const MAX_MARKS = 16;
