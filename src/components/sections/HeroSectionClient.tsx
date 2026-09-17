"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { useHeroScrollAnimation } from "@/animations/heroScrollAnimation";
import { LAYER_FILES, type LayerFile } from "@/lib/heroLayers";

// layer-01-cap.svg is 383 wide; the other three are 372 — both share height 256. Sizing every
// layer off the same "372 units == 100% of the wrapper" baseline (rather than each filling 100%
// independently) preserves the cap's slightly-wider-than-the-body proportions instead of
// distorting it to match the others.
const CORE_WIDTH = 372;
const CAP_WIDTH = 383;
const CAP_WIDTH_PERCENT = (CAP_WIDTH / CORE_WIDTH) * 100;

export function HeroSectionClient({ layerSvgs }: { layerSvgs: Record<LayerFile, string> }) {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cubeWrapperRef = useRef<HTMLDivElement>(null);

  useHeroScrollAnimation({ sectionRef, contentRef, cubeWrapperRef });

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
          regardless of DOM order. */}
      <div
        ref={cubeWrapperRef}
        aria-hidden="true"
        className="relative mx-auto mt-[35px] h-[410px] w-[400px] min-[1800px]:mt-[84px] min-[1800px]:h-[465px] min-[1800px]:w-[480px]"
        style={{ "--stack-gap": "45px" } as CSSProperties}
      >
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
    </section>
  );
}
