import { HeroSectionClient } from "./HeroSectionClient";

// Thin server/client boundary. It used to read the four layer SVGs off disk and hand them down;
// the hero now renders a 3D model (public/herosection/3D/server.glb) instead, which the client
// loads itself, so there is nothing left to read here. Those same SVGs are still used by
// InfrastructureSection — see src/lib/serverStackLayers.ts.
export function HeroSection() {
  return <HeroSectionClient />;
}
