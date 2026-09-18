"use client";

import Image from "next/image";
import { useRef } from "react";
import { InfrastructureSectionClient } from "./InfrastructureSectionClient";
import { useRasterizedSvg } from "@/hooks/useRasterizedSvg";
import type { InfrastructureStep } from "@/lib/infrastructureSteps";
import type { MachineServerParts } from "@/lib/machineServerParts";
import { BlurChars } from "@/components/ui/BlurChars";
import { BLUR_HIDDEN_FILTER, BLUR_HIDDEN_Y_PX } from "@/components/ui/BlurText";
import { useMachineScrollAnimation, CROSS_HIDDEN_SCALE, TOPSIDE_HIDDEN_SCALE } from "@/animations/machineScrollAnimation";
import { MACHINE_PIN_SCROLL_DISTANCE } from "@/lib/machineLayout";
import { vw } from "@/lib/grid";

// Hatch mark ("Subtract.svg", the same green diagonal-hatch icon HeroSection/InfrastructureSection
// use for their eyebrow rows) sized to roughly match the wordmark's cap height at the 1920
// reference, then scaled with vw like the wordmark itself so the two stay in proportion at any
// width.
const HATCH_WIDTH_PX = 125;
const HATCH_NATIVE_WIDTH = 58;
const HATCH_NATIVE_HEIGHT = 26;
const WORDMARK_FONT_SIZE_PX = 150;
const WORDMARK_GAP_PX = 28;

// The 4 corner crosses are positioned relative to the wordmark block itself (hatch + "machine"),
// not snapped to BackgroundLines.tsx's page-absolute grid rows/columns — considered, but skipped:
// this content is centered in the *viewport* while pinned, and its page-absolute Y depends on how
// much content sits above it, which isn't a fixed grid row the way HeroSection's original
// page-anchored corner crosses were (see PROJECT.md's "cube-relative rewrite" note on HeroSection
// for the same lesson learned there — a floating/re-positionable element and a page-absolute grid
// only reliably line up at the one width/scroll-position you happened to test). `vw()` from
// grid.ts is still reused here for the *fluid scaling convention* (offsets grow proportionally
// with viewport width, matching every other measurement on this page), just anchored to the
// wordmark's own box instead of the page grid.
const CROSS_H_OFFSET_PX = 60;
const CROSS_V_OFFSET_PX = 70;

const CROSS_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

// topside.svg is 688x688 (a top-down view of the server, same lid as servertitanium.svg's top
// face, with an ambient glow baked in) — sized here at the 1920 reference, vw-scaled like
// everything else on this screen. Starts hidden (small + transparent), fades in at its own base
// scale once the wordmark has been visible a while, then grows further (scrubbed, see
// machineScrollAnimation.ts) while the wordmark fades out — all centered on the SAME point.
const TOPSIDE_WIDTH_PX = 460;

interface MachineSectionClientProps {
  // Steps 3-8 — they live INSIDE the machine now: the same InfrastructureSection card, rendered
  // embedded (no pin of its own) and driven by this screen's single pin.
  steps: InfrastructureStep[];
  // The 2-part titanium server for that card's right column — step 3 separates it (revealing the
  // server-icons in the gap), step 4 fades it into the "machine" wordmark. Same asset/component the
  // intro (steps 1-2) uses; see machineScrollAnimation.ts's "step 3 -> step 4" block.
  machineServer: MachineServerParts;
}

const TOPSIDE_RASTER_WIDTH = 1376; // 2x topside.svg's own 688 — see useRasterizedSvg

