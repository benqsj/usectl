import type { RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  HERO_PIN_SCROLL_DISTANCE,
  HERO_STACK_GAP_CLOSED_PX,
  HERO_STACK_GAP_OPEN_PX,
} from "@/lib/heroLayers";
import { HERO_CORE_HEIGHT_RATIO } from "@/lib/heroModel";
import { readScale } from "@/lib/grid";
import type { HeroMachineHandle } from "@/components/sections/HeroMachineSvg";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Wrapper scales up this much once the text has cleared out. Reduced 1.2 -> 1.08 -> 1.04 across
// two rounds of feedback — kept reading as enlarging too much each time.
const CUBE_SCALE_TARGET = 1.04;
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
// The layer stack pulls apart. Shortened from an initial 2.8 alongside an earlier
// PIN_SCROLL_DISTANCE cut — unrelated to the CUBE_SCALE_DURATION doubling above.
const DISASSEMBLE_DURATION = 1.8;
// Dead time at the END of the timeline, with the server sitting fully open: the pin keeps holding
// for this much more scroll before it releases and InfrastructureSection starts coming up, so the
// finished exploded view gets a beat of its own instead of being pushed off the moment it lands.
// 1.2 units == 280px at the timeline's 233.33px-per-unit. PIN_SCROLL_DISTANCE already includes it
// (4.2 units -> 5.4), which is why every earlier phase still needs the same scroll it always did.
const HOLD_OPEN_DURATION = 1.2;

// Starting point for the closed/open vertical gap between stacked layers. The SVG does its own
// separation (HeroMachineSvg.setProgress, scrubbed below); --stack-gap is still animated
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

interface HeroScrollRefs {
  sectionRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  cubeWrapperRef: RefObject<HTMLDivElement | null>;
  // The layered server SVG (HeroMachineSvg) — setProgress(0..1) opens it.
  modelRef: RefObject<HeroMachineHandle | null>;
  // Server-rendered placeholder spacer that pre-reserves PIN_SCROLL_DISTANCE worth of height
  // before any client JS runs — see the long comment where this is collapsed, below.
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

export function useHeroScrollAnimation({
  sectionRef,
  contentRef,
  cubeWrapperRef,
  modelRef,
  ssrScrollReserveRef,
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
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
        recenterY = window.innerHeight / 2 - EXTRA_RISE_PX - naturalCenterY;
      };
      measureRecenterY();

      // Assigned further down (it needs `tl` and `disassemble`), but referenced by the
      // ScrollTrigger's own onRefresh below — which fires on creation too, hence the nullable
      // holder rather than a direct reference.
      let syncModelOnRefresh: (() => void) | null = null;

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
          onRefreshInit: measureRecenterY,
          // BuildSection calls the page-wide ScrollTrigger.refresh(), which (with
          // invalidateOnRefresh) resets this timeline's animated values — re-assert the server's
          // pose from the trigger's progress every time, whoever fired the refresh.
          onRefresh: () => syncModelOnRefresh?.(),
        },
      });

      // Proxies whose only job is to carry a scrubbed number: `disassemble.t` drives the server SVG,
      // `hold.t` exists purely to give the timeline its trailing dead time.
      const disassemble = { t: 0 };
      const hold = { t: 0 };

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
        )
        // 3. The instant that finishes, the server pulls apart. Two tweens run together here:
        //    --stack-gap (so the wrapper's document height grows exactly as it did with the SVG
        //    stack) and `disassemble.t`, which moves the SVG's layers apart. No re-centring
        //    tween is needed: HeroMachineSvg.setProgress keeps the stack centred as it opens.
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

      // Re-asserts the server's pose from the timeline. Called from onRefresh: any page-wide
      // ScrollTrigger.refresh() (BuildSection issues some) reverts this timeline's animated values
      // because of invalidateOnRefresh, and nothing else would put the layers back until the next
      // scroll. Reads `disassemble.t` directly because GSAP skips onUpdate when progress is unchanged.
      const syncModelToTimeline = () => {
        const st = tl.scrollTrigger;
        if (st) tl.progress(st.progress);
        modelRef.current?.setProgress(disassemble.t);
      };
      syncModelOnRefresh = syncModelToTimeline;
      // The SVG is server-rendered at its closed pose; put it straight into the pose the current
      // scroll position calls for (e.g. after a refresh mid-scroll).
      syncModelToTimeline();
    },
    { scope: sectionRef },
  );
}
