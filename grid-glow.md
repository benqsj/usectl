# Grid glow inside the cross marks (plan)

Status: **SUPERSEDED 2026-09-21 by `grid-trail.md`.** The glow described here WAS built (it is in the
working tree at the time of writing) and then dropped: after seeing a demo the user asked for a
pen-like TRAIL in `#11a32a` instead of a glow. This file is kept only as the record of where the
region machinery (`GridRegion`, `getRegions()`) came from — `grid-trail.md` reuses it. Do not
implement anything from here.

Original status: Written against commit `3b048fe`, where the grid is
already a WebGL2 canvas with grid-drawn crosses (see `background-line-animations.md` §10 for how
that was built and measured). This file changes what the pointer does; it does not rebuild the grid.

Trigger: when the user says *"grid-glow.md-ის მიხედვით ვმუშაობთ"* this document is the task. Read it
top to bottom first, then `background-line-animations.md` §2, §3 and §10 for context. Work in the
stage order at the bottom and **stop at every STOP marker**.

---

## 1. What was asked (user's own words, 2026-09-21)

> ხაზები როგორც ზის მომწონს … background აღარ უნდა მოძრაობდეს … x-ები როგორც ზის ხაზების კვეთაზე
> ეგეც უნდა დარჩეს, უბრალოდ x-ების შიგნით თუ გავუსვამ მაუსს, უნდა მიყვებოდეს ნათებასავით მაუსს

So:

1. **The lines stop bending.** No deformation anywhere, ever.
2. **Everything else about the grid stays exactly as it is now** — positions, colour, thickness,
   hidden columns, the canvas + CSS-fallback setup, and the "+" crosses on their intersections.
3. **New:** when the pointer is inside the rectangle framed by a set of 4 crosses, a soft **glow
   follows the pointer** there. Outside that rectangle nothing happens.

---

## 2. Keep / remove / add

**Keep, untouched in behaviour:**
- `GridCanvas.tsx` lifecycle: CSS-first swap (`data-grid-canvas="on"`), dynamic import, DPR cap,
  context-loss fallback, visibility pause, resize/DPR/breakpoint handling.
- The shader's line drawing (box-filter coverage, column/row compositing, half-clipped outer
  columns, hidden-column mask) and the rest-state match measured in `background-line-animations.md`
  §10.
- `useGridMarks` snapping, `marks.ts` storing marks as grid indices, and every section's existing
  `setAppearance` fades (hero: fades out over the first 260 design px of scroll; machine: fades in
  mid-pin, out on exit).
- `/lab/lines` as a dev-only page (404 in production).

**Remove (the deformation):**
- Shader: the whole displacement block. `q` becomes `p`. Delete `u_radius`, `u_strength`, `u_sign`,
  `u_variant`, `u_rippleFreq`, `u_rippleSpeed`, `u_time`. Keep the pixel footprint as
  `fwidth(p) * 0.5` — at rest that is exactly what it was, so the lines render identically.
- `config.ts`: remove `variant`, `radius`, `strength`, `rippleFreq`, `rippleSpeed` and the
  `GridEffectVariant` type. `easing` stays (the glow uses it). Rename `activeFadeMs` → `glowFadeMs`.
- `renderer.ts`: the matching fields in `GridDrawState` and `UNIFORM_NAMES`.
- `GridCanvas.tsx`: everything that only existed for the bend (`sign`, `variant`, ripple keep-alive).
- Lab: the pull/push/ripple switcher and the radius/strength/ripple sliders.

**Add (the glow):** §3–§5.

---

## 3. The glow — what it looks like

