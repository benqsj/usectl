import { HeroSectionClient } from "./HeroSectionClient";
import { readHeroMachineSvg } from "@/lib/heroMachineSvg";

// Inline the closed and exploded SVG artwork so their layers can animate together on scroll.
export function HeroSection() {
  return <HeroSectionClient machineSvg={readHeroMachineSvg("hero")} />;
}