export function MachineSectionClient({ steps, machineServer }: MachineSectionClientProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const hatchRef = useRef<HTMLDivElement>(null);
  const crossRefs = useRef<(HTMLImageElement | null)[]>([]);
  const topsideRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);

  const topsideRaster = useRasterizedSvg("/infrastructur/topside.svg", TOPSIDE_RASTER_WIDTH);

  useMachineScrollAnimation({
    sectionRef,
    wordmarkRef,
    hatchRef,
    crossRefs,
    topsideRef,
    tintRef,
    cardRef,
    fillRef,
    stepCount: steps.length,
    ssrScrollReserveRef,
  });

  return (
    // Outer <section> is a plain block (no height of its own beyond its children) — deliberately
    // NOT `min-h-screen` itself, so the trailing ssrScrollReserveRef spacer below adds real EXTRA
    // document height on top of the inner min-h-screen div instead of being absorbed by it. GSAP
    // pins THIS section: at the moment it captures the pin snapshot, the spacer has already
    // collapsed to 0px (see useMachineScrollAnimation), so what actually gets pinned is exactly
    // the inner div's box — a true full-viewport screen. Everything (wordmark AND topside.svg)
    // lives in ONE stage, one pin — the wordmark fades away and topside.svg grows in the SAME
    // centered spot, rather than topside living in a separate section further down the page.
    <section ref={sectionRef} className="relative">
      {/* overflow-hidden: topside grows far past the viewport on its way "through" us, and this
          keeps that from painting outside the pinned screen. */}
      <div ref={stageRef} className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div ref={wordmarkRef} className="relative inline-flex items-center" style={{ gap: vw(WORDMARK_GAP_PX) }}>
          {/* Hatch mark — SSR-hidden (matches BlurText's BLUR_HIDDEN_* so nothing flashes
              visible before hydration), unblurred/faded in first by
              useMachineScrollAnimation's entrance. */}
          <div
            ref={hatchRef}
            style={{ opacity: 0, filter: BLUR_HIDDEN_FILTER, transform: `translateY(${BLUR_HIDDEN_Y_PX}px)` }}
          >
            <Image
              src="/herosection/Subtract.svg"
              alt=""
              width={HATCH_NATIVE_WIDTH}
              height={HATCH_NATIVE_HEIGHT}
              aria-hidden="true"
              style={{ width: vw(HATCH_WIDTH_PX), height: "auto" }}
            />
          </div>

          {/* "machine" wordmark — blur-staggers in per character (see machineScrollAnimation.ts). */}
          <BlurChars
            text="machine"
            hidden
            aria-hidden="true"
            className="font-heading leading-none font-bold text-[#d9d9d9]"
            style={{ fontSize: vw(WORDMARK_FONT_SIZE_PX) }}
          />

          {/* 4 corner cross marks, SSR-hidden (opacity 0 + CROSS_HIDDEN_SCALE) — fade in with a
              slight scale-up last in the entrance sequence, after the wordmark itself. */}
          {CROSS_POSITIONS.map((pos, i) => (
            <Image
              key={pos}
              ref={(el) => {
                crossRefs.current[i] = el;
              }}
              src="/herosection/cross.svg"
              alt=""
              width={32}
              height={32}
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                opacity: 0,
                transform: `scale(${CROSS_HIDDEN_SCALE})`,
                ...(pos.startsWith("top") ? { top: `calc(-1 * ${vw(CROSS_V_OFFSET_PX)})` } : {}),
                ...(pos.startsWith("bottom") ? { bottom: `calc(-1 * ${vw(CROSS_V_OFFSET_PX)})` } : {}),
                ...(pos.endsWith("left") ? { left: `calc(-1 * ${vw(CROSS_H_OFFSET_PX)})` } : {}),
                ...(pos.endsWith("right") ? { right: `calc(-1 * ${vw(CROSS_H_OFFSET_PX)})` } : {}),
              }}
            />
          ))}
        </div>

        {/* topside.svg — absolutely centered on the SAME point as the wordmark above (the
            `stageRef` parent is `relative`, this is `absolute` + centered via left/top 50% and
            GSAP-owned xPercent/yPercent, not a plain CSS translate string, so GSAP's later scale
            tweens compose cleanly with the centering instead of fighting over `transform`).
            Starts hidden (opacity 0, TOPSIDE_HIDDEN_SCALE) — fades in at its own base scale once
            the wordmark's been visible a while, then grows further while the wordmark fades out. */}
        <div
          ref={topsideRef}
          aria-hidden="true"
          className="absolute top-1/2 left-1/2"
          style={{
            opacity: 0,
            transform: `translate(-50%, -50%) scale(${TOPSIDE_HIDDEN_SCALE})`,
            // The hatch opening is a two-layer CSS mask: a full-cover layer plus the rounded-square
            // hole shape, combined with mask-composite so the shape is SUBTRACTED (without this the
            // two layers are added together and no hole ever appears). Only the hole's size is
            // animated, by machineScrollAnimation.ts — everything static lives here.
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center, center",
            maskPosition: "center, center",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        >
          <Image
            src={topsideRaster ?? "/infrastructur/topside.svg"}
            alt=""
            width={688}
            height={688}
            aria-hidden="true"
            unoptimized
            style={{ width: vw(TOPSIDE_WIDTH_PX), height: "auto", backfaceVisibility: "hidden" }}
          />
        </div>

        {/* A light green wash right after we're through the hatch — machineScrollAnimation.ts
            fades it out well before the content has finished arriving. */}
        <div
          ref={tintRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{
            // Darkened 2026-09-18 (per feedback): still reads as green, but sits much closer to
            // black -- lower green channel (0,255,135 -> 0,130,70) plus a slightly lower alpha,
            // instead of the earlier bright, saturated wash.
            background:
              "radial-gradient(110% 80% at 50% 55%, rgba(0,130,70,0.10), rgba(0,0,0,0) 65%), radial-gradient(80% 50% at 50% 115%, rgba(0,130,70,0.11), rgba(0,0,0,0) 70%)",
          }}
        />

        {/* Steps 3-8, INSIDE the machine: the very same InfrastructureSection card (unchanged
            markup, no background of its own), starting small and deep and flown towards by this
            screen's pin — not a separate section scrolling up from below. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <InfrastructureSectionClient
            embedded
            cardRef={cardRef}
            fillRef={fillRef}
            steps={steps}
            className=""
            machineServer={machineServer}
            stackLayers={null}
            pinScrollDistance={0}
          />
        </div>
      </div>

      {/* Placeholder that pre-reserves the same scroll distance GSAP's pin-spacer will later
          add (see useMachineScrollAnimation, where it's collapsed to 0 right before that real
          pin-spacer is created) — server-rendered so the page is the SAME total height before
          and after client JS runs, and so the collapse-before-pin-capture sequencing described
          above works out to exactly a full-viewport pin snapshot. Mirrors Hero/Infrastructure's
          identical fix for an identical bug (see PROJECT.md). */}
      <div ref={ssrScrollReserveRef} aria-hidden="true" style={{ height: MACHINE_PIN_SCROLL_DISTANCE }} />
    </section>
  );
}
