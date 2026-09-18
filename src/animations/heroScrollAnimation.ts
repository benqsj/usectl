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
  // The 3D server. Null until the GLB has parsed; the timeline simply skips it until then.
  modelRef: RefObject<HeroServerModelHandle | null>;
  // Filled in with a resync function once the timeline exists; HeroSectionClient.tsx calls it from
  // HeroServerModel's `onReady` the instant the GLB finishes loading, so the model's very first
  // rendered frame already matches the current scroll position instead of popping from closed.
  modelSyncRef: RefObject<(() => void) | null>;
  // Server-rendered placeholder spacer that pre-reserves PIN_SCROLL_DISTANCE worth of height
  // before any client JS runs — see the long comment where this is collapsed, below.
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

export function useHeroScrollAnimation({
  sectionRef,
  contentRef,
  cubeWrapperRef,
  modelRef,
  modelSyncRef,
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
      };
      modelSyncRef.current = () => {
        syncModelToTimeline();
        requestAnimationFrame(syncModelToTimeline);
        setTimeout(syncModelToTimeline, 300);
      };
    },
    { scope: sectionRef },
  );
}
