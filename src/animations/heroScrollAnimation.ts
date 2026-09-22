import type { RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  HERO_EXPLODE_ON_SCROLL,
  HERO_PIN_SCROLL_DISTANCE,
  HERO_STACK_GAP_CLOSED_PX,
  HERO_STACK_GAP_OPEN_PX,
} from "@/lib/heroLayers";
import { HERO_CORE_HEIGHT_RATIO } from "@/lib/heroModel";
import { HEADER_HEIGHT_PX, readScale } from "@/lib/grid";
import type { GridMarksHandle } from "@/lib/gridEffect/useGridMarks";
import type { HeroDive, HeroServerModelHandle } from "@/components/sections/HeroServerModel";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Wrapper scales up this much once the text has cleared out. Reduced 1.2 -> 1.08 -> 1.04 across
// two rounds of feedback — kept reading as enlarging too much each time.
//
// Raised 1.04 -> 1.35 on 2026-09-21: with the server no longer coming apart on scroll
// (HERO_EXPLODE_ON_SCROLL), rising + growing noticeably is now the hero's whole scroll moment.
// Then 1.35 -> 1.2 the same day: "grows too much — a little smaller".
// HeroSectionClient passes a matching `pixelRatioBoost` to the model so the canvas is drawn at
// this size rather than upscaled (the scale is a CSS transform on the wrapper around it).
export const CUBE_SCALE_TARGET = 1.2;
// How far the text rises as it fades, instead of dissolving in place.
const TEXT_RISE_PX = 60;
// Extra scroll distance (px) the pin holds the section for while the timeline scrubs.
//
// Imported from src/lib/heroLayers.ts (not a local constant) because HeroSectionClient.tsx needs
// this SAME number to server-render a matching placeholder spacer — see the long comment on
// `ssrScrollReserveRef` below for why.
const PIN_SCROLL_DISTANCE = HERO_PIN_SCROLL_DISTANCE;

const TEXT_FADE_DURATION = 1;
// The scale-up/rise starts the INSTANT the text starts fading (fully overlapping the text fade),
// not partway through it — user feedback: "raise it up right when the text starts disappearing."
const SCALE_START = 0;
// Doubled from 1.2 — user asked specifically for the rise+scale moment (only that moment) to need
// more scroll. PIN_SCROLL_DISTANCE was scaled by the same ratio the total timeline grew by, so
// the OTHER phases kept needing exactly the scroll they did before.
const CUBE_SCALE_DURATION = 2.4;
// The layer stack pulls apart (the GLB's explode_sequence). Shortened from an initial 2.8 alongside
// an earlier PIN_SCROLL_DISTANCE cut, then doubled again 1.8 -> 3.6 on 2026-09-20 — per explicit
// instruction to slow down only the server's own disassembly, nothing else. PIN_SCROLL_DISTANCE was
// grown by exactly the added 1.8 units' worth of px (420px, see heroLayers.ts), so the text fade,
// scale/rise and end-hold keep exactly the scroll they already had.
const DISASSEMBLE_DURATION = 3.6;
// Dead time at the END of the timeline, with the server sitting fully open: the pin keeps holding
// for this much more scroll before it releases and InfrastructureSection starts coming up, so the
// finished exploded view gets a beat of its own instead of being pushed off the moment it lands.
// 1.2 units == 280px at the timeline's 233.33px-per-unit. PIN_SCROLL_DISTANCE already includes it
// (4.2 units -> 5.4), which is why every earlier phase still needs the same scroll it always did.
const HOLD_OPEN_DURATION = 1.2;

// Starting point for the closed/open vertical gap between stacked layers. The 3D model does its
// own separation (the GLB's explode_sequence, scrubbed below); --stack-gap is still animated
// because the wrapper's document-flow HEIGHT is derived from it, and keeping that identical is
// what keeps the page's total height — and the SSR reservation above — behaving exactly as before.
const STACK_GAP_CLOSED_PX = HERO_STACK_GAP_CLOSED_PX;
const STACK_GAP_OPEN_PX = HERO_STACK_GAP_OPEN_PX;

// Mirrors HeroSectionClient.tsx's own --core-height values (400*256/372 and 480*256/372) and its
// min-[1800px] breakpoint — needed here so the wrapper's CLOSED height can be computed
// analytically (see measureRecenterY below) instead of read live via offsetHeight, which reflects
// whatever --stack-gap CURRENTLY is, not necessarily the closed one.
// The wrapper is 480px wide at the 1920 reference and scales from there (see globals.css's --s), so
// its closed height is one formula times the live scale — the old pair of fixed heights either side
// of a 1800px breakpoint is gone with the breakpoint itself.
const MODEL_WIDTH_PX = 480;
const coreHeightPx = () => MODEL_WIDTH_PX * HERO_CORE_HEIGHT_RATIO * readScale();

// Extra nudge above true viewport-center — user asked to raise it further after the initial
// centering fix. Applies to both the closed and open positions (baked into recenterY below).
const EXTRA_RISE_PX = 0;

// The corner "+" marks are drawn by the background grid, which lives in VIEWPORT space — so they
// are only truthful while the thing they frame is standing still in the viewport too. The server
// starts moving the instant you scroll (the pin engages one header-height in, and the scale/rise
// tween starts at progress 0), so they are given the landing view and then got out of the way:
// snapped to the model's box at the top of the page, and faded out over the first bit of scroll.
// Measured from scroll 0 rather than from the pin's own start, because the model has already
// travelled a header's worth by the time the pin engages.
const CROSS_FADE_SCROLL_PX = 260;

