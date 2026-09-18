// BuildSection (the closing CTA) pins the whole section for this many px of extra scroll while its
// server closes — see src/animations/buildScrollAnimation.ts. Also read by BuildSectionClient.tsx
// to server-render a matching SSR placeholder spacer (same reasoning as every other pinned section's
// `ssrScrollReserveRef` — see PROJECT.md for the original diagnosed bug this pattern guards against).
export const BUILD_PIN_SCROLL_DISTANCE = 900;

// The server's wrapper width — deliberately much smaller than the hero's own 400/480px. Per explicit
// request (2026-09-18): the server must come up close to the text and shrink enough that the
// heading/paragraph/buttons AND the fully-open server all fit in one screen at once, instead of the
// server sitting large below a normal scroll. NOTE: HeroServerModel.tsx's own canvas-positioning math
// hardcodes HERO_STACK_GAP_CLOSED_PX internally (not a prop) — only the WRAPPER WIDTH varies here,
// the stack-gap constants stay the hero's own values (imported, not redefined) so that internal math
// stays correct.
//
// Reference only, NOT imported by BuildSectionClient.tsx — Tailwind's build-time class scanner can't
// see a width interpolated from a JS constant, so the same 180/210 numbers are hardcoded literally
// in that file's `w-[180px] min-[1800px]:w-[210px]` classes (same "no template interpolation for
// Tailwind classes" rule noted throughout this project — see BackgroundLines.tsx's own column-hiding
// classes for the original instance of this constraint). Keep these two in sync by hand if either
// changes.
export const BUILD_MODEL_WIDTH_PX = 180;
export const BUILD_MODEL_WIDTH_WIDE_PX = 210;
