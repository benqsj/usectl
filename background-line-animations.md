# Background grid — mouse deformation + grid-drawn cross marks

Status: **implemented 2026-09-20** (stages 0, A, B, C, D, E all done — see §10 for what was
measured and what is still open). The plan below is kept as written, because every decision in it
still describes the shipped code; §10 records where reality differed.

Trigger: when the user says *"background-line-animations.md-ის მიხედვით ვმუშაობთ"* this document is
the task. Read it top to bottom before touching anything.

---

## 1. What was asked (user's own words)

> background-line ები, როგორც მიზის, ისე უნდა მეჯდეს დიზაინის მიხედვით — უბრალოდ როცა mouse-ს
> გადავატარებ, პატარა დეფორმაციასავით უნდა აკეთებდეს, თითქოს ხაზები გაიღუნოს და მოგყვებოდეს
> მაუსზე, ეგეთი ეფექტი უნდა იქმნებოდეს

> მინდა რომ რაც დამალულია რამოდენიმე line ები, ეგენი დამალული იყოს

> (2026-09-20, about the "+" cross marks) სხვადასხვა ზომაზე აცდენა აქვს … ეხლა svg-ს ვიყენებ და
> რეალურად ხო არ ჯობია რო თვითონ line-ს ქონდეს რამე გაფერადება?

> (2026-09-20) საიტს ხო არ დაამძიმებს?

So, three requirements:

1. **At rest the grid looks exactly like today** — same positions, pitch, colour, thickness, same
   hidden columns. The effect only exists near the cursor.
2. **On mouse move the lines bend locally around the cursor and trail it with a little weight.**
3. **The "+" cross marks become part of the grid itself** (drawn by the same code that draws the
   lines), so they can never sit off a line at any screen size, and they bend with the lines.

And one constraint: **it must not make the site heavier** (see §4).

---

## 2. Current state (verified 2026-09-20)

### The grid
`src/components/layout/BackgroundLines.tsx`, constants in `src/lib/grid.ts`.

- Layer: `pointer-events-none fixed inset-0 -z-10 overflow-hidden`. **Fixed on purpose** (hero,
  infrastructure, machine and build are pinned) — keep it fixed. Because it is fixed, the grid lives
  in **viewport coordinates**, and the effect never has to know about scroll.
- Scale: every design length is `s(px) = calc(var(--s) * px)`; in JS use `readScale()` from
  `grid.ts` (it reads the resolved `--s`, which stops shrinking below 1280px — do NOT compute from
  `innerWidth / 1920` directly).
- Geometry at scale `k = readScale()`, in CSS px:
  - `inset = 99k`, `colPitch = 82k`, `rowPitch = 114k`, `header = 96` (fixed, NOT scaled).
  - 22 columns, 1-indexed; column `n` centre `x = inset + (n-1) * colPitch`. Drawn **centred**:
    it covers `[x-1, x+1]` (2px).
  - Rows: `y_j = 96 + j * rowPitch`, `j >= 1`, full viewport width (no inset). Drawn **from the
    line down**: covers `[y_j, y_j + 2]` — NOT centred (it is the first 2px of each
    `repeating-linear-gradient` period). Keep this exactly, or the rest state shifts by 1px.
  - Colour `rgba(255,255,255,0.02)`.
- Bands (top to bottom):
  - `y < 96` (header band): **this layer draws nothing**. `Header.tsx` draws its own copy of the
    columns above its blur. That copy stays CSS and undeformed — do not touch `Header.tsx`.
  - `96 <= y < 96 + rowPitch` (the one row under the header): columns only, **MIDDLE set hidden**.
    No horizontal line in this band.
  - `y >= 96 + rowPitch`: all 22 columns + all rows.
