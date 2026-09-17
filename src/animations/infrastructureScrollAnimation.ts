import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { HEADER_HEIGHT_PX } from "@/lib/grid";
import { createStepSwap } from "@/animations/stepSwap";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// --- Step swap: TRIGGERED, time-based (matches the approved server-layers demo) ----------------
// Only "which step is active" follows scroll: the pinned range is split into `stepCount` equal
// slices, and crossing into a new slice starts fixed-duration tweens (text blur-stagger + server
// layer switch) that play out on their own, even if scrolling stops mid-way. The bar fill is the
// only thing scrubbed 1:1 with scroll. (A fully scrubbed version was tried 2026-09-17; the user
// preferred this one: scrubbed text froze half-blurred when scrolling stopped, and felt too fast.)
// The text half of the swap lives in stepSwap.ts, shared with the machine screen's own pin
// (steps 3-8), so the two sequences can't drift apart.

// Server timings — exactly the demo's values (seconds).
const SERVER_LIT_IN = { duration: 0.7, delay: 0.1 };
const SERVER_LIT_OUT = { duration: 0.45 };
const SERVER_FLASH = { from: "brightness(1.7) blur(3px)", to: "brightness(1) blur(0px)", duration: 0.9 };
// Small "pop" on the part that just lit up.
const SERVER_BUMP_PX = 10;

// The server opens together WITH the step swap (per user: the separation and the switch should
// happen at the same moment), so it's a triggered tween like everything else — not scrubbed.
const SERVER_OPEN_DURATION = 0.8;

// Which server part is lit on a step: bottom first, then top (bottom-up).
const SERVER_PART_ORDER = ["bottom", "top"] as const;

