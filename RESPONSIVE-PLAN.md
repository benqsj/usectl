# Responsive — tablet + phone (plan)

Status: **plan only, nothing implemented** (2026-09-29). Follows `responsive-scaling.md`, which covered
1280 → 1920+ and deliberately left "below 1280 is a separate job". This is that job.

## The prompt to start this work

```
RESPONSIVE-PLAN.md-ის მიხედვით ვმუშაობთ — tablet და phone ვერსია.
წაიკითხე ფაილი და დაიწყე ეტაპი 1-ით. desktop (≥1280) ვიზუალი და ანიმაციები არ უნდა შეიცვალოს.
```

## Where we are today (measured, Playwright, 2026-09-29)

- `--s` floors at `0.66667px` (1280/1920), so below 1280 the whole page is still laid out as a
  1280-wide desktop. On a 390px phone the document is **1216px wide** (horizontal scroll), the hero
  copy is cut off at the right edge, and states 4/6 show an empty stage — their artwork sits
  outside the viewport.
- At 820 (iPad portrait) the header nav collides with the logo ("The Machine" wraps onto it); the
  state art (Machine, deploy board, terminal) is clipped at the right edge.
- The scene engine is **wheel-only**. Touch, keyboard and scrollbar reach it only through the
  `onUpdate` fallback quantiser (scroll position → nearest state), so on a phone a swipe scrolls
  natively, and then the page snaps and plays — it feels laggy and wrong.
- Every coordinate in `HeroSectionClient.tsx` (~3650 lines) is a 1920 design px constant at module
  level (`SERVER_STATE1`, `MACHINE`, `BOARD6`, `AGENT7`, …) that is read directly by both the JSX
  and the GSAP timeline. There is no seam where a second layout could plug in.
- Footer: every block is absolutely positioned with `s()` on an 800-tall canvas — it can't reflow.

## Breakpoints

| name | range | reference width | notes |
| --- | --- | --- | --- |
| desktop | ≥ 1280 | 1920 | **unchanged** — current code path, current numbers |
| tablet | 768 – 1279 | 834 (iPad portrait) | portrait + landscape; landscape 1024–1279 needs a check |
| phone | < 768 | 390 | 360 – 430 real range; phone landscape = "short viewport" case |

`--s` becomes breakpoint-aware: `100vw / 834` on tablet, `100vw / 390` on phone (each with its own
floor/ceiling), `100vw / 1920` from 1280 up — so `s(px)` keeps meaning "design px at this
breakpoint's reference". `readScale()` needs no change (it reads the resolved property).

## Open questions (need answers before stage 3)

1. **Are there tablet / phone frames in Figma** (`uv4OBAdNJBr7GbSovRhnkj`)? If not, we design the
   compositions ourselves from the desktop one — say so, and we mock each state first for approval.
2. **Phone scene model** — pick one:
   - **A. Same fullpage engine, touch-driven** (recommended for tablet, possible for phone): the 9
     states stay one pinned stage; a swipe = one state, exactly like a wheel push today. Most
     faithful, reuses every animation; but "you can't scroll freely" is more annoying on a phone.
   - **B. Stacked sections on phone**: states 1–9 become normal sections one under another, native
     scroll, each section's animation plays when it enters the viewport (ScrollTrigger
     `toggleActions`), the cross-state morphs (server glide, condense, board morph) are dropped.
     Simplest, most robust on iOS Safari, but loses the "one object transforms" story.
   - Recommendation: **A on tablet, B on phone**, with the phone sections reusing each state's
     artwork + its own entrance sequence (the per-state `seq6` / `seq7` style timelines already exist).
3. Tablet landscape (1024–1279): tablet layout, or desktop at a lower floor? (desktop floor → 1024
   is the cheaper option if it looks fine; to be checked in stage 1.)

## Stages

### 1. Foundations (no visual change on desktop)
- `globals.css`: breakpoint-aware `--s` (above). Confirm `<meta name="viewport">` is emitted (Next 16
  `viewport` export) and there is no horizontal overflow at 360.
- `100svh` → keep for the stage height, add `ScrollTrigger.config({ ignoreMobileResize: true })` so
  the iOS address bar showing/hiding doesn't trigger refreshes mid-transition.
- `BackgroundLines` / `grid.ts`: column count, pitch and hide-lists per breakpoint (e.g. 10 columns on
  tablet, 5 on phone, inset 24/16).
- Header: logo + burger under 1024, full-screen menu (blur panel, staggered links — same blur-in as
  the hero copy). Header height 64 on phone (`HEADER_HEIGHT_PX` becomes per-breakpoint; the pin
  `start` already reads it through a function).

### 2. Split the scene so a second layout can exist (refactor, desktop pixel-identical)
Prerequisite for everything else, and the riskiest step — do it with the desktop screenshot matrix
before/after (all 9 states + footer at 1920 and 1440, diff must be empty).
- Move every coordinate constant into a `layout` object: `src/lib/heroLayout/desktop.ts` holds the
  current numbers verbatim; `tablet.ts` / `phone.ts` start as copies.
