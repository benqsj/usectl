"use client";

import { useImperativeHandle, useRef, type RefObject } from "react";
import { HERO_STACK_GAP_CLOSED_PX } from "@/lib/heroLayers";
import { HERO_CORE_HEIGHT_RATIO } from "@/lib/heroModel";
import { s } from "@/lib/grid";

export interface HeroMachineHandle {
  setProgress: (progress: number) => void;
}

export function HeroMachineSvg({ markup, apiRef }: {
  markup: string;
  apiRef: RefObject<HeroMachineHandle | null>;
}) {
  const stageRef = useRef<HTMLDivElement>(null);

  // A layout-effect handle is ready before the parent's GSAP timeline synchronizes its pose,
  // including StrictMode remounts and a reload while the hero is already open.
  useImperativeHandle(apiRef, () => {
    const stage = stageRef.current!;
    const assembly = stage.querySelector<SVGGElement>("[data-assembly]")!;
    const closed = stage.querySelector<SVGGElement>('[data-pose="closed"]')!;
    const open = stage.querySelector<SVGGElement>('[data-pose="open"]')!;
    const layers = ["tray1", "tray2", "lid"].map((name) =>
      stage.querySelectorAll<SVGGElement>(`[data-layer="${name}"]`),
    );
    return {
      setProgress(progress) {
        const t = Math.max(0, Math.min(1, progress));
        layers.forEach((copies, index) => copies.forEach((layer) => {
          layer.setAttribute("transform", `translate(0 ${(index + 1) * 80 * (1 - t)})`);
        }));
        // The lid rises 240 SVG units; move the assembly down by half to keep it centered.
        assembly.setAttribute("transform", `translate(0 ${120 * t})`);
        closed.setAttribute("opacity", String(1 - t));
        open.setAttribute("opacity", String(t));
      },
    };
  }, []);

  return (
    <div
      ref={stageRef}
      className="pointer-events-none absolute left-1/2"
      style={{
        width: `${800 / 371.86 * 100}%`,
        top: s((3 * HERO_STACK_GAP_CLOSED_PX + 480 * HERO_CORE_HEIGHT_RATIO) / 2),
        // The closed artwork's center is (400, 510) in the shared 800-unit canvas.
        transform: "translate(-50%, -63.75%)",
      }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
