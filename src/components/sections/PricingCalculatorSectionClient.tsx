"use client";

import Image from "next/image";
import { useRef } from "react";
import { usePricingScrollAnimation } from "@/animations/pricingScrollAnimation";
import {
  PRICING_ROWS,
  PRICING_PIN_SCROLL_DISTANCE,
  formatDetail,
  formatRowPrice,
  formatTotal,
  computeTotal,
} from "@/lib/pricingLayout";

// Built from a user-supplied screenshot (see PROJECT.md) — heading/paragraph typography below is
// exact, per explicit spec. The calculator card's exact spacing/assets are NOT spec'd yet
// ("დანარჩენს მერე მოგაწვდი დეტალურად" — the rest of the details later); it's a placeholder
// approximation of the screenshot's layout, not pixel-measured. The stepper's qty/detail/prices/
// total are all live (see pricingScrollAnimation.ts) — the scroll-driven sequence AND direct clicks
// on the +/- buttons both drive the same numbers, clamped to each row's real min/max.
//
// Column 1's machine diagram uses the real supplied assets (public/pricesection/*.svg). Their
// layout is derived, not eyeballed: line.svg (83x151) is a single connector whose two ends are
// meant to land on the vertical centers of the website/API pods and whose midpoint bulge is where
// it meets the DEVO Agent pod — so a 44px gap between the two 107px-tall pods makes the connector's
// own height exactly span center-to-center (107/2 + 44 + 107/2 = 151), and the agent pod's vertical
// center then falls naturally on the connector's own midpoint.
const POD_WIDTH = 163;
const WEBSITE_API_HEIGHT = 107;
const POD_GAP = 44;
const LINE_WIDTH = 83;
const LINE_HEIGHT = 151;
const AGENT_HEIGHT = 124;
const STACK_HEIGHT = WEBSITE_API_HEIGHT * 2 + POD_GAP;
const AGENT_TOP = (STACK_HEIGHT - AGENT_HEIGHT) / 2;
const AGENT_LEFT = POD_WIDTH + LINE_WIDTH;
const DIAGRAM_WIDTH = AGENT_LEFT + POD_WIDTH;

