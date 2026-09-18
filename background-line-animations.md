# Background grid — mouse deformation effect (plan)

Status: **agreed, not started.** No code has been written for this yet.

## The prompt to start this work

```
background-line-animations.md-ის მიხედვით ვმუშაობთ — background ბადის მაუსზე
დეფორმაციის ეფექტი. წაიკითხე ფაილი პროექტის root-ში და დაიწყე lab გვერდით
(ეტაპი A), მთავარ გვერდს ნუ შეეხები სანამ ვარიანტი არ ავირჩევთ.
```

## What the designer asked for

> background-line ები, როგორც მიზის, ისე უნდა მეჯდეს დიზაინის მიხედვით — უბრალოდ როცა mouse-ს
> გადავატარებ, პატარა დეფორმაციასავით უნდა აკეთებდეს, თითქოს ხაზები გაიღუნოს და მოგყვებოდეს
> მაუსზე, ეგეთი ეფექტი უნდა იქმნებოდეს

> მინდა რომ რაც დამალულია რამოდენიმე line ები, ეგენი დამალული იყოს

So: the grid stays exactly as designed; on mouse move the lines bend locally around the cursor and
follow it with a little weight. Everything currently hidden must stay hidden.

## Where the grid lives today

`src/components/layout/BackgroundLines.tsx`, geometry from `src/lib/grid.ts`.

- Layer is `fixed inset-0 -z-10 pointer-events-none overflow-hidden`. Fixed on purpose: several
  sections are pinned (hero, infrastructure, machine), so a page-absolute grid would slide behind
  static content and read as a glitch. **Keep it fixed** — it also means the effect never has to
  care about scroll offset.
- Geometry (all from `grid.ts`, single source of truth — the effect must read the same constants):
  `CANVAS_WIDTH_REF = 1920`, `INSET_VW = vw(99)`, `COLUMN_PITCH = vw(82)`, `ROW_PITCH = vw(114)`,
  `HEADER_HEIGHT_PX = 96`.
- Colour `rgba(255,255,255,0.02)`, thickness `2px` (2px on purpose: at fluid vw pitch, 1px lines land
  on fractional device pixels and anti-alias unevenly).
- Vertical columns: 22 of them, 1-indexed, inside a box inset by `INSET_VW` left and right; column
  `n` sits at `INSET_VW + (n-1) * COLUMN_PITCH`. Drawn as a `repeating-linear-gradient` for the main
  area, and as individual divs for the band right below the header.
- Horizontal rows: full viewport width (no inset), from `HEADER_HEIGHT_PX + ROW_PITCH` downwards,
  every `ROW_PITCH`.
- The grain texture (`/background/background-lines.svg`, `opacity-30 mix-blend-multiply`) is a
  separate DOM layer in the same component. **Leave it as a DOM layer** — it is not part of the
  effect.
- The header draws its OWN copy of the column lines as a child of `<header>` (above the header's
  blur/tint). That copy stays CSS and stays undeformed — it sits behind `backdrop-blur-md` where the
  effect would not be visible anyway.

### The hidden lines — HARD REQUIREMENT

These rules exist today and must survive the rewrite exactly:

| Set | Columns (1-indexed) | Where it applies |
| --- | --- | --- |
| `START_COLUMNS` | 2, 3 | under the header logo — **header copy only** |
| `MIDDLE_COLUMNS_WIDE` | 9-14 | under the header nav, at `>= 1800px` |
| `MIDDLE_COLUMNS_NARROW` | 8-15 | under the header nav, below `1800px` |

- Inside the header band: `START ∪ MIDDLE` hidden (that copy lives in `Header.tsx`, untouched).
- In the one row directly below the header (height = `ROW_PITCH`): the MIDDLE set is hidden, the
  start columns are not. This break happens **once**, not down the whole page.
- Everything below that: full unbroken grid.

