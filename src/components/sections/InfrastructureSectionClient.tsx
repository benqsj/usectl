"use client";

import Image from "next/image";
import { useRef, type RefObject } from "react";
import { InfrastructureStaticBar } from "./InfrastructureStaticBar";
import { useInfrastructureScrollAnimation } from "@/animations/infrastructureScrollAnimation";
import type { InfrastructureStep } from "@/lib/infrastructureSteps";
import { BlurText } from "@/components/ui/BlurText";
import type { MachineServerParts } from "@/lib/machineServerParts";
import { chamferClipPath, chamferDiagonalStyle } from "@/lib/chamfer";
import { MachineInfraDiagram } from "./MachineInfraDiagram";
import { MachineDeployDiagram } from "./MachineDeployDiagram";
import { MachineAgentDiagram } from "./MachineAgentDiagram";

// The hero's cap layer is 383 wide, the other layers 372 (both 256 tall) — same ratio as
// HeroSectionClient.tsx. Kept here, NOT imported from serverStackLayers.ts: that module reads the
// files with node:fs and importing a VALUE from it would pull fs into this client bundle (it
// breaks the build; only `import type` from a server-only module is safe).

const STACK_CAP_WIDTH_PERCENT = (383 / 372) * 100;

interface InfrastructureSectionClientProps {
  steps: InfrastructureStep[];
  className: string;
  // 2-part titanium server (intro) — animated. null when this section doesn't have it.
  machineServer: MachineServerParts | null;
  // Hero's 4 layer SVGs (steps 3-8) — rendered STATIC, no animation yet.
  stackLayers: string[] | null;
  pinScrollDistance: number;
  // EMBEDDED mode: the card is rendered on its own (no <section>, no pin, no SSR spacer) because
  // something else owns the scroll — today that's the machine screen, where steps 3-8 live INSIDE
  // the machine and are driven by machineScrollAnimation.ts. The markup itself is untouched, so
  // both modes render the exact same card.
  embedded?: boolean;
  cardRef?: RefObject<HTMLDivElement | null>;
  fillRef?: RefObject<HTMLDivElement | null>;
}