- Hidden columns (HARD REQUIREMENT, must survive exactly):

  | Set | Columns | Applies |
  | --- | --- | --- |
  | `START_COLUMNS` | 2, 3 | header copy only (Header.tsx) |
  | `MIDDLE_COLUMNS_WIDE` | 9-14 | under-header band, viewport `>= 1800px` |
  | `MIDDLE_COLUMNS_NARROW` | 8-15 | under-header band, viewport `< 1800px` |

  The breakpoint must be evaluated with `matchMedia("(min-width: 1800px)")`, i.e. the same way the
  CSS `min-[1800px]` classes evaluate it — not with `innerWidth`/`clientWidth` arithmetic.
- Grain texture `/background/background-lines.svg` (`opacity-30 mix-blend-multiply`) is a separate
  DOM layer — **leave it exactly as is**, it is not part of this work.

### The cross marks ("+")
`public/herosection/cross.svg`: 32x32, two 1px white lines at 30% opacity, crossing at (16.5, 16.5).

| Where | State today | How it is positioned |
| --- | --- | --- |
| Machine section (`MachineSectionClient.tsx`) | **live**, 4 crosses around the wordmark block, fade+scale in via `crossRefs` in `machineScrollAnimation.ts` (`crossIn`, `CROSS_HIDDEN_SCALE`) | relative to the wordmark box: `-vw(60)` / `-vw(70)` from its corners |
| Hero | **removed 2026-09-17, "temporarily"** — restore code is in PROJECT.md (`GridCross`, cols 6/15, rows 4/7, FullHD only) | was grid-snapped with fixed column/row numbers per breakpoint |
| Infrastructure card | **removed 2026-09-17, "temporarily"** (`CardCross`, restore code in PROJECT.md) | card-corner relative |
| Build section | never added (open TODO) | — |

**Why they drift (root cause):** the grid is vw-fluid and viewport-fixed; the content they sit
around is laid out by a different rule (fixed-px cube per breakpoint, centring by viewport HEIGHT
while pinned, a fixed 96px header). Two coordinate systems only coincide at the one size they were
tuned at. PROJECT.md documents the whole hero saga (grid-snapped → cube-relative → removed). Tuning
offsets can never fix this. The only fix is to make the crosses **be grid intersections**, chosen
fresh for every viewport size.

Note: the comment above `CROSS_H_OFFSET_PX` in `MachineSectionClient.tsx` says grid-snapping was
skipped because "the page-absolute Y depends on how much content sits above it". That reasoning is
out of date: the grid is now `fixed` (viewport space) and the section is pinned (also viewport
space) while the crosses are visible, so snapping IS deterministic there. Update that comment when
the crosses move.

---

## 3. Decisions (already agreed — do not re-litigate)

1. **Rendering: raw WebGL2 + one fragment shader. NOT three.js.** three.js is ~600 KB and is only
   loaded lazily for the hero model; this layer is on every page, always. The whole renderer is a
   fullscreen triangle + one shader + a few uniforms — a few KB of our own code, zero new
   dependencies.
2. **CSS first, canvas second.** The existing CSS gradient layers render on first paint exactly as
   today. The canvas mounts client-side, and only when WebGL2 initialised AND the first frame has
   been drawn does it hide the two CSS gradient layers (e.g. a `data-grid-canvas="on"` attribute on
   the layer that CSS uses to hide them). No flash, no blocked paint, and no WebGL = today's site.
   Keep the CSS layers in the code permanently as the fallback.
3. **At rest the canvas must be visually identical to the CSS grid** (see QA; allow ±1 grey level
   for anti-aliasing differences, nothing more). The shader draws lines with hard edges in device
   pixels using the exact coverage rules in §2 (columns `[x-1,x+1]`, rows `[y,y+2]`).
4. **Crosses are drawn by the shader**, at grid intersections, as short brighter segments of the
   column and the row. They are passed in as uniforms (up to 8 marks). They bend with the lines
   because they are sampled at the same displaced coordinate.
5. **Crosses snap to the nearest intersection** of the anchor's corner (rule in §5). Consequence,
   accepted by the user: the gap between a cross and the cube varies slightly between screen sizes,
   but the cross is ALWAYS exactly on the lines.
