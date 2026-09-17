import { HeroSection } from "@/components/sections/HeroSection";
import { InfrastructureSection } from "@/components/sections/InfrastructureSection";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <HeroSection />
      <InfrastructureSection />
    </main>
  );
}
