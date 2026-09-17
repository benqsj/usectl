import Image from "next/image";

// Built from a user-supplied screenshot (see PROJECT.md) — heading/paragraph typography below is
// exact, per explicit spec. The calculator card's exact spacing/assets/interactivity are NOT
// spec'd yet ("დანარჩენს მერე მოგაწვდი დეტალურად" — the rest of the details later); it's a
// placeholder approximation of the screenshot's layout/labels/numbers, not pixel-measured, and the
// +/- controls are non-interactive (no pricing formula is decipherable from the screenshot alone —
// the per-row prices don't sum to the shown total, so it isn't a simple linear calculation).
//
// Column 1's machine diagram uses the real supplied assets (public/pricesection/*.svg). Their
// layout is derived, not eyeballed: line.svg (83x151) is a single connector whose two ends are
// meant to land on the vertical centers of the website/API pods and whose midpoint bulge is where
// it meets the DEVO Agent pod — so a 44px gap between the two 107px-tall pods makes the connector's
// own height exactly span center-to-center (107/2 + 44 + 107/2 = 151), and the agent pod's vertical
// center then falls naturally on the connector's own midpoint. See PRICING_DIAGRAM below.
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

// Label/badge typography below is exact, per explicit spec (2026-09-18): "leading-trim: NONE" has
// no direct CSS equivalent, dropped — `leading-none` (100% line-height) covers the rest.
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

const PRICING_ROWS = [
  { label: "vCPU", detail: "1 vCPU — $10.00/mo - Max 16", qty: 2, price: "$20/mo" },
  { label: "Memory", detail: "1 GB — $5.00/mo - Max 64GB", qty: 4, price: "$25/mo" },
  { label: "Storage", detail: "1 GB — $0.10/mo - Max 1TB", qty: 4, price: "$30/mo" },
] as const;

function StepperRow({ label, detail, qty, price }: (typeof PRICING_ROWS)[number]) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/10 py-6 first:border-t-0">
      <div>
        <p className="font-heading text-[18px] font-medium text-foreground">{label}</p>
        <p className="mt-1 font-heading text-[14px] text-white/40">{detail}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center border border-white/20 text-white/70">−</div>
        <span className="w-4 text-center font-heading text-[18px] text-foreground">{qty}</span>
        <div className="flex size-8 items-center justify-center border border-white/20 text-white/70">+</div>
        <span className="w-16 text-right font-heading text-[16px] text-white/60">{price}</span>
      </div>
    </div>
  );
}

export function PricingCalculatorSection() {
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
        className="relative mx-auto mt-16 w-[85%] border border-white/10 min-[1800px]:w-[1722px]"
        style={{ clipPath: "polygon(48px 0, 100% 0, 100% 100%, 0 100%, 0 48px)" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr_1fr] md:divide-x md:divide-white/10">
          {/* Column 1 — machine diagram, built from the real supplied assets (see DiagramPod /
              PRICING_DIAGRAM math above). */}
          <div className="flex flex-col justify-between gap-12 p-8 md:p-10">
            <p className="font-heading text-[15px] text-white/50">Machine: my-project</p>

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

                <Image
                  src="/pricesection/line.svg"
                  alt=""
                  width={LINE_WIDTH}
                  height={LINE_HEIGHT}
                  aria-hidden="true"
                  className="absolute"
                  style={{ left: POD_WIDTH, top: WEBSITE_API_HEIGHT / 2 }}
                />

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

            <p className="font-heading text-[15px] text-white/50">Your machine is here.</p>
          </div>

          {/* Column 2 — pricing rows. */}
          <div className="flex flex-col justify-between gap-8 p-8 md:p-10">
            <div>
              <p className="font-heading text-[15px] text-white/50">Pricing</p>
              <div>
                {PRICING_ROWS.map((row) => (
                  <StepperRow key={row.label} {...row} />
                ))}
              </div>
            </div>

            <div className="flex items-baseline justify-between border-t border-white/10 pt-6">
              <span className="font-heading text-[15px] text-white/50">Your monthly price</span>
              <span className="font-heading text-[32px] font-bold text-brand">$40.45</span>
            </div>
          </div>

          {/* Column 3 — "predictability, not cheapness" callout. */}
          <div className="flex flex-col justify-between gap-12 p-8 md:p-10">
            <p className="font-heading text-[15px] text-white/50">predictability, not cheapness</p>

            <p className="text-center font-heading text-[28px] text-foreground">Not a surprise.</p>

            <div className="border border-white/20 py-4 text-center">
              <p className="font-heading text-[16px] text-white/70">From $15 / month</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