6. The header's own column copy, the grain layer and `Header.tsx` are out of scope.

---

## 4. Performance budget (the "won't it make the site heavy?" answer)

- Bundle: no new dependency; renderer + shader should be well under 10 KB minified. Load it with a
  dynamic `import()` from a client component so it is not in the first-paint JS.
- GPU: one fullscreen pass at 2% alpha — trivial. Cap DPR at 2.
- CPU: `pointermove` listener is `{ passive: true }` and only stores the target position. A single
  rAF loop eases toward it and **stops itself** when the eased position is within 0.1px of the
  target and no mark is animating. Idle page = zero frames drawn.
- Redraw also on: resize / DPR change, breakpoint change, a mark's opacity/scale/position change.
- Pause the loop on `document.hidden`.
- Must not trigger layout: never read `getBoundingClientRect` inside the rAF loop; anchor rects are
  read only on resize / ScrollTrigger refresh / pin toggle (§5).

---

## 5. Architecture

### Files

| File | New/changed | Purpose |
| --- | --- | --- |
| `src/lib/grid.ts` | changed | add the hidden-column sets (moved from BackgroundLines.tsx, re-exported so nothing else breaks) and **numeric** helpers: `gridMetrics()` → `{ k, inset, colPitch, rowPitch, header, firstRowY }` in CSS px; `columnCenterX(n)`, `rowTopY(j)`; `nearestColumn(x)`, `nearestRow(y)`. Single source of truth for both CSS and shader. |
| `src/lib/gridEffect/shader.ts` | new | GLSL strings (vertex + fragment). |
| `src/lib/gridEffect/renderer.ts` | new | WebGL2 init, uniforms, resize, draw, dispose. No React. Returns `null` if WebGL2 is unavailable. |
| `src/lib/gridEffect/marks.ts` | new | tiny store for cross marks: `setMarks(ownerId, marks[])`, `clearMarks(ownerId)`, `subscribe()`. A mark = `{ col, row, opacity, scale }` (grid indices, not pixels — so resizes can never un-snap them). |
| `src/lib/gridEffect/useGridMarks.ts` | new | hook for sections: given an anchor ref + options, computes the 4 snapped intersections (on mount, resize, ScrollTrigger refresh) and returns `setAppearance({ opacity, scale })` for the GSAP code to call. |
| `src/components/layout/GridCanvas.tsx` | new | `"use client"`; mounts the canvas inside the BackgroundLines layer, owns listeners + rAF, applies guards (§7), flips `data-grid-canvas="on"`. |
| `src/components/layout/BackgroundLines.tsx` | changed | imports constants from grid.ts; renders `<GridCanvas />`; CSS gradient layers get the hide-when-canvas-on rule. Stays a server component apart from the child. |
| `src/app/lab/lines/page.tsx` (+ client file) | new | the lab (Stage A). |
| `MachineSectionClient.tsx`, `machineScrollAnimation.ts` | changed (Stage C) | crosses move to `useGridMarks`. |

Before writing any Next.js code (route files, client components, metadata), read the relevant guide
in `node_modules/next/dist/docs/` — see AGENTS.md; this Next version differs from training data.

### Shader (per fragment, all maths in CSS px: `p = gl_FragCoord.xy / dpr`, flip y so 0 = top)

