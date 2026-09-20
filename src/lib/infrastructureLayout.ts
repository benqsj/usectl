// Extra scroll distance (px) each InfrastructureSection ScrollTrigger pin holds the page for.
// Exported (not local to the animation hook) so InfrastructureSectionClient.tsx can server-render a
// matching SSR placeholder spacer — see `ssrScrollReserveRef` in infrastructureScrollAnimation.ts
// (mirrors the already-diagnosed issue in heroScrollAnimation.ts/heroLayers.ts).
// Starting guesses, not tuned against real user feedback yet.

// Intro (steps 1-2): equal halves — step 2 (text swap + the server opening, together) triggers at
// the halfway point. Shortened 2000 -> 1200 (2026-09-20, per feedback): this 2-step swap never
// showed the "two steps stuck visible" race the machine screen's 6-step sequence did (see
// machineLayout.ts's own MACHINE_PIN_SCROLL_DISTANCE comment for that bug), so there's no reason
// for it to need as much scroll.
export const INFRASTRUCTURE_INTRO_PIN_SCROLL_DISTANCE = 1200;

// After machine (steps 3-8): equal slices, ~600px of scroll per step.
export const INFRASTRUCTURE_AFTER_MACHINE_PIN_SCROLL_DISTANCE = 3600;