- Split `HeroSectionClient.tsx` by state: `states/State1Hero.tsx` … `State9Cta.tsx` (JSX) and
  `timeline/state1.ts` … (the `tl` segments), plus `engine/fullpage.ts` (goToState, wheel driver,
  restore, dead-zone skip) and `engine/float.ts`. The engine takes `SNAP_TIMES`/`CROSSING_SECONDS` from
  the layout so per-breakpoint timing is possible.
- Wrap the build in `gsap.matchMedia()` with three conditions (desktop / tablet / phone): each
  context builds its own timeline from its layout and is auto-reverted on breakpoint change, which
  also fixes today's "resize across 1280 leaves stale transforms" class of bugs.
- Coordinate with the person working on state 6/7 before this lands — it moves their code.

### 3. Input for touch + keyboard
- `engine/fullpage.ts` gains a pointer/touch driver: `touchstart` → `touchmove` (preventDefault while
  inside the pin, `touch-action: none` on the stage) → a swipe past ~40px or a flick velocity fires
  `goToState(±1)`; the same mid-flight rules as the wheel (turnaround against the flight, redirect
  with the same direction, `hurry` for chains). This replaces the quantiser as the primary path on
  touch devices.
- Keyboard: ↑/↓, PageUp/PageDown, Space/Shift+Space, Home/End → `goToState`. (Also an accessibility
  fix for desktop.)
- Footer on touch: same "page LAST+1" model as the wheel (the pass-55 fix applies).

### 4. Tablet compositions (834 reference, portrait)
Stage canvas becomes ~834 × (viewport − header). General rule: **copy on top, artwork below**, panels
and callouts either under the art or dropped. Per state:
1. Hero — copy full width at top, `new-server.svg` centred below at ~300 wide.
2. Infrastructure Freedom — server centred, the three callouts move to the side with shorter elbows
   (or become a list under the server — decide on the mock).
3. Your Stacks — two-piece stack centred, the numbered mono panel below it.
4. Isolated Spaces — Machine ~560 wide, panel below.
5. Pods — slabs left-of-centre, pod cards stacked right, smaller elbows (`podElbow` endpoints from
   the layout).
6. Continuous Deployment — board + terminal centred, POD/LIVE cards below the board.
7. AI Infrastructure — the widest composition; board + agent + terminal re-arranged vertically,
   connector paths re-derived from the new positions (they are computed today from constants — keep
   them computed, never hand-edited SVG).
8. Pricing — the calculator becomes one column.
9. CTA — centred copy.

### 5. Phone (390 reference) — per the answer to question 2
- If **B**: one section per state, native scroll, the pin removed on phone (the SSR spacer too). Each
  section: copy → artwork (max ~340 wide) → panel/cards as a vertical list. Each section's entrance
  = that state's own "arrive" animation (blur-stagger copy, art rise, lines dash-draw, state-6 typed
  terminal + bubbles, state-7 power-up) played once on enter, reversed on leave-back.
- If **A**: the tablet compositions scaled down further, callouts replaced by lists.

### 6. Animation budget on mobile
- Keep: transforms/opacity, dash-draw, the typed terminal, the power-up.
- Reduce: `filter: blur()` text reveal (costly on low-end Android — blur only the first line or use
  opacity + y), big `blur(40px)` scene lights (swap for pre-blurred radial gradients), the state-6
  particle canvas (lower particle count / DPR cap 2).
- Pause: the float ticker and every `gsap.ticker` loop when the tab is hidden or the state is not on
  screen (some already self-idle — verify all).
- `prefers-reduced-motion`: states shown statically, stacked (same as model B), no pin.

### 7. Footer
Rebuild as a flow layout (flex/grid) instead of absolute `s()` positions: brand + address + badges,
link columns, socials, watermark scaled to width. Desktop keeps the current look (it can keep the
absolute version under `lg:` if matching it pixel-exactly in flow is not worth it).

### 8. QA matrix
- Widths: 360, 390, 430 · 768, 820, 1024 (portrait + landscape) · 1280, 1440, 1920 regression.
- Real devices: iPhone Safari (address bar, rubber-band, `svh`), an Android Chrome mid-range phone,
  an iPad. Playwright `hasTouch` covers layout only — touch feel must be checked on a device.
- Per state: nothing clipped, no horizontal scroll, lines touch their art, reverse restores exactly,
  reload restores the state, zero console errors; `tsc` / `eslint` / `next build` clean.

## Order and rough size

1 → 2 → 3 can ship without any design input and keep desktop unchanged. 4–5 need the answers above
(and Figma frames or approved mocks). 6–7 run alongside 4–5; 8 closes every stage.