```
// 1. displacement
d       = p - mouse                       // mouse = eased position, CSS px
fall    = exp(-pow(length(d) / RADIUS, 2.)) * u_active   // u_active eases 0<->1 on pointer enter/leave
dir     = length(d) > 0.0001 ? normalize(d) : vec2(0)
q       = p - dir * STRENGTH * fall * SIGN  // SIGN = +1 pull, -1 push
// ripple variant: q = p - dir * STRENGTH * fall * sin(length(d) * FREQ - u_time * SPEED)

// 2. grid at q (rules from §2, evaluated at q, not p)
band    = q.y < header ? NONE : q.y < firstRowY ? UNDER_HEADER : MAIN
col     = round((q.x - inset) / colPitch) + 1    // 1..22 only; outside → no column
colHit  = abs(q.x - colX(col)) <= 1.0            // with ~0.5 device-px AA edge
hidden  = band == UNDER_HEADER && inMiddleSet(col, u_wide)
rowHit  = band == MAIN && frac((q.y - header) / rowPitch) * rowPitch in [0, 2)
alpha   = max(colHit && !hidden, rowHit) * 0.02

// 3. marks (loop over u_markCount <= 8)
// mark centre: (colX(col), rowTopY(row) + 1) ; arm = 16 * scale CSS px each side
// arm thickness = ARM_THICKNESS (default 2px so it sits exactly on the 2px line); alpha = 0.3 * opacity
alpha   = max(alpha, markAlpha(q))
out     = vec4(1, 1, 1, alpha)   // premultiplied-alpha blending over a transparent canvas
```

Anti-aliasing: keep line edges crisp — hard edge snapped to device pixels, with at most a half
device-pixel smoothstep only where the displacement is non-zero (bent lines need AA; straight ones
must match the CSS rasterisation).

### Snap rule for crosses (in `useGridMarks`)

Options per section: `gapX`, `gapY` (design px, scaled by `k`), `minGap` (design px, default 24).

1. Read the anchor's **layout** box in viewport space (`getBoundingClientRect` at a moment it is
   untransformed, or offsetWidth/Height + a transform-free rect). Read it only on mount, resize,
   ScrollTrigger refresh, and when its pin becomes active.
2. Top-left target = `(left - gapX, top - gapY)`; `col = nearestColumn(x)`, `row = nearestRow(y)`.
   If that intersection is closer than `minGap` to the box (or inside it), step one column / row
   further outward.
3. Right side = **mirror column** `23 - col` (the grid is symmetric about the viewport centre, so a
   centred anchor gets perfectly symmetric crosses). Bottom side = same rule as top, outward.
4. Hand `{col,row}` pairs to the store. Because marks are stored as grid indices, the renderer
   converts them to pixels with the current metrics every frame — they cannot drift.

Visibility: marks exist in viewport space, so they may only be visible while their section is
**pinned** (i.e. not moving relative to the viewport). Machine: already true — they appear mid-pin.
Hero: pinned from scroll 0 (`start: "top top"`) — fade marks out over the first part of the unpin /
when the pin ends (exact behaviour: decide in the lab with the user).

---

## 6. Parameters — chosen 2026-09-20

Live in `src/lib/gridEffect/config.ts` as `GRID_EFFECT_DEFAULTS`; `BackgroundLines.tsx` ships them
unchanged. `/lab/lines` still edits every one of them live if they need retuning.

