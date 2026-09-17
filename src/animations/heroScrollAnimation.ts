import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { HERO_PIN_SCROLL_DISTANCE } from "@/lib/heroLayers";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Wrapper scales up this much once the text has cleared out. Reduced 1.2 -> 1.08 -> 1.04 across
// two rounds of feedback — kept reading as enlarging too much each time.
const CUBE_SCALE_TARGET = 1.04;
// How far the text rises as it fades, instead of dissolving in place.
const TEXT_RISE_PX = 60;
// Extra scroll distance (px) the pin holds the section for while the timeline scrubs. Was 700;
// bumped to 980 alongside doubling CUBE_SCALE_DURATION below (700 * 4.2/3.0 = 980) so that the
// rise+scale phase alone needs 2x the scroll it used to, while the text-fade and disassemble
// phases keep needing EXACTLY the same scroll distance as before (233px and 420px respectively —
// unchanged) — see the ratio math in that constant's comment.
//
// Imported from src/lib/heroLayers.ts (not a local constant) because HeroSectionClient.tsx needs
// this SAME number to server-render a matching placeholder spacer — see the long comment on
// `ssrScrollReserveRef` below for why.
const PIN_SCROLL_DISTANCE = HERO_PIN_SCROLL_DISTANCE;

const TEXT_FADE_DURATION = 1;
// The scale-up/rise now starts the INSTANT the text starts fading (fully overlapping the text
// fade), not partway through it — user feedback: "raise it up right when the text starts
// disappearing." (Previously started at TEXT_FADE_DURATION * 0.5, itself already an earlier
// change from an initial "wait for text to fully finish" version.)
const SCALE_START = 0;
// Doubled from 1.2 — user asked specifically for the rise+scale moment (only that moment) to need
// more scroll. Doubling this alone would've also made the OTHER phases need less scroll (same
// PIN_SCROLL_DISTANCE spread over a longer total timeline) — PIN_SCROLL_DISTANCE above was scaled
// up by the same ratio the total timeline grew by, specifically to cancel that out.
const CUBE_SCALE_DURATION = 2.4;
// The rest of the scroll: the layer stack pulls apart. Shortened from an initial 2.8 alongside an
// earlier PIN_SCROLL_DISTANCE cut — unrelated to the CUBE_SCALE_DURATION doubling above.
const DISASSEMBLE_DURATION = 1.8;

// Starting point for the closed/open vertical gap between stacked layers — tune live against a
// server-cube.png screenshot (see PROJECT.md), not meant to be exact on the first try.
const STACK_GAP_CLOSED_PX = 45;
const STACK_GAP_OPEN_PX = 140;

// Mirrors HeroSectionClient.tsx's own CORE_WIDTH-derived --core-height values (400*256/372 and
// 480*256/372) and its min-[1800px] breakpoint — needed here so the wrapper's CLOSED height can be
// computed analytically (see measureRecenterY below) instead of read live via offsetHeight, which
// reflects whatever --stack-gap CURRENTLY is, not necessarily the closed one.
const CORE_HEIGHT_NARROW_PX = (400 * 256) / 372;
const CORE_HEIGHT_WIDE_PX = (480 * 256) / 372;
const WIDE_BREAKPOINT_PX = 1800;

// Each layer's `top` grows from a fixed top edge (top: calc(index * var(--stack-gap)), see
// HeroSectionClient.tsx), so as --stack-gap grows the wrapper only gets taller by extending
// DOWNWARD — its visual vertical center drifts down as it opens, even though the closed pose was
// centered. Total height growth across the 3 gaps = 3 * (open - closed); half of that is how far
// the center drifts, so shifting the wrapper up by that same amount during the disassemble tween
// keeps the FULLY OPEN stack centered too, not just the closed one.
const CENTER_SHIFT_ON_OPEN_PX = 1.5 * (STACK_GAP_OPEN_PX - STACK_GAP_CLOSED_PX);

// Extra nudge above true viewport-center — user asked to raise it further after the initial
// centering fix. Applies to both the closed and open positions (baked into recenterY below), so
// the whole rise/scale/disassemble sequence sits this much higher throughout.
const EXTRA_RISE_PX = 180;

