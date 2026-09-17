"use client";

import Image from "next/image";
import { useRef } from "react";
import { BlurChars } from "@/components/ui/BlurChars";
import { BLUR_HIDDEN_FILTER, BLUR_HIDDEN_Y_PX } from "@/components/ui/BlurText";
import { useMachineScrollAnimation, CROSS_HIDDEN_SCALE } from "@/animations/machineScrollAnimation";
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

export function MachineSectionClient() {
  const sectionRef = useRef<HTMLElement>(null);
  const hatchRef = useRef<HTMLDivElement>(null);
  const crossRefs = useRef<(HTMLImageElement | null)[]>([]);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);

  useMachineScrollAnimation({ sectionRef, hatchRef, crossRefs, ssrScrollReserveRef });

  return (
    // Outer <section> is a plain block (no height of its own beyond its children) — deliberately
    // NOT `min-h-screen` itself, so the trailing ssrScrollReserveRef spacer below adds real EXTRA
    // document height on top of the inner min-h-screen div instead of being absorbed by it. GSAP
    // pins THIS section: at the moment it captures the pin snapshot, the spacer has already
    // collapsed to 0px (see useMachineScrollAnimation), so what actually gets pinned is exactly the
    // inner div's box — a true full-viewport screen, not viewport+700px.
    <section ref={sectionRef} className="relative">
      <div className="flex min-h-screen items-center justify-center">
        <div className="relative inline-flex items-center" style={{ gap: vw(WORDMARK_GAP_PX) }}>
          {/* Hatch mark — SSR-hidden (matches BlurText's BLUR_HIDDEN_* so nothing flashes visible
              before hydration), unblurred/faded in first by useMachineScrollAnimation's entrance. */}
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
      </div>

      {/* Placeholder that pre-reserves the same scroll distance GSAP's pin-spacer will later add
          (see useMachineScrollAnimation, where it's collapsed to 0 right before that real
          pin-spacer is created) — server-rendered so the page is the SAME total height before and
          after client JS runs, and so the collapse-before-pin-capture sequencing described above
          works out to exactly a full-viewport pin snapshot. Mirrors Hero/Infrastructure's identical
          fix for an identical bug (see PROJECT.md). */}
      <div ref={ssrScrollReserveRef} aria-hidden="true" style={{ height: MACHINE_PIN_SCROLL_DISTANCE }} />
    </section>
  );
}