| Param | Range in lab | Default | **Chosen** |
| --- | --- | --- | --- |
| Variant | pull / push / ripple | pull | **pull** |
| `RADIUS` | 120-360 px | 220 | **220** |
| `STRENGTH` | 4-40 px | 16 | **16** |
| Follow easing (lerp per frame @60fps, made frame-rate independent) | 0.04-0.25 | 0.12 | **0.12** |
| `u_active` fade | 100-600 ms | 300 | **300 ms** |
| Ripple `FREQ` / `SPEED` | — | 0.05 / 3 | 0.05 / 3 (unused — variant is pull) |
| Cross arm length | 8-24 px | 16 (= cross.svg) | **16** |
| Cross arm thickness | 1 / 2 px | 2 | **2** |
| Cross alpha | 0.1-0.5 | 0.3 (= cross.svg) | **0.3** |
| Machine cross `gapX/gapY` | — | 60 / 70 (today's offsets) | **60 / 70** |
| Hero cross `gapX/gapY` | — | from the old GridCross cols 6/15 rows 4/7 at 1920 | see Stage C.3 |

All lengths are DESIGN px: the renderer multiplies them by `k = readScale()` before they reach the
shader, so the deformation scales with the page the way everything else does.

---

## 7. Guards

- `prefers-reduced-motion: reduce` → canvas still draws (crosses must still be on the lines) but
  with no displacement, no pointer listener, no rAF except for mark fades.
- Coarse pointer (`(pointer: coarse)`) → same as reduced motion.
- `document.hidden` → stop the loop.
- No WebGL2 / context creation fails / `webglcontextlost` → remove canvas, CSS layers stay visible.
  In that case crosses fall back to… nothing (acceptable) — or keep `cross.svg` as a fallback only if
  the user asks.
- Resize / DPR change / breakpoint change → resize canvas (`width = clientWidth * dpr`, DPR ≤ 2),
  recompute metrics, redraw once.
- Viewports narrower than 1280px: `--s` floors at 0.6667, the grid overflows and is clipped. Shader must use
  `readScale()`, never `innerWidth / 1920`.

---

## 8. Stages

*(All done, 2026-09-20 — kept as the record of how it was sequenced. §10 has the results.)*

### Stage 0 — groundwork (no visual change)
- Move hidden-column sets and numeric helpers into `grid.ts`; BackgroundLines + Header import from
  there. `npx tsc --noEmit`, `npx eslint`, screenshot at 1920 and 1440 — identical to before.

### Stage A — lab page `/lab/lines` (main page untouched)
- Route that is **not linked anywhere**, `robots: noindex`, and returns `notFound()` in production
  builds.
- Renders the real grid through `GridCanvas` plus a control panel: every parameter in §6, variant
  switcher (pull / push / ripple), a "compare" toggle that overlays today's CSS grid in red so
  rest-state alignment is visible at a glance, and a resizable dummy box (drag handles) with the 4
  snapped crosses around it — to show the user the crosses staying on intersections at any size.
- Also a "copy values" button that prints the current parameters as a table row.
- **STOP.** Tell the user the URL (`npm run dev` → `http://localhost:3000/lab/lines`) and wait for
  them to pick a variant and values. Write the chosen values into §6 of this file.

### Stage B — wire the grid into the real page
- Mount `GridCanvas` in `BackgroundLines.tsx` with the chosen values. CSS-first swap (§3.2).
- Guards (§7).
- Check the whole page at 1920×1080, 1440×900 and 1280×800: rest state identical, hidden columns
  correct on both sides of 1800px, grid stays locked while scrolling through every pinned section.
- **STOP.** Ask the user to look at it in their own browser (Playwright/Chromium has lied about this
  grid before — see PROJECT.md).

### Stage C — crosses move into the grid
1. Machine section: delete the 4 `<Image src="/herosection/cross.svg">` elements; add
   `useGridMarks(wordmarkBlockRef, { gapX: 60, gapY: 70 })`; in `machineScrollAnimation.ts`
   replace `gsap.set(crosses, { opacity, scale })` with the hook's `setAppearance({ opacity, scale })`
   driven by the same `crossIn` value. Update the stale comment above `CROSS_H_OFFSET_PX`.
2. **STOP.** Show the user at 1280 / 1440 / 1512 / 1680 / 1920 / 2560 widths.
3. Hero: ask the user whether to restore the hero crosses now. If yes, use `useGridMarks` on the
   hero model's wrapper, pick `gapX/gapY` so that at 1920 they land on cols 6/15, rows 4/7 (the old
   approved FullHD look) and let the snap rule handle every other width. Visible at all widths
   (the old "FullHD only" restriction existed only because they drifted).
4. Infrastructure card / Build section crosses: only if the user asks — same hook.

### Stage D — QA
- Rest state: mouse parked off-screen, canvas vs `main` screenshots at 1920×1080 and 1440×900:
  visually identical (±1 grey level).
- Hidden columns: under-header band at 1799px and 1800px exactly.
- Crosses: script that, for widths 1280…2560 in 40px steps, reads each mark's pixel centre and
  asserts it equals a column centre and a row line to within 0.5px.
