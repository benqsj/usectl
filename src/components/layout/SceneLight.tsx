import { useId, type CSSProperties } from "react";

// The team's "scene light" shapes (2026-09-29), drawn verbatim from their exports:
//   footer  — public/footer/background-light-for.svg (868×739); public/last-section/
//             text-background-light-form.svg is byte-identical and is used for state 9
//   pricing — public/pricing/pricing-background-light.svg (950×901)
// Each is two blurred blobs (#B6F1C0 → #11A32A @16% and #11A32A → #8FC6FF @18%, Gaussian blur
// stdDeviation 100). They are inlined instead of used as <img> because the exported frame is
// SMALLER than the lights (the right blob runs to x≈1030 in an 868-wide file): as an image, the
// file's viewport clips them and leaves hard straight edges wherever the frame edge is on screen.
// Inline with overflow visible, each blur fades out on its own. useId keeps the gradient/filter
// ids unique when two lights are on the page at once.
const LIGHTS = {
  footer: {
    w: 868,
    h: 739,
    blobs: [
      {
        d: "M291.402 416.77C291.402 346.77 244.735 285.603 221.402 263.77C111.902 141.27 448.902 207.27 636.402 359.77C823.902 512.27 618.902 613.27 448.902 740.27C278.902 867.27 291.402 504.27 291.402 416.77Z",
        opacity: 0.16,
        filter: { x: 0, y: 0, width: 910.974, height: 966.944 },
        grad: { x1: 155.902, y1: 200.271, x2: 592.902, y2: 696.271, from: "#B6F1C0", to: "#11A32A" },
      },
      {
        d: "M811.933 441.279C881.694 435.492 938.793 383.929 958.623 358.871C1071.65 239.619 1033.74 580.921 897.259 780.386C760.781 979.851 643.18 783.902 502.561 624.983C361.942 466.064 724.733 448.513 811.933 441.279Z",
        opacity: 0.18,
        filter: { x: 270.534, y: 134.203, width: 954.625, height: 930.619 },
        grad: { x1: 1016.49, y1: 288.346, x2: 558.314, y2: 764.854, from: "#11A32A", to: "#8FC6FF" },
      },
    ],
  },
  pricing: {
    w: 950,
    h: 901,
    blobs: [
      {
        d: "M268.868 363.263C268.868 310.541 233.706 264.473 216.125 248.029C133.621 155.767 387.538 205.476 528.812 320.333C670.087 435.19 515.627 511.259 387.538 606.91C259.449 702.562 268.868 429.164 268.868 363.263Z",
        opacity: 0.16,
        filter: { x: 0, y: 0, width: 785, height: 827 },
        grad: { x1: 166.774, y1: 200.204, x2: 495.889, y2: 573.902, from: "#B6F1C0", to: "#11A32A" },
      },
      {
        d: "M661.089 381.645C713.653 377.285 756.677 338.432 771.619 319.551C856.785 229.695 828.216 486.865 725.381 637.161C622.546 787.457 533.934 639.81 427.978 520.065C322.023 400.32 595.384 387.096 661.089 381.645Z",
        opacity: 0.18,
        filter: { x: 203.846, y: 100.964, width: 817.907, height: 799.819 },
        grad: { x1: 815.222, y1: 266.411, x2: 469.988, y2: 625.457, from: "#11A32A", to: "#8FC6FF" },
      },
    ],
  },
} as const;

export const SCENE_LIGHT_SIZE = {
  footer: { w: LIGHTS.footer.w, h: LIGHTS.footer.h },
  pricing: { w: LIGHTS.pricing.w, h: LIGHTS.pricing.h },
};

export function SceneLight({ variant, style }: { variant: keyof typeof LIGHTS; style?: CSSProperties }) {
  const uid = useId().replace(/:/g, "");
  const { w, h, blobs } = LIGHTS[variant];
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute overflow-visible"
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      style={style}
    >
      {blobs.map((b, i) => (
        <g key={i} filter={`url(#${uid}f${i})`}>
          <path d={b.d} fill={`url(#${uid}g${i})`} fillOpacity={b.opacity} />
        </g>
      ))}
      <defs>
        {blobs.map((b, i) => (
          <filter
            key={`f${i}`}
            id={`${uid}f${i}`}
            {...b.filter}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="100" />
          </filter>
        ))}
        {blobs.map((b, i) => (
          <linearGradient
            key={`g${i}`}
            id={`${uid}g${i}`}
            x1={b.grad.x1}
            y1={b.grad.y1}
            x2={b.grad.x2}
            y2={b.grad.y2}
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={b.grad.from} />
            <stop offset="1" stopColor={b.grad.to} />
          </linearGradient>
        ))}
      </defs>
    </svg>
  );
}
