import type { RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

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
const PIN_SCROLL_DISTANCE = 980;

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
const EXTRA_RISE_PX = 120;

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
    },
    { scope: sectionRef },
  );
}
