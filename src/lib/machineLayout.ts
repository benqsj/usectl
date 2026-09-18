// Extra scroll distance (px) the machine pin holds the screen for. Exported (not local to the
// animation hook) so MachineSectionClient.tsx can server-render a matching SSR placeholder spacer
// — see the long comment on `ssrScrollReserveRef` in machineScrollAnimation.ts for why (same
// already-diagnosed issue as heroLayers.ts / infrastructureLayout.ts).
//
// This one pin now covers the WHOLE sequence, per the approved demo: the "machine" wordmark, the
// topside plate growing and its hatch opening, flying through it, the steps 3-8 card arriving from
// the depth, and then all six of those steps. Roughly: entrance+flight ≈ 3 screens, the card's
// approach ≈ 2, then ≈ 1 per step.
//
// Raised 7200 -> 8000 -> 8400 -> 8800 on 2026-09-18, purely to give the steps that carry a diagram
// room to play it and then hold (see STEP_WEIGHTS in machineScrollAnimation.ts — indices 2-5 each
// went from 2 to 4). Every fraction below was divided by the same ratio in the same edits, so ALL
// of the extra 1600px lands after `cardEnd`, i.e. in the steps: the wordmark, the plate, the flight
// through the hatch and the card's approach still take exactly the scroll they always took, and so
// do steps 3 and 4.
export const MACHINE_PIN_SCROLL_DISTANCE = 8800;

// Phase boundaries as fractions of that distance (tune live — see machineScrollAnimation.ts).
export const MACHINE_PHASES = {
  wordIn: 0.016,
  plateIn: 0.074,
  plateFull: 0.115,
  wordOut: 0.115,
  zoomStart: 0.115, // the plate starts growing the moment the wordmark starts leaving
  zoomEnd: 0.295, // by here we're through the hatch
  cardAtHole: 0.9, // the card appears once the hatch is this far open (openness, NOT a fraction of
  // the pin — so this one did NOT get rescaled)
  cardEnd: 0.474, // and has been flown all the way to full size by here
} as const;
