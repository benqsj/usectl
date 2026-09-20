"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { HeroMachineSvg, type HeroMachineHandle } from "@/components/sections/HeroMachineSvg";
import { useHeroScrollAnimation } from "@/animations/heroScrollAnimation";
import { HERO_PIN_SCROLL_DISTANCE, HERO_STACK_GAP_CLOSED_PX } from "@/lib/heroLayers";
import { s } from "@/lib/grid";

export function HeroSectionClient({ machineSvg }: { machineSvg: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cubeWrapperRef = useRef<HTMLDivElement>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HeroMachineHandle | null>(null);

  useHeroScrollAnimation({ sectionRef, contentRef, cubeWrapperRef, modelRef, ssrScrollReserveRef });

  return (
    <section
      ref={sectionRef}
      className="relative flex flex-col items-center px-6 pt-16 pb-28 text-center md:pb-36"
    >
      <div ref={contentRef}>
        <div className="flex items-center justify-center gap-3">
          <Image src="/herosection/Subtract.svg" alt="" width={58} height={26} aria-hidden="true" />
          <span className="font-heading text-[calc(var(--s)*22)] leading-none font-light tracking-[-0.02em] text-white/70">
            Managed Kubernetes &amp; AI Agent Infrastructure
          </span>
        </div>

        <h1 className="mt-[4px] font-heading text-[calc(var(--s)*98)] leading-[1.05] font-bold sm:text-nowrap">
          One server. <span className="text-brand">Unlimited</span> machines.
        </h1>

        <p className="mx-auto mt-2 max-w-[calc(var(--s)*1080)] text-[calc(var(--s)*28)] text-white/70">
          Zero-ops hosting for your apps and AI agents. Everything you need to take your idea live,
          without a DevOps team. Build it. Launch it.
        </p>

        <div className="mt-[calc(var(--s)*35)] flex flex-wrap items-center justify-center gap-4">
          <Button href="#">Create Machine</Button>
          <Button href="#" withArrow>
            See how it works
          </Button>
        </div>
      </div>

      {/* The server: public/sources/hero-machine.svg, inlined so its layers can be moved one by one
          (see HeroMachineSvg). This wrapper's BOX is what the rest of the hero is measured against:
          the scroll timeline scales and re-centres THIS element, and its height tracks
          --stack-gap so the page's total height (and the SSR reservation below) behaves as before.
          The SVG canvas is larger than the box and overflows it — the open stack is much taller,
          and the drawing carries its own ground glow. */}
      <div
        ref={cubeWrapperRef}
        aria-hidden="true"
        className="relative mx-auto mt-[calc(var(--s)*84)] w-[calc(var(--s)*480)] [--core-height:calc(var(--s)*330.32)] h-[calc(3*var(--stack-gap)_+_var(--core-height))]"
        style={{ "--stack-gap": s(HERO_STACK_GAP_CLOSED_PX) } as CSSProperties}
      >
        <HeroMachineSvg markup={machineSvg} apiRef={modelRef} />
      </div>

      {/* Placeholder that pre-reserves the same scroll distance GSAP's pin-spacer will later add
          (see heroScrollAnimation.ts, where it's collapsed to 0 right before that real pin-spacer
          is created) — server-rendered so the page is the SAME total height before and after
          client JS runs. Without this, a hard refresh while scrolled deep would restore scrollY
          against the shorter pre-hydration document, then destabilize once hydration grew the page
          underneath it — a real, diagnosed bug (see PROJECT.md for the exact repro). */}
      <div ref={ssrScrollReserveRef} aria-hidden="true" style={{ height: s(HERO_PIN_SCROLL_DISTANCE) }} />
    </section>
  );
}
