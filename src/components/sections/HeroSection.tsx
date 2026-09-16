import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { columnX, rowY } from "@/lib/grid";

const CROSS_HALF_PX = 16.5; // cross.svg's crosshair center sits at 16.5/32, not exactly the icon's middle

// Only shown on FullHD (>=1800px) — grid-snapped to BackgroundLines.tsx's column 6/15 (mirrored: 21-6=15), row 4/7,
// using its own columnX/rowY helpers so these stay correct at any width >=1800px. Removed entirely below 1800px
// (2026-09-17, per user request) after a cube-relative narrow-screen version still didn't look right there.
const VISIBLE_AT_WIDE = "hidden min-[1800px]:block"; // literal string, not template-interpolated — see BackgroundLines.tsx for why
const WIDE_LEFT_COLUMN = 6;
const WIDE_RIGHT_COLUMN = 15;
const WIDE_TOP_ROW = 4;
const WIDE_BOTTOM_ROW = 7;

function GridCross({ column, row }: { column: number; row: number }) {
  return (
    <Image
      src="/herosection/cross.svg"
      alt=""
      width={32}
      height={32}
      aria-hidden="true"
      className={`absolute ${VISIBLE_AT_WIDE}`}
      style={{
        left: `calc(${columnX(column)} - ${CROSS_HALF_PX}px)`,
        top: `calc(${rowY(row)} - ${CROSS_HALF_PX}px)`,
      }}
    />
  );
}

export function HeroSection() {
  return (
    <section className="relative flex flex-col items-center px-6 pt-16 pb-28 text-center md:pb-36">
      <div className=" flex items-center justify-center gap-3">
        <Image src="/herosection/Subtract.svg" alt="" width={58} height={26} aria-hidden="true" />
        <span className="font-heading text-[22px] leading-none font-light tracking-[-0.02em] text-white/70">
          Managed Kubernetes &amp; AI Agent Infrastructure
        </span>
      </div>

      <h1 className="mt-[4px] font-heading text-[98px] leading-[1.05] font-bold sm:text-nowrap">
        One server. <span className="text-brand">Unlimited</span> machines.
      </h1>

      <p className="mt-2 max-w-[1080px] text-[28px] text-white/70">
        Zero-ops hosting for your apps and AI agents. Everything you need to take your idea live,
        without a DevOps team. Build it. Launch it.
      </p>

      <div className="mt-[35px] flex flex-wrap items-center justify-center gap-4">
        <Button href="#">Create Machine</Button>
        <Button href="#" withArrow>
          See how it works
        </Button>
      </div>

      {/* Static, assembled cube for now — TODO: build the scroll-driven disassembly animation from servers.svg's
          already-separated layers (see PROJECT.md) once we're ready to work on it */}
      <Image
        src="/herosection/server-cube.png"
        alt=""
        width={1367}
        height={1217}
        aria-hidden="true"
        className="mx-auto mt-[35px] h-auto w-[400px] min-[1800px]:mt-[84px] min-[1800px]:w-[480px]"
      />

      {/* Full-viewport-width overlay — corner crosses, FullHD only (see GridCross note above) */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0">
        <GridCross column={WIDE_LEFT_COLUMN} row={WIDE_TOP_ROW} />
        <GridCross column={WIDE_RIGHT_COLUMN} row={WIDE_TOP_ROW} />
        <GridCross column={WIDE_LEFT_COLUMN} row={WIDE_BOTTOM_ROW} />
        <GridCross column={WIDE_RIGHT_COLUMN} row={WIDE_BOTTOM_ROW} />
      </div>
    </section>
  );
}
