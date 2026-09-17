// SERVER-ONLY (uses node:fs) — import from Server Components only (InfrastructureSection.tsx).
//
// Inlines the hero's 4 server layer SVGs (public/server-animation/) for the steps 3-8 section,
// where the layered server is shown STATIC for now (no animation yet, per instruction). Same
// intrinsic sizes as HeroSectionClient.tsx: the cap is 383 wide, the other layers 372, all 256 tall.

import fs from "node:fs";
import path from "node:path";
import { LAYER_FILES } from "@/lib/heroLayers";

export function readServerStackLayers(idPrefix: string): string[] {
  return LAYER_FILES.map((name, i) => {
    const raw = fs.readFileSync(path.join(process.cwd(), "public", "server-animation", `${name}.svg`), "utf-8");
    const responsive = raw.replace(
      /<svg width="\d+" height="\d+" viewBox="0 0 (\d+) (\d+)" fill="none" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/,
      '<svg viewBox="0 0 $1 $2" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:100%;height:auto;display:block">',
    );
    // Unique ids per copy — the hero inlines these same files elsewhere on the page.
    const ids = new Set(Array.from(responsive.matchAll(/id="([^"]+)"/g), (m) => m[1]));
    let out = responsive;
    for (const id of ids) {
      out = out
        .split(`id="${id}"`)
        .join(`id="${idPrefix}-s${i}-${id}"`)
        .split(`url(#${id})`)
        .join(`url(#${idPrefix}-s${i}-${id})`);
    }
    return out;
  });
}
