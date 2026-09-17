// Extra scroll distance (px) MachineSection's ScrollTrigger pin holds the screen for. Exported
// (not a local constant in the animation hook) so MachineSectionClient.tsx can server-render a
// matching SSR placeholder spacer — see the long comment on `ssrScrollReserveRef` in
// machineScrollAnimation.ts for why (same, already-diagnosed issue as
// heroLayers.ts/infrastructureLayout.ts).
//
// Bumped from 700 (originally just the wordmark entrance + a hold) to 1600 once the sequence grew
// a second half: topside.svg's own entrance (triggered at 45% of this distance) plus a SCRUBBED
// wordmark-fade-out/topside-grow-in over the remaining 40% — that last part needs real scroll room
// to feel "gradual" per instruction, not snap over a couple hundred px. A starting guess, not
// tuned against real feedback yet (same "tune live" spirit as every other pin-distance constant
// in this project).
export const MACHINE_PIN_SCROLL_DISTANCE = 1600;
