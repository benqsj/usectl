import { BuildSection } from "@/components/sections/BuildSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { InfrastructureSection } from "@/components/sections/InfrastructureSection";
import { MachineSection } from "@/components/sections/MachineSection";
import { PricingCalculatorSection } from "@/components/sections/PricingCalculatorSection";
import { INFRASTRUCTURE_INTRO_PIN_SCROLL_DISTANCE } from "@/lib/infrastructureLayout";
import { INFRASTRUCTURE_STEPS_INTRO } from "@/lib/infrastructureSteps";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <HeroSection />
      {/* Steps 1-2 + the 2-part server opening */}
      <InfrastructureSection
        steps={INFRASTRUCTURE_STEPS_INTRO}
        pinScrollDistance={INFRASTRUCTURE_INTRO_PIN_SCROLL_DISTANCE}
        server="machine"
        instanceId="infra-intro"
      />
      {/* The machine screen — and, inside it, steps 3-8 */}
      <MachineSection />
      <PricingCalculatorSection />
      <BuildSection />
    </main>
  );
}