In a shader this is a cheap lookup — work out the column index for the fragment, and skip drawing
when that index is in the hidden set for the current band and breakpoint. Nothing about the effect
makes this harder; it just has to be ported deliberately rather than forgotten.

## Why a canvas/shader, and not CSS

The grid is `repeating-linear-gradient`. A CSS gradient can only draw straight lines — bending one is
not possible. The same file already documents four failed CSS-mask attempts for a related problem, so
CSS has been taken about as far as it goes here.

Options considered:

1. **WebGL canvas (fragment shader) — chosen.** Draw the grid in a shader and displace the sampling
   coordinate around the cursor. True bending, 60fps, GPU-cheap at this alpha, and line crispness
   becomes something we control in device pixels (which also retires the 1px/2px anti-aliasing
   compromise).
2. SVG paths with JS-moved points. No shader needed, but ~22 columns + ~15 rows at ~30 points each is
   1000+ points per frame — noticeable on weak machines, and it inherits the same anti-aliasing
   problem.
3. CSS "lens" fake — a second copy of the grid masked to a circle and scaled. Very cheap, but it is a
   lens, not a bend. Likely to be rejected by the designer.

## The effect itself

Per fragment, in pixels:

```
d        = fragCoord - mouse
falloff  = exp(-(length(d) / RADIUS)^2)        // smooth gaussian, no hard edge
offset   = normalize(d) * STRENGTH * falloff   // sign flips pull vs push
uv       = fragCoord - offset                  // draw the grid at the displaced coordinate
```

Then the grid at `uv`: distance to the nearest column/row line, `smoothstep` to a 2px-wide (in device
pixels) line, multiplied by the 0.02 alpha.

Parameters to expose in the lab: `RADIUS` (~160-280px), `STRENGTH` (~8-28px), pull vs push, the
follow easing (`lerp` factor ~0.08-0.15, which is what makes it trail the cursor with weight), and an
optional ripple variant (`sin(length(d) * k - t)` under the same falloff).

At rest `falloff -> 0`, so the grid renders identical to today's.

## Plan

### Stage A — lab page first (nothing on the real page changes)
Build `/lab/lines` (a route that never ships in the nav) rendering the real grid from `grid.ts` with
the shader, plus on-screen sliders for every parameter above and a variant switcher: **pull**,
**push**, **ripple**. Designer picks one and the numbers get written down here.

### Stage B — wire the chosen variant in
Replace the two gradient layers in `BackgroundLines.tsx` with the canvas, keeping:
- the grain layer as-is,
- the header band's own hidden-column rules (table above),
- `fixed inset-0 -z-10 pointer-events-none`,
- the exact colour, thickness and pitch.

Mouse position comes from a `window` listener (the layer itself is `pointer-events-none` and must
stay that way). Easing runs in a `requestAnimationFrame` loop that **stops when the eased position
has caught up with the target**, so an idle page costs nothing.

### Stage C — the guards
- `prefers-reduced-motion: reduce` → static grid, no listener, no rAF.
- Coarse pointer (touch) → static grid.
- `document.hidden` → pause the loop.
- No WebGL context → fall back to today's CSS gradients (keep them behind a flag rather than
  deleting the code).
- Resize / DPR change → re-size the canvas; cap DPR at 2 (no gain past that at 2% alpha).

### Stage D — QA
- Side-by-side against `main` with the mouse parked off-screen: the grid must be pixel-identical.
- The hidden columns: check the header band at both breakpoints (`>= 1800px` and below).
- Scroll through every pinned section with the mouse moving — the grid must stay locked to the
  viewport, exactly as the fixed layer does today.
- Check on a mid-range laptop, not just this machine.
- `npx tsc --noEmit`, `npx eslint`.

## Open questions for the designer

1. Pull (lines lean toward the cursor), push (they bulge away), or a ripple? — all three go in the
   lab so this can be answered by looking rather than describing.
2. Whole page, or only certain sections (e.g. hero)?
3. Should the effect be suppressed while a pinned section is animating (the machine fly-through is
   already visually busy), or always on?
