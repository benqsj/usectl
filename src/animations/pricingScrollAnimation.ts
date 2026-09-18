import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { readScale } from "@/lib/grid";
import {
  PRICING_ROWS,
  PRICING_PIN_SCROLL_DISTANCE,
  buildPressSequence,
  formatDetail,
  formatRowPrice,
  computeTotal,
  formatTotal,
} from "@/lib/pricingLayout";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Pin the card, hold it while the user keeps scrolling, and "press" the +/- buttons on their own —
// one press per SEQUENCE entry — as scroll crosses each of the pin's equal slices (same triggered,
// stepped pattern infrastructureScrollAnimation.ts converged on: only WHICH step is active follows
// scroll; each button-press's own little animation plays out on its own once triggered). Scrolling
// back up un-presses in reverse order. The user can ALSO click +/- directly at any time — both
// paths go through the same `adjustRow` (see below), clamped to each row's true min/max rather than
// the scripted `target`, so a manual click never gets silently overwritten/clamped back down by a
// later auto-press.
const SEQUENCE = buildPressSequence(PRICING_ROWS);

const PRESS_DOWN_SCALE = 0.85;
const PRESS_DOWN_DURATION = 0.12;
const PRESS_UP_DURATION = 0.2;
const POP_SCALE = 1.2;
const POP_DURATION = 0.3;
const DISABLED_OPACITY = "0.3";