interface HeroScrollRefs {
  sectionRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  cubeWrapperRef: RefObject<HTMLDivElement | null>;
  // The 3D server. Null until the GLB has parsed; the timeline simply skips it until then.
  modelRef: RefObject<HeroServerModelHandle | null>;
  // Filled in with a resync function once the timeline exists; HeroSectionClient.tsx calls it from
  // HeroServerModel's `onReady` the instant the GLB finishes loading, so the model's very first
  // rendered frame already matches the current scroll position instead of popping from closed.
  modelSyncRef: RefObject<(() => void) | null>;
  // Server-rendered placeholder spacer that pre-reserves PIN_SCROLL_DISTANCE worth of height
  // before any client JS runs — see the long comment where this is collapsed, below.
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
  // The 4 corner "+" marks around the server — drawn by the background grid, not by elements in
  // this section (see lib/gridEffect/useGridMarks.ts). This only drives how visible they are.
  gridMarks: GridMarksHandle;
  // The "03 — isolated spaces" overlay (HeroSectionClient.tsx). Only used while
  // HERO_EXPLODE_ON_SCROLL is off.
  spaceRef?: RefObject<HTMLDivElement | null>;
  // The "02 — your stack" overlay (HeroSectionClient.tsx), which follows "01" in the same pin.
  stackRef?: RefObject<HTMLDivElement | null>;
}

// "03 — isolated spaces" phase (closed-server timeline only), after the rise: the server moves right,
// the copy (InfrastructureSection's step 1, "You came here to build.") comes in on the left, two
// callouts draw out to the server's parts on the right, and two dimmed machines ("other projects ·
// their own machines") slide in beside it. Reference: public/sources/Variant C, section "03 — isolated spaces". It starts 0.4 units before
// the rise/scale ends and the end hold follows: 2.0 + 1.6 + 1.2 = 4.8 units vs. 3.6 before, and
// heroLayers.ts's HERO_PIN_SCROLL_DISTANCE grows by exactly those 1.2 units (280px).
const SPACE_START = 2.0;
const SPACE_PHASE_DURATION = 1.6;
// Share of the viewport width the server moves right so the copy has the left side.
const SPACE_SHIFT_X_VW = 0.1;
// While the copy is up, the layers ease slightly apart: this share of the GLB's explode_sequence
// (0 = closed, 1 = fully exploded). Requested 2026-09-21 — "just a little apart", not the old
// full disassembly (HERO_EXPLODE_ON_SCROLL stays off).
const SPACE_SPREAD = 0.32;

// "02 — your stack" phase, after the "01" hold. Everything happens in place (revised 2026-09-21 — a
// first version scrolled on down to a new screen, and was turned down): the "01" copy, callouts and
// other machines fade out, the "02" copy fades in where "01"'s was, and the server stays exactly where
// and as it is — same size, same spread — only turning into the reference's line drawing and settling
// into the reference's pose. Once it has landed, the five services come in on their own clock (like the
// section's step swaps elsewhere on the page, not scrubbed), wired to the layers. Reference:
// public/sources/Variant C, "02 — your stack". Adds STACK_MOVE + STACK_HOLD = 3 units (700px) to the
// pin — see heroLayers.ts.
export const STACK_MOVE_DURATION = 1.6;
export const STACK_HOLD_DURATION = 1.4;

// The dive, after "02" (replaces the machine screen, 2026-09-21 — "Top dive" in
// public/demo-stack-dive.html): the services and the copy go, the server scans back from the line
// drawing to its rendered self, the star on the cap goes a little darker, the stack closes, the
// server turns a quarter and the view tips over until it looks straight down, then zooms into the
// star until it fills the screen, and the canvas fades out onto the page's own background grid.
// Kept short on purpose ("less scroll than the demo"): DIVE_LEAD + DIVE_MOVE + DIVE_END = 2.75 units
// (~640px).
export const DIVE_LEAD = 0.55;
export const DIVE_MOVE = 2.0;
export const DIVE_END = 0.2;
// How far the zoom goes (the star fills a 1920 screen well before this).
const DIVE_ZOOM = 70;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const span = (m: number, a: number, b: number) => clamp01((m - a) / (b - a));
/** The dive's pose for m 0..1 (the "Top dive" curves from the approved demo). */
function divePose(m: number, starDark: number): HeroDive {
  const turn = inOut(span(m, 0.05, 0.55));
  // the last 15%: the zoomed canvas fades straight to the page behind it (grid and all)
  const fade = inOut(span(m, 0.85, 1));
  return {
    turn: 90 * turn,
    elev: 35 + (89.9 - 35) * turn,
    focus: inOut(span(m, 0.3, 0.75)),
    zoom: Math.exp(Math.log(DIVE_ZOOM) * Math.pow(span(m, 0.4, 1), 4)),
    starDark,
    fade,
    hidden: fade >= 1,
  };
}
// On "02" the server ends up this much smaller than on "01", and this much further right (share of
// the viewport width, on top of SPACE_SHIFT_X_VW). Kept small on purpose — "a touch", per feedback.
const STACK_SCALE_RATIO = 0.9;
const STACK_SHIFT_X_VW = 0.025;
// Share of the move after which the services start coming in.
const STACK_REVEAL_AT = 0.9;
// The services' own reveal, in seconds (plays forward on arrival, backward twice as fast on the way
// back up). Kept quick on purpose — the reference's pace read as far too slow.
const CHIP_STAGGER = 0.14;
const CHIP_IN = 0.4;
const LINES_START = 0.45;
const LINE_STAGGER = 0.1;
const LINE_DRAW = 0.5;
const STACK_LABEL_AT = 1.15;

