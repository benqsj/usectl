import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { HEADER_HEIGHT_PX } from "@/lib/grid";
import { INFRASTRUCTURE_PIN_SCROLL_DISTANCE } from "@/lib/infrastructureLayout";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const PIN_SCROLL_DISTANCE = INFRASTRUCTURE_PIN_SCROLL_DISTANCE;

interface InfrastructureScrollRefs {
  cardRef: RefObject<HTMLDivElement | null>;
  fillRef: RefObject<HTMLDivElement | null>;
  // Server-rendered placeholder spacer that pre-reserves PIN_SCROLL_DISTANCE worth of height
  // before any client JS runs — see the long comment where this is collapsed, below. Mirrors
  // heroScrollAnimation.ts's identical fix for an identical bug (see PROJECT.md for the original,
  // hard-diagnosed repro): without it, a hard refresh while scrolled past this pin restores
  // scrollY against the shorter pre-hydration document, then destabilizes once hydration grows
  // the page underneath it.
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

// Pins the card once it's vertically centered in the space below the sticky header (equal gap to
// the header's bottom edge and to the viewport's bottom edge), holds the page still for
// PIN_SCROLL_DISTANCE worth of scroll while the static bar's green fill scrubs in, then releases
// and lets the page continue scrolling normally.
export function useInfrastructureScrollAnimation({
  cardRef,
  fillRef,
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
      if (!cardRef.current || !fillRef.current) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(fillRef.current, { clipPath: "inset(0% 0% 0% 0%)" });
        return;
      }

      gsap.set(fillRef.current, { clipPath: "inset(0% 100% 0% 0%)" });

      gsap.to(fillRef.current, {
        clipPath: "inset(0% 0% 0% 0%)",
        ease: "none",
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
