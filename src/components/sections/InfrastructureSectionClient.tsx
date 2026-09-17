"use client";

import Image from "next/image";
import { useRef } from "react";
import { InfrastructureStaticBar } from "./InfrastructureStaticBar";
import { useInfrastructureScrollAnimation } from "@/animations/infrastructureScrollAnimation";
import { INFRASTRUCTURE_PIN_SCROLL_DISTANCE } from "@/lib/infrastructureLayout";
import { INFRASTRUCTURE_STEPS_GROUP_1 } from "@/lib/infrastructureSteps";

export function InfrastructureSectionClient() {
  const cardRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useInfrastructureScrollAnimation({ cardRef, fillRef, stepRefs, ssrScrollReserveRef });

  return (
    <section className="mt-[-11px] pb-20 min-[1800px]:mt-8 md:pb-28">
      <div
        ref={cardRef}
        className="relative mx-auto w-[85%] border border-white/10 px-8 pt-6 pb-10 min-[1800px]:w-[1722px] md:px-16 md:pt-8 md:pb-14"
      >
        <div className="flex flex-col items-center gap-16 md:flex-row">
          {/* All 4 steps share the same grid cell ([grid-area:1/1]) so the container's height
              auto-sizes to the tallest of them and stays put across the crossfade — no absolute
              positioning / hardcoded min-height guess needed. useInfrastructureScrollAnimation
              crossfades between them (opacity + a small y-rise, same style as HeroSection's text
              fade) as the page scrolls through the pinned range. */}
          <div className="grid text-left md:flex-1">
            {INFRASTRUCTURE_STEPS_GROUP_1.map((step, i) => (
              <div
                key={i}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                className={`[grid-area:1/1] ${i === 0 ? "opacity-100" : "opacity-0"}`}
              >
                <div className="mb-6 flex items-center gap-3">
                  <Image src="/herosection/Subtract.svg" alt="" width={58} height={26} aria-hidden="true" />
                  <span className="font-heading text-[22px] leading-none font-light tracking-[-0.02em] text-white/70">
                    {step.eyebrow}
                  </span>
                  {/* TODO: per-step icon placeholder — icons aren't wired up yet (text-only for
                      now, see infrastructureSteps.ts). Steps 3-4 intentionally share identical
                      text and will only be told apart once this exists. */}
                </div>

                <h2 className="max-w-[950px] font-heading text-[136px] leading-[1.05] font-bold text-foreground">
                  {step.heading}
                </h2>

                <p className="mt-6 max-w-[860px] font-heading text-[32px] text-white/70">{step.paragraph}</p>
              </div>
            ))}
          </div>

          <div className="shrink-0">
            <Image
              src="/infrastructur/servertitanium.svg"
              alt=""
              width={568}
              height={556}
              aria-hidden="true"
              className="mt-[100px] h-auto w-[260px] md:max-[1799px]:w-[320px] min-[1800px]:w-[650px]"
            />
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
