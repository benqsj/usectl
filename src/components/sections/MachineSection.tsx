import { MachineSectionClient } from "./MachineSectionClient";
import { INFRASTRUCTURE_STEPS_AFTER_MACHINE } from "@/lib/infrastructureSteps";
import { readServerStackLayers } from "@/lib/serverStackLayers";

// The machine screen now owns steps 3-8 as well: you fly into topside.svg and the content is
// already inside, on the same pinned screen (see machineScrollAnimation.ts).
export function MachineSection() {
  return (
    <MachineSectionClient
      steps={INFRASTRUCTURE_STEPS_AFTER_MACHINE}
      stackLayers={readServerStackLayers("machine-inside")}
    />
  );
}
