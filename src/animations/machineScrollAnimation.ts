import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { MACHINE_PHASES, MACHINE_PIN_SCROLL_DISTANCE } from "@/lib/machineLayout";
import { createStepSwap } from "@/animations/stepSwap";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const PIN_SCROLL_DISTANCE = MACHINE_PIN_SCROLL_DISTANCE;
const P = MACHINE_PHASES;

// Cross marks start scaled down slightly, growing to full size as they fade in. Exported so
// MachineSectionClient.tsx's SSR-hidden inline style uses the exact same value.
export const CROSS_HIDDEN_SCALE = 0.6;
// topside.svg's own start/base scale (it fades in at the base, then grows from there).
export const TOPSIDE_HIDDEN_SCALE = 0.5;
const TOPSIDE_BASE_SCALE = 0.75;
// How much bigger it gets by the time we're through it. Capped deliberately: every new scale makes
// the browser re-rasterise the plate, and past ~10x that costs real frames for no visible gain
// (the plate's edges are long off-screen by then).
const TOPSIDE_MAX_SCALE = 9;

// --- wordmark: SCRUBBED (per user) -------------------------------------------------------------
// The "machine" entrance follows scroll frame by frame instead of playing out on its own: stop
// scrolling and it stops too. Everything below is a pure function of the pin's progress.
// Windows as fractions of that progress: reveal, then (later) the fade-out under the growing plate.
const WORD_REVEALED_AT = 0.1; // fully revealed by here (reveal starts at MACHINE_PHASES.wordIn)
const WORD_GONE_AT = 0.2; // fully gone by here (fade-out starts at MACHINE_PHASES.wordOut)
const CHAR_STAGGER_SPAN = 0.55; // how much of the reveal window the per-character stagger spans
const WORD_HIDDEN_BLUR_PX = 12;
const WORD_HIDDEN_Y_PX = 8;

// Standard "stagger normalised into a fixed window": the last item still reaches 1 at t=1.
const staggerProgress = (t: number, index: number, count: number, span: number) => {
  if (count <= 1) return gsap.utils.clamp(0, 1, t);
  const step = span / (count - 1);
  return gsap.utils.clamp(0, 1, (t - index * step) / (1 - span));
};

// The hatch opening: a rounded square (the plate's own inner panel shape) as a static mask image.
// Only its SIZE animates — mask-composite:exclude punches it out of the plate.
const HOLE_SHAPE = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="2" y="2" width="96" height="96" rx="18" fill="#000"/></svg>',
)}")`;
const HOLE_MASK_IMAGE = `linear-gradient(#000,#000), ${HOLE_SHAPE}`;
// as a % of the plate's own box
const HOLE_MAX_PERCENT = 80;
// The hatch opens ALONGSIDE the growth but well behind it: it only starts once the plate is
// already growing, and its curve is much flatter, so the two finish together. (A "plate first,
// then the hatch" variant was tried 2026-09-18 and rejected — this pacing is the approved one.)
const HOLE_START_AT = 0.12; // fraction of the zoom window before the hatch starts opening at all
const HOLE_CURVE = 2.6; // >1 = the opening lags further behind the growth

const clamp01 = (v: number) => gsap.utils.clamp(0, 1, v);
const easeIO = gsap.parseEase("power2.inOut");
const easeOut = gsap.parseEase("power3.out");
const easeCardIn = gsap.parseEase("power1.out");

// The card shows up once the hatch is P.cardAtHole open — derived from the hole curve (hole = t²)
// rather than hardcoded, so it stays correct if the zoom range is retimed.
// hole as a function of the growth's own progress `t`
const holeAt = (t: number) => Math.pow(clamp01((t - HOLE_START_AT) / (1 - HOLE_START_AT)), HOLE_CURVE);
const zoomTimeAtHole = (hole: number) => HOLE_START_AT + Math.pow(hole, 1 / HOLE_CURVE) * (1 - HOLE_START_AT);
// the card shows up once the hatch is P.cardAtHole open — inverse of the curve above
const CARD_START = P.zoomStart + zoomTimeAtHole(P.cardAtHole) * (P.zoomEnd - P.zoomStart);

