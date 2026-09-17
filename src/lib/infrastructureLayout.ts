// Extra scroll distance (px) InfrastructureSection's ScrollTrigger pin holds the section for while
// the static-bar fill scrubs. Exported (not a local constant in the animation hook) so
// InfrastructureSection.tsx can server-render a matching SSR placeholder spacer — see the long
// comment on `ssrScrollReserveRef` in infrastructureScrollAnimation.ts for why that's needed
// (mirrors the identical, already-diagnosed issue in heroScrollAnimation.ts/heroLayers.ts).
export const INFRASTRUCTURE_PIN_SCROLL_DISTANCE = 500;
