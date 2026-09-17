import { Fragment, type CSSProperties, type HTMLAttributes } from "react";

// Shared "hidden" state for a word — used both for the SSR-rendered inline style (so non-active
// steps render already-hidden, no flash of every step stacked visible before hydration) and for
// infrastructureScrollAnimation.ts's GSAP "from"/jump state, so the two can't drift apart.
export const BLUR_HIDDEN_OPACITY = 0;
export const BLUR_HIDDEN_BLUR_PX = 12;
export const BLUR_HIDDEN_FILTER = `blur(${BLUR_HIDDEN_BLUR_PX}px)`;
export const BLUR_HIDDEN_Y_PX = 8;
export const BLUR_VISIBLE_FILTER = "blur(0px)";

const HIDDEN_STYLE: CSSProperties = {
  opacity: BLUR_HIDDEN_OPACITY,
  filter: BLUR_HIDDEN_FILTER,
  transform: `translateY(${BLUR_HIDDEN_Y_PX}px)`,
};

type BlurTextTag = "span" | "h2" | "p";

interface BlurTextProps extends HTMLAttributes<HTMLElement> {
  text: string;
  as?: BlurTextTag;
  // Server-renders the words already blurred/faded out, so non-active steps are invisible before
  // any client JS runs (no flash of all steps stacked on top of each other).
  hidden?: boolean;
  [dataAttr: `data-${string}`]: string | number | undefined;
}

// "Blur stagger" text: every word is its own span, faded/blurred in and out by GSAP (see
// infrastructureScrollAnimation.ts, which targets `[data-blur-word]`). Split happens here at
// render time (not a runtime SplitText pass) so the markup is identical on server and client and
// there's no layout shift on hydration. No overflow-hidden wrapper (unlike the mask-reveal version
// this replaces) — clipping would cut the blur off at the word's box edge.
export function BlurText({ text, as: Tag = "span", hidden = false, ...rest }: BlurTextProps) {
  const words = text.split(" ");
  return (
    <Tag {...rest}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span
            data-blur-word=""
            className="inline-block align-top [will-change:opacity,filter]"
            style={hidden ? HIDDEN_STYLE : undefined}
          >
            {word}
          </span>
          {i < words.length - 1 && " "}
        </Fragment>
      ))}
    </Tag>
  );
}
