# Hero intro animation: approved settings (NOT implemented yet)

Status: approved by the owner on 2026-09-21 and saved for later. Nothing in `src/` uses it yet.
Implement it in `src/components/sections/HeroServerModel.tsx` only when the owner asks.

Live demo with these values as defaults: `public/demo-intro.html`
(open http://localhost:3000/demo-intro.html while `npm run dev` runs).

## What it does

On first load, the server in the hero assembles from falling pieces instead of appearing whole.

- 4 pieces fall, bottom to top: `04_base` -> `03_core` -> `02_core` -> `01_cap` (node names in `server.glb`).
- `05_accent_ring` (the neon outline) does NOT fall. It fades in under the base the moment the base lands.
- Each piece appears (fades in) only when its own fall starts. The next piece starts while the
  previous one is still in the air, so they follow each other down.
- Fall is gravity-like (`off = height * (1 - u*u)`, u = 0..1 over the fall time).
- While falling a piece rocks slightly (wobble) and is perfectly level at the moment it lands.
- On landing it squashes softly DOWN into the stack and settles. Nothing moves up after landing:
  no bounce, no lift.
- Short green light pulse on each landing, strongest on the cap. The CSS glow under the server
  grows as pieces land.
- Rotation is unchanged: the same 24 s idle turn from 45 degrees, running the whole time. Mouse drag
  (sideways spin with throw, up/down tilt) works during and after the intro, same as today.
- Headline, text and buttons fade and rise in together with it.

## Approved values

| Setting (panel label)                                   | Key      | Value |
|---------------------------------------------------------|----------|-------|
| ანიმაციის სიჩქარე (overall speed)                        | `speed`  | 1.00x |
| ერთი დეტალის ვარდნის დრო (fall time per piece, s)        | `dur`    | 0.62  |
| ინტერვალი დეტალებს შორის (time between piece starts, s)  | `gap`    | 0.4   |
| საიდან ვარდება (start height, world units)               | `height` | 0.5   |
| რხევა ვარდნისას (wobble while falling, degrees)          | `wobble` | 10    |
| დაჯდომისას ჩაჯდომა (landing squash)                      | `squash` | 0.08  |
| ტრიალი ვარდნისას (twist while falling, degrees)          | `twist`  | 0     |

Fixed internals used by the demo: `delay` 0.25 s before the first piece, `fade` 0.3 (fraction of
the fall used to fade a piece in). Contour line: shown (fades in with the base).

```js
{ speed: 1, dur: 0.62, gap: 0.4, height: 0.5, wobble: 10, squash: 0.08, twist: 0, delay: 0.25, fade: 0.3 }
```

Total intro length at these values: about 0.25 + 3 * 0.4 + 0.62 = 2.07 s until the cap lands.

## Still to decide when implementing

- Play on every load, or only on the first visit (e.g. a sessionStorage flag)?
- Skip the intro when the page is refreshed while scrolled into the hero's pinned scroll
  timeline, so it never fights `heroScrollAnimation.ts`.
- `prefers-reduced-motion`: show the assembled server immediately (the demo already does this).
