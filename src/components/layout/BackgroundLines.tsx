const CANVAS_WIDTH_REF = 1920; // Figma canvas reference width — pitch below is expressed in vw so it scales fluidly on smaller screens instead of snapping at a breakpoint
const vw = (px: number) => `${(px / CANVAS_WIDTH_REF) * 100}vw`;

const COLUMN_PITCH = vw(82); // vertical lines
const ROW_PITCH = vw(114); // horizontal lines
const HEADER_HEIGHT_PX = 96; // Header.tsx h-24 — fixed, doesn't scale
const ROW_GRID_TOP = `calc(${HEADER_HEIGHT_PX}px + ${ROW_PITCH})`; // first horizontal line sits one full (vw-scaled) row pitch below the header, so that gap matches every later gap at any viewport width — none render inside the header row itself (its own border-b is the only line at that seam)
const LINE_COLOR = "rgba(255,255,255,0.02)";
const LINE_THICKNESS_PX = 2; // thicker than a hairline on purpose — with fluid (vw) pitch, 1px lines land on fractional device pixels and anti-alias unevenly (some crisp, some blurry); 2px makes that variance much less noticeable

// Mask holes so vertical line strokes don't cross the header logo/nav text (grain still shows through, only the lines are hidden).
// This container uses the same sizing (mx-auto max-w-[1722px]) as Header.tsx's inner row, so these local px coordinates
// line up with the actual rendered logo/nav position.
const LOGO_HOLE = { x: 102, y: 30, w: 158, h: 36 };
const NAV_HOLE = { w: 580, h: 36, y: 30 };

export function BackgroundLines() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <mask id="grid-lines-mask" maskUnits="objectBoundingBox" x="0" y="0" width="1" height="1">
            <rect x="-100000" y="-100000" width="200000" height="200000" fill="white" />
            <rect x={LOGO_HOLE.x} y={LOGO_HOLE.y} width={LOGO_HOLE.w} height={LOGO_HOLE.h} fill="black" />
            <rect
              x="50%"
              y={NAV_HOLE.y}
              width={NAV_HOLE.w}
              height={NAV_HOLE.h}
              fill="black"
              transform={`translate(${-NAV_HOLE.w / 2} 0)`}
            />
          </mask>
        </defs>
      </svg>
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{
          backgroundImage: "url(/background/background-lines.svg)",
          backgroundRepeat: "repeat-y",
          backgroundSize: "100% auto",
        }}
      />
      {/* vertical column lines — bounded to the content container (matches Figma's x=99..1820.8 span), masked around the logo/nav */}
      <div
        className="absolute inset-y-0 left-1/2 w-full max-w-[1722px] -translate-x-1/2"
        style={{
          backgroundImage: `repeating-linear-gradient(to right, ${LINE_COLOR} 0, ${LINE_COLOR} ${LINE_THICKNESS_PX}px, transparent ${LINE_THICKNESS_PX}px, transparent ${COLUMN_PITCH})`,
          // container width divides evenly by the pitch at the 1920 reference, so the line that would sit exactly on
          // the right edge gets clipped to 0px wide instead of the left edge's full line — shift the whole pattern left
          // by half the line thickness so both edges show a symmetric partial line instead of one full + one missing.
          backgroundPositionX: `-${LINE_THICKNESS_PX / 2}px`,
          WebkitMask: "url(#grid-lines-mask)",
          mask: "url(#grid-lines-mask)",
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
