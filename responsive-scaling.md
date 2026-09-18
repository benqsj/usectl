# Responsive scaling — 1280px to 1920px+ (plan)

Status: **stages 1-4 implemented (2026-09-18), stage 5 (visual QA) outstanding.**

Decisions taken: (1) keep scaling above 1920, no upper clamp; (2) pin scroll distances scale too;
(3) hard floor at 1280, tablet/mobile is a separate job.

Done: `--s` + `@property` in globals.css; `s()` / `vw()` / `readScale()` in lib/grid.ts; every
`min-[1800px]` / `max-[1799px]` SIZE pair collapsed to one scaled value (BackgroundLines keeps its
hidden-column breakpoints — those are a content rule); ~70 `text-[Npx]` / `max-w-[Npx]` / spacing
values scaled across Hero, Build, Infrastructure, Pricing, the static bar and the Footer; the
chamfer; the 3D model wrapper (480px design width) plus the JS that mirrored it — heroScrollAnimation's
core height and HeroServerModel's canvas anchor; the pricing machine diagram's pod geometry; and all
five pin distances, both the ScrollTrigger `end` (function form, re-read on refresh) and the SSR
spacer (CSS `calc`, so it resolves server-side too).

Left: the screenshot matrix and the vertical-fit pass at 1280x800 (stage 5/6 below), and anything
those turn up.

## The prompt to start this work

```
responsive-scaling.md-ის მიხედვით ვმუშაობთ — პროპორციული responsive 1280px-მდე.
წაიკითხე ფაილი პროექტის root-ში და დაიწყე ეტაპი 1-ით (მასშტაბის მექანიზმი),
შემდეგ ეტაპებით თანმიმდევრობით. 1920px-ზე ვიზუალი არ უნდა შეიცვალოს.
```

## What was asked

> ყველაფერი პროპორციულად უნდა დავაპატარავოთ, რომ დიზაინში ლამაზად ჩაჯდეს. მაგალითად 1799px-ის
> ჩათვლით ყველაფერი ფუჭდება, 1280px-მდე მაინც რომ გავაკეთოთ responsive ძალიან კარგი იქნება.
> ტექსტებს დაპატარავება უნდა, მარჯვენა კონტენტები — თუნდაც server.svg — პირიქით ძალიან პატარებია.
> ისე, რომ ახლა რა ზომებიც არის, 1920px-ზე არაფერი არ შეიცვალოს, და ასევე უფრო დიდ ეკრანებზეც.

Target range for this pass: **1280px → 1920px**, proportional. Below 1280 is a separate job (the
layout stacks there and no design exists for it yet).

## Diagnosis — one bug, two symptoms

The design is authored at 1920 (`CANVAS_WIDTH_REF` in `src/lib/grid.ts`). Today the code has **two
unrelated sizing systems** living side by side:

1. **The background grid scales fluidly.** `BackgroundLines.tsx` and `Header.tsx` use `vw()` from
   `grid.ts` (`px / 1920 * 100vw`), so the grid is always proportional to the viewport.
2. **The content does not.** Everything else is fixed px in two hand-tuned tiers: a `min-[1800px]:`
   set (which IS the 1920 design) and a below-1800 set that was eyeballed, not derived.

The below-1800 tier was never worked out proportionally, and the two symptoms in the brief are
exactly what that produces. At a 1600px viewport the correct scale is `1600/1920 = 0.833`:

| thing | today at 1600 | proportional target | error |
| --- | --- | --- | --- |
| infra heading (`text-[136px]`) | 136px | 113px | **+20% too big** |
| server column (`w-[320px]`) | 320px | 542px | **-41% too small** |
| static bar (`max-w-[821px]`) | 821px | 684px | +20% too wide |
| grid pitch (`vw(82)`) | 68px | 68px | correct |

So the text stayed at full size while the visuals were shrunk by roughly half — "ტექსტებს
დაპატარავება უნდა, server.svg პირიქით ძალიან პატარაა", precisely.

And because the grid is proportional while the content is not, **the two drift apart by up to 20%**
below 1920 — anything meant to sit on a grid line (hero corner crosses, section insets) stops
landing on one. That is a large part of "1799px-ის ჩათვლით ყველაფერი ფუჭდება".

## The mechanism: one scale factor for the whole page

Add a single CSS variable in `src/app/globals.css`, declared as a **length**, not a ratio:

```css
:root {
  /* 1px at 1920 and above; shrinks with the viewport; stops shrinking at 1280 (0.6667). */
  --s: max(0.66667px, calc(100vw / 1920));
}
```

Then every design number is written once, as the 1920 value, and multiplied by it:

- inline styles / JS-authored CSS: `` const s = (px: number) => `calc(var(--s) * ${px})` ``
- Tailwind arbitrary values: `text-[calc(var(--s)*136)]`, `w-[calc(var(--s)*650)]`
- `grid.ts`: redefine `vw()` to `calc(var(--s) * n)` so the grid and the content share one factor
  and can never drift again. Every existing `vw()` call site then keeps working unchanged.

Properties of this: at **1920 → `--s` = 1px → every value equals today's `min-[1800px]` value**, so
nothing on the reference width changes. Above 1920 it keeps scaling proportionally, which is what the
grid already does today (see Decision 1). At 1280 everything is exactly ⅔ of the design. In between
it is linear. No breakpoints, no second tier of numbers to maintain.

JS needs the same number for GSAP work; read it from the same source rather than recomputing:

```ts
const scale = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--s"));
```

recomputed on resize, followed by `ScrollTrigger.refresh()`.