interface InfrastructureScrollRefs {
  // false when something else drives this card (the machine screen owns steps 3-8) — the hook then
  // does nothing, since React hooks can't be called conditionally.
  enabled: boolean;
  // Pin trigger AND pin target — the card div, not the outer <section>, so the section's own
  // bottom padding isn't included in what gets centered/pinned (see the "center center+=" start
  // below).
  cardRef: RefObject<HTMLDivElement | null>;
  fillRef: RefObject<HTMLDivElement | null>;
  // Server wrapper (children: `[data-server-part="bottom|top"]`, each with a `[data-server-lit]`
  // variant). Empty when the section has no server.
  serverRef: RefObject<HTMLDivElement | null>;
  // How far the bottom part moves down when the server opens, in % of the part's own height
  // (0 = no server).
  serverOpenOffsetPercent: number;
  pinScrollDistance: number;
  // Number of steps rendered (BlurText elements carry `data-step` 0..stepCount-1 and
  // `data-field` eyebrow|heading|paragraph — see InfrastructureSectionClient.tsx).
  stepCount: number;
  // Server-rendered placeholder spacer that pre-reserves `pinScrollDistance` worth of height
  // before any client JS runs — see the long comment where this is collapsed, below. Mirrors
  // heroScrollAnimation.ts's identical fix for an identical, already-diagnosed bug (see
  // PROJECT.md): without it, a hard refresh while scrolled past this pin restores scrollY against
  // the shorter pre-hydration document, then destabilizes once hydration grows the page underneath
  // it.
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

// Pins the card once it's vertically centered in the space below the sticky header, holds the
// page still for `pinScrollDistance` worth of scroll, and on the SAME ScrollTrigger: scrubs the
// static bar's green fill (and, with a server, the server opening), and triggers the step swap
// (text + lit server part) whenever progress crosses into a new step. Then releases and lets the
// page continue scrolling normally.
export function useInfrastructureScrollAnimation({
  enabled,
  cardRef,
  fillRef,
  serverRef,
  serverOpenOffsetPercent,
  pinScrollDistance,
  stepCount,
  ssrScrollReserveRef,
}: InfrastructureScrollRefs) {
  // Survives React 19 StrictMode's dev-only mount -> cleanup -> remount cycle (a plain `let`
  // inside the useGSAP callback would not) — see the matching comment in heroScrollAnimation.ts's
  // `scrollYBeforeChurnRef` for the full mechanism this works around.
  const scrollYBeforeChurnRef = useRef<number | null>(null);

  useGSAP(
    (_context, contextSafe) => {
      // Embedded card (steps 3-8 inside the machine screen): something else owns the scroll, so
      // this hook must not create a pin of its own. Checked FIRST — before the SSR spacer is
      // collapsed or any ScrollTrigger is built.
      if (!enabled) return;

      if (scrollYBeforeChurnRef.current === null) scrollYBeforeChurnRef.current = window.scrollY;

      // Collapse the SSR placeholder before doing anything else, on every code path (including
      // prefers-reduced-motion, which never creates a real pin-spacer and so never needs this
      // reservation either) — otherwise either the placeholder lingers forever, or it and the real
      // pin-spacer both reserve space at once, double-counting.
      if (ssrScrollReserveRef.current) ssrScrollReserveRef.current.style.height = "0px";

      const card = cardRef.current;
      const fill = fillRef.current;
      if (!card || !fill || stepCount === 0) return;

      const text = createStepSwap(card);

      // --- server helpers (no-ops when the section has no server) ---
      const hasServer = serverOpenOffsetPercent > 0;
      const serverPart = (name: string) =>
        serverRef.current?.querySelector<HTMLElement>(`[data-server-part="${name}"]`) ?? null;
      const parts = SERVER_PART_ORDER.map((name) => {
        const el = serverPart(name);
        return { el, lit: el?.querySelector<HTMLElement>("[data-server-lit]") ?? null };
      });
      const partEls = parts.flatMap((p) => (p.el ? [p.el] : []));
      const litEls = parts.flatMap((p) => (p.lit ? [p.lit] : []));
      const bottomPart = parts[0].el;
      const activePart = (step: number) => step % SERVER_PART_ORDER.length;

      // The server is closed on step 1 and open from step 2 on.
      const openPercentFor = (step: number) => (step >= 1 ? serverOpenOffsetPercent : 0);

      const stepAt = (progress: number) => Math.min(stepCount - 1, Math.floor(progress * stepCount));

      // Lands on `step` with no motion (initial mount, refresh/resize, reduced motion).
      const jumpToStep = (step: number) => {
        gsap.killTweensOf([...partEls, ...litEls]);
        text.jumpToStep(step);

        parts.forEach((p, i) => {
          if (p.lit) gsap.set(p.lit, { opacity: i === activePart(step) ? 1 : 0, filter: "none" });
          if (p.el) gsap.set(p.el, { y: 0 });
        });
        if (bottomPart) gsap.set(bottomPart, { yPercent: openPercentFor(step) });
      };

      jumpToStep(0);

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // No pin, no motion — land directly on the fully-filled bar and the first step visible
        // (matches where the pinned sequence would have ended up, minus the animation).
        gsap.set(fill, { clipPath: "inset(0% 0% 0% 0%)" });
        return;
      }

      gsap.set(fill, { clipPath: "inset(0% 100% 0% 0%)" });

      const animateServer = (to: number) => {
        if (!hasServer) return;
        const active = activePart(to);
        parts.forEach((p, i) => {
          if (!p.lit) return;
          gsap.killTweensOf(p.lit);
          gsap.to(
            p.lit,
            i === active
              ? { opacity: 1, duration: SERVER_LIT_IN.duration, delay: SERVER_LIT_IN.delay, ease: "power2.out" }
              : { opacity: 0, duration: SERVER_LIT_OUT.duration, ease: "power2.in" },
          );
        });
        const { el, lit } = parts[active];
        if (lit) {
          gsap.fromTo(
            lit,
            { filter: SERVER_FLASH.from },
            { filter: SERVER_FLASH.to, duration: SERVER_FLASH.duration, ease: "power2.out" },
          );
        }
        // Opening (the parts moving apart) runs in the same tween batch as the lighting swap.
        if (bottomPart) {
          gsap.killTweensOf(bottomPart, "yPercent");
          gsap.to(bottomPart, {
            yPercent: openPercentFor(to),
            duration: SERVER_OPEN_DURATION,
            ease: "power3.out",
          });
        }
        if (el) {
          gsap.killTweensOf(el, "y");
          gsap
            .timeline()
            .to(el, { y: -SERVER_BUMP_PX, duration: 0.3, ease: "power2.out" })
            .to(el, { y: 0, duration: 0.8, ease: "power3.out" });
        }
      };

      const animateToStep = (to: number, from: number) => {
        text.animateToStep(to, from);
        animateServer(to); // server switches together with the text
      };

      let currentStep = 0;
      // contextSafe: these tweens are created later from ScrollTrigger callbacks, outside the
      // useGSAP callback — wrapping them registers them with the context so unmount reverts them.
      const syncToProgress = contextSafe!((progress: number, instant: boolean) => {
        const next = stepAt(progress);
        if (instant) {
          jumpToStep(next);
        } else if (next !== currentStep) {
          animateToStep(next, currentStep);
        }
        currentStep = next;
      });

      // Scroll-restore / StrictMode churn right after mount should land instantly, not animate.
      const instantUntil = performance.now() + 250;

      gsap
        .timeline({
          scrollTrigger: {
            trigger: card,
            // Header is a fixed HEADER_HEIGHT_PX tall, so "centered in the space below it" sits
            // HEADER_HEIGHT_PX/2 below the viewport's true geometric center.
            start: `center center+=${HEADER_HEIGHT_PX / 2}`,
            end: `+=${pinScrollDistance}`,
            scrub: true,
            pin: true,
            // GSAP disables automatic pin-spacing by default when the pinned element's parent is
            // display:flex — not the case here (the card's parent is a plain <section>), but forced
            // on anyway for the same reason as heroScrollAnimation.ts: cheap, and guards against
            // this ever silently no-op'ing if the surrounding markup changes later.
            pinSpacing: true,
            invalidateOnRefresh: true,
            onUpdate: (self) => syncToProgress(self.progress, performance.now() < instantUntil),
            // Resize / initial refresh: land on the right step instantly.
            onRefresh: (self) => syncToProgress(self.progress, true),
          },
        })
        // Bar fill spans the WHOLE pinned range, scrubbed continuously — reads as "0 -> fully
        // filled across the whole step sequence" rather than discrete jumps.
        .fromTo(fill, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none" });

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
    { scope: cardRef, dependencies: [enabled, stepCount, pinScrollDistance, serverOpenOffsetPercent] },
  );
}
