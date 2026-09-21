import { MachineSectionClient } from "./MachineSectionClient";
import { INFRASTRUCTURE_STEPS_AFTER_MACHINE } from "@/lib/infrastructureSteps";
import { readMachineServerParts } from "@/lib/machineServerParts";

// The machine screen now owns steps 3-8 as well: you fly into topside.svg and the content is
// already inside, on the same pinned screen (see machineScrollAnimation.ts).
//
// The right column used to show the hero's static 4-layer stack (no animation). Swapped
// 2026-09-18 for the same 2-part titanium server the intro uses: step 3 now separates it and
// reveals the server-icons in the gap, step 4 fades the top half + icons into the "machine"
// wordmark (see machineScrollAnimation.ts's "step 3 -> step 4" block) — approved via demo first.
export function MachineSection({ skipIntro = false }: { skipIntro?: boolean }) {
  return (
    <MachineSectionClient
      skipIntro={skipIntro}
      steps={INFRASTRUCTURE_STEPS_AFTER_MACHINE}
      machineServer={readMachineServerParts("machine-inside")}
    />
  );
}