- **Region.** Each owner of marks (hero, machine screen, the lab's dummy box) defines one
  rectangle: the box spanned by its 4 crosses, measured on the lines themselves —
  `x ∈ [columnCenterX(left), columnCenterX(right)]`, `y ∈ [rowMid(top), rowMid(bottom)]`, where
  `rowMid(j) = rowTopY(j) + LINE_THICKNESS_PX / 2` (the same centre the cross arms use).
- **When.** The glow for a region shows only while the pointer is inside that rectangle AND that
  region's marks are visible. Its strength is `intensity × marksOpacity`, so when a section fades
  its crosses out (hero on scroll, machine on exit), its glow goes with them automatically.
- **Where.** Centred on the eased pointer position (same frame-rate-independent lerp as today,
  `easing` 0.12 by default, so it trails the cursor with a little weight).
- **Shape.** `g = exp(-(dist / R)^2) × intensity × marksOpacity × regionMask`, `R` in design px
  scaled by `k`.
- **Two components**, each with its own alpha so the user can use either or both:
  1. **Lines light up** — inside the glow the grid lines get brighter:
     `lineAlpha_eff = lineAlpha + (lineGlowAlpha - lineAlpha) × g`. Rows and columns still
     composite the way they do now.
  2. **Soft fill** — a radial light under the lines: `fillAlpha × g` in `fillColor`.
  Optionally the region's own 4 crosses brighten a little as the glow gets near them
  (`markGlowBoost`, 0 = off).
- **Clip.** `regionMask` = coverage of the region rectangle with a feather of `regionFeatherPx`.
  Default 0 = hard edge exactly on the lines between the crosses, so the light is framed by the
  crosses and never leaks past them.
- **Compositing** (premultiplied, over the transparent canvas): fill first, lines over it:
  `a = aLine + aFill × (1 - aLine)`, `rgb = 1·aLine + fillColor·aFill × (1 - aLine)`.
- **Layering note.** The canvas is behind all content (`-z-10`), so the glow is hidden wherever
  content covers it — e.g. over the hero's 3D server you only see it around the model, not on it.
  That is expected, not a bug; mention it to the user when showing Stage B.

---

## 4. Parameters (lab defaults → fill "Chosen" after Stage A)

| Param (`config.ts`) | Lab range | Default | Chosen |
| --- | --- | --- | --- |
| `glowRadiusPx` (design px) | 80-400 | 180 | |
| `lineGlowAlpha` (peak line alpha) | 0.02-0.4 | 0.18 | |
| `fillAlpha` (peak fill alpha) | 0-0.15 | 0.04 | |
| `fillColor` | white / brand `#11a32a` (`--brand`) | white | |
| `regionFeatherPx` (design px) | 0-40 | 0 | |
| `markGlowBoost` (extra cross alpha at the glow centre) | 0-0.5 | 0.2 | |
| `easing` (follow lerp @60fps) | 0.04-0.3 | 0.12 | |
| `glowFadeMs` (enter/leave fade) | 100-800 | 300 | |

---

## 5. Implementation

### `marks.ts` — regions next to marks
- An owner now publishes its marks **and** a region: `{ left, right, top, bottom }` (grid indices,
  like marks — so a resize can never move it off the crosses) plus a `glow` flag.
- New `getRegions(): readonly GridRegion[]` → `{ ownerId, left, right, top, bottom, opacity }`,
  rebuilt in the same `rebuild()` as marks, and the same `subscribeMarks` notifies both.

### `useGridMarks.ts`
- New option `glow?: boolean` (default `true`). `refreshAnchor()` already computes the four cells;
  publish the region from them (`left/right` columns, `top/bottom` rows) together with the marks.
- `setAppearance` opacity is the region's opacity too — no new API for sections, so **hero and
  machine get the glow without touching their files**.

### `GridCanvas.tsx`
- Per frame: convert regions to CSS-px rects against the current `metrics` (exactly like marks).
- Keep a per-region `intensity` (0..1) eased toward its target with `glowFadeMs`.
- `pointermove`: store the target position, then hit-test it against the current rects (plain
  arithmetic, no DOM reads). **Only `request()` a frame if the pointer is inside a region or some
  region's intensity is still above 0** — moving the mouse over the rest of the page must draw zero
  frames.
- Pointer leaves the window / window blur → all targets 0.
- The loop stops when the eased position has settled and every intensity has reached its target
  (same rule as today). Idle = zero frames.
- `prefers-reduced-motion` or `(pointer: coarse)`: no glow and no pointer listener (marks are
  already off in reduced motion; touch has no hover).
- Uniforms to the renderer: `u_mouse`, `u_regionCount` (≤ `MAX_REGIONS` = 4),
  `u_regions[4]` (vec4 rect: left, top, right, bottom in CSS px), `u_regionGlow[4]` (float:
  intensity × opacity), plus the §4 parameters (`u_glowRadius` already × k,
  `u_lineGlowAlpha`, `u_fillAlpha`, `u_fillColor` vec3, `u_regionFeather`, `u_markGlowBoost`).

### `shader.ts`
- Delete the displacement; work in `p`.
- Compute `g` = the max over regions of `regionGlow[i] × regionMask_i(p)`, times the gaussian on
  `distance(p, u_mouse)`. Early-out per region with a bounding-box test so pixels outside every
  region pay nothing extra.
- Lines: use `lineAlpha_eff` in place of `u_lineAlpha` for both columns and rows, then composite
  exactly as today.
- Marks: `alpha × (1 + markGlowBoost × g)` clamped, for marks of that region (or simply all marks —
  there is only ever one region under the pointer).
- Fill + final premultiplied output per §3.
- With `g = 0` the output must be bit-for-bit what it is today.

### Lab (`/lab/lines`)
- Replace the deformation controls with the §4 sliders, a white/brand toggle and "copy values".
- The dummy box and its crosses already exist — its region is what demonstrates the glow; keep the
  resize handles so the user can see the glow stay framed by the crosses at any size.
- Keep the red "compare" overlay (rest-state check).

---

## 6. Performance budget (unchanged from before)
- No new dependency; the renderer chunk stays ~3 KB gzipped (it should shrink a little with the
  deformation gone).
- Idle page and mouse moving outside every region: **zero frames**.
- Pointer inside a region: one fullscreen pass per frame while it moves or fades, then stop.

---

## 7. Stages

### Stage 0 — remove the deformation
- Remove everything listed under "Remove" in §2. Keep the glow code out of this commit.
- Verify: rest state vs `3b048fe` at 1920×1080 and 1440×900, pointer moving all over the page —
  the grid must never move, and the painted pixels must match the pre-change canvas (max channel
  diff ≤ 1 at 1920, as measured before). `npx tsc --noEmit`, `npx eslint`.

### Stage A — glow + lab
- `marks.ts` regions, `useGridMarks` `glow` option, `GridCanvas` hit-test + intensities, shader
  glow, lab controls.
- **STOP.** Tell the user to run `npm run dev` and open `http://localhost:3000/lab/lines`, move the
  pointer inside and outside the dummy box's crosses, and pick values. Write them into §4 "Chosen"
  and into `GRID_EFFECT_DEFAULTS`.

### Stage B — real page
- Nothing to wire: hero and machine already use `useGridMarks`, so their regions exist. Check:
  - hero, top of the page: glow inside its 4 crosses, fades away together with the crosses as the
    page scrolls (first 260 design px);
  - machine screen: glow only once its crosses have faded in, gone when they fade out;
  - over the hero's 3D server the glow is hidden by the model, and dragging the model still works;
  - pointer anywhere else on the page: nothing.
- **STOP.** Ask the user to check in their own browser (this project has a history of Chromium
  screenshots disagreeing with the user's real browser).

### Stage C — QA + docs
- Rest state (no pointer / pointer outside regions) identical to before, at 1920 and 1440.
- Glow never outside the rectangle: sample pixels 1px outside each edge of each region while the
  glow is at full strength next to that edge — they must equal the rest state (feather 0).
- Region edges land on the cross centres at 1280 / 1440 / 1680 / 1920 / 2560.
- Frame counting (patch `drawArrays`, as in `background-line-animations.md` §10): idle 0, pointer
  moving outside regions 0, inside: frames only while moving/fading.
- Reduced motion, coarse pointer, WebGL disabled: no glow, no errors, grid as today.
- `npx tsc --noEmit`, `npx eslint`, production build, `/lab/lines` → 404 in production.
- Docs: set this file's status to "implemented" with a short "what was built / measured" section;
  add a PROJECT.md "Implemented so far" entry.

---

## 8. Open questions (defaults in brackets — use them if the user is not around)

1. What lights up: the lines, a soft fill, or both? [both, fill very subtle — decided in the lab]
2. Colour: white or the brand green `#11a32a`? [white — lab has the toggle]
3. Hard edge exactly on the crosses' rectangle, or a soft fade at its edge? [hard edge]
4. Do the 4 crosses brighten when the glow comes near them? [a little, `markGlowBoost` 0.2]
5. Glow on every section that has crosses (hero + machine today)? [yes]