/** Where the chips sit (share of the viewport below the header), from the reference's 860px artboard. */
const STACK_CHIP_Y = { right: [150 / 860, 204 / 860, 258 / 860], left: [604 / 860, 658 / 860] };

/** Places the "02" chips; the lines are drawn to them live (see trackStackLines). */
function layoutStack(root: HTMLElement) {
  const k = readScale();
  const W = root.offsetWidth;
  const H = window.innerHeight;
  const margin = 85 * k;
  const svg = root.querySelector<SVGSVGElement>("[data-stack-svg]");
  svg?.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const count = { right: 0, left: 0 };
  root.querySelectorAll<HTMLElement>("[data-stack-chip]").forEach((chip) => {
    const side = chip.dataset.side === "left" ? "left" : "right";
    const y = HEADER_HEIGHT_PX + (H - HEADER_HEIGHT_PX) * STACK_CHIP_Y[side][count[side]++];
    chip.style.top = `${y - chip.offsetHeight / 2}px`;
    chip.style.left = side === "left" ? `${margin}px` : `${W - margin - chip.offsetWidth}px`;
  });
}

/**
 * Re-draws each chip's line to its layer's corner. The corners come from the model itself
 * (HeroServerModel.projectAnchors), so the lines stay on the server however it has been scaled or
 * shifted, and at any viewport size.
 */
function trackStackLines(root: HTMLElement, model: HeroServerModelHandle | null) {
  const anchors = model?.projectAnchors();
  if (!anchors) return;
  const box = root.getBoundingClientRect();
  const k = readScale();
  root.querySelectorAll<HTMLElement>("[data-stack-chip]").forEach((chip) => {
    const i = chip.dataset.stackChip;
    const g = root.querySelector<SVGGElement>(`[data-stack-line="${i}"]`);
    const path = g?.querySelector("path");
    const dot = g?.querySelector("circle");
    if (!path || !dot) return;
    const left = chip.dataset.side === "left";
    const a = (left ? anchors.left : anchors.right)[Number(chip.dataset.layer)];
    if (!a) return;
    const ax = a.x - box.left;
    const ay = a.y - box.top;
    const cy = chip.offsetTop + chip.offsetHeight / 2;
    const edge = left ? chip.offsetLeft + chip.offsetWidth : chip.offsetLeft;
    const run = Math.abs(cy - ay) * 0.9;
    const elbow = left
      ? Math.max(edge + 24 * k, Math.min(ax, ax - run))
      : Math.min(edge - 24 * k, Math.max(ax, ax + run));
    path.setAttribute("d", `M${edge} ${cy} H${elbow} L${ax} ${ay}`);
    dot.setAttribute("cx", `${ax}`);
    dot.setAttribute("cy", `${ay}`);
  });
}

/**
 * Places the callouts, dimension, other machines and caption around where the risen server is
 * (its centre and size are computed, not read, for the same reason recenterY is). Re-run on every
 * refresh, so it follows the viewport.
 */
function layoutSpace(root: HTMLElement) {
  const k = readScale();
  const W = root.offsetWidth;
  const H = window.innerHeight;
  const cx = W / 2 + window.innerWidth * SPACE_SHIFT_X_VW;
  const cy = (H + HEADER_HEIGHT_PX) / 2;
  const hw = (MODEL_WIDTH_PX * k * CUBE_SCALE_TARGET) / 2;
  const hh = ((3 * STACK_GAP_CLOSED_PX * k + coreHeightPx()) * CUBE_SCALE_TARGET) / 2;
  const margin = 85 * k;
  const gap = 12;

  const svg = root.querySelector<SVGSVGElement>("[data-space-svg]");
  svg?.setAttribute("viewBox", `0 0 ${W} ${H}`);

  // anchor on the server -> label on the right
  const callouts: { ax: number; ay: number; ly: number; side: "right" | "left" }[] = [
    { ax: cx + hw * 0.95, ay: cy - hh * 0.62, ly: cy - hh * 1.0, side: "right" },
    { ax: cx + hw * 1.15, ay: cy - hh * 0.26, ly: cy - hh * 0.72, side: "right" },
  ];
  callouts.forEach((c, i) => {
    const label = root.querySelector<HTMLElement>(`[data-space-label="${i}"]`);
    const path = root.querySelector<SVGPathElement>(`[data-space-line="${i}"] path`);
    const dot = root.querySelector<SVGCircleElement>(`[data-space-line="${i}"] circle`);
    if (!label || !path || !dot) return;
    label.style.top = `${c.ly - label.offsetHeight / 2}px`;
    const edge = c.side === "right" ? W - margin - label.offsetWidth - gap : margin + label.offsetWidth + gap;
    const elbowX = c.ax + (edge - c.ax) * 0.35;
    path.setAttribute("d", `M${c.ax} ${c.ay} L${elbowX} ${c.ly} H${edge}`);
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.dataset.len = `${len}`;
    dot.setAttribute("cx", `${c.ax}`);
    dot.setAttribute("cy", `${c.ay}`);
  });

  // the other projects' machines, smaller and dimmed, to the right of and below the main one
  const others = [...root.querySelectorAll<HTMLElement>("[data-space-other]")];
  // (spaced a little further from the main server and from each other on feedback, 2026-09-21)
  others.forEach((img, i) => {
    const w = hw * 0.85;
    img.style.width = `${w}px`;
    img.style.left = `${cx + hw * 1.25 + i * hw * 0.5}px`;
    img.style.top = `${cy - hh * 0.1 + i * hh * 0.45}px`;
  });
  const caption = root.querySelector<HTMLElement>("[data-space-caption]");
  if (caption) caption.style.top = `${cy + hh * 1.15 - caption.offsetHeight / 2}px`;
}