interface HeroScrollRefs {
  sectionRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  cubeWrapperRef: RefObject<HTMLDivElement | null>;
  // Server-rendered placeholder spacer that pre-reserves PIN_SCROLL_DISTANCE worth of height
  // before any client JS runs — see the long comment where this is collapsed, below.
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

export function useHeroScrollAnimation({
  sectionRef,
  contentRef,
  cubeWrapperRef,
  ssrScrollReserveRef,
}: HeroScrollRefs) {
  // Survives React 19 StrictMode's dev-only mount -> cleanup -> remount cycle (a plain `let` inside
  // the useGSAP callback would not — it gets a fresh value on every invocation). See the long
  // comment below (`restoreScrollY`) for why this needs to persist across that cycle specifically.
  const scrollYBeforeChurnRef = useRef<number | null>(null);

  useGSAP(
    () => {
      // Captured on the FIRST of the two StrictMode invocations only (guarded by the `=== null`
      // check) — by the time the SECOND invocation's effect body runs, scrollY has often already
      // been clamped away (see `restoreScrollY` below), so re-capturing here on every invocation
      // would just cache the WRONG, already-broken value instead of the real one.
      if (scrollYBeforeChurnRef.current === null) scrollYBeforeChurnRef.current = window.scrollY;

      // Real bug, diagnosed with hard numbers: the server-rendered page (before any client JS
      // runs) is SHORTER than the final, hydrated page by exactly PIN_SCROLL_DISTANCE — because
      // GSAP's pin-spacer (which reserves that scroll room) only gets created below, client-side,
      // well after Next.js's initial HTML paints. Measured directly: document height went from
      // 2245px (pre-hydration) to 3225px (post-hydration) — a 980px jump, matching
      // PIN_SCROLL_DISTANCE exactly. On a hard refresh while already scrolled deep, the BROWSER
      // restores scrollY against the SHORT pre-hydration document; once hydration then grows the
      // document underneath that restored scroll position, the effective scroll/animation state
      // destabilizes — reproduced directly: refreshing at scrollY=1077 (fully open) settled at
      // scrollY=700 with the stack back to nearly closed (46.99px). Reported by the user as
      // "loses its position," "shows closed after refreshing while open," and "refreshing from
      // InfrastructureSection jumps me back up." Fix: HeroSectionClient.tsx server-renders a
      // dedicated `ssrScrollReserveRef` spacer div (height: PIN_SCROLL_DISTANCE) as the LAST child
      // of the section, so the INITIAL (pre-JS) page is ALREADY the same total height the
      // pin-spacer will later reserve — no height jump, so browser scroll-restoration has nothing
      // to destabilize. That spacer is only a placeholder for the SSR/pre-hydration window, though
      // — GSAP's real pin-spacer (created below, when a ScrollTrigger pin exists) does the actual
      // job once it exists, so the placeholder must collapse right here, synchronously, on EVERY
      // path through this effect (including prefers-reduced-motion, checked next, which never
      // creates a pin at all and so never needs this reservation either) — otherwise either the
      // placeholder lingers forever (reduced-motion case) or both it and the real pin-spacer would
      // apply at once, double-reserving 1960px instead of 980px.
      //
      // That SSR-height fix turned out not to be the whole story, though — a SECOND, separate
      // mechanism was still stranding scrollY after a refresh, but only in `next dev` (never
      // reproduced in a production build). Root-caused by instrumenting scrollY/document height on
      // every animation frame around a reload: React 19 StrictMode's dev-only double-invoke does
      // mount -> effect -> CLEANUP -> effect again for every effect, and the CLEANUP step (which
      // calls `gsap.context().revert()` internally, via useGSAP) temporarily REMOVES the pin-spacer
      // between the two invocations. That's a genuine, if momentary, document-height collapse
      // (measured: 3225px -> 1780px, back to 3225px roughly 15ms later) — and browsers respond to a
      // scrollable-area collapse below the current scroll position by CLAMPING scrollY to fit the
      // new (shorter) max. The collapse recovers a frame later, but the browser does NOT
      // automatically scroll back down to where it clamped FROM — so scrollY stays stuck at the
      // clamped value permanently. This is orthogonal to (and was actually MASKED by, until now)
      // the SSR-height fix above: that fix stops the reload's OWN initial restore from being
      // wrong, but StrictMode's cleanup/remount churn happens AFTER that, independently.
      if (ssrScrollReserveRef.current) ssrScrollReserveRef.current.style.height = "0px";
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!sectionRef.current || !contentRef.current || !cubeWrapperRef.current) return;

      const cubeWrapper = cubeWrapperRef.current;

      // How far to shift the wrapper vertically so it lands centered in the viewport once scaled
      // up. Uses `offsetTop` (relative to the <section>, which is `position: relative` — see
      // HeroSectionClient.tsx) rather than `getBoundingClientRect()`, deliberately: offsetTop is a
      // pure layout measurement, unaffected by scroll position OR whether the section is currently
      // pinned (position:fixed). getBoundingClientRect() is viewport-relative, so it's only
      // trustworthy when measured at a moment with a KNOWN scroll/pin state — which broke in
      // practice on a hard page refresh while already scrolled deep into the pinned range (the
      // browser restores scroll position before/during mount) — reported as "everything shows up
      // messed up" after refreshing mid-disassembly.
      //
      // The wrapper's HEIGHT half of this calculation is deliberately NOT read from
      // `cubeWrapper.offsetHeight` either, even though that's also scroll-independent — offsetHeight
      // reflects whatever `--stack-gap` is CURRENTLY set to, which is itself controlled by this same
      // ScrollTrigger. Refreshing while scrolled deep (fully open) left `--stack-gap` at its OPEN
      // value at the moment of a later refresh, so offsetHeight measured the OPEN (tall) height
      // instead of the CLOSED one recenterY is meant to center — producing a "way too high" result
      // once the user scrolled back up (reported as "loses its position, then I find it raised way
      // too far up" after refresh-while-open). Fixed by computing the CLOSED height analytically
      // (CORE_HEIGHT_NARROW_PX/WIDE_PX + STACK_GAP_CLOSED_PX, mirroring HeroSectionClient.tsx's own
      // formula) instead of measuring it live, so it's correct regardless of --stack-gap's current
      // (possibly mid-scroll) value.
      let recenterY = 0;
      const measureRecenterY = () => {
        const coreHeight = window.innerWidth >= WIDE_BREAKPOINT_PX ? CORE_HEIGHT_WIDE_PX : CORE_HEIGHT_NARROW_PX;
        const closedHeight = 3 * STACK_GAP_CLOSED_PX + coreHeight;
        const naturalCenterY = cubeWrapper.offsetTop + closedHeight / 2;
        recenterY = window.innerHeight / 2 - EXTRA_RISE_PX - naturalCenterY;
      };
      measureRecenterY();

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: `+=${PIN_SCROLL_DISTANCE}`,
          scrub: 1,
          pin: true,
          // GSAP disables automatic pin-spacing by default when the pinned element's parent is
          // display:flex (our <main class="flex flex-1 flex-col"> layout) — force it on, else no
          // extra scroll distance is reserved and the pin never actually holds.
          pinSpacing: true,
          invalidateOnRefresh: true,
          onRefreshInit: measureRecenterY,
        },
      });

      // 1. Text rises and fades out (not a plain in-place dissolve).
      tl.to(
        contentRef.current,
        { autoAlpha: 0, y: -TEXT_RISE_PX, duration: TEXT_FADE_DURATION, ease: "power1.out" },
        0,
      )
        // 2. The layer stack starts enlarging and re-centering (rising into view) at the same
        // instant the text starts fading, fully overlapping it rather than waiting.
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
        )
        // 3. The instant that finishes, the stack pulls apart — a single CSS custom property
        // (--stack-gap) animates from tight/closed to wide/open; each layer's own `top:
        // calc(index * var(--stack-gap))` (set in HeroSectionClient.tsx) does the rest, so this is
        // a real per-layer disassembly with no per-layer GSAP targeting needed. Rises further
        // (CENTER_SHIFT_ON_OPEN_PX, see above) in the same tween, so the fully-open stack ends up
        // vertically centered too, not just the closed one.
        .fromTo(
          cubeWrapper,
          { "--stack-gap": `${STACK_GAP_CLOSED_PX}px` },
          {
            "--stack-gap": `${STACK_GAP_OPEN_PX}px`,
            y: () => recenterY - CENTER_SHIFT_ON_OPEN_PX,
            duration: DISASSEMBLE_DURATION,
            ease: "power1.inOut",
          },
          SCALE_START + CUBE_SCALE_DURATION,
        );

      // Restores whatever scrollY was BEFORE StrictMode's dev-only churn (see the long comment
      // above `ssrScrollReserveRef.current.style.height = "0px"`) clamped it away. 100ms is
      // comfortable margin past the ~15ms the document height took to recover in testing — GSAP's
      // own scroll listener picks up the resulting scroll event and re-syncs the timeline
      // automatically, no explicit ScrollTrigger.refresh()/update() needed. A no-op in production
      // (and on any render where nothing actually got clamped), since the condition only fires
      // when scrollY has actually drifted from the captured value.
      const targetScrollY = scrollYBeforeChurnRef.current;
      if (targetScrollY !== null) {
        setTimeout(() => {
          if (window.scrollY !== targetScrollY) window.scrollTo(0, targetScrollY);
        }, 100);
      }
    },
    { scope: sectionRef },
  );
}
