import { type CSSProperties, type HTMLAttributes } from "react";
import { BLUR_HIDDEN_FILTER, BLUR_HIDDEN_OPACITY, BLUR_HIDDEN_Y_PX } from "./BlurText";

const HIDDEN_STYLE: CSSProperties = {
  opacity: BLUR_HIDDEN_OPACITY,
  filter: BLUR_HIDDEN_FILTER,
  transform: `translateY(${BLUR_HIDDEN_Y_PX}px)`,
};

interface BlurCharsProps extends HTMLAttributes<HTMLElement> {
  text: string;
  // Server-renders the characters already blurred/faded out — same reasoning as BlurText's
  // `hidden` prop, just per-character instead of per-word.
  hidden?: boolean;
}

// Same blur-stagger visual language as BlurText.tsx (shares its BLUR_HIDDEN_* constants so the
// SSR-hidden state and GSAP's hidden state can't drift apart), but split per CHARACTER instead of
// per word — built for MachineSection's single-word "machine" wordmark, where the reveal needs a
// tighter, letter-by-letter stagger (see machineScrollAnimation.ts, which targets
// `[data-blur-char]`). Not merged into BlurText itself since word-split and char-split have
// different whitespace handling and no current caller needs both from one component.
export function BlurChars({ text, hidden = false, ...rest }: BlurCharsProps) {
  return (
    <span {...rest}>
      {text.split("").map((char, i) => (
        <span
          key={i}
          data-blur-char=""
          className="inline-block [will-change:opacity,filter]"
          style={hidden ? HIDDEN_STYLE : undefined}
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </span>
  );
}
