"use client";

import Image from "next/image";
import { useCallback, useRef } from "react";
import { InfrastructureSectionClient } from "./InfrastructureSectionClient";
import { useRasterizedSvg } from "@/hooks/useRasterizedSvg";
import type { InfrastructureStep } from "@/lib/infrastructureSteps";
import type { MachineServerParts } from "@/lib/machineServerParts";
import { BlurChars } from "@/components/ui/BlurChars";
import { BLUR_HIDDEN_FILTER, BLUR_HIDDEN_Y_PX } from "@/components/ui/BlurText";
import {
  useMachineScrollAnimation,
  measureServerBox,
  measureDiagramBox,
  TOPSIDE_HIDDEN_SCALE,
} from "@/animations/machineScrollAnimation";
import { MACHINE_PIN_SCROLL_DISTANCE, MACHINE_SKIP_INTRO_PIN_SCROLL_DISTANCE } from "@/lib/machineLayout";
import { useGridMarks } from "@/lib/gridEffect/useGridMarks";
import { vw, s, HEADER_HEIGHT_PX } from "@/lib/grid";

// Hatch mark ("Subtract.svg", the same green diagonal-hatch icon HeroSection/InfrastructureSection
// use for their eyebrow rows) sized to roughly match the wordmark's cap height at the 1920
// reference, then scaled with vw like the wordmark itself so the two stay in proportion at any
// width.
const HATCH_WIDTH_PX = 125;
const HATCH_NATIVE_WIDTH = 58;
const HATCH_NATIVE_HEIGHT = 26;
const WORDMARK_FONT_SIZE_PX = 150;
const WORDMARK_GAP_PX = 28;

// The 4 corner crosses are no longer <Image src="cross.svg"> elements at hand-tuned offsets from
// the wordmark — they are drawn BY the background grid, at real grid intersections chosen around
// the wordmark's box for whatever viewport this is (see lib/gridEffect/useGridMarks.ts).
//
// The comment that used to sit here argued grid-snapping was impossible because "the page-absolute
// Y depends on how much content sits above it". That stopped being true: the grid is `fixed`, i.e.
// viewport space, and this section is pinned (also viewport space) for the whole time the crosses
// are visible — so the intersection under a given corner is perfectly deterministic. These two
// numbers are now the REQUESTED gap before snapping, not the final offset: the snap may land the
// cross a little nearer or further, and it is always exactly on the lines.
const CROSS_GAP_X_PX = 60;
const CROSS_GAP_Y_PX = 70;

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
  // Start at the card flying in, without the wordmark + topside fly-through (machineLayout.ts).
  skipIntro?: boolean;
}

const TOPSIDE_RASTER_WIDTH = 1376; // 2x topside.svg's own 688 — see useRasterizedSvg

export function MachineSectionClient({ steps, machineServer, skipIntro = false }: MachineSectionClientProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const hatchRef = useRef<HTMLDivElement>(null);
  const topsideRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const cardServerRef = useRef<HTMLDivElement>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);
  // How open the server is (0 closed .. 1 fully split) — written every frame the split is moving,
  // read by `serverBox` below, so the server's own grid marks open/close WITH it instead of sitting
  // pre-expanded the whole time (per feedback 2026-09-21).
  const serverSepFractionRef = useRef(0);

  const topsideRaster = useRasterizedSvg("/infrastructur/topside.svg", TOPSIDE_RASTER_WIDTH);

  // Four grid intersections around the wordmark block. The hook owns WHERE they are (re-snapped on
  // resize and on every ScrollTrigger refresh); the animation below owns how visible they are.
  const gridMarks = useGridMarks(wordmarkRef, { gapX: CROSS_GAP_X_PX, gapY: CROSS_GAP_Y_PX });

  // Four MORE sets, one per piece of steps 3-8 content — replaces an earlier single shared frame
  // that got both the server's pose and the diagrams' position wrong (grid-trail.md §7). Each uses
  // `fit: "center"` (content centred between the crosses, not snapped to an edge) and a `box()`
  // that measures its anchor relative to the pinned stage with the card's own approach-scale
  // forced to 1 — correct at any time, not just once the card has already landed. `anchorRef`
  // itself (`cardRef`) is unused whenever `box` is supplied; passed only to satisfy the hook's
  // signature. Refs are read INSIDE each callback's own body (not passed as arguments to another
  // function) — react-hooks/refs flags the latter even when nothing is actually read until later.
  const serverBox = useCallback(() => {
    const stage = stageRef.current;
    const server = cardServerRef.current;
    const card = cardRef.current;
    if (!stage || !server || !card) return null;
    return measureServerBox(stage, server, card, serverSepFractionRef.current);
  }, []);
  const infraBox = useCallback(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return null;
    return measureDiagramBox(stage, card, 2);
  }, []);
  const deployBox = useCallback(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return null;
    return measureDiagramBox(stage, card, 3);
  }, []);
  const agentBox = useCallback(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return null;
    return measureDiagramBox(stage, card, 4);
  }, []);

  // `balance: false`: the closed server's own top edge happens to sit only ~9px from a grid line —
  // just inside the "too close, push out" threshold — so the tightest enclosing pair already has a
  // full extra row's worth of top clearance (~105px) before any balancing runs at all. "center"'s
  // default equal-gap step then widened the BOTTOM edge by a further row too, trying to match that
  // (already-inflated) top gap — which pushed the bottom pair off the bottom of a 1080-tall viewport
  // entirely (confirmed by re-running at a taller viewport: it reappears at ~y=1122). Skipping the
  // balance step keeps both edges at the tightest pair that clears the box by minGap independently —
  // both pairs stay on screen, which is what "visible even before it starts splitting" needs.
  const serverMarks = useGridMarks(cardRef, { gapX: 0, gapY: 0, fit: "center", balance: false, box: serverBox });
  const infraMarks = useGridMarks(cardRef, { gapX: 0, gapY: 0, fit: "center", box: infraBox });
  const deployMarks = useGridMarks(cardRef, { gapX: 0, gapY: 0, fit: "center", box: deployBox });
  const agentMarks = useGridMarks(cardRef, { gapX: 0, gapY: 0, fit: "center", box: agentBox });

  useMachineScrollAnimation({
    sectionRef,
    wordmarkRef,
    hatchRef,
    gridMarks,
    serverMarks,
    infraMarks,
    deployMarks,
    agentMarks,
    serverSepFractionRef,
    topsideRef,
    tintRef,
    cardRef,
    fillRef,
    stepCount: steps.length,
    ssrScrollReserveRef,
    skipIntro,
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

          {/* The 4 corner cross marks used to live here as cross.svg images. They are now part of
              the background grid itself — see the gridMarks hook above. */}
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
        {/* Centred in the space UNDER the header, not in the raw viewport: the header is sticky and
            sits over the top of this pinned screen, so plain viewport centring read as too high.
            Only this layer is padded — the wordmark and topside.svg above stay centred on the
            viewport itself, which is what the fly-through is built around. */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ paddingTop: HEADER_HEIGHT_PX }}
        >
          <InfrastructureSectionClient
            embedded
            cardRef={cardRef}
            fillRef={fillRef}
            serverRef={cardServerRef}
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
      <div
        ref={ssrScrollReserveRef}
        aria-hidden="true"
        style={{ height: s(skipIntro ? MACHINE_SKIP_INTRO_PIN_SCROLL_DISTANCE : MACHINE_PIN_SCROLL_DISTANCE) }}
      />
    </section>
  );
}
