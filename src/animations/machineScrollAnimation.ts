import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { BLUR_HIDDEN_FILTER, BLUR_HIDDEN_Y_PX, BLUR_VISIBLE_FILTER } from "@/components/ui/BlurText";
import { MACHINE_PIN_SCROLL_DISTANCE } from "@/lib/machineLayout";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const PIN_SCROLL_DISTANCE = MACHINE_PIN_SCROLL_DISTANCE;

// Cross marks start scaled down slightly, growing to full size as they fade in. Exported so
// MachineSectionClient.tsx's SSR-hidden inline style uses the exact same value (same sharing
// convention as BlurText.tsx's BLUR_HIDDEN_* — the server-rendered "hidden" state and this hook's
// own jumpToHidden() must match exactly, or there'd be a flash/jump on hydration).
export const CROSS_HIDDEN_SCALE = 0.6;

const HATCH_DURATION = 0.6;
const CHAR_DURATION = 0.6;
const CHAR_STAGGER = 0.04;
const CROSS_DURATION = 0.5;
const CROSS_STAGGER = 0.05;
// Reverse (blur-out, played on scrolling back up past the pin start) is quicker than the entrance
// and runs in the opposite order (crosses -> letters -> hatch) — an "unwind" of the entrance, not
// just the same tweens played backwards.
const REVERSE_DURATION = 0.3;
// onEnter firing within this window after setup (initial load, a hard refresh restoring scrollY
// already inside the pin's range, StrictMode's scroll restore) jumps straight to the finished
// state instead of playing the entrance — same convention as
// infrastructureScrollAnimation.ts's INSTANT_WINDOW_MS. Needed because GSAP can fire onEnter as
// part of a ScrollTrigger's very first refresh when the current scroll position is already past
// `start` at creation time, not only on a later real forward-scroll crossing — confirmed via a
// reload-while-scrolled-deep test (scrollY landed mid-pin, and without this guard onEnter replayed
// the full ~1.8s entrance from scratch instead of landing on the already-final state).
const INSTANT_WINDOW_MS = 250;

