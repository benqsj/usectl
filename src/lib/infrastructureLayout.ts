// Extra scroll distance (px) InfrastructureSection's ScrollTrigger pin holds the section for while
// its 4-step text sequence (INFRASTRUCTURE_STEPS_GROUP_1) and the static-bar fill scrub. Exported
// (not a local constant in the animation hook) so InfrastructureSectionClient.tsx can
// server-render a matching SSR placeholder spacer — see the long comment on `ssrScrollReserveRef`
// in infrastructureScrollAnimation.ts for why that's needed (mirrors the identical, already-
// diagnosed issue in heroScrollAnimation.ts/heroLayers.ts).
//
// Bumped from 500 (originally just enough for the bar-fill alone) to 2000 now that the same pin
// also has to hold long enough to read 4 headings/paragraphs. The range is split into equal
// segments per step (2000 / 4 = 500px of scroll per step); the mask-reveal swap itself is
// time-based, not scroll-length based. Starting guess, not tuned against real user feedback yet.
export const INFRASTRUCTURE_PIN_SCROLL_DISTANCE = 2000;
