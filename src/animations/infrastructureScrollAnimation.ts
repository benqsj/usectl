import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { HEADER_HEIGHT_PX } from "@/lib/grid";
import { INFRASTRUCTURE_PIN_SCROLL_DISTANCE } from "@/lib/infrastructureLayout";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const PIN_SCROLL_DISTANCE = INFRASTRUCTURE_PIN_SCROLL_DISTANCE;

// Relative GSAP-timeline time units, not px — PIN_SCROLL_DISTANCE is what maps the WHOLE timeline
// (however many units long it ends up being) onto real scroll pixels, so only the ratio between
// these two matters for pacing feel, not their absolute values. Mirrors the hold/duration style of
// heroScrollAnimation.ts's own constants (tune live against the real page, not meant to be exact
// on the first try).
const STEP_HOLD_DURATION = 1;
const STEP_FADE_DURATION = 0.5;
// How far the outgoing step rises while fading (incoming step falls the same distance while
// fading in) — same "rise while fading" style as heroScrollAnimation.ts's TEXT_RISE_PX, just a
// smaller nudge since this text is shorter/denser than the hero's single big headline.
const TEXT_RISE_PX = 40;

interface InfrastructureScrollRefs {
  // Pin trigger AND pin target — the card div, not the outer <section>, so the section's own
  // bottom padding isn't included in what gets centered/pinned (see the "center center+=" start
  // below).
  cardRef: RefObject<HTMLDivElement | null>;
  fillRef: RefObject<HTMLDivElement | null>;
  // One entry per step in INFRASTRUCTURE_STEPS_GROUP_1, in order — all stacked in the same grid
  // cell (see InfrastructureSectionClient.tsx), crossfaded between by this hook.
  stepRefs: RefObject<(HTMLDivElement | null)[]>;
  // Server-rendered placeholder spacer that pre-reserves PIN_SCROLL_DISTANCE worth of height
  // before any client JS runs — see the long comment where this is collapsed, below. Mirrors
  // heroScrollAnimation.ts's identical fix for an identical, already-diagnosed bug (see
  // PROJECT.md): without it, a hard refresh while scrolled past this pin restores scrollY against
  // the shorter pre-hydration document, then destabilizes once hydration grows the page underneath
  // it.
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

// Pins the card once it's vertically centered in the space below the sticky header (equal gap to
// the header's bottom edge and to the viewport's bottom edge), holds the page still for
// PIN_SCROLL_DISTANCE worth of scroll while a single timeline drives BOTH the 4-step
// eyebrow/heading/paragraph crossfade AND the static bar's green fill (same progress value, one
// ScrollTrigger — not two independently-scrubbed ones), then releases and lets the page continue
// scrolling normally.
export function useInfrastructureScrollAnimation({
  cardRef,
  fillRef,
  stepRefs,
  ssrScrollReserveRef,
}: InfrastructureScrollRefs) {
  // Survives React 19 StrictMode's dev-only mount -> cleanup -> remount cycle (a plain `let`
  // inside the useGSAP callback would not) — see the matching comment in heroScrollAnimation.ts's
  // `scrollYBeforeChurnRef` for the full mechanism this works around.
  const scrollYBeforeChurnRef = useRef<number | null>(null);

  useGSAP(
    () => {
      if (scrollYBeforeChurnRef.current === null) scrollYBeforeChurnRef.current = window.scrollY;

      // Collapse the SSR placeholder before doing anything else, on every code path (including
      // prefers-reduced-motion, which never creates a real pin-spacer and so never needs this
      // reservation either) — otherwise either the placeholder lingers forever, or it and the real
      // pin-spacer both reserve space at once, double-counting.
      if (ssrScrollReserveRef.current) ssrScrollReserveRef.current.style.height = "0px";

      const steps = stepRefs.current.filter((el): el is HTMLDivElement => el !== null);
      if (!cardRef.current || !fillRef.current || steps.length === 0) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // No pin, no motion — land directly on the fully-filled bar and the first step visible
        // (matches where the pinned sequence would have ended up, minus the animation).
        gsap.set(fillRef.current, { clipPath: "inset(0% 0% 0% 0%)" });
        gsap.set(steps, { autoAlpha: 0, y: 0 });
        gsap.set(steps[0], { autoAlpha: 1 });
        return;
      }

      gsap.set(fillRef.current, { clipPath: "inset(0% 100% 0% 0%)" });
      gsap.set(steps, { autoAlpha: 0, y: 0 });
      gsap.set(steps[0], { autoAlpha: 1 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: cardRef.current,
          // Header is a fixed HEADER_HEIGHT_PX tall, so "centered in the space below it" sits
          // HEADER_HEIGHT_PX/2 below the viewport's true geometric center.
          start: `center center+=${HEADER_HEIGHT_PX / 2}`,
          end: `+=${PIN_SCROLL_DISTANCE}`,
          scrub: true,
          pin: true,
          // GSAP disables automatic pin-spacing by default when the pinned element's parent is
          // display:flex — not the case here (the card's parent is a plain <section>), but forced
          // on anyway for the same reason as heroScrollAnimation.ts: cheap, and guards against this
          // ever silently no-op'ing if the surrounding markup changes later.
          pinSpacing: true,
          invalidateOnRefresh: true,
        },
      });

      // Step 0 holds from t=0; each subsequent step's crossfade-in starts STEP_HOLD_DURATION after
      // the previous step's crossfade finished, so every step (including the last) gets an equal
      // STEP_HOLD_DURATION of "just sitting there readable" time.
      let t = STEP_HOLD_DURATION;
      for (let i = 0; i < steps.length - 1; i++) {
        tl.to(steps[i], { autoAlpha: 0, y: -TEXT_RISE_PX, duration: STEP_FADE_DURATION, ease: "power1.out" }, t);
        tl.fromTo(
          steps[i + 1],
          { autoAlpha: 0, y: TEXT_RISE_PX },
          { autoAlpha: 1, y: 0, duration: STEP_FADE_DURATION, ease: "power1.out" },
          t,
        );
        t += STEP_FADE_DURATION + STEP_HOLD_DURATION;
      }
      const totalDuration = t; // after the loop, t sits exactly at the end of the last step's hold

      // Bar fill spans the WHOLE timeline (not per-step) — same progress value driving the text
      // crossfade above also drives this, continuously, so it reads as "0 -> fully filled across
      // the whole 4-step sequence" rather than 4 discrete jumps.
      tl.fromTo(
        fillRef.current,
        { clipPath: "inset(0% 100% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: totalDuration, ease: "none" },
        0,
      );

      // Restores whatever scrollY was BEFORE StrictMode's dev-only churn clamped it away — see the
      // identical, already-diagnosed mechanism in heroScrollAnimation.ts. 100ms is comfortable
      // margin past the ~15ms the document height took to recover in testing there.
      const targetScrollY = scrollYBeforeChurnRef.current;
      if (targetScrollY !== null) {
        setTimeout(() => {
          if (window.scrollY !== targetScrollY) window.scrollTo(0, targetScrollY);
        }, 100);
      }
    },
    { scope: cardRef },
  );
}