interface PricingScrollRefs {
  cardRef: RefObject<HTMLDivElement | null>;
  qtyRefs: RefObject<(HTMLElement | null)[]>;
  detailRefs: RefObject<(HTMLElement | null)[]>;
  priceRefs: RefObject<(HTMLElement | null)[]>;
  plusRefs: RefObject<(HTMLElement | null)[]>;
  minusRefs: RefObject<(HTMLElement | null)[]>;
  totalRef: RefObject<HTMLElement | null>;
  // The green line.svg layer, stacked on top of a permanent gray line-gray.svg base — its opacity
  // is a PURE function of raw scroll progress (0 = fully gray, 1 = fully green), scrubbed
  // continuously (not stepped, unlike the qty/price stepper above), per explicit request: the
  // connector should start looking like the other (gray) lines and gradually colorize as you scroll.
  lineGreenRef: RefObject<HTMLElement | null>;
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

export function usePricingScrollAnimation({
  cardRef,
  qtyRefs,
  detailRefs,
  priceRefs,
  plusRefs,
  minusRefs,
  totalRef,
  lineGreenRef,
  ssrScrollReserveRef,
}: PricingScrollRefs) {
  // Manual +/- clicks are wired as plain React onClick handlers in JSX (so React owns their
  // lifecycle), but the logic that actually moves a row lives inside the useGSAP effect below
  // (it needs the same `qty`/`render`/`press`/`pop` closures the scroll sequence uses, so both
  // paths can never drift). This ref is the bridge: the effect fills it in once mounted, JSX calls
  // through it.
  const pressRowRef = useRef<(rowIndex: number, direction: 1 | -1) => void>(() => {});

  useGSAP(
    (_context, contextSafe) => {
      // Collapse the SSR placeholder before anything else — see the matching comment in
      // infrastructureScrollAnimation.ts for why this has to happen on every code path.
      if (ssrScrollReserveRef.current) ssrScrollReserveRef.current.style.height = "0px";

      const card = cardRef.current;
      const total = totalRef.current;
      if (!card || !total) return;

      const qty = PRICING_ROWS.map((row) => row.start);

      const allAnimatedEls = () => [
        ...qtyRefs.current,
        ...priceRefs.current,
        ...plusRefs.current,
        ...minusRefs.current,
        total,
      ];

      const render = () => {
        PRICING_ROWS.forEach((row, i) => {
          const qtyEl = qtyRefs.current[i];
          const detailEl = detailRefs.current[i];
          const priceEl = priceRefs.current[i];
          if (qtyEl) qtyEl.textContent = String(qty[i]);
          if (detailEl) detailEl.textContent = formatDetail(qty[i], row);
          if (priceEl) priceEl.textContent = formatRowPrice(qty[i], row.rate);

          const plusEl = plusRefs.current[i];
          const minusEl = minusRefs.current[i];
          if (plusEl) plusEl.style.opacity = qty[i] >= row.max ? DISABLED_OPACITY : "1";
          if (minusEl) minusEl.style.opacity = qty[i] <= row.min ? DISABLED_OPACITY : "1";
        });
        total.textContent = formatTotal(computeTotal(qty, PRICING_ROWS));
      };

      const pop = contextSafe!((el: HTMLElement | null) => {
        if (!el) return;
        gsap.killTweensOf(el);
        gsap.fromTo(el, { scale: POP_SCALE }, { scale: 1, duration: POP_DURATION, ease: "back.out(3)" });
      });

      const press = contextSafe!((el: HTMLElement | null) => {
        if (!el) return;
        gsap.killTweensOf(el);
        gsap
          .timeline()
          .to(el, { scale: PRESS_DOWN_SCALE, duration: PRESS_DOWN_DURATION, ease: "power2.out" })
          .to(el, { scale: 1, duration: PRESS_UP_DURATION, ease: "power3.out" });
      });

      // The one place a row's qty actually changes — shared by the scripted scroll sequence AND
      // manual clicks. Clamped to the row's TRUE min/max (not the scripted `target`), so a manual
      // click that's already pushed a row past its scripted target doesn't get yanked back down by
      // a later auto-press, and the scripted sequence doesn't get blocked by a manually-lowered qty.
      const adjustRow = (rowIndex: number, direction: 1 | -1) => {
        const row = PRICING_ROWS[rowIndex];
        if (!row) return;
        const next = gsap.utils.clamp(row.min, row.max, qty[rowIndex] + direction);
        if (next === qty[rowIndex]) return;
        qty[rowIndex] = next;
        render();
        press(direction > 0 ? plusRefs.current[rowIndex] : minusRefs.current[rowIndex]);
        pop(qtyRefs.current[rowIndex]);
        pop(priceRefs.current[rowIndex]);
        pop(total);
      };

      pressRowRef.current = contextSafe!(adjustRow);

      // Lands on a given number of scripted presses with no motion — initial mount, refresh/resize,
      // and reduced motion all go through this. Also resets any manual click adjustments (expected:
      // this only runs on hard recovery paths, not during ordinary interaction).
      const jumpToCount = (count: number) => {
        gsap.killTweensOf(allAnimatedEls());
        PRICING_ROWS.forEach((row, i) => {
          qty[i] = row.start;
        });
        for (let i = 0; i < count; i += 1) {
          const rowIndex = SEQUENCE[i];
          if (rowIndex !== undefined) qty[rowIndex] = Math.min(PRICING_ROWS[rowIndex].target, qty[rowIndex] + 1);
        }
        render();
        allAnimatedEls().forEach((el) => el && gsap.set(el, { scale: 1 }));
      };

      jumpToCount(0);
      if (lineGreenRef.current) gsap.set(lineGreenRef.current, { opacity: 0 });

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        jumpToCount(SEQUENCE.length);
        if (lineGreenRef.current) gsap.set(lineGreenRef.current, { opacity: 1 });
        return;
      }

      let currentCount = 0;
      // Scroll-restore / StrictMode churn right after mount should land instantly, not animate.
      const instantUntil = performance.now() + 250;

      const syncToProgress = contextSafe!((progress: number, instant: boolean) => {
        // Pure function of raw scroll progress — freezes wherever scroll stops, reverses cleanly.
        if (lineGreenRef.current) gsap.set(lineGreenRef.current, { opacity: progress });

        const next = gsap.utils.clamp(0, SEQUENCE.length, Math.round(progress * SEQUENCE.length));
        if (instant) {
          jumpToCount(next);
        } else {
          while (currentCount < next) {
            const rowIndex = SEQUENCE[currentCount];
            if (rowIndex !== undefined) adjustRow(rowIndex, 1);
            currentCount += 1;
          }
          while (currentCount > next) {
            currentCount -= 1;
            const rowIndex = SEQUENCE[currentCount];
            if (rowIndex !== undefined) adjustRow(rowIndex, -1);
          }
        }
        currentCount = next;
      });

      ScrollTrigger.create({
        trigger: card,
        start: "center center",
        end: () => `+=${PRICING_PIN_SCROLL_DISTANCE * readScale()}`,
        pin: true,
        // GSAP disables automatic pin-spacing when the pinned element's parent is display:flex —
        // not the case here, but set explicitly anyway (see heroScrollAnimation.ts for the bug this
        // guards against if the surrounding markup ever changes).
        pinSpacing: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => syncToProgress(self.progress, performance.now() < instantUntil),
        onRefresh: (self) => syncToProgress(self.progress, true),
        onLeave: () => syncToProgress(1, true),
        onLeaveBack: () => syncToProgress(0, true),
      });
    },
    { scope: cardRef, dependencies: [] },
  );

  return {
    onPlusClick: (rowIndex: number) => pressRowRef.current(rowIndex, 1),
    onMinusClick: (rowIndex: number) => pressRowRef.current(rowIndex, -1),
  };
}
