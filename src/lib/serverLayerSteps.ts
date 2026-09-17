// Shared (client + server safe) helpers for InfrastructureSection's layered server.
import { LAYER_FILES } from "@/lib/heroLayers";

export const SERVER_LAYER_COUNT = LAYER_FILES.length;

// Which layer (0 = cap … 3 = base) is lit on a given step: bottom-up, one per step
// (step 0 -> base, 1 -> lower core, 2 -> upper core, 3 -> cap), repeating for longer groups.
export const activeServerLayer = (step: number) => SERVER_LAYER_COUNT - 1 - (step % SERVER_LAYER_COUNT);

// Resting vertical offsets (px) around the lit layer: it rises a little, the layers under it drop
// a little, so the lit one reads as "pulled out" of the stack.
export const SERVER_ACTIVE_LIFT_PX = -12;
export const SERVER_BELOW_PUSH_PX = 8;

export const serverLayerOffset = (active: number, layer: number) =>
  layer === active ? SERVER_ACTIVE_LIFT_PX : layer > active ? SERVER_BELOW_PUSH_PX : 0;

// cap is 383 wide, the other layers 372 — same proportions as HeroSectionClient.tsx.
export const SERVER_CAP_WIDTH_PERCENT = (383 / 372) * 100;
