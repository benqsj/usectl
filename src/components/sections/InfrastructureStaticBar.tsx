import Image from "next/image";
import { type RefObject } from "react";

// static-base.svg is static.svg with its designed green ticks recolored white (same opacity
// convention as their neighboring white ticks) — the "no fill yet" state. static.svg itself (its
// small green portion, near the left edge, left untouched) is layered on top and clipped via
// `fillRef` (driven by InfrastructureSection's pinned scroll animation, see
// infrastructureScrollAnimation.ts) so it reveals left-to-right instead of just appearing.
export function InfrastructureStaticBar({ fillRef }: { fillRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      aria-hidden="true"
      className="relative mt-16 w-full max-w-[821px] md:mt-20"
      style={{ aspectRatio: "821 / 35" }}
    >
      <Image src="/infrastructur/static-base.svg" alt="" fill className="object-contain" />
      {/* Clipped in percentage units (not a fixed pixel width) so the reveal lines up with the
          base image above at any rendered size, not just 821px. */}
      <div ref={fillRef} className="absolute inset-0" style={{ clipPath: "inset(0% 100% 0% 0%)" }}>
        <Image src="/infrastructur/static.svg" alt="" fill className="object-contain" />
      </div>
    </div>
  );
}
