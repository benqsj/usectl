import { HeroSection } from "@/components/sections/HeroSection";
import { InfrastructureSection } from "@/components/sections/InfrastructureSection";
import { MachineSection } from "@/components/sections/MachineSection";
import { INFRASTRUCTURE_STEPS_GROUP_1, INFRASTRUCTURE_STEPS_GROUP_2 } from "@/lib/infrastructureSteps";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <HeroSection />
      <InfrastructureSection steps={INFRASTRUCTURE_STEPS_GROUP_1} />
      <MachineSection />
      <InfrastructureSection steps={INFRASTRUCTURE_STEPS_GROUP_2} instanceId="infra2" className="pt-20 pb-20 md:pt-28 md:pb-28" />
    </main>
  );
}
