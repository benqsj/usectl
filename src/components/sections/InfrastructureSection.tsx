import { InfrastructureSectionClient } from "./InfrastructureSectionClient";
import type { InfrastructureStep } from "@/lib/infrastructureSteps";
import { readMachineServerParts } from "@/lib/machineServerParts";
import { readServerStackLayers } from "@/lib/serverStackLayers";

interface InfrastructureSectionProps {
  // Which pinned sequence to render — INFRASTRUCTURE_STEPS_INTRO or _AFTER_MACHINE.
  steps: InfrastructureStep[];
  // Extra scroll (px) the pin holds for — see infrastructureLayout.ts.
  pinScrollDistance: number;
  // What sits in the right column:
  //   "machine" — the 2-part titanium server, animated (opens + swaps which part is lit per step)
  //   "stack"   — the hero's 4-layer server, STATIC for now (no animation yet, per instruction)
  //   undefined — nothing (column kept empty at the same width)
  server?: "machine" | "stack";
  // Outer <section> spacing.
  className?: string;
  // Unique per instance on the page — prefixes the inlined server SVG ids.
  instanceId?: string;
}

export function InfrastructureSection({
  steps,
  pinScrollDistance,
  server,
  className = "mt-[calc(var(--s)*32)] pb-20 md:pb-[calc(var(--s)*112)]",
  instanceId = "infra",
}: InfrastructureSectionProps) {
  return (
    <InfrastructureSectionClient
      steps={steps}
      className={className}
      pinScrollDistance={pinScrollDistance}
      machineServer={server === "machine" ? readMachineServerParts(instanceId) : null}
      stackLayers={server === "stack" ? readServerStackLayers(instanceId) : null}
    />
  );
}
