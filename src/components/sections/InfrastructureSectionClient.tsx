"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import { InfrastructureStaticBar } from "./InfrastructureStaticBar";
import { useInfrastructureScrollAnimation } from "@/animations/infrastructureScrollAnimation";
import { INFRASTRUCTURE_PIN_SCROLL_DISTANCE } from "@/lib/infrastructureLayout";
import type { InfrastructureStep } from "@/lib/infrastructureSteps";
import { BlurText } from "@/components/ui/BlurText";
import type { ServerLayerVariant } from "@/lib/serverLayerVariants";
import { SERVER_CAP_WIDTH_PERCENT, activeServerLayer, serverLayerOffset } from "@/lib/serverLayerSteps";

interface InfrastructureSectionClientProps {
  steps: InfrastructureStep[];
  className: string;
  serverLayers: ServerLayerVariant[];
}

export function InfrastructureSectionClient({ steps, className, serverLayers }: InfrastructureSectionClientProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const serverRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLSpanElement>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);

  useInfrastructureScrollAnimation({ cardRef, fillRef, serverRef, haloRef, ssrScrollReserveRef, stepCount: steps.length });

  return (
    <section className={className}>
      <div
        ref={cardRef}
        className="relative mx-auto w-[85%] border border-white/10 px-8 pt-6 pb-10 min-[1800px]:w-[1722px] md:px-16 md:pt-8 md:pb-14"
      >
        <div className="flex flex-col items-center gap-16 md:flex-row">
          {/* Blur-stagger step sequence. Every step's eyebrow / heading+paragraph is rendered up
              front and stacked in the same grid cell ([grid-area:1/1]), so each stack auto-sizes to
              its tallest step and nothing shifts while swapping. Only the active step's words sit
              fully visible; useInfrastructureScrollAnimation blurs/fades words out and in (by
              `data-step` / `data-field`) when the pinned scroll crosses into a new step. Fields
              whose text is identical between two steps (e.g. the shared eyebrow, steps 3+4) swap
              silently instead of re-animating. */}
          <div className="text-left md:flex-1">
            <div className="mb-6 flex items-center gap-3">
              <Image src="/herosection/Subtract.svg" alt="" width={58} height={26} aria-hidden="true" />
              <span className="grid">
                {steps.map((step, i) => (
                  <BlurText
                    key={i}
                    text={step.eyebrow}
                    hidden={i !== 0}
                    aria-hidden={i !== 0}
                    data-step={i}
                    data-field="eyebrow"
                    className="[grid-area:1/1] font-heading text-[22px] leading-none font-light tracking-[-0.02em] text-white/70"
                  />
                ))}
              </span>
              {/* TODO: per-step icon placeholder — icons aren't wired up yet (text-only for now,
                  see infrastructureSteps.ts). Steps 3-4 / 7-8 intentionally share identical text
                  and will only be told apart once this exists. */}
            </div>

            <div className="grid">
              {steps.map((step, i) => (
                <div key={i} className="[grid-area:1/1]">
                  <BlurText
                    as="h2"
                    text={step.heading}
                    hidden={i !== 0}
                    aria-hidden={i !== 0}
                    data-step={i}
                    data-field="heading"
                    className="max-w-[950px] font-heading text-[136px] leading-[1.05] font-bold text-foreground"
                  />
                  <BlurText
                    as="p"
                    text={step.paragraph}
                    hidden={i !== 0}
                    aria-hidden={i !== 0}
                    data-step={i}
                    data-field="paragraph"
                    className="mt-6 max-w-[860px] font-heading text-[32px] text-white/70"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Layered server: the hero's 4 layer SVGs, slightly separated, one layer lit green per
              step (bottom-up). Each layer carries a dark and a lit variant (built server-side in
              serverLayerVariants.ts); useInfrastructureScrollAnimation crossfades them, lifts the lit
              layer and moves the halo, scrubbed on the same progress as the text swap. The SSR
              state below matches step 0. --w sets the stack width; gap and layer height derive
              from it (layer SVGs are 372x256, cap 383x256). */}
          <div
            ref={serverRef}
            aria-hidden="true"
            className="relative mt-[100px] shrink-0 [--w:160px] md:max-[1799px]:[--w:200px] min-[1800px]:[--w:400px]"
            style={
              {
                "--gap": "calc(var(--w) * 0.19)",
                "--lh": "calc(var(--w) * 256 / 372)",
                width: "var(--w)",
                height: "calc(3 * var(--gap) + var(--lh))",
              } as CSSProperties
            }
          >
            <span
              ref={haloRef}
              className="pointer-events-none absolute top-0 left-1/2 aspect-[3/1] w-[115%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,255,135,0.35),rgba(0,255,135,0))] blur-[18px]"
              style={{ transform: `translateY(calc(${activeServerLayer(0)} * var(--gap) + var(--lh) * 0.3))` }}
            />
            {serverLayers.map((layer, i) => {
              const litOnLoad = i === activeServerLayer(0);
              return (
                <div
                  key={layer.name}
                  data-server-layer={i}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{
                    top: `calc(${i} * var(--gap))`,
                    width: i === 0 ? `${SERVER_CAP_WIDTH_PERCENT}%` : "100%",
                    zIndex: serverLayers.length - i + 1,
                    transform: `translateY(${serverLayerOffset(activeServerLayer(0), i)}px)`,
                  }}
                >
                  <div className="relative">
                    <div dangerouslySetInnerHTML={{ __html: layer.dark }} />
                    <div
                      data-server-lit=""
                      className="absolute inset-0"
                      style={{ opacity: litOnLoad ? 1 : 0 }}
                      dangerouslySetInnerHTML={{ __html: layer.lit }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <InfrastructureStaticBar fillRef={fillRef} />
      </div>

      {/* Placeholder that pre-reserves the same scroll distance GSAP's pin-spacer will later add
          (see useInfrastructureScrollAnimation, where it's collapsed to 0 right before that real
          pin-spacer is created) — server-rendered so the page is the SAME total height before and
          after client JS runs. Mirrors HeroSectionClient.tsx's identical fix for an identical bug
          (see PROJECT.md). */}
      <div ref={ssrScrollReserveRef} aria-hidden="true" style={{ height: INFRASTRUCTURE_PIN_SCROLL_DISTANCE }} />
    </section>
  );
}
