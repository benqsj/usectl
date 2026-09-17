"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { useHeroScrollAnimation } from "@/animations/heroScrollAnimation";
import { HERO_PIN_SCROLL_DISTANCE, LAYER_FILES, type LayerFile } from "@/lib/heroLayers";

// layer-01-cap.svg is 383 wide; the other three are 372 — both share height 256. Sizing every
// layer off the same "372 units == 100% of the wrapper" baseline (rather than each filling 100%
// independently) preserves the cap's slightly-wider-than-the-body proportions instead of
// distorting it to match the others.
const CORE_WIDTH = 372;
const CAP_WIDTH = 383;
const CAP_WIDTH_PERCENT = (CAP_WIDTH / CORE_WIDTH) * 100;

// Each layer's own rendered height, derived from the same width-based scale factor as above —
// needed (as the literal --core-height values below) so the wrapper's total height can track
// --stack-gap live. Computed here for documentation; must stay a literal string in the className
// itself (Tailwind's build-time scanner can't see class names built via template interpolation —
// see the identical caveat already noted elsewhere in this project for min-[Npx]: breakpoints).
// 400 * 256 / CORE_WIDTH = 275.27, 480 * 256 / CORE_WIDTH = 330.32

export function HeroSectionClient({ layerSvgs }: { layerSvgs: Record<LayerFile, string> }) {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cubeWrapperRef = useRef<HTMLDivElement>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);

  useHeroScrollAnimation({ sectionRef, contentRef, cubeWrapperRef, ssrScrollReserveRef });

  return (
    <section
      ref={sectionRef}
      className="relative flex flex-col items-center px-6 pt-16 pb-28 text-center md:pb-36"
    >
      <div ref={contentRef}>
        <div className="flex items-center justify-center gap-3">
          <Image src="/herosection/Subtract.svg" alt="" width={58} height={26} aria-hidden="true" />
          <span className="font-heading text-[22px] leading-none font-light tracking-[-0.02em] text-white/70">
            Managed Kubernetes &amp; AI Agent Infrastructure
          </span>
        </div>

        <h1 className="mt-[4px] font-heading text-[98px] leading-[1.05] font-bold sm:text-nowrap">
          One server. <span className="text-brand">Unlimited</span> machines.
        </h1>

        <p className="mx-auto mt-2 max-w-[1080px] text-[28px] text-white/70">
          Zero-ops hosting for your apps and AI agents. Everything you need to take your idea live,
          without a DevOps team. Build it. Launch it.
        </p>

        <div className="mt-[35px] flex flex-wrap items-center justify-center gap-4">
          <Button href="#">Create Machine</Button>
          <Button href="#" withArrow>
            See how it works
          </Button>
        </div>
      </div>

      {/* Four independent layers (cap / core / core / base), each absolutely positioned and
          horizontally centered, stacked via `top: calc(index * var(--stack-gap))`. --stack-gap
          starts at 45px (closed — tuned by eye against server-cube.png; bumped up from an initial
          25px, which read as too tightly mashed together) and the scroll timeline
          (useHeroScrollAnimation) animates it up to 140px (open) — a real disassembly driven by
          one CSS custom property, no per-layer GSAP targeting needed. z-index keeps the cap on top
          regardless of DOM order.

          The wrapper's own height ALSO tracks --stack-gap (via --core-height + calc()), instead of
          staying fixed at the closed size — without this, the layers (rendered with the default
          `overflow: visible`) grew visibly past the wrapper's box as they separated, bleeding
          into InfrastructureSection below once the pin released. Growing the wrapper's real
          document-flow height in lockstep is safe here specifically because it only changes while
          the section is pinned (position: fixed, so it can't affect surrounding layout) and has
          already reached its final (open) size by the moment the pin releases — see PROJECT.md. */}
      <div
        ref={cubeWrapperRef}
        aria-hidden="true"
        className="relative mx-auto mt-[35px] w-[400px] [--core-height:275.27px] h-[calc(3*var(--stack-gap)_+_var(--core-height))] min-[1800px]:mt-[84px] min-[1800px]:w-[480px] min-[1800px]:[--core-height:330.32px]"
        style={{ "--stack-gap": "45px" } as CSSProperties}
      >
        {/* Soft ambient glow beneath the base layer, matching server-cube.png's reference look —
            these 4 layer SVGs have no equivalent "shadow/glow" asset of their own, so it's a plain
            CSS radial gradient instead. Positioned off the same formula as the wrapper's own
            height, so it tracks the base layer down as the stack opens. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 h-[130px] w-[170%] -translate-x-1/2 rounded-full blur-2xl"
          style={{
            top: `calc(3 * var(--stack-gap) + var(--core-height) - 45px)`,
            background: "radial-gradient(ellipse at center, rgba(72,144,72,0.55) 0%, rgba(72,144,72,0) 70%)",
          }}
        />

        {LAYER_FILES.map((name, index) => (
          <div
            key={name}
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: `calc(${index} * var(--stack-gap))`,
              width: name === "layer-01-cap" ? `${CAP_WIDTH_PERCENT}%` : "100%",
              zIndex: LAYER_FILES.length - index,
            }}
            dangerouslySetInnerHTML={{ __html: layerSvgs[name] }}
          />
        ))}
      </div>

      {/* Placeholder that pre-reserves the same scroll distance GSAP's pin-spacer will later add
          (see useHeroScrollAnimation.ts, where it's collapsed to 0 right before that real
          pin-spacer is created) — server-rendered so the page is the SAME total height before and
          after client JS runs. Without this, a hard refresh while scrolled deep would restore
          scrollY against the shorter pre-hydration document, then destabilize once hydration grew
          the page underneath it — a real, diagnosed bug (see PROJECT.md for the exact repro). */}
      <div ref={ssrScrollReserveRef} aria-hidden="true" style={{ height: HERO_PIN_SCROLL_DISTANCE }} />
    </section>
  );
}
