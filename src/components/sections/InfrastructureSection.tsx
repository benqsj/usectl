"use client";

import Image from "next/image";
import { useRef } from "react";
import { InfrastructureStaticBar } from "./InfrastructureStaticBar";
import { useInfrastructureScrollAnimation } from "@/animations/infrastructureScrollAnimation";
import { INFRASTRUCTURE_PIN_SCROLL_DISTANCE } from "@/lib/infrastructureLayout";

export function InfrastructureSection() {
  const cardRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);

  useInfrastructureScrollAnimation({ cardRef, fillRef, ssrScrollReserveRef });

  return (
    <section className="mt-[-11px] pb-20 min-[1800px]:mt-8 md:pb-28">
      <div
        ref={cardRef}
        className="relative mx-auto w-[85%] border border-white/10 px-8 pt-6 pb-10 min-[1800px]:w-[1722px] md:px-16 md:pt-8 md:pb-14"
      >
        <div className="flex flex-col items-center gap-16 md:flex-row">
          <div className="text-left md:flex-1">
            <div className="mb-6 flex items-center gap-3">
              <Image src="/herosection/Subtract.svg" alt="" width={58} height={26} aria-hidden="true" />
              <span className="font-heading text-[22px] leading-none font-light tracking-[-0.02em] text-white/70">
                Infrastructure Freedom
              </span>
            </div>

            <h2 className="max-w-[950px] font-heading text-[136px] leading-[1.05] font-bold text-foreground">
              You came here to build.
            </h2>

            <p className="mt-6 max-w-[860px] font-heading text-[32px] text-white/70">
              Your next feature. Your first customer. The idea you can&apos;t stop thinking about.
              usectl handles the infrastructure, giving you more time to move your product forward
            </p>
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