export function useHeroScrollAnimation({
  sectionRef,
  contentRef,
  cubeWrapperRef,
  modelRef,
  modelSyncRef,
  ssrScrollReserveRef,
  gridMarks,
  spaceRef,
  stackRef,
}: HeroScrollRefs) {
  useGSAP(
    () => {
      // Real bug, diagnosed with hard numbers: the server-rendered page (before any client JS
      // runs) is SHORTER than the final, hydrated page by exactly PIN_SCROLL_DISTANCE — because
      // GSAP's pin-spacer (which reserves that scroll room) only gets created below, client-side,
      // well after Next.js's initial HTML paints. On a hard refresh while already scrolled deep,
      // the BROWSER restores scrollY against the SHORT pre-hydration document; once hydration then
      // grows the document underneath that restored scroll position, the effective
      // scroll/animation state destabilizes. Reported by the user as "loses its position," "shows
      // closed after refreshing while open," and "refreshing from InfrastructureSection jumps me
      // back up." Fix: HeroSectionClient.tsx server-renders a dedicated `ssrScrollReserveRef`
      // spacer div (height: PIN_SCROLL_DISTANCE) as the LAST child of the section, so the INITIAL
      // (pre-JS) page is ALREADY the same total height the pin-spacer will later reserve — no
      // height jump, so browser scroll-restoration has nothing to destabilize. That spacer is only
      // a placeholder for the SSR/pre-hydration window, though — GSAP's real pin-spacer (created
      // below, when a ScrollTrigger pin exists) does the actual job once it exists, so the
      // placeholder must collapse right here, synchronously, on EVERY path through this effect
      // (including prefers-reduced-motion, checked next, which never creates a pin at all and so
      // never needs this reservation either) — otherwise either the placeholder lingers forever
      // (reduced-motion case) or both it and the real pin-spacer would apply at once,
      // double-reserving twice the distance instead of once.
      //
      // That SSR-height fix turned out not to be the whole story, though — a SECOND, separate
      // mechanism was still stranding scrollY after a refresh, but only in `next dev` (never
      // reproduced in a production build). React 19 StrictMode's dev-only double-invoke does
      // mount -> effect -> CLEANUP -> effect again for every effect, and the CLEANUP step (which
      // calls `gsap.context().revert()` internally, via useGSAP) temporarily REMOVES the pin-spacer
      // between the two invocations. That's a genuine, if momentary, document-height collapse —
      // and browsers respond to a scrollable-area collapse below the current scroll position by
      // CLAMPING scrollY to fit the new (shorter) max. The collapse recovers a frame later, but
      // the browser does NOT automatically scroll back down to where it clamped FROM — so scrollY
      // stays stuck at the clamped value permanently. This used to be patched HERE (a captured
      // `scrollYBeforeChurnRef` + a 100ms-later restore, once per section) — moved out to a single
      // shared `<ScrollChurnGuard />` (src/components/layout/ScrollChurnGuard.tsx), mounted once in
      // layout.tsx, because five independent copies of this same fix (one per pinned section) raced
      // each other: each captured scrollY inside its OWN effect, which ran only after every EARLIER
      // section's effect had already collapsed ITS spacer and potentially already clamped scrollY —
      // so later sections captured an already-wrong value, and whichever section's stale correction
      // fired last would drag the page into ITS OWN pin range regardless of where the user actually
      // was. See ScrollChurnGuard.tsx for the full diagnosis.
      if (ssrScrollReserveRef.current) ssrScrollReserveRef.current.style.height = "0px";
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // No pin here, so the server just scrolls away with the page while the grid (and anything
        // drawn on it) stays put in the viewport — the marks would detach and float. Left off.
        gridMarks.setAppearance({ opacity: 0 });
        return;
      }
      if (!sectionRef.current || !contentRef.current || !cubeWrapperRef.current) return;

      const cubeWrapper = cubeWrapperRef.current;

      // How far to shift the wrapper vertically so it lands centered in the viewport once scaled
      // up. Uses `offsetTop` (relative to the <section>, which is `position: relative` — see
      // HeroSectionClient.tsx) rather than `getBoundingClientRect()`, deliberately: offsetTop is a
      // pure layout measurement, unaffected by scroll position OR whether the section is currently
      // pinned (position:fixed). getBoundingClientRect() is viewport-relative, so it's only
      // trustworthy when measured at a moment with a KNOWN scroll/pin state — which broke in
      // practice on a hard page refresh while already scrolled deep into the pinned range.
      //
      // The wrapper's HEIGHT half of this calculation is deliberately NOT read from
      // `cubeWrapper.offsetHeight` either, even though that's also scroll-independent —
      // offsetHeight reflects whatever `--stack-gap` is CURRENTLY set to, which is itself
      // controlled by this same ScrollTrigger. Refreshing while scrolled deep left --stack-gap at
      // its OPEN value, so offsetHeight measured the OPEN (tall) height instead of the CLOSED one
      // recenterY is meant to center. Fixed by computing the CLOSED height analytically.
      let recenterY = 0;
      const measureRecenterY = () => {
        // Both terms scale: the gap because --stack-gap is written scaled below, the core height
        // because the wrapper itself is.
        const closedHeight = 3 * STACK_GAP_CLOSED_PX * readScale() + coreHeightPx();
        const naturalCenterY = cubeWrapper.offsetTop + closedHeight / 2;
        // Centred in the part of the viewport BELOW the sticky header, not the whole viewport: at
        // CUBE_SCALE_TARGET 1.35 the grown server otherwise crowds the header on shorter screens.
        recenterY = (window.innerHeight + HEADER_HEIGHT_PX) / 2 - EXTRA_RISE_PX - naturalCenterY;
      };
      measureRecenterY();

      // Assigned further down (it needs `tl` and `disassemble`), but referenced by the
      // ScrollTrigger's own onRefresh below — which fires on creation too, hence the nullable
      // holder rather than a direct reference.
      let syncModelOnRefresh: (() => void) | null = null;
      // Set by the "02" phase: re-applies the pose lock and blueprint after a resync, and removes its
      // per-frame line tracker on cleanup.
      let syncStack: (() => void) | null = null;
      let removeTicker: (() => void) | null = null;
      let applyDiveOnSync: (() => void) | null = null;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: () => `+=${PIN_SCROLL_DISTANCE * readScale()}`,
          scrub: 1,
          pin: true,
          // GSAP disables automatic pin-spacing by default when the pinned element's parent is
          // display:flex (our <main class="flex flex-1 flex-col"> layout) — force it on, else no
          // extra scroll distance is reserved and the pin never actually holds.
          pinSpacing: true,
          invalidateOnRefresh: true,
          onRefreshInit: () => {
            measureRecenterY();
            if (!HERO_EXPLODE_ON_SCROLL && spaceRef?.current) layoutSpace(spaceRef.current);
            if (!HERO_EXPLODE_ON_SCROLL && stackRef?.current) layoutStack(stackRef.current);
          },
          // THE FIX for "the hero's server is closed after the build section closed its own".
          //
          // Nothing is shared between the two 3D servers — each HeroServerModel instance builds its
          // own scene, mixer and action, and each section drives its own apiRef. What IS shared is
          // ScrollTrigger: BuildSection calls the page-wide, static `ScrollTrigger.refresh()` (from
          // its onLeave, once its server has finished closing, and from its own model's onReady).
          // A refresh reverts every trigger's animated properties to re-measure them, and because
          // this timeline has `invalidateOnRefresh: true`, Hero's disassemble proxy gets reset with
          // them — leaving the model at whatever pose that reset produced until something drives it
          // again. Hero had no such re-assertion (its sync only ran when its own GLB reported
          // ready), while BuildSection has always re-applied its own state in `onRefresh` — which is
          // exactly why the bug only ever went one way, Build breaking Hero and never the reverse.
          //
          // So: Hero now re-asserts too. `syncModelToTimeline` is a pure function of the trigger's
          // current progress, so this is idempotent and correct no matter who fired the refresh.
          onRefresh: () => syncModelOnRefresh?.(),
        },
      });

      // Proxies whose only job is to carry a scrubbed number: `disassemble.t` drives the model,
      // `hold.t` exists purely to give the timeline its trailing dead time.
      const disassemble = { t: 0 };
      const hold = { t: 0 };
      // "02 — your stack": 0 = rendered server, 1 = line drawing (HeroServerModel.setBlueprint).
      const blueprint = { t: 0 };
      const stackHold = { t: 0 };
      // the dive: `m` is its move (0..1), `star` how dark the star is
      const dive = { m: 0, star: 0 };

      // 1. Text rises and fades out (not a plain in-place dissolve).
      tl.to(
        contentRef.current,
        { autoAlpha: 0, y: -TEXT_RISE_PX, duration: TEXT_FADE_DURATION, ease: "power1.out" },
        0,
      )
        // 2. The server starts enlarging and re-centring (rising into view) at the same instant
        // the text starts fading, fully overlapping it rather than waiting.
        .to(
          cubeWrapper,
          {
            scale: CUBE_SCALE_TARGET,
            transformOrigin: "50% 50%",
            // Reads the cached value from measureRecenterY (see above) rather than measuring here.
            y: () => recenterY,
            duration: CUBE_SCALE_DURATION,
            ease: "power2.inOut",
          },
          SCALE_START,
        );

      if (HERO_EXPLODE_ON_SCROLL) {
        tl
        // 3. (Only with HERO_EXPLODE_ON_SCROLL — off since 2026-09-21, see heroLayers.ts.) The
          //    instant that finishes, the server pulls apart. Two tweens run together here:
          //    --stack-gap (so the wrapper's document height grows exactly as it did with the SVG
          //    stack) and `disassemble.t`, which scrubs the GLB's explode_sequence clip. No
          //    re-centring tween is needed any more: the model keeps itself centred as it opens
          //    (see HeroServerModel.setProgress), which is what the old CENTER_SHIFT_ON_OPEN_PX
          //    offset on this tween used to do by hand.
          .fromTo(
            cubeWrapper,
            { "--stack-gap": () => `${STACK_GAP_CLOSED_PX * readScale()}px` },
            {
              "--stack-gap": () => `${STACK_GAP_OPEN_PX * readScale()}px`,
              duration: DISASSEMBLE_DURATION,
              ease: "power1.inOut",
            },
            SCALE_START + CUBE_SCALE_DURATION,
          )
          .fromTo(
            disassemble,
            { t: 0 },
            {
              t: 1,
              duration: DISASSEMBLE_DURATION,
              ease: "power1.inOut",
              onUpdate: () => modelRef.current?.setProgress(disassemble.t),
            },
            SCALE_START + CUBE_SCALE_DURATION,
          )
          // 4. Nothing moves: the pin just keeps holding while the fully-open server sits there.
          .to(hold, { t: 1, duration: HOLD_OPEN_DURATION }, SCALE_START + CUBE_SCALE_DURATION + DISASSEMBLE_DURATION);
      } else {
        // 3'. "03 — isolated spaces" (see SPACE_* above).
        const space = spaceRef?.current;
        if (space) {
          layoutSpace(space);
          const q = <T extends Element>(sel: string) => space.querySelector<T>(sel);
          const text = q<HTMLElement>("[data-space-text]");
          const others = [...space.querySelectorAll<HTMLElement>("[data-space-other]")];
          const caption = q<HTMLElement>("[data-space-caption]");
          const S = SPACE_START;

          tl.to(cubeWrapper, { x: () => window.innerWidth * SPACE_SHIFT_X_VW, duration: 1.0, ease: "power2.inOut" }, S);
          if (text) tl.fromTo(text, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power2.out" }, S + 0.1);
          // the layers ease a little apart once the copy is in (through the same `disassemble`
          // proxy the full explode used, so syncModelToTimeline keeps the model in step with it)
          tl.fromTo(
            disassemble,
            { t: 0 },
            {
              t: SPACE_SPREAD,
              duration: 1.1,
              ease: "power2.inOut",
              onUpdate: () => modelRef.current?.setProgress(disassemble.t),
            },
            S + 0.4,
          );

          for (let i = 0; i < 2; i++) {
            const line = q<SVGGElement>(`[data-space-line="${i}"]`);
            const path = line?.querySelector("path");
            const label = q<HTMLElement>(`[data-space-label="${i}"]`);
            const at = S + 0.35 + i * 0.15;
            if (line) tl.fromTo(line, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, at);
            if (path) {
              tl.fromTo(
                path,
                { strokeDashoffset: () => Number(path.dataset.len ?? 0) },
                { strokeDashoffset: 0, duration: 0.45, ease: "power2.out" },
                at,
              );
            }
            if (label) tl.fromTo(label, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, at + 0.25);
          }

          others.forEach((img, i) => {
            tl.fromTo(img, { autoAlpha: 0, x: 80 }, { autoAlpha: 0.35, x: 0, duration: 0.6, ease: "power3.out" }, S + 1.0 + i * 0.12);
          });
          if (caption) tl.fromTo(caption, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, S + 1.3);
        }
        // 4'. Then the pin holds for the same beat the open server used to get…
        tl.to(hold, { t: 1, duration: HOLD_OPEN_DURATION }, SPACE_START + SPACE_PHASE_DURATION);

        // 5'. …and scrolls on down to "02 — your stack" (see STACK_* above).
        const stack = stackRef?.current;
        if (space && stack) {
          layoutStack(stack);
          const T = SPACE_START + SPACE_PHASE_DURATION + HOLD_OPEN_DURATION;
          const M = STACK_MOVE_DURATION;

          // "01" out: its copy lifts and blurs away line by line, the callouts and other machines
          // fade; then "02"'s copy rises into the same spot the same way.
          const spaceText = space.querySelector<HTMLElement>("[data-space-text]");
          const spaceRest = [...space.children].filter((el) => el !== spaceText);
          if (spaceText) {
            tl.to(
              [...spaceText.children],
              { autoAlpha: 0, y: -28, filter: "blur(8px)", duration: M * 0.3, ease: "power2.in", stagger: M * 0.05 },
              T,
            );
          }
          tl.to(spaceRest, { autoAlpha: 0, duration: M * 0.3, ease: "power1.in" }, T);
          tl.set(stack, { autoAlpha: 1 }, T);
          const stackText = stack.querySelector<HTMLElement>("[data-stack-text]");
          if (stackText) {
            tl.set(stackText, { autoAlpha: 1 }, T);
            tl.fromTo(
              [...stackText.children],
              { autoAlpha: 0, y: 32, filter: "blur(8px)" },
              {
                autoAlpha: 1,
                y: 0,
                filter: "blur(0px)",
                duration: M * 0.35,
                ease: "power3.out",
                stagger: M * 0.06,
              },
              T + M * 0.38,
            );
          }

          // The server: steps a little aside and back while it changes — a touch smaller and a touch
          // further from the copy — so the change reads as a move rather than a flicker in place.
          tl.to(
            cubeWrapper,
            {
              scale: CUBE_SCALE_TARGET * STACK_SCALE_RATIO,
              x: () => window.innerWidth * (SPACE_SHIFT_X_VW + STACK_SHIFT_X_VW),
              duration: M * 0.9,
              ease: "power2.inOut",
            },
            T,
          );
          tl.fromTo(
            blueprint,
            { t: 0 },
            {
              t: 1,
              duration: M * 0.75,
              ease: "power2.inOut",
              immediateRender: false,
              onUpdate: () => modelRef.current?.setBlueprint(blueprint.t),
            },
            T + M * 0.1,
          );
          tl.to(stackHold, { t: 1, duration: STACK_HOLD_DURATION }, T + M);

          // The services: their own timeline, played on arrival and reversed on the way back.
          const q = <E extends Element>(sel: string) => [...stack.querySelectorAll<E>(sel)];
          const chips = q<HTMLElement>("[data-stack-chip]");
          const reveal = gsap.timeline({ paused: true });
          chips.forEach((chip, i) => {
            reveal.fromTo(
              chip,
              { autoAlpha: 0, y: 8 },
              { autoAlpha: 1, y: 0, duration: CHIP_IN, ease: "power2.out" },
              i * CHIP_STAGGER,
            );
            const g = stack.querySelector(`[data-stack-line="${chip.dataset.stackChip}"]`);
            const path = g?.querySelector("path");
            const dot = g?.querySelector("circle");
            const at = LINES_START + i * LINE_STAGGER;
            if (path) reveal.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: LINE_DRAW, ease: "power2.out" }, at);
            if (dot) reveal.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.15 }, at + LINE_DRAW - 0.1);
          });
          const label = stack.querySelector<HTMLElement>("[data-stack-label]");
          if (label) reveal.fromTo(label, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: CHIP_IN, ease: "power2.out" }, STACK_LABEL_AT);

          const revealAt = T + M * STACK_REVEAL_AT;
          let revealed = false;
          let locked = false;
          const onTimeline = () => {
            const time = tl.time();
            const lock = time >= T + M * 0.05;
            if (lock !== locked) {
              locked = lock;
              modelRef.current?.setPoseLock(lock);
            }
            const show = time >= revealAt;
            if (show !== revealed) {
              revealed = show;
              if (show) reveal.timeScale(1).play();
              else reveal.timeScale(2).reverse();
            }
          };
          tl.eventCallback("onUpdate", onTimeline);
          // After a refresh / late model: land on the right state instantly, no animation.
          syncStack = () => {
            const time = tl.time();
            locked = time >= T + M * 0.05;
            modelRef.current?.setPoseLock(locked);
            modelRef.current?.setBlueprint(blueprint.t);
            revealed = time >= revealAt;
            reveal.pause().progress(revealed ? 1 : 0);
            applyDiveOnSync?.();
          };

          // 6'. The dive into the cap (DIVE_* above).
          const D = T + M + STACK_HOLD_DURATION;
          const services = stack.querySelector<HTMLElement>("[data-stack-services]");
          if (services) tl.to(services, { autoAlpha: 0, y: -12, duration: 0.35, ease: "power1.in" }, D);
          if (stackText) {
            tl.to(
              [...stackText.children],
              { autoAlpha: 0, y: -28, filter: "blur(8px)", duration: 0.32, ease: "power2.in", stagger: 0.06 },
              D + 0.05,
            );
          }
          // colour back: the same scan, running back up
          tl.fromTo(
            blueprint,
            { t: 1 },
            {
              t: 0,
              duration: 0.7,
              ease: "power2.inOut",
              immediateRender: false,
              onUpdate: () => modelRef.current?.setBlueprint(blueprint.t),
            },
            D + 0.15,
          );
          // the stack closes as the turn starts
          tl.fromTo(
            disassemble,
            { t: SPACE_SPREAD },
            {
              t: 0,
              duration: 0.7,
              ease: "power2.inOut",
              immediateRender: false,
              onUpdate: () => modelRef.current?.setProgress(disassemble.t),
            },
            D + DIVE_LEAD,
          );
          const applyDive = () => modelRef.current?.setDive(divePose(dive.m, dive.star));
          tl.fromTo(dive, { star: 0 }, { star: 1, duration: 0.5, ease: "power1.inOut", immediateRender: false, onUpdate: applyDive }, D + 0.6);
          tl.fromTo(dive, { m: 0 }, { m: 1, duration: DIVE_MOVE, ease: "none", immediateRender: false, onUpdate: applyDive }, D + DIVE_LEAD);
          tl.to({}, { duration: DIVE_END }, D + DIVE_LEAD + DIVE_MOVE);
          applyDiveOnSync = applyDive;

          // Lines follow the server every frame while "02"'s services are on screen.
          const track = () => {
            const time = tl.time();
            if (time < T || time > D + 0.4) return;
            trackStackLines(stack, modelRef.current);
          };
          gsap.ticker.add(track);
          removeTicker = () => gsap.ticker.remove(track);
        }
      }

      // The GLB loads asynchronously and arrives well after this timeline (and its ScrollTrigger)
      // already exist — HeroServerModel.tsx always starts it at setProgress(0) (closed), since it
      // has no way to know the scroll-derived target itself. Real bug, reported as "instead of
      // open, I find it closed, then it suddenly opens": the old fix here just called
      // `ScrollTrigger.refresh()` once the model was ready, which recomputes pin positions and
      // re-syncs `self.progress` — but this timeline's `scrub: 1` means that re-sync goes through
      // the SAME eased catch-up scroll uses for ordinary scrolling, so the model visibly animated
      // from closed to its true open pose over about a second, instead of just already being there.
      // First fix: jump the timeline's own progress directly to the ScrollTrigger's post-refresh
      // value via `tl.progress(value)`, which sets time immediately (skipping the scrub's eased
      // interpolation) and still fires each tween's onUpdate — so `disassemble`'s callback still
      // calls `modelRef.current.setProgress(...)`.
      //
      // Second, subtler bug in that same fix, reported separately: refresh while scrolled to the
      // FOOTER, then scroll straight up past Hero without pausing — Hero's server was STILL closed
      // once you reached it, well after the GLB must have finished loading. Root cause: GSAP skips
      // firing a tween's onUpdate when `.progress()` is set to a value the timeline is ALREADY at.
      // If the user scrolls fast enough that the timeline's progress organically reaches 1 (driven
      // by the OTHER tweens in this same timeline — text fade, scale, --stack-gap — none of which
      // are gated on the model) before the GLB finishes loading, then by the time `onReady` fires,
      // `tl.progress(st.progress)` is a no-op (already there, nothing "changes"), the disassemble
      // tween's onUpdate never fires, and `modelRef.current.setProgress` never gets its first real
      // call. Fixed by ALSO calling `modelRef.current.setProgress` directly and unconditionally
      // here, reading straight off the `disassemble` proxy object — GSAP keeps that object's own
      // `.t` correctly interpolated on every render regardless of whether anything is listening via
      // onUpdate, so it's trustworthy to read directly.
      //
      // Third bug, found diagnosing the second with instrumented logging (traced every
      // `setProgress` call back to its caller): this function's own synchronous sync correctly
      // called `setProgress(1)` — then, within the same tick, `setProgress(0)` fired several more
      // times from the disassemble tween's OWN normal `onUpdate` callback, undoing it. Root cause
      // isn't this section at all — it's `BuildSectionClient.tsx`'s `handleModelReady`, which (for
      // its OWN, separate HeroServerModel instance) calls the STATIC `ScrollTrigger.refresh()` —
      // a page-wide call that refreshes EVERY ScrollTrigger, not just Build's own. Hero's own
      // ScrollTrigger has `invalidateOnRefresh: true`, so any such refresh — triggered by Hero's own
      // GLB becoming ready, Build's, or anything else on the page — makes GSAP briefly reset Hero's
      // animated properties to their natural/un-animated state to re-measure them, and that reset
      // can land AFTER this function's own sync already ran, since both GLBs tend to finish loading
      // within the same handful of milliseconds (both are small, both typically already cached).
      // Removing Hero's OWN `ScrollTrigger.refresh()` call (an earlier attempt at this same fix)
      // only prevented HERO's copy of this from firing — it did nothing about Build's.
      //
      // Rather than trying to coordinate every other section's own refresh() calls (fragile, and
      // more will likely be added later), this re-asserts the correct value defensively: once
      // immediately (handles a refresh that already happened before this runs), then once more a
      // frame later (`requestAnimationFrame`, catches a refresh landing the SAME tick — exactly what
      // the logged repro showed) and once more after a short delay (catches a refresh from a slower
      // GLB arriving after both of those). All three read `disassemble.t` fresh at call time, so
      // they're correct regardless of what scrolling has done between them.
      const syncModelToTimeline = () => {
        const st = tl.scrollTrigger;
        if (st) tl.progress(st.progress);
        modelRef.current?.setProgress(disassemble.t);
        syncStack?.();
      };
      syncModelOnRefresh = syncModelToTimeline;

      // The corner marks' own fade (see CROSS_FADE_SCROLL_PX). Its own trigger, not the pin's
      // onUpdate, because it has to start at scroll 0 — the pin's range only begins once the
      // section's top reaches the viewport top, i.e. a header-height in, by which point the
      // server has already travelled.
      gridMarks.setAppearance({ opacity: 1, scale: 1 });
      ScrollTrigger.create({
        trigger: document.documentElement,
        start: "top top",
        end: () => `+=${CROSS_FADE_SCROLL_PX * readScale()}`,
        onUpdate: (self) => gridMarks.setAppearance({ opacity: 1 - self.progress }),
        onLeave: () => gridMarks.setAppearance({ opacity: 0 }),
        onEnterBack: () => gridMarks.setAppearance({ opacity: 1 }),
      });

      modelSyncRef.current = () => {
        syncModelToTimeline();
        requestAnimationFrame(syncModelToTimeline);
        setTimeout(syncModelToTimeline, 300);
      };

      return () => removeTicker?.();
    },
    { scope: sectionRef },
  );
}
