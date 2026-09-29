import type { CSSProperties } from "react";
import {
  INSET_VW,
  COLUMN_PITCH,
  ROW_PITCH,
  HEADER_HEIGHT_PX,
  LINE_COLOR,
  LINE_THICKNESS_PX,
  NUM_COLUMNS,
} from "@/lib/grid";

const ROW_GRID_TOP = `calc(${HEADER_HEIGHT_PX}px + ${ROW_PITCH})`; // first horizontal line sits one full (vw-scaled) row pitch below the header, so that gap matches every later gap at any viewport width — none render inside the header row itself (its own border-b is the only line at that seam)

// Re-exported because Header.tsx and this file's own ColumnLines have always been the public face
// of the hidden-column sets (the numbers themselves live in lib/grid.ts).
export { HEADER_HIDE_WIDE, HEADER_HIDE_NARROW } from "@/lib/grid";

// Literal class strings (not built from a template-interpolated variable) — Tailwind's build-time scanner needs the
// exact "min-[1800px]:hidden" text to appear in the source to generate that utility; a `` `min-[${x}px]:hidden` ``
// template would be invisible to it and silently produce no CSS at all.
//
// The narrow one is `max-[1800px]`, NOT `max-[1799px]`, and that is deliberate: Tailwind v4 compiles
// `max-[Npx]` to `@media not (min-width: Npx)`, i.e. strictly LESS than N — so the old
// `max-[1799px]` left a one-pixel hole at exactly 1799px where neither rule matched and every
// column showed (measured 2026-09-20 at 1798/1799/1800). `max-[1800px]` is the exact complement of
// `min-[1800px]`, so the two can no longer disagree at any width.
const HIDDEN_AT_WIDE = "min-[1800px]:hidden";
const HIDDEN_AT_NARROW = "max-[1800px]:hidden";

export function ColumnLines({
  hideWide,
  hideNarrow,
  className,
  style,
  color = LINE_COLOR,
}: {
  hideWide: Set<number>;
  hideNarrow: Set<number>;
  className: string;
  style: CSSProperties;
  color?: string;
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
      {/* vertical column lines — the full, unbroken grid from the header's bottom edge down.
          There used to be a one-row band right under the header in which the middle (nav)
          columns stayed hidden; team feedback 2026-09-29 ("ხაზების ბოლომდე აწევა header-თან")
          asked for every column to run all the way up to the header instead. Inside the header
          itself the nav gap stays (Header.tsx's own ColumnLines). */}
      <div
        className="absolute bottom-0"
        style={{
          left: INSET_VW,
          right: INSET_VW,
          top: `${HEADER_HEIGHT_PX}px`,
          backgroundImage: `repeating-linear-gradient(to right, ${color} 0, ${color} ${LINE_THICKNESS_PX}px, transparent ${LINE_THICKNESS_PX}px, transparent ${COLUMN_PITCH})`,
          backgroundPositionX: `-${LINE_THICKNESS_PX / 2}px`,
        }}
      />
      {/* horizontal row lines — full viewport width (left:0 to right:0), starts below the header so none land inside it */}
      <div
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
    // FIXED to the viewport, not to the page — the header-band column lines always line up with the
    // sticky header, and pinned/scrolling content never shows the grid sliding behind it.
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Grain texture (Figma's own `feTurbulence` noise filter, exported as-is in the SVG) —
          at full opacity its thresholded noise reads as scattered white dots in some browsers
          (`feFuncA type="discrete"` makes a binary stipple pattern by construction, and some
          browsers rasterize the filter at a capped resolution before scaling, exaggerating the
          dots). Cut opacity here (CSS, not touching the Figma-exported SVG itself) so it stays a
          one-line, easily reversible knob. */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-multiply"
        style={{
          backgroundImage: "url(/background/background-lines.svg)",
          backgroundRepeat: "repeat-y",
          backgroundSize: "100% auto",
        }}
      />
      <CssGridLines />
    </div>
  );
}
