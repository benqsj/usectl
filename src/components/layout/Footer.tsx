import Image from "next/image";
import Link from "next/link";
import { CHAMFER_PX } from "@/lib/chamfer";

// Built from two user-supplied screenshots (see PROJECT.md), 2026-09-18. Typography/dimensions
// spec'd exactly are noted per-element below; anything not spec'd (column proportions, the
// copyright bar's own styling) is eyeballed against the screenshots, same "trial-and-error against
// a reference image" approach used throughout this project.
//
// Corner chamfer: no dedicated SVG asset was supplied for the cut corners (only logo.svg and
// x-twitter.svg were), so this uses the shared `clip-path` chamfer technique from `src/lib/chamfer.ts`
// — extended to BOTH top corners here (the reference shows both top-left and top-right cut, not
// just one), bottom corners left square, matching the screenshot. Unlike Pricing/Infrastructure's
// cards, this panel HAS its own background fill (`#171717`), so it doesn't need the diagonal-accent
// div those need — the color contrast against the page background already makes the cut visible on
// its own. Uses the shared `CHAMFER_PX` (64px, was a Footer-only 90px) so every bordered card on the
// page cuts the same amount, per explicit "make it consistent everywhere" follow-up request.

// Mirrors Header.tsx's own NAV_LINKS hrefs exactly (so both point at the same anchors), just with
// "Doc" instead of "Documentation" per the footer screenshot's shorter label.
const NAV_LINKS = [
  { label: "The Machine", href: "#the-machine" },
  { label: "Agents", href: "#agents" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Doc", href: "#documentation" },
] as const;

const COLUMN_LABEL = "font-heading text-[calc(var(--s)*14)] leading-none font-medium text-foreground";
const ITEM_TEXT = "font-heading text-[calc(var(--s)*14)] leading-none font-light text-white/60";

export function Footer() {
  return (
    <footer className="relative pt-[calc(var(--s)*101)] pb-0">
      {/* The chamfer + background both live on THIS element (not a separate outer wrapper) — per
          explicit correction: the cut belongs to the footer's own panel, not traced by a border
          around a same-colored area (which read as "a cut drawn on the border" rather than a real
          notch, since there was no color contrast between inside/outside the clipped shape before).
          `#171717` only applies here now, so the page's own background/grid still shows through
          above this panel, matching the reference screenshot.

          Full-bleed (`w-full`, no side inset) per explicit follow-up request — unlike every other
          card on the page (Infrastructure/Pricing), which deliberately stay inset. The outer
          <footer> lost its own `px-6` too, so this really does reach the true viewport edges rather
          than just filling a still-padded container.

          `pt-[calc(var(--s)*101)]` (grew the footer's own top gap, not shrunk it) is a grid-snap, per explicit
          request: the panel's own top edge should coincide with one of BackgroundLines.tsx's
          horizontal row lines (`rowY()`/`ROW_PITCH` in `src/lib/grid.ts`, 114px pitch from the
          header's bottom edge at the 1920 reference width). Measured `<footer>`'s own natural top
          (driven entirely by everything above it — BuildSection's true end, independent of this
          padding) via `getBoundingClientRect()`, found the nearest row line strictly below it, and
          set `pt` to exactly the difference. Same caveat as every other grid-snap in this project
          (see InfrastructureSection's own "Card top snapped to a grid row line" entry in
          PROJECT.md): `ROW_PITCH` is `vw`-fluid but this offset is a flat px constant, so it's only
          pixel-exact at the 1920px width it was measured against — verified there via
          `getBoundingClientRect()` (panel top landed within a few px of the target line). */}
      <div
        className="relative w-full border border-white/10"
        style={{
          backgroundColor: "#171717",
          clipPath: `polygon(${CHAMFER_PX}px 0, calc(100% - ${CHAMFER_PX}px) 0, 100% ${CHAMFER_PX}px, 100% 100%, 0 100%, 0 ${CHAMFER_PX}px)`,
        }}
      >
        {/* height: 317px per explicit spec. Horizontal padding widened (40px → 96px) so the
            logo/Subscribe columns sit further in from the panel's own edges — user feedback: they
            read as "way too far out" at the original padding. */}
        <div
          className="flex flex-col gap-12 px-8 py-8 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-8 md:px-36"
          style={{ minHeight: 317 }}
        >
          <div>
            <Image src="/footer/logo.svg" alt="usectl" width={173} height={28} />
            <p className={`mt-[calc(var(--s)*24)] ${ITEM_TEXT}`}>37 Zhiuli Shartava st., Tbilisi 2209 Georgia</p>
          </div>

          <div>
            <p className={COLUMN_LABEL}>Navigation</p>
            <ul className="mt-[calc(var(--s)*19)] flex flex-col gap-[calc(var(--s)*12)]">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={`${ITEM_TEXT} transition-colors hover:text-white`}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className={COLUMN_LABEL}>Contact</p>
            <ul className="mt-[calc(var(--s)*19)] flex flex-col gap-[calc(var(--s)*12)]">
              <li>
                <a href="mailto:hello@usectl.com" className={`${ITEM_TEXT} transition-colors hover:text-white`}>
                  hello@usectl.com
                </a>
              </li>
              <li>
                <a href="tel:+995511111111" className={`${ITEM_TEXT} transition-colors hover:text-white`}>
                  +995 511 11 11 11
                </a>
              </li>
              <li>
                <a href="https://x.com/usectl" aria-label="usectl on X" className="inline-block opacity-60 transition-opacity hover:opacity-100">
                  <Image src="/footer/x-twitter.svg" alt="" width={24} height={24} />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className={COLUMN_LABEL}>Subscribe</p>
            <input
              type="email"
              placeholder="email"
              className={`mt-[calc(var(--s)*12)] block rounded-[calc(var(--s)*8)] border border-white/20 bg-transparent px-4 ${ITEM_TEXT} text-foreground placeholder:text-white/40 focus:border-white/40 focus:outline-none`}
              style={{ width: 234, height: 44 }}
            />
            <label className="mt-[calc(var(--s)*12)] flex cursor-pointer items-center gap-[calc(var(--s)*8)]">
              <input
                type="checkbox"
                className="shrink-0 appearance-none rounded-[4px] border-[0.5px] border-white/40 bg-transparent checked:bg-transparent"
                style={{ width: 18, height: 18 }}
              />
              <span className={ITEM_TEXT}>I agree to the terms and conditions.</span>
            </label>
          </div>
        </div>

        <div className="border-t border-white/10 py-6 text-center">
          <p className="font-heading text-[calc(var(--s)*13)] leading-none text-white/40">
            © 2026 <span className="text-brand">SYSTEMCTL</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