interface MachineScrollRefs {
  // Pin trigger AND pin target — the whole full-viewport section.
  sectionRef: RefObject<HTMLElement | null>;
  hatchRef: RefObject<HTMLElement | null>;
  // 4 cross marks, in any order (all animated together, not individually sequenced).
  crossRefs: RefObject<(HTMLElement | null)[]>;
  // Server-rendered placeholder spacer that pre-reserves PIN_SCROLL_DISTANCE worth of height
  // before any client JS runs — collapsed to 0 synchronously below, right before the real
  // pin-spacer is created. Same fix as heroScrollAnimation.ts / infrastructureScrollAnimation.ts
  // for the same already-diagnosed bug (see PROJECT.md): without it, a hard refresh while scrolled
  // past this pin restores scrollY against the shorter pre-hydration document, then destabilizes
  // once hydration grows the page underneath it.
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

// Pins the machine screen once it reaches the viewport center, holds it for PIN_SCROLL_DISTANCE
// worth of scroll (a plain hold — no scrub, nothing tied to scroll progress beyond "has the pin
// started"), and plays a one-shot triggered entrance the first time it's scrolled INTO: the hatch
// mark fades/unblurs, then "machine"'s letters blur-stagger in, then the 4 corner crosses fade in
// with a slight scale-up. Scrolling back up past the pin's start reverses the whole thing (blur
// back out); scrolling back down into it from below (i.e. from GROUP_2's direction) just shows the
// finished state directly, no replay.
export function useMachineScrollAnimation({
  sectionRef,
  hatchRef,
  crossRefs,
  ssrScrollReserveRef,
}: MachineScrollRefs) {
  // Survives React 19 StrictMode's dev-only mount -> cleanup -> remount cycle — see the matching
  // comment in heroScrollAnimation.ts's `scrollYBeforeChurnRef` for the full mechanism this works
  // around.
  const scrollYBeforeChurnRef = useRef<number | null>(null);

  useGSAP(
    (_context, contextSafe) => {
      if (scrollYBeforeChurnRef.current === null) scrollYBeforeChurnRef.current = window.scrollY;

      // Collapse the SSR placeholder before doing anything else, on every code path (including
      // prefers-reduced-motion, which never creates a real pin-spacer and so never needs this
      // reservation either).
      if (ssrScrollReserveRef.current) ssrScrollReserveRef.current.style.height = "0px";

      const section = sectionRef.current;
      const hatch = hatchRef.current;
      const chars = section?.querySelectorAll<HTMLElement>("[data-blur-char]") ?? null;
      const crosses = crossRefs.current.filter((el): el is HTMLElement => el !== null);
      if (!section || !hatch || !chars || chars.length === 0 || crosses.length === 0) return;

      const jumpToFinal = () => {
        gsap.killTweensOf([hatch, ...chars, ...crosses]);
        gsap.set(hatch, { opacity: 1, filter: BLUR_VISIBLE_FILTER, y: 0 });
        gsap.set(chars, { opacity: 1, filter: BLUR_VISIBLE_FILTER, y: 0 });
        gsap.set(crosses, { opacity: 1, scale: 1 });
      };

      const jumpToHidden = () => {
        gsap.killTweensOf([hatch, ...chars, ...crosses]);
        gsap.set(hatch, { opacity: 0, filter: BLUR_HIDDEN_FILTER, y: BLUR_HIDDEN_Y_PX });
        gsap.set(chars, { opacity: 0, filter: BLUR_HIDDEN_FILTER, y: BLUR_HIDDEN_Y_PX });
        gsap.set(crosses, { opacity: 0, scale: CROSS_HIDDEN_SCALE });
      };

      // Baseline before any ScrollTrigger exists — matches the SSR-hidden inline styles exactly
      // (see BlurText.tsx's BLUR_HIDDEN_* and MachineSectionClient.tsx's hatch/cross styles).
      jumpToHidden();

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // No pin, no motion — static, fully visible.
        jumpToFinal();
        return;
      }

      const playEntrance = contextSafe!(() => {
        gsap.killTweensOf([hatch, ...chars, ...crosses]);
        gsap
          .timeline()
          .to(hatch, { opacity: 1, filter: BLUR_VISIBLE_FILTER, y: 0, duration: HATCH_DURATION, ease: "power2.out" })
          .fromTo(
            chars,
            { opacity: 0, filter: BLUR_HIDDEN_FILTER, y: BLUR_HIDDEN_Y_PX },
            {
              opacity: 1,
              filter: BLUR_VISIBLE_FILTER,
              y: 0,
              duration: CHAR_DURATION,
              ease: "power3.out",
              stagger: CHAR_STAGGER,
            },
            ">-0.15",
          )
          .to(
            crosses,
            { opacity: 1, scale: 1, duration: CROSS_DURATION, ease: "power2.out", stagger: CROSS_STAGGER },
            ">-0.1",
          );
      });

      const playReverse = contextSafe!(() => {
        gsap.killTweensOf([hatch, ...chars, ...crosses]);
        gsap
          .timeline()
          .to(crosses, { opacity: 0, scale: CROSS_HIDDEN_SCALE, duration: REVERSE_DURATION, ease: "power2.in" })
          .to(
            chars,
            {
              opacity: 0,
              filter: BLUR_HIDDEN_FILTER,
              y: BLUR_HIDDEN_Y_PX,
              duration: REVERSE_DURATION,
              ease: "power2.in",
              stagger: 0.02,
            },
            "<0.05",
          )
          .to(
            hatch,
            { opacity: 0, filter: BLUR_HIDDEN_FILTER, y: BLUR_HIDDEN_Y_PX, duration: REVERSE_DURATION, ease: "power2.in" },
            "<0.05",
          );
      });

      const instantUntil = performance.now() + INSTANT_WINDOW_MS;

      ScrollTrigger.create({
        trigger: section,
        start: "center center",
        end: `+=${PIN_SCROLL_DISTANCE}`,
        pin: true,
        // GSAP disables automatic pin-spacing by default when the pinned element's parent is
        // display:flex — our <main class="flex flex-1 flex-col"> layout, same as
        // heroScrollAnimation.ts's pin (this section is pinned directly, not via an inner card
        // like InfrastructureSection's, so this one actually needs it, not just as insurance).
        pinSpacing: true,
        invalidateOnRefresh: true,
        // Guarded by INSTANT_WINDOW_MS — see its comment for why onEnter can fire during initial
        // setup (not just a later real scroll-crossing) when already positioned inside the pin.
        onEnter: () => (performance.now() < instantUntil ? jumpToFinal() : playEntrance()),
        // Scrolled up into this section from GROUP_2's direction (i.e. re-entering from below,
        // past the pin's end) — the "chapter title" was already seen going forward, so just show
        // it, no replay.
        onEnterBack: () => jumpToFinal(),
        // Scrolled back up out of the pin (past its start, back toward GROUP_1) — unwind the
        // entrance instead of just snapping away. Same instant-window guard: a churn/refresh that
        // lands us above the start shouldn't play a ~0.9s reverse for a state the user never saw.
        onLeaveBack: () => (performance.now() < instantUntil ? jumpToHidden() : playReverse()),
        // Initial load/resize: if we're already scrolled past the start (e.g. a hard refresh deep
        // in the page, or a resize recalculating positions after the pin already fired once), land
        // directly on the finished state instead of replaying the entrance from scratch. Redundant
        // with the onEnter guard above in most cases, but also covers loading already scrolled
        // PAST the whole pin range (progress at/near 1 without necessarily crossing onEnter).
        onRefresh: (self) => (self.progress > 0 ? jumpToFinal() : jumpToHidden()),
      });

      // Restores whatever scrollY was BEFORE StrictMode's dev-only churn clamped it away — see the
      // identical, already-diagnosed mechanism in heroScrollAnimation.ts.
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