interface MachineScrollRefs {
  // Pin trigger AND pin target — the whole full-viewport screen.
  sectionRef: RefObject<HTMLElement | null>;
  // Wrapper around hatch + wordmark + crosses.
  wordmarkRef: RefObject<HTMLElement | null>;
  hatchRef: RefObject<HTMLElement | null>;
  crossRefs: RefObject<(HTMLElement | null)[]>;
  // topside.svg — grows, and its middle opens, as we fly through it.
  topsideRef: RefObject<HTMLElement | null>;
  // Light green wash right after we're inside; fades out before the content has arrived.
  tintRef: RefObject<HTMLElement | null>;
  // The steps 3-8 card, rendered INSIDE this pinned screen (no page scroll in between): it comes
  // towards the viewer out of the depth and then stays put while the steps change.
  cardRef: RefObject<HTMLElement | null>;
  // The card's static-bar green fill (clipped left-to-right across the six steps).
  fillRef: RefObject<HTMLElement | null>;
  stepCount: number;
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

// ONE pin for the whole "machine" sequence (per the approved demo):
//   wordmark entrance (triggered)
//   -> topside fades in ON TOP of it and starts growing the moment the wordmark starts leaving
//   -> the growth never pauses; the hatch opens alongside it, just slower (hole = t²), so both
//      finish together and we end up through the opening (all scrubbed)
//   -> at 90% open the steps 3-8 card is already there, small and far away, and scroll flies us
//      towards it until it sits at full size (scrubbed)
//   -> then the six steps swap their text (triggered, same as everywhere else) while the static
//      bar fills (scrubbed).
export function useMachineScrollAnimation({
  sectionRef,
  wordmarkRef,
  hatchRef,
  crossRefs,
  topsideRef,
  tintRef,
  cardRef,
  fillRef,
  stepCount,
  ssrScrollReserveRef,
}: MachineScrollRefs) {
  // Survives React 19 StrictMode's dev-only mount -> cleanup -> remount cycle — see the matching
  // comment in heroScrollAnimation.ts.
  const scrollYBeforeChurnRef = useRef<number | null>(null);

  useGSAP(
    (_context, contextSafe) => {
      if (scrollYBeforeChurnRef.current === null) scrollYBeforeChurnRef.current = window.scrollY;

      // Collapse the SSR placeholder before anything else, on every code path (including
      // prefers-reduced-motion, which never creates a real pin-spacer).
      if (ssrScrollReserveRef.current) ssrScrollReserveRef.current.style.height = "0px";

      const section = sectionRef.current;
      const wordmark = wordmarkRef.current;
      const hatch = hatchRef.current;
      const topside = topsideRef.current;
      const tint = tintRef.current;
      const card = cardRef.current;
      const fill = fillRef.current;
      const chars = section ? Array.from(section.querySelectorAll<HTMLElement>("[data-blur-char]")) : [];
      const crosses = crossRefs.current.filter((el): el is HTMLElement => el !== null);
      if (!section || !wordmark || !hatch || !topside || !card || !fill || chars.length === 0) return;

      const steps = createStepSwap(card);

      // Pure function of scroll progress — reveal (staggered per character), then fade-out as the
      // plate takes over. Nothing here plays on its own, so stopping the scroll stops the motion.
      const applyWordmark = (progress: number) => {
        const reveal = clamp01((progress - P.wordIn) / (WORD_REVEALED_AT - P.wordIn));
        const exit = clamp01((progress - P.wordOut) / (WORD_GONE_AT - P.wordOut));

        const hatchIn = easeOut(clamp01(reveal / 0.35));
        gsap.set(hatch, {
          opacity: hatchIn,
          filter: `blur(${(1 - hatchIn) * WORD_HIDDEN_BLUR_PX}px)`,
          y: (1 - hatchIn) * WORD_HIDDEN_Y_PX,
        });
        chars.forEach((char, i) => {
          const v = easeOut(staggerProgress(reveal, i, chars.length, CHAR_STAGGER_SPAN));
          gsap.set(char, {
            opacity: v,
            filter: `blur(${(1 - v) * WORD_HIDDEN_BLUR_PX}px)`,
            y: (1 - v) * WORD_HIDDEN_Y_PX,
          });
        });
        const crossIn = easeOut(clamp01((reveal - 0.55) / 0.45));
        gsap.set(crosses, { opacity: crossIn, scale: CROSS_HIDDEN_SCALE + (1 - CROSS_HIDDEN_SCALE) * crossIn });

        gsap.set(wordmark, {
          opacity: 1 - exit,
          filter: exit > 0 ? `blur(${exit * WORD_HIDDEN_BLUR_PX}px)` : "none",
        });
      };

      applyWordmark(0);
      gsap.set(topside, { opacity: 0, scale: TOPSIDE_HIDDEN_SCALE });
      gsap.set(card, { opacity: 0, scale: 0.52 });
      if (tint) gsap.set(tint, { opacity: 0 });
      steps.jumpToStep(0);

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // No pin, no motion: the wordmark and the content are simply there, the plate is not.
        applyWordmark(WORD_REVEALED_AT);
        gsap.set(topside, { opacity: 0 });
        gsap.set(card, { opacity: 1, scale: 1, filter: "none" });
        gsap.set(fill, { clipPath: "inset(0% 0% 0% 0%)" });
        return;
      }

      gsap.set(fill, { clipPath: "inset(0% 100% 0% 0%)" });

      let currentStep = 0;
      const instantUntil = performance.now() + 250;

      const applyProgress = contextSafe!((progress: number, forceInstant: boolean) => {
        const instant = forceInstant || performance.now() < instantUntil;

        // 1) wordmark — scrubbed
        applyWordmark(progress);

        // 2+3) topside: fades in over the wordmark, then ONE continuous exponential ramp (constant
        // "speed towards you", no plateau) while its hatch opens on a slower, squared curve.
        const fadeIn = clamp01((progress - P.plateIn) / (P.plateFull - P.plateIn));
        const t = clamp01((progress - P.zoomStart) / (P.zoomEnd - P.zoomStart));
        const scale = TOPSIDE_BASE_SCALE * Math.pow(TOPSIDE_MAX_SCALE / TOPSIDE_BASE_SCALE, Math.pow(t, 1.6));
        const holePercent = holeAt(t) * HOLE_MAX_PERCENT;
        gsap.set(topside, {
          opacity: fadeIn * (1 - clamp01((t - 0.93) / 0.07)),
          scale,
          webkitMaskImage: HOLE_MASK_IMAGE,
          maskImage: HOLE_MASK_IMAGE,
          webkitMaskSize: `100% 100%, ${holePercent}% ${holePercent}%`,
          maskSize: `100% 100%, ${holePercent}% ${holePercent}%`,
        });

        // 4) the card: already there when the hatch is ~90% open, then flown towards, slowly
        const approachRaw = clamp01((progress - CARD_START) / (P.cardEnd - CARD_START));
        const approach = easeCardIn(approachRaw);
        // blur only while it's still small — a blur filter on a full-size card is expensive
        const cardBlur = Math.max(0, 1 - approachRaw * 3) * 10;
        gsap.set(card, {
          opacity: Math.min(1, approachRaw * 4),
          scale: 0.52 + 0.48 * approach,
          force3D: true,
          filter: cardBlur > 0.15 ? `blur(${cardBlur.toFixed(2)}px)` : "none",
        });
        if (tint) {
          gsap.set(tint, {
            opacity:
              progress <= P.zoomStart
                ? 0
                : (1 - gsap.parseEase("power1.in")(clamp01(approachRaw / 0.85))) * easeIO(clamp01((t - 0.3) / 0.4)),
          });
        }

        // 5) the six steps, inside
        gsap.set(fill, { clipPath: `inset(0% ${100 - 100 * clamp01((progress - P.cardEnd) / (1 - P.cardEnd))}% 0% 0%)` });
        const nextStep = Math.min(
          stepCount - 1,
          Math.max(0, Math.floor(((progress - P.cardEnd) / (1 - P.cardEnd)) * stepCount)),
        );
        if (nextStep !== currentStep || instant) {
          if (instant) steps.jumpToStep(nextStep);
          else if (nextStep !== currentStep) steps.animateToStep(nextStep, currentStep);
          currentStep = nextStep;
        }
      });

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: `+=${PIN_SCROLL_DISTANCE}`,
        scrub: true,
        pin: true,
        pinSpacing: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => applyProgress(self.progress, false),
        onRefresh: (self) => applyProgress(self.progress, true),
        // onUpdate only fires INSIDE the pinned range, so the scene has to be put straight when
        // scroll leaves it either way — otherwise a refresh that happened while scrolled past
        // leaves a stale step showing once you come back.
        onLeave: () => applyProgress(1, true),
        onLeaveBack: () => applyProgress(0, true),
      });

      // Restores whatever scrollY was BEFORE StrictMode's dev-only churn clamped it away — same
      // mechanism as heroScrollAnimation.ts.
      const targetScrollY = scrollYBeforeChurnRef.current;
      if (targetScrollY !== null) {
        setTimeout(() => {
          if (window.scrollY !== targetScrollY) window.scrollTo(0, targetScrollY);
        }, 100);
      }
    },
    { scope: sectionRef, dependencies: [stepCount] },
  );
}
