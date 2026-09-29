import { readFileSync } from "node:fs";
import path from "node:path";
import { HeroSectionClient } from "./HeroSectionClient";
import { HeroMobile } from "@/components/mobile/HeroMobile";
import { processAgentSvg } from "@/lib/agentSvg";

const readPublic = (file: string) => readFileSync(path.join(process.cwd(), "public", file), "utf8");

// The exploded server ships INLINE (read at build time, server component) so its internal
// layer elements can be animated individually — the state-2→3 transition fades the middle
// layers of the SAME artwork instead of overlay-swapping piece SVGs (user-specified approach).
// Inlining also means the hero art is in the SSR HTML from the first paint (no fetch pop-in).
const serverSvg = readPublic("section-hero/new-server.svg").replace('width="421" height="687"', 'width="100%"');

// State 7's main board: public/section-7/fullserver.svg, processed by lib/agentSvg.ts (ring swap +
// tagged outline — see the notes there).
const agentSvg = processAgentSvg(readPublic("section-7/fullserver.svg"));

// State 5's pods stack, inline so its three slabs can float independently (see the float ticker
// in HeroSectionClient). Its gradient ids (paint*_485_5888) don't clash with the other inline svgs.
const podsSvg = readPublic("section-5/server2.svg").replace('width="689" height="1007"', 'width="100%"');

// State 7's two small boards, inline so their chips can grow in height when the agent "powers"
// them (see the power-up block on seq7 in HeroSectionClient). The right board is the state-6
// board travelling into place, so this is also state 6's board art. No ids inside, no clashes.
const rightBoardSvg = readPublic("section-6/right-bottom.svg").replace('width="348" height="220"', 'width="100%"');
const bottomBoardSvg = readPublic("section-7/bottom-left-server.svg").replace(/width="348" height="\d+"/, 'width="100%"');

export function HeroSection() {
  // < 1024px (phones + portrait tablets) get the stacked, native-scroll version (RESPONSIVE-PLAN.md, model B); the
  // pinned desktop scene is display:none there and its effect bails out before building anything.
  return (
    <>
      <div className="max-lg:hidden">
        <HeroSectionClient
          serverSvg={serverSvg}
          agentSvg={agentSvg}
          podsSvg={podsSvg}
          rightBoardSvg={rightBoardSvg}
          bottomBoardSvg={bottomBoardSvg}
        />
      </div>
      <div className="lg:hidden">
        <HeroMobile />
      </div>
    </>
  );
}
