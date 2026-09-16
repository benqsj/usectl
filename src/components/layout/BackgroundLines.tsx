const CANVAS_WIDTH_REF = 1920; // Figma canvas reference width — everything below is expressed in vw so it scales fluidly on any screen size, matching the FullHD proportions exactly instead of snapping at a breakpoint
const vw = (px: number) => `${(px / CANVAS_WIDTH_REF) * 100}vw`;

const INSET_VW = vw(99); // content container inset — must stay in sync with Header.tsx's own left/right padding
const COLUMN_PITCH = vw(82); // vertical lines
const ROW_PITCH = vw(114); // horizontal lines
const HEADER_HEIGHT_PX = 96; // Header.tsx h-24 — fixed, doesn't scale
const ROW_GRID_TOP = `calc(${HEADER_HEIGHT_PX}px + ${ROW_PITCH})`; // first horizontal line sits one full (vw-scaled) row pitch below the header, so that gap matches every later gap at any viewport width — none render inside the header row itself (its own border-b is the only line at that seam)
const LINE_COLOR = "rgba(255,255,255,0.02)";
const LINE_THICKNESS_PX = 2; // thicker than a hairline on purpose — with fluid (vw) pitch, 1px lines land on fractional device pixels and anti-alias unevenly (some crisp, some blurry); 2px makes that variance much less noticeable

// Mask holes so vertical line strokes don't cross the header logo/nav text (grain still shows through, only the lines are hidden).
// Expressed as fractions of the header band's own box (objectBoundingBox) rather than fixed px, so they stay correctly
// aligned with Header.tsx's logo/nav at ANY viewport width, not just the 1920 reference. Fractions are pure ratios of
// the 1920-reference numbers, which is scale-invariant (numerator and denominator scale together with viewport width).
const CONTENT_WIDTH_REF_PX = 1722; // 1920 - 2*99, the content container width at the reference
const LOGO_HOLE = { x: 102, y: 30, w: 158, h: 36 }; // px-at-1920 reference (logo offset 106px, minus a small buffer)
const NAV_HOLE = { w: 580, h: 36, y: 30 };
const xFrac = (px: number) => px / CONTENT_WIDTH_REF_PX;
const yFrac = (px: number) => px / HEADER_HEIGHT_PX;

const columnGradient = `repeating-linear-gradient(to right, ${LINE_COLOR} 0, ${LINE_COLOR} ${LINE_THICKNESS_PX}px, transparent ${LINE_THICKNESS_PX}px, transparent ${COLUMN_PITCH})`;

export function BackgroundLines() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <mask id="grid-lines-mask" maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox" x="0" y="0" width="1" height="1">
            <rect x="-1" y="-1" width="3" height="3" fill="white" />
            <rect x={xFrac(LOGO_HOLE.x)} y={yFrac(LOGO_HOLE.y)} width={xFrac(LOGO_HOLE.w)} height={yFrac(LOGO_HOLE.h)} fill="black" />
            <rect x={0.5 - xFrac(NAV_HOLE.w) / 2} y={yFrac(NAV_HOLE.y)} width={xFrac(NAV_HOLE.w)} height={yFrac(NAV_HOLE.h)} fill="black" />
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
      {/* vertical column lines, header band — fixed 96px tall (matches the header), masked around the logo/nav */}
      <div
        className="absolute top-0 h-24"
        style={{
          left: INSET_VW,
          right: INSET_VW,
          backgroundImage: columnGradient,
          backgroundPositionX: `-${LINE_THICKNESS_PX / 2}px`,
          WebkitMask: "url(#grid-lines-mask)",
          mask: "url(#grid-lines-mask)",
        }}
      />
      {/* vertical column lines, below the header — no mask needed, nothing to hide there */}
      <div
        className="absolute bottom-0"
        style={{
          left: INSET_VW,
          right: INSET_VW,
          top: `${HEADER_HEIGHT_PX}px`,
          backgroundImage: columnGradient,
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
