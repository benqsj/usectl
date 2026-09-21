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
//
// Raised a third time, 16000 -> 16334, on 2026-09-20, for a DIFFERENT reason — per explicit
// instruction to touch only the two named spots, not the sequence as a whole:
// 1) step 8 (the last of the six, `STEP_WEIGHTS`'s last entry in machineScrollAnimation.ts) had
//    grown to need noticeably too much scroll — its weight was cut back down (5 -> 2, the same
//    "one ordinary step" baseline `STEP_WEIGHTS`'s own comment already documents), which by itself
//    would have freed up (5-2) * (11824/29) ≈ 1223px. Every OTHER step's absolute px was kept
//    exactly where it was by shrinking the [cardEnd, 1] pool by that same 1223px instead of just
//    reallocating it — so only step 8 got shorter; steps 3-7 didn't quietly get longer to compensate.
// 2) topside.svg's own growth (the [zoomStart, zoomEnd] window — the plate scaling up while its
//    hatch opens) needed to be visibly SLOWER — doubled from ≈1590px to ≈3181px. `CARD_START` (when
//    the steps-3-8 card starts flying in) is derived from this window's width inside
//    machineScrollAnimation.ts (`zoomTimeAtHole`), so widening it pushes CARD_START later
//    automatically — `cardEnd` was pushed later by that exact same amount so the card's OWN
//    approach (`cardEnd - CARD_START`) keeps the scroll distance it already had, rather than
//    getting compressed to make room. wordIn/plateIn/plateFull/wordOut/zoomStart (the wordmark
//    phase, which ends exactly where the plate starts growing) are untouched in absolute px.
export const MACHINE_PIN_SCROLL_DISTANCE = 16334;

// Phase boundaries as fractions of that distance (tune live — see machineScrollAnimation.ts).
// Rescaled 2026-09-20 (see the distance comment above): wordIn/plateIn/plateFull/wordOut/zoomStart
// keep the SAME absolute px they had at 16000 (140.8 / 649.6 / 1009.6 / 1009.6 / 1009.6); zoomEnd
// and cardEnd both moved out to fit the doubled [zoomStart, zoomEnd] window (≈3181px, was ≈1590px)
// while preserving the card-approach's own absolute length (cardEnd - CARD_START ≈ 1609px, same as
// before).
export const MACHINE_PHASES = {
  wordIn: 0.0086,
  plateIn: 0.0398,
  plateFull: 0.0618,
  wordOut: 0.0618,
  zoomStart: 0.0618, // the plate starts growing the moment the wordmark starts leaving
  zoomEnd: 0.2566, // by here we're through the hatch — widened 2026-09-20, plate now grows ~2x slower
  cardAtHole: 0.9, // the card appears once the hatch is this far open (openness, NOT a fraction of
  // the pin — so this one did NOT get rescaled)
  cardEnd: 0.3511, // and has been flown all the way to full size by here
} as const;

// "Skip intro" mode (2026-09-21): the hero now ends by diving into the server's own cap, which does
// the job the wordmark + topside fly-through used to do — so the machine screen can start straight
// at the card flying in from the depth. The pin then only covers [zoomEnd, 1] of the full sequence
// (the card's approach, then steps 3-8 exactly as before); everything before it is skipped.
export const MACHINE_SKIP_INTRO_FROM = MACHINE_PHASES.zoomEnd;
export const MACHINE_SKIP_INTRO_PIN_SCROLL_DISTANCE = Math.round(
  MACHINE_PIN_SCROLL_DISTANCE * (1 - MACHINE_SKIP_INTRO_FROM),
);
