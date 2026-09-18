// Shared "blur-stagger step swap" used by BOTH pinned sequences:
//   - InfrastructureSection's own pin (steps 1-2, see infrastructureScrollAnimation.ts)
//   - the machine screen's pin, where steps 3-8 live INSIDE the machine (machineScrollAnimation.ts)
// Extracted so the two can't drift apart: same timings, same "identical text swaps silently" rule,
// same aria handling.

import gsap from "gsap";
import { BLUR_HIDDEN_FILTER, BLUR_HIDDEN_Y_PX, BLUR_VISIBLE_FILTER } from "@/components/ui/BlurText";

export const FIELDS = ["eyebrow", "heading", "paragraph"] as const;
export type Field = (typeof FIELDS)[number];

export const STEP_HIDDEN = { opacity: 0, filter: BLUR_HIDDEN_FILTER, y: BLUR_HIDDEN_Y_PX };
export const STEP_VISIBLE = { opacity: 1, filter: BLUR_VISIBLE_FILTER, y: 0 };

// Text timings — the approved demo's values (seconds).
const OUT = { duration: 0.3, stagger: 0.004, blur: "blur(10px)" };
const IN_DURATION = 0.65;
const FIELD_IN: Record<Field, { stagger: number; delay: number }> = {
  eyebrow: { stagger: 0.03, delay: 0.1 },
  heading: { stagger: 0.06, delay: 0.15 },
  paragraph: { stagger: 0.012, delay: 0.3 },
};

// `root` is the element containing the `[data-step][data-field]` BlurText blocks.
export function createStepSwap(root: HTMLElement) {
  const fieldEl = (step: number, field: Field) =>
    root.querySelector<HTMLElement>(`[data-step="${step}"][data-field="${field}"]`);
  const wordsOf = (step: number, field: Field) =>
    Array.from(fieldEl(step, field)?.querySelectorAll<HTMLElement>("[data-blur-word]") ?? []);
  const allWords = Array.from(root.querySelectorAll<HTMLElement>("[data-blur-word]"));

  const setAriaActive = (active: number) => {
    root.querySelectorAll<HTMLElement>("[data-step]").forEach((el) => {
      el.setAttribute("aria-hidden", String(Number(el.dataset.step) !== active));
    });
  };

  // No motion — initial mount, refresh/resize, reduced motion.
  const jumpToStep = (step: number) => {
    gsap.killTweensOf(allWords);
    gsap.set(allWords, STEP_HIDDEN);
    for (const field of FIELDS) gsap.set(wordsOf(step, field), STEP_VISIBLE);
    setAriaActive(step);
  };

  const animateToStep = (to: number, from: number) => {
    // Kill EVERY word's tweens, not just this pair's, and hard-hide any step that is neither the one
    // being left nor the one being entered. A fast scroll (especially upwards) can cross three
    // boundaries within a few frames: the older code only tidied up the two steps it was told about,
    // so a step swapped away from mid-fade could be left stranded half-visible over the new one.
    gsap.killTweensOf(allWords);
    root.querySelectorAll<HTMLElement>("[data-step]").forEach((el) => {
      const step = Number(el.dataset.step);
      if (step === to || step === from) return;
      gsap.set(el.querySelectorAll<HTMLElement>("[data-blur-word]"), STEP_HIDDEN);
    });

    for (const field of FIELDS) {
      const outWords = wordsOf(from, field);
      const inWords = wordsOf(to, field);

      // Same text in both steps (the shared eyebrow, steps 3+4 / 7+8): swap without motion —
      // re-animating identical copy reads as a glitch.
      if (fieldEl(from, field)?.textContent === fieldEl(to, field)?.textContent) {
        gsap.set(outWords, STEP_HIDDEN);
        gsap.set(inWords, STEP_VISIBLE);
        continue;
      }

      gsap.to(outWords, { opacity: 0, filter: OUT.blur, duration: OUT.duration, stagger: OUT.stagger });
      gsap.fromTo(inWords, STEP_HIDDEN, {
        ...STEP_VISIBLE,
        duration: IN_DURATION,
        ease: "power3.out",
        stagger: FIELD_IN[field].stagger,
        delay: FIELD_IN[field].delay,
      });
    }
    setAriaActive(to);
  };

  return { jumpToStep, animateToStep };
}
