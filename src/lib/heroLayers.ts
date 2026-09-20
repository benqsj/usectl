// Shared between HeroSection.tsx (Server Component), HeroSectionClient.tsx ("use client") and
// heroScrollAnimation.ts — kept in a plain module rather than exported from any of them so none
// has to import a non-component value across the server/client boundary.

// Top-to-bottom stacking order: cap, two core/radiator layers, base.
//
// The HERO itself no longer renders these — it renders the 3D model instead (see
// HeroServerModel.tsx). They are still the source for InfrastructureSection's static server (see
// serverStackLayers.ts), which is why this list stays here.
export const LAYER_FILES = ["layer-01-cap", "layer-02-core", "layer-03-core", "layer-04-base"] as const;
export type LayerFile = (typeof LAYER_FILES)[number];

// The closed/open vertical gap between stacked layers. The hero's 3D model does its own
// separation (the GLB's explode_sequence), but the wrapper's document-flow height is still driven
// by --stack-gap exactly as before, so the page's total height behaves identically — including
// the SSR reservation described below.
export const HERO_STACK_GAP_CLOSED_PX = 45;
export const HERO_STACK_GAP_OPEN_PX = 140;

// Extra scroll distance (px) the hero's ScrollTrigger pin holds the section for — must match the
// timeline in heroScrollAnimation.ts, which derives it from its own phase durations. Duplicated
// here (rather than imported from that "use client" file) so HeroSectionClient.tsx can reserve
// the same amount of space via a server-rendered spacer BEFORE any client JS runs — see the long
// comment on that spacer in HeroSectionClient.tsx for why this exists (a real, diagnosed
// refresh-while-scrolled bug).
//
// 1260 = 4.2 units of timeline at 233.33px per unit (the old 980 / 4.2), plus the 1.2-unit hold
// added at the end so the fully-open stack stays put for ~280px of scroll before the pin releases
// and InfrastructureSection comes up. The earlier phases therefore need exactly the same scroll
// distance they always did.
//
// Raised 1260 -> 1680 on 2026-09-20: DISASSEMBLE_DURATION (heroScrollAnimation.ts) doubled 1.8 ->
// 3.6 per explicit instruction to slow down only the server's own disassembly — this is exactly
// that doubled unit's worth of extra px (1.8 units * 233.33px/unit = 420px) added on top, so the
// text fade, scale/rise and end-hold phases still need exactly the scroll they always did.
export const HERO_PIN_SCROLL_DISTANCE = 1680;