- Scroll every pinned section with the mouse moving: no drift, no flicker, crosses fade correctly.
- Performance: Chrome Performance panel with an idle page for 10 s → no rAF frames; while moving
  the mouse → steady 60 fps with CPU per frame < 1 ms. Check on a weaker machine than the dev Mac.
- Reduced motion + touch emulation: static grid, crosses still on lines.
- WebGL disabled (`--disable-webgl` or `chrome://flags`) → today's CSS grid, nothing broken.
- `npx tsc --noEmit`, `npx eslint`.

### Stage E — docs
- Fill §6 "Chosen" column, set this file's status to "implemented", add an entry to PROJECT.md
  ("Implemented so far") and update the cross-related open items there.

---

## 9. Open questions — answered

1. Pull, push or ripple? → **pull**, with the §6 defaults.
2. Whole page or only some sections? → whole page.
3. Turn the effect off while the machine fly-through is animating? → no, always on.
4. Hero crosses back? → **yes** (asked 2026-09-20, answered yes).
5. Hero crosses when the hero pin ends? → they go much earlier than that: they fade out over the
   first 260 design px of scroll. See §10.

---

## 10. What was actually built (2026-09-20)

### Files

| File | What |
| --- | --- |
| `src/lib/grid.ts` | now also owns the grid as NUMBERS: `NUM_COLUMNS`, `LINE_THICKNESS_PX`, `LINE_ALPHA`, `WIDE_BREAKPOINT_PX`, `isWideViewport()`, the three hidden-column sets, `gridMetrics()`, `columnCenterX()`, `rowTopY()`, `nearestColumn()`, `nearestRow()`. |
| `src/lib/gridEffect/config.ts` | `GridEffectParams` + `GRID_EFFECT_DEFAULTS` (the §6 values) + `MAX_MARKS` (16). |
| `src/lib/gridEffect/shader.ts` | the GLSL. |
| `src/lib/gridEffect/renderer.ts` | WebGL2 init / uniforms / resize / draw / dispose. No React. `null` if WebGL2 is missing. |
| `src/lib/gridEffect/marks.ts` | the cross-mark store, keyed by owner, marks held as GRID INDICES. |
| `src/lib/gridEffect/useGridMarks.ts` | the snap rule + `refreshAnchor()` / `setAppearance()`. |
| `src/components/layout/GridCanvas.tsx` | canvas, listeners, the rAF loop, the guards, the CSS-first swap. |
| `src/components/layout/BackgroundLines.tsx` | CSS layers split out as `CssGridLines` (reusable, takes a colour); renders `<GridCanvas />`. |
| `src/app/lab/lines/` | the lab (`page.tsx` + `LabLinesClient.tsx`). |
| `HeroSectionClient` / `heroScrollAnimation` / `MachineSectionClient` / `machineScrollAnimation` | crosses moved to `useGridMarks`. |

### Differences from the plan

- **The CSS fallback had a one-pixel hole, and it is fixed.** Tailwind v4 compiles `max-[1799px]:`
  to `@media not (min-width: 1799px)` — strictly *less than* 1799 — so at exactly 1799px neither
  hide-rule matched and every middle column showed. Measured at 1798/1799/1800. The narrow class is
  now `max-[1800px]:hidden`, the exact complement of `min-[1800px]:`, which is also what the canvas
  evaluates. **Anywhere else in this codebase that pairs `min-[Npx]:` with `max-[(N-1)px]:` has the
  same hole** (`Footer.tsx` has two) — not touched here, but worth knowing.
- **Columns and rows composite, they are not `max`ed.** The plan's pseudo-code had
  `alpha = max(col, row) * 0.02`; the CSS draws them as two stacked layers, so every intersection is
  `1-(1-a)(1-a)` = 0.0396, not 0.02. The shader does the same — otherwise every crossing came out
  visibly lighter than today's.
