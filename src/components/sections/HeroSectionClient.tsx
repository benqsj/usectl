"use client";

import Image from "next/image";
import { useCallback, useRef, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { HeroServerModel, type HeroServerModelHandle } from "@/components/sections/HeroServerModel";
import { useHeroScrollAnimation } from "@/animations/heroScrollAnimation";
import { HERO_PIN_SCROLL_DISTANCE, HERO_STACK_GAP_CLOSED_PX } from "@/lib/heroLayers";
import { HERO_CORE_HEIGHT_RATIO } from "@/lib/heroModel";
import { useGridMarks } from "@/lib/gridEffect/useGridMarks";
import { HEADER_HEIGHT_PX, readScale, s } from "@/lib/grid";

// The 4 corner "+" marks around the server, restored 2026-09-20 — as grid marks this time, not
// cross.svg images. The whole reason they were pulled in the first place (PROJECT.md's grid-snap ->
// cube-relative -> "just delete them" saga) was that a fixed-px offset and a vw-fluid grid only
// line up at the width you tuned them at; a mark that IS a grid intersection cannot have that
// problem. These two numbers reproduce the approved 1920 look — columns 7/16, rows 4/7 — and the
// snap picks the nearest equivalent everywhere else.
//
// gapX 129 is the exact distance from the model box's edge to column 7 at 1920. gapY is ZERO,
// which means "the row nearest each edge" rather than "push away by N" — at 1920 the model box is
// almost exactly four row pitches tall, so the pair lands on its top and bottom edges, and at any
// other width the snap keeps that framing as closely as the grid allows.
const HERO_MARK_GAP_X_PX = 129;
const HERO_MARK_GAP_Y_PX = 0;
const HERO_MODEL_WIDTH_PX = 480;

export function HeroSectionClient() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cubeWrapperRef = useRef<HTMLDivElement>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HeroServerModelHandle | null>(null);
  const modelSyncRef = useRef<(() => void) | null>(null);

  // The box the marks are snapped around is deliberately NOT getBoundingClientRect(): this wrapper
  // is scaled, shifted and grown by the scroll timeline, and its section is position:fixed while
  // pinned, so a live rect says something different at every scroll position. This is the wrapper's
  // pure LAYOUT box at the top of the page — offsetTop/offsetLeft are relative to the <section>
  // (position:relative) and unaffected by scroll, pinning or the timeline's transforms, and the
  // height is the CLOSED height computed from the same formula the CSS uses rather than read back
  // from --stack-gap, which the timeline owns. Same reasoning as measureRecenterY in
  // heroScrollAnimation.ts, which was a real refresh bug there.
  const markBox = useCallback(() => {
    const el = cubeWrapperRef.current;
    if (!el) return null;
    const k = readScale();
    const closedHeight = 3 * HERO_STACK_GAP_CLOSED_PX * k + HERO_MODEL_WIDTH_PX * HERO_CORE_HEIGHT_RATIO * k;
    // The hero is the first thing in <main>, and the header is sticky (so it occupies flow) —
    // the section therefore starts exactly one header below the document top.
    const top = HEADER_HEIGHT_PX + el.offsetTop;
    return { left: el.offsetLeft, right: el.offsetLeft + el.offsetWidth, top, bottom: top + closedHeight };
  }, []);

  const gridMarks = useGridMarks(cubeWrapperRef, {
    gapX: HERO_MARK_GAP_X_PX,
    gapY: HERO_MARK_GAP_Y_PX,
    box: markBox,
  });

  useHeroScrollAnimation({
    sectionRef,
    contentRef,
    cubeWrapperRef,
    modelRef,
    modelSyncRef,
    ssrScrollReserveRef,
    gridMarks,
  });

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
        className="relative mx-auto mt-[calc(var(--s)*84)] w-[calc(var(--s)*480)] [--core-height:calc(var(--s)*330.32)] h-[calc(3*var(--stack-gap)_+_var(--core-height))]"
        style={{ "--stack-gap": `${HERO_STACK_GAP_CLOSED_PX}px` } as CSSProperties}
      >
        {/* Soft ambient glow beneath the server, matching server-cube.png's reference look — the
            model has no equivalent "shadow/glow" of its own, so it's a plain CSS radial gradient.
            Positioned off the same formula as the wrapper's own height, so it tracks the base
            layer down as the stack opens. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 h-[calc(var(--s)*130)] w-[170%] -translate-x-1/2 rounded-full blur-2xl"
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
      <div ref={ssrScrollReserveRef} aria-hidden="true" style={{ height: s(HERO_PIN_SCROLL_DISTANCE) }} />
    </section>
  );
}
