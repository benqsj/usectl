// Every knob the grid effect has, in one place — the lab page (/lab/lines) edits this shape live,
// and BackgroundLines.tsx ships the values the user picked there.
//
// 2026-09-21 (grid-glow.md): the mouse deformation is gone — the lines never bend. What is left is
// a glow that follows the pointer while it is inside a section's own 4-cross region (see
// gridEffect/marks.ts GridRegion). `easing` is reused for the glow's own follow-the-pointer lerp.

export interface GridEffectParams {
  /** lerp factor per frame at 60fps; frame-rate independent in GridCanvas — how the glow trails the pointer */
  easing: number;
  /** how long a region's glow intensity takes to fade in/out as the pointer enters/leaves it */
  glowFadeMs: number;
  /** cross marks: half-length of one arm, in design px (scaled by --s) */
  markArmPx: number;
  /** cross marks: arm thickness, design px. 2 = exactly as thick as a grid line */
  markThicknessPx: number;
  /** cross marks: peak alpha. 0.3 matches cross.svg's own stroke opacity */
  markAlpha: number;

  // --- glow (grid-glow.md §3/§4) ---
  /** design px — gaussian falloff radius of the glow around the pointer */
  glowRadiusPx: number;
  /** peak line alpha inside the glow, replacing the rest-state LINE_ALPHA at the pointer */
  lineGlowAlpha: number;
  /** peak alpha of the soft radial fill drawn under the lines */
  fillAlpha: number;
  /** fill colour */
  fillColor: "white" | "brand";
  /** design px feather on the region's own edge; 0 = hard edge exactly on the crosses' lines */
  regionFeatherPx: number;
  /** extra alpha a region's own 4 crosses get right at the glow's centre; 0 = off */
  markGlowBoost: number;
}

export const GRID_EFFECT_DEFAULTS: GridEffectParams = {
  easing: 0.12,
  glowFadeMs: 300,
  markArmPx: 16,
  markThicknessPx: 2,
  markAlpha: 0.3,
  glowRadiusPx: 180,
  lineGlowAlpha: 0.18,
  fillAlpha: 0.04,
  fillColor: "white",
  regionFeatherPx: 0,
  markGlowBoost: 0.2,
};

const WHITE_RGB: readonly [number, number, number] = [1, 1, 1];
// #11a32a, this project's --brand token (globals.css) — kept as a literal here rather than read
// from the DOM, since the renderer has no React/CSS access of its own.
const BRAND_RGB: readonly [number, number, number] = [0x11 / 255, 0xa3 / 255, 0x2a / 255];

export function resolveFillColor(color: GridEffectParams["fillColor"]): readonly [number, number, number] {
  return color === "brand" ? BRAND_RGB : WHITE_RGB;
}

// Must match the u_marks[] array size in shader.ts. Hero and the machine screen are 4 each, i.e.
// exactly 8 — headroom so that adding a third section (the infrastructure card and the build
// section are both open TODOs) cannot silently drop marks off the end.
export const MAX_MARKS = 16;

// Must match the u_regions[] / u_regionGlow[] array size in shader.ts. One region per section that
// calls useGridMarks — today that is hero + the machine screen, i.e. 2, with headroom for the two
// still-open TODOs (infrastructure card, build section).
export const MAX_REGIONS = 4;
