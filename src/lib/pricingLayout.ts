// Pricing calculator step-count data + math — shared between PricingCalculatorSectionClient.tsx
// (initial/SSR render) and pricingScrollAnimation.ts (the scroll-driven "press" sequence + manual
// click handling), so the two can't drift apart. See PROJECT.md for the reasoning behind
// PRICING_PLATFORM_FEE.

export interface PricingRow {
  id: "vcpu" | "memory" | "storage";
  label: string;
  unit: string; // "vCPU" | "GB" — the detail line's live-updating leading number's unit
  rateLabel: string; // "$10.00/mo" — fixed, display-only
  maxLabel: string; // "Max 16" — fixed, display-only (never changes, per explicit request)
  rate: number; // $ per unit/mo
  min: number; // true floor for manual +/- clicks
  max: number; // true ceiling for manual +/- clicks
  start: number; // qty shown before the scroll-driven sequence has run (== min)
  target: number; // qty the scripted scroll sequence stops at
}

export const PRICING_ROWS: readonly PricingRow[] = [
  {
    id: "vcpu",
    label: "vCPU",
    unit: "vCPU",
    rateLabel: "$10.00/mo",
    maxLabel: "Max 16",
    rate: 10,
    min: 1,
    max: 16,
    start: 1,
    target: 2,
  },
  {
    id: "memory",
    label: "Memory",
    unit: "GB",
    rateLabel: "$5.00/mo",
    maxLabel: "Max 64GB",
    rate: 5,
    min: 1,
    max: 64,
    start: 1,
    target: 4,
  },
  {
    id: "storage",
    label: "Storage",
    unit: "GB",
    rateLabel: "$0.10/mo",
    maxLabel: "Max 1TB",
    rate: 0.1,
    min: 1,
    max: 1024,
    start: 1,
    target: 4,
  },
];

// The screenshot's own final total ($40.45) doesn't sum from any rate visible in the screenshot
// (see PROJECT.md's original placeholder note) — but 2×$10 + 4×$5 + 4×$0.10 = $40.40, five cents
// short. Rather than invent a fourth, invisible pricing factor, added a flat platform fee so the
// scripted reveal's FINAL total still lands exactly on the originally-spec'd $40.45.
export const PRICING_PLATFORM_FEE = 0.05;

// Extra scroll distance (px) the card holds the screen for while the buttons "count up" — see
// pricingScrollAnimation.ts. Mirrors every other pinned section's `ssrScrollReserveRef` spacer.
export const PRICING_PIN_SCROLL_DISTANCE = 1600;

// Round-robin press order from each row's `start` to its `target` — e.g. vCPU, Memory, Storage,
// Memory, Storage, Memory, Storage (not hardcoded, so it stays correct if start/target change).
// Each entry is a row index into PRICING_ROWS. Only used to script the scroll-driven sequence —
// manual +/- clicks (see pricingScrollAnimation.ts) move independently, up to each row's true
// min/max.
export function buildPressSequence(rows: readonly PricingRow[]): number[] {
  const current = rows.map((row) => row.start);
  const sequence: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    rows.forEach((row, i) => {
      if (current[i] < row.target) {
        current[i] += 1;
        sequence.push(i);
        changed = true;
      }
    });
  }
  return sequence;
}

// The leading number used to read "1 vCPU" as a static per-unit description — now live, tracking
// the row's current qty, per explicit request. The rate and "Max ..." suffix stay fixed.
export function formatDetail(qty: number, row: PricingRow): string {
  return `${qty} ${row.unit} — ${row.rateLabel} - ${row.maxLabel}`;
}

export function formatRowPrice(qty: number, rate: number): string {
  return `$${(qty * rate).toFixed(2)}/mo`;
}

export function computeTotal(qty: readonly number[], rows: readonly PricingRow[]): number {
  return rows.reduce((sum, row, i) => sum + qty[i] * row.rate, 0) + PRICING_PLATFORM_FEE;
}

export function formatTotal(total: number): string {
  return `$${total.toFixed(2)}`;
}
