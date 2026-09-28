import { readFileSync } from "node:fs";
import path from "node:path";
import { HeroSectionClient } from "./HeroSectionClient";

// The exploded server ships INLINE (read at build time, server component) so its internal
// layer elements can be animated individually — the state-2→3 transition fades the middle
// layers of the SAME artwork instead of overlay-swapping piece SVGs (user-specified approach).
// Inlining also means the hero art is in the SSR HTML from the first paint (no fetch pop-in).
const serverSvg = readFileSync(
  path.join(process.cwd(), "public/section-hero/new-server.svg"),
  "utf8",
).replace('width="421" height="687"', 'width="100%"');

export function HeroSection() {
  return <HeroSectionClient serverSvg={serverSvg} />;
}
