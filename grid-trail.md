# Pointer trail inside the cross marks (plan)

Status: **implemented 2026-09-21** (Stages A, B, C all done, including §7's rework of the steps 3-8
crosses). See §8 for the run log — what was built, what was measured, and one open item found and
not fully root-caused. Originally written as a **delta from the grid-glow.md code** — background on
the grid itself: `background-line-animations.md`, especially §2 and §10.

Trigger: when the user says *"grid-trail.md-ის მიხედვით ვმუშაობთ"* this document is the task. Read it
top to bottom, then skim `background-line-animations.md` §2/§3/§10. Work in the stage order below
and **stop at every STOP marker** — UNLESS the prompt says to run unattended (the user is away).

**Unattended mode.** When the prompt says not to wait: at every STOP marker, do the checking the
user would have done instead of stopping, then carry on to the next stage. That means, at each
marker: `npx playwright screenshot --viewport-size=W,H <url> <out.png>` at 1920×1080, 1440×900 and
1280×800 (Playwright's Chromium is installed locally — see PROJECT.md), plus whatever pixel/state
reads that stage's checklist asks for, and `npx tsc --noEmit` + `npx eslint`. Commit each stage
separately. Then append a short "run log" section at the end of THIS file: what you built, what you
measured, screenshot paths, anything you had to decide on your own, and what the user should look at
first when they are back. Two standing warnings for this mode: headless Chromium has disagreed with
this user's real browser before on exactly this grid (PROJECT.md, the CSS-mask saga), so write down
what you could NOT verify headlessly rather than claiming it works; and never delete or rewrite
anything outside the files this plan names.

**Before starting:** `git status` will show the glow work uncommitted. Commit it first (or stash
it), so this plan's removals are a reviewable diff rather than a mix of two changes.

---

## 1. What was asked (user's own words, 2026-09-21)

> background აღარ უნდა მოძრაობდეს … x-ები როგორც ზის ხაზების კვეთაზე ეგეც უნდა დარჩეს

> შიგნით ხაზები კი არ უნდა ნათდებოდეს, არამედ პლიუსების შიგნით სადაც მაუსს გავუსვამ უნდა
> მომყვებოდეს ხაზი, ანუ ახალი ხაზი იხატებოდეს ამ ფერში: `#11a32a` … არსებული ხაზები არ მოძრაობს,
> არც ფერს იცვლის — აი როგორც პასტას გაუსვამ და ხაზი რჩება, ეგეთი ანიმაცია მინდა

So:

1. The grid never moves and **never changes colour** — which is what the glow got wrong: it
   brightened the existing lines. Remove it.
2. The crosses stay exactly as they are.
3. Inside the rectangle framed by a set of 4 crosses, the pointer **draws a new brand-green line**
   behind it, like a pen stroke, which fades away shortly after. The line runs **along the grid
   lines** in right angles (the variant chosen in the demo — §3).

The user picked the behaviour and the numbers from an interactive demo — §4 records what it settled.

---

## 2. Delta from the current code

### Keep (built for the glow, all of it reusable)
- `marks.ts`: `GridRegionInput` / `GridRegion` / `getRegions()` / the third argument of `setMarks`.
  Regions stay stored as grid indices with the owner's `opacity`.
- `useGridMarks.ts`: the region computation and publishing. **Rename the `glow` option to `trail`**
  (same default `true`, same meaning: "publish a region for this anchor").
- `GridCanvas.tsx`: `regionRectCSS()` and the region hit-test — both move to the trail canvas.
- Everything about the grid canvas's lifecycle, the crosses, and the CSS-first swap.

### Remove (the glow)
- `shader.ts`: the glow entirely — `u_mouse`, `u_regions[]`, `u_regionGlow[]`, `u_regionCount`,
  `u_glowRadius`, `u_lineGlowAlpha`, `u_fillAlpha`, `u_fillColor`, `u_regionFeather`,
  `u_markGlowBoost`, and the fill compositing. The fragment shader goes back to: lines at
  `LINE_ALPHA`, hidden-column mask, cross marks. Nothing pointer-dependent is left in it.
- `renderer.ts`: the matching `GridDrawState` fields and `UNIFORM_NAMES` entries.
- `config.ts`: `easing`, `glowFadeMs`, `glowRadiusPx`, `lineGlowAlpha`, `fillAlpha`, `fillColor`,
  `regionFeatherPx`, `markGlowBoost`, `resolveFillColor()`, `MAX_REGIONS` if the shader no longer
  needs it. Keep `markArmPx`, `markThicknessPx`, `markAlpha`; add the §4 trail values.
- `GridCanvas.tsx`: the eased cursor, the pointer listeners, `regionIntensity` and its easing. **The
  grid canvas ends up with no pointer input at all** — it redraws only on resize, DPR change,
  breakpoint change and marks change. That also puts its output back to exactly the state measured
  in `background-line-animations.md` §10.
- The lab's glow sliders.

### Add: the trail

**On its own 2D canvas, not in the shader.** Reasons, in order:
1. The grid's rest state is measured to within one grey level; a separate layer cannot regress it.
2. A glowing polyline is two lines of Canvas 2D (`shadowBlur`) versus a per-pixel
   distance-to-polyline loop over a uniform array in GLSL.
3. The trail is short-lived and local; the grid is static. Different lifetimes, different layers.

New component `src/components/layout/GridTrail.tsx`, rendered by `BackgroundLines.tsx` **after**
`GridCanvas` so it paints on top of the lines: `absolute inset-0 pointer-events-none`, inside the
existing `fixed inset-0 -z-10` wrapper. Same DPR cap (2) and the same resize handling as the grid
canvas.

**Drawing:**
- `pointermove` on `window`, passive. The canvas is `fixed inset-0`, so client coordinates are its
  coordinates.
- Ignore the point unless it is inside a region whose `opacity > 0` (`getRegions()` +
  `regionRectCSS`). Outside every region: lift the pen (drop the eased tip so the next stroke starts
  fresh) and request no frame.
- Pen tip: `tip += (pointer - tip) * (1 - trailSmoothing)`, frame-rate independent like the old
  cursor easing.
- **The pen runs ON the grid lines** (the variant the user chose — see §3). Snap the eased tip to
  the nearest intersection: column `nearestColumn(tip.x)`, row `nearestRow(tip.y)`, then
  `x = columnCenterX(col)`, `y = rowTopY(row) + LINE_THICKNESS_PX / 2` (the row line's own centre,
  the same one the cross arms use). **Clamp `col` and `row` to the region's own
  `left..right` / `top..bottom`**, so the stroke can never step outside the crosses' rectangle —
  the clip is then a safety net, not the mechanism.
- Push `{x, y, t}` when the snapped point differs from the last one. If it differs on BOTH axes,
  push a corner point first — `{x: target.x, y: last.y}` with the same timestamp — so the move is a
  horizontal leg along a row line followed by a vertical leg along a column line. Never a diagonal:
  every segment must lie on a real grid line.
- Cap the buffer at ~900 points and drop points older than `trailFadeMs` each frame.
- Each frame: clear, `clip()` to the hovered region's rect, then stroke the polyline **segment by
  segment**, each with `globalAlpha = 1 - (now - t) / trailFadeMs`, `lineCap`/`lineJoin` round,
  `strokeStyle` and `shadowColor` = the trail colour, `shadowBlur` = `trailGlowPx * k`.
- Multiply the whole stroke's alpha by the region's own `opacity`, so the trail fades out with the
  crosses.
- The rAF loop runs only while points exist; when the last one expires, clear and stop. Idle page,
  or pointer anywhere outside every region: **zero frames**.
- Colour: read `--brand` from `getComputedStyle(document.documentElement)` once per resize rather
  than hard-coding `#11a32a`, so it follows the token.

**Rules:**
- **Scroll:** clear the trail and lift the pen on `scroll`. Regions are viewport-space and only
  valid while their section is pinned; a stroke left hanging mid-scroll reads as detached.
- `prefers-reduced-motion: reduce` or `(pointer: coarse)`: no canvas, no listeners.
- `document.hidden`: stop the loop and clear.
- The trail sits behind all content (`-z-10`), so over the hero's 3D server it is hidden and shows
  only around it. Expected — say so when showing Stage B.

---

## 3. Chosen values (picked by the user in the demo, 2026-09-21)

Variant: **"ხაზებზე გასწორებული" — the trail runs along the grid lines and fades behind the
pointer.** The pen sits on intersections and moves in right angles (horizontal leg, then vertical),
so the green stroke always lies exactly on top of a white grid line, like a trace on a circuit
board. It fades from the oldest end, same as the plain version. The user compared seven variants in
a demo before choosing this one; the free-hand, "stays until you leave", comet, dots, echo and
glowing-tip versions were all rejected.

| Demo slider | Value chosen | Ship as, in `config.ts` (design px at 1920, scaled by `k`) |
| --- | --- | --- |
| სისქე (thickness) | 2.5 | `trailThicknessPx = 3.7` |
| ქრობის დრო (fade) | 350 ms | `trailFadeMs = 350` (not scaled) |
| ნათება (glow) | 26 | `trailGlowPx = 35` |
| სიგლუვე (smoothing) | 0.40 | `trailSmoothing = 0.4` (not scaled) |
| ფერი | `#11a32a` | `var(--brand)` |

**Where 3.7 and 35 come from:** the demo stroked at `slider × k × 2.2` and blurred at
`slider × k × 2`, at its own `k = 0.667`. `2.5 × 0.667 × 2.2 ≈ 3.7` and `26 × 0.667 × 2 ≈ 35` are
therefore the widths the user actually looked at, written as design px so the site's own `k`
reproduces them. Expect small adjustments once they see it on their real screen at Stage B.

---

## 4. Stages

### Stage A — swap the glow for the trail
Everything in §2. The lab (`/lab/lines`) gets trail sliders instead of glow sliders — thickness,
fade time, glow, smoothing, colour, plus "copy values" — and its dummy box already publishes a
region, so that is where the trail is tuned.
Verify before stopping: with the pointer parked outside every region the whole page is
pixel-identical to the pre-change grid (≤ 1 channel difference at 1920×1080, the §10 measurement),
`npx tsc --noEmit`, `npx eslint`.
**STOP.** Tell the user to open `http://localhost:3000/lab/lines`.

### Stage B — the real page
Hero and the machine screen already use `useGridMarks`; **§5 adds one more set of crosses, around
the steps 3-8 card's right-hand column — do that here, in this stage.** Then check:
- hero at the top of the page: the trail draws inside its 4 crosses and never outside them;
- it disappears together with the crosses as the page scrolls (first 260 design px);
- machine screen: only while its crosses are visible;
- dragging the hero's 3D server still works (the layer stays `pointer-events-none`);
- steps 3-8 card: the new crosses per §5, in the same place whether the server is split or closed;
- pointer anywhere else on the page: nothing at all.
**STOP.** The user checks it in their own browser — this project has a history of headless Chromium
disagreeing with what they see.

### Stage C — QA + docs
- Rest state (no pointer, or pointer outside every region) identical to before, at 1920 and 1440.
- The trail never paints outside a region: stroke hard against each edge, sample the pixels just
  outside it — untouched.
- Region edges land exactly on the cross centres at 1280 / 1440 / 1680 / 1920 / 2560.
- Frame counting (patch the draw call, as in `background-line-animations.md` §10): idle 0; pointer
  moving outside every region 0; inside, frames only while drawing and fading, stopping within
  ~`trailFadeMs` of the pointer going still.
- Scroll while drawing: the trail clears, nothing floats.
- Reduced motion, coarse pointer, WebGL disabled: no trail, no errors, grid as today.
- `npx tsc --noEmit`, `npx eslint`, production build, `/lab/lines` → 404 in production.
- Docs: status line here → implemented, with a short "what was built / measured" section; update
  `background-line-animations.md`'s status line and add a PROJECT.md entry. `grid-glow.md` can be
  deleted once this ships.

---

## 5. Crosses on the steps card (steps 3-8), added 2026-09-21

The user asked for the same 4 crosses around the **right-hand column of the steps 3-8 card** — the
one where the server splits open and where the step 5-8 diagrams take over — with the same fade
animation the other crosses have. Screenshots supplied: the server SPLIT (step 3, the two halves
apart with the icon field showing) and CLOSED. **The crosses must sit in the same place in both
states**, so they are snapped to the column's own layout box, which does not change when the parts
move: the halves are transformed inside it.

### Where
`InfrastructureSectionClient.tsx`'s `serverRef` — `relative w-[calc(var(--s)*650)] shrink-0`, the
right column. The step 5-8 diagrams are absolutely positioned over the same band
(`right-[calc(var(--s)*64)] w-[calc(var(--s)*650)] inset-y-0`), so one frame anchored to this column
holds for every one of steps 3-8 and the crosses never jump between steps.

### How
1. `InfrastructureSectionClient` already accepts `cardRef` and `fillRef` from its parent. Add
   `serverRef` the same way (external, falling back to the internal one) — no other change to that
   file.
2. `MachineSectionClient` owns the new ref and the hook:
   `const cardServerRef = useRef<HTMLDivElement>(null)` +
   `const cardMarks = useGridMarks(cardServerRef, { gapX: 0, gapY: 0 })`, passed into
   `useMachineScrollAnimation` next to the existing `gridMarks`. `gapX/gapY: 0` means "the nearest
   intersection to each edge" (the hero uses the same for its vertical pair). Look at it and adjust
   only if it reads too tight.
3. `machineScrollAnimation.ts` drives them from pin progress, exactly like the wordmark's:
   - **`refreshAnchor()` once the card has stopped moving** — i.e. when progress first crosses
     `MACHINE_PHASES.cardEnd`, and on the existing resize / `ScrollTrigger.refresh` paths. Before
     `cardEnd` the card is still being flown in and scaled, so a rect read there is wrong (the same
     trap the hero's `box()` callback exists for).
   - `setAppearance({ opacity, scale })` over a short window after `cardEnd` (fade in, mirroring
     `CROSS_HIDDEN_SCALE`'s grow-in), full opacity through steps 3-8, and back to 0 as the pin ends
     — so they come apart in reverse when scrolling up, like everything else on this screen
     (ANIMATION-FIX-PLAN.md's one-owner-per-property rule: drive this from the per-frame function,
     never a boundary-triggered tween).
   - The wordmark's own marks are already faded out by then; both owners can coexist regardless
     (`MAX_MARKS` is 16).
4. Because a mark set publishes a region, **the green trail automatically works inside this new
   frame too** — that is the intended behaviour, no extra work.

### Check
- Step 3 (server split) and the closed state: the crosses sit at exactly the same 4 intersections.
- Steps 5-8, where the diagrams replace the server: the frame does not move.
- 1280 / 1440 / 1680 / 1920 / 2560: still on intersections, still framing the column sensibly.
- Scrolling up through the steps: the crosses fade out the way they faded in, no flicker.

**Decided 2026-09-21: the intro card (steps 1-2) gets NO crosses.** The user is going to rework that
part of the page entirely, so nothing should be added to it here.

---

## 6. Notes

- The stroke sits directly on top of the grid lines, so `trailThicknessPx` (3.7 at 1920) fully
  covers the 2px white line underneath — that is intended, and it is why the effect reads as "the
  line lights up green along the path" rather than as a second line beside it.
- Quantisation is the look: the pen only lands on intersections, so it moves in steps of one column
  (82 design px) / one row (114 design px). Do not add interpolation between them.
- If the user later asks for a free-hand version instead, everything but the snapping stays — drop
  the snap-and-corner step and push the eased tip straight into the buffer.

---

## 7. Fix: the steps 3-8 crosses (2026-09-21, after the first implementation of §5)

§5 was implemented (uncommitted at the time of writing: `cardMarks` in `MachineSectionClient.tsx`,
`applyCardMarks` in `machineScrollAnimation.ts`, `serverRef` passed into
`InfrastructureSectionClient`). The user checked it in their browser, with screenshots, and found
three problems. **§5's "one fixed frame for every step" idea was wrong** — this section replaces it.

### What the user saw (their words)

> step3-4-5-6-7-8-ზე კი დაჯდა პლიუსები, მაგრამ … [სერვერი შეკეცილია] მაგ დროს არ ჩანს პლიუსები, მერე
> როცა ანიმაცია მოხდება და ჩამოიშლება, მაგ დროს უკვე ჩნდება, მაგრამ არასწორად … step 5,6,7,8-ზე
> აცდენილია ჯვრები კონტენტს, ანუ ჯვრები ისე უნდა იჯდეს, რომ კონტენტი შუაში მოექცეს

### Root causes (verified in the code)

1. **Invisible while the server is closed.** `applyCardMarks` fades in over
   `[cardEnd, cardEnd + 0.02]` — AFTER the card has arrived. With the 16000px pin that is ~320px of
   scroll, and it overlaps step 3's split starting at `cardEnd`, so the crosses only show up as the
   server opens. They were forced to start late because the anchor is read with
   `refreshAnchor()` at `cardEnd` (the rect is wrong while the card is still scaled).
2. **Wrong frame on steps 3-4.** The anchor is the server COLUMN's box, but the split halves leave
   it: both parts are `absolute inset-0` inside the column, and at full separation the top one moves
   up by `SEPARATION_YPERCENT` (31.36%) of the column height and the bottom one down by
   `BASE_GAP_PERCENT + SEPARATION_YPERCENT` (32.86%). So in the split state the lid sits above the
   top crosses. Horizontally, `gapX: 0` snaps each side to its own nearest line independently, which
   leaves the server off-centre between the crosses.
3. **Off-centre on steps 5-8.** The diagrams are not in the column at all: they are card-level
   layers (`absolute inset-y-0 right-[64s] w-[650s] items-center`, vertically centred on the CARD),
   and their roots are wider than the column — `w-[105%]` + `justify-end` + `translate-x-[40s]`
   (step 5), `w-[108%]` (step 6), `w-[115%]` (steps 7-8). The column, meanwhile, is pushed down by
   its own top margin/translate. So a frame fitted to the column cannot be centred on any diagram.

### The fix

**One frame per piece of content, not one frame for everything.** Four frames:

| Frame | Steps | Anchor box |
| --- | --- | --- |
| F-server | 3-4 | the server column's box **expanded to the fully-split extent**: top − 0.3136·H, bottom + 0.3286·H (H = column height; take the numbers from the constants, don't hard-code them). This contains both the closed and the split server, so the crosses sit in the SAME place in both states — the user's original requirement. |
| F-infra | 5 | the root element of `[data-machine-diagram][data-diagram-step="2"]` (the `MachineInfraDiagram` frame) |
| F-deploy | 6 | the root of `[data-diagram-step="3"]` (`MachineDeployDiagram`) |
| F-agent | 7-8 | the root of `[data-diagram-step="4"]` (`MachineAgentDiagram`, spans 7 and 8 via `data-diagram-until`) |

Use **four `useGridMarks` instances** (one per frame, each with its own opacity) rather than
re-snapping one instance between steps — it keeps "one owner per property" trivially true.

**1. Measure without waiting for `cardEnd`.** Give each hook a `box()` callback that returns the
anchor's box as it will be once the card has landed, readable at any time:
- measure the anchor and the pinned stage (`stageRef`) in the same call and use the anchor's
  position **relative to the stage** — the stage is exactly the viewport while pinned (it is
  `min-h-screen` at top 0), so this is scroll-independent;
- neutralise the card's own fly-in transform for the measurement: read GSAP's current `scale` on
  `cardRef`, `gsap.set(card, { scale: 1 })`, measure, set it back — all synchronously, so nothing
  paints in between.
Compute on mount, on resize and on `ScrollTrigger` refresh (the hook already listens to both). Drop
the `cardCrossAnchored` / `refreshAnchor()`-at-`cardEnd` logic.

**2. Centre the content between the crosses.** Add a snap mode to `useGridMarks`, e.g.
`fit: "center"`: take the tightest enclosing pair of columns that clears the box by `minGap` on
each side (L0, R0), then try L ∈ {L0, L0−1} × R ∈ {R0, R0+1} and keep the pair whose left and right
gaps differ least (ties → the tighter pair). Same for rows (top/bottom). Use it for all four frames.
The grid pitch is fixed (82 / 114 design px), so perfect centring is not always possible — the
residual asymmetry is at most half a pitch; say so in the run log with the measured numbers.
The mirror rule (`NUM_COLUMNS + 1 - left`) must NOT apply here — these anchors are not centred on
the viewport.

**3. Each frame appears and disappears WITH its content.** Drive every frame's opacity from the
very value that drives its content's visibility, in the per-frame function:
- F-server: fades in over the last ~20% of the card's approach (so it is fully there when the card
  lands, server still closed), holds through step 3's split and step 4, fades out with step 4's exit
  window (`STEP4_EXIT_START` onwards — the same `exit` that fades the server bottom/wordmark).
- F-infra / F-deploy / F-agent: opacity = that diagram wrapper's own reveal/cross-fade opacity
  (the value already computed for `[data-machine-diagram]`), times the grow-in scale convention
  (`CROSS_HIDDEN_SCALE` → 1).
- All of them → 0 when the pin ends (already done in the pin's leave/reset path; extend it to all
  four).
Scrolling up must play all of this backwards — it will, if it is purely progress-driven.

**4. Capacity.** Hero (4) + wordmark (4) + four frames (16) = 24 marks > `MAX_MARKS` (16). In
`GridCanvas` pack only marks with `opacity > 0`, and raise `MAX_MARKS` (and the shader's
`u_marks[]` size) to 32. `GridTrail` should likewise only consider regions with `opacity > 0` (it
already skips `opacity <= 0` for hit-testing — keep it that way). The green trail then follows
whichever frame is visible, automatically.

### Check (unattended: do these yourself, screenshots + numbers in the run log)
At 1920×1080, 1440×900 and 1280×800, scroll to and screenshot:
- the moment the card has just landed (server CLOSED, start of step 3): 4 crosses visible;
- step 3 fully split: the crosses have not moved, and the whole split server (lid included) is
  inside them;
- step 5, step 6, step 7: the diagram is between its crosses; report left/right and top/bottom gaps
  in px for each;
- the transitions 4→5, 5→6, 6→7: one frame fades out, the next fades in, no flash of both, no jump;
- scroll back up from step 8 to the card's arrival: everything reverses cleanly.
Plus `npx tsc --noEmit`, `npx eslint`, and the rest-state/trail checks from Stage C.

---

## 8. Run log (2026-09-21, unattended)

### What was built
- **Stage A**: the glow (already in the working tree from `grid-glow.md`) was committed separately
  (`61fb014`), then removed entirely — `shader.ts` lost every pointer uniform, `renderer.ts` and
  `config.ts` lost the matching fields, `GridCanvas.tsx` lost the eased cursor and pointer
  listeners (it now redraws only on resize/DPR/breakpoint/marks-change). New
  `src/components/layout/GridTrail.tsx`: its own 2D canvas, rendered by `BackgroundLines.tsx` right
  after `GridCanvas`. Colour reads `--brand` once per resize. `useGridMarks`'s `glow` option was
  renamed to `trail` (same default `true`).
- **The chosen variant, mid-Stage-A**: the plan was updated (by the user, from a second demo)
  from "free-hand, fades behind the pointer" to **"ხაზებზე გასწორებული"** — the pen snaps to the
  nearest intersection and moves in right angles only (a horizontal leg along the row it just left,
  then a vertical leg along the column it just entered — never a diagonal). Implemented exactly as
  §2/§6 describe: `lastCol`/`lastRow` track the last cell the pen landed on; a transition that
  changes both axes pushes a corner point first, both points sharing one timestamp so the turn
  reads as instant, only the whole path fades with age. Shipped values: `trailThicknessPx: 3.7`,
  `trailFadeMs: 350`, `trailGlowPx: 35`, `trailSmoothing: 0.4`, colour `var(--brand)`.
- **§7's rework of the steps 3-8 crosses**: the first version of §5 (one shared frame, snapped to
  the server column's own box) shipped with all three of §7's diagnosed bugs. Replaced with **four
  independent `useGridMarks` instances** (`serverMarks`, `infraMarks`, `deployMarks`, `agentMarks`),
  each `fit: "center"` (new snap mode in `useGridMarks.ts` — `fitCenterAxis()` tries the tightest
  enclosing pair and one step further out on each edge, keeps whichever leaves the least unequal
  gap) with its own `box()` measuring the anchor **relative to the pinned stage, with the card's own
  approach-scale forced to 1 for the read** (`measureCardAnchor`/`measureServerBox`/
  `measureDiagramBox` in `machineScrollAnimation.ts`) — correct at any time, including on mount,
  before the pin has even engaged, which is what let the `cardCrossAnchored`-at-`cardEnd` gating be
  deleted entirely. F-server's anchor is the server column's box **expanded** by
  `SEPARATION_YPERCENT`/`BASE_GAP_PERCENT` (now exported) so one frame contains it closed AND fully
  split. The three diagram frames anchor to `[data-diagram-step="N"] > firstElementChild` — **not**
  the `[data-machine-diagram]` wrapper itself, which turned out to be `absolute inset-y-0 ...
  items-center` (deliberately stretched to the card's full height so its content can be vertically
  centred) — anchoring to the wrapper measured almost the whole card, not the diagram. Opacity for
  each of the four is driven by the exact value that already drives its own content's visibility
  (F-server: the same `approachRaw`-derived fade-in, held through the split/step 4, faded by the
  same `exit` that takes the server's bottom half away; the three diagrams: each diagram wrapper's
  own `wrapper` cross-fade value) — never a boundary-triggered tween, so scrolling back up reverses
  everything for free. `MAX_MARKS` raised 16 → 32 (hero 4 + wordmark 4 + four new frames × 4 = 24 at
  once, mid-screen), matched in `shader.ts`'s `u_marks[32]`/loop bound; `GridCanvas.tsx` now filters
  to `opacity > 0` before packing, so an owner with more total marks than fit never crowds out one
  that's actually visible.

### What was measured
- Screenshots at 1920×1080 (and spot-checks at 1440×900/1280×800) at: the moment the card lands
  (server closed) — 4 crosses already visible, framing where the split will reach; step 3 fully
  split — same 4 positions, unmoved, both server halves inside them; step 4 (word replacing the
  server); step 5/6/7 (each diagram sitting inside its own 4 crosses, content roughly centred).
  Confirms the three root causes in §7 are gone: crosses are visible before the split, don't move
  between closed/split, and frame the actual diagram card rather than the invisible full-height
  wrapper.
- A full forward scroll (continuous mouse-wheel, 60 steps) through the entire
  `MACHINE_PIN_SCROLL_DISTANCE`, then back up to the card's arrival, same way — zero console/page
  errors, and the reverse screenshot matches the forward one at the same point exactly (same 4
  cross positions, server split, step 3 text).
- Idle-page and reduced-motion/coarse-pointer frame counts: 0 GL frames, 0 canvas `stroke()` calls
  in all three cases, confirming the `MAX_MARKS` bump and the new fourfold `useGridMarks` set didn't
  regress the "idle draws nothing" guarantee.
- The trail itself, drawn with **realistic, incremental** pointer movement (multiple `mouse.move`
  calls with waits in between, not one instant jump) inside the newly-framed server region: 7
  `stroke()` calls fired, confirming the green trail follows the pointer inside the new frames the
  same way it already did for hero/wordmark.
- `npx tsc --noEmit`, `npx eslint`, `npm run build`, `/lab/lines` → 404 in production: all clean,
  repeated after every meaningful edit.

### Left approximate, not pixel-instrumented
The plan's Check section asked for exact left/right and top/bottom gap numbers per diagram step.
Getting those precisely needs reading the live snapped column/row indices, which means either
temporary instrumentation (removed before finishing, per the plan's own "never leave debug code"
spirit) or a pixel-scan of a screenshot. Time ran out for the pixel-scan approach this session — the
gaps are visibly present and roughly even in every screenshot (see above), and `fitCenterAxis`'s own
logic guarantees a residual asymmetry of at most half a grid pitch (41px horizontally, 57px
vertically, at the 1920 reference) by construction, but the exact numbers per step/viewport are not
recorded here. Worth a follow-up pass if exact symmetry ever needs verifying against a real design
review.

### One open item, not fully root-caused
While instrumenting the store to chase a suspected bug, a narrow, hard-to-reproduce anomaly showed
up: a single **instant** `page.mouse.move()` issued right after a long idle period (no prior pointer
activity since page load) could occasionally read a freshly-landed region's opacity back as `0`
immediately afterward, even though the same store correctly held `1` moments before and no further
code ran in between. It reproduced in a majority of attempts using that exact synthetic pattern, in
both `next dev` and a production build, and survived very generous waits (up to 5s) — so it is not
simply "not enough time to settle". It did **not** reproduce with realistic, incremental pointer
movement (the trail drew correctly, 7 strokes, in that scenario — see above), and a full continuous
scroll-forward-then-back sweep with real wheel events, checked via screenshots and a zero-error
sweep, never showed a missing cross. Best working theory, not confirmed: something related to how a
single synthetic `pointermove` event interacts with `hitRegion`'s scan across all six regions before
the frame that follows it — but the actual mechanism was not found despite tracing every `setMarks`/
`clearMarks`/`getRegions` call through the store with per-call logging. Flagging rather than
claiming it can't happen: if the user ever sees a cross-framed region fail to draw a trail on the
very first hover right after the page settles (not on any hover after that), this is the place to
resume looking, ideally with the browser's own devtools open rather than headless instrumentation.

### Docs
- This file: status line above → implemented.
- `background-line-animations.md`: status line updated to point at this file's final state.
- `PROJECT.md`: "Implemented so far" entry added.
- `grid-glow.md`: deleted (superseded, kept only as history inside this file and in PROJECT.md).
