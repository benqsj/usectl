// Shared between HeroSection.tsx (Server Component, reads the files) and HeroSectionClient.tsx
// ("use client", renders them) — kept in a plain module rather than exported from either so
// neither has to import a non-component value across the server/client boundary.

// Top-to-bottom stacking order: cap, two core/radiator layers, base.
export const LAYER_FILES = ["layer-01-cap", "layer-02-core", "layer-03-core", "layer-04-base"] as const;
export type LayerFile = (typeof LAYER_FILES)[number];
