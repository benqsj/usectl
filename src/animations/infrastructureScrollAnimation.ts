import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { HEADER_HEIGHT_PX } from "@/lib/grid";
import { INFRASTRUCTURE_PIN_SCROLL_DISTANCE } from "@/lib/infrastructureLayout";
import { activeServerLayer, serverLayerOffset } from "@/lib/serverLayerSteps";
import { BLUR_HIDDEN_FILTER, BLUR_HIDDEN_Y_PX, BLUR_VISIBLE_FILTER } from "@/components/ui/BlurText";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const PIN_SCROLL_DISTANCE = INFRASTRUCTURE_PIN_SCROLL_DISTANCE;

// --- Step swap: TRIGGERED, time-based (matches the approved server-layers demo) ----------------
// Only "which step is active" follows scroll: the pinned range is split into `stepCount` equal
// slices, and crossing into a new slice starts fixed-duration tweens (text blur-stagger + server
// layer switch) that play out on their own, even if scrolling stops mid-way. The bar fill is the
// only thing scrubbed 1:1 with scroll. (A fully scrubbed version was tried 2026-09-17; the user
// preferred this one: scrubbed text froze half-blurred when scrolling stopped, and felt too fast.)
const FIELDS = ["eyebrow", "heading", "paragraph"] as const;
type Field = (typeof FIELDS)[number];

const HIDDEN = { opacity: 0, filter: BLUR_HIDDEN_FILTER, y: BLUR_HIDDEN_Y_PX };
const VISIBLE = { opacity: 1, filter: BLUR_VISIBLE_FILTER, y: 0 };

// Text timings — exactly the demo's values (seconds).
const TEXT_OUT = { duration: 0.3, stagger: 0.004, blur: "blur(10px)" };
const TEXT_IN_DURATION = 0.65;
const FIELD_IN: Record<Field, { stagger: number; delay: number }> = {
  eyebrow: { stagger: 0.03, delay: 0.1 },
  heading: { stagger: 0.06, delay: 0.15 },
  paragraph: { stagger: 0.012, delay: 0.3 },
};

// Server timings — exactly the demo's values (seconds).
const SERVER_LIT_IN = { duration: 0.7, delay: 0.1 };
const SERVER_LIT_OUT = { duration: 0.45 };
const SERVER_MOVE_DURATION = 0.8;
const SERVER_FLASH = { from: "brightness(1.7) blur(3px)", to: "brightness(1) blur(0px)", duration: 0.9 };

