import type { RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Wrapper scales up this much once the text has cleared out (spec: ~1.15-1.3x).
const CUBE_SCALE_TARGET = 1.2;
// How far the text rises as it fades, instead of dissolving in place.
const TEXT_RISE_PX = 60;
// Extra scroll distance (px) the pin holds the section for while the timeline scrubs.
const PIN_SCROLL_DISTANCE = 2200;

const TEXT_FADE_DURATION = 1;
const CUBE_SCALE_DURATION = 1.6;
// The rest of the scroll: the layer stack pulls apart.
const DISASSEMBLE_DURATION = 2.8;

// Starting point for the closed/open vertical gap between stacked layers — tune live against a
// server-cube.png screenshot (see PROJECT.md), not meant to be exact on the first try.
const STACK_GAP_CLOSED_PX = 45;
const STACK_GAP_OPEN_PX = 140;

interface HeroScrollRefs {
  sectionRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  cubeWrapperRef: RefObject<HTMLDivElement | null>;
}

export function useHeroScrollAnimation({ sectionRef, contentRef, cubeWrapperRef }: HeroScrollRefs) {
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!sectionRef.current || !contentRef.current || !cubeWrapperRef.current) return;

      const cubeWrapper = cubeWrapperRef.current;

      // How far to shift the wrapper vertically so it lands centered in the viewport once scaled
      // up. Measured only at well-defined "clean" moments (initial setup, and refreshInit — which
      // GSAP guarantees fires after reverting all ScrollTrigger-driven transforms back to their
      // pre-animation state) rather than inside the tween's own function-based value: measuring
      // there instead was found to sometimes read the wrapper's ALREADY-transformed position
      // (e.g. after a large instant scroll jump), compounding a stale offset on top of a new one
      // and driving the wrapper thousands of pixels off-screen.
      let recenterY = 0;
      const measureRecenterY = () => {
        const rect = cubeWrapper.getBoundingClientRect();
        const naturalCenterY = rect.top + rect.height / 2;
        recenterY = window.innerHeight / 2 - naturalCenterY;
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
        // 2. The instant the text is gone, the layer stack starts enlarging and re-centering.
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
          TEXT_FADE_DURATION,
        )
        // 3. The instant that finishes, the stack pulls apart — a single CSS custom property
        // (--stack-gap) animates from tight/closed to wide/open; each layer's own `top:
        // calc(index * var(--stack-gap))` (set in HeroSectionClient.tsx) does the rest, so this is
        // a real per-layer disassembly with no per-layer GSAP targeting needed.
        .fromTo(
          cubeWrapper,
          { "--stack-gap": `${STACK_GAP_CLOSED_PX}px` },
          { "--stack-gap": `${STACK_GAP_OPEN_PX}px`, duration: DISASSEMBLE_DURATION, ease: "power1.inOut" },
          TEXT_FADE_DURATION + CUBE_SCALE_DURATION,
        );
    },
    { scope: sectionRef },
  );
}
