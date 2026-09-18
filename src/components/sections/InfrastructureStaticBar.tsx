import Image from "next/image";
import { type RefObject } from "react";

// static-base.svg is static.svg with its designed green ticks recolored white (the "no fill yet"
// state). static-green.svg is the same tick pattern with EVERY line recolored green (the "fully
// filled" state — this is a 4-step progress indicator now, see infrastructureSteps.ts, not just a
// reveal of static.svg's own small originally-designed green segment). The green version is
// layered on top and clipped via `fillRef` (driven by InfrastructureSectionClient's pinned scroll
// animation, see infrastructureScrollAnimation.ts) so it fills left-to-right across the whole bar
// as the user scrolls through all 4 steps, instead of just appearing.
export function InfrastructureStaticBar({ fillRef }: { fillRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      aria-hidden="true"
      className="relative mt-16 w-full max-w-[calc(var(--s)*821)] md:mt-20"
      style={{ aspectRatio: "821 / 35" }}
    >
      <Image src="/infrastructur/static-base.svg" alt="" fill className="object-contain" />
      {/* Clipped in percentage units (not a fixed pixel width) so the reveal lines up with the
          base image above at any rendered size, not just 821px. */}
      <div ref={fillRef} className="absolute inset-0" style={{ clipPath: "inset(0% 100% 0% 0%)" }}>
        <Image src="/infrastructur/static-green.svg" alt="" fill className="object-contain" />
      </div>
    </div>
  );
}
