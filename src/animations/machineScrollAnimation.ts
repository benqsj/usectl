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
// onEnter/onLeaveBack firing within this window after setup (initial load, a hard refresh
// restoring scrollY already inside the pin's range, StrictMode's scroll restore) jump straight to
// the finished/hidden state instead of playing a triggered tween. Needed because GSAP can fire
// these as part of a ScrollTrigger's very first refresh when the current scroll position is
// already past the relevant boundary at creation time, not only on a later real scroll crossing —
// confirmed via a reload-while-scrolled-deep test (see PROJECT.md).
const INSTANT_WINDOW_MS = 250;

// --- Whole sequence, one pin: wordmark entrance -> topside entrance -> (scrubbed) wordmark exit
// + topside grow, all sharing the SAME pinned stage/centered point --------------------------
// The first two are TRIGGERED (one-shot, time-based) — a partially-blurred word or a
// partially-faded-in topside both read fine as "still arriving", so there's no strong reason to
// scrub them, and the project's own prior experience with InfrastructureSection's text swap found
// triggered entrances feel better than scrubbed ones. The LAST phase (wordmark fading out while
// topside grows) is explicitly SCRUBBED, per instruction: growth must track scroll exactly and
// freeze the instant scrolling stops — unlike a half-blurred word, a partially-grown/partially-
// faded image never reads as "broken", so scrubbing here doesn't have the problem that got the
// text swap's own scrub reverted elsewhere.
//
// Phase boundaries are fractions of the pin's overall scroll progress (0-1), not px — tune live.
const TOPSIDE_ENTER_AT = 0.45; // progress at which topside's fade-in-at-base-scale triggers
const EXIT_GROW_START = 0.6; // progress at which the scrubbed wordmark-fade-out/topside-grow begins

const TOPSIDE_ENTER_DURATION = 0.7;

// Hidden (not yet entered) -> base (just faded in) -> end (fully grown, wordmark long gone).
export const TOPSIDE_HIDDEN_SCALE = 0.5;
const TOPSIDE_BASE_SCALE = 0.75;
const TOPSIDE_END_SCALE = 1.3;

