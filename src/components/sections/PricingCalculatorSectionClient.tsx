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
import { chamferClipPath, chamferDiagonalStyle } from "@/lib/chamfer";
import { s } from "@/lib/grid";

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
  labelSize: "text-[calc(var(--s)*12)]" | "text-[calc(var(--s)*14)]";
  badge?: string;
}) {
  return (
    <div className="relative" style={{ width: s(borderWidth), height: s(borderHeight) }}>
      <Image src={border} alt="" width={borderWidth} height={borderHeight} aria-hidden="true" className="h-full w-full" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="relative">
          <Image
            src={icon}
            alt={alt}
            width={iconWidth}
            height={iconHeight}
            style={{ width: s(iconWidth), height: s(iconHeight) }}
          />
          {badge ? (
            <span className="absolute -top-3 left-full ml-1 whitespace-nowrap font-heading text-[calc(var(--s)*12)] leading-none font-medium tracking-[-0.02em] text-white/50">
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
        <p className="font-heading text-[calc(var(--s)*16)] leading-none font-medium tracking-[-0.02em] text-foreground">
          {row.label}
        </p>
        <p ref={detailRef} className="mt-1 font-heading text-[calc(var(--s)*12)] leading-none font-normal text-white/40">
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
        <span ref={qtyRef} className="inline-block w-4 text-center font-heading text-[calc(var(--s)*18)] text-foreground">
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
          className="inline-block w-16 text-right font-heading text-[calc(var(--s)*12)] leading-none font-normal text-white/60"
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
      <h2 className="mx-auto max-w-[calc(var(--s)*1220)] text-center font-heading text-[calc(var(--s)*96)] leading-none font-medium tracking-[-0.02em] text-brand">
        Know your hosting bill before you launch.
      </h2>

      <p className="mx-auto mt-8 max-w-[calc(var(--s)*1300)] text-center font-heading text-[calc(var(--s)*26)] leading-none font-light tracking-[-0.02em] text-white/70">
        Choose the CPU, memory, and storage your project needs and see the monthly price before you
        deploy. Need more capacity later? You&rsquo;ll see the new price before making the change.
      </p>

      {/* Card — chamfered top-left corner via the shared `chamfer.ts` helpers (see that file for
          why the diagonal accent div is needed alongside `clip-path`, not just a size choice).
          Widened chamfer 48px → `CHAMFER_PX` (64px) and shrunk the card itself (`w-[85%]` →
          `w-[75%]`, `1722px` → `1500px`) per explicit follow-up request, 2026-09-18 — both eyeballed
          adjustments, not measured against anything. The 3-column proportions inside are still
          eyeballed from the original screenshot too. */}
      <div
        ref={cardRef}
        className="relative mx-auto mt-16 w-[75%] border border-white/10 md:w-[calc(var(--s)*1500)]"
        style={{ clipPath: chamferClipPath() }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute bg-white/10" style={chamferDiagonalStyle()} />
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr_1fr] md:divide-x md:divide-white/10">
          {/* Column 1 — machine diagram, built from the real supplied assets (see DiagramPod /
              layout constants above). */}
          <div className="flex flex-col justify-between gap-12 p-8 md:p-10">
            <p className="font-heading text-[calc(var(--s)*22)] leading-none font-light tracking-[-0.02em] text-white/50">
              Machine: my-project
            </p>

            <div className="flex justify-center">
              <div className="relative" style={{ width: s(DIAGRAM_WIDTH), height: s(STACK_HEIGHT) }}>
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
                    labelSize="text-[calc(var(--s)*14)]"
                    badge="POD"
                  />
                </div>

                <div className="absolute left-0" style={{ top: s(WEBSITE_API_HEIGHT + POD_GAP) }}>
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
                    labelSize="text-[calc(var(--s)*14)]"
                    badge="POD"
                  />
                </div>

                {/* Connector: a permanent gray base (matches the pod borders' own stroke) with the
                    green line.svg stacked on top, starting fully transparent — its opacity is
                    scrubbed 0→1 by raw scroll progress in usePricingScrollAnimation, so it reads as
                    the line gradually colorizing green as you scroll, rather than switching. */}
                <div
                  className="absolute"
                  style={{ left: s(POD_WIDTH), top: s(WEBSITE_API_HEIGHT / 2), width: s(LINE_WIDTH), height: s(LINE_HEIGHT) }}
                >
                  <Image
                    src="/pricesection/line-gray.svg"
                    alt=""
                    width={LINE_WIDTH}
                    height={LINE_HEIGHT}
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full"
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
                    className="absolute inset-0 h-full w-full"
                    style={{ opacity: 0 }}
                  />
                </div>

                <div className="absolute" style={{ left: s(AGENT_LEFT), top: s(AGENT_TOP) }}>
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
                    labelSize="text-[calc(var(--s)*12)]"
                  />
                </div>
              </div>
            </div>

            <p className="font-heading text-[calc(var(--s)*18)] leading-none font-normal tracking-[-0.02em] text-white/50">
              Your machine is here.
            </p>
          </div>

          {/* Column 2 — pricing rows. Qty/row-price/total text is driven live by
              usePricingScrollAnimation (see refs above) — the numbers below are just the SSR/start
              state. */}
          <div className="flex flex-col justify-between gap-8 p-8 md:p-10">
            <div>
              <p className="font-heading text-[calc(var(--s)*22)] leading-none font-light tracking-[-0.02em] text-white/50">
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
              <span className="font-heading text-[calc(var(--s)*18)] leading-none font-normal tracking-[-0.02em] text-white/50">
                Your monthly price
              </span>
              <span
                ref={(el) => {
                  totalRef.current = el;
                }}
                className="inline-block font-heading text-[calc(var(--s)*24)] leading-none font-bold tracking-[-0.02em] text-[#11A32ACC]"
              >
                {formatTotal(computeTotal(startQty, PRICING_ROWS))}
              </span>
            </div>
          </div>

          {/* Column 3 — "predictability, not cheapness" callout. Fixed px gaps (not `justify-between`
              distribution) per explicit spec: 106px between the eyebrow and "Not a surprise.", 49px
              between that and the price box. */}
          <div className="flex flex-col p-8 md:p-10">
            <p className="font-heading text-[calc(var(--s)*22)] leading-none font-light tracking-[-0.02em] text-white/50">
              predictability, not cheapness
            </p>

            <p className="mt-[calc(var(--s)*106)] text-center font-heading text-[calc(var(--s)*24)] leading-none font-normal text-foreground">
              Not a surprise.
            </p>

            <div
              className="mx-auto mt-[calc(var(--s)*49)] flex w-[calc(var(--s)*344)] items-center justify-center rounded-[4px] border border-[#FFFFFF26]"
              style={{ height: 64 }}
            >
              <p className="font-heading text-[calc(var(--s)*18)] leading-none font-normal tracking-[-0.02em] text-white/70">
                From $15 / month
              </p>
            </div>
          </div>
        </div>
      </div>

      <div ref={ssrScrollReserveRef} aria-hidden="true" style={{ height: s(PRICING_PIN_SCROLL_DISTANCE) }} />

      {/* This used to be `min-h-[60vh]`: when PricingCalculatorSection was the LAST section on the
          page, the "center center" pin needed roughly another half-viewport of trailing height below
          it just to physically scroll that far (see PROJECT.md for the original diagnosed bug —
          scrollY clamped short of the pin's true end, permanently stranding the sequence one press
          short). Now that BuildSection follows with real, substantial height of its own, that
          trailing margin is already satisfied by real content — the artificial spacer just added a
          large, empty-looking gap between the two sections (user-reported 2026-09-18). Shrunk to a
          much smaller fixed buffer, kept only as cheap insurance against a future layout change
          removing BuildSection's height; re-verified via scroll-scan that the pin still completes
          fully to $40.45 with this much smaller value. */}
      <div aria-hidden="true" className="h-16" />
    </section>
  );
}
