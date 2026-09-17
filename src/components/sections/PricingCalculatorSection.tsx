// Built from a user-supplied screenshot (see PROJECT.md) — heading/paragraph typography below is
// exact, per explicit spec. The calculator card's exact spacing/assets/interactivity are NOT
// spec'd yet ("დანარჩენს მერე მოგაწვდი დეტალურად" — the rest of the details later); it's a
// placeholder approximation of the screenshot's layout/labels/numbers, not pixel-measured, and the
// +/- controls are non-interactive (no pricing formula is decipherable from the screenshot alone —
// the per-row prices don't sum to the shown total, so it isn't a simple linear calculation).

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
          {/* Column 1 — machine diagram. Website/API/DEVO Agent icons and the connector lines from
              the screenshot are placeholder boxes here (no icon assets supplied yet), not the real
              assets. */}
          <div className="flex flex-col justify-between gap-12 p-8 md:p-10">
            <p className="font-heading text-[15px] text-white/50">Machine: my-project</p>

            <div className="flex items-center justify-center gap-6">
              <div className="flex flex-col gap-4">
                <div className="border border-white/15 px-4 py-3 text-center">
                  <p className="font-heading text-[13px] text-white/70">Website</p>
                  <p className="mt-1 font-heading text-[10px] text-white/30">POD</p>
                </div>
                <div className="border border-white/15 px-4 py-3 text-center">
                  <p className="font-heading text-[13px] text-white/70">API</p>
                  <p className="mt-1 font-heading text-[10px] text-white/30">POD</p>
                </div>
              </div>
              <div className="h-px w-8 bg-white/20" aria-hidden="true" />
              <div className="border border-brand px-6 py-5 text-center">
                <p className="font-heading text-[13px] text-foreground">DEVO Agent</p>
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
