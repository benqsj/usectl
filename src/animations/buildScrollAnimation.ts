import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { HERO_STACK_GAP_CLOSED_PX, HERO_STACK_GAP_OPEN_PX } from "@/lib/heroLayers";
import { BUILD_PIN_SCROLL_DISTANCE } from "@/lib/buildLayout";
import type { HeroServerModelHandle } from "@/components/sections/HeroServerModel";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// BuildSection's server starts OPEN (exploded) and closes as the section stays pinned in place —
// the reverse of the hero's own open-on-scroll sequence, reusing the SAME HeroServerModel verbatim
// (just a much smaller wrapper width — see buildLayout.ts) per explicit request.
//
// Rewritten 2026-09-18 (2nd pass) to actually PIN the section: the first version was a plain,
// unpinned scrub as the section scrolled through the viewport, but the user wanted the opposite of
// that — the server shouldn't travel down the page at all, it should come up close to the text and
// the whole section (heading, paragraph, buttons, AND the open server) should fit in ONE screen,
// closing while the page holds still. That's exactly what a pin is for. Because this now creates a
// real pin-spacer, it needs the same refresh-safety pair every other pinned section in this project
// carries (see heroScrollAnimation.ts for the original, fully-diagnosed bug both of these guard
// against): `ssrScrollReserveRef` (server-rendered placeholder so the pre-hydration and hydrated page
// heights match) and `scrollYBeforeChurnRef` (restores scrollY if React 19 StrictMode's dev-only
// effect churn clamps it away).
const STACK_GAP_CLOSED_PX = HERO_STACK_GAP_CLOSED_PX;
const STACK_GAP_OPEN_PX = HERO_STACK_GAP_OPEN_PX;

// HeroServerModel keeps the model's own visual center fixed regardless of open/closed progress (see
// its own `setProgress` — "kept centred on screen"), so closing alone doesn't move it. Per explicit
// request, the wrapper itself also rises as it closes — an extra translateY on top of that, purely
// cosmetic (the model's internal centering is unaffected), tuned live like every other px constant
// in this file. Dialed back from 120 → 40 once, because a pure `transform` doesn't shrink the
// wrapper's own LAYOUT box, so a bigger lift only left more empty space below it once settled.
//
// Raised again to 160 on 2026-09-18 ("ძაან დიდი დაშორება არის როცა server.svg იხურება") — but this
// time the lift is paired with an equal negative margin-bottom, applied off the same progress, so
// the wrapper's layout box shrinks by exactly what the transform takes away. That's what makes a
// big lift safe now: the closed server ends up much closer to the copy above it WITHOUT leaving the
// hole underneath that forced the earlier climb-down.
const LIFT_ON_CLOSE_PX = 160;

interface BuildScrollRefs {
  sectionRef: RefObject<HTMLElement | null>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  modelRef: RefObject<HeroServerModelHandle | null>;
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

export function useBuildScrollAnimation({ sectionRef, wrapperRef, modelRef, ssrScrollReserveRef }: BuildScrollRefs) {
  const scrollYBeforeChurnRef = useRef<number | null>(null);

  useGSAP(
    () => {
      if (scrollYBeforeChurnRef.current === null) scrollYBeforeChurnRef.current = window.scrollY;

      // Collapse the SSR placeholder before anything else — see the matching comment in
      // heroScrollAnimation.ts / infrastructureScrollAnimation.ts for why this has to run on every
      // code path, including prefers-reduced-motion below (which never creates a real pin-spacer).
      if (ssrScrollReserveRef.current) ssrScrollReserveRef.current.style.height = "0px";

      const section = sectionRef.current;
      const wrapper = wrapperRef.current;
      if (!section || !wrapper) return;

      // Pure function of scroll progress (0 = open, 1 = closed) — freezes wherever scroll stops,
      // reverses cleanly, same convention every other continuous scrub in this project uses.
      const applyCloseProgress = (closeProgress: number) => {
        const clamped = gsap.utils.clamp(0, 1, closeProgress);
        gsap.set(wrapper, {
          "--stack-gap": `${gsap.utils.interpolate(STACK_GAP_OPEN_PX, STACK_GAP_CLOSED_PX, clamped)}px`,
          y: -LIFT_ON_CLOSE_PX * clamped,
          // Takes the lift out of the layout too, so nothing is left holding the space the server
          // just vacated (see LIFT_ON_CLOSE_PX).
          marginBottom: -LIFT_ON_CLOSE_PX * clamped,
        });
        modelRef.current?.setProgress(1 - clamped);
      };

      applyCloseProgress(0);

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        applyCloseProgress(1);
        return;
      }

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: `+=${BUILD_PIN_SCROLL_DISTANCE}`,
        scrub: true,
        pin: true,
        // GSAP disables automatic pin-spacing by default when the pinned element's parent is
        // display:flex (this page's <main class="flex flex-1 flex-col">) — force it on, same fix
        // every other pin in this project needs.
        pinSpacing: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => applyCloseProgress(self.progress),
        onRefresh: (self) => applyCloseProgress(self.progress),
        // Real bug, found via measurement (getBoundingClientRect on the closed wrapper vs. Footer's
        // own top) — not a guess: GSAP measures the pin-spacer's reserved height ONCE, from the
        // section's rendered size at setup time, while `--stack-gap` is still at its OPEN (tall)
        // value. That reservation never shrinks on its own once the cube closes via scroll — closing
        // only changes the wrapper's own CSS var, it doesn't trigger GSAP to re-measure — so a large
        // "phantom" gap (roughly the open/closed height difference) was left between the settled,
        // closed cube and whatever follows (Footer), even though visually nothing was still reserving
        // that space for a reason. Fixed by refreshing once the pin fully releases (closed), so the
        // spacer re-measures against the now-shorter content. Deferred one frame so the DOM has
        // settled from the same tick's `applyCloseProgress(1)` first.
        onLeave: () => {
          applyCloseProgress(1);
          requestAnimationFrame(() => ScrollTrigger.refresh());
        },
        onLeaveBack: () => applyCloseProgress(0),
      });

      // Restores whatever scrollY was BEFORE StrictMode's dev-only churn clamped it away — same
      // mechanism as heroScrollAnimation.ts / infrastructureScrollAnimation.ts.
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
