import type { CSSProperties } from "react";
import { INSET_VW, COLUMN_PITCH, ROW_PITCH, HEADER_HEIGHT_PX } from "@/lib/grid";

const ROW_GRID_TOP = `calc(${HEADER_HEIGHT_PX}px + ${ROW_PITCH})`; // first horizontal line sits one full (vw-scaled) row pitch below the header, so that gap matches every later gap at any viewport width — none render inside the header row itself (its own border-b is the only line at that seam)
const LINE_COLOR = "rgba(255,255,255,0.02)";
const LINE_THICKNESS_PX = 2; // thicker than a hairline on purpose — with fluid (vw) pitch, 1px lines land on fractional device pixels and anti-alias unevenly (some crisp, some blurry); 2px makes that variance much less noticeable

const NUM_COLUMNS = 22; // 1722 / 82 + 1, matches the confirmed x=99..1820 span

// Explicit hide-lists for vertical columns — replaces four failed CSS-mask attempts (mask-composite, data-URI SVG
// mask, inline SVG mask with userSpaceOnUse, inline SVG mask with objectBoundingBox — see PROJECT.md for why).
// Column numbers are 1-indexed left to right (data-col attribute below matches).
// "Start" columns (2-3) sit under the header logo — computed from its fixed-px box (130px offset, 150px wide, see
// Header.tsx), not yet user-confirmed. "Middle" columns (9-14 wide / 8-15 narrow) sit under the header nav text —
// user-counted by eye, trustworthy. The middle gap continues for exactly one row below the header (2026-09-17,
// corrected from an earlier version that continued it for the whole page — user only wanted the first occurrence),
// then the rest of the page shows the full, unbroken grid.
const START_COLUMNS = new Set([2, 3]);
const MIDDLE_COLUMNS_WIDE = new Set([9, 10, 11, 12, 13, 14]); // hidden at >=1800px (FullHD-ish)
const MIDDLE_COLUMNS_NARROW = new Set([8, 9, 10, 11, 12, 13, 14, 15]); // hidden below 1800px

const HEADER_HIDE_WIDE = new Set([...START_COLUMNS, ...MIDDLE_COLUMNS_WIDE]);
const HEADER_HIDE_NARROW = new Set([...START_COLUMNS, ...MIDDLE_COLUMNS_NARROW]);
const BELOW_HEADER_HIDE_WIDE = MIDDLE_COLUMNS_WIDE;
const BELOW_HEADER_HIDE_NARROW = MIDDLE_COLUMNS_NARROW;

// Literal class strings (not built from a template-interpolated variable) — Tailwind's build-time scanner needs the
// exact "min-[1800px]:hidden" text to appear in the source to generate that utility; a `` `min-[${x}px]:hidden` ``
// template would be invisible to it and silently produce no CSS at all.
const HIDDEN_AT_WIDE = "min-[1800px]:hidden";
const HIDDEN_AT_NARROW = "max-[1799px]:hidden";

function ColumnLines({
  hideWide,
  hideNarrow,
  className,
  style,
}: {
  hideWide: Set<number>;
  hideNarrow: Set<number>;
  className: string;
  style: CSSProperties;
}) {
  return (
    <div className={className} style={style}>
      {Array.from({ length: NUM_COLUMNS }, (_, idx) => {
        const col = idx + 1;
        const visibilityClass = [
          hideWide.has(col) ? HIDDEN_AT_WIDE : "",
          hideNarrow.has(col) ? HIDDEN_AT_NARROW : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div
            key={col}
            data-col={col}
            className={`absolute top-0 h-full ${visibilityClass}`}
            style={{
              left: `calc(${idx} * ${COLUMN_PITCH} - ${LINE_THICKNESS_PX / 2}px)`,
              width: `${LINE_THICKNESS_PX}px`,
              backgroundColor: LINE_COLOR,
            }}
          />
        );
      })}
    </div>
  );
}

export function BackgroundLines() {
  return (
    // FIXED to the viewport, not to the page: several sections are pinned (hero, infrastructure,
    // the machine screen), so the content deliberately stands still while the page scrolls — with a
    // page-absolute grid you'd see the lines sliding behind static content, which read as a glitch.
    // Fixed also means the header-band column lines always line up with the sticky header.
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Grain texture (Figma's own `feTurbulence` noise filter, exported as-is in the SVG) —
          user reported "a lot of white dots," visible in a real browser even though this project's
          own Playwright/Chromium screenshots never showed it (see PROJECT.md: same category of
          browser-rendering difference already suspected for the earlier "background looks lighter"
          report). The filter thresholds continuous turbulence noise into a binary on/off mask
          (`feFuncA type="discrete"`, ~51% of cells fully opaque) — a stippled dot pattern by
          construction, not a smooth grain — and some browsers rasterize a filter this complex at a
          capped internal resolution before scaling it to the page's actual size, exaggerating the
          dots into visible blocky speckles. Cut opacity here (CSS, not touching the Figma-exported
          SVG itself) rather than editing the filter's own values, so it's a one-line, easily
          reversible knob. */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-multiply"
        style={{
          backgroundImage: "url(/background/background-lines.svg)",
          backgroundRepeat: "repeat-y",
          backgroundSize: "100% auto",
        }}
      />
      {/* vertical column lines, header band — hides both the logo (start) and nav (middle) columns */}
      <ColumnLines
        hideWide={HEADER_HIDE_WIDE}
        hideNarrow={HEADER_HIDE_NARROW}
        className="absolute top-0 h-24"
        style={{ left: INSET_VW, right: INSET_VW }}
      />
      {/* vertical column lines, one row directly below the header — the middle (nav) gap continues just this once */}
      <ColumnLines
        hideWide={BELOW_HEADER_HIDE_WIDE}
        hideNarrow={BELOW_HEADER_HIDE_NARROW}
        className="absolute"
        style={{ left: INSET_VW, right: INSET_VW, top: `${HEADER_HEIGHT_PX}px`, height: ROW_PITCH }}
      />
      {/* vertical column lines, rest of the page — full unbroken grid, no columns hidden */}
      <div
        className="absolute bottom-0"
        style={{
          left: INSET_VW,
          right: INSET_VW,
          top: ROW_GRID_TOP,
          backgroundImage: `repeating-linear-gradient(to right, ${LINE_COLOR} 0, ${LINE_COLOR} ${LINE_THICKNESS_PX}px, transparent ${LINE_THICKNESS_PX}px, transparent ${COLUMN_PITCH})`,
          backgroundPositionX: `-${LINE_THICKNESS_PX / 2}px`,
        }}
      />
      {/* horizontal row lines — full viewport width (left:0 to right:0), starts below the header so none land inside it */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: ROW_GRID_TOP,
          backgroundImage: `repeating-linear-gradient(to bottom, ${LINE_COLOR} 0, ${LINE_COLOR} ${LINE_THICKNESS_PX}px, transparent ${LINE_THICKNESS_PX}px, transparent ${ROW_PITCH})`,
        }}
      />
    </div>
  );
}
