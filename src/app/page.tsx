import { BuildSection } from "@/components/sections/BuildSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { MachineSection } from "@/components/sections/MachineSection";
import { PricingCalculatorSection } from "@/components/sections/PricingCalculatorSection";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <HeroSection />
      {/* Steps 1-2 ("You came here to build." / "Your stack, in one place.") now play inside the
          hero's own pin — see heroScrollAnimation.ts (SPACE_* and STACK_*). The InfrastructureSection
          card that used to show them here was removed 2026-09-21; the component is still used for
          steps 3-8 inside the machine screen. */}
      {/* The machine screen — and, inside it, steps 3-8 */}
      <MachineSection />
      <PricingCalculatorSection />
      <BuildSection />
    </main>
  );
}
