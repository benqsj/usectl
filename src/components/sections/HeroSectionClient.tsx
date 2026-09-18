"use client";

import Image from "next/image";
import { useCallback, useRef, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { HeroServerModel, type HeroServerModelHandle } from "@/components/sections/HeroServerModel";
import { useHeroScrollAnimation } from "@/animations/heroScrollAnimation";
import { HERO_PIN_SCROLL_DISTANCE, HERO_STACK_GAP_CLOSED_PX } from "@/lib/heroLayers";

export function HeroSectionClient() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cubeWrapperRef = useRef<HTMLDivElement>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HeroServerModelHandle | null>(null);
  const modelSyncRef = useRef<(() => void) | null>(null);

  useHeroScrollAnimation({ sectionRef, contentRef, cubeWrapperRef, modelRef, modelSyncRef, ssrScrollReserveRef });

  // The GLB arrives well after the timeline is built, always starting at its closed pose. This
  // jumps it straight to the pose the current scroll position calls for — see modelSyncRef's own
  // comment in heroScrollAnimation.ts for why a plain ScrollTrigger.refresh() alone isn't enough
  // (it re-syncs through the scrub's eased catch-up, which visibly animates closed -> open instead
  // of just already being there).
  const handleModelReady = useCallback(() => modelSyncRef.current?.(), []);

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

      {/* The server, now a real 3D model (HeroServerModel) instead of four stacked layer SVGs.
          This wrapper's BOX is unchanged from the SVG version on purpose — same w-[400px], same
          --core-height, same height tracking --stack-gap — because it is what the rest of the
          hero is measured against: the scroll timeline scales and re-centres THIS element, and
          the model was scaled (see HERO_MODEL_PX_PER_UNIT) so the closed server lands in exactly
          the same 400x409px the SVG stack occupied. The <canvas> itself is larger than this box
          and overflows it, since the exploded stack is about twice as tall and the silhouette
          widens as it turns.

          --stack-gap is still animated 45px -> 140px by the timeline even though no layer reads
          it for positioning any more: the wrapper's own height is derived from it, and keeping
          that growth identical is what keeps the page's total height (and the SSR reservation
          below) behaving exactly as it did before. */}
      <div
        ref={cubeWrapperRef}
        aria-hidden="true"
        className="relative mx-auto mt-[35px] w-[400px] [--core-height:275.27px] h-[calc(3*var(--stack-gap)_+_var(--core-height))] min-[1800px]:mt-[84px] min-[1800px]:w-[480px] min-[1800px]:[--core-height:330.32px]"
        style={{ "--stack-gap": `${HERO_STACK_GAP_CLOSED_PX}px` } as CSSProperties}
      >
        {/* Soft ambient glow beneath the server, matching server-cube.png's reference look — the
            model has no equivalent "shadow/glow" of its own, so it's a plain CSS radial gradient.
            Positioned off the same formula as the wrapper's own height, so it tracks the base
            layer down as the stack opens. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 h-[130px] w-[170%] -translate-x-1/2 rounded-full blur-2xl"
          style={{
            top: `calc(3 * var(--stack-gap) + var(--core-height) - 45px)`,
            background: "radial-gradient(ellipse at center, rgba(72,144,72,0.55) 0%, rgba(72,144,72,0) 70%)",
          }}
        />

        <HeroServerModel apiRef={modelRef} wrapperRef={cubeWrapperRef} onReady={handleModelReady} />
      </div>

      {/* Placeholder that pre-reserves the same scroll distance GSAP's pin-spacer will later add
          (see heroScrollAnimation.ts, where it's collapsed to 0 right before that real pin-spacer
          is created) — server-rendered so the page is the SAME total height before and after
          client JS runs. Without this, a hard refresh while scrolled deep would restore scrollY
          against the shorter pre-hydration document, then destabilize once hydration grew the page
          underneath it — a real, diagnosed bug (see PROJECT.md for the exact repro). */}
      <div ref={ssrScrollReserveRef} aria-hidden="true" style={{ height: HERO_PIN_SCROLL_DISTANCE }} />
    </section>
  );
}
