import { InfrastructureSectionClient } from "./InfrastructureSectionClient";
import { INFRASTRUCTURE_STEPS_GROUP_1, type InfrastructureStep } from "@/lib/infrastructureSteps";
import { readServerLayerVariants } from "@/lib/serverLayerVariants";

interface InfrastructureSectionProps {
  // Which pinned sequence to render — GROUP_1 (default) or GROUP_2, see infrastructureSteps.ts.
  steps?: InfrastructureStep[];
  // Outer <section> spacing. GROUP_1's default negative top margin is specific to sitting right
  // under the hero, so other instances pass their own.
  className?: string;
  // Unique per instance on the page — prefixes the inlined server SVG ids so two sections (and the
  // hero, which inlines the same files) never share gradient/filter ids.
  instanceId?: string;
}

export function InfrastructureSection({
  steps = INFRASTRUCTURE_STEPS_GROUP_1,
  className = "mt-[-11px] pb-20 min-[1800px]:mt-8 md:pb-28",
  instanceId = "infra1",
}: InfrastructureSectionProps) {
  const serverLayers = readServerLayerVariants(instanceId);
  return <InfrastructureSectionClient steps={steps} className={className} serverLayers={serverLayers} />;
}