// Label/badge typography below is exact, per explicit spec: "leading-trim: NONE" has no direct CSS
// equivalent, dropped — `leading-none` (100% line-height) covers the rest.
function DiagramPod({
  border,
  borderWidth,
  borderHeight,
  icon,
  iconWidth,
  iconHeight,
  alt,
  label,
  labelWeight,
  labelSize,
  badge,
}: {
  border: string;
  borderWidth: number;
  borderHeight: number;
  icon: string;
  iconWidth: number;
  iconHeight: number;
  alt: string;
  label: string;
  labelWeight: "font-light" | "font-normal";
  labelSize: "text-[12px]" | "text-[14px]";
  badge?: string;
}) {
  return (
    <div className="relative" style={{ width: borderWidth, height: borderHeight }}>
      <Image src={border} alt="" width={borderWidth} height={borderHeight} aria-hidden="true" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="relative">
          <Image src={icon} alt={alt} width={iconWidth} height={iconHeight} />
          {badge ? (
            <span className="absolute -top-3 left-full ml-1 whitespace-nowrap font-heading text-[12px] leading-none font-medium tracking-[-0.02em] text-white/50">
              {badge}
            </span>
          ) : null}
        </div>
        <span
          className={`whitespace-nowrap font-heading leading-none tracking-[-0.02em] text-foreground ${labelWeight} ${labelSize}`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

interface StepperRowProps {
  row: (typeof PRICING_ROWS)[number];
  qtyRef: (el: HTMLSpanElement | null) => void;
  detailRef: (el: HTMLParagraphElement | null) => void;
  priceRef: (el: HTMLSpanElement | null) => void;
  plusRef: (el: HTMLButtonElement | null) => void;
  minusRef: (el: HTMLButtonElement | null) => void;
  onPlusClick: () => void;
  onMinusClick: () => void;
}

// No `border-t` between rows anymore — it doubled up with the page's own faint background grid
// lines (BackgroundLines.tsx) running behind the card, reading as a cluttered "ruled notebook page"
// effect (explicit user complaint, 2026-09-18). Removing the extra artificial dividers leaves just
// the page's own ambient horizontal lines, consistent with every other card on this page (none of
// which draw their own internal row dividers either). `py-8` (32px top + 32px bottom) gives an exact
// 64px gap between one row's detail line and the next row's label, per explicit spec.
function StepperRow({ row, qtyRef, detailRef, priceRef, plusRef, minusRef, onPlusClick, onMinusClick }: StepperRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-8">
      <div>
        <p className="font-heading text-[16px] leading-none font-medium tracking-[-0.02em] text-foreground">
          {row.label}
        </p>
        <p ref={detailRef} className="mt-1 font-heading text-[12px] leading-none font-normal text-white/40">
          {formatDetail(row.start, row)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          ref={minusRef}
          type="button"
          aria-label={`Decrease ${row.label}`}
          onClick={onMinusClick}
          className="flex size-8 cursor-pointer items-center justify-center"
        >
          <Image src="/pricesection/minus.svg" alt="" width={28} height={28} />
        </button>
        <span ref={qtyRef} className="inline-block w-4 text-center font-heading text-[18px] text-foreground">
          {row.start}
        </span>
        <button
          ref={plusRef}
          type="button"
          aria-label={`Increase ${row.label}`}
          onClick={onPlusClick}
          className="flex size-8 cursor-pointer items-center justify-center"
        >
          <Image src="/pricesection/plus.svg" alt="" width={28} height={28} />
        </button>
        <span
          ref={priceRef}
          className="inline-block w-16 text-right font-heading text-[12px] leading-none font-normal text-white/60"
        >
          {formatRowPrice(row.start, row.rate)}
        </span>
      </div>
    </div>
  );
}

export function PricingCalculatorSectionClient() {
  const cardRef = useRef<HTMLDivElement>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);
  const qtyRefs = useRef<(HTMLElement | null)[]>([]);
  const detailRefs = useRef<(HTMLElement | null)[]>([]);
  const priceRefs = useRef<(HTMLElement | null)[]>([]);
  const plusRefs = useRef<(HTMLElement | null)[]>([]);
  const minusRefs = useRef<(HTMLElement | null)[]>([]);
  const totalRef = useRef<HTMLElement | null>(null);
  const lineGreenRef = useRef<HTMLElement | null>(null);

  const { onPlusClick, onMinusClick } = usePricingScrollAnimation({
    cardRef,
    qtyRefs,
    detailRefs,
    priceRefs,
    plusRefs,
    minusRefs,
    totalRef,
    lineGreenRef,
    ssrScrollReserveRef,
  });

  const startQty = PRICING_ROWS.map((row) => row.start);

  return (
    <section id="pricing" className="relative px-6 py-24 md:py-32">
      <h2 className="mx-auto max-w-[1220px] text-center font-heading text-[96px] leading-none font-medium tracking-[-0.02em] text-brand">
        Know your hosting bill before you launch.
      </h2>

      <p className="mx-auto mt-8 max-w-[1300px] text-center font-heading text-[26px] leading-none font-light tracking-[-0.02em] text-white/70">
        Choose the CPU, memory, and storage your project needs and see the monthly price before you
        deploy. Need more capacity later? You&rsquo;ll see the new price before making the change.
      </p>

      {/* Card — chamfered top-left corner (the working 5-point clip-path noted in PROJECT.md from
          an earlier, reverted exploration on InfrastructureSection's card). Chamfer size (48px)
          and the 3-column proportions below are eyeballed from the screenshot, not measured. */}
      <div
        ref={cardRef}
        className="relative mx-auto mt-16 w-[85%] border border-white/10 min-[1800px]:w-[1722px]"
        style={{ clipPath: "polygon(48px 0, 100% 0, 100% 100%, 0 100%, 0 48px)" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr_1fr] md:divide-x md:divide-white/10">
          {/* Column 1 — machine diagram, built from the real supplied assets (see DiagramPod /
              layout constants above). */}
          <div className="flex flex-col justify-between gap-12 p-8 md:p-10">
            <p className="font-heading text-[22px] leading-none font-light tracking-[-0.02em] text-white/50">
              Machine: my-project
            </p>

            <div className="flex justify-center">
              <div className="relative" style={{ width: DIAGRAM_WIDTH, height: STACK_HEIGHT }}>
                <div className="absolute top-0 left-0">
                  <DiagramPod
                    border="/pricesection/websiteborder.svg"
                    borderWidth={POD_WIDTH}
                    borderHeight={WEBSITE_API_HEIGHT}
                    icon="/pricesection/website.svg"
                    iconWidth={48}
                    iconHeight={48}
                    alt="Website"
                    label="Website"
                    labelWeight="font-light"
                    labelSize="text-[14px]"
                    badge="POD"
                  />
                </div>

                <div className="absolute left-0" style={{ top: WEBSITE_API_HEIGHT + POD_GAP }}>
                  <DiagramPod
                    border="/pricesection/api-broder.svg"
                    borderWidth={POD_WIDTH}
                    borderHeight={WEBSITE_API_HEIGHT}
                    icon="/pricesection/api.svg"
                    iconWidth={48}
                    iconHeight={48}
                    alt="API"
                    label="API"
                    labelWeight="font-light"
                    labelSize="text-[14px]"
                    badge="POD"
                  />
                </div>

                {/* Connector: a permanent gray base (matches the pod borders' own stroke) with the
                    green line.svg stacked on top, starting fully transparent — its opacity is
                    scrubbed 0→1 by raw scroll progress in usePricingScrollAnimation, so it reads as
                    the line gradually colorizing green as you scroll, rather than switching. */}
                <div
                  className="absolute"
                  style={{ left: POD_WIDTH, top: WEBSITE_API_HEIGHT / 2, width: LINE_WIDTH, height: LINE_HEIGHT }}
                >
                  <Image
                    src="/pricesection/line-gray.svg"
                    alt=""
                    width={LINE_WIDTH}
                    height={LINE_HEIGHT}
                    aria-hidden="true"
                    className="absolute inset-0"
                  />
                  <Image
                    ref={(el) => {
                      lineGreenRef.current = el;
                    }}
                    src="/pricesection/line.svg"
                    alt=""
                    width={LINE_WIDTH}
                    height={LINE_HEIGHT}
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{ opacity: 0 }}
                  />
                </div>

                <div className="absolute" style={{ left: AGENT_LEFT, top: AGENT_TOP }}>
                  <DiagramPod
                    border="/pricesection/agentborder.svg"
                    borderWidth={POD_WIDTH}
                    borderHeight={AGENT_HEIGHT}
                    icon="/pricesection/devoagent.svg"
                    iconWidth={36}
                    iconHeight={57}
                    alt="DEVO Agent"
                    label="DEVO Agent"
                    labelWeight="font-normal"
                    labelSize="text-[12px]"
                  />
                </div>
              </div>
            </div>

            <p className="font-heading text-[18px] leading-none font-normal tracking-[-0.02em] text-white/50">
              Your machine is here.
            </p>
          </div>

          {/* Column 2 — pricing rows. Qty/row-price/total text is driven live by
              usePricingScrollAnimation (see refs above) — the numbers below are just the SSR/start
              state. */}
          <div className="flex flex-col justify-between gap-8 p-8 md:p-10">
            <div>
              <p className="font-heading text-[22px] leading-none font-light tracking-[-0.02em] text-white/50">
                Pricing
              </p>
              <div>
                {PRICING_ROWS.map((row, i) => (
                  <StepperRow
                    key={row.id}
                    row={row}
                    qtyRef={(el) => {
                      qtyRefs.current[i] = el;
                    }}
                    detailRef={(el) => {
                      detailRefs.current[i] = el;
                    }}
                    priceRef={(el) => {
                      priceRefs.current[i] = el;
                    }}
                    plusRef={(el) => {
                      plusRefs.current[i] = el;
                    }}
                    minusRef={(el) => {
                      minusRefs.current[i] = el;
                    }}
                    onPlusClick={() => onPlusClick(i)}
                    onMinusClick={() => onMinusClick(i)}
                  />
                ))}
              </div>
            </div>

            {/* No border-t here either, per the same "let the page's own ambient background grid
                show through instead of drawing a card-local line" request as StepperRow above. */}
            <div className="flex items-baseline justify-between">
              <span className="font-heading text-[18px] leading-none font-normal tracking-[-0.02em] text-white/50">
                Your monthly price
              </span>
              <span
                ref={(el) => {
                  totalRef.current = el;
                }}
                className="inline-block font-heading text-[24px] leading-none font-bold tracking-[-0.02em] text-[#11A32ACC]"
              >
                {formatTotal(computeTotal(startQty, PRICING_ROWS))}
              </span>
            </div>
          </div>

          {/* Column 3 — "predictability, not cheapness" callout. Fixed px gaps (not `justify-between`
              distribution) per explicit spec: 106px between the eyebrow and "Not a surprise.", 49px
              between that and the price box. */}
          <div className="flex flex-col p-8 md:p-10">
            <p className="font-heading text-[22px] leading-none font-light tracking-[-0.02em] text-white/50">
              predictability, not cheapness
            </p>

            <p className="mt-[106px] text-center font-heading text-[24px] leading-none font-normal text-foreground">
              Not a surprise.
            </p>

            <div
              className="mx-auto mt-[49px] flex w-[344px] items-center justify-center rounded-[4px] border border-[#FFFFFF26]"
              style={{ height: 64 }}
            >
              <p className="font-heading text-[18px] leading-none font-normal tracking-[-0.02em] text-white/70">
                From $15 / month
              </p>
            </div>
          </div>
        </div>
      </div>

      <div ref={ssrScrollReserveRef} aria-hidden="true" style={{ height: PRICING_PIN_SCROLL_DISTANCE }} />

      {/* Real bug, not a guess: this is the LAST section on the page, and the pin's "center
          center" start needs the card to reach the viewport's vertical center — which, this close
          to the document's end, means the browser needs roughly another half-viewport of trailing
          height below the pin just to physically scroll that far (verified with a Playwright
          scroll-scan: without this, scrollY clamped ~174px short of the pin's true end at 1080px
          viewport height, permanently stranding the sequence one press short). `min-h-[60vh]`
          scales with viewport height, so the margin holds at any screen size — the math: required
          trailing space is `0.5*viewportHeight - 366px` (366 comes from this page's own fixed
          layout above), and `0.6*viewportHeight` clears that for every realistic viewport height. */}
      <div aria-hidden="true" className="min-h-[60vh]" />
    </section>
  );
}
