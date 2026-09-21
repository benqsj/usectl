# Pointer trail inside the cross marks (plan)

Status: **plan final 2026-09-21, not started.** Replaces `grid-glow.md`, whose glow is already
implemented in the working tree — this plan is written as a **delta from that code**, not from a
clean slate. Background on the grid itself: `background-line-animations.md`, especially §2 and §10.

Trigger: when the user says *"grid-trail.md-ის მიხედვით ვმუშაობთ"* this document is the task. Read it
top to bottom, then skim `background-line-animations.md` §2/§3/§10. Work in the stage order below
and **stop at every STOP marker**.

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
   behind it, like a pen stroke, which fades away shortly after.

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
  cursor easing — a fast flick then draws a curve rather than a corner.
- Push `{x, y, t}` when the tip has moved more than 0.6px since the last point; cap the buffer at
  ~900 points and drop points older than `trailFadeMs` each frame.
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

Variant: **the trail fades behind the pointer** (not "stays until you leave", and not snapped to the
grid lines).

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
Nothing to wire: hero and the machine screen already use `useGridMarks`. Check:
- hero at the top of the page: the trail draws inside its 4 crosses and never outside them;
- it disappears together with the crosses as the page scrolls (first 260 design px);
- machine screen: only while its crosses are visible;
- dragging the hero's 3D server still works (the layer stays `pointer-events-none`);
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

## 5. Open question for the user (default in brackets)

Should the pen also snap to the grid lines (the demo's third variant, where the stroke runs along
the lines like a circuit trace)? [no — free-hand, as chosen]
