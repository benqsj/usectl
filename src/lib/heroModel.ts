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

// ---- first-load intro --------------------------------------------------------------------------
// The server assembles itself when the page opens: the four pieces fall in one after another,
// bottom to top, and settle into the closed stack. Approved 2026-09-21 against the tuning demo
// (public/demo-intro.html); the reasoning and history are in hero-intro-animation.md.

/** Falling pieces, bottom to top — the order they land in. Node names inside server.glb. */
export const HERO_INTRO_PIECES = ["04_base", "03_core", "02_core", "01_cap"] as const;
/** The neon outline under the base. It does not fall; it fades in as the base lands. */
export const HERO_INTRO_RING = "05_accent_ring";

export const HERO_INTRO = {
  /** Plays the whole intro faster (>1) or slower (<1). */
  speed: 1,
  /** Seconds before the first piece starts falling. */
  delay: 0.25,
  /** Seconds one piece takes to fall. */
  fallSeconds: 0.62,
  /** Seconds between one piece starting and the next — less than fallSeconds, so they overlap. */
  gapSeconds: 0.4,
  /** How far above its resting place a piece starts, in world units (1 ≈ 1045px at 400px wide). */
  height: 0.3,
  /** Degrees a piece rocks while falling; it is perfectly level the moment it lands. */
  wobbleDeg: 10,
  /** How much a piece squashes DOWN into the stack on landing. Nothing ever moves up. */
  squash: 0.08,
  /** Degrees a piece turns around its own axis while falling (0 = none). */
  twistDeg: 0,
  /** Fraction of the fall a piece spends fading in. */
  fade: 0.3,
  /** Seconds the ring takes to fade in once the base has landed. */
  ringFadeSeconds: 0.25,
} as const;

/**
 * The hero copy's mask reveal, which is part of the same intro: every word (and the logo, and each
 * button) slides up out of its own clipping box, line after line. Approved 2026-09-21 in the demo
 * ("Mask — სიტყვებით ამოსვლა", start = cap landing − 1.3 s; was −1 until a later tweak the same day).
 */
export const HERO_INTRO_TEXT = {
  /** Seconds relative to the moment the cap lands (negative = before it lands). */
  offsetSeconds: -1.3,
  /** Seconds one word takes to come up. */
  unitSeconds: 0.8,
  /** Seconds between one line's last word starting and the next line starting. */
  lineGapSeconds: 0.14,
  /** Seconds between neighbouring words on a line. */
  wordGapSeconds: 0.06,
  /** How far below its mask a word starts, as % of its own height (plus 12px). */
  distancePercent: 110,
  easing: "cubic-bezier(.16,1,.3,1)",
} as const;

/** Seconds after the intro starts at which the text begins — i.e. cap landing + offset. */
export const heroIntroTextStartSeconds = () =>
  Math.max(
    0,
    (HERO_INTRO.delay +
      (HERO_INTRO_PIECES.length - 1) * HERO_INTRO.gapSeconds +
      HERO_INTRO.fallSeconds +
      HERO_INTRO_TEXT.offsetSeconds) /
      HERO_INTRO.speed,
  );
