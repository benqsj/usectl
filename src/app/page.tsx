import { HeroSection } from "@/components/sections/HeroSection";
import { InfrastructureSection } from "@/components/sections/InfrastructureSection";
import { MachineSection } from "@/components/sections/MachineSection";
import { PricingCalculatorSection } from "@/components/sections/PricingCalculatorSection";
import {
  INFRASTRUCTURE_AFTER_MACHINE_PIN_SCROLL_DISTANCE,
  INFRASTRUCTURE_INTRO_PIN_SCROLL_DISTANCE,
} from "@/lib/infrastructureLayout";
import { INFRASTRUCTURE_STEPS_AFTER_MACHINE, INFRASTRUCTURE_STEPS_INTRO } from "@/lib/infrastructureSteps";

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
      <MachineSection />
      {/* Steps 3-8 — the 4-layer server sits on the right, static for now */}
      <InfrastructureSection
        steps={INFRASTRUCTURE_STEPS_AFTER_MACHINE}
        pinScrollDistance={INFRASTRUCTURE_AFTER_MACHINE_PIN_SCROLL_DISTANCE}
        server="stack"
        instanceId="infra-after"
        className="pt-20 pb-20 md:pt-28 md:pb-28"
      />
      <PricingCalculatorSection />
    </main>
  );
}
