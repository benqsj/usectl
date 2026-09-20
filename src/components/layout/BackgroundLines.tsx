import type { CSSProperties } from "react";
import { GridCanvas } from "@/components/layout/GridCanvas";
import {
  INSET_VW,
  COLUMN_PITCH,
  ROW_PITCH,
  HEADER_HEIGHT_PX,
  LINE_COLOR,
  LINE_THICKNESS_PX,
  NUM_COLUMNS,
  MIDDLE_COLUMNS_WIDE,
  MIDDLE_COLUMNS_NARROW,
} from "@/lib/grid";

const ROW_GRID_TOP = `calc(${HEADER_HEIGHT_PX}px + ${ROW_PITCH})`; // first horizontal line sits one full (vw-scaled) row pitch below the header, so that gap matches every later gap at any viewport width — none render inside the header row itself (its own border-b is the only line at that seam)

// Geometry, colours and the hidden-column sets all live in lib/grid.ts now, so the WebGL layer
// (lib/gridEffect/) that draws the very same grid reads the identical numbers. Re-exported here
// because Header.tsx and this file's own ColumnLines have always been the public face of them.
export { HEADER_HIDE_WIDE, HEADER_HIDE_NARROW } from "@/lib/grid";

const BELOW_HEADER_HIDE_WIDE = MIDDLE_COLUMNS_WIDE;
const BELOW_HEADER_HIDE_NARROW = MIDDLE_COLUMNS_NARROW;

// Literal class strings (not built from a template-interpolated variable) — Tailwind's build-time scanner needs the
// exact "min-[1800px]:hidden" text to appear in the source to generate that utility; a `` `min-[${x}px]:hidden` ``
// template would be invisible to it and silently produce no CSS at all.
//
// The narrow one is `max-[1800px]`, NOT `max-[1799px]`, and that is deliberate: Tailwind v4 compiles
// `max-[Npx]` to `@media not (min-width: Npx)`, i.e. strictly LESS than N — so the old
// `max-[1799px]` left a one-pixel hole at exactly 1799px where neither rule matched and every
// column showed (measured 2026-09-20 at 1798/1799/1800). `max-[1800px]` is the exact complement of
// `min-[1800px]`, which is also what the canvas evaluates (isWideViewport in lib/grid.ts), so the
// two can no longer disagree at any width.
const HIDDEN_AT_WIDE = "min-[1800px]:hidden";
const HIDDEN_AT_NARROW = "max-[1800px]:hidden";

export function ColumnLines({
  hideWide,
  hideNarrow,
  className,
  style,
  color = LINE_COLOR,
  cssLayer = false,
}: {
  hideWide: Set<number>;
  hideNarrow: Set<number>;
  className: string;
  style: CSSProperties;
  color?: string;
  /** tag this instance as part of the CSS grid fallback, so it hides once the canvas takes over */
  cssLayer?: boolean;
}) {
  return (
    <div className={className} style={style} {...(cssLayer ? { "data-grid-css-layer": "" } : {})}>
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
              backgroundColor: color,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * The grid itself, as CSS gradient layers — three absolutely-positioned children that expect a
 * positioned parent spanning the viewport.
 *
 * Split out of BackgroundLines so the same markup can be reused: it is what paints on FIRST paint
 * (before any JS), it is the permanent fallback when WebGL2 is unavailable, and the lab page
 * (/lab/lines) renders a second copy of it in a loud colour to compare the canvas against.
 *
 * Every layer is tagged `data-grid-css-layer` — globals.css hides them all once the canvas has
 * actually drawn its first frame (`[data-grid-canvas="on"]` on the wrapper). See GridCanvas.tsx.
 */
export function CssGridLines({ color = LINE_COLOR }: { color?: string }) {
  return (
    <>
      {/* Header-band column lines are NOT rendered here — this whole layer sits behind the sticky
          header's own `backdrop-blur-md` (see Header.tsx), and at this grid's real production
          opacity (2%) the blur+60%-tint washes them out to fully invisible (confirmed 2026-09-18 via
          a Playwright pixel check: a solid, fully-opaque red override in this band produced zero
          visible pixels through the header, while the identical override one row below painted
          cleanly). Rendered instead as a child of <header> itself, above its blur/tint layer, so it
          reads at the same weight as the rest of the page's grid instead of being dampened by it. */}
      {/* vertical column lines, one row directly below the header — the middle (nav) gap continues just this once */}
      <ColumnLines
        hideWide={BELOW_HEADER_HIDE_WIDE}
        hideNarrow={BELOW_HEADER_HIDE_NARROW}
        className="absolute"
        color={color}
        cssLayer
        style={{
          left: INSET_VW,
          right: INSET_VW,
          top: `${HEADER_HEIGHT_PX}px`,
          height: ROW_PITCH,
        }}
      />
      {/* vertical column lines, rest of the page — full unbroken grid, no columns hidden */}
      <div
        data-grid-css-layer=""
        className="absolute bottom-0"
        style={{
          left: INSET_VW,
          right: INSET_VW,
          top: ROW_GRID_TOP,
          backgroundImage: `repeating-linear-gradient(to right, ${color} 0, ${color} ${LINE_THICKNESS_PX}px, transparent ${LINE_THICKNESS_PX}px, transparent ${COLUMN_PITCH})`,
          backgroundPositionX: `-${LINE_THICKNESS_PX / 2}px`,
        }}
      />
      {/* horizontal row lines — full viewport width (left:0 to right:0), starts below the header so none land inside it */}
      <div
        data-grid-css-layer=""
        className="absolute inset-x-0 bottom-0"
        style={{
          top: ROW_GRID_TOP,
          backgroundImage: `repeating-linear-gradient(to bottom, ${color} 0, ${color} ${LINE_THICKNESS_PX}px, transparent ${LINE_THICKNESS_PX}px, transparent ${ROW_PITCH})`,
        }}
      />
    </>
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
      <CssGridLines />
      {/* The same grid again, on a WebGL2 canvas that bends it around the cursor. It hides the CSS
          layers above only once it has drawn a frame (see GridCanvas.tsx / globals.css), so a
          browser without WebGL2 — or a failed context — simply keeps the page exactly as it is
          today. Values are GRID_EFFECT_DEFAULTS, picked in /lab/lines (pull, radius 220,
          strength 16, easing 0.12). */}
      <GridCanvas />
    </div>
  );
}
