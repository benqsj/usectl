import { readFileSync } from "node:fs";
import path from "node:path";
import { HeroSectionClient } from "./HeroSectionClient";
import { HeroMobile } from "@/components/mobile/HeroMobile";

const readPublic = (file: string) => readFileSync(path.join(process.cwd(), "public", file), "utf8");

// The exploded server ships INLINE (read at build time, server component) so its internal
// layer elements can be animated individually — the state-2→3 transition fades the middle
// layers of the SAME artwork instead of overlay-swapping piece SVGs (user-specified approach).
// Inlining also means the hero art is in the SSR HTML from the first paint (no fetch pop-in).
const serverSvg = readPublic("section-hero/new-server.svg").replace('width="421" height="687"', 'width="100%"');

// State 7's main board: public/section-7/fullserver.svg (521×329 — the full tray with the agent
// board, chips and processor inside it; replaced last-main-server.svg on 2026-09-29). Inline so
// the ring around the processor can spin. The export draws that ring as two flattened ellipse
// PATHS (a dashed outer one and a solid inner one, both centred 259.81, 137.2 — outer 69.8×40.3,
// inner 59.25×34.2, ratio tan 30°), which can't rotate as a ring, so they are swapped here for
// real circles inside an isometric frame — translate to the centre, then scale(1, tan 30°) — where
// rotate() is a true isometric spin. The replacement sits at the same spot in the document, so the
// processor chip still paints over the ring's back half. What spins (CSS, .ring7-spin* in
// globals.css, so prefers-reduced-motion stops it): the dashed outer ring, slowly backwards; and a
// gradient ring on the inner circle — the whole circle, its colour running RING7_TAIL → RING7_HEAD →
// RING7_TAIL all the way round (a seamless conic gradient built from RING7_SEGMENTS short arcs),
// simply turning. Picked by the team from Claude outputs/section7-ring-demo.html: "gradient" + Cyan.
// If a re-export changes those two paths the regex misses and the file's static ring is shown.
const RING7 = { cx: 259.81, cy: 137.2, rIn: 59.25, rOut: 69.8 };
const RING7_TAIL = "#11A32A";
const RING7_HEAD = "#38E1FF";
const RING7_SEGMENTS = 48;
const RING7_OUTER = /<path d="M214\.832 163\.176[^>]*stroke-dasharray="4\.3 5\.37"\/>\s*/;
const RING7_INNER = /<path d="M221\.648 159\.241[^>]*stroke-width="1\.2895"\/>/;
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a: string, b: string, t: number) => {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
};
const ring7Markup = () => {
  const circ = 2 * Math.PI * RING7.rIn;
  const seg = circ / RING7_SEGMENTS;
  let arcs = "";
  for (let i = 0; i < RING7_SEGMENTS; i++) {
    const t = (1 - Math.cos((2 * Math.PI * (i + 0.5)) / RING7_SEGMENTS)) / 2; // 0 → 1 → 0 round the circle
    arcs +=
      `<circle r="${RING7.rIn}" stroke="${mixHex(RING7_TAIL, RING7_HEAD, t)}" stroke-width="1.6" ` +
      `stroke-dasharray="${(seg + 0.4).toFixed(3)} ${circ.toFixed(3)}" stroke-dashoffset="${(-i * seg).toFixed(3)}"/>`;
  }
  return (
    `<g transform="translate(${RING7.cx} ${RING7.cy}) scale(1 0.5774)">` +
    `<g class="ring7-spin-rev"><circle r="${RING7.rOut}" stroke="#11A32A" stroke-opacity="0.45" stroke-width="1.07459" stroke-dasharray="5.4 6.75"/></g>` +
    `<g class="ring7-spin">${arcs}</g>` +
    `</g>`
  );
};
const agentSvgRaw = readPublic("section-7/fullserver.svg").replace('width="521" height="329"', 'width="100%"');
// The agent board's outline (the only path stroked #11A32A @0.6 with the #1C1C1F fill) ships WHITE
// and tagged: state 7's ignition (seq7 in HeroSectionClient) snaps it to green when the board
// "switches on", and its reset puts it back to white.
const AGENT7_OUTLINE = /(<path d="[^"]*" fill="#1C1C1F") stroke="#11A32A" stroke-opacity="0\.6"/;
const agentSvg = (
  RING7_OUTER.test(agentSvgRaw) && RING7_INNER.test(agentSvgRaw)
    ? agentSvgRaw.replace(RING7_OUTER, "").replace(RING7_INNER, ring7Markup())
    : agentSvgRaw
).replace(AGENT7_OUTLINE, '$1 data-agent-outline stroke="#FFFFFF" stroke-opacity="0.3"');

// State 5's pods stack, inline so its three slabs can float independently (see the float ticker
// in HeroSectionClient). Its gradient ids (paint*_485_5888) don't clash with the other inline svgs.
const podsSvg = readPublic("section-5/server2.svg").replace('width="689" height="1007"', 'width="100%"');

// State 7's two small boards, inline so their chips can grow in height when the agent "powers"
// them (see the power-up block on seq7 in HeroSectionClient). The right board is the state-6
// board travelling into place, so this is also state 6's board art. No ids inside, no clashes.
const rightBoardSvg = readPublic("section-6/right-bottom.svg").replace('width="348" height="220"', 'width="100%"');
const bottomBoardSvg = readPublic("section-7/bottom-left-server.svg").replace(/width="348" height="\d+"/, 'width="100%"');

export function HeroSection() {
  // < 768px (phones) get the stacked, native-scroll version (RESPONSIVE-PLAN.md, model B); the
  // pinned desktop scene is display:none there and its effect bails out before building anything.
  return (
    <>
      <div className="max-md:hidden">
        <HeroSectionClient
          serverSvg={serverSvg}
          agentSvg={agentSvg}
          podsSvg={podsSvg}
          rightBoardSvg={rightBoardSvg}
          bottomBoardSvg={bottomBoardSvg}
        />
      </div>
      <div className="md:hidden">
        <HeroMobile serverSvg={serverSvg} podsSvg={podsSvg} agentSvg={agentSvg} rightBoardSvg={rightBoardSvg} />
      </div>
    </>
  );
}
