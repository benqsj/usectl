// Shared between HeroSection.tsx (Server Component, reads the files) and HeroSectionClient.tsx
// ("use client", renders them) — kept in a plain module rather than exported from either so
// neither has to import a non-component value across the server/client boundary.

// Top-to-bottom stacking order: cap, two core/radiator layers, base.
export const LAYER_FILES = ["layer-01-cap", "layer-02-core", "layer-03-core", "layer-04-base"] as const;
export type LayerFile = (typeof LAYER_FILES)[number];

// Extra scroll distance (px) the hero's ScrollTrigger pin holds the section for — must match
// heroScrollAnimation.ts's own PIN_SCROLL_DISTANCE exactly. Duplicated here (rather than imported
// from that "use client" file) so HeroSectionClient.tsx can reserve the same amount of space via a
// server-rendered padding-bottom BEFORE any client JS runs — see the long comment on that padding
// in HeroSectionClient.tsx for why this exists (a real, diagnosed refresh-while-scrolled bug).
export const HERO_PIN_SCROLL_DISTANCE = 980;
