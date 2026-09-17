// Extra scroll distance (px) MachineSection's ScrollTrigger pin holds the screen for after its
// entrance sequence finishes playing, so it reads as a "chapter title" before the page continues
// into GROUP_2. Exported (not a local constant in the animation hook) so
// MachineSectionClient.tsx can server-render a matching SSR placeholder spacer — see the long
// comment on `ssrScrollReserveRef` in machineScrollAnimation.ts for why (same, already-diagnosed
// issue as heroLayers.ts/infrastructureLayout.ts).
//
// Within the requested 600-800px range — a starting guess, not tuned against real feedback yet
// (same "tune live" spirit as the other two pinned sections' own distance constants).
export const MACHINE_PIN_SCROLL_DISTANCE = 700;
