# Hero intro animation (implemented 2026-09-21)

Status: implemented. Server values: `HERO_INTRO` in `src/lib/heroModel.ts`; text values:
`HERO_INTRO_TEXT` in the same file. The 3D part lives in `HeroServerModel.tsx` (the `intro` prop —
only the hero passes it, BuildSection's server is untouched); the text reveal in
`HeroSectionClient.tsx` (`Mask` / `MaskWords` / `revealHeroText`), styles in `globals.css`
(`.hero-mask`), and the pre-paint class in `layout.tsx` (`HERO_INTRO_EARLY_SCRIPT`).

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
- The copy (eyebrow, headline, paragraph, buttons) comes in with a word-by-word mask reveal — see
  "Text" below.

## Approved values

| Setting (panel label)                                   | Key      | Value |
|---------------------------------------------------------|----------|-------|
| ანიმაციის სიჩქარე (overall speed)                        | `speed`  | 1.00x |
| ერთი დეტალის ვარდნის დრო (fall time per piece, s)        | `dur`    | 0.62  |
| ინტერვალი დეტალებს შორის (time between piece starts, s)  | `gap`    | 0.4   |
| საიდან ვარდება (start height, world units)               | `height` | 0.3   |
| რხევა ვარდნისას (wobble while falling, degrees)          | `wobble` | 10    |
| დაჯდომისას ჩაჯდომა (landing squash)                      | `squash` | 0.08  |
| ტრიალი ვარდნისას (twist while falling, degrees)          | `twist`  | 0     |

Fixed internals used by the demo: `delay` 0.25 s before the first piece, `fade` 0.3 (fraction of
the fall used to fade a piece in). Contour line: shown (fades in with the base).

```js
{ speed: 1, dur: 0.62, gap: 0.4, height: 0.3, wobble: 10, squash: 0.08, twist: 0, delay: 0.25, fade: 0.3 }
```

Total intro length at these values: about 0.25 + 3 * 0.4 + 0.62 = 2.07 s until the cap lands.

## Text (approved 2026-09-21, demo settings JSON below)

"Mask — სიტყვებით ამოსვლა": every word (plus the logo and each button) slides up out of its own
clipping box; lines in order eyebrow -> headline -> paragraph -> buttons.

| Setting                                         | Key (demo)   | Value |
|-------------------------------------------------|--------------|-------|
| when                                            | `when`       | after (cap landing) |
| delay from that moment (s, negative = earlier)  | `textOffset` | -1.3  |
| one word's animation (s)                        | `textDur`    | 0.8   |
| gap between lines (s)                           | `blockGap`   | 0.14  |
| gap between words (s)                           | `unitGap`    | 0.06  |
| start distance (% of own height, +12px)         | `distance`   | 110   |
| easing                                          | `ease`       | expo = cubic-bezier(.16,1,.3,1) |
| text speed                                      | `textSpeed`  | 1     |

With the server values that puts the first word at 0.77 s after the intro starts and the last
button at 3.17 s (+0.8 s to finish) — verified in a production build.

```json
{"speed":1,"height":0.3,"dur":0.62,"gap":0.4,"wobble":10,"squash":0.08,"twist":0,"delay":0.25,"fade":0.3,"textSpeed":1,"textOffset":-1.3,"textDur":0.8,"blockGap":0.14,"unitGap":0.06,"distance":110,"blur":8,"text":{"when":"after","style":"up","split":"words","order":"top","ease":"expo"},"hideRing":false}
```

## How it behaves on the site

- Plays whenever the page opens fresh at the hero.
- `layout.tsx`'s `HERO_INTRO_EARLY_SCRIPT` (a plain inline `<script>` in `<head>`, so it runs before
  the first paint — a `beforeInteractive` `<Script>` runs too late and let the copy flash) adds
  `html.hero-intro`, which parks the copy below its masks. Skipped for reduced motion and for a
  reload that ScrollChurnGuard restores to a scrolled position, so the copy is simply visible then.
- The model reports whether the intro plays (`onIntro`); if it doesn't (visitor already scrolled
  away, restoring, reduced motion) the class is dropped and the copy shows at once. If the model
  never reports (no WebGL, slow network) the copy is revealed after 4 s anyway; a 10 s failsafe in
  the early script covers the app never hydrating. No JS at all -> no class -> copy visible.
- Scrolling far enough for the hero timeline to start opening the server finishes the 3D intro on
  the spot.
- The CSS glow under the server starts hidden and grows as pieces land.
- Gotcha: three's AnimationMixer only writes a node when the clip value CHANGES, so `setProgress`
  puts each piece back on its clip pose before `mixer.update(0)` — otherwise a repeated
  `setProgress(0)` during the intro read the falling offset back as the rest height.
