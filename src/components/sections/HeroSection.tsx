import fs from "node:fs";
import path from "node:path";
import { HeroSectionClient } from "./HeroSectionClient";
import { LAYER_FILES, type LayerFile } from "@/lib/heroLayers";

// The scroll animation just tweens a CSS custom property (--stack-gap) on the wrapper — no GSAP
// per-layer targeting needed — so these can stay plain <img>-like inlined SVGs with no refs. They
// ARE inlined (dangerouslySetInnerHTML) rather than <Image src="..."> purely so each layer's own
// intrinsic width/height attributes can be stripped here and replaced with a CSS width instead
// (needed so each layer scales with the responsive wrapper width — see HeroSectionClient.tsx).
function readLayerSvg(name: LayerFile) {
  const filePath = path.join(process.cwd(), "public", "server-animation", `${name}.svg`);
  const raw = fs.readFileSync(filePath, "utf-8");
  return raw.replace(
    /<svg width="\d+" height="\d+" viewBox="0 0 (\d+) (\d+)" fill="none" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/,
    '<svg viewBox="0 0 $1 $2" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">',
  );
}

export function HeroSection() {
  const layerSvgs = Object.fromEntries(LAYER_FILES.map((name) => [name, readLayerSvg(name)])) as Record<
    LayerFile,
    string
  >;
  return <HeroSectionClient layerSvgs={layerSvgs} />;
}