export function InfrastructureSectionClient({
  steps,
  className,
  machineServer,
  stackLayers,
  pinScrollDistance,
  embedded = false,
  cardRef: externalCardRef,
  fillRef: externalFillRef,
}: InfrastructureSectionClientProps) {
  const internalCardRef = useRef<HTMLDivElement>(null);
  const internalFillRef = useRef<HTMLDivElement>(null);
  const cardRef = externalCardRef ?? internalCardRef;
  const fillRef = externalFillRef ?? internalFillRef;
  const serverRef = useRef<HTMLDivElement>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);

  // Hooks can't be conditional — the hook itself no-ops when it isn't the one driving.
  useInfrastructureScrollAnimation({
    enabled: !embedded,
    cardRef,
    fillRef,
    serverRef,
    ssrScrollReserveRef,
    stepCount: steps.length,
    pinScrollDistance,
    serverOpenOffsetPercent: machineServer ? (machineServer.openOffset / machineServer.height) * 100 : 0,
  });

  const card = (
    <div
      ref={cardRef}
      data-infra-card=""
      className={`relative mx-auto w-[85%] border border-white/10 px-8 pt-6 pb-10 min-[1800px]:w-[1722px] md:px-16 md:pt-8 md:pb-14 ${
        embedded ? "will-change-transform [backface-visibility:hidden]" : ""
      }`}
      style={{ clipPath: chamferClipPath() }}
    >
        {/* Same chamfer technique as Pricing/Footer's own cards (see src/lib/chamfer.ts) — added
            2026-09-18 per an explicit "chamfer every bordered section card, same size" request.
            This card has no background fill of its own (transparent, `border` only), so the
            diagonal accent div is required, not optional — plain `clip-path` alone just clips
            border-top/border-left short with nothing bridging the gap (see chamfer.ts's own
            comment for the full diagnosis). */}
        {/* data-card-diagonal: machineScrollAnimation.ts takes the card's whole outline away on
            steps 6-8 (per feedback — those steps' diagrams are wider than the column and were
            crossing this border), and the chamfer accent has to go with it or a stray diagonal
            stroke is left floating where the corner used to be. */}
        <div
          data-card-diagonal=""
          aria-hidden="true"
          className="pointer-events-none absolute bg-white/10"
          style={chamferDiagonalStyle()}
        />
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

          {/* Right column. Either the animated 2-part titanium server (intro), the hero's 4-layer
              server rendered static (steps 3-8, no animation yet), or nothing — in every case the
              column keeps the same width so the text layout doesn't shift between sections.
              The top margin sits the server on the card's optical centre (the static bar below the
              row pulls that centre down). */}
          <div
            ref={serverRef}
            aria-hidden="true"
            className={`relative w-[260px] shrink-0 md:max-[1799px]:w-[320px] min-[1800px]:w-[650px] ${
              // The machine server is pushed DOWN by a top margin, sitting it on the card's optical
              // centre (the static bar below the row pulls that centre down); the static stack is
              // centred by the row itself.
              //
              // Embedded (steps 3-8) now uses the IDENTICAL margin to the intro rather than one of
              // its own, which is what makes the card's border box the same size on steps 3-5 as it
              // is on steps 1-2 and puts the server at the same height inside it. Two earlier
              // variants are worth not repeating: a bigger top margin (220/255) made this card
              // taller than the intro's, and splitting it evenly (my-60/70) kept the height right
              // but sat the server too high.
              machineServer ? "mt-[120px] min-[1800px]:mt-[140px]" : ""
            } ${
              // Embedded only: the server SITS lower without the column getting any taller. It has
              // to be a transform rather than more margin — margin would grow the card's border box
              // again, and matching the intro's box on steps 3-5 was the whole point of the margin
              // above. Nothing else transforms this element in the embedded card (the scroll
              // animation moves the two server halves inside it, not the column), and the icon
              // cluster measures its position live, so it follows along on its own.
              machineServer && embedded ? "translate-y-[100px] min-[1800px]:translate-y-[115px]" : ""
            }`}
            style={machineServer ? { aspectRatio: `${machineServer.width} / ${machineServer.height}` } : undefined}
          >
            {machineServer && (
              <>
                {/* Bottom part: lit on step 1; drops down when the server opens on step 2. */}
                <div data-server-part="bottom" className="absolute inset-0">
                  <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: machineServer.bottom.dark }} />
                  <div
                    data-server-lit=""
                    className="absolute inset-0"
                    dangerouslySetInnerHTML={{ __html: machineServer.bottom.lit }}
                  />
                </div>
                {/* Top part: lit on step 2. */}
                <div data-server-part="top" className="absolute inset-0">
                  <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: machineServer.top.dark }} />
                  <div
                    data-server-lit=""
                    className="absolute inset-0"
                    style={{ opacity: 0 }}
                    dangerouslySetInnerHTML={{ __html: machineServer.top.lit }}
                  />
                </div>
              </>
            )}

            {/* Step 3 -> step 4 only (inside the machine screen, see machineScrollAnimation.ts):
                the server separates and the infra icons reveal, clustered inside line-circle.svg,
                in the gap between the two halves — then the top half + icons fade into the
                "machine" wordmark, which fades out together with the bottom half. Entirely driven
                by useMachineScrollAnimation (left/top/opacity/scale set every frame from scroll
                progress, scrubbed both ways, per approved demo) — this is just the static markup
                it targets via the data-* selectors below. Gated on `embedded`: this is the one
                card instance living inside the machine screen (steps 3-8); the intro's own
                machineServer (steps 1-2) doesn't get icons/wordmark. */}
            {embedded && machineServer && (
              <>
                <div data-icon-field="" aria-hidden="true" className="pointer-events-none absolute inset-0 z-[6]">
                  {(["storage", "database", "api", "website", "workflow"] as const).map((key) => (
                    <div
                      key={key}
                      data-icon-node={key}
                      className="pointer-events-none absolute opacity-0"
                      style={{ width: "8%", aspectRatio: "1 / 1" }}
                    >
                      <Image
                        src={`/infrastructur/server-icons/${key}.svg`}
                        alt=""
                        width={68}
                        height={68}
                        aria-hidden="true"
                        className="h-full w-full object-contain"
                        style={{ filter: "brightness(2.6) drop-shadow(0 0 8px rgba(255,255,255,0.12))" }}
                      />
                    </div>
                  ))}
                  {/* Stretched non-uniformly (narrower + taller than its native 514:232 ratio) on
                      purpose — object-fit:fill on the <Image>, per feedback. Always reveals last. */}
                  <div
                    data-icon-node="line-circle"
                    className="pointer-events-none absolute opacity-0"
                    style={{ width: "58.8%", aspectRatio: "200 / 110" }}
                  >
                    <Image
                      src="/infrastructur/server-icons/line-circle.svg"
                      alt=""
                      width={514}
                      height={232}
                      aria-hidden="true"
                      className="h-full w-full"
                      style={{ objectFit: "fill", filter: "brightness(2.6) drop-shadow(0 0 8px rgba(255,255,255,0.12))" }}
                    />
                  </div>
                </div>
                <div
                  data-machine-word=""
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-0 font-heading font-bold text-[#f5f5f5] opacity-0"
                  style={{ fontSize: 96, lineHeight: "100%", letterSpacing: "-0.02em" }}
                >
                  machine
                </div>

              </>
            )}

            {stackLayers && (
              // Static 4-layer stack — same geometry as the hero (layers 372x256, cap 383 wide),
              // stacked with a gap of 19% of the stack width. Nothing animates it yet.
              <div
                className="relative mx-auto [--w:160px] md:max-[1799px]:[--w:200px] min-[1800px]:[--w:400px]"
                style={{
                  ["--gap" as string]: "calc(var(--w) * 0.19)",
                  width: "var(--w)",
                  height: "calc(3 * var(--gap) + var(--w) * 256 / 372)",
                }}
              >
                {stackLayers.map((layer, i) => (
                  <div
                    key={i}
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{
                      top: `calc(${i} * var(--gap))`,
                      width: i === 0 ? `${STACK_CAP_WIDTH_PERCENT}%` : "100%",
                      zIndex: stackLayers.length - i,
                    }}
                    dangerouslySetInnerHTML={{ __html: layer }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* The per-step diagrams that take over the right column from step 5 on. Each is off until
            the pinned scroll reaches ITS step (data-diagram-step is the index within this card's
            own steps array: 2 = step 5, 3 = step 6, 4-5 = steps 7+8) and then assembles itself
            piece by piece — all driven by machineScrollAnimation.ts, which reads these data
            attributes and the [data-diagram-item] marks inside each diagram. A step 9 visual would
            just be another entry here.

            They sit at CARD level, not inside the server column, on purpose: the column carries a
            top margin and (embedded) a translate that deliberately push the SERVER down, and while
            the diagrams lived in there they inherited both and hung low. Anchored here they line
            up horizontally with the column (same widths, right edge on the card's own padding)
            while `inset-y-0 items-center` keeps them centred on the card itself. */}
        {embedded && (
          <>
            {/* Step 5 is the one diagram narrower than its column (90%), so centring it left a
                margin on both sides; `justify-end` puts that slack all on the left and sits it
                against the column's right edge. The translate then carries it further right still,
                into the card's own padding — asked for twice, so it now sits close to the card's
                right border (24/40px short of it) rather than on the content line. */}
            <div
              data-machine-diagram=""
              data-diagram-step="2"
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-8 z-[6] flex w-[260px] translate-x-[24px] items-center justify-end opacity-0 md:right-16 md:max-[1799px]:w-[320px] min-[1800px]:w-[650px] min-[1800px]:translate-x-[40px]"
            >
              <MachineInfraDiagram />
            </div>
            <div
              data-machine-diagram=""
              data-diagram-step="3"
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-8 z-[6] flex w-[260px] items-center justify-center opacity-0 md:right-16 md:max-[1799px]:w-[320px] min-[1800px]:w-[650px]"
            >
              <MachineDeployDiagram />
            </div>
            {/* Steps 7 AND 8 (data-diagram-until), not just 8: those two steps deliberately carry
                the SAME heading and paragraph (see infrastructureSteps.ts), so the text visibly
                changes on the way into step 7 — starting this diagram on step 8 left the reader
                looking at new text beside an empty column until they scrolled again. It now
                arrives with the text and stays put across both steps. */}
            <div
              data-machine-diagram=""
              data-diagram-step="4"
              data-diagram-until="5"
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-8 z-[6] flex w-[260px] items-center justify-center opacity-0 md:right-16 md:max-[1799px]:w-[320px] min-[1800px]:w-[650px]"
            >
              <MachineAgentDiagram />
            </div>
          </>
        )}

        <InfrastructureStaticBar fillRef={fillRef} />
    </div>
  );

  // Embedded: just the card — the machine screen positions and animates it.
  if (embedded) return card;

  return (
    <section className={className}>
      {card}
      {/* Placeholder that pre-reserves the same scroll distance GSAP's pin-spacer will later add
          (see useInfrastructureScrollAnimation, where it's collapsed to 0 right before that real
          pin-spacer is created) — server-rendered so the page is the SAME total height before and
          after client JS runs. Mirrors HeroSectionClient.tsx's identical fix for an identical bug
          (see PROJECT.md). */}
      <div ref={ssrScrollReserveRef} aria-hidden="true" style={{ height: pinScrollDistance }} />
    </section>
  );
}