interface InfrastructureScrollRefs {
  // Pin trigger AND pin target — the card div, not the outer <section>, so the section's own
  // bottom padding isn't included in what gets centered/pinned (see the "center center+=" start
  // below).
  cardRef: RefObject<HTMLDivElement | null>;
  fillRef: RefObject<HTMLDivElement | null>;
  // Layered server wrapper (children: `[data-server-layer]`, each with a `[data-server-lit]`
  // variant) + the green halo that follows the lit layer.
  serverRef: RefObject<HTMLDivElement | null>;
  haloRef: RefObject<HTMLSpanElement | null>;
  // Number of steps rendered (BlurText elements carry `data-step` 0..stepCount-1 and
  // `data-field` eyebrow|heading|paragraph — see InfrastructureSectionClient.tsx).
  stepCount: number;
  // Server-rendered placeholder spacer that pre-reserves PIN_SCROLL_DISTANCE worth of height
  // before any client JS runs — see the long comment where this is collapsed, below. Mirrors
  // heroScrollAnimation.ts's identical fix for an identical, already-diagnosed bug (see
  // PROJECT.md): without it, a hard refresh while scrolled past this pin restores scrollY against
  // the shorter pre-hydration document, then destabilizes once hydration grows the page underneath
  // it.
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

// Pins the card once it's vertically centered in the space below the sticky header, holds the
// page still for PIN_SCROLL_DISTANCE worth of scroll, and on the SAME ScrollTrigger: scrubs the
// static bar's green fill, and triggers the step swap (text + server) whenever progress crosses
// into a new step slice. Then releases and lets the page continue scrolling normally.
export function useInfrastructureScrollAnimation({
  cardRef,
  fillRef,
  serverRef,
  haloRef,
  stepCount,
  ssrScrollReserveRef,
}: InfrastructureScrollRefs) {
  // Survives React 19 StrictMode's dev-only mount -> cleanup -> remount cycle (a plain `let`
  // inside the useGSAP callback would not) — see the matching comment in heroScrollAnimation.ts's
  // `scrollYBeforeChurnRef` for the full mechanism this works around.
  const scrollYBeforeChurnRef = useRef<number | null>(null);

  useGSAP(
    (_context, contextSafe) => {
      if (scrollYBeforeChurnRef.current === null) scrollYBeforeChurnRef.current = window.scrollY;

      // Collapse the SSR placeholder before doing anything else, on every code path (including
      // prefers-reduced-motion, which never creates a real pin-spacer and so never needs this
      // reservation either) — otherwise either the placeholder lingers forever, or it and the real
      // pin-spacer both reserve space at once, double-counting.
      if (ssrScrollReserveRef.current) ssrScrollReserveRef.current.style.height = "0px";

      const card = cardRef.current;
      const fill = fillRef.current;
      if (!card || !fill || stepCount === 0) return;

      // --- text helpers ---
      const fieldEl = (step: number, field: Field) =>
        card.querySelector<HTMLElement>(`[data-step="${step}"][data-field="${field}"]`);
      const wordsOf = (step: number, field: Field) =>
        Array.from(fieldEl(step, field)?.querySelectorAll<HTMLElement>("[data-blur-word]") ?? []);
      const allWords = card.querySelectorAll<HTMLElement>("[data-blur-word]");

      const setAriaActive = (active: number) => {
        card.querySelectorAll<HTMLElement>("[data-step]").forEach((el) => {
          el.setAttribute("aria-hidden", String(Number(el.dataset.step) !== active));
        });
      };

      // --- server helpers ---
      const serverLayers = Array.from(serverRef.current?.querySelectorAll<HTMLElement>("[data-server-layer]") ?? []);
      const serverLit = serverLayers
        .map((layer) => layer.querySelector<HTMLElement>("[data-server-lit]"))
        .filter((el): el is HTMLElement => el !== null);
      // Layer pitch / height in px (CSS-var driven, differs per breakpoint) — re-measured on refresh.
      const haloY = (active: number) => {
        const gap = serverLayers[1]?.offsetTop ?? 0;
        const height = serverLayers[serverLayers.length - 1]?.offsetHeight ?? 0;
        return active * gap + height * 0.3;
      };

      // Lands on `step` with no motion (initial mount, refresh/resize, reduced motion).
      const jumpToStep = (step: number) => {
        gsap.killTweensOf([...allWords, ...serverLayers, ...serverLit]);
        if (haloRef.current) gsap.killTweensOf(haloRef.current);

        gsap.set(allWords, HIDDEN);
        for (const field of FIELDS) gsap.set(wordsOf(step, field), VISIBLE);
        setAriaActive(step);

        const active = activeServerLayer(step);
        serverLayers.forEach((layer, i) => gsap.set(layer, { y: serverLayerOffset(active, i) }));
        serverLit.forEach((lit, i) => gsap.set(lit, { opacity: i === active ? 1 : 0, filter: "none" }));
        if (haloRef.current) gsap.set(haloRef.current, { y: haloY(active) });
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
        const active = activeServerLayer(to);
        serverLayers.forEach((layer, i) => {
          const lit = serverLit[i];
          const on = i === active;
          gsap.killTweensOf([layer, lit]);
          gsap.to(
            lit,
            on
              ? { opacity: 1, duration: SERVER_LIT_IN.duration, delay: SERVER_LIT_IN.delay, ease: "power2.out" }
              : { opacity: 0, duration: SERVER_LIT_OUT.duration, ease: "power2.in" },
          );
          gsap.to(layer, { y: serverLayerOffset(active, i), duration: SERVER_MOVE_DURATION, ease: "power3.out" });
        });
        if (haloRef.current) {
          gsap.killTweensOf(haloRef.current);
          gsap.to(haloRef.current, { y: haloY(active), duration: SERVER_MOVE_DURATION, ease: "power3.out" });
        }
        // Quick flash on the newly lit layer.
        gsap.fromTo(
          serverLit[active],
          { filter: SERVER_FLASH.from },
          { filter: SERVER_FLASH.to, duration: SERVER_FLASH.duration, ease: "power2.out" },
        );
      };

      const animateToStep = (to: number, from: number) => {
        for (const field of FIELDS) {
          const outWords = wordsOf(from, field);
          const inWords = wordsOf(to, field);
          gsap.killTweensOf([...outWords, ...inWords]);

          // Same text in both steps (shared eyebrow, steps 3+4 / 7+8): they render identically in
          // the same spot, so swap without motion — re-animating identical copy reads as a glitch.
          if (fieldEl(from, field)?.textContent === fieldEl(to, field)?.textContent) {
            gsap.set(outWords, HIDDEN);
            gsap.set(inWords, VISIBLE);
            continue;
          }

          gsap.to(outWords, {
            opacity: 0,
            filter: TEXT_OUT.blur,
            duration: TEXT_OUT.duration,
            stagger: TEXT_OUT.stagger,
          });
          gsap.fromTo(inWords, HIDDEN, {
            ...VISIBLE,
            duration: TEXT_IN_DURATION,
            ease: "power3.out",
            stagger: FIELD_IN[field].stagger,
            delay: FIELD_IN[field].delay,
          });
        }
        setAriaActive(to);
        animateServer(to); // server switches together with the text
      };

      let currentStep = 0;
      // contextSafe: these tweens are created later from ScrollTrigger callbacks, outside the
      // useGSAP callback — wrapping them registers them with the context so unmount reverts them.
      const syncToProgress = contextSafe!((progress: number, instant: boolean) => {
        const next = Math.min(stepCount - 1, Math.floor(progress * stepCount));
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
            end: `+=${PIN_SCROLL_DISTANCE}`,
            scrub: true,
            pin: true,
            // GSAP disables automatic pin-spacing by default when the pinned element's parent is
            // display:flex — not the case here (the card's parent is a plain <section>), but forced
            // on anyway for the same reason as heroScrollAnimation.ts: cheap, and guards against
            // this ever silently no-op'ing if the surrounding markup changes later.
            pinSpacing: true,
            invalidateOnRefresh: true,
            onUpdate: (self) => syncToProgress(self.progress, performance.now() < instantUntil),
            // Resize / initial refresh: land on the right step (and re-measure the halo) instantly.
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
    { scope: cardRef, dependencies: [stepCount] },
  );
}
