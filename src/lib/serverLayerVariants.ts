// SERVER-ONLY (uses node:fs) — import this from Server Components only (InfrastructureSection.tsx).
//
// Builds a "dark" and a "lit" (green) variant of each of the 4 hero server layers
// (public/server-animation/*.svg) for InfrastructureSection's step-by-step layer highlight.
// No new assets: the green look is borrowed from layer-04-base.svg, which is the only layer
// designed "lit", and the dark look from layer-03-core.svg.
//
// All 4 files are the same Figma export structure, so their gradients line up by index:
//   paint0  outer side wall            (base: green, 35 stops · others: dark, 35 stops)
//   paint2  inner side band (cores)    ← base's equivalent is paint3
//   base-only extras: paint2 green wash, a green rim glow group, and #B6FFD6 LED dots.
// If a layer is re-exported from Figma and these indices move, the ensureGradients() check below
// throws at build time instead of silently rendering the wrong colors.

import fs from "node:fs";
import path from "node:path";
import { LAYER_FILES, type LayerFile } from "@/lib/heroLayers";

export interface ServerLayerVariant {
  name: LayerFile;
  dark: string;
  lit: string;
}

const GRADIENT_RE = /<linearGradient([^>]*?)id="(paint(\d+)_[^"]+)"([^>]*)>([\s\S]*?)<\/linearGradient>/g;

function readLayer(name: LayerFile) {
  return fs.readFileSync(path.join(process.cwd(), "public", "server-animation", `${name}.svg`), "utf-8");
}

// paint index -> inner <stop> markup
function gradientStops(svg: string) {
  const stops = new Map<number, string>();
  for (const m of svg.matchAll(GRADIENT_RE)) stops.set(Number(m[3]), m[5]);
  return stops;
}

function ensureGradients(name: string, stops: Map<number, string>, indices: number[]) {
  for (const i of indices) {
    if (!stops.has(i)) throw new Error(`serverLayerVariants: ${name}.svg has no paint${i} gradient — re-check indices`);
  }
}

// Replaces the <stop>s of the given paint indices, keeping each gradient's own geometry.
function swapGradientStops(svg: string, replacements: Record<number, string>) {
  return svg.replace(GRADIENT_RE, (full, before, id, index, after) => {
    const stops = replacements[Number(index)];
    return stops === undefined ? full : `<linearGradient${before}id="${id}"${after}>${stops}</linearGradient>`;
  });
}

// Every inlined copy needs unique ids — the hero inlines the same files, and two
// InfrastructureSection instances (GROUP_1 / GROUP_2) are on the page at once.
function prefixIds(svg: string, prefix: string) {
  const ids = new Set(Array.from(svg.matchAll(/id="([^"]+)"/g), (m) => m[1]));
  let out = svg;
  for (const id of ids) {
    out = out.split(`id="${id}"`).join(`id="${prefix}${id}"`).split(`url(#${id})`).join(`url(#${prefix}${id})`);
  }
  return out;
}

// Same root rewrite as HeroSection.tsx: drop intrinsic width/height so the SVG scales with its box.
function responsiveRoot(svg: string) {
  return svg.replace(
    /<svg width="\d+" height="\d+" viewBox="0 0 (\d+) (\d+)" fill="none" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/,
    '<svg viewBox="0 0 $1 $2" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:100%;height:auto;display:block">',
  );
}

export function readServerLayerVariants(idPrefix: string): ServerLayerVariant[] {
  const base = readLayer("layer-04-base");
  const core = readLayer("layer-03-core");
  const baseStops = gradientStops(base);
  const coreStops = gradientStops(core);
  ensureGradients("layer-04-base", baseStops, [0, 3]);
  ensureGradients("layer-03-core", coreStops, [0, 2]);

  return LAYER_FILES.map((name, i) => {
    let dark: string;
    let lit: string;

    if (name === "layer-04-base") {
      lit = base;
      dark = swapGradientStops(base, { 0: coreStops.get(0)!, 3: coreStops.get(2)! })
        .replace(/fill="url\(#paint2_linear/g, 'fill-opacity="0" fill="url(#paint2_linear')
        .replace(/<g opacity="0\.75" filter=/g, '<g opacity="0" filter=')
        .replace(/fill="#B6FFD6"/g, 'fill="#B6FFD6" fill-opacity="0"')
        .replace(/fill="#00FF87" fill-opacity="0\.17"/g, 'fill="#00FF87" fill-opacity="0"');
    } else {
      dark = readLayer(name);
      ensureGradients(name, gradientStops(dark), [0, 2]);
      // Cap: only its side wall goes green — its paint2 is the visible top face, which stays dark.
      lit = swapGradientStops(
        dark,
        name === "layer-01-cap" ? { 0: baseStops.get(0)! } : { 0: baseStops.get(0)!, 2: baseStops.get(3)! },
      );
    }

    return {
      name,
      dark: responsiveRoot(prefixIds(dark, `${idPrefix}-d${i}-`)),
      lit: responsiveRoot(prefixIds(lit, `${idPrefix}-l${i}-`)),
    };
  });
}
