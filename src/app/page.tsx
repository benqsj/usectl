import { BuildSection } from "@/components/sections/BuildSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { MachineSection } from "@/components/sections/MachineSection";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <HeroSection />
      {/* Steps 1-2 ("You came here to build." / "Your stack, in one place.") now play inside the
          hero's own pin — see heroScrollAnimation.ts (SPACE_* and STACK_*). The InfrastructureSection
          card that used to show them here was removed 2026-09-21. */}
      {/* Steps 3-8. The hero now ends by diving into the server's cap, so the machine screen skips
          its own wordmark + topside fly-through and starts at the card flying in (skipIntro). */}
      <MachineSection skipIntro />
      {/* The pricing calculator ("Know your hosting bill before you launch.") was taken off the
          page 2026-09-21; PricingCalculatorSection and its files are untouched. */}
      <BuildSection />
    </main>
  );
}
