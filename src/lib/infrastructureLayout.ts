// Extra scroll distance (px) each InfrastructureSection ScrollTrigger pin holds the page for.
// Exported (not local to the animation hook) so InfrastructureSectionClient.tsx can server-render a
// matching SSR placeholder spacer — see `ssrScrollReserveRef` in infrastructureScrollAnimation.ts
// (mirrors the already-diagnosed issue in heroScrollAnimation.ts/heroLayers.ts).
// Starting guesses, not tuned against real user feedback yet.

// Intro (steps 1-2): equal halves — step 2 (text swap + the server opening, together) triggers at
// the halfway point.
export const INFRASTRUCTURE_INTRO_PIN_SCROLL_DISTANCE = 2000;

// After machine (steps 3-8): equal slices, ~600px of scroll per step.
export const INFRASTRUCTURE_AFTER_MACHINE_PIN_SCROLL_DISTANCE = 3600;
