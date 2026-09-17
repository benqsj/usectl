// Extra scroll distance (px) the machine pin holds the screen for. Exported (not local to the
// animation hook) so MachineSectionClient.tsx can server-render a matching SSR placeholder spacer
// — see the long comment on `ssrScrollReserveRef` in machineScrollAnimation.ts for why (same
// already-diagnosed issue as heroLayers.ts / infrastructureLayout.ts).
//
// This one pin now covers the WHOLE sequence, per the approved demo: the "machine" wordmark, the
// topside plate growing and its hatch opening, flying through it, the steps 3-8 card arriving from
// the depth, and then all six of those steps. Roughly: entrance+flight ≈ 3 screens, the card's
// approach ≈ 2, then ≈ 1 per step.
export const MACHINE_PIN_SCROLL_DISTANCE = 7200;

// Phase boundaries as fractions of that distance (tune live — see machineScrollAnimation.ts).
export const MACHINE_PHASES = {
  wordIn: 0.02,
  plateIn: 0.09,
  plateFull: 0.14,
  wordOut: 0.14,
  zoomStart: 0.14, // the plate starts growing the moment the wordmark starts leaving
  zoomEnd: 0.36, // by here we're through the hatch
  cardAtHole: 0.9, // the card appears once the hatch is this far open
  cardEnd: 0.58, // and has been flown all the way to full size by here
} as const;
