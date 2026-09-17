import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  HERO_PIN_SCROLL_DISTANCE,
  HERO_STACK_GAP_CLOSED_PX,
  HERO_STACK_GAP_OPEN_PX,
} from "@/lib/heroLayers";
import { HERO_CORE_HEIGHT_RATIO } from "@/lib/heroModel";
import type { HeroServerModelHandle } from "@/components/sections/HeroServerModel";

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
const CORE_HEIGHT_NARROW_PX = 400 * HERO_CORE_HEIGHT_RATIO;
const CORE_HEIGHT_WIDE_PX = 480 * HERO_CORE_HEIGHT_RATIO;
const WIDE_BREAKPOINT_PX = 1800;

// Extra nudge above true viewport-center — user asked to raise it further after the initial
// centering fix. Applies to both the closed and open positions (baked into recenterY below).
const EXTRA_RISE_PX = 0;

interface HeroScrollRefs {
  sectionRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  cubeWrapperRef: RefObject<HTMLDivElement | null>;
  // The 3D server. Null until the GLB has parsed; the timeline simply skips it until then, and
  // HeroSectionClient calls ScrollTrigger.refresh() once it's ready so the scrub re-applies.
  modelRef: RefObject<HeroServerModelHandle | null>;
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
      // stays stuck at the clamped value permanently.
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

      // Proxies whose only job is to carry a scrubbed number: `disassemble.t` drives the model,
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
        //    stack) and `disassemble.t`, which scrubs the GLB's explode_sequence clip. No
        //    re-centring tween is needed any more: the model keeps itself centred as it opens
        //    (see HeroServerModel.setProgress), which is what the old CENTER_SHIFT_ON_OPEN_PX
        //    offset on this tween used to do by hand.
        .fromTo(
          cubeWrapper,
          { "--stack-gap": `${STACK_GAP_CLOSED_PX}px` },
          {
            "--stack-gap": `${STACK_GAP_OPEN_PX}px`,
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
