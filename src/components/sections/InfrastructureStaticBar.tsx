"use client";

import Image from "next/image";
import { useRef } from "react";
import { useStaticBarFillAnimation } from "@/animations/staticBarAnimation";

// static-base.svg is static.svg with its designed green ticks recolored white (same opacity
// convention as their neighboring white ticks) — the "no fill yet" state. static.svg itself (its
// small green portion, near the left edge, left untouched) is layered on top and revealed
// left-to-right as the user scrolls, so the bar animates from empty to its designed look instead
// of just appearing.
export function InfrastructureStaticBar() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  useStaticBarFillAnimation({ wrapperRef, fillRef });

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className="relative mt-16 w-full max-w-[821px] md:mt-20"
      style={{ aspectRatio: "821 / 35" }}
    >
      <Image src="/infrastructur/static-base.svg" alt="" fill className="object-contain" />
      {/* Clipped in percentage units (not a fixed pixel width) so the reveal lines up with the
          base image above at any rendered size, not just 821px. */}
      <div ref={fillRef} className="absolute inset-0" style={{ clipPath: "inset(0 100% 0 0)" }}>
        <Image src="/infrastructur/static.svg" alt="" fill className="object-contain" />
      </div>
    </div>
  );
}