- **The main band's outermost columns are half-clipped, on purpose.** The CSS gradient sits on a box
  inset by `inset` on both sides, so the browser cuts columns 1 and 22 in half. Reproduced in the
  shader; without it those two lines read twice as strong as they do today.
- **Anti-aliasing is a true box filter over `fwidth(q)`**, not a smoothstep — that is what a browser
  does when it rasterises a 2px div at a fractional position, and it is why the rest state matches.
- **`useGridMarks` gaps are signed, and it can take the anchor box from the caller.** `gapX/gapY > 0`
  = outside the box (with the `minGap` push-out), `0` = nearest intersection to that edge, `< 0` =
  inside. The hero supplies its own box because its wrapper is scaled/shifted by the timeline and its
  section is `position: fixed` while pinned, so a live `getBoundingClientRect()` says something
  different at every scroll position (the same trap `measureRecenterY` in `heroScrollAnimation.ts`
  was already fixed for).
- **The hero's marks fade out over the first 260 design px of scroll, not "after the pin".** The plan
  assumed the hero is pinned from scroll 0; it is not — the header is sticky and occupies flow, so
  the pin only starts a header-height in, and the server has already travelled 96px by then. The
  marks are snapped to the model's box as it sits at the top of the page (the landing view, where
  they matter) and are given their own `ScrollTrigger` starting at scroll 0 so they are gone before
  the server has moved far. Measured: brightness 64 → 47 → 30 → 13 → 0 across scrollY 0…260.
- **Marks are off under `prefers-reduced-motion`.** Both sections that use them lose their pin in
  reduced motion, and marks live in viewport space — with no pin the anchor scrolls away and they
  would float on their own. The canvas itself still draws (so this only affects the marks, not §7).

### Measurements

- **Rest state.** Canvas-on vs canvas-off, whole viewport, content hidden: at 1920 the biggest
  channel difference anywhere is **1**. At other widths it reaches 6-7, and the cause was measured
  rather than guessed: the browser snaps a `repeating-linear-gradient`'s tile to whole pixels, so at
  1440 the CSS lines sit ±0.25px off their ideal positions while the shader is within ±0.07px. The
  canvas is the more accurate of the two; the worst disagreement between them is ~0.32px.
- **Hidden columns** match the CSS exactly at 1798 / 1799 / 1800 / 1801, on both sides of the
  breakpoint, read off the painted pixels.
- **Cross snapping**: the machine screen's four marks measured at 33 viewport widths, 1280→2560 in
  40px steps — 132 marks, **worst distance from the exact line 0.227px**. The hero's at 1920 land on
  columns 7/16 and rows 4/8, within 0.011px.
- **Cost**: renderer + shader compile to their own lazily-imported 8.5 KB chunk (~3 KB gzipped); no
  new dependency. An idle page draws **zero** frames (counted by patching `drawArrays`); moving the
  pointer draws while it moves and stops within a few frames of it stopping. Reduced motion and
  coarse pointer draw **zero** frames ever after the first.
- Production build passes, `/lab/lines` returns **404** in production, `/` renders with the canvas
  on and no errors. Full-page scroll sweeps with the pointer moving at 1920/1440/1280 and in
  reduced motion: zero console/page errors. `tsc --noEmit` and `eslint` clean.

### Still open

- Performance was only measured on the dev Mac in headless Chromium. Worth a look on a weaker
  machine, and in a real browser — this project's own history has Chromium screenshots disagreeing
  with what the user sees (PROJECT.md, the grid-mask saga).
- The `pull` displacement has a small cusp exactly under the cursor, inherent to `dir * strength *
  fall` (the direction flips across the centre). Worth a look in a real browser; `RADIUS` /
  `STRENGTH` in `config.ts` are one-line knobs, and `/lab/lines` edits them live.
- The infrastructure card's and the build section's crosses are still not built (they were never
  part of this work) — both are one `useGridMarks` call away now.
- Marks are viewport-space, so a section can only show them while it is standing still in the
  viewport (pinned). That is a real constraint on where they can be used, not a bug.
