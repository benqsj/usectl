// Numbers describing the hero's 3D server. Kept in a plain module (no three.js import) so the
// Server Component, the client component and the scroll animation can all read them without any
// of them pulling three.js into a bundle that doesn't need it.

/** Single meshopt-compressed GLB (416 KB) holding the geometry AND the explode_sequence clip. */
export const HERO_MODEL_URL = "/herosection/3D/server.glb";

/** Wrapper width the scale below was calibrated at — see HERO_MODEL_PX_PER_UNIT. */
export const HERO_MODEL_BASE_WIDTH_PX = 400;

/**
 * World unit -> css px, at HERO_MODEL_BASE_WIDTH_PX. Measured rather than guessed: at this scale
 * the closed model renders 400x409 px, against the 401x408 px the four layer SVGs used to
 * occupy in the same wrapper (their vertical centres matched to within half a pixel too). That
 * is what makes this a drop-in replacement for the SVG stack and not a resize of the hero.
 */
export const HERO_MODEL_PX_PER_UNIT = 1045;

/** Each layer SVG was 372x256; the wrapper's --core-height still derives from that ratio. */
export const HERO_CORE_HEIGHT_RATIO = 256 / 372;

/**
 * The canvas is deliberately larger than the wrapper (as a multiple of the wrapper's width): the
 * exploded stack is roughly twice as tall as the closed one, and the silhouette gets ~25% wider
 * as the model turns. Both must overflow the wrapper rather than be clipped by it. Verified by
 * projecting the model's bounding box at every pose — the tightest margin left is ~25 px.
 */
export const HERO_STAGE_WIDTH_RATIO = 1.7;
export const HERO_STAGE_HEIGHT_RATIO = 2.75;

/** Isometric 3/4 pose, matching the SVG artwork the model replaces. */
export const HERO_MODEL_START_YAW_DEG = 45;
/** The camera always returns here, however far a drag tilted it. */
export const HERO_MODEL_REST_ELEVATION_DEG = 35;
export const HERO_MODEL_ELEVATION_MIN_DEG = 4;
export const HERO_MODEL_ELEVATION_MAX_DEG = 78;

/** Seconds per full 360° turn. Runs on real time, not on scroll, so it never stops. */
export const HERO_MODEL_ROTATION_SECONDS = 24;

/** How long a thrown spin (or a tilted camera) takes to settle back to the resting pose. */
export const HERO_MODEL_RESUME_TAU_S = 0.9;
/** Ceiling on the angular velocity a flick can hand over, in rad/s. */
export const HERO_MODEL_MAX_THROW = 14;
/** Degrees of camera tilt per pixel of vertical drag. */
export const HERO_MODEL_ELEV_DEG_PER_PX = 0.25;
