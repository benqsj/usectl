import Image from "next/image";
import Link from "next/link";

// Footer keeps its own (larger) chamfer size, independent of the shared `CHAMFER_PX` used by
// Pricing/Infrastructure's cards — bumped per explicit request, without dragging those other
// cards' cut along with it.
const FOOTER_CHAMFER_PX = 80;

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
    <footer className="relative max-[1799px]:pt-[calc(var(--s)*165)] min-[1800px]:pt-[calc(var(--s)*100)] pb-0">
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

          `pt` here WAS originally a pixel-exact grid-snap (the panel's own top edge landing on one
          of BackgroundLines.tsx's horizontal row lines, `rowY()`/`ROW_PITCH` in `src/lib/grid.ts`)
          but that approach broke down: `<footer>`'s natural top (driven by everything above it,
          all the way up through Hero/Infrastructure/Machine/Pricing/Build's own GSAP pin-spacers)
          measured **392px apart** between two Playwright runs that only differed in whether the
          page had been scrolled all the way through first — GSAP settles several pin-spacers'
          reserved heights only once their own ScrollTrigger has actually fired, so an automated
          "exact" measurement here depends on scroll history and isn't trustworthy as a one-shot
          computation. Both `pt` values (narrow and wide bucket) are now tuned directly against the
          user's own visual feedback in their real browser instead (150 → 190 → 180 → 200 → 97 →
          105 → 94 → 165/100 across this conversation) — treat further reports of "slightly
          off" as the expected way to keep tuning this, not as a sign the formula is wrong. Same
          caveat as every other grid-snap in this project (see InfrastructureSection's own "Card
          top snapped to a grid row line" entry in
          PROJECT.md): `ROW_PITCH` is `vw`-fluid but this offset is a flat px constant, so it's only
          pixel-exact at the 1920px width it was measured against — verified there via
          `getBoundingClientRect()` (panel top landed within a few px of the target line). The
          narrow (`max-[1799px]`) bucket's `pt` was tuned by eye across the same conversation, not
          grid-snapped — its own alignment (if wanted) would need the same measure-and-diff pass
          repeated at a representative narrow width. */}
      <div
        className="relative w-full border-t border-white/10 pb-[calc(var(--s)*16)]"
        style={{
          backgroundColor: "#171717",
          // The right and bottom edge points sit at `calc(100% + 1px)`, not a bare `100%` — a
          // clip-path edge exactly on an element's own boundary gets anti-aliased away to ~0
          // visible width (the same fencepost bug already hit and fixed for the vertical grid
          // lines in BackgroundLines.tsx, see PROJECT.md). Without this nudge the panel's own
          // `border` (below) rendered on the left/top but silently vanished on the right/bottom.
          clipPath: `polygon(${FOOTER_CHAMFER_PX}px 0, calc(100% - ${FOOTER_CHAMFER_PX}px) 0, calc(100% + 1px) ${FOOTER_CHAMFER_PX}px, calc(100% + 1px) calc(100% + 1px), 0 calc(100% + 1px), 0 ${FOOTER_CHAMFER_PX}px)`,
        }}
      >
        {/* `border-t` above draws the panel's own top edge only — no left/right/bottom border on
            the PANEL itself any more. Per explicit correction, the vertical lines instead live on
            the two 90%-width, centered rows below (content row + copyright row), inset from the
            panel's true edges rather than flush against them — sitting exactly at the clip-path's
            own boundary (0%/100%) was the root cause of the vertical borders rendering
            inconsistently across browsers/displays (see the `calc(100% + 1px)` fencepost note
            below, which was a partial fix for the same symptom); moving the border-carrying
            elements inward sidesteps that boundary entirely instead of fighting it. Both rows use
            the same `w-[90%] mx-auto`, so their vertical lines always land at the same x position
            as each other, at any viewport width. The horizontal line below "© 2026 SYSTEMCTL" is
            its own `border-b` on that row, not the panel's outer edge — so it sits with a small
            gap (this `pb`) above the panel's true bottom, instead of flush against it.
            `clip-path` only clips what's
            already painted — it doesn't draw a new stroke along the diagonal it cuts (same bug
            documented for Pricing/Infrastructure's chamfer in src/lib/chamfer.ts). Footer's own
            background fill makes the CUT itself visible via color contrast, but the diagonal still
            had no border line of its own — these two accent divs bridge each clipped corner's
            straight edges with a matching 1px `white/10` line, one per top corner (mirrored). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bg-white/10"
          style={{
            width: FOOTER_CHAMFER_PX * Math.SQRT2,
            height: 1,
            top: FOOTER_CHAMFER_PX / 2,
            left: FOOTER_CHAMFER_PX / 2,
            transform: "translate(-50%, -50%) rotate(-45deg)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bg-white/10"
          style={{
            width: FOOTER_CHAMFER_PX * Math.SQRT2,
            height: 1,
            top: FOOTER_CHAMFER_PX / 2,
            right: FOOTER_CHAMFER_PX / 2,
            transform: "translate(50%, -50%) rotate(45deg)",
          }}
        />
        {/* height: 317px per explicit spec at the 1920 reference — bumped a bit taller for the
            min-[1800px] (FullHD-and-up) bucket only, per explicit request, while the narrow bucket
            keeps the original 317px. Horizontal padding widened (40px → 96px) so the
            logo/Subscribe columns sit further in from the panel's own edges — user feedback: they
            read as "way too far out" at the original padding. `border-l/r` per the panel-border
            note above — inset via `marginInline: FOOTER_CHAMFER_PX` (a fixed px, matching the
            chamfer's own unscaled unit exactly, NOT a `w-[90%]` percentage) so the vertical line's
            top endpoint always lands exactly on the chamfer diagonal's own endpoint, at any
            viewport width. A percentage inset and the chamfer's fixed-px cut follow different
            scaling laws — they'd only coincide at the one width they were tuned against, same
            "fixed vs. fluid" lesson documented elsewhere in this project (see PROJECT.md). No
            explicit width is set — a block element with fixed left/right margins and `width: auto`
            fills the remaining space automatically. */}
        <div
          className="flex flex-col gap-12 border-l border-r border-white/10 px-8 py-8 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-8 md:px-36 max-[1799px]:min-h-[calc(var(--s)*317)] min-[1800px]:min-h-[calc(var(--s)*340)]"
          style={{ marginInline: FOOTER_CHAMFER_PX }}
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

        <div
          className="border-l border-r border-t border-b border-white/10 py-6 text-center"
          style={{ marginInline: FOOTER_CHAMFER_PX }}
        >
          <p className="font-heading text-[calc(var(--s)*13)] leading-none text-white/40">
            © 2026 <span className="text-brand">SYSTEMCTL</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
