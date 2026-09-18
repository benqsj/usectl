# Machine-section scroll animation fix — agreed plan (2026-09-18)

Status: **agreed, not yet implemented.** Nothing in this plan has been applied to the code.

Trigger: the user will say *"ანიმაციები გავასწოროთ"* ("let's fix the animations"). That phrase means
**this document** — the scroll behaviour of the machine screen (steps 3-8), not any other animation
on the page. Read this file first, then work through the steps in the order given at the bottom.

## What the user asked for (their own words, kept verbatim)

> text-4 დან scroll ზე რო იცვლება და გადავდივართ text-5 ზე ცოტა scroll ზე უნდა გავწელოთ ის რომ
> სანამ 5 ზე გადავალთ mechanic იკ გაქრეს და ასევე გაქრეს server.svg ის ქვედა მხარე, რო ლამზად
> გამოვიდეს ახალი ანიმაცია

> ეხლა რა ხდება text5 -> text6 > text7 > text8 უცბად რო ვაკეტებ scroll ს პირიქით ზევით ანუ
> text8 > text7 > text6 > text5 მაგ დროს ანიამციები ძაან უშნვოდება — მინდა რო ანიმაცია როგორც
> შემოდის ისევე ლამზად რო გადიოდეს როცა ზემოთ ვაკეთებთ scroll-ს

> რა ჯობია scroll ზე მომყვებოდეს ოღონდ ცოტა დიდი scroll ის გაკეთება მიწევდეს რო სწრაფად არ
> მიეყაროს უცბად და ანიამციები არ გაფუჭდეს

Three requirements, in short:

1. Stretch the step 4 → step 5 handoff: the "machine" wordmark and the server's bottom half must be
   **gone before** the text swaps to step 5.
2. Scrolling **up** (8 → 7 → 6 → 5) must look as good as scrolling down — the animations should run
   backwards, not restart forwards.
3. Scroll-driven is preferred over self-playing, with enough scroll distance that a fast flick can't
   rush or break it.

## Diagnosis (why reverse scrolling looks broken today)

All line references are `src/animations/machineScrollAnimation.ts` unless stated otherwise.

1. **Two owners for one property.** `machineWord` and `serverBottom` get their `opacity` written both
   by a boundary-triggered tween (`gsap.to(..., {opacity: 0, duration: 1.2})` in the step-swap block)
   and by the per-frame block (`if (p2 < 1) gsap.set(..., {opacity: 1})`). Scrolling back from step 5
   to step 4 snaps them to full opacity while that 1.2s fade is still running — they fight, and it
   flickers. There is no reverse animation at all on the way back in.
2. **The diagrams are triggered timelines, which cannot reverse.** `playDiagram` builds a fresh
   forward timeline on entering a step; leaving fades the wrapper out (`DIAGRAM_OUT_DURATION`) and
   resets. Scrolling up therefore plays the previous diagram *forwards*, which reads backwards. A
   fast reverse crosses three boundaries in a few frames: timelines are created and killed mid-flight
   and the fades overlap.
3. **No breathing room between steps 4 and 5.** The exit is time-based and fires exactly on the
   boundary, so it overlaps the text swap AND the step-5 diagram starting to assemble.
4. **`scrub: true`** tracks scroll 1:1 with no smoothing, so one flick can jump several steps within
   a single frame.
5. **Text swap is fragile on multi-step jumps.** `createStepSwap.animateToStep` (`src/animations/
   stepSwap.ts`) only kills tweens on the from/to pair's words, so crossing three boundaries quickly
   can leave an intermediate step's words stranded half-faded.

## The plan

### 1. Everything scroll-driven, one owner per property
Convert the diagram reveal back to a pure function of pin progress (this code existed before — see
git history for the `DIAGRAM_REVEAL_END` / `DIAGRAM_ITEM_WINDOW` / `DIAGRAM_CONTENT_LAG` version, and
keep its smooth timing: long per-piece windows, heavy overlap, `power1.inOut`). A scrubbed reveal
un-assembles itself piece by piece on the way back with no extra code — that IS requirement 2.

Rule to enforce while doing it: **any one property of any one element is written in exactly one
place**, the per-frame function. No `gsap.to` in the step-boundary block except the text swap.

Note for the user: this removes the "scroll only starts it, then it plays on its own" behaviour they
asked for earlier. That trade is the price of correct reversal, and they have accepted it.

### 2. A real exit window on step 4, a beat of delay on step 5
Split step 4's own local progress (`p2`) into: icons fade out → "machine" ramps in → hold → **exit
(last ~30%: "machine" + server bottom fade and drift away, scrubbed)**. Start step 5's diagram
reveal ~10% into its own step so the two never overlap. Scrubbing the exit also means scrolling back
fades them in again in reverse instead of snapping.

### 3. Smooth the scrub
`scrub: true` → `scrub: 0.8` on the machine ScrollTrigger. A fast flick becomes a glide through the
steps instead of a teleport. Single highest-leverage line in the whole plan.

### 4. More scroll for the step range
Current: pin 8800px, `cardEnd` 0.474, weights `[5, 2, 4, 4, 4, 4]` (23 units, ~201px per unit) —
step 4 is the SHORTEST (~400px) and it is the one that now needs an exit window.

Proposed: weights `[5, 4, 5, 5, 5, 5]` (29 units), `MACHINE_PIN_SCROLL_DISTANCE` 8800 → **10000**,
and every fraction in `MACHINE_PHASES` multiplied by 8800/10000 = 0.88 so the wordmark, the plate,
the flight through the hatch and the card's approach keep their exact pixel lengths (the same rule
every previous bump in `src/lib/machineLayout.ts` followed). Cost: this section gets ~1.2 screens
taller.

### 5. Harden the text swap
In `stepSwap.ts`'s `animateToStep`, kill tweens on ALL words and force every non-active step's words
to hidden, so a three-step jump can't strand a half-faded copy.

### 6. Card outline on/off
The border fade for steps 6-8 (`BORDERLESS_FROM_STEP`) is also a boundary-triggered tween. Derive it
from progress with a short window, for the same one-owner reason.

### 7. Verify
- Slow scroll through 4 → 5: wordmark and server bottom are fully gone before the text changes.
- Hard flick from 8 back to 5: no flicker, no doubled text, diagrams **dis**-assemble rather than
  re-assemble.
- `npx tsc --noEmit` and `npx eslint` on the touched files.

## Order of work

3 → 1 → 2 → 4 → 5 → 6 → 7. Do the `scrub` line and the return to scrubbed diagrams first: on their
own they already fix most of the reverse-scroll ugliness, and everything after that is tuning.

## Files involved

- `src/animations/machineScrollAnimation.ts` — the bulk of it
- `src/lib/machineLayout.ts` — pin distance + phase fractions
- `src/animations/stepSwap.ts` — step 5 of the plan
- `src/components/sections/InfrastructureSectionClient.tsx` — only if the diagram wrappers need
  different markup for the scrubbed version