## Decisions needed before coding

1. **Above 1920: keep scaling, or freeze?** Recommended: **keep scaling** (`max()` only, no upper
   clamp). It matches what the grid does today, keeps content and grid locked together, and avoids a
   1920-wide layout stranded in the middle of a 2560 screen. Freezing instead means adding
   `min(1px, …)` — one character of difference, decide before starting.
2. **Should pin scroll distances scale too?** `MACHINE_PIN_SCROLL_DISTANCE` (8800), hero (1260),
   build (900), pricing (1600), infrastructure (2000 / 3600). If the content is ⅔ the size at 1280,
   holding the pin for the same 8800px makes the sequence feel slower there. Recommended: scale them
   by the same factor, applied in JS (they are also used for SSR spacer heights, so both sides must
   agree).
3. **Is 1280 the real floor?** Below it the `md:` breakpoints stack the layout and there is no design
   yet. Recommended: hard floor at 1280 for now (the `max()` above), tackle tablet/mobile separately.

## Migration inventory

### Stage 1 — the mechanism (no visual change)
`globals.css` (`--s`), `grid.ts` (`vw()` → clamped, plus a new `s()` helper), and a `useScale()` hook
for the JS side. Verify at 1920: pixel-identical.

### Stage 2 — kill the two-tier breakpoints (8 files)
Every `min-[1800px]:` / `max-[1799px]:` pair collapses into one scaled value, taking the ≥1800 number
as the design truth:

| file | what changes |
| --- | --- |
| `InfrastructureSectionClient.tsx` (8 sites) | card `w-[85%]`/`1722px`; server column `260`/`320`/`650`; `mt-120`/`140`; `translate-y-100`/`115`; stack `--w` `160`/`200`/`400`; the three diagram layers' widths |
| `HeroSectionClient.tsx`, `BuildSectionClient.tsx` | model wrapper `w-[400px]`/`480px`, `--core-height`, `mt-[280px]`, `mt-[35px]` |
| `PricingCalculatorSectionClient.tsx` | card `w-[75%]`/`1500px` + all the pod/line geometry constants (163/107/44/83/151/124) |
| `InfrastructureSection.tsx` | section margins |
| `buildLayout.ts`, `heroScrollAnimation.ts` | `BUILD_MODEL_WIDTH_PX` 180/210 and the closed-height math that mirrors it |
| `BackgroundLines.tsx` | keep `min-[1800px]:hidden` — that one is a **content rule** (which columns hide under the nav), not a size, and must stay a breakpoint |

### Stage 3 — typography (~30 sites)
All `text-[Npx]` → `text-[calc(var(--s)*N)]`, and the `max-w-[Npx]` that control line breaks with
them (`950`, `860`, `900`, `1080`, `1220`, `1300`, `821`). Heaviest file:
`PricingCalculatorSectionClient.tsx` (20 sites), then hero / build / infrastructure headings.

### Stage 4 — JS-side numbers
`pricingLayout.ts`, `heroModel.ts` (`HERO_MODEL_BASE_WIDTH_PX`, `HERO_MODEL_PX_PER_UNIT`),
`heroLayers.ts` (stack gaps 45 / 140), `chamfer.ts` (`CHAMFER_PX` 64 — an unscaled 64px corner cut
looks oversized at 1280), and any GSAP px offsets (`LIFT_ON_CLOSE_PX`, the diagram offsets, the
icon-cluster maths already being fraction-based is fine). Multiply by `scale()` at setup and on
resize.

### Stage 5 — the things that do NOT scale
Worth stating so they do not get swept up: `HEADER_HEIGHT_PX` (96, deliberately fixed), border
widths, the 2px grid line thickness, border radii under ~16px, and the three diagram components
(`MachineInfraDiagram`, `MachineDeployDiagram`, `MachineAgentDiagram`) — those are already internally
proportional (percentages + `cqw`), so they scale for free once their container does.

### Stage 6 — vertical fit
Scaling is horizontal; viewport height is not. Check the full-height sections (`min-h-screen`: hero,
the machine screen) at 1280×800 and 1440×900 — laptop heights, where a ⅔-scaled card in a full-height
screen can leave the composition floating. Adjust with the same factor where needed.

## Verification

Build a screenshot matrix rather than eyeballing: **1280, 1440, 1600, 1799, 1800, 1920, 2560**, one
run per section. Each shot, scaled to a common width, must be visually identical to the 1920 one —
that is the whole definition of "proportional". Two ways to run it:

- locally, `npm run dev` + a small Playwright script over the widths;
- or clone the repo into this session's container (`npm install` works there — the npm registry is
  reachable) and run the same script headless, so the comparison can be automated and repeated.

Then: `npx tsc --noEmit`, `npx eslint`, and a manual scroll through every pinned section at 1280 and
1440 to confirm the pins, the SSR spacers and the diagrams still line up.

## Risks

- **`vw()` changing behaviour above 1920** if Decision 1 goes the "freeze" way — the grid would stop
  growing, which IS a change on large monitors. Decide first.
- **Line breaks move** when font size and `max-w` scale together; headings that fit on two lines at
  1920 must be re-checked at 1280.
- **The 3D model** (`HeroServerModel`) takes a px width and has its own px-per-unit — it must be fed
  the scaled width rather than having a transform applied on top, or the lighting/perspective shifts.
- **Pin spacers**: if Decision 2 scales the pin distances, the SSR spacer and the GSAP end value must
  be derived from the same number, or the pre-hydration page height stops matching (this project has
  already been bitten by exactly that — see the comments in `heroScrollAnimation.ts`).