interface MachineScrollRefs {
  // Pin trigger AND pin target — the whole full-viewport section.
  sectionRef: RefObject<HTMLElement | null>;
  // Wrapper around hatch+wordmark+crosses as a group — faded/blurred out as a whole during the
  // exit phase (the individual hatch/crosses refs below are only needed for the entrance, which
  // animates them with their own distinct stagger/timing).
  wordmarkRef: RefObject<HTMLElement | null>;
  hatchRef: RefObject<HTMLElement | null>;
  // 4 cross marks, in any order (all animated together, not individually sequenced).
  crossRefs: RefObject<(HTMLElement | null)[]>;
  topsideRef: RefObject<HTMLElement | null>;
  // Server-rendered placeholder spacer that pre-reserves PIN_SCROLL_DISTANCE worth of height
  // before any client JS runs — collapsed to 0 synchronously below, right before the real
  // pin-spacer is created. Same fix as heroScrollAnimation.ts / infrastructureScrollAnimation.ts
  // for the same already-diagnosed bug (see PROJECT.md): without it, a hard refresh while scrolled
  // past this pin restores scrollY against the shorter pre-hydration document, then destabilizes
  // once hydration grows the page underneath it.
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

// Pins the machine screen once it reaches the viewport center, holds it for PIN_SCROLL_DISTANCE
// worth of scroll, and plays through one continuous sequence: the hatch mark fades/unblurs, then
// "machine"'s letters blur-stagger in, then the 4 corner crosses fade in with a slight scale-up
// (all triggered, together "the wordmark entrance") — then, once scroll crosses TOPSIDE_ENTER_AT,
// topside.svg fades in at its own base scale in the SAME centered spot (also triggered) — then,
// from EXIT_GROW_START to the end of the pin, the wordmark fades/blurs away while topside.svg
// grows further, both tied directly to scroll progress (freezes if scrolling stops, reverses
// smoothly on scrolling back). Scrolling back up out of the pin entirely unwinds everything;
// re-entering from below (the steps 3-8 section's direction) snaps straight to the fully-finished state.
export function useMachineScrollAnimation({
  sectionRef,
  wordmarkRef,
  hatchRef,
  crossRefs,
  topsideRef,
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
      const wordmark = wordmarkRef.current;
      const hatch = hatchRef.current;
      const topside = topsideRef.current;
      const chars = section?.querySelectorAll<HTMLElement>("[data-blur-char]") ?? null;
      const crosses = crossRefs.current.filter((el): el is HTMLElement => el !== null);
      if (!section || !wordmark || !hatch || !topside || !chars || chars.length === 0 || crosses.length === 0) {
        return;
      }

      const jumpWordmarkToFinal = () => {
        gsap.killTweensOf([hatch, ...chars, ...crosses]);
        gsap.set(hatch, { opacity: 1, filter: BLUR_VISIBLE_FILTER, y: 0 });
        gsap.set(chars, { opacity: 1, filter: BLUR_VISIBLE_FILTER, y: 0 });
        gsap.set(crosses, { opacity: 1, scale: 1 });
      };

      const jumpWordmarkToHidden = () => {
        gsap.killTweensOf([hatch, ...chars, ...crosses]);
        gsap.set(hatch, { opacity: 0, filter: BLUR_HIDDEN_FILTER, y: BLUR_HIDDEN_Y_PX });
        gsap.set(chars, { opacity: 0, filter: BLUR_HIDDEN_FILTER, y: BLUR_HIDDEN_Y_PX });
        gsap.set(crosses, { opacity: 0, scale: CROSS_HIDDEN_SCALE });
      };

      // Baseline before any ScrollTrigger exists — matches the SSR-hidden inline styles exactly
      // (see BlurText.tsx's BLUR_HIDDEN_* and MachineSectionClient.tsx's hatch/cross/topside
      // styles).
      jumpWordmarkToHidden();
      gsap.set(wordmark, { opacity: 1, filter: BLUR_VISIBLE_FILTER });
      gsap.set(topside, { opacity: 0, scale: TOPSIDE_HIDDEN_SCALE });

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
        // No pin, no motion — land directly on the SEQUENCE'S END state: wordmark long gone,
        // topside fully grown (matches where continued scrolling would have ended up).
        jumpWordmarkToFinal();
        gsap.set(wordmark, { opacity: 0, filter: BLUR_HIDDEN_FILTER });
        gsap.set(topside, { opacity: 1, scale: TOPSIDE_END_SCALE });
        return;
      }

      const playWordmarkEntrance = contextSafe!(() => {
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

      const playWordmarkReverse = contextSafe!(() => {
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

      const playTopsideEnter = contextSafe!(() => {
        gsap.killTweensOf(topside);
        gsap.to(topside, { opacity: 1, scale: TOPSIDE_BASE_SCALE, duration: TOPSIDE_ENTER_DURATION, ease: "power2.out" });
      });

      const playTopsideLeave = contextSafe!(() => {
        gsap.killTweensOf(topside);
        gsap.to(topside, {
          opacity: 0,
          scale: TOPSIDE_HIDDEN_SCALE,
          duration: TOPSIDE_ENTER_DURATION * 0.6,
          ease: "power2.in",
        });
      });

      const instantUntil = performance.now() + INSTANT_WINDOW_MS;
      let topsideEntered = false;

      // The exit+grow phase is a pure function of progress — no tween, just gsap.set every
      // frame — so it's automatically frame-accurate (freezes exactly where scroll stops) and
      // correct at any progress value with no separate "instant" handling needed (unlike the two
      // triggered entrances above, this can't get caught "mid-flight" by a refresh).
      const applyExitGrow = (progress: number) => {
        if (progress < EXIT_GROW_START) {
          gsap.set(wordmark, { opacity: 1, filter: BLUR_VISIBLE_FILTER });
          if (topsideEntered) gsap.set(topside, { scale: TOPSIDE_BASE_SCALE });
          return;
        }
        const t = gsap.utils.clamp(0, 1, (progress - EXIT_GROW_START) / (1 - EXIT_GROW_START));
        // Real bug, caught while verifying: if scroll reaches EXIT_GROW_START while
        // playTopsideEnter's 0.7s tween is still ticking, GSAP's own ticker re-applies that
        // tween's interpolated scale on every subsequent frame, silently overwriting this
        // gsap.set() call — topside would visibly freeze at TOPSIDE_BASE_SCALE regardless of
        // further scroll. Killing any in-flight tween on `topside` before setting it here (only
        // once we're actually past EXIT_GROW_START, so a legitimately-still-playing entrance
        // isn't cut short before that point) hands control to the scrub cleanly. That kill also
        // cancels the entrance tween's OWN opacity animation (killTweensOf stops every property
        // it was driving, not just scale) — a second bug this surfaced: if killed mid-fade,
        // opacity would freeze part-way instead of landing on 1. Setting it explicitly below
        // fixes that; topside is always meant to be fully opaque by this point regardless of
        // whether its entrance tween had actually finished on its own.
        gsap.killTweensOf(topside);
        gsap.set(wordmark, { opacity: 1 - t, filter: `blur(${t * 12}px)` });
        gsap.set(topside, { opacity: 1, scale: TOPSIDE_BASE_SCALE + t * (TOPSIDE_END_SCALE - TOPSIDE_BASE_SCALE) });
      };

      const handleUpdate = (progress: number, instant: boolean) => {
        if (progress >= TOPSIDE_ENTER_AT && !topsideEntered) {
          topsideEntered = true;
          if (instant) gsap.set(topside, { opacity: 1, scale: TOPSIDE_BASE_SCALE });
          else playTopsideEnter();
        } else if (progress < TOPSIDE_ENTER_AT && topsideEntered) {
          topsideEntered = false;
          if (instant) gsap.set(topside, { opacity: 0, scale: TOPSIDE_HIDDEN_SCALE });
          else playTopsideLeave();
        }
        applyExitGrow(progress);
      };

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
        onEnter: () => (performance.now() < instantUntil ? jumpWordmarkToFinal() : playWordmarkEntrance()),
        // Re-entering from below (the steps 3-8 section's direction, past the pin's end) — the whole sequence
        // was already seen going forward, so just show its true end state, no replay.
        onEnterBack: () => {
          topsideEntered = true;
          jumpWordmarkToFinal();
          gsap.set(wordmark, { opacity: 0, filter: BLUR_HIDDEN_FILTER });
          gsap.set(topside, { opacity: 1, scale: TOPSIDE_END_SCALE });
        },
        // Scrolled back up out of the pin (past its start, back toward the intro steps) — unwind
        // everything, not just the wordmark entrance.
        onLeaveBack: () => {
          topsideEntered = false;
          if (performance.now() < instantUntil) {
            jumpWordmarkToHidden();
            gsap.set(wordmark, { opacity: 1, filter: BLUR_VISIBLE_FILTER });
            gsap.set(topside, { opacity: 0, scale: TOPSIDE_HIDDEN_SCALE });
          } else {
            playWordmarkReverse();
            gsap.set(wordmark, { opacity: 1, filter: BLUR_VISIBLE_FILTER });
            playTopsideLeave();
          }
        },
        onUpdate: (self) => handleUpdate(self.progress, false),
        // Initial load/resize: land on the exact right frame for the current progress without
        // replaying triggered entrances from scratch.
        onRefresh: (self) => handleUpdate(self.progress, true),
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
