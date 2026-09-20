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
// of the extra 2800px lands after `cardEnd`, i.e. in the steps: the wordmark, the plate, the flight
// through the hatch and the card's approach still take exactly the scroll they always took, and so
// do steps 3 and 4.
//
// Raised again, 8800 -> 16000, on 2026-09-20: the 6-step text swap (steps 3-8) is TRIGGERED, not
// scrubbed (see stepSwap.ts) — on a fast/hard scroll flick, a new step's fade-in tween could start
// before the previous one's fade-out (0.3-0.95s) had finished, and since each transition only ever
// hides the two steps it knows about, two non-adjacent steps could end up stuck at full opacity at
// once until some unrelated ScrollTrigger.refresh() elsewhere on the page forced a hard, unanimated
// jump back to the right one (reproduced and confirmed via Playwright, in both `next dev` and a
// production build). More scroll per step lowers how often a flick can outrun the fade — it doesn't
// remove the race, just makes it need a faster flick to trigger. Per explicit instruction, this
// extra scroll must land ONLY on the steps, not the entrance zoom (wordmark/plate/hatch/card
// approach) — so the whole `MACHINE_PHASES` block below is rescaled by the SAME ratio (10000/16000)
// as every fraction here, keeping `cardEnd`'s ABSOLUTE px (4176px, `0.4176 * 10000` before, `0.261 *
// 16000` now — identical) unchanged: only the [cardEnd, 1] range — the steps — actually grew, from
// 5824px to 11824px, roughly 2x.
export const MACHINE_PIN_SCROLL_DISTANCE = 16000;

// Phase boundaries as fractions of that distance (tune live — see machineScrollAnimation.ts).
// Rescaled 2026-09-20 (see the distance comment above) to keep every one of these at the SAME
// absolute px it was at 8800: multiply each old fraction by 10000/16000 = 0.625.
export const MACHINE_PHASES = {
  wordIn: 0.0088,
  plateIn: 0.0406,
  plateFull: 0.0631,
  wordOut: 0.0631,
  zoomStart: 0.0631, // the plate starts growing the moment the wordmark starts leaving
  zoomEnd: 0.1625, // by here we're through the hatch
  cardAtHole: 0.9, // the card appears once the hatch is this far open (openness, NOT a fraction of
  // the pin — so this one did NOT get rescaled)
  cardEnd: 0.261, // and has been flown all the way to full size by here (still exactly 4176px)
} as const;
