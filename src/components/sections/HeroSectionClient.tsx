"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { useGSAP } from "@gsap/react";
import { s, readScale, HEADER_HEIGHT_PX } from "@/lib/grid";
import { NAV_STATE_BY_HASH } from "@/lib/nav";
import { SceneLight } from "@/components/layout/SceneLight";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, useGSAP);

// Pinned hero with a scroll-driven THREE-state scene (built 2026-09-25 against three user
// screenshots: design-ref.png → state 1, second-section.png → state 2, third-section.png →
// state 3). The page does not scroll past this section while the scenes play — everything is
// scrubbed 1:1 with scroll, freezing and reversing with the wheel.
//   1 → 2: hero copy leaves, the exploded server glides from the right column to center (scaling
//          to native size), step-1 copy + layer callouts come in.
//   2 → 3: the callouts/copy leave; the server "condenses" — top-server-piece.svg and
//          bottom-server-piece.svg (public/stack-section/) fade in PIXEL-ALIGNED over the old
//          server's own cap and base (their internal geometry matches new-server.svg exactly —
//          measured), the old image fades out (reads as the middle layers dissolving), then the
//          two pieces drift to the stacked pose with dashed guide lines, and the "Your Stacks" copy
//          + the numbered mono panel come in.
// Every number is a design px at 1920, applied via s() (CSS) or scaled by readScale() (GSAP).

// How much scroll the pinned scene consumes. Shared with the SSR-reserve spacer below so the
// server-rendered page height already matches what GSAP's pin-spacer will later occupy.
const PIN_SCROLL_DISTANCE = 12800;

// State 1 server placement (design px), and where state 2 moves/scales it to.
// top 125 (was 85): lowered a bit per user request; the state-2 glide auto-compensates
// because SERVER_DY derives from this constant
const SERVER_STATE1 = { left: 1362, top: 125, width: 370 };
const SERVER_NATIVE = { w: 421, h: 687 };
const SERVER_STATE2 = { centerX: 960, top: 126 };
const SERVER_DX = SERVER_STATE2.centerX - (SERVER_STATE1.left + SERVER_STATE1.width / 2); // -587
const SERVER_DY = SERVER_STATE2.top - SERVER_STATE1.top; // 41
const SERVER_SCALE = SERVER_NATIVE.w / SERVER_STATE1.width; // ≈1.138

// State 2 right-side callouts: elbow lines from the server's right edge to their labels
// (design px, read off the reference with a coordinate grid; server top at SERVER_STATE2.top).
// start x = each layer's pixel-measured right edge +1 (canvas scan of new-server.svg rows
// 260/390/524 → art edge at 419/417/419 → design 1169/1167/1169): the lines TOUCH the side
// of each layer — the original 1163 started slightly ON the face, 1195 left a visible gap
// The callout connectors are the user's own export, public/section-2/line2.svg (196×53):
// horizontal run → 8px rounded corner UP → vertical → 8px rounded corner → horizontal, stroked
// white at 0.17. The asset's exact corner cubics are reproduced here (control points at
// 0.5523·r, Figma's circle constant) so the shape is identical, and the turn sits at the same
// 62.1% of the span as in the file (121.794 / 196). Only the endpoints are ours: each line still
// starts on its layer's pixel-measured side edge and ends at the label's arrowhead.
const CALLOUT_R = 8;
const CALLOUT_C = 4.418; // 0.5523 × 8 — the corner's Bézier handle length, as exported
const CALLOUT_TURN = 121.794 / 196; // where the vertical run sits along the span, per the asset
const calloutElbow = (x0: number, y0: number, x1: number, y1: number) => {
  const xt = Math.round(x0 + (x1 - x0) * CALLOUT_TURN);
  return (
    `M ${x0} ${y0} H ${xt - CALLOUT_R} ` +
    `C ${xt - CALLOUT_R + CALLOUT_C} ${y0} ${xt} ${y0 - CALLOUT_R + CALLOUT_C} ${xt} ${y0 - CALLOUT_R} ` +
    `V ${y1 + CALLOUT_R} ` +
    `C ${xt} ${y1 + CALLOUT_R - CALLOUT_C} ${xt + CALLOUT_R - CALLOUT_C} ${y1} ${xt + CALLOUT_R} ${y1} ` +
    `H ${x1}`
  );
};
// endpoints kept as numbers too: the state-2 float rebuilds these paths every frame
const CALLOUT_LINES_PTS = [
  [1170, 386, 1362, 339],
  [1168, 516, 1308, 474],
  [1170, 650, 1330, 606],
] as const;
const CALLOUT_LINES = CALLOUT_LINES_PTS.map(([x0, y0, x1, y1]) => calloutElbow(x0, y0, x1, y1));
// label x = line end + 16 (arrowheads sit in between — "ტექსტი ოდნავ მარჯვნივ, ზედ არ დააჯდეს")
const CALLOUT_LABELS = [
  { text: "Auto-scaling K8s Cluster", x: 1378, y: 330, ax: 1362, ay: 339 },
  { text: "Isolated Micro-VM Kernel", x: 1324, y: 465, ax: 1308, ay: 474 },
  { text: "Encrypted Postgres Storage", x: 1346, y: 597, ax: 1330, ay: 606 },
] as const;

// Idle "float" on the two exploded-server states (state 2 = index 1, state 5 = index 4), from the
// approved demo (Claude outputs/server-float-demo.html, team feedback 2026-09-29: "ლივლივი…
// თითქოს ყველა ნაწილი მოძრაობს და არა ერთდროულად"). Every layer rides its own sine, each one
// lower in the stack lagging the one above by FLOAT_LAG radians, with slightly different periods
// so the pattern never looks mechanical. Amplitude in design px.
const FLOAT_AMP = 5;
const FLOAT_PERIOD = 4.2;
const FLOAT_LAG = 0.7;
const FLOAT_PERIOD_MUL = [1, 1.07, 0.95, 1.12] as const;
const floatOffset = (layer: number, t: number) => {
  const w = (2 * Math.PI) / (FLOAT_PERIOD * FLOAT_PERIOD_MUL[layer]);
  return FLOAT_AMP * (Math.sin(w * t - layer * FLOAT_LAG) * 0.85 + Math.sin(w * 0.5 * t + layer * 1.3) * 0.15);
};
// new-server.svg's two middle slabs for the float (the 2→3 code only needs "mid" as one set):
// children 28-52 = lower slab, 53-76 = upper slab; loose chips (101+) that aren't on the base
// face split at bbox y 370. Verified with an exaggerated ±30px split render — no stray pieces.
const SERVER_UPPER_SLAB_MIN = 53;
const SERVER_LOWER_CHIP_MIN_Y = 370;
// server2.svg (state 5) slabs by child index: 112+ top, 58-111 middle, 0-57 bottom.
const PODS_SLAB_STARTS = [112, 58, 0] as const;
const PODS_SVG_UNITS_PER_PX = 689 / 560; // native width / rendered design width (SERVER5.w)

// State 3 stack geometry. The 2→3 transition works INSIDE the inline server svg (fade the
// middle-layer elements, drift the surviving cap/base elements — no overlay swap, per explicit
// user request); bottom-server-piece.svg is only used as the GREENING overlay at rest (it is
// server rows 402-687 pixel-exactly, so grayscaled it is visually identical to the docked base).
// dy 52/-24 (were 107/31): the whole stacked pose sits 55px higher — the user reported the
// state-3 server "ძაან დაბლა" — so the cap comes down less and the base rises slightly to meet it
const CAP_PIECE = { w: 420, h: 284, left: 960 - 420 / 2, top: SERVER_STATE2.top, dy: 52 };
const BOTTOM_PIECE = { w: 417, h: 285, left: 960 - 417 / 2, top: SERVER_STATE2.top + 402, dy: -24 };
// drift amounts in the svg's own user units: CSS px transforms on inline-svg children live in
// the 421-wide viewBox space, which the state-2 wrapper renders at SERVER_SCALE — so design px
// divide by that scale (and the --s fluidity comes along for free, no k() needed)
const CAP_DRIFT_UNITS = CAP_PIECE.dy / SERVER_SCALE;
const BASE_DRIFT_UNITS = BOTTOM_PIECE.dy / SERVER_SCALE;
// inline-svg layer classification (verified by tinting offline — see PROJECT.md): children
// 77-100 = the cap (77-82 are its lower side walls — classifying them as "mid" made the cap's
// under-lines vanish on the 2→3 fade, user-reported; 83-100 plate + asterisk); 0-27 = the base
// body + its top plate; 28-76 = the two middle slabs + their face pieces; 101+ are loose face
// chips split by bbox y (≥500 = on the base's face, the rest sit on the middle slabs).
const SERVER_CAP_RANGE = [77, 100] as const;
const SERVER_BASE_BODY_MAX = 27;
const SERVER_SLABS_MAX = 82;
const SERVER_BASE_CHIP_MIN_Y = 500;
// Dashed guide lines between the settled pieces (design px, drawn at the END positions).
const STACK_GUIDES = [
  { x: 752, y1: 333, y2: 644 },
  { x: 960, y1: 456, y2: 732 },
  { x: 1168, y1: 333, y2: 644 },
] as const;

// y values 30 up from the original ref-derived ones ("ტექსტიც მარჯვენა მხარეს მაღლა აწიე ოდნავ")
const PANEL_ITEMS = [
  {
    no: "01/",
    title: "Application Services",
    desc: "Automated deployment for APIs, web apps, and microservices.",
    y: 417,
  },
  {
    no: "02/",
    title: "Application Storage",
    desc: "High-availability managed databases and S3-compatible object storage.",
    y: 519,
  },
  {
    no: "03/",
    title: "Background Jobs",
    desc: "Isolated worker queues, scheduled CRONs, and async processing.",
    y: 622,
  },
] as const;

// State 4: the Machine (public/machine-section/, closed.svg + opened.svg — same 834×694 viewBox,
// so the closed→opened "unfold" is a pixel-aligned crossfade). Rendered at 720 design px wide.
// left +40 (team feedback 2026-09-29, "svg ცოტა მარჯვნივ"): the dome's left edge was running
// into the paragraph; the right panel moved the same 40 (PANEL4_X) so the gap to it is unchanged.
const MACHINE = { w: 720, h: 599, left: 960 - 720 / 2 + 40, top: 300 };
const PANEL4_X = 1362; // the gradient line; titles/items sit 24 to its right (was 1322)

const PANEL4_ITEMS = [
  { no: "01/", title: "MACHINE BOUNDARY", desc: "Zero cross-project interference", y: 404 },
  { no: "02/", title: "DEDICATED RESOURCES", desc: "CPU, RAM, and Storage isolated per space", y: 486 },
  { no: "03/", title: "ENVIRONMENT CONFIG", desc: "Independent secrets and access policies", y: 569 },
] as const;

// State 5: the Pods view (public/section-5/server2.svg, 689×1007 — the COMPLETE 3-slab exploded
// stack in one SVG, chips and the bottom slab's glow baked in) + three pod-status callouts wired
// to the slabs with rounded elbow arrows (drawn inline so they can dash-draw).
// w 560 / left 650 / top 37 (was 480/820/170): enlarged and re-centered slightly LEFT of the
// page center per user feedback; at this size the svg's stack content spans section-y ≈182-798,
// i.e. vertically centered on the s(980) canvas. Slab top-face tops land at ≈182/424/618
// (native 178/476/715 × 560/689 scale) — the POD y values below derive from those.
// left 650 -> 690 and POD_LABEL_X 1490 -> 1450 -> 1410 (user: svg a bit right, right-hand
// text a bit left, then a second nudge left).
const SERVER5 = { w: 560, left: 690, top: 37, imgDy: 0 };
const POD_LABEL_X = 1410;
const POD_PROGRESS = 80; // the API pod's deploy percentage - the bar/number animate up to it
const PODS: {
  title: string;
  status: string;
  percent?: number;
  deploying: boolean;
  desc: string;
  y: number;
}[] = [
  {
    title: "[ POD // FRONTEND ]",
    status: "RUNNING v1.4.2",
    deploying: false,
    desc: "Independent Deploy \u2022 1 vCPU / 2GB",
    y: 206,
  },
  {
    title: "[ POD // API ]",
    status: "DEPLOYING v2.1.0",
    percent: POD_PROGRESS,
    deploying: true,
    desc: "Zero Downtime \u2022 2 vCPU / 4GB",
    y: 398,
  },
  {
    title: "[ POD // WORKERS ]",
    status: "RUNNING v1.4.2",
    deploying: false,
    desc: "Async Processing \u2022 1 vCPU / 1GB",
    y: 563,
  },
];
// rounded "right, up, right" elbow ending at the arrow tip (ex, ey) — same shape as
// arrow-line.svg. Start point = each slab's right corner, PIXEL-MEASURED from server2.svg via
// canvas alpha-scan (native corners x≈600/y 275,512,715 → stage (1138, 261/453/618) at the
// 560-wide render): start x = ex-340 = 1138; start y = ey+45 = pod.y+55, so the POD y values
// are corner_y − 55 = 206/398/563. Earlier values eyeballed off formulas missed slab 2 by 52px
// and the base by 81px (the slabs' pitch and the base's thickness are both irregular).
// (start x is derived from SERVER5.left so the lines keep touching the corners if the art moves)
const POD_LINE_START_X = SERVER5.left + 488;
// `sy` (start y) defaults to the slab corner at rest; the state-5 float passes it shifted by the
// slab's current offset so the line's start rides the slab while its end never moves.
const podElbow = (ex: number, ey: number, sy = ey + 45) =>
  `M ${POD_LINE_START_X} ${sy} H ${ex - 88} Q ${ex - 80} ${sy} ${ex - 80} ${sy - 8} ` +
  `V ${ey + 8} Q ${ex - 80} ${ey} ${ex - 72} ${ey} H ${ex}`;

// State 6: Continuous Deployment (built against Desktop/new-version/section-6 screenshots).
// The board is public/section-6/right-bottom.svg — its chip layout matches the reference board
// (Group 1728.svg is the same tray empty at 1.5×, left-bottom.svg an unused chip variant; the
// reference's extra heatsink fins exist in no supplied asset and are deliberately omitted).
// A terminal window ("usectl // repository-pipeline") feeds a green push line down to a node on
// the board, a gradient-bordered BUILD badge pops, then two status cards (deploying → live) wire
// to the board with the same rounded elbows as state 5. All numbers are design px at 1920.
// The board and the two status cards were nudged UP 45px (user: "svg-ც და მარჯვნივ ტექსტიც
// ოდნავ მაღლა") — the terminal stays put, so the push line just gets 45px shorter; every
// board-anchored number below (node, elbow starts, card tops, DEPLOY6_LINES) moved with it.
// w 580 → 500 on user request ("svg დააპატარავე ცოტა"), scaled about its own CENTRE so the
// push pipe still lands on the same spot: left 794 → 834, top 485 → 510. Everything anchored to
// the board moved with it — the ring (NODE6, and PIPE6_* derive from it), elbow 1's start, and
// the status cards, which came 20px left so the connector doesn't stretch.
const BOARD6 = { w: 500, h: Math.round((500 * 220) / 348), left: 834, top: 510 };
const TERMINAL6 = { left: 966, top: 311, w: 268 };
const NODE6 = { x: 1083, y: 623, size: 16 };
const NODE6_DIM = 0.3; // the ring's unlit opacity before the pipe reaches it
// The push "pipe" (user-approved demo B): two walls 5px either side of x, starting ~7px under the
// terminal's bottom (it sat glued to it otherwise) and ending EXACTLY on the ring's outline
// (it used to run into the ring's center). Green "info" dots + packets rise inside, node → terminal.
// top 468 → 459 (team, 2026-09-29: "ოდნავ უფრო მაღლა ავიდეს თითქმის რო შეეხოს ზედა ნაწერს"):
// the lane now ends ~2px under the terminal's bottom edge (311 + 145.6 ≈ 456.6) and the bubbles
// stay lit almost to the end (see the fade in tick6), so they visibly reach the terminal.
const PIPE6 = { x: 1083, half: 5, top: 459, wall: 1.5 };
const PIPE6_BOTTOM =
  NODE6.y - Math.sqrt((NODE6.size / 2) ** 2 - PIPE6.half ** 2) - 0.6; // ≈609.2, on the ring
const PIPE6_H = PIPE6_BOTTOM - PIPE6.top;
const PIPE6_INNER_W = PIPE6.half * 2 - PIPE6.wall; // particle canvas width (design px)
const PIPE6_CANVAS_K = 4; // canvas px per design px (crisp up to --s 2 at DPR 2)
// Side margin on the particle canvas: the walls used to hide the edge where each bubble's glow
// (shadowBlur) got cropped; without them the canvas reaches a little past the lane so the glow
// fades out naturally instead of stopping on a hard vertical edge.
const PIPE6_GLOW_PAD = 6;
const BADGE6 = { left: 1227, top: 494 };
const DEPLOY6_X = 1409; // cards' left edge; elbows end just short of it
// Both cards sit in the user's hand-drawn frame, public/border-form.svg (272×90 — see
// DeployFrame6), so they are 272 wide; POD is 120 tall (its bar row needs it, the frame
// stretches), LIVE the frame's own 90.
const DEPLOY6_CARD_W = 272;
const DEPLOY6_CARD_H = { pod: 120, live: 90 };
const DEPLOY6_CARD_TOPS = { pod: 535, live: 704 };
const DEPLOY6_PROGRESS = 64; // the POD card's deploy bar fills to this, then the LIVE line draws
// Board → POD connector: the user's own export, public/section-6/line-pod-connect.svg (48×44,
// stroke white @0.1): a horizontal start, an r≈11.5 turn up, a vertical run, an r≈18 turn and a
// horizontal end. The asset is smaller than the gap it has to bridge here (66 × 89), so its two
// corners are kept EXACTLY as drawn and only its straight runs are stretched: it leaves the
// board's right corner (sx, sy) and ends at (ex, ey), just short of the card, where our arrow sits.
const podConnect = (sx: number, sy: number, ex: number, ey: number) =>
  `M ${sx} ${sy} C ${sx + 6.35127} ${sy} ${sx + 11.5} ${sy - 5.1487} ${sx + 11.5} ${sy - 11.5} ` +
  `V ${ey + 18} C ${sx + 11.5} ${ey + 8.05887} ${sx + 19.5589} ${ey} ${sx + 29.5} ${ey} H ${ex}`;
// x of the straight POD→LIVE drop: the cards' horizontal centre (team, 2026-09-29: "მაგათ შუაში გაწიე")
const DEPLOY6_LINE_X = DEPLOY6_X + DEPLOY6_CARD_W / 2;
const DEPLOY6_LINES: readonly { d: string; ey: number; arrow?: boolean; hairline?: boolean }[] = [
  // board right corner → the deploying card (line-pod-connect.svg, see podConnect)
  { d: podConnect(1338, 656, DEPLOY6_X - 5, 567), ey: 567, arrow: true, hairline: true },
  // POD//API → LIVE: the user's own export, public/section-6/line.svg (vertical hairline, stroke
  // white @0.1, no arrowhead), inlined so it can dash-draw. It drops straight from POD's bottom
  // border (frame y ≈ 87.1 of 90 → 116.1 of 120 → 651.1) to LIVE's top border (≈ 704.8).
  { d: `M ${DEPLOY6_LINE_X} 651.1 V 704.8`, ey: 704, hairline: true },
];
// public/border-form.svg, the deploy cards' frame: its two hand-drawn border strokes stretch
// with the card (preserveAspectRatio none + non-scaling stroke — no dash-draw on these, so that's
// safe), while its small gradient accent bar (13.5, 17.5, 6×15) is a plain span so it never
// squashes. Title rows start 10px right of the bar, as before.
const DEPLOY6_FRAME_PATHS = [
  "M0.540484 1.53223C0.540484 6.75823 0.375209 14.813 0.712537 27.3321C1.04987 39.8512 1.72452 59.5049 2.1647 70.1927C2.79014 82.0067 3.03119 83.9205 3.13963 85.3267C3.1979 85.9794 3.26274 86.5085 3.56112 88.5292",
  "M5.54506 87.2244C12.9995 87.2244 20.4539 87.2244 63.1566 87.1373C105.859 87.0502 183.584 86.876 224.134 86.6913C264.683 86.5065 265.701 86.3165 266.522 86.1843C267.93 85.9575 269.449 85.9128 270.828 85.5961C272.005 85.3258 271.127 83.2282 270.423 70.2486C269.761 58.0405 269.218 34.3942 268.791 21.8488C268.339 8.56695 268.151 5.88734 267.842 2.90902C267.729 1.82743 266.913 1.73318 265.766 1.88537C258.699 2.82334 252.77 2.98615 247.817 2.41263C243.669 1.93225 236.225 0.918068 197.391 0.611647C158.558 0.305225 88.5655 0.699105 52.1667 0.959413C15.7678 1.21972 15.1286 1.58631 14.1522 1.58631C8.83032 1.58631 5.95284 1.49355 4.68548 1.58631C4.04646 1.63156 2.71788 1.33592 0.540649 1.53269",
];
function DeployFrame6() {
  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 272 90"
        preserveAspectRatio="none"
        fill="none"
      >
        {DEPLOY6_FRAME_PATHS.map((d) => (
          <path
            key={d.slice(0, 12)}
            d={d}
            stroke="#3A3A3E"
            strokeOpacity={0.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <span
        aria-hidden="true"
        className="absolute"
        style={{
          left: s(13.5),
          top: s(17.5),
          width: s(6),
          height: s(15),
          background: "linear-gradient(180deg, #11A32A 0%, #8FC6FF 32.9%, #8FEDF7 66.7%, #11A32A 100%)",
        }}
      />
    </>
  );
}

// The "See how it works" arrow: the team's public/button/button-arrow/button-arrow.svg (24×24,
// stroke white @0.7), inlined with currentColor so it turns green with the label on hover. The
// file's 4px inner padding is why the button's gap/right padding are 4/26 instead of 8/32.
function ButtonArrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" style={{ width: s(24), height: s(24), flexShrink: 0 }}>
      <path
        d="M8 16L16 8M16 14L16 8L10 8"
        stroke="currentColor"
        strokeOpacity={0.7}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Pricing +/− buttons (team, 2026-09-29: a nice hover colour, and a visible trace when pressed).
// Hover: the border and glyph go brand green with a faint green wash and a soft outer glow, the
// same green family as the scene light behind the panel. Press: an MUI-style ripple — a circle
// spawned under the pointer that grows past the button's edge and fades (.press-ripple in
// globals.css), plus a tiny press-in scale. Disabled buttons keep their dimmed look.
const STEP_BTN_CLASS =
  "relative flex items-center justify-center overflow-hidden rounded-md border border-white/20 text-white/70 " +
  "transition-[color,border-color,background-color,box-shadow,transform] duration-200 " +
  "enabled:hover:border-[#35c957] enabled:hover:bg-[rgba(17,163,42,0.1)] enabled:hover:text-[#7cf09a] " +
  "enabled:hover:shadow-[0_0_12px_rgba(53,201,87,0.25)] enabled:active:scale-[0.92] disabled:opacity-40";
function pressRipple(e: ReactPointerEvent<HTMLButtonElement>) {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  const r = btn.getBoundingClientRect();
  // big enough to cover the button from wherever it was pressed
  const size = 2 * Math.hypot(Math.max(e.clientX - r.left, r.right - e.clientX), Math.max(e.clientY - r.top, r.bottom - e.clientY));
  const dot = document.createElement("span");
  dot.className = "press-ripple";
  dot.style.left = `${e.clientX - r.left}px`;
  dot.style.top = `${e.clientY - r.top}px`;
  dot.style.width = dot.style.height = `${size}px`;
  dot.addEventListener("animationend", () => dot.remove(), { once: true });
  btn.appendChild(dot);
}

// State 9's scene light scale (see the SceneLight in the closing-CTA block)
const LIGHT9_K = 0.6;

// State 7: AI Infrastructure (built against Desktop/new-version/section-7/). The state-6 board
// shrinks/glides into place as the composition's RIGHT board (right-bottom.svg is byte-identical
// to section-7/bottom-right-server.svg — no swap needed); the main board is last-main-server.svg
// (273×170 — the complete agent board: platform + logo asterisk + green ring + circles + chips
// all baked in; it replaced the empty main-server.svg tray + a hand-drawn inline overlay once the
// user got the full export through), plus bottom-left-server.svg below and short curved
// connectors between board edges.
// The WHOLE state-7 composition (boards, badge, terminal, connectors — everything except the
// left text column) is lifted by S7_DY on user request; the bottom-left board used to run past
// the stage's 980px bottom edge. Every constant below folds it in, and the connectors <svg>
// wraps its paths in one translate(0, S7_DY) group so the hand-written path strings stay as-is.
const S7_DY = -50;
const AGENT7 = { w: 521, left: 763, top: 480 + S7_DY };
// Board positions SOLVED from the connectors (user rule: "ისრები სადაც მთავრდება, მანდ უნდა
// იჯდნენ ის ნაწილები"): arrow A's tip (1287,709) lies exactly on the right board's top-left
// edge AND the connect-both squiggle's upper end (1330,805) on its bottom-left edge → right
// board (1239,641); arrow B's tip (1183,798) on the bottom board's top-left edge AND the
// squiggle's lower end (1317,821) on its top-right edge → bottom board (1062,772). The
// squiggle itself stays put at translate(1316,805) and now BRIDGES the two boards.
// nudged apart along the squiggle's own axis (~9px each side) so connect-both sits centered
// with visible air on both sides ("შუაში იჯდეს") while both arrow tips stay on the edges
const BOARD6_TO7 = { dx: 1245 - BOARD6.left, dy: 634 + S7_DY - BOARD6.top, scale: 348 / BOARD6.w };
const BOTTOM7 = { w: 348, left: 1056, top: 779 + S7_DY };
const BADGE7 = { left: 1005, top: 320 + S7_DY, w: 214 };
const TERMINAL7 = { left: 1455, top: 359 + S7_DY, w: 360 };
// Connectors traced from the evening reference screens; all anchor coordinates are
// pixel-measured board extremes (canvas alpha-scan): main top vertex (1007,488), main right
// corner (1267,623), main bottom-edge midpoint (1141,709), right-board left corner (1292,640),
// right-board bottom vertex (1460,763), bottom-board top edge (1190,~788), bottom-board right
// corner (1414,858). Arrow directions per the screens: INTO the right board's left corner, and
// straight DOWN into the bottom board; the right↔bottom link has NO arrowhead.
// The connector lines are the USER'S OWN SVG exports (public/section-7/right-bottom-line.svg,
// left-bottom-line.svg, connect-both.svg) inlined verbatim so they can dash-draw; each path is
// translated so its start touches the main board's edge (S1≈(1155,565), S2≈(1215,596)).
// The files carry no arrowheads — the triangles are ours, oriented along each path's end
// tangent per the check-lines reference (into the right board's edge; down at the bottom board).
const CONNECTOR7_LINES: readonly {
  tx: number;
  ty: number;
  d: string;
  arrow?: string;
  flip?: boolean;
  scale?: readonly [number, number];
}[] = [
  // main board's lower-right edge -> right board's top-left corner: the user's
  // right-bottom-line.svg UNFLIPPED (per the 7:44PM design capture: it starts right next to
  // line B — "ორივე თითქმის ერთი ადგილიდან" — dips into a bowl, then rises diagonally to the
  // board's corner, ending with its baked-in down-hook; our arrow continues that hook into
  // the board's edge)
  // Its START now sits right beside line B's, on the same board edge (user: "მარჯვენა line-იც
  // თითქმის იქიდან უნდა იწყებოდეს, საიდანაც მარცხენა" — 1172,726 vs B's 1168,728, ~4.5px apart).
  // The exported shape can't be stretched by moving it, so the transform maps its two endpoints:
  // local (0.33,43.48) → (1172,726) and local (119.83,5.98) → the UNCHANGED (1309.5,681.5), i.e.
  // scale (1.1506, 1.1867) about that translate. The end and its arrowhead therefore stay
  // exactly on the right board's edge; only the tail slides over to meet line B.
  {
    tx: 1171.62,
    ty: 674.4,
    scale: [1.1506, 1.1867],
    d: "M0.330811 43.4829L6.92649 49.3026C13.0576 54.7124 22.0648 55.3102 28.857 50.7579L100.109 3.00402C106.463 -1.25493 115.018 0.0371146 119.831 5.98291",
    arrow: "M 1306 684 L 1313 679 L 1316 690 Z",
  },
  // main board's lower-right edge -> bottom board's top-left edge: the user's
  // left-bottom-line.svg verbatim (19x64 S), arrow pointing down at its end
  {
    tx: 1167.5,
    ty: 727.8,
    d: "M0.252825 0.431527L9.39041 5.78637C20.3591 12.2143 20.498 28.0218 9.64382 34.6414C0.649665 40.1267 -1.14058 52.4382 5.9189 60.2579L8.26135 62.8525",
    arrow: "M 1172 794 L 1179 787 L 1183 798 Z",
  },
  // right board <-> bottom board: the user's connect-both.svg squiggle in the small gap
  {
    tx: 1316,
    ty: 805,
    d: "M0.978882 16.332L2.4901 13.5615C3.37276 11.9433 3.08384 9.93698 1.78045 8.6336L1.66841 8.52156C0.162766 7.01592 0.105117 4.59317 1.53744 3.01762C2.92148 1.49517 5.23643 1.27519 6.88246 2.50971L6.96206 2.56941C8.66726 3.84832 11.0681 3.60664 12.4842 2.01353L13.9789 0.332031",
  },
];
// badge → main board's top vertex: the team's own public/section-6/this-line.svg (70×83, stroke
// white @0.1, radius-18 corners) — same shape, only REVERSED so the dash-draw still runs from the
// badge down, and its bottom vertical run lengthened by 11.5 so it spans the real gap: it starts
// just under the badge's bottom edge (measured 388.8 pre-S7_DY) and ends on the board's top
// vertex (1007, 482). Placed at translate(1006.5, 388).
const BADGE7_LINE_D =
  "M 1076 388 V 396.5 C 1076 406.4411 1067.9411 414.5 1058 414.5 H 1025 " +
  "C 1015.0589 414.5 1007 422.5589 1007 432.5 V 482";
// the one scaled connector (non-uniform scale) gets its stroke width divided by the mean scale,
// so it still reads 1.5 wide without vector-effect — with non-scaling-stroke the dash lengths
// live in SCREEN units and the dash-draw stopped short of the arrow (the uncoloured gap)
const connectorStroke = (l: { scale?: readonly [number, number] }, w: number) =>
  l.scale ? w / ((l.scale[0] + l.scale[1]) / 2) : w;

// State 8: the pricing calculator (built against Desktop/new-version/section-8/ — first as a
// standalone scrolled section, then folded INTO the pin on user feedback: "ახალ გვერდზე არ უნდა
// ჩადიოდე, იმავე კონტენტში უნდა ჩნდებოდეს"). The widget is LIVE React state inside the pinned
// scene — steppers and the Monthly/Annual switch drive real math from the unit prices in the
// design's own row copy (the mock's flat "$5/mo" per row contradicts that copy, so rows show
// actual subtotals; default total $15.10 vs the mock's "$15").
const PRICING_ROWS = [
  { key: "vcpu", label: "vCPU", sub: "1 vCPU — $10.00/mo - Max 16", price: 10, max: 16 },
  { key: "memory", label: "Memory", sub: "1 GB — $5.00/mo - Max 64GB", price: 5, max: 64 },
  { key: "storage", label: "Storage", sub: "1 GB — $0.10/mo - Max 1TB", price: 0.1, max: 1000 },
] as const;
type PricingRowKey = (typeof PRICING_ROWS)[number]["key"];
const fmtPrice = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

// State 9: the closing CTA (Desktop/new-version/section-9/) — "What will you build next?" over a
// large mixed-color line ("Keep building" green, "what matters" steel blue), the two state-1
// pill buttons, and a soft green glow hugging the right edge.

export function HeroSectionClient({
  serverSvg,
  agentSvg,
  podsSvg,
  rightBoardSvg,
  bottomBoardSvg,
}: {
  serverSvg: string;
  agentSvg: string;
  podsSvg: string;
  rightBoardSvg: string;
  bottomBoardSvg: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const secondTextRef = useRef<HTMLDivElement>(null);
  const thirdTextRef = useRef<HTMLDivElement>(null);
  const serverRef = useRef<HTMLDivElement>(null);
  const serverSvgRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const calloutBoxRef = useRef<HTMLDivElement>(null);
  const calloutsRef = useRef<HTMLDivElement>(null);
  const bottomPieceRef = useRef<HTMLDivElement>(null);
  const guidesRef = useRef<SVGSVGElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelLineRef = useRef<HTMLDivElement>(null);
  const fourthTextRef = useRef<HTMLDivElement>(null);
  const machineRef = useRef<HTMLDivElement>(null);
  const machineOpenRef = useRef<HTMLDivElement>(null);
  const panel4Ref = useRef<HTMLDivElement>(null);
  const panel4LineRef = useRef<HTMLDivElement>(null);
  const fifthTextRef = useRef<HTMLDivElement>(null);
  const server5Ref = useRef<HTMLDivElement>(null);
  const podsRef = useRef<HTMLDivElement>(null);
  const sixthTextRef = useRef<HTMLDivElement>(null);
  const board6Ref = useRef<HTMLDivElement>(null);
  const terminal6Ref = useRef<HTMLDivElement>(null);
  const pushLine6Ref = useRef<HTMLDivElement>(null);
  const node6Ref = useRef<HTMLDivElement>(null);
  const pipe6WrapRef = useRef<HTMLDivElement>(null);
  const pipe6CanvasRef = useRef<HTMLCanvasElement>(null);
  const badge6Ref = useRef<HTMLDivElement>(null);
  const deploy6Ref = useRef<HTMLDivElement>(null);
  const seventhTextRef = useRef<HTMLDivElement>(null);
  const agent7Ref = useRef<HTMLDivElement>(null);
  const bottom7Ref = useRef<HTMLDivElement>(null);
  const badge7Ref = useRef<HTMLDivElement>(null);
  const badgeLine7Ref = useRef<SVGPathElement>(null);
  const terminal7Ref = useRef<HTMLDivElement>(null);
  const connectors7Ref = useRef<SVGSVGElement>(null);
  const pricing8Ref = useRef<HTMLDivElement>(null);
  const final9Ref = useRef<HTMLDivElement>(null);
  const rulerFillRef = useRef<HTMLDivElement>(null);
  const ssrReserveRef = useRef<HTMLDivElement>(null);

  // state 8's live calculator (React state co-existing with the scrubbed GSAP scene: GSAP only
  // touches the [data-pricing-reveal] wrappers, whose style props never change across renders)
  const [counts, setCounts] = useState<Record<PricingRowKey, number>>({ vcpu: 1, memory: 1, storage: 1 });
  const [annual, setAnnual] = useState(false);
  const stepCount = (key: PricingRowKey, dir: 1 | -1, max: number) =>
    setCounts((c) => ({ ...c, [key]: Math.min(max, Math.max(1, c[key] + dir)) }));
  const priceFactor = annual ? 12 : 1;
  const priceSuffix = annual ? "/yr" : "/mo";
  const priceTotal = (10 * counts.vcpu + 5 * counts.memory + 0.1 * counts.storage) * priceFactor;

  useGSAP(
    () => {
      const section = sectionRef.current;
      const heroText = heroTextRef.current;
      const secondText = secondTextRef.current;
      const thirdText = thirdTextRef.current;
      const server = serverRef.current;
      const serverSvgHost = serverSvgRef.current;
      const glow = glowRef.current;
      const box = calloutBoxRef.current;
      const callouts = calloutsRef.current;
      const bottomPiece = bottomPieceRef.current;
      const guides = guidesRef.current;
      const panel = panelRef.current;
      const panelLine = panelLineRef.current;
      const fourthText = fourthTextRef.current;
      const machine = machineRef.current;
      const machineOpen = machineOpenRef.current;
      const panel4 = panel4Ref.current;
      const panel4Line = panel4LineRef.current;
      const fifthText = fifthTextRef.current;
      const server5 = server5Ref.current;
      const pods = podsRef.current;
      const sixthText = sixthTextRef.current;
      const board6 = board6Ref.current;
      const terminal6 = terminal6Ref.current;
      const pushLine6 = pushLine6Ref.current;
      const node6 = node6Ref.current;
      const pipe6Wrap = pipe6WrapRef.current;
      const pipe6Canvas = pipe6CanvasRef.current;
      const badge6 = badge6Ref.current;
      const deploy6 = deploy6Ref.current;
      const seventhText = seventhTextRef.current;
      const agent7 = agent7Ref.current;
      const bottom7 = bottom7Ref.current;
      const badge7 = badge7Ref.current;
      const badgeLine7 = badgeLine7Ref.current;
      const terminal7 = terminal7Ref.current;
      const connectors7 = connectors7Ref.current;
      const pricing8 = pricing8Ref.current;
      const final9 = final9Ref.current;
      const rulerFill = rulerFillRef.current;
      if (
        !section || !heroText || !secondText || !thirdText || !server || !serverSvgHost || !glow ||
        !box || !callouts || !bottomPiece || !guides || !panel || !panelLine ||
        !fourthText || !machine || !machineOpen || !panel4 || !panel4Line ||
        !fifthText || !server5 || !pods ||
        !sixthText || !board6 || !terminal6 || !pushLine6 || !node6 || !pipe6Wrap || !pipe6Canvas || !badge6 || !deploy6 ||
        !seventhText || !agent7 || !bottom7 || !badge7 || !badgeLine7 ||
        !terminal7 || !connectors7 || !pricing8 || !final9 || !rulerFill
      ) {
        return;
      }

      // The server-rendered placeholder reserved the pin's scroll room so the pre-hydration page
      // height already matches; collapse it before the real pin-spacer takes over (never both).
      if (ssrReserveRef.current) ssrReserveRef.current.style.height = "0px";

      // phones + portrait tablets (< 1024) render HeroMobile instead and this scene is display:none — build nothing
      // (no pin, no wheel driver, no state restore). See RESPONSIVE-PLAN.md.
      if (window.matchMedia("(max-width: 1023px)").matches) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // no animation at all: just show the hero column, which is markup-hidden for the blur-in
        gsap.set([heroText, serverSvgHost], { opacity: 1 });
        return;
      }

      const k = () => readScale();

      // --- blur-stagger text (restored from the pre-reset BlurText + stepSwap pair) ----------
      // Every left-hand column now enters word by word, un-blurring and rising, one field after
      // another — the behaviour the user asked to bring back ("სათითაოდ და ბლურით, როგორც წინა
      // ვერსიაში"). The words are split at RUNTIME instead of in JSX: the markup stays readable
      // and SSR-identical, and React never re-renders these nodes, so the injected spans survive
      // the pricing calculator's state updates. Values are the old ones (blur 12px, y 8,
      // power3.out, per-field stagger + delay), converted from seconds to timeline units.
      const BLUR_DUR = 0.45;
      const BLUR_STAGGER = [0.022, 0.045, 0.01]; // eyebrow / heading / paragraph
      const BLUR_OFFSET = [0, 0.05, 0.14];
      const splitWords = (host: HTMLElement, inline = false) => {
        const texts: Text[] = [];
        const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) texts.push(walker.currentNode as Text);
        const words: HTMLElement[] = [];
        texts.forEach((node) => {
          const value = node.textContent ?? "";
          if (!value.trim()) return;
          // one wrapper per text node keeps the flex-item count of a row unchanged
          const wrap = document.createElement("span");
          value.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (!part.trim()) {
              wrap.appendChild(document.createTextNode(part));
              return;
            }
            const word = document.createElement("span");
            word.setAttribute("data-blur-word", "");
            // inline (not inline-block) inside bg-clip-text headings: an inline-BLOCK child
            // starts its own box, and the parent's background-clip:text then paints nothing —
            // the state-8 gradient headline vanished completely the first time round
            word.style.display = inline ? "inline" : "inline-block";
            word.textContent = part;
            wrap.appendChild(word);
            words.push(word);
          });
          node.parentNode?.replaceChild(wrap, node);
        });
        return words;
      };
      // one field (a heading, a paragraph, an eyebrow row): its words stagger; any image in it
      // (the green hatch) leads them in
      const blurField = (
        field: HTMLElement,
        at: number,
        rank: number,
        useOffset = true,
        endBy?: number,
      ) => {
        let stagger = BLUR_STAGGER[Math.min(rank, BLUR_STAGGER.length - 1)];
        let dur = BLUR_DUR;
        const offset = useOffset ? BLUR_OFFSET[Math.min(rank, BLUR_OFFSET.length - 1)] : 0;
        // button rows and bordered boxes move as ONE piece — splitting their words would animate
        // the label while the border sat there already drawn
        const whole = field.hasAttribute("data-blur-block") || !!field.querySelector("a,button");
        // gradient (background-clip:text) headings must keep their words INLINE, and inline boxes
        // can't be transformed — they fade and un-blur in place instead of rising
        const gradient = !!field.querySelector(".bg-clip-text") || field.classList.contains("bg-clip-text");
        const imgs = whole ? [] : Array.from(field.querySelectorAll<HTMLElement>("img"));
        const targets = whole ? [] : [...imgs, ...splitWords(field, gradient)];
        // A long paragraph at the house stagger runs PAST its state's snap time, and the
        // playhead parks there — so the tail words stayed blurred for good (user: "section-3-ში
        // ტექსტი ბოლომდე სუფთად არ გამოდის, blur-ში ტოვებს"; state 3's window is only 0.5
        // units wide for ~30 words). Given the state's deadline, the stagger (and, if it still
        // doesn't fit, the per-word duration) is compressed so the LAST word lands before it.
        if (endBy !== undefined) {
          const available = endBy - (at + offset);
          if (available < dur) dur = Math.max(0.18, available);
          const n = Math.max(1, targets.length || 1);
          if (n > 1) stagger = Math.min(stagger, Math.max(0, (available - dur) / (n - 1)));
        }
        if (targets.length) {
          tl.fromTo(
            targets,
            { opacity: 0, filter: "blur(12px)", ...(gradient ? {} : { y: () => 8 * k() }) },
            {
              opacity: 1,
              filter: "blur(0px)",
              ...(gradient ? {} : { y: 0 }),
              duration: dur,
              ease: "power3.out",
              stagger,
            },
            at + offset,
          );
        } else {
          tl.fromTo(
            field,
            { autoAlpha: 0, y: () => 14 * k() },
            { autoAlpha: 1, y: 0, duration: dur, ease: "power3.out" },
            at + offset,
          );
        }
      };
      // a whole left column: the container just becomes visible, its fields do the motion
      const blurTextIn = (host: HTMLElement, at: number, endBy?: number) => {
        tl.set(host, { autoAlpha: 1 }, at);
        Array.from(host.children).forEach((child, i) =>
          blurField(child as HTMLElement, at, i, true, endBy),
        );
      };
      // a single element that carries its own hidden state (the pricing headline/paragraph)
      const blurItemIn = (el: HTMLElement, at: number, rank: number) => {
        tl.set(el, { autoAlpha: 1 }, at);
        blurField(el, at, rank, false);
      };
      const lines = Array.from(callouts.querySelectorAll<SVGPathElement>("[data-callout-line]"));
      const labels = Array.from(callouts.querySelectorAll<HTMLElement>("[data-callout-label]"));
      const calloutArrows = Array.from(callouts.querySelectorAll<SVGPathElement>("[data-callout-arrow]"));
      const panelItems = Array.from(panel.querySelectorAll<HTMLElement>("[data-panel-item]"));
      const panel4Items = Array.from(panel4.querySelectorAll<HTMLElement>("[data-panel-item]"));
      const podLines = Array.from(pods.querySelectorAll<SVGPathElement>("[data-pod-line]"));
      const podArrows = Array.from(pods.querySelectorAll<SVGPathElement>("[data-pod-arrow]"));
      const podItems = Array.from(pods.querySelectorAll<HTMLElement>("[data-pod-item]"));
      const podBar = pods.querySelector<HTMLElement>("[data-pod-bar]");
      const podPercent = pods.querySelector<HTMLElement>("[data-pod-percent]");
      const deployLines = Array.from(deploy6.querySelectorAll<SVGPathElement>("[data-deploy-line]"));
      const deployArrows = Array.from(deploy6.querySelectorAll<SVGPathElement>("[data-deploy-arrow]"));
      const deployItems = Array.from(deploy6.querySelectorAll<HTMLElement>("[data-deploy-item]"));
      const deployBar = deploy6.querySelector<HTMLElement>("[data-deploy-bar]");
      const deployPercent = deploy6.querySelector<HTMLElement>("[data-deploy-percent]");
      const connectorLines = Array.from(connectors7.querySelectorAll<SVGPathElement>("[data-connector-line]"));
      const connectorArrows = Array.from(connectors7.querySelectorAll<SVGPathElement>("[data-connector-arrow]"));
      const board6Glow = board6.querySelector<HTMLElement>("[data-board-glow]");
      const pricingItems = Array.from(pricing8.querySelectorAll<HTMLElement>("[data-pricing-reveal]"));
      const pricingGlow = pricing8.querySelector<HTMLElement>("[data-pricing-glow]");
      const bottomImg = bottomPiece.querySelector("img");
      const bottomGlow = bottomPiece.querySelector<HTMLElement>("[data-bottom-glow]");

      // the stack base is born COLORLESS — state 3 animates its green back in as it docks
      if (bottomImg) gsap.set(bottomImg, { filter: "grayscale(1)" });

      // classify the inline server svg's children into cap / base / middle layers
      // (classification rule verified by offline tinting — see the constants above)
      const serverRoot = serverSvgHost.querySelector("svg");
      if (!serverRoot) return;
      const capEls: SVGGraphicsElement[] = [];
      const baseEls: SVGGraphicsElement[] = [];
      const midEls: SVGGraphicsElement[] = [];
      Array.from(serverRoot.children)
        .filter((el) => el.tagName !== "defs")
        .forEach((el, i) => {
          const g = el as SVGGraphicsElement;
          if (i >= SERVER_CAP_RANGE[0] && i <= SERVER_CAP_RANGE[1]) capEls.push(g);
          else if (i <= SERVER_BASE_BODY_MAX) baseEls.push(g);
          else if (i <= SERVER_SLABS_MAX) midEls.push(g);
          else (g.getBBox().y >= SERVER_BASE_CHIP_MIN_Y ? baseEls : midEls).push(g);
        });

      // Prepare line "draw" reveals: hide each polyline/path behind its own full dash offset.
      [...lines, ...podLines, ...deployLines, ...connectorLines, badgeLine7].forEach((line) => {
        const len = line.getTotalLength();
        line.style.strokeDasharray = `${len}`;
        line.style.strokeDashoffset = `${len}`;
      });
      // ...and only NOW un-hide the layers that hold them. Their SSR markup is fully drawn — the
      // dash offsets only exist once this effect has run — so before this the browser painted
      // every connector of every state at once for a frame on each reload (user: "refresh რომ
      // ხდება, წამიერად თითქმის ყველა line ერთ ადგილას ჩნდება").
      section.querySelectorAll<SVGElement>("[data-line-layer]").forEach((el) => {
        el.style.opacity = "1";
      });

      // --- the Machine's real unfold -----------------------------------------------------
      // ONE inline svg (opened.svg) plays BOTH states: closed.svg and opened.svg share the same
      // coordinate system (measured: the DATABASE assembly is identical in both; the WORKERS
      // assembly is collapsed by exactly (+38.5, +81.2) along the isometric axis in the closed
      // file, APPLICATION SERVICES by (+78, +163.2); the tall pillars and the covered RDS/PG +
      // JOB/QUE chips simply don't exist in closed). So the machine mounts with those exact
      // collapse offsets applied — pixel-equivalent to closed.svg, no second image, no swap —
      // and the unfold just drives the SAME elements back to their natural positions while the
      // pillars/hidden chips fade in. Scrubbed via a proxy → freezes and reverses with scroll.
      // Index ranges are contiguous, so <g>-wrapping preserves paint order (groups verified
      // offline by tinting — see PROJECT.md).
      const SVG_NS = "http://www.w3.org/2000/svg";
      const unfoldProxy = { p: 0 };
      const easeInOut = gsap.parseEase("power2.inOut");
      const easeOut = gsap.parseEase("power2.out");
      type Moving = { el: SVGGElement; dx: number; dy: number; win: readonly [number, number] };
      type Fading = { el: SVGGElement; win: readonly [number, number] };
      // a leg = one pillar (4 paths): an outer <g> clipped at the pillar's own top (the
      // platform underside) and an inner <g> that slides down out of it — landing gear
      type Leg = { outer: SVGGElement; inner: SVGGElement; clip: string; h: number; win: readonly [number, number] };
      let movers: Moving[] | null = null;
      let faders: Fading[] | null = null;
      let legs: Leg[] | null = null;
      const easeLeg = gsap.parseEase("power3.out");
      // tiny touch-down settle of the platforms while the legs land (design px in svg units)
      const SETTLE_WIN = [0.8, 0.97] as const;
      const SETTLE_DY = 1.5;
      const localP = (win: readonly [number, number]) =>
        Math.min(1, Math.max(0, (unfoldProxy.p - win[0]) / (win[1] - win[0])));
      const applyUnfold = () => {
        if (!movers || !faders) return;
        const sp = localP(SETTLE_WIN);
        const settle = sp > 0 && sp < 1 ? SETTLE_DY * Math.sin(Math.PI * sp) : 0;
        for (const m of movers) {
          const e = easeInOut(localP(m.win));
          gsap.set(m.el, { x: m.dx * (1 - e), y: m.dy * (1 - e) + settle });
        }
        for (const f of faders) {
          gsap.set(f.el, { opacity: easeOut(localP(f.win)) });
        }
        if (legs) {
          for (const l of legs) {
            const lp = localP(l.win);
            gsap.set(l.inner, { y: -(l.h + 10) * (1 - easeLeg(lp)) });
            // landed → drop the clip so the settled frame is byte-identical to opened.svg
            // (a clipped group anti-aliases ~20 edge pixels by 1-2 levels)
            if (lp >= 1) l.outer.removeAttribute("clip-path");
            else l.outer.setAttribute("clip-path", l.clip);
          }
        }
      };
      const wrapRange = (svg: SVGSVGElement, els: Element[], from: number, to: number) => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const parent = els[from].parentNode as Node;
        parent.insertBefore(g, els[from]);
        for (let i = from; i <= to; i++) g.appendChild(els[i]);
        return g;
      };
      fetch("/machine-section/opened.svg")
        .then((r) => r.text())
        .then((text) => {
          machineOpen.innerHTML = text;
          const svg = machineOpen.querySelector("svg");
          if (!svg) return;
          svg.setAttribute("width", "100%");
          svg.removeAttribute("height");
          (svg as unknown as HTMLElement).style.display = "block";
          const els = Array.from(svg.children).filter((el) => el.tagName !== "defs");
          // inner fade groups FIRST (sub-ranges), then the outer moving assemblies around them
          const dbChips = wrapRange(svg, els, 49, 60); // RDS/PG — covered by WORKERS while closed
          const wChips = wrapRange(svg, els, 85, 96); // JOB/QUE — covered by APPS while closed
          // Legs: each pillar (4 consecutive paths) gets outer <g clip-path> + inner sliding <g>.
          // The clip rect covers the pillar's full bbox (+ stroke margin), so the settled frame
          // is pixel-identical to opened.svg; hidden = inner slid up above the clip top.
          let defs = svg.querySelector("defs");
          if (!defs) {
            defs = document.createElementNS(SVG_NS, "defs");
            svg.prepend(defs);
          }
          const legDefs = defs;
          const makeLeg = (from: number) => {
            const outer = document.createElementNS(SVG_NS, "g");
            const inner = document.createElementNS(SVG_NS, "g");
            (els[from].parentNode as Node).insertBefore(outer, els[from]);
            outer.appendChild(inner);
            for (let i = from; i < from + 4; i++) inner.appendChild(els[i]);
            const bb = inner.getBBox();
            const cp = document.createElementNS(SVG_NS, "clipPath");
            cp.id = `machine-leg-clip-${from}`;
            const r = document.createElementNS(SVG_NS, "rect");
            r.setAttribute("x", `${bb.x - 3}`);
            r.setAttribute("y", `${bb.y - 2}`);
            r.setAttribute("width", `${bb.width + 6}`);
            r.setAttribute("height", `${bb.height + 6}`);
            cp.appendChild(r);
            legDefs.appendChild(cp);
            outer.setAttribute("clip-path", `url(#${cp.id})`);
            return { outer, inner, clip: `url(#${cp.id})`, h: bb.height, x: bb.x };
          };
          const wLegs = [61, 65, 69, 73].map(makeLeg);
          const aLegs = [97, 101, 105, 109].map(makeLeg);
          // moving assemblies: WORKERS = legs..chips, APPS = legs..its own chips
          const gW = document.createElementNS(SVG_NS, "g");
          svg.insertBefore(gW, wLegs[0].outer);
          wLegs.forEach((l) => gW.appendChild(l.outer));
          for (let i = 77; i <= 84; i++) gW.appendChild(els[i]);
          gW.appendChild(wChips);
          const gA = document.createElementNS(SVG_NS, "g");
          svg.insertBefore(gA, aLegs[0].outer);
          aLegs.forEach((l) => gA.appendChild(l.outer));
          for (let i = 113; i <= 132; i++) gA.appendChild(els[i]);
          // Sequence (user-approved demo, "ჯერ გაიშალოს და მერე ფეხები ჩამოვიდეს"): the
          // platforms unfold together WITHOUT legs, covered chips reveal, THEN the legs slide
          // down out of each platform's underside (both levels together, pairs staggered L→R)
          movers = [
            { el: gW, dx: 38.5, dy: 81.2, win: [0.03, 0.55] },
            { el: gA, dx: 78, dy: 163.2, win: [0.03, 0.55] },
          ];
          faders = [
            { el: dbChips, win: [0.35, 0.55] },
            { el: wChips, win: [0.35, 0.55] },
          ];
          legs = [wLegs, aLegs].flatMap((set) =>
            [...set]
              .sort((a, b) => a.x - b.x)
              .map((l, i) => {
                const start = 0.6 + (i % 2) * 0.03 + Math.floor(i / 2) * 0.08;
                return { outer: l.outer, inner: l.inner, clip: l.clip, h: l.h, win: [start, start + 0.25] as const };
              }),
          );
          // sync to wherever the scrubbed proxy already is (fresh mount = fully collapsed ≡ closed)
          applyUnfold();
        })
        .catch(() => {});

      // The master timeline is PAUSED and fully DECOUPLED from scroll (user feedback, round 2:
      // even a 1s scrub glide still read as "the animation follows my wheel"). A standalone
      // ScrollTrigger created after the states only PINS the section; transitions are played
      // time-based by goToState() below — slow and eased, fullpage.js-style.
      const tl = gsap.timeline({ paused: true });

      // ---- state 1 → state 2 -------------------------------------------------------------
      tl.to(heroText, { y: () => -60 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.35 }, 0);
      tl.to(
        server,
        {
          x: () => SERVER_DX * k(),
          y: () => SERVER_DY * k(),
          scale: SERVER_SCALE,
          transformOrigin: "50% 0%",
          ease: "power2.inOut",
          // stretched across the segment so the center glide reads slow and graceful
          // (~1.1s real time with the segment's power1.out traversal); the callout wiring
          // below waits for this to FINISH (0.75) before drawing — explicit user request
          duration: 0.7,
        },
        0.05,
      );
      blurTextIn(secondText, 0.4, 1.06);
      tl.fromTo(glow, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.45);
      // the whole right-side wiring starts only AFTER the server has fully parked (0.75) —
      // lines drawn toward a still-moving server read as misaligned (user report)
      tl.fromTo(
        box,
        { y: () => 30 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.25 },
        0.76,
      );
      lines.forEach((line, i) => {
        tl.to(line, { strokeDashoffset: 0, ease: "none", duration: 0.14 }, 0.78 + i * 0.08);
      });
      calloutArrows.forEach((arrow, i) => {
        tl.fromTo(arrow, { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.92 + i * 0.055);
      });
      labels.forEach((label, i) => {
        tl.fromTo(
          label,
          { x: () => 20 * k(), autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: "power2.out", duration: 0.12 },
          0.82 + i * 0.07,
        );
      });
      tl.to({}, { duration: 0.15 }); // hold at the settled state 2

      // ---- state 2 → state 3 -------------------------------------------------------------
      tl.to(secondText, { y: () => -40 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.25 }, 1.2);
      tl.to(callouts, { autoAlpha: 0, ease: "power1.in", duration: 0.2 }, 1.2);

      // The middle layers of the inline server svg simply fade away — the cap and base are the
      // SAME artwork and just remain (no overlay swap, no z-order shuffling; user-specified
      // approach), then the survivors drift into the stacked pose.
      tl.to(midEls, { autoAlpha: 0, ease: "power1.in", duration: 0.35 }, 1.28);
      tl.to(glow, { autoAlpha: 0, duration: 0.3 }, 1.3);

      tl.to(capEls, { y: CAP_DRIFT_UNITS, ease: "power2.inOut", duration: 0.38 }, 1.64);
      tl.to(baseEls, { y: BASE_DRIFT_UNITS, ease: "power2.inOut", duration: 0.38 }, 1.64);

      // once docked, the base "powers on": the green stacked-base art (born grayscale, i.e.
      // visually identical to the silver base it covers) fades in over it while its color
      // returns and the ground glow blooms — reads as a pure color change, not a swap
      tl.set(bottomPiece, { y: () => BOTTOM_PIECE.dy * k() }, 1.64);
      tl.fromTo(bottomPiece, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 2.02);
      tl.to(bottomImg, { filter: "grayscale(0)", ease: "power1.inOut", duration: 0.28 }, 2.02);
      tl.to(bottomGlow, { opacity: 1, ease: "power1.inOut", duration: 0.26 }, 2.04);
      tl.set(baseEls, { opacity: 0 }, 2.24); // fully covered by the overlay — avoid doubled edges
      tl.fromTo(guides, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 2.08);

      blurTextIn(thirdText, 1.8, 2.26);
      tl.fromTo(
        panelLine,
        { scaleY: 0, autoAlpha: 0, transformOrigin: "50% 0%" },
        { scaleY: 1, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        1.85,
      );
      panelItems.forEach((item, i) => {
        tl.fromTo(
          item,
          { x: () => 24 * k(), autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: "power2.out", duration: 0.2 },
          1.9 + i * 0.08,
        );
      });
      tl.to({}, { duration: 0.15 }); // hold at the settled state 3

      // ---- state 3 → state 4 -------------------------------------------------------------
      tl.to(thirdText, { y: () => -40 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.25 }, 2.35);
      tl.to(panel, { autoAlpha: 0, ease: "power1.in", duration: 0.2 }, 2.35);
      tl.to(guides, { autoAlpha: 0, duration: 0.15 }, 2.35);
      tl.to(
        capEls,
        { y: (CAP_PIECE.dy - 40) / SERVER_SCALE, autoAlpha: 0, ease: "power2.in", duration: 0.25 },
        2.4,
      );
      tl.to(bottomPiece, { y: () => (BOTTOM_PIECE.dy + 30) * k(), autoAlpha: 0, ease: "power2.in", duration: 0.25 }, 2.4);

      // the closed Machine arrives... (longer than the house 0.35 — this segment's traversal is
      // also slowed in goToState, together giving a calm ~0.5s real-time entrance)
      tl.fromTo(
        machine,
        { y: () => 70 * k(), scale: 0.92, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, ease: "power2.out", duration: 0.5 },
        2.6,
      );
      // ...settles closed for a beat, then the SAME svg unfolds: the assemblies rise from their
      // collapse offsets to their natural positions, pillars/covered chips fading in as they go —
      // scrubbed 1:1 with scroll via the proxy above. No image swap anywhere.
      tl.to(unfoldProxy, { p: 1, ease: "none", duration: 1.0, onUpdate: applyUnfold }, 3.1);

      blurTextIn(fourthText, 2.75, 4.2);
      // The right panel used to wait for the WHOLE unfold (3.75, i.e. 65% into it), so for most
      // of the state-4 crossing nothing happened but the machine opening — user: "სანამ ეგ არ
      // იშლება არაფერი არ ხდება, არც მარჯვნივ ტექსტები არ გამოდის". It now starts a short beat
      // AFTER the unfold begins (3.1 + 0.25) and is fully in by 3.83, while the machine is still
      // opening until 4.1 — the two motions overlap instead of queueing.
      tl.fromTo(
        panel4Line,
        { scaleY: 0, autoAlpha: 0, transformOrigin: "50% 0%" },
        { scaleY: 1, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        3.35,
      );
      panel4Items.forEach((item, i) => {
        tl.fromTo(
          item,
          { x: () => 24 * k(), autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: "power2.out", duration: 0.2 },
          3.45 + i * 0.09,
        );
      });
      tl.to({}, { duration: 0.2 }); // hold at the settled state 4

      // ---- state 4 → state 5 -------------------------------------------------------------
      tl.to(fourthText, { y: () => -40 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.25 }, 4.45);
      tl.to(panel4, { autoAlpha: 0, ease: "power1.in", duration: 0.2 }, 4.45);
      tl.to(machine, { y: () => 60 * k(), scale: 0.94, autoAlpha: 0, ease: "power2.in", duration: 0.3 }, 4.5);

      tl.fromTo(
        server5,
        { y: () => 70 * k(), scale: 0.94, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, ease: "power2.out", duration: 0.5 },
        4.8,
      );
      blurTextIn(fifthText, 4.9, 5.9);
      // slower and slightly further apart (user: "ტექსტები ძაან მალე გამოდის, ოდნავ შეანელე") —
      // the whole run still has to land before state 5's 5.95 snap
      podLines.forEach((line, i) => {
        tl.to(line, { strokeDashoffset: 0, ease: "none", duration: 0.22 }, 5.05 + i * 0.18);
      });
      podArrows.forEach((arrow, i) => {
        tl.fromTo(arrow, { opacity: 0 }, { opacity: 1, duration: 0.08 }, 5.24 + i * 0.18);
      });
      podItems.forEach((item, i) => {
        tl.fromTo(
          item,
          { x: () => 20 * k(), autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: "power2.out", duration: 0.26 },
          5.26 + i * 0.18,
        );
      });
      // the API pod's deploy bar must FILL on arrival, not appear already full (user request):
      // scaleX 0→1 over the width that represents POD_PROGRESS, with the % number counting along.
      if (podBar) {
        gsap.set(podBar, { transformOrigin: "left center", scaleX: 0 });
        tl.fromTo(
          podBar,
          { scaleX: 0 },
          { scaleX: 1, ease: "power1.out", duration: 0.28 },
          5.62,
        );
      }
      if (podPercent) {
        const counter = { v: 0 };
        podPercent.textContent = "0";
        tl.to(
          counter,
          {
            v: POD_PROGRESS,
            ease: "power1.out",
            duration: 0.28,
            onUpdate: () => {
              podPercent.textContent = String(Math.round(counter.v));
            },
          },
          5.62,
        );
      }
      tl.to({}, { duration: 0.25 }); // hold at the settled state 5

      // ---- state 5 → state 6 -------------------------------------------------------------
      tl.to(fifthText, { y: () => -40 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.25 }, 6.1);
      tl.to(pods, { autoAlpha: 0, ease: "power1.in", duration: 0.2 }, 6.1);
      tl.to(server5, { y: () => 60 * k(), scale: 0.94, autoAlpha: 0, ease: "power2.in", duration: 0.3 }, 6.15);

      // the flat pod board rises in, then the deploy pipeline assembles around it top-down:
      // terminal → the push line draws down to the node → BUILD badge → the two status cards.
      tl.fromTo(
        board6,
        { y: () => 70 * k(), scale: 0.94, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, ease: "power2.out", duration: 0.55 },
        6.45,
      );
      blurTextIn(sixthText, 6.55, 8.7);
      tl.fromTo(
        terminal6,
        { y: () => -40 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.45 },
        6.85,
      );
      // ---- state 6's terminal → pipe → node sequence (its OWN time-based timeline) ----------
      // Typing needs real seconds, not the crossing's compressed timeline units, so this runs
      // on `seq6`, started by a gate at 6.9 on the way in and reset when the playhead goes back
      // past it. The main tl only fades the pipe's WRAPPER out at 9.0 (never the inner parts).
      const typeEls = Array.from(terminal6.querySelectorAll<HTMLElement>("[data-type6]"));
      const typeTexts = typeEls.map((el) => el.dataset.type6 ?? "");
      const rows6 = Array.from(terminal6.querySelectorAll<HTMLElement>("[data-row6]"));
      const curs6 = Array.from(terminal6.querySelectorAll<HTMLElement>("[data-cur6]"));
      const dot6 = terminal6.querySelector<HTMLElement>("[data-dot6]");
      const flow6 = { v: 0 };
      const flowGate6 = { on: 1 };
      const reset6 = () => {
        typeEls.forEach((el) => (el.textContent = ""));
        curs6.forEach((el) => el.classList.remove("t6-blink"));
      };
      reset6();
      const seq6 = gsap.timeline({ paused: true });
      {
        // row r: [start, per-char seconds]; typing segments are grouped by their row index
        const ROW_T = [
          [0.05, 0.028],
          [0.73, 0.009],
          [1.23, 0.01],
        ] as const;
        let pipeAt = 0;
        rows6.forEach((row, r) => {
          const [start, perChar] = ROW_T[r];
          let at = start;
          seq6.fromTo(row, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, at);
          const cur = curs6[r];
          if (cur) seq6.fromTo(cur, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, at);
          if (r === 1 && dot6) {
            seq6.fromTo(dot6, { scale: 0.3, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, ease: "back.out(2)", duration: 0.15 }, at);
            at += 0.1;
          }
          typeEls.forEach((el, i) => {
            if (Number(el.dataset.typeRow6) !== r) return;
            const text = typeTexts[i];
            const o = { n: 0 };
            const dur = text.length * perChar;
            seq6.to(o, { n: text.length, duration: dur, ease: "none", onUpdate: () => {
              el.textContent = text.slice(0, Math.round(o.n));
            } }, at);
            at += dur;
          });
          // rows 1-2 lose their typing cursor when done; row 3's block stays and starts blinking
          if (cur && r < rows6.length - 1) seq6.to(cur, { autoAlpha: 0, duration: 0.01 }, at);
          if (cur && r === rows6.length - 1) seq6.call(() => cur.classList.add("t6-blink"), undefined, at);
          // the pipe starts as soon as row 0 ("git push origin main") is typed, not after the
          // whole log (team, 2026-09-29: "ბუშტუკები ... უფრო მალე დააწყებინე") — the other two
          // rows keep typing while the bubbles already rise
          if (r === 0) pipeAt = at + 0.04;
        });
        // the pipe draws down from the terminal to the ring
        seq6.fromTo(
          pushLine6,
          { scaleY: 0, autoAlpha: 0, transformOrigin: "50% 0%" },
          { scaleY: 1, autoAlpha: 1, ease: "none", duration: 0.3 },
          pipeAt,
        );
        // the ring does NOT move or scale — it is already there and simply IGNITES in place
        // (user: "არ შემოვიდეს გვერდიდან, სადაც ზის მანდ იჯდეს და მანდვე აენთოს")
        const ringAt = pipeAt + 0.28;
        seq6.fromTo(node6, { autoAlpha: NODE6_DIM, boxShadow: "0 0 0px rgba(17,163,42,0)" },
          { autoAlpha: 0.8, boxShadow: "0 0 16px rgba(17,163,42,0.9)", duration: 0.06, ease: "none",
            immediateRender: false }, ringAt);
        seq6.to(node6, { autoAlpha: 0.4, duration: 0.06, ease: "none" });
        seq6.to(node6, { autoAlpha: 1, boxShadow: "0 0 18px rgba(17,163,42,0.95)", duration: 0.08, ease: "none" });
        seq6.to(node6, { boxShadow: "0 0 10px rgba(17,163,42,0.55)", duration: 0.35, ease: "power2.out" });
        // then the info starts flowing up the pipe
        seq6.fromTo(flow6, { v: 0 }, { v: 1, duration: 0.4, ease: "power1.inOut" }, ringAt + 0.1);
      }
      // the ring SITS on the board from the start (dim, part of the board as it rises in) and
      // only lights up when the pipe reaches it — it never "arrives" from anywhere
      // (user: "სადაც თავიდან ზის მანდ იყოს, სხვა წერტილიდან ნუ მოგაქვს")
      tl.fromTo(node6, { autoAlpha: 0 }, { autoAlpha: NODE6_DIM, ease: "power1.out", duration: 0.3 }, 6.6);
      const gate6 = { v: 0 };
      tl.fromTo(
        gate6,
        { v: 0 },
        {
          v: 1,
          duration: 0.01,
          onComplete: () => {
            seq6.restart();
          },
          onReverseComplete: () => {
            seq6.pause(0);
            reset6();
          },
        },
        6.9,
      );

      // particles: dots + small "packets" rising from the ring to the terminal, drawn in design
      // px on a fixed-resolution canvas (CSS stretches it with --s)
      const ctx6 = pipe6Canvas.getContext("2d");
      type P6 = { x: number; y: number; vy: number; r: number; h: number; ph: number; wob: number; a: number };
      let parts6: P6[] = [];
      let spawnAcc6 = 0;
      let dirty6 = false;
      const spawn6 = (yOff = 0) => {
        const packet = Math.random() < 0.35;
        parts6.push({
          x: PIPE6_GLOW_PAD + PIPE6_INNER_W / 2 + (Math.random() * 2 - 1) * (PIPE6_INNER_W / 2 - 1.6),
          y: PIPE6_H - 1 + yOff,
          vy: 38 + Math.random() * 34,
          r: packet ? 0 : 0.9 + Math.random() * 0.9,
          h: packet ? 3 + Math.random() * 3 : 0,
          ph: Math.random() * 6.28,
          wob: 0.4 + Math.random() * 0.9,
          a: 0.55 + Math.random() * 0.45,
        });
      };
      const tick6 = (_t: number, deltaMs: number) => {
        if (!ctx6) return;
        const f = flow6.v * flowGate6.on;
        if (f <= 0 && parts6.length === 0) {
          if (dirty6) {
            ctx6.clearRect(0, 0, pipe6Canvas.width, pipe6Canvas.height);
            dirty6 = false;
          }
          return;
        }
        const dt = Math.min(0.05, deltaMs / 1000);
        if (f > 0) {
          spawnAcc6 += dt * 13 * f;
          while (spawnAcc6 >= 1) {
            spawn6();
            spawnAcc6--;
          }
          // an occasional little "train" of info
          if (Math.random() < dt * 0.35 * f) [0, 4, 8].forEach((o) => spawn6(o));
        }
        const K = PIPE6_CANVAS_K;
        ctx6.setTransform(1, 0, 0, 1, 0, 0);
        ctx6.clearRect(0, 0, pipe6Canvas.width, pipe6Canvas.height);
        ctx6.setTransform(K, 0, 0, K, 0, 0);
        ctx6.shadowColor = "rgba(40,220,80,0.9)";
        ctx6.shadowBlur = 4 * K;
        parts6 = parts6.filter((q) => q.y > -6);
        for (const q of parts6) {
          q.y -= q.vy * dt;
          q.ph += dt * 4;
          const x = q.x + Math.sin(q.ph) * q.wob;
          const life = 1 - q.y / PIPE6_H; // 0 at the ring → 1 at the terminal
          // fade in over the first ~1/6 of the lane, out over only its last ~5px (reaches the terminal)
          const fade = Math.max(0, Math.min(1, life * 6) * Math.min(1, ((1 - life) * PIPE6_H) / 5));
          ctx6.globalAlpha = q.a * fade;
          ctx6.fillStyle = life > 0.85 ? "#8ff5a4" : "#27c948";
          if (q.r) {
            ctx6.beginPath();
            ctx6.arc(x, q.y, q.r, 0, Math.PI * 2);
            ctx6.fill();
          } else {
            ctx6.fillRect(x - 0.8, q.y - q.h / 2, 1.6, q.h);
          }
        }
        ctx6.globalAlpha = 1;
        dirty6 = true;
      };
      gsap.ticker.add(tick6);

      tl.fromTo(
        badge6,
        { y: () => 16 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.2 },
        7.52,
      );
      // The pipeline now reads as cause → effect (user: "როცა pod შეივსება, მერე უნდა შეუერთდეს
      // ხაზი LIVE-ს"): line 1 + the POD card land first, the deploy bar fills, and only THEN does
      // line 2 draw down to the LIVE card, which fades in behind its arrowhead. Everything must
      // finish before state 6's snap at 8.8, hence the whole run was pulled ~0.2 earlier.
      const DEPLOY_LINE_T = [7.75, 8.5];
      const DEPLOY_ARROW_T = [7.95, 8.68];
      const DEPLOY_ITEM_T = [7.97, 8.64];
      deployLines.forEach((line, i) => {
        tl.to(line, { strokeDashoffset: 0, ease: "none", duration: 0.2 }, DEPLOY_LINE_T[i]);
      });
      deployArrows.forEach((arrow, i) => {
        tl.fromTo(arrow, { opacity: 0 }, { opacity: 1, duration: 0.08 }, DEPLOY_ARROW_T[i]);
      });
      deployItems.forEach((item, i) => {
        tl.fromTo(
          item,
          { x: () => 20 * k(), autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: "power2.out", duration: i === 0 ? 0.18 : 0.14 },
          DEPLOY_ITEM_T[i],
        );
      });
      if (deployBar) {
        gsap.set(deployBar, { transformOrigin: "left center", scaleX: 0 });
        tl.fromTo(deployBar, { scaleX: 0 }, { scaleX: 1, ease: "power1.out", duration: 0.3 }, 8.18);
      }
      if (deployPercent) {
        const counter6 = { v: 0 };
        deployPercent.textContent = "0";
        tl.to(
          counter6,
          {
            v: DEPLOY6_PROGRESS,
            ease: "power1.out",
            duration: 0.3,
            onUpdate: () => {
              deployPercent.textContent = String(Math.round(counter6.v));
            },
          },
          8.18,
        );
      }
      tl.to({}, { duration: 0.3 }); // hold at the settled state 6

      // ---- state 6 → state 7 -------------------------------------------------------------
      tl.to(sixthText, { y: () => -40 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.25 }, 9.0);
      tl.to(deploy6, { autoAlpha: 0, ease: "power1.in", duration: 0.2 }, 9.0);
      tl.to([badge6, terminal6, pipe6Wrap], { autoAlpha: 0, ease: "power1.in", duration: 0.2 }, 9.0);
      // stop feeding the pipe once state 6 is left (resumes if we come back — reversible)
      tl.fromTo(flowGate6, { on: 1 }, { on: 0, duration: 0.01 }, 9.0);

      // the state-6 board shrinks and glides into place as this composition's right board
      // (same art as bottom-right-server.svg — no swap, the element itself travels)
      tl.to(
        board6,
        {
          x: () => BOARD6_TO7.dx * k(),
          y: () => BOARD6_TO7.dy * k(),
          scale: BOARD6_TO7.scale,
          transformOrigin: "0% 0%",
          ease: "power2.inOut",
          duration: 0.7,
        },
        9.05,
      );
      if (board6Glow) tl.to(board6Glow, { autoAlpha: 0, duration: 0.25 }, 9.05);

      blurTextIn(seventhText, 9.15, 11.1);
      tl.fromTo(
        agent7,
        { y: () => 60 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.5 },
        9.2,
      );
      tl.fromTo(
        bottom7,
        { y: () => 50 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.45 },
        9.45,
      );
      connectorLines.forEach((line, i) => {
        tl.to(line, { strokeDashoffset: 0, ease: "none", duration: 0.2 }, 9.75 + i * 0.15);
      });
      connectorArrows.forEach((arrow, i) => {
        tl.fromTo(arrow, { opacity: 0 }, { opacity: 1, duration: 0.08 }, 9.95 + i * 0.15);
      });
      tl.fromTo(
        badge7,
        { y: () => -16 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.2 },
        10.35,
      );
      // the badge's elbow draws from the badge DOWN to the board's top vertex (dash reveal)
      tl.to(badgeLine7, { strokeDashoffset: 0, ease: "none", duration: 0.2 }, 10.55);
      tl.fromTo(
        terminal7,
        { y: () => -40 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        10.75,
      );
      // ---- state 7's terminal types itself in, exactly like state 6's --------------------
      // Same reason for its own time-based timeline: typing needs real seconds, not the
      // crossing's compressed timeline units. A gate tween starts it once the window is in and
      // resets it when the playhead reverses past that point.
      const typeEls7 = Array.from(terminal7.querySelectorAll<HTMLElement>("[data-type7]"));
      const typeTexts7 = typeEls7.map((el) => el.dataset.type7 ?? "");
      const rows7 = Array.from(terminal7.querySelectorAll<HTMLElement>("[data-row7]"));
      const curs7 = Array.from(terminal7.querySelectorAll<HTMLElement>("[data-cur7]"));
      const dot7 = terminal7.querySelector<HTMLElement>("[data-dot7]");
      const reset7 = () => {
        typeEls7.forEach((el) => (el.textContent = ""));
        curs7.forEach((el) => el.classList.remove("t6-blink"));
      };
      reset7();
      const seq7 = gsap.timeline({ paused: true });
      {
        const ROW_T7 = [
          [0.05, 0.026],
          [1.05, 0.012],
          [1.7, 0.012],
        ] as const;
        rows7.forEach((row, r) => {
          const [start, perChar] = ROW_T7[r];
          let at = start;
          seq7.fromTo(row, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, at);
          const cur = curs7[r];
          if (cur) seq7.fromTo(cur, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, at);
          if (r === 1 && dot7) {
            seq7.fromTo(dot7, { scale: 0.3, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, ease: "back.out(2)", duration: 0.15 }, at);
            at += 0.1;
          }
          typeEls7.forEach((el, i) => {
            if (Number(el.dataset.typeRow7) !== r) return;
            const text = typeTexts7[i];
            const o = { n: 0 };
            const dur = text.length * perChar;
            seq7.to(
              o,
              {
                n: text.length,
                duration: dur,
                ease: "none",
                onUpdate: () => {
                  el.textContent = text.slice(0, Math.round(o.n));
                },
              },
              at,
            );
            at += dur;
          });
          // the finished rows drop their caret; the last one keeps a blinking block
          if (cur && r < rows7.length - 1) seq7.to(cur, { autoAlpha: 0, duration: 0.01 }, at);
          if (cur && r === rows7.length - 1) seq7.call(() => cur.classList.add("t6-blink"), undefined, at);
        });
      }
      // ---- state 7's ignition + power-up (approved demo: Claude outputs/section7-ignition-demo.html,
      // variant A "ტრიალი + ციმციმი", line colour emerald #22C55E) ------------------------------
      // Rides seq7 (real seconds from the moment the agent terminal starts typing):
      // (1) IGNITION at 0.45 — the main board "switches on": its ring spins up hard (CSS
      //     animation playbackRate 1 → 14 → back to 1), a cyan-white flash blooms on the processor,
      //     the asterisk and processor top glow, and the agent board's outline — WHITE until now —
      //     snaps to green with a short glow burst;
      // (2) because it is on, an emerald charge runs down both connectors (green + blurred glow
      //     copies over each gray line, dash-drawn) and their arrowheads turn emerald;
      // (3) as each charge lands, that small board's chips GROW in height (isometric extrusion,
      //     POWER7_GROW × 0.55-1.0, staggered, back.out) and ONLY their top faces turn green;
      // (4) the right↔bottom squiggle closes the loop.
      // Board svg layout (both small boards): chips are [left, right, top] path triples from
      // child 19; a side face is "M a b L c d V e L f g V h Z" — (a,b)(c,d) bottom edge, e/g the
      // top edge's y's — so growing = lifting e/g and translating the top face.
      const POWER7_GROW = 14;
      const POWER7_IGNITE = 0.15; // seq7 seconds — the terminal starts typing at 0.05
      const POWER7_ON = POWER7_IGNITE + 0.6; // the moment the charge leaves the main board
      const POWER7_LINE_D = 1.0;
      const POWER7_LINE_RGB = [34, 197, 94]; // #22C55E — emerald (must match the connector markup)
      const connectorGreens = Array.from(connectors7.querySelectorAll<SVGPathElement>("[data-connector-green]"));
      const connectorGlows = Array.from(connectors7.querySelectorAll<SVGPathElement>("[data-connector-glow]"));
      const mix7 = (a: string, b: string, t: number) => {
        const A = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
        const B = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
        return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
      };
      // -- the main board's ignition pieces (all inside the inline fullserver svg) --
      const agentRoot = agent7.querySelector("svg");
      const agentKids = agentRoot
        ? (Array.from(agentRoot.children).filter((el) => el.tagName !== "defs") as SVGGraphicsElement[])
        : [];
      const agentOutline = agentRoot?.querySelector<SVGPathElement>("[data-agent-outline]") ?? null;
      const procTop7 = agentKids.find((el) => el.getAttribute("fill") === "#18241B") ?? null;
      const asterisk7 = agentKids.filter((el) => {
        if (el.getAttribute("fill") !== "#11A32A") return false;
        const bb = el.getBBox();
        return bb.x > 240 && bb.x < 280 && bb.y > 105;
      });
      const ringSpin7 = agentRoot?.querySelector<SVGGElement>(".ring7-spin") ?? null;
      const ringRev7 = agentRoot?.querySelector<SVGGElement>(".ring7-spin-rev") ?? null;
      const SVGNS = "http://www.w3.org/2000/svg";
      let flash7: SVGEllipseElement | null = null;
      let ringBoost7: SVGCircleElement | null = null;
      if (agentRoot) {
        const defs = document.createElementNS(SVGNS, "defs");
        defs.innerHTML =
          '<filter id="agent7-blur" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="6"/></filter>' +
          '<filter id="agent7-blur2" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="1.6"/></filter>' +
          '<radialGradient id="agent7-flash"><stop offset="0" stop-color="#E9FFF3"/>' +
          '<stop offset=".35" stop-color="#38E1FF" stop-opacity=".7"/><stop offset="1" stop-color="#11A32A" stop-opacity="0"/></radialGradient>';
        agentRoot.prepend(defs);
        const fx = document.createElementNS(SVGNS, "g");
        fx.setAttribute("pointer-events", "none");
        flash7 = document.createElementNS(SVGNS, "ellipse");
        Object.entries({ cx: "260", cy: "124", rx: "70", ry: "40", fill: "url(#agent7-flash)", opacity: "0", filter: "url(#agent7-blur)" }).forEach(
          ([k2, v]) => flash7?.setAttribute(k2, v),
        );
        const iso = document.createElementNS(SVGNS, "g");
        iso.setAttribute("transform", "translate(259.81 137.2) scale(1 0.5774)");
        ringBoost7 = document.createElementNS(SVGNS, "circle");
        Object.entries({ r: "59.25", stroke: "#9FF7FF", "stroke-width": "2.5", fill: "none", opacity: "0", filter: "url(#agent7-blur2)" }).forEach(
          ([k2, v]) => ringBoost7?.setAttribute(k2, v),
        );
        iso.appendChild(ringBoost7);
        fx.append(flash7, iso);
        agentRoot.appendChild(fx);
      }
      const setRate7 = (r: number) => {
        ringSpin7?.getAnimations().forEach((an) => (an.playbackRate = r));
        ringRev7?.getAnimations().forEach((an) => (an.playbackRate = Math.max(1, r * 0.5)));
      };
      const glow7 = (v: number) => {
        asterisk7.forEach((el) => {
          el.style.filter = v > 0.01 ? `drop-shadow(0 0 ${2 + 6 * v}px rgba(120,255,170,${0.9 * v}))` : "";
          el.setAttribute("fill", mix7("#11A32A", "#B8FFD0", v * 0.8));
        });
        procTop7?.setAttribute("fill", mix7("#18241B", "#1F6B35", Math.min(1, v)));
      };
      const outline7 = (on: boolean) => {
        if (!agentOutline) return;
        agentOutline.setAttribute("stroke", on ? "#11A32A" : "#FFFFFF");
        agentOutline.setAttribute("stroke-opacity", on ? "0.8" : "0.3");
      };
      const outlineFlash7 = (v: number) => {
        if (agentOutline) agentOutline.style.filter = v > 0.01 ? `drop-shadow(0 0 ${5 * v}px rgba(30,209,72,${0.9 * v}))` : "";
      };
      // -- the small boards' chips --
      type Chip7 = { L: SVGPathElement; R: SVGPathElement; T: SVGPathElement; l: number[]; r: number[]; top: string };
      const chips7 = (host: Element | null): Chip7[] => {
        const svg = host?.querySelector("svg");
        if (!svg) return [];
        const kids = Array.from(svg.children).filter((el) => el.tagName !== "defs") as SVGPathElement[];
        // The ORIGINAL geometry/colour is cached on the element the first time we see it: this effect
        // can run more than once on the same DOM (React StrictMode / HMR), and a second run would
        // otherwise read an already-grown `d` or an already-tinted "rgb(…)" fill (the tint maths then
        // produced rgb(NaN,…) and the tops never turned green).
        const orig = (el: SVGElement, attr: "d" | "fill") => {
          const key = attr === "d" ? "origD" : "origFill";
          if (el.dataset[key] === undefined) el.dataset[key] = el.getAttribute(attr) ?? "";
          return el.dataset[key] ?? "";
        };
        const nums = (el: SVGPathElement) => (orig(el, "d").match(/-?[\d.]+/g) ?? []).map(Number);
        const out: (Chip7 & { y: number })[] = [];
        for (let i = 19; i + 2 < kids.length; i += 3) {
          const [L, R, T] = [kids[i], kids[i + 1], kids[i + 2]];
          const l = nums(L);
          const r = nums(R);
          if (l.length !== 8 || r.length !== 8) continue; // not a box — leave it alone
          out.push({ L, R, T, l, r, top: orig(T, "fill"), y: T.getBBox().y });
        }
        return out.sort((a, b) => a.y - b.y);
      };
      const side7 = (n: number[], h: number) =>
        `M${n[0]} ${n[1]}L${n[2]} ${n[3]}V${n[4] - h}L${n[5]} ${n[6] - h}V${n[7]}Z`;
      const setChip7 = (c: Chip7, h: number) => {
        c.L.setAttribute("d", side7(c.l, h));
        c.R.setAttribute("d", side7(c.r, h));
        c.T.setAttribute("transform", `translate(0 ${-h})`);
      };
      const boards7 = [
        chips7(board6.querySelector("[data-board7='right']")),
        chips7(bottom7.querySelector("[data-board7='bottom']")),
      ];
      const lineLen7 = (el: SVGPathElement) => el.getTotalLength() + 2;
      // Hiding a dashed path at EXACTLY its dash length puts the on→off boundary on the path's
      // first point, and these strokes have round caps — Chrome paints that zero-length dash as
      // a DOT. That was the green speck left over the state-7 squiggle, still visible on other
      // pages (the connector layer is only faded out from state 8 on). +1 pushes the boundary
      // into the gap, so nothing is painted at all.
      const lineHide7 = (el: SVGPathElement) => lineLen7(el) + 1;
      const resetPower7 = () => {
        [...connectorGreens, ...connectorGlows].forEach((el) => {
          el.style.strokeDasharray = `${lineLen7(el)} ${lineLen7(el)}`;
          el.style.strokeDashoffset = `${lineHide7(el)}`;
        });
        connectorArrows.forEach((a) => a.setAttribute("fill", "rgba(255,255,255,0.3)"));
        boards7.flat().forEach((c) => {
          setChip7(c, 0);
          if (c.top) c.T.setAttribute("fill", c.top);
          c.T.style.fill = "";
        });
        setRate7(1);
        glow7(0);
        outline7(false);
        outlineFlash7(0);
        flash7?.setAttribute("opacity", "0");
        ringBoost7?.setAttribute("opacity", "0");
      };
      resetPower7();
      {
        const proxy = (at: number, duration: number, ease: string, fn: (p: number) => void) => {
          const o = { p: 0 };
          seq7.fromTo(o, { p: 0 }, { p: 1, duration, ease, onUpdate: () => fn(o.p) }, at);
        };
        const t = POWER7_IGNITE;
        // (1) ignition: spin up hard, flash, outline snaps white → green, settle
        proxy(t, 0.35, "power3.in", (p) => setRate7(1 + 13 * p));
        proxy(t + 0.35, 1.2, "power3.out", (p) => setRate7(14 - 13 * p));
        proxy(t + 0.3, 0.18, "power3.out", (p) => {
          flash7?.setAttribute("opacity", String(p));
          ringBoost7?.setAttribute("opacity", String(p));
          glow7(p);
        });
        proxy(t + 0.48, 0.9, "power3.out", (p) => {
          flash7?.setAttribute("opacity", String(1 - p));
          ringBoost7?.setAttribute("opacity", String(1 - p));
          glow7(1 - p * 0.6);
        });
        seq7.call(() => outline7(true), undefined, t + 0.33);
        proxy(t + 0.33, 0.6, "power3.out", (p) => outlineFlash7(1 - p));
        // (2) the charge, (3) the chips
        [0, 1].forEach((k) => {
          const at = POWER7_ON + k * 0.12;
          [connectorGreens[k], connectorGlows[k]].forEach((el) => {
            if (!el) return;
            seq7.fromTo(el, { strokeDashoffset: lineHide7(el) }, { strokeDashoffset: 0, ease: "power2.inOut", duration: POWER7_LINE_D }, at);
          });
          const arrow = connectorArrows[k];
          if (arrow) {
            const [r, g, b] = POWER7_LINE_RGB;
            proxy(at + POWER7_LINE_D - 0.05, 0.25, "none", (p) =>
              arrow.setAttribute(
                "fill",
                `rgba(${Math.round(255 + (r - 255) * p)},${Math.round(255 + (g - 255) * p)},${Math.round(255 + (b - 255) * p)},${0.3 + 0.6 * p})`,
              ),
            );
          }
          const grow = at + POWER7_LINE_D + 0.15;
          boards7[k].forEach((c, i) => {
            const h = POWER7_GROW * (0.55 + (0.45 * ((i * 37) % 10)) / 10);
            proxy(grow + i * 0.06, 0.7, "back.out(1.5)", (p) => setChip7(c, h * p));
            if (c.top) proxy(grow + i * 0.06 + 0.1, 0.45, "power3.out", (p) => c.T.setAttribute("fill", mix7(c.top, "#1C7A36", p)));
          });
        });
        // (4) the squiggle
        // …charging TOGETHER with the chips' growth (team: "ერთდროულად") — the first board's grow
        // time, same 0.7s
        const sqAt = POWER7_ON + POWER7_LINE_D + 0.15;
        [connectorGreens[2], connectorGlows[2]].forEach((el) => {
          if (!el) return;
          seq7.fromTo(el, { strokeDashoffset: lineHide7(el) }, { strokeDashoffset: 0, ease: "power2.inOut", duration: 0.7 }, sqAt);
        });
      }
      let restoring7 = false; // set by the reload-restore below while it jumps the timeline
      // Leaving state 7 upwards used to snap everything back in one frame (team: "უცბად ქრება").
      // Now the power-up UNWINDS with animation, fast enough to finish inside the 7→6 crossing
      // while the boards are still on screen: the chips shrink back and lose their green, the
      // squiggle and then both charges retract toward the main board, the arrowheads fade back
      // to white, the leftover glow on the processor dies — then the silent reset. Whatever
      // state the sequence was in (even mid-charge) is taken as the starting point.
      const POWER7_UNWIND = 0.9; // real seconds — the 7→6 crossing is ~2.7s, boards fade ~60% in
      let unwind7: gsap.core.Timeline | null = null;
      const unwindPower7 = () => {
        seq7.pause();
        unwind7?.kill();
        // the ignition's transient light (flash, ring boost, outline burst, spin-up) goes out at
        // once — leaving mid-ignition used to freeze it lit, and a quick return found the board
        // glowing before its own ignition had even started
        flash7?.setAttribute("opacity", "0");
        ringBoost7?.setAttribute("opacity", "0");
        outlineFlash7(0);
        setRate7(1);
        const u = gsap.timeline({
          onComplete: () => {
            seq7.pause(0);
            reset7();
            resetPower7();
            unwind7 = null;
          },
        });
        const D = POWER7_UNWIND;
        // chips (both boards at once, slight stagger) — read each one's current height from its top
        boards7.flat().forEach((c, i) => {
          const m = /translate\(0 (-?[\d.]+)\)/.exec(c.T.getAttribute("transform") ?? "");
          const h0 = m ? -Number(m[1]) : 0;
          const o = { p: 0 };
          u.to(
            o,
            { p: 1, duration: D * 0.65, ease: "power1.inOut", onUpdate: () => setChip7(c, h0 * (1 - o.p)) },
            i * 0.012,
          );
          // the green top fades back to its grey (as a CSS fill so GSAP can blend rgb → hex;
          // resetPower7 clears the style again)
          if (c.top) u.to(c.T, { fill: c.top, duration: D * 0.55 }, i * 0.012);
        });
        // lines: the squiggle first, then both charges retract toward the main board
        const retract = (el: SVGPathElement | undefined, at: number, dur: number) => {
          if (!el) return;
          u.to(el, { strokeDashoffset: lineHide7(el), ease: "power2.in", duration: dur }, at);
        };
        retract(connectorGreens[2], 0, D * 0.4);
        retract(connectorGlows[2], 0, D * 0.4);
        [0, 1].forEach((k) => {
          retract(connectorGreens[k], D * 0.15, D * 0.75);
          retract(connectorGlows[k], D * 0.15, D * 0.75);
          const arrow = connectorArrows[k];
          if (arrow) u.to(arrow, { attr: { fill: "rgba(255,255,255,0.3)" }, duration: D * 0.3 }, D * 0.3);
        });
        const g = { v: 0.4 };
        u.to(g, { v: 0, duration: D * 0.5, onUpdate: () => glow7(g.v) }, 0);
        unwind7 = u;
      };
      // runs a still-running power-down backwards, then lets the sequence carry on from where it
      // was paused (the board stayed on screen, so it must not go dark and ignite a second time)
      const resume7 = () => {
        const u = unwind7;
        if (!u || u.reversed()) return;
        u.eventCallback("onReverseComplete", () => {
          if (unwind7 === u) unwind7 = null;
          seq7.play();
        });
        u.reverse();
      };
      let serverIntro: gsap.core.Timeline | null = null; // the hero server's load-in (see below)
      const GATE7_AT = 10.9; // timeline position where state 7's ignition starts
      const gate7 = { v: 0 };
      tl.fromTo(
        gate7,
        { v: 0 },
        {
          v: 1,
          duration: 0.01,
          onComplete: () => {
            // a reload that restores straight into state 7 lands on the FINISHED "on" state — the
            // spin-up / flash / charge are not replayed (team: "refresh-ის დროს არ უნდა გამოჩნდეს
            // ის ფერი რაც ჩართვის დროს აქვს"); a real arrival plays the whole sequence
            if (restoring7) {
              unwind7?.kill();
              unwind7 = null;
              seq7.progress(1, false);
              return;
            }
            // Came back before the board had gone dark: goToState already reversed the power-down
            // (resume7) — the sequence carries on from where it was, no second ignition.
            if (unwind7) resume7();
            if (unwind7 || seq7.progress() > 0) return;
            resetPower7();
            seq7.restart();
          },
          onReverseComplete: () => unwindPower7(),
        },
        GATE7_AT,
      );
      tl.to({}, { duration: 0.3 }); // hold at the settled state 7

      // ---- state 7 → state 8 -------------------------------------------------------------
      tl.to(seventhText, { y: () => -40 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.25 }, 11.45);
      tl.to([badge7, badgeLine7, terminal7, connectors7], { autoAlpha: 0, ease: "power1.in", duration: 0.2 }, 11.45);
      tl.to(agent7, { y: () => 50 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.3 }, 11.5);
      tl.to(bottom7, { y: () => 40 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.3 }, 11.5);
      tl.to(board6, { autoAlpha: 0, ease: "power1.in", duration: 0.25 }, 11.5);

      // the scene light comes up first and does NOT ride the item stagger (it is background,
      // and keeping it out of pricingItems also keeps the last item inside the 12.6 snap)
      if (pricingGlow) {
        tl.fromTo(pricingGlow, { autoAlpha: 0 }, { autoAlpha: 1, ease: "power2.out", duration: 0.5 }, 11.75);
      }
      pricingItems.forEach((item, i) => {
        const at = 11.85 + i * 0.1;
        // 0 = headline, 1 = paragraph: same blur stagger as every other left column
        if (i < 2) blurItemIn(item, at, i === 0 ? 1 : 2);
        else
          tl.fromTo(
            item,
            { y: () => 50 * k(), autoAlpha: 0 },
            { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.4 },
            at,
          );
      });
      tl.to({}, { duration: 0.3 }); // hold at the settled state 8

      // ---- state 8 → state 9 -------------------------------------------------------------
      tl.to(pricing8, { autoAlpha: 0, ease: "power1.in", duration: 0.25 }, 12.9);
      blurTextIn(final9, 13.2, 13.75);
      tl.to({}, { duration: 0.35 }); // hold at the settled state 9 before the pin releases

      // one timeline position per SETTLED state (mid-hold times — see each state's hold above);
      // these are the fullpage "pages" the wheel driver steps between
      const SNAP_TIMES = [0, 1.1, 2.3, 4.25, 5.95, 8.8, 11.2, 12.6, tl.totalDuration()];

      // --- fullpage transition engine ------------------------------------------------------
      // The pin only holds the stage in place; state changes play the timeline TIME-BASED via
      // tweenTo (slow + eased, per explicit request), never scrubbed by the wheel. The window
      // scroll is tweened alongside purely so the pin/footer handoff geometry stays truthful —
      // the pinned stage doesn't visually move with it.
      const total = tl.totalDuration();
      const TRANSITION_SECONDS = 1.7;
      const LAST = SNAP_TIMES.length - 1;
      const FOOTER_INDEX = LAST + 1; // the footer is one more fullpage "page" past state 9
      const STATE_KEY = "usectl:state"; // session-scoped, so a reload reopens on the same page
      let stateIndex = 0;
      let transitionFrom = 0;
      let transitioning = false;
      let flightStartedAt = 0;
      // Every flight gets an id so its unlock timer can't clear a LATER flight's lock. Without
      // this, a redirect that lands just after the previous leg finished (very likely now that
      // chained pushes shorten each leg) inherited a 60ms stale timer, `transitioning` went
      // false mid-flight, and the next momentum event fell through to the "new push" branch —
      // which is what produced the occasional extra state and the twitch at the range edges.
      let flightId = 0;
      let pinST: ScrollTrigger | null = null;

      // --- dead-zone index -----------------------------------------------------------------
      // Every state parks in a HOLD: its content ends before the snap time, and the next
      // segment's tweens start after it (measured gaps, in timeline units: 0.05 / 0.10 / 0.04 /
      // 0.20 / 0.15 / 0.20 / 0.25 / 0.30 going down). Traversed at the same speed as the rest of
      // the crossing, that empty stretch is up to ~20% of the transition spent rendering NOTHING
      // — the reported "თითქოს delay-ით იწყება". Nothing animates there, so the flight simply
      // SEEKS across it before tweening: motion now starts on the very first frame, both ways.
      const contentSpans = tl
        .getChildren(false)
        .filter((c) => {
          if (c.duration() <= 0.02) return false;
          // the `tl.to({}, {duration})` holds carry no animated properties
          return Object.keys(c.vars).some((k) => k !== "duration" && k !== "ease");
        })
        .map((c) => ({ start: c.startTime(), end: c.startTime() + c.duration() }));
      const nextContentStart = (t: number) => {
        let best = Infinity;
        for (const sp of contentSpans) if (sp.start > t + 0.001 && sp.start < best) best = sp.start;
        return best;
      };
      const prevContentEnd = (t: number) => {
        let best = -Infinity;
        for (const sp of contentSpans) if (sp.end < t - 0.001 && sp.end > best) best = sp.end;
        return best;
      };
      const skipDeadZone = (to: number) => {
        const from = tl.time();
        if (to > from) {
          const edge = nextContentStart(from);
          if (edge < to && edge - from > 0.03) tl.time(edge);
        } else if (to < from) {
          const edge = prevContentEnd(from);
          if (edge > to && from - edge > 0.03) tl.time(edge);
        }
      };

      // Per-crossing traversal tuning (also used by the nav jump's entrance replay).
      const CROSSING_SECONDS: Record<number, number> = {
        0: 2.2, // hero-server center glide
        1: 2.1, // mids dissolve + stack docking + greening
        2: 3.3, // the Machine's arrival + full unfold (user asked for a calmer unfold)
        3: 2.8, // pods stack rise + callout wiring
        4: 3.2, // deploy board + terminal/push-line/cards pipeline (densest segment)
        5: 2.7, // board morph into the AI composition
        6: 2.0, // pricing reveal
        7: 2.0, // closing CTA
      };
      const goToState = (i: number, hurry = 1) => {
        if (!pinST) return;
        // a push during the hero server's load-in lands it at once (clean props for the glide)
        if (serverIntro?.isActive()) serverIntro.progress(1);
        // Arriving at state 7 from above its gate: the board must come in OFF (white outline, no
        // glow, flat chips) and only light up when the gate starts the ignition. Whatever an
        // earlier visit left behind — a finished "on" state, an unwind still running, a frozen
        // mid-ignition frame — is cleared before the board fades in (user: "ჯერ ნათება მხვდება,
        // მერე ქრება და მერე ისევ ჩნდება").
        // An unwind still running means the board never left the screen: run it backwards right
        // away instead (resume7), so a quick up-and-back never goes dark and re-ignites.
        if (tl.time() < GATE7_AT && SNAP_TIMES[Math.min(i, LAST)] > GATE7_AT) {
          if (unwind7) resume7();
          else {
            seq7.pause(0);
            reset7();
            resetPower7();
          }
        }
        flightStartedAt = performance.now();
        // Per-crossing traversal tuning: every state change gets real time proportional to how
        // much its segment actually animates, with the gentle power1.out (the default power2.out
        // compresses everything positioned early in a segment into its fast first ~20% — the
        // recurring "ძალიან სწრაფად" complaint). Keyed by the LOWER index of an adjacent
        // crossing; non-adjacent jumps (quantizer catch-ups) and the footer hop use the default.
        // Cut ~25% off the original crossings (user: "უფრო მალე ქნა, მაგრამ ლამაზად", then
        // "ოდნავ შეანელე" — these are the first values ×1.22). The relative weighting is kept,
        // so the busy segments still get the most time, and with the dead zones now skipped the
        // SEEN motion is barely shorter than the original, much slower timing.
        // Another ~15% back on everything ("ოდნავ შეანელე ზოგადად"), and crossing 4 gets more
        // than that: it is by far the densest segment (2.68 timeline units of content vs ~1.5
        // elsewhere), so at the shared pace it read as a jump — "section-5-დან section-6-მდე
        // უცბად გადადის". At 3.2s it runs at roughly the same units-per-second as its neighbours.
        const lo = Math.min(stateIndex, i);
        const tuned = Math.abs(stateIndex - i) === 1 ? CROSSING_SECONDS[lo] : undefined;
        // `hurry` < 1 comes from chained pushes: each extra shove while a flight is running makes
        // the next leg shorter, so skimming several sections in a row accelerates instead of
        // queueing, while a single unhurried scroll keeps the full, calm timing.
        // footer → state 9 is a plain ~800px scroll glide with no artwork to play, and at the
        // shared 1.7s power2.out its last ~0.4s crawled over the final few px while input stayed
        // locked — the reported "footer-დან ზევით ასვლას ძალიან დიდი ხანი უნდება, ჭედავს"
        // Same for the way DOWN (state 9 → footer): it used the shared 1.7s too and read as a slow
        // crawl ("ძალიან ნელა ჩამოდის footer-ზე") — both footer hops now share one short glide.
        const FOOTER_HOP_SECONDS = 0.95;
        const footerHop = (stateIndex > LAST) !== (i > LAST);
        const duration = (footerHop ? FOOTER_HOP_SECONDS : (tuned ?? TRANSITION_SECONDS)) * hurry;
        const ease = tuned ? "power1.out" : "power2.out";
        skipDeadZone(SNAP_TIMES[i]);
        transitioning = true;
        try {
          sessionStorage.setItem(STATE_KEY, String(i));
        } catch {
          /* private mode — the restore is a nicety, never a hard dependency */
        }
        const myFlight = ++flightId;
        transitionFrom = stateIndex;
        stateIndex = i;
        // power2.out, NOT inOut: inOut's gentle first ~300ms read as "the animation hasn't
        // started yet" (user feedback) — out shows motion on the very first frame and still
        // lands softly over the full duration
        gsap.to(window, {
          // the footer is page LAST+1: the timeline stays parked at its end and only the scroll
          // travels, so the footer arrives as one glide instead of a native crawl
          scrollTo: i > LAST ? "max" : pinST.start + (SNAP_TIMES[i] / total) * PIN_SCROLL_DISTANCE,
          duration,
          ease,
          overwrite: true,
          onComplete: () => {
            window.setTimeout(() => {
              if (flightId === myFlight) transitioning = false;
            }, 60);
          },
        });
        tl.tweenTo(SNAP_TIMES[Math.min(i, LAST)], {
          duration,
          ease,
          overwrite: true,
        });
      };

      // Header navigation lands DIRECTLY on its page (user: "ყველა გვერდი კი არ ჩაიაროს, არამედ
      // პირდაპირ ის გვერდი გამოიტანოს… ოღონდ მხოლოდ მაშინ, როცა ნავიგაციიდან დააჭერ"). A scroll
      // gesture still glides through the crossings — only this path cuts. The timeline is SEEKED,
      // not tweened, so none of the in-between artwork plays; events are left ON during the seek
      // so the state-6/7 gates (terminal typing, board ignition) still fire for the page we land
      // on, and the stage fades back in over 0.3s so the cut doesn't pop.
      // where each page's OWN entrance begins — i.e. the first tween that brings its artwork in,
      // after the previous page's exits. A nav jump seeks here and plays forward to the snap, so
      // the page arrives animating instead of already finished (user: "the machine… svg უკვე
      // ანიმირებულია, დასრულებული ანიმაციით შემოდის"). State 0's load-in isn't on the timeline —
      // it is replayed directly (playHeroText / playServerIntro).
      const ENTER_TIMES = [0, 0.05, 1.28, 2.6, 4.8, 6.45, 9.05, 11.75, 13.2];
      const jumpToState = (i: number) => {
        if (!pinST) return;
        const target = Math.min(Math.max(0, Math.round(i)), LAST);
        gsap.killTweensOf(window);
        gsap.killTweensOf(tl);
        serverIntro?.kill();
        serverIntro = null;
        transitioning = true;
        flightStartedAt = performance.now();
        // a jump ends any chained-push acceleration and any half-finished gesture bookkeeping
        chain = 0;
        flickFresh = false;
        gestureFiredFlight = true;
        const myFlight = ++flightId;
        // A jump is a LANDING, not a flight you can turn around from: `transitionFrom` is the
        // page we just landed on. Left as the previous state, an up-push during the entrance read
        // as "turn around" and went back to where we came from (a flick after navigating out of
        // the footer went straight back down to it).
        transitionFrom = target;
        stateIndex = target;
        try {
          sessionStorage.setItem(STATE_KEY, String(target));
        } catch {
          /* private mode */
        }
        // land on the page first (scroll + the start of its entrance), then play it in
        const enter = Math.min(ENTER_TIMES[target] ?? SNAP_TIMES[target], SNAP_TIMES[target]);
        tl.time(enter);
        // same state-7 housekeeping as a glide: arrive with the board OFF, ready to ignite
        if (enter < GATE7_AT && SNAP_TIMES[target] > GATE7_AT) {
          if (unwind7) resume7();
          else {
            seq7.pause(0);
            reset7();
            resetPower7();
          }
        }
        window.scrollTo(0, pinST.start + (SNAP_TIMES[target] / total) * PIN_SCROLL_DISTANCE);
        if (stageRef.current) {
          gsap.fromTo(stageRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
        }
        const span = SNAP_TIMES[target] - enter;
        // the entrance plays at the same pace a scrolled crossing would give it
        const full = SNAP_TIMES[target] - (target > 0 ? SNAP_TIMES[target - 1] : 0);
        const seconds =
          span <= 0.001
            ? 0
            : Math.max(0.6, ((CROSSING_SECONDS[target - 1] ?? TRANSITION_SECONDS) * span) / (full || span));
        if (seconds > 0) tl.tweenTo(SNAP_TIMES[target], { duration: seconds, ease: "power1.out", overwrite: true });
        if (target === 0) {
          // the hero introduces itself again — its load-in never lived on the timeline
          playHeroText(0.6);
          playServerIntro(0.15);
        }
        // the lock only has to outlive the click's own momentum — a wheel push during the
        // entrance should be able to interrupt it (goToState retargets from the live playhead)
        window.setTimeout(() => {
          if (flightId === myFlight) transitioning = false;
        }, 350);
      };

      pinST = ScrollTrigger.create({
        trigger: section,
        // The section's top always sits exactly HEADER_HEIGHT_PX below the viewport top, so the
        // pin is active from the very first scrolled pixel.
        start: () => `top ${HEADER_HEIGHT_PX}px`,
        end: `+=${PIN_SCROLL_DISTANCE}`,
        pin: true,
        // Explicit on purpose: <main> is display:flex, which silently disables GSAP's automatic
        // pin spacing (documented in PROJECT.md — bit this project before).
        pinSpacing: true,
        invalidateOnRefresh: true,
        // Fallback for scroll the wheel handler can't capture (scrollbar drag, keyboard,
        // touch): whenever the raw scroll position parks nearest a DIFFERENT state, play a
        // normal transition to it. Our own scrollTo tween is guarded out via `transitioning`.
        onUpdate: (self) => {
          if (transitioning) return;
          // parked on the footer page: progress is pinned at 1, so any quantising here would
          // immediately drag us back to state 9. Only re-adopt state 9 if the user has actually
          // scrolled back inside the pin (scrollbar drag / keyboard).
          if (stateIndex > LAST) {
            if (self.progress > 0.999) return;
            stateIndex = LAST;
          }
          // scrollbar drag / keyboard that lands PAST the pin is a move to the footer page, not
          // something to quantise back to state 9
          if (self.progress > 0.999 && pinST && window.scrollY > pinST.end + 5) {
            stateIndex = FOOTER_INDEX;
            return;
          }
          const t = self.progress * total;
          let nearest = 0;
          SNAP_TIMES.forEach((snapT, i) => {
            if (Math.abs(snapT - t) < Math.abs(SNAP_TIMES[nearest] - t)) nearest = i;
          });
          if (nearest !== stateIndex) goToState(nearest);
        },
      });

      // --- restore the page the user was on across a reload ---------------------------------
      // The browser puts the scroll position back, but the timeline always started at 0, so a
      // refresh mid-journey showed state 1's artwork at state 6's scroll offset until the next
      // wheel event quantised it (user: "refresh რომ გავაკეთებ, რომელ გვერდზეც ვდგავარ, იმ
      // გვერდზევე უნდა გამაჩინოს"). Two rAFs: scroll restoration and ScrollTrigger's own first
      // refresh both land before them, and the SSR spacer above has been collapsed by then.
      // Reading window.scrollY here is unreliable — the browser's own restoration can land
      // before OR after this effect, and when it lost the race the page snapped back to state 1.
      // The state index is saved on every transition instead and replayed verbatim.
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
      let saved = 0;
      try {
        saved = Number(sessionStorage.getItem(STATE_KEY)) || 0;
      } catch {
        saved = 0;
      }
      // an explicit deep link (usectl.dev/#pricing) wins over the restored session state
      const deepLink = NAV_STATE_BY_HASH[window.location.hash];
      if (deepLink !== undefined) saved = Math.min(Math.max(0, deepLink), LAST);
      if (saved > 0) {
        // The pin's spacer only exists after ScrollTrigger's first refresh, so for the first few
        // frames the document is too short and a scrollTo would be CLAMPED — which is what the
        // first attempt did: it landed short, the quantiser saw a mismatch and animated back to
        // state 1. So wait (up to ~30 frames) until the page is actually tall enough, and hold
        // `transitioning` across the jump so the quantiser stays out of it.
        transitioning = true;
        const restore = (tries: number) => {
          if (!pinST) return;
          const i = Math.min(Math.max(0, Math.round(saved)), FOOTER_INDEX);
          const targetY =
            i > LAST
              ? document.documentElement.scrollHeight
              : pinST.start + (SNAP_TIMES[i] / total) * PIN_SCROLL_DISTANCE;
          const maxY = document.documentElement.scrollHeight - window.innerHeight;
          if (maxY < targetY - 2 && tries < 30) {
            requestAnimationFrame(() => restore(tries + 1));
            return;
          }
          stateIndex = i;
          restoring7 = true;
          tl.time(SNAP_TIMES[Math.min(i, LAST)]);
          restoring7 = false;
          window.scrollTo(0, targetY);
          window.setTimeout(() => {
            transitioning = false;
          }, 120);
        };
        requestAnimationFrame(() => restore(0));
      }

      // --- idle float on states 2 and 5 ------------------------------------------------------
      // Per-element CSS `translate` (not `transform`): it composes with the transforms GSAP writes
      // for the 2→3 drift / fades, so the two never fight. The float only runs while parked on
      // its state — `floatAmp` eases to 1 there and back to 0 the moment a transition starts —
      // and the callout / pod elbows are rebuilt every frame from their layer's offset: the start
      // stays glued to the slab's side, label + arrowhead never move, only the elbow's vertical
      // run stretches a few px. Each rebuilt path gets its dasharray re-measured so the dash-draw
      // reveal can't clip its tail; the rest pose is restored exactly when the amp reaches 0.
      const float2Layers: SVGGraphicsElement[][] = [[], [], [], []]; // cap, upper, lower, base
      Array.from(serverRoot.children)
        .filter((el) => el.tagName !== "defs")
        .forEach((el, i) => {
          const g = el as SVGGraphicsElement;
          if (i >= SERVER_CAP_RANGE[0] && i <= SERVER_CAP_RANGE[1]) float2Layers[0].push(g);
          else if (i <= SERVER_BASE_BODY_MAX) float2Layers[3].push(g);
          else if (i < SERVER_UPPER_SLAB_MIN) float2Layers[2].push(g);
          else if (i <= SERVER_SLABS_MAX) float2Layers[1].push(g);
          else {
            const y = g.getBBox().y;
            float2Layers[y >= SERVER_BASE_CHIP_MIN_Y ? 3 : y >= SERVER_LOWER_CHIP_MIN_Y ? 2 : 1].push(g);
          }
        });
      const float5Layers: SVGGraphicsElement[][] = [[], [], []]; // top, middle, bottom
      const podsRoot = server5.querySelector("svg");
      if (podsRoot) {
        Array.from(podsRoot.children)
          .filter((el) => el.tagName !== "defs")
          .forEach((el, i) => {
            float5Layers[PODS_SLAB_STARTS.findIndex((start) => i >= start)].push(el as SVGGraphicsElement);
          });
      }
      type FloatLine = { el: SVGPathElement; layer: number; path: (dy: number) => string; restLen: number };
      const floatLine = (el: SVGPathElement | undefined, layer: number, path: (dy: number) => string) =>
        el ? [{ el, layer, path, restLen: el.getTotalLength() }] : [];
      // callout i hangs off layer i+1 (upper slab, lower slab, base); the cap has no callout
      const float2Lines: FloatLine[] = CALLOUT_LINES_PTS.flatMap(([x0, y0, x1, y1], i) =>
        floatLine(lines[i], i + 1, (dy) => calloutElbow(x0, y0 + dy, x1, y1)),
      );
      const float5Lines: FloatLine[] = PODS.flatMap((pod, i) =>
        floatLine(podLines[i], i, (dy) => podElbow(POD_LABEL_X - 12, pod.y + 10, pod.y + 55 + dy)),
      );
      const makeFloat = (
        state: number,
        layers: SVGGraphicsElement[][],
        flines: FloatLine[],
        unitsPerPx: number,
        layerGain: (i: number) => number,
      ) => {
        let amp = 0;
        let live = false;
        return (t: number, dt: number) => {
          const target = stateIndex === state && !transitioning ? 1 : 0;
          amp += (target - amp) * Math.min(1, dt * (target ? 1.6 : 6));
          if (amp < 0.002 && target === 0) {
            if (!live) return;
            live = false;
            amp = 0;
            layers.forEach((els) => els.forEach((el) => (el.style.translate = "")));
            flines.forEach((l) => {
              l.el.setAttribute("d", l.path(0));
              l.el.style.strokeDasharray = `${l.restLen}`;
            });
            return;
          }
          live = true;
          const dy = layers.map((_, i) => floatOffset(i, t) * layerGain(i) * amp);
          layers.forEach((els, i) => {
            const v = `0px ${(dy[i] * unitsPerPx).toFixed(2)}px`;
            els.forEach((el) => (el.style.translate = v));
          });
          flines.forEach((l) => {
            l.el.setAttribute("d", l.path(+dy[l.layer].toFixed(2)));
            l.el.style.strokeDasharray = `${l.el.getTotalLength()}`;
          });
        };
      };
      // state 2's svg units ARE design px there (421-unit viewBox rendered 421 wide); the cap
      // floats a touch more than the slabs, as in the demo
      const float2 = makeFloat(1, float2Layers, float2Lines, 1, (i) => (i === 0 ? 1.15 : 1));
      const float5 = makeFloat(4, float5Layers, float5Lines, PODS_SVG_UNITS_PER_PX, () => 1);
      const tickFloat = (time: number, deltaMs: number) => {
        const dt = Math.min(0.1, deltaMs / 1000);
        float2(time, dt);
        float5(time, dt);
      };
      gsap.ticker.add(tickFloat);

      // Wheel: while inside the pin, every event is captured and one PUSH = one state. A push is
      // recognized on its very first meaningful event — no waiting for the gesture to end (user
      // report: "ანიმაცია scroll-ის მერე იწყება"; the old quiet-gap-only rule classified a new
      // swipe as momentum whenever the previous swipe's tail was still emitting). A new push =
      // a 250ms quiet gap, OR a direction flip, OR a magnitude SPIKE (momentum tails only ever
      // decay; a fresh finger-push jumps). At the last state a down gesture is NOT captured
      // (native scroll releases into the footer); coming back up re-captures automatically.
      let lastWheelAt = 0;
      let lastDelta = 0;
      // "flick" tracking for the queue: a run of events that began after a real pause; its
      // accumulated distance tells a deliberate second scroll apart from a single swipe's tail
      let flickFresh = false;
      let flickAccum = 0;
      let flickStartAbs = 0; // the delta level right before the pause that started the flick
      // gesture identity + decaying speed peak: an unbroken event stream is ONE gesture; the
      // gesture that fired the current flight can only redirect it by RE-ACCELERATING past its
      // own decaying peak (momentum only ever decays — a fresh finger push spikes above it)
      let gestureFiredFlight = false;
      let recentMax = 0;
      // consecutive pushes that landed while a flight was running — each one shortens the next
      // leg (see `hurry` in goToState). Reset by any real idle gap.
      let chain = 0;
      const hurryNow = () => Math.max(0.4, Math.pow(0.62, chain));
      const onWheel = (e: WheelEvent) => {
        if (!pinST) return;
        // scroll-position check, NOT isActive — isActive stays false at load until the first
        // scroll event, which let the very first gesture fall through to native scrolling.
        const sc = window.scrollY;
        if (sc < pinST.start - 1) {
          lastWheelAt = 0;
          lastDelta = 0;
          return;
        }
        const now = performance.now();
        const gap = now - lastWheelAt;
        lastWheelAt = now;
        const prevAbs = Math.abs(lastDelta);
        const delta = e.deltaY;
        const flipped = delta * lastDelta < 0;
        lastDelta = delta;
        const dir = delta > 0 ? 1 : -1;
        const absD = Math.abs(delta);
        if (gap > 150) {
          flickFresh = true;
          flickAccum = 0;
          flickStartAbs = prevAbs;
          gestureFiredFlight = false; // a pause ends the gesture
        }
        if (gap > 400) chain = 0; // idle → back to the unhurried, full-length timing
        flickAccum += absD;
        const decayedMax = recentMax * Math.pow(0.5, gap / 300);
        recentMax = Math.max(absD, decayedMax);
        // the flip shortcut needs real force (≥5): trackpad tails shed 1-3px reversed jitter
        // deltas (must stay ignored), but ≥8 also swallowed GENTLE deliberate reversals — the
        // reported "ზემოთ ხან delay-ით ადის, ხან 2-ჯერ სჭირდება" was exactly that
        // Deliberately SYMMETRIC and more sensitive than before: up-swipes are physically
        // gentler than down-swipes, so the old "gap > 250 || spike" rule fired readily going
        // down but made going up feel late / need a second shove. A 150ms gap with any real
        // delta now counts, as does a modest spike.
        const newPush =
          absD >= 2 &&
          (gap > 300 || (gap > 150 && absD >= 4) || (flipped && absD >= 5) || absD > prevAbs * 1.35 + 2);
        // the footer zone is a HYBRID (user feedback): DOWN stays fully native ("fullpage
        // გათიშე, პირდაპირ ჩავიდე"), but a DELIBERATE up push glides back to the last state.
        // +5 tolerance: state 9 parks EXACTLY on the pin end, and without the slack its own
        // up-pushes classified as "footer" and looped back to state 9 forever.
        // ---- the footer is page LAST+1 ------------------------------------------------
        // It used to be a NATIVE descent, which meant ~320px per flick (three or four flicks to
        // see it) and, worse, every event was swallowed while the return-glide ran — so a quick
        // "down" right after going up did nothing at all ("ზემოთ ავდივარ, მერე უცბად ქვემოთ
        // ვაკეთებ, აღარ ჩადის"). Now it behaves like every other page: one glide down, one glide
        // back up, and a push AGAINST a running glide turns it around immediately.
        // Only while ON (or flying TO) the footer. Once the return glide to state 9 has started
        // it is an ordinary flight and falls through to the in-pin branch below, so a second up
        // push redirects straight on to state 8 instead of being swallowed until the glide ends
        // (it used to be ignored for the whole 1.7s — the other half of the "ჭედავს" report).
        if (stateIndex > LAST || (!transitioning && sc > pinST.end + 5)) {
          e.preventDefault();
          if (transitioning) {
            const goingToFooter = stateIndex > LAST;
            if (newPush && ((goingToFooter && dir < 0) || (!goingToFooter && dir > 0))) {
              chain++;
              flickFresh = false;
              gestureFiredFlight = true;
              goToState(goingToFooter ? LAST : FOOTER_INDEX, hurryNow());
            }
            return;
          }
          // a deliberate push either way; tiny reversed jitter deltas from a dying gesture are
          // still ignored (they used to yank the page around mid-descent)
          if (absD < 6) return;
          // this gesture owns the flight it starts: its own momentum tail must not count as a
          // second push once the return glide is handled by the in-pin redirect logic
          flickFresh = false;
          gestureFiredFlight = true;
          if (dir < 0) goToState(LAST);
          else if (stateIndex <= LAST) goToState(FOOTER_INDEX);
          return;
        }
        if (transitioning) {
          // mid-flight: swallow everything, EXCEPT a deliberate push AGAINST the flight
          // direction — that turns the transition around immediately (user: scrolling up then
          // down again used to wait out the whole transition before responding).
          // When the flight is a SAME-STATE glide (the footer return is goToState(9→9)),
          // "turning around" must step PAST it — going back to transitionFrom re-glided to 9
          // forever and the user couldn't climb out of state 9 after visiting the footer.
          e.preventDefault();
          const flightDir = stateIndex >= transitionFrom ? 1 : -1;
          if (newPush && dir !== flightDir) {
            const back =
              transitionFrom !== stateIndex
                ? transitionFrom
                : Math.min(LAST, Math.max(0, stateIndex + dir));
            flickFresh = false;
            gestureFiredFlight = true;
            chain++;
            goToState(back, hurryNow());
          } else if (dir === flightDir) {
            // a second push mid-flight REDIRECTS the motion to the next state IMMEDIATELY
            // (user testing: people skim fast and won't wait for animations) — tweenTo
            // retargets from the current playhead, so it stays one smooth motion. Two ways
            // to qualify:
            // (a) a NEW gesture (a >180ms pause occurred) that accumulated real distance and
            //     exceeds the pre-pause delta level (a tail resuming after an event hiccup
            //     keeps decaying and can't exceed it);
            // (b) the SAME gesture RE-ACCELERATING past its own decaying peak ≥550ms into
            //     the flight — covers a second finger-push landing inside still-running
            //     momentum, where no pause ever appears in the event stream.
            // `absD >= prevAbs` is the important half: a real finger push RAMPS UP, a momentum
            // tail only ever decays. Without it, an event-stream hiccup late in a tail (gap
            // >150ms, then a few small deltas) looked like a fresh flick and stole an extra
            // state — which is exactly what a double-step on the way up looked like.
            const freshFlick =
              !gestureFiredFlight &&
              flickFresh &&
              flickAccum >= 8 &&
              absD >= 4 &&
              absD >= prevAbs &&
              (flickStartAbs < 5 || absD > flickStartAbs);
            const reaccel =
              gestureFiredFlight &&
              performance.now() - flightStartedAt > 260 &&
              absD > decayedMax * 1.18 + 3;
            if (freshFlick || reaccel) {
              flickFresh = false;
              gestureFiredFlight = true;
              chain++;
              const next = stateIndex + dir;
              // up to FOOTER_INDEX: a second down push during 8 → 9 goes straight on to the footer
              // (it used to be dropped, so the footer could only be reached after the whole 8 → 9
              // animation had finished — "სწრაფად მეორე scroll-ზე დაბლა არ ჩამიშვებს")
              if (next >= 0 && next <= FOOTER_INDEX) goToState(next, hurryNow());
            }
          }
          return;
        }
        const target = stateIndex + dir;
        if (target < 0) return; // above the hero — native
        e.preventDefault();
        if (newPush) {
          flickFresh = false; // firing consumes the flick
          gestureFiredFlight = true; // this gesture owns the flight it just started
          goToState(Math.min(target, FOOTER_INDEX));
        }
      };
      window.addEventListener("wheel", onWheel, { passive: false });

      // --- header navigation ------------------------------------------------------------
      // The header's links are plain hashes and there is no element with those ids on desktop
      // (the mobile sections carry them, and they are display:none here), so the jump is ours:
      // map the hash to a page and glide to it. Clicks are INTERCEPTED rather than only
      // listening for `hashchange`, so clicking the same item twice still works, and the hash is
      // written with replaceState so the back button isn't filled with in-page steps.
      const goToHash = (hash: string) => {
        const i = NAV_STATE_BY_HASH[hash];
        if (i === undefined) return false;
        jumpToState(i);
        return true;
      };
      // CAPTURE phase on purpose: next/link's own click handler runs first otherwise, calls
      // preventDefault for the hash navigation, and a `defaultPrevented` guard here then skipped
      // every nav click (the hash changed, the page didn't move).
      const onNavClick = (e: MouseEvent) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
        if (!anchor) return;
        const href = anchor.getAttribute("href") ?? "";
        if (href.startsWith("#")) {
          if (goToHash(href)) {
            e.preventDefault();
            history.replaceState(null, "", href);
          }
          return;
        }
        // the logo (header and footer both link to "/"): bring the hero back the same way a nav
        // item brings its page back — land on it and let it introduce itself, rather than racing
        // the scroll to the top (user: "ზემოთ სწრაფად კი არ ამიყვანოს, ეგრევე section-hero
        // შემოვიდეს")
        const url = new URL(anchor.href, window.location.href);
        if (url.origin === window.location.origin && url.pathname === window.location.pathname && !url.hash) {
          e.preventDefault();
          history.replaceState(null, "", url.pathname);
          jumpToState(0);
        }
      };
      const onHashChange = () => {
        goToHash(window.location.hash);
      };
      document.addEventListener("click", onNavClick, true);
      window.addEventListener("hashchange", onHashChange);
      // (a deep link is applied by the restore block above — it shares the same code path)

      // resize: re-evaluate the timeline's function-based (scale-dependent) values and re-render
      // the parked state with them — the old scrub's invalidateOnRefresh used to cover this
      const onRefresh = () => {
        tl.invalidate();
        tl.seek(tl.time(), false);
      };
      ScrollTrigger.addEventListener("refresh", onRefresh);

      // State 1's column is visible at t=0, so its blur-in can't live on the pinned timeline —
      // it plays in real seconds, right after mount. It is a FUNCTION because the logo replays
      // it: clicking the logo lands on the hero and the page introduces itself again, instead of
      // arriving finished (user: "ზემოთ სწრაფად კი არ ამიყვანოს, ეგრევე section-hero შემოვიდეს").
      const HERO_STAGGER = [0.03, 0.06, 0.012];
      const HERO_DELAY = [0.15, 0.3, 0.5, 0.75];
      // split once — replays reuse the same word spans
      const heroFields = Array.from(heroText.children).map((node) => {
        const field = node as HTMLElement;
        const whole = field.hasAttribute("data-blur-block") || !!field.querySelector("a,button");
        return {
          whole,
          targets: whole
            ? [field]
            : [...Array.from(field.querySelectorAll<HTMLElement>("img")), ...splitWords(field)],
        };
      });
      const playHeroText = (delayScale = 1) => {
        gsap.set(heroText, { opacity: 1 });
        heroFields.forEach(({ whole, targets }, i) => {
          gsap.fromTo(
            targets,
            { opacity: 0, y: 14, ...(whole ? {} : { filter: "blur(12px)" }) },
            {
              opacity: 1,
              y: 0,
              ...(whole ? {} : { filter: "blur(0px)" }),
              duration: 0.8,
              ease: "power3.out",
              overwrite: true,
              stagger: whole ? 0 : HERO_STAGGER[Math.min(i, 2)],
              delay: HERO_DELAY[Math.min(i, HERO_DELAY.length - 1)] * delayScale,
            },
          );
        });
      };

      // The hero server assembles itself on load (user: the copy blurs in nicely, the server just
      // "appeared"): the base rises into place, then the lower slab, upper slab and cap drop onto
      // it one after another with a soft landing, riding in just behind the heading. The host is
      // markup-hidden (opacity 0) so the finished server never flashes before hydration; a reload
      // that restores a later state just reveals it (the server has moved on by then).
      // Per-element CSS `translate` + opacity — the same channel the state-2 float uses, so it
      // can't fight the timeline's transforms — cleared when done or when a push cuts it short.
      const playServerIntro = (delay = 0.3) => {
        gsap.set(serverSvgHost, { opacity: 1 });
        serverIntro?.kill();
        const [cap, upper, lower, base] = float2Layers;
        const intro = gsap.timeline({
          delay,
          onComplete: () => {
            gsap.set(float2Layers.flat(), { clearProps: "translate,opacity" });
            serverIntro = null;
          },
        });
        intro.fromTo(base, { translate: "0px 46px", opacity: 0 }, { translate: "0px 0px", opacity: 1, duration: 1, ease: "power3.out" }, 0);
        [lower, upper, cap].forEach((els, k) => {
          intro.fromTo(
            els,
            { translate: `0px ${-70 - k * 25}px`, opacity: 0 },
            { translate: "0px 0px", opacity: 1, duration: 0.95, ease: "back.out(1.15)" },
            0.2 + k * 0.17,
          );
        });
        serverIntro = intro;
      };
      gsap.set(serverSvgHost, { opacity: 1 });
      if (saved === 0) {
        playHeroText();
        playServerIntro();
      } else {
        // a restored/deep-linked later state: the hero column is already behind us
        gsap.set(heroText, { opacity: 1 });
      }

      // the left ruler's green overlay fills top-down across the ENTIRE pinned journey —
      // added last so totalDuration() already includes every state and trailing hold
      tl.fromTo(
        rulerFill,
        { clipPath: "inset(0px 0px 100% 0px)" },
        { clipPath: "inset(0px 0px 0% 0px)", ease: "none", duration: tl.totalDuration() },
        0,
      );

      return () => {
        gsap.ticker.remove(tick6);
        gsap.ticker.remove(tickFloat);
        unwind7?.kill();
        seq6.kill();
        window.removeEventListener("wheel", onWheel);
        document.removeEventListener("click", onNavClick, true);
        window.removeEventListener("hashchange", onHashChange);
        ScrollTrigger.removeEventListener("refresh", onRefresh);
      };
    },
    { scope: sectionRef },
  );

  return (
    <>
    {/* The pinned stage fills the viewport below the 96px header on ANY display; the inner stage
        div vertically centers the s(980) design canvas inside it (user report: content sat
        "pushed up" on screens taller than the 1080p reference). All state coordinates are
        unchanged — they're relative to the stage div now. */}
    <section
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{ height: "calc(100svh - 96px)", minHeight: s(700) }}
    >
    <div
      ref={stageRef}
      className="absolute inset-x-0"
      style={{ top: `max(0px, calc((100% - ${s(980)}) / 2))`, height: s(980) }}
    >
      {/* vertical ruler bar left of the text (public/navigation-bar/navigation-bar.png, 35×913
          native — green ticks at its top). Present in every state; the green-tinted overlay copy
          fills top-down in lockstep with the whole pinned journey (clip-path scrubbed).
          unoptimized: the optimizer's resample+recompress wipes out this asset's 1px
          low-opacity ruler ticks entirely — serve the raw PNG instead. */}
      <div
        aria-hidden="true"
        className="absolute"
        style={{ left: s(99), top: s(48), width: s(30), height: s(782) }}
      >
        {/* grayscale: the PNG has green ticks baked into its top, but the ruler must start with
            NO green at all — only the scroll-progress fill below brings the green in */}
        <Image
          src="/navigation-bar/navigation-bar.png"
          alt=""
          width={35}
          height={913}
          unoptimized
          style={{ width: "100%", height: "100%", filter: "grayscale(1)" }}
        />
        {/* the green fill: solid brand layers MASKED by the ruler PNG itself, so revealed ticks
            turn pure green (a filter-tinted copy stayed invisible — the ticks' alpha is too low;
            two stacked layers punch the alpha up) */}
        <div
          ref={rulerFillRef}
          className="absolute inset-0"
          style={{ clipPath: "inset(0px 0px 100% 0px)" }}
        >
          {[0, 1].map((i) => (
            <div
              key={i}
              className="absolute inset-0"
              style={{
                background: "#1ed148",
                WebkitMaskImage: "url(/navigation-bar/navigation-bar.png)",
                maskImage: "url(/navigation-bar/navigation-bar.png)",
                WebkitMaskSize: "100% 100%",
                maskSize: "100% 100%",
              }}
            />
          ))}
        </div>
      </div>

      {/* state 1 — hero text column. opacity 0 in the markup: the blur-in can only start once
          the effect has split the words, and without this the SSR frame showed the finished
          column for a moment before it faded back out and re-animated (user: "ჩნდება, ქრება და
          მერე იწყებს თავიდან"). The reduced-motion branch of the effect reveals it immediately. */}
      <div
        ref={heroTextRef}
        className="absolute"
        style={{ left: s(187), top: s(216), width: s(1180), opacity: 0 }}
      >
        <p className="flex items-center font-heading font-light text-white/60" style={{ gap: s(12), fontSize: s(17) }}>
          <Image
            src="/section-hero/hatch.svg"
            alt=""
            width={58}
            height={26}
            aria-hidden="true"
            style={{ width: s(36), height: "auto" }}
          />
          Managed Kubernetes &amp; AI Agent Infrastructure
        </p>

        <h1
          className="font-heading font-medium tracking-[-0.02em] text-foreground"
          style={{ fontSize: s(64), lineHeight: 1.26, marginTop: s(-10), maxWidth: s(1100) }}
        >
          Build your product. We&rsquo;ll handle the infrastructure.
        </h1>

        <p
          className="font-heading font-light text-white/65"
          style={{ fontSize: s(21.3), lineHeight: 1.3, marginTop: s(17), maxWidth: s(950) }}
        >
          Deploy your apps, databases, workers, and AI agents without building a DevOps team.
          usectl takes you from code to production with managed infrastructure and predictable
          pricing.
        </p>

        {/* gap 30 → 14 (team, 2026-09-29: "button ები ერთმანეთს დაშორება შეამცირე") */}
        <div className="flex items-center" style={{ gap: s(14), marginTop: s(34) }}>
          <Link
            href="#start"
            className="flex items-center justify-center rounded-full border border-white/25 font-heading font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
            style={{ height: s(48), paddingLeft: s(32), paddingRight: s(32), fontSize: s(16) }}
          >
            Start Building
          </Link>
          <Link
            href="#how"
            className="flex items-center justify-center rounded-full border border-white/25 font-heading font-normal text-white/90 transition-colors hover:border-brand hover:text-brand"
            style={{ height: s(48), paddingLeft: s(32), paddingRight: s(26), fontSize: s(16), gap: s(4) }}
          >
            See how it works <ButtonArrow />
          </Link>
        </div>
      </div>

      {/* state 2 — "You came here to build." text column (inline opacity/visibility keep every
          later-state element hidden pre-hydration too, so nothing flashes) */}
      <div
        ref={secondTextRef}
        className="absolute"
        style={{ left: s(187), top: s(216), width: s(520), opacity: 0, visibility: "hidden" }}
      >
        <p className="flex items-center font-heading font-light text-white/60" style={{ gap: s(12), fontSize: s(17) }}>
          <Image
            src="/section-hero/hatch.svg"
            alt=""
            width={58}
            height={26}
            aria-hidden="true"
            style={{ width: s(36), height: "auto" }}
          />
          Infrastructure Freedom
        </p>

        <h2
          className="font-heading font-medium tracking-[-0.02em] text-foreground"
          style={{ fontSize: s(56), lineHeight: 1.15, marginTop: s(10), maxWidth: s(460) }}
        >
          You came here to build.
        </h2>

        <p
          className="font-heading font-light text-white/60"
          style={{ fontSize: s(18), lineHeight: 1.45, marginTop: s(18), maxWidth: s(440) }}
        >
          Your next feature. Your first customer. The idea you can&rsquo;t stop thinking about.
          usectl handles the infrastructure, giving you more time to move your product forward
        </p>
      </div>

      {/* state 3 — "Your Stacks, in one place." text column */}
      <div
        ref={thirdTextRef}
        className="absolute"
        style={{ left: s(187), top: s(216), width: s(520), opacity: 0, visibility: "hidden" }}
      >
        <p className="flex items-center font-heading font-light text-white/60" style={{ gap: s(12), fontSize: s(17) }}>
          <Image
            src="/section-hero/hatch.svg"
            alt=""
            width={58}
            height={26}
            aria-hidden="true"
            style={{ width: s(36), height: "auto" }}
          />
          Infrastructure Freedom
        </p>

        <h2
          className="font-heading font-medium tracking-[-0.02em] text-foreground"
          style={{ fontSize: s(56), lineHeight: 1.15, marginTop: s(10) }}
        >
          Your Stacks,
          <br />
          in one place.
        </h2>

        <p
          className="font-heading font-light text-white/60"
          style={{ fontSize: s(18), lineHeight: 1.45, marginTop: s(18), maxWidth: s(440) }}
        >
          Run your apps, databases, storage, and background jobs together. Everything stays
          connected and organized while usectl manages the infrastructure underneath.
        </p>
      </div>

      {/* the exploded server — one wrapper so the state-1→2 move/scale (and the glow with it) is
          a single transform */}
      <div
        ref={serverRef}
        aria-hidden="true"
        className="absolute"
        style={{ left: s(SERVER_STATE1.left), top: s(SERVER_STATE1.top), width: s(SERVER_STATE1.width) }}
      >
        {/* green ambient glow pooling under the server in state 2 */}
        <div
          ref={glowRef}
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: s(-14),
            width: "130%",
            height: s(130),
            opacity: 0,
            visibility: "hidden",
            background: "radial-gradient(ellipse at center, rgba(17,163,42,0.35) 0%, rgba(17,163,42,0) 70%)",
            filter: `blur(${s(10)})`,
          }}
        />
        {/* the exploded server INLINE (string prop from the server component) so state 2→3 can
            fade its middle-layer elements individually — see the classification in the effect */}
        <div
          ref={serverSvgRef}
          className="relative [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          // markup-hidden until the effect plays the server's load-in (or reveals it) — see there
          style={{ opacity: 0 }}
          dangerouslySetInnerHTML={{ __html: serverSvg }}
        />
      </div>

      {/* state 3 — the greening overlay: the green stacked-base art, faded in over the docked
          base at rest (born grayscale, so the moment of overlay is invisible) */}
      <div
        ref={bottomPieceRef}
        aria-hidden="true"
        className="absolute"
        style={{
          left: s(BOTTOM_PIECE.left),
          top: s(BOTTOM_PIECE.top),
          width: s(BOTTOM_PIECE.w),
          opacity: 0,
          visibility: "hidden",
        }}
      >
        {/* the stacked pose's own, stronger ground glow — blooms in with the base's greening */}
        <div
          data-bottom-glow
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: s(-24),
            width: "150%",
            height: s(150),
            background: "radial-gradient(ellipse at center, rgba(17,163,42,0.45) 0%, rgba(17,163,42,0) 70%)",
            filter: `blur(${s(12)})`,
            opacity: 0,
          }}
        />
        <Image
          src="/stack-section/bottom-server-piece.svg"
          alt=""
          width={BOTTOM_PIECE.w}
          height={BOTTOM_PIECE.h}
          style={{ width: "100%", height: "auto", position: "relative" }}
        />
      </div>

      {/* dashed guide lines between the settled pieces */}
      <svg
        ref={guidesRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0"
        style={{ width: s(1920), height: s(940), opacity: 0, visibility: "hidden" }}
        viewBox="0 0 1920 940"
        fill="none"
      >
        {STACK_GUIDES.map((g) => (
          <line
            key={g.x}
            x1={g.x}
            y1={g.y1}
            x2={g.x}
            y2={g.y2}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
        ))}
      </svg>

      {/* state 2 — right-side callouts (box + elbow lines + labels) */}
      <div ref={calloutsRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          ref={calloutBoxRef}
          className="absolute font-heading font-light text-white/85"
          style={{
            left: s(1330),
            top: s(111),
            width: s(430),
            padding: `${s(22)} ${s(24)}`,
            fontSize: s(17.5),
            lineHeight: 1.5,
            borderRadius: s(10),
            border: "1px solid transparent",
            background:
              "linear-gradient(#1e1d1d, #1e1d1d) padding-box, linear-gradient(120deg, rgba(17,163,42,0.9), rgba(59,130,246,0.9)) border-box",
            opacity: 0,
            visibility: "hidden",
          }}
        >
          0 Hours spent on DevOps configuration.
          <br />
          100% Focus on Product Logic
        </div>

        <svg
          data-line-layer
          className="absolute left-0 top-0"
          style={{ width: s(1920), height: s(940), opacity: 0 }}
          viewBox="0 0 1920 940"
          fill="none"
        >
          {CALLOUT_LINES.map((d) => (
            <path key={d} data-callout-line d={d} stroke="white" strokeOpacity="0.17" strokeWidth="1" />
          ))}
          {CALLOUT_LABELS.map((label) => (
            <path
              key={`${label.text}-arrow`}
              data-callout-arrow
              d={`M ${label.ax} ${label.ay - 4.33} L ${label.ax + 7.5} ${label.ay} L ${label.ax} ${label.ay + 4.33} Z`}
              fill="white"
              fillOpacity="0.15"
              opacity="0"
            />
          ))}
        </svg>

        {CALLOUT_LABELS.map((label) => (
          <p
            key={label.text}
            data-callout-label
            className="absolute font-heading font-light text-white/75"
            style={{ left: s(label.x), top: s(label.y), fontSize: s(17), opacity: 0, visibility: "hidden" }}
          >
            {label.text}
          </p>
        ))}
      </div>

      {/* state 3 — right-side numbered panel */}
      <div ref={panelRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          ref={panelLineRef}
          className="absolute"
          style={{
            left: s(1322),
            top: s(365),
            width: s(3),
            height: s(349),
            background: "linear-gradient(180deg, #11a32a 0%, #3b82f6 100%)",
            opacity: 0,
            visibility: "hidden",
          }}
        />
        <p
          data-panel-item
          className="absolute font-mono font-medium text-white/90"
          style={{ left: s(1346), top: s(378), fontSize: s(15), letterSpacing: "0.04em", opacity: 0, visibility: "hidden" }}
        >
          USECTL MANAGED INFRASTRUCTURE
        </p>
        {PANEL_ITEMS.map((item) => (
          <div
            key={item.no}
            data-panel-item
            className="absolute font-mono"
            style={{ left: s(1346), top: s(item.y), width: s(400), opacity: 0, visibility: "hidden" }}
          >
            <p className="text-white/90" style={{ fontSize: s(15) }}>
              <span className="text-brand">{item.no}</span> {item.title}
            </p>
            <p className="text-white/45" style={{ fontSize: s(13.5), lineHeight: 1.5, marginTop: s(8), maxWidth: s(390) }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      {/* state 4 — "Give every project its own space." text column */}
      <div
        ref={fourthTextRef}
        className="absolute"
        style={{ left: s(187), top: s(216), width: s(600), opacity: 0, visibility: "hidden" }}
      >
        <p className="flex items-center font-heading font-light text-white/60" style={{ gap: s(12), fontSize: s(17) }}>
          <Image
            src="/section-hero/hatch.svg"
            alt=""
            width={58}
            height={26}
            aria-hidden="true"
            style={{ width: s(36), height: "auto" }}
          />
          Isolated Spaces
        </p>

        <h2
          className="font-heading font-medium tracking-[-0.02em] text-foreground"
          style={{ fontSize: s(56), lineHeight: 1.15, marginTop: s(10) }}
        >
          Give every project
          <br />
          its own space.
        </h2>

        <p
          className="font-heading font-light text-white/60"
          style={{ fontSize: s(18), lineHeight: 1.45, marginTop: s(18), maxWidth: s(560) }}
        >
          Keep your app and the services it depends on together, with their own resources and
          access settings. In usectl, we call this project space a Machine.
        </p>
      </div>

      {/* state 4 — the Machine: closed arrives first, then unfolds into the open one
          (both SVGs share one viewBox, so the crossfade is pixel-aligned) */}
      <div
        ref={machineRef}
        aria-hidden="true"
        className="absolute"
        style={{ left: s(MACHINE.left), top: s(MACHINE.top), width: s(MACHINE.w), opacity: 0, visibility: "hidden" }}
      >
        {/* the Machine is injected here as ONE inline svg (see the unfold block in the effect):
            it mounts pre-collapsed (≡ closed.svg) and its assemblies rise to the open pose */}
        <div ref={machineOpenRef} className="w-full" />
      </div>

      {/* state 4 — right-side numbered panel */}
      <div ref={panel4Ref} aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          ref={panel4LineRef}
          className="absolute"
          style={{
            left: s(PANEL4_X),
            top: s(346),
            width: s(3),
            height: s(274),
            background: "linear-gradient(180deg, #11a32a 0%, #3b82f6 100%)",
            opacity: 0,
            visibility: "hidden",
          }}
        />
        <p
          data-panel-item
          className="absolute font-mono font-medium text-white/90"
          style={{ left: s(PANEL4_X + 24), top: s(360), fontSize: s(15), letterSpacing: "0.04em", opacity: 0, visibility: "hidden" }}
        >
          USECTL MANAGED INFRASTRUCTURE
        </p>
        {PANEL4_ITEMS.map((item) => (
          <div
            key={item.no}
            data-panel-item
            className="absolute font-mono"
            style={{ left: s(PANEL4_X + 24), top: s(item.y), width: s(420), opacity: 0, visibility: "hidden" }}
          >
            <p className="text-white/90" style={{ fontSize: s(15), letterSpacing: "0.03em" }}>
              <span className="text-brand">{item.no}</span> {item.title}
            </p>
            <p className="text-white/45" style={{ fontSize: s(13.5), lineHeight: 1.5, marginTop: s(8) }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      {/* state 5 — "Run each part independently." text column */}
      <div
        ref={fifthTextRef}
        className="absolute"
        style={{ left: s(187), top: s(216), width: s(520), opacity: 0, visibility: "hidden" }}
      >
        <p className="flex items-center font-heading font-light text-white/60" style={{ gap: s(12), fontSize: s(17) }}>
          <Image
            src="/section-hero/hatch.svg"
            alt=""
            width={58}
            height={26}
            aria-hidden="true"
            style={{ width: s(36), height: "auto" }}
          />
          Isolated Spaces
        </p>

        <h2
          className="font-heading font-medium tracking-[-0.02em] text-foreground"
          style={{ fontSize: s(56), lineHeight: 1.15, marginTop: s(10) }}
        >
          Run each part
          <br />
          independently.
        </h2>

        <p
          className="font-heading font-light text-white/60"
          style={{ fontSize: s(18), lineHeight: 1.45, marginTop: s(18), maxWidth: s(450) }}
        >
          Your frontend, API, and workers can each have their own resources and deploy separately
          while staying connected inside the same project. In usectl, each running workload is a
          Pod.
        </p>
      </div>

      {/* state 5 — the Pods stack: one complete 3-slab SVG, glow baked into its bottom slab */}
      <div
        ref={server5Ref}
        aria-hidden="true"
        className="absolute"
        style={{
          left: s(SERVER5.left),
          top: s(SERVER5.top),
          width: s(SERVER5.w),
          height: s(760),
          opacity: 0,
          visibility: "hidden",
        }}
      >
        {/* inline (see HeroSection.tsx) so the three slabs can float independently */}
        <div
          className="absolute left-0 w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          style={{ top: s(SERVER5.imgDy) }}
          dangerouslySetInnerHTML={{ __html: podsSvg }}
        />
      </div>

      {/* state 5 — pod status callouts with elbow arrows */}
      <div ref={podsRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
        <svg
          data-line-layer
          className="absolute left-0 top-0"
          style={{ width: s(1920), height: s(940), opacity: 0 }}
          viewBox="0 0 1920 940"
          fill="none"
        >
          {PODS.map((pod) => (
            <path
              key={pod.title}
              data-pod-line
              d={podElbow(POD_LABEL_X - 12, pod.y + 10)}
              stroke="rgba(255,255,255,0.17)"
              strokeWidth="1.5"
            />
          ))}
          {PODS.map((pod) => (
            <path
              key={`${pod.title}-arrow`}
              data-pod-arrow
              d={`M ${POD_LABEL_X - 12} ${pod.y + 5} L ${POD_LABEL_X - 3} ${pod.y + 10} L ${POD_LABEL_X - 12} ${pod.y + 15} Z`}
              fill="rgba(255,255,255,0.15)"
              opacity="0"
            />
          ))}
        </svg>

        {PODS.map((pod) => (
          <div
            key={pod.title}
            data-pod-item
            className="absolute font-mono"
            style={{ left: s(POD_LABEL_X), top: s(pod.y), width: s(330), opacity: 0, visibility: "hidden" }}
          >
            <p className="text-brand" style={{ fontSize: s(15), letterSpacing: "0.04em" }}>
              {pod.title}
            </p>
            <p className="flex items-center text-white/85" style={{ fontSize: s(13.5), marginTop: s(12), gap: s(8) }}>
              <span
                className="inline-block rounded-full"
                style={{
                  width: s(7),
                  height: s(7),
                  background: pod.deploying ? "transparent" : "#11a32a",
                  border: pod.deploying ? `1px solid #11a32a` : "none",
                }}
              />
              <span>
                {pod.status}
                {pod.percent !== undefined ? (
                  <>
                    {" ("}
                    <span data-pod-percent>{pod.percent}</span>
                    {"%)"}
                  </>
                ) : null}
              </span>
            </p>
            {pod.deploying && (
              <div
                className="overflow-hidden rounded-full"
                style={{ width: s(150), height: s(6), marginTop: s(10), background: "rgba(255,255,255,0.15)" }}
              >
                {/* scaleX-animated from 0 → 1 in the timeline; width is the settled fill */}
                <div
                  data-pod-bar
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${POD_PROGRESS}%` }}
                />
              </div>
            )}
            <p className="text-white/45" style={{ fontSize: s(13), marginTop: s(10) }}>
              {pod.desc}
            </p>
          </div>
        ))}
      </div>

      {/* state 6 — "Push your code. We'll put it live." text column */}
      <div
        ref={sixthTextRef}
        className="absolute"
        style={{ left: s(187), top: s(216), width: s(520), opacity: 0, visibility: "hidden" }}
      >
        <p className="flex items-center font-heading font-light text-white/60" style={{ gap: s(12), fontSize: s(17) }}>
          <Image
            src="/section-hero/hatch.svg"
            alt=""
            width={58}
            height={26}
            aria-hidden="true"
            style={{ width: s(36), height: "auto" }}
          />
          Continuous Deployment
        </p>

        <h2
          className="font-heading font-medium tracking-[-0.02em] text-foreground"
          style={{ fontSize: s(56), lineHeight: 1.15, marginTop: s(10) }}
        >
          Push your code.
          <br />
          We&rsquo;ll put it live.
        </h2>

        <p
          className="font-heading font-light text-white/60"
          style={{ fontSize: s(18), lineHeight: 1.45, marginTop: s(18), maxWidth: s(480) }}
        >
          Connect your repository and push your next update. usectl builds it, deploys it, and
          serves it over HTTPS while the rest of your project keeps running.
        </p>
      </div>

      {/* state 6 — the flat pod board (right-bottom.svg: same tray as Group 1728, chips baked in) */}
      <div
        ref={board6Ref}
        aria-hidden="true"
        className="absolute"
        style={{
          left: s(BOARD6.left),
          top: s(BOARD6.top),
          width: s(BOARD6.w),
          opacity: 0,
          visibility: "hidden",
        }}
      >
        <div
          data-board-glow
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            // same glow as state 7's main board (team, 2026-09-29): #E1F1FF 12% → #11A32A 5% →
            // #FFE0B8 0%, 70% of the board wide, 60 tall, centred 20 lower than before
            bottom: s(-50),
            width: "70%",
            height: s(60),
            background:
              "radial-gradient(ellipse at center, rgba(225,241,255,0.12) 0%, rgba(17,163,42,0.05) 50%, rgba(255,224,184,0) 100%)",
            filter: `blur(${s(12)})`,
          }}
        />
        {/* inline (see HeroSection.tsx) so its chips can grow in state 7's power-up */}
        <div
          data-board7="right"
          className="relative [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: rightBoardSvg }}
        />
      </div>

      {/* state 6 — terminal window feeding the push line down to the board node */}
      <div
        ref={terminal6Ref}
        aria-hidden="true"
        className="absolute"
        style={{
          left: s(TERMINAL6.left),
          top: s(TERMINAL6.top),
          width: s(TERMINAL6.w),
          borderRadius: s(8),
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(30,29,29,0.92)",
          opacity: 0,
          visibility: "hidden",
        }}
      >
        <div
          className="flex items-center"
          style={{
            gap: s(6),
            padding: `${s(10)} ${s(14)}`,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block rounded-full"
              style={{ width: s(9), height: s(9), background: "rgba(255,255,255,0.25)" }}
            />
          ))}
          <span className="font-heading font-light text-white/60" style={{ fontSize: s(12.5), marginLeft: s(6) }}>
            usectl // repository-pipeline
          </span>
        </div>
        {/* 11.5px: at 12.5 the "Code push detected:commit-a7f3d" row wraps inside the 268px window */}
        <div className="font-mono" style={{ padding: `${s(12)} ${s(16)} ${s(16)}`, fontSize: s(11.5), lineHeight: 2.2 }}>
          {/* typed in by seq6 (see the effect): each [data-type6] span starts empty and types its
              data-type6 text; [data-cur6] is that row's cursor (row 3's block ends up blinking) */}
          <p data-row6="" className="whitespace-nowrap text-white/85">
            <span className="text-brand">&gt;</span>{" "}
            <span data-type6="git push origin main" data-type-row6="0">git push origin main</span>
            <span
              data-cur6=""
              className="inline-block align-middle"
              style={{ width: s(7), height: s(14), marginLeft: s(2), background: "#11a32a" }}
            />
          </p>
          <p data-row6="" className="whitespace-nowrap text-white/85">
            <span
              data-dot6=""
              className="inline-block rounded-full align-middle"
              style={{ width: s(8), height: s(8), marginRight: s(6), background: "#11a32a" }}
            />
            <span data-type6="Code push detected:" data-type-row6="1">Code push detected:</span>
            <span data-type6="commit-a7f3d" data-type-row6="1" className="text-brand">commit-a7f3d</span>
            <span
              data-cur6=""
              className="inline-block align-middle"
              style={{ width: s(7), height: s(14), marginLeft: s(2), background: "#11a32a" }}
            />
          </p>
          <p data-row6="" className="whitespace-nowrap text-white/85">
            <span className="text-brand">&lt;</span>{" "}
            <span data-type6="Automatic build triggered" data-type-row6="2">Automatic build triggered</span>{" "}
            <span
              data-cur6=""
              className="inline-block align-middle"
              style={{ width: s(7), height: s(14), background: "#11a32a" }}
            />
          </p>
        </div>
      </div>

      {/* state 6 — the push pipe + the ring it lands on (wrapper = what the main tl fades out) */}
      <div ref={pipe6WrapRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div
        ref={pushLine6Ref}
        className="absolute"
        style={{
          left: s(PIPE6.x - PIPE6.half - PIPE6.wall / 2),
          top: s(PIPE6.top),
          width: s(PIPE6.half * 2 + PIPE6.wall),
          height: s(PIPE6_H),
          opacity: 0,
          visibility: "hidden",
        }}
      >
        {/* No walls and no tinted fill any more (team feedback 2026-09-29: "ხაზები მოხსენი და
            ბუშტუკები ხაზების გარეშე ავიდეს") — the bubbles rise on their own along the same
            path, ring → terminal. PIPE6's geometry is kept only as the particles' lane. */}
        <canvas
          ref={pipe6CanvasRef}
          width={Math.round((PIPE6_INNER_W + 2 * PIPE6_GLOW_PAD) * PIPE6_CANVAS_K)}
          height={Math.round(PIPE6_H * PIPE6_CANVAS_K)}
          className="absolute top-0 h-full"
          style={{ left: s(PIPE6.wall - PIPE6_GLOW_PAD), width: s(PIPE6_INNER_W + 2 * PIPE6_GLOW_PAD) }}
        />
      </div>
      <div
        ref={node6Ref}
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          left: s(NODE6.x - NODE6.size / 2),
          top: s(NODE6.y - NODE6.size / 2),
          width: s(NODE6.size),
          height: s(NODE6.size),
          border: "1.5px solid #11a32a",
          boxShadow: "0 0 0px rgba(17,163,42,0)",
          opacity: 0,
          visibility: "hidden",
        }}
      />
      </div>

      {/* state 6 — BUILD status badge (gradient border, same two-layer trick as the state-2 box) */}
      <div
        ref={badge6Ref}
        aria-hidden="true"
        className="absolute flex items-center font-mono text-white/85"
        style={{
          left: s(BADGE6.left),
          top: s(BADGE6.top),
          height: s(34),
          paddingLeft: s(16),
          paddingRight: s(16),
          gap: s(10),
          fontSize: s(13),
          letterSpacing: "0.05em",
          borderRadius: s(3),
          border: "1px solid transparent",
          background:
            "linear-gradient(#1e1d1d, #1e1d1d) padding-box, linear-gradient(90deg, rgba(17,163,42,0.9), rgba(59,130,246,0.8)) border-box",
          opacity: 0,
          visibility: "hidden",
        }}
      >
        <span
          className="inline-block rounded-full"
          style={{ width: s(13), height: s(13), border: "1.5px solid #11a32a" }}
        />
        BUILD: IN-PROGRESS
      </div>

      {/* state 6 — deploy status cards wired to the board */}
      <div ref={deploy6Ref} aria-hidden="true" className="pointer-events-none absolute inset-0">
        <svg
          data-line-layer
          className="absolute left-0 top-0"
          style={{ width: s(1920), height: s(940), opacity: 0 }}
          viewBox="0 0 1920 940"
          fill="none"
        >
          {DEPLOY6_LINES.map((l) => (
            <path
              key={l.ey}
              data-deploy-line
              d={l.d}
              stroke={l.hairline ? "white" : "rgba(255,255,255,0.17)"}
              strokeOpacity={l.hairline ? 0.1 : undefined}
              strokeWidth={l.hairline ? 1 : 1.5}
            />
          ))}
          {DEPLOY6_LINES.filter((l) => l.arrow).map((l) => (
            <path
              key={`${l.ey}-arrow`}
              data-deploy-arrow
              d={`M ${DEPLOY6_X - 5} ${l.ey - 5} L ${DEPLOY6_X + 4} ${l.ey} L ${DEPLOY6_X - 5} ${l.ey + 5} Z`}
              fill="rgba(255,255,255,0.15)"
              opacity="0"
            />
          ))}
        </svg>

        {/* [ POD // API ] — deploying (design's "APPI" typo corrected, like state 5) */}
        <div
          data-deploy-item
          className="absolute font-heading"
          style={{
            left: s(DEPLOY6_X),
            top: s(DEPLOY6_CARD_TOPS.pod),
            width: s(DEPLOY6_CARD_W),
            height: s(DEPLOY6_CARD_H.pod),
            padding: `${s(13)} ${s(18)} 0 ${s(29.5)}`,
            opacity: 0,
            visibility: "hidden",
          }}
        >
          <DeployFrame6 />
          <p className="relative flex items-center text-brand" style={{ fontSize: s(16.5) }}>
            [ POD // API ]
          </p>
          <p
            className="flex items-center text-white/85"
            style={{ fontSize: s(14), marginTop: s(12), marginLeft: s(4.5), gap: s(8) }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: s(8), height: s(8), border: "1px solid #11a32a" }}
            />
            DEPLOYING ... v2.1.0
          </p>
          <div className="flex items-center" style={{ marginTop: s(10), marginLeft: s(4.5), gap: s(10) }}>
            <div
              className="overflow-hidden rounded-full"
              style={{ width: s(182), height: s(7), background: "rgba(255,255,255,0.18)" }}
            >
              {/* scaleX-animated 0 → 1 in the timeline; the LIVE line draws only once it lands */}
              <div
                data-deploy-bar
                className="h-full rounded-full bg-brand"
                style={{ width: `${DEPLOY6_PROGRESS}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-white/60" style={{ fontSize: s(13) }}>
              <span data-deploy-percent>{DEPLOY6_PROGRESS}</span>&nbsp;%
            </span>
          </div>
        </div>

        {/* [ ✓ LIVE // v2.1.0 ] */}
        <div
          data-deploy-item
          className="absolute font-heading"
          style={{
            left: s(DEPLOY6_X),
            top: s(DEPLOY6_CARD_TOPS.live),
            width: s(DEPLOY6_CARD_W),
            height: s(DEPLOY6_CARD_H.live),
            padding: `${s(13)} ${s(18)} 0 ${s(29.5)}`,
            opacity: 0,
            visibility: "hidden",
          }}
        >
          <DeployFrame6 />
          <p className="relative flex items-center text-brand" style={{ fontSize: s(16.5) }}>
            [ &#10003; LIVE // v2.1.0 ]
          </p>
          <p
            className="flex items-center text-white/85"
            style={{ fontSize: s(14), marginTop: s(12), marginLeft: s(4.5), gap: s(9) }}
          >
            <svg viewBox="0 0 14 17" fill="none" style={{ width: s(12), height: s(15) }}>
              <rect x="1" y="7" width="12" height="9" rx="1.5" stroke="#11a32a" strokeWidth="1.3" />
              <path d="M3.5 7V4.5a3.5 3.5 0 0 1 7 0V7" stroke="#11a32a" strokeWidth="1.3" />
            </svg>
            HTTPS Active
          </p>
        </div>
      </div>

      {/* state 7 — "Give your agent a place to work." text column */}
      <div
        ref={seventhTextRef}
        className="absolute"
        style={{ left: s(187), top: s(216), width: s(520), opacity: 0, visibility: "hidden" }}
      >
        <p className="flex items-center font-heading font-light text-white/60" style={{ gap: s(12), fontSize: s(17) }}>
          <Image
            src="/section-hero/hatch.svg"
            alt=""
            width={58}
            height={26}
            aria-hidden="true"
            style={{ width: s(36), height: "auto" }}
          />
          AI Infrastructure
        </p>

        <h2
          className="font-heading font-medium tracking-[-0.02em] text-foreground"
          style={{ fontSize: s(56), lineHeight: 1.15, marginTop: s(10) }}
        >
          Give your agent
          <br />
          a place to work.
        </h2>

        <p
          className="font-heading font-light text-white/60"
          style={{ fontSize: s(18), lineHeight: 1.45, marginTop: s(18), maxWidth: s(460) }}
        >
          Run AI agents alongside the apps, APIs, databases, and tools they use. Your coding
          assistant can also deploy updates and inspect logs through the usectl CLI.
        </p>
      </div>

      {/* state 7 — the main agent board (platform + asterisk + ring + chips baked into the SVG) */}
      <div
        ref={agent7Ref}
        aria-hidden="true"
        className="absolute"
        style={{
          left: s(AGENT7.left),
          top: s(AGENT7.top),
          width: s(AGENT7.w),
          opacity: 0,
          visibility: "hidden",
        }}
      >
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            // lowered 30 and recoloured from the team's gradient (2026-09-29): #E1F1FF @50% →
            // #11A32A @18% → #FFE0B8 @0%
            // round 3: much fainter (30/11% → 12/5%) and flatter (120 → 60 tall); bottom −76 → −46
            // keeps the (now shorter) glow's centre at the same height as round 2
            bottom: s(-46),
            width: "70%",
            height: s(60),
            background:
              "radial-gradient(ellipse at center, rgba(225,241,255,0.12) 0%, rgba(17,163,42,0.05) 50%, rgba(255,224,184,0) 100%)",
            filter: `blur(${s(12)})`,
          }}
        />
        {/* inline (see HeroSection.tsx): the ring around the processor spins in place */}
        <div
          className="relative [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: agentSvg }}
        />
      </div>

      {/* state 7 — the bottom-left board */}
      <div
        ref={bottom7Ref}
        aria-hidden="true"
        className="absolute"
        style={{
          left: s(BOTTOM7.left),
          top: s(BOTTOM7.top),
          width: s(BOTTOM7.w),
          opacity: 0,
          visibility: "hidden",
        }}
      >
        <div
          data-board7="bottom"
          className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: bottomBoardSvg }}
        />
      </div>

      {/* state 7 — curved edge-to-edge connectors between the boards */}
      <svg
        ref={connectors7Ref}
        aria-hidden="true"
        data-line-layer
        className="pointer-events-none absolute left-0 top-0"
        style={{ width: s(1920), height: s(940), opacity: 0 }}
        viewBox="0 0 1920 940"
        fill="none"
      >
        <defs>
          <filter id="connector7-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>
        {/* one group lifts every state-7 path by S7_DY, so the traced path strings stay verbatim */}
        <g transform={`translate(0, ${S7_DY})`}>
          {CONNECTOR7_LINES.map((l) => (
            <g
              key={l.d}
              transform={`translate(${l.tx}, ${l.ty})${l.scale ? ` scale(${l.scale[0]}, ${l.scale[1]})` : ""}`}
            >
              <path
                data-connector-line
                d={l.d}
                transform={l.flip ? "translate(121, 0) scale(-1, 1)" : undefined}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={connectorStroke(l, 1.5)}
              />
              {/* state 7's power-up: the green charge (and its soft glow) that runs along this
                  line from the main board once the agent terminal starts (seq7) */}
              <path
                data-connector-glow
                d={l.d}
                transform={l.flip ? "translate(121, 0) scale(-1, 1)" : undefined}
                stroke="#22C55E"
                strokeOpacity="0.35"
                strokeWidth={connectorStroke(l, 4)}
                strokeLinecap="round"
                filter="url(#connector7-glow)"
                style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
              />
              <path
                data-connector-green
                d={l.d}
                transform={l.flip ? "translate(121, 0) scale(-1, 1)" : undefined}
                stroke="#22C55E"
                strokeWidth={connectorStroke(l, 1.6)}
                strokeLinecap="round"
                style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
              />
            </g>
          ))}
          {CONNECTOR7_LINES.filter((l) => l.arrow).map((l) => (
            <path
              key={`${l.d}-arrow`}
              data-connector-arrow
              d={l.arrow}
              fill="rgba(255,255,255,0.3)"
              opacity="0"
            />
          ))}
          {/* the badge's elbow down to the main board's top vertex (no arrowhead, per the ref) */}
          <path ref={badgeLine7Ref} d={BADGE7_LINE_D} stroke="white" strokeOpacity="0.1" />
        </g>
      </svg>

      {/* state 7 — POD // AI AGENT badge + its line down to the ring */}
      <div
        ref={badge7Ref}
        aria-hidden="true"
        className="absolute text-center font-mono"
        style={{
          left: s(BADGE7.left),
          top: s(BADGE7.top),
          width: s(BADGE7.w),
          paddingTop: s(10),
          paddingBottom: s(10),
          fontSize: s(13),
          lineHeight: 1.8,
          letterSpacing: "0.05em",
          borderRadius: s(3),
          border: "1px solid transparent",
          background:
            "linear-gradient(#1e1d1d, #1e1d1d) padding-box, linear-gradient(90deg, rgba(17,163,42,0.9), rgba(59,130,246,0.8)) border-box",
          opacity: 0,
          visibility: "hidden",
        }}
      >
        <p className="text-white/85">POD // AI AGENT</p>
        <p className="text-white/85">
          <span className="text-brand">ACTIVE</span> coding-assistant
        </p>
      </div>
      {/* state 7 — agent terminal window */}
      <div
        ref={terminal7Ref}
        aria-hidden="true"
        className="absolute"
        style={{
          left: s(TERMINAL7.left),
          top: s(TERMINAL7.top),
          width: s(TERMINAL7.w),
          borderRadius: s(8),
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(30,29,29,0.92)",
          opacity: 0,
          visibility: "hidden",
        }}
      >
        <div
          className="flex items-center"
          style={{
            gap: s(6),
            padding: `${s(10)} ${s(14)}`,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block rounded-full"
              style={{ width: s(9), height: s(9), background: "rgba(255,255,255,0.25)" }}
            />
          ))}
          <span className="font-heading font-light text-white/60" style={{ fontSize: s(12.5), marginLeft: s(6) }}>
            usectl // repository-pipeline
          </span>
        </div>
        {/* typed in by seq7 — same mechanism as the state-6 terminal (user: "ტექსტი
            ტერმინალში უნდა დაიწეროს, ისე როგორც ზევით ვქენით") */}
        <div className="font-mono" style={{ padding: `${s(12)} ${s(16)} ${s(16)}`, fontSize: s(11), lineHeight: 2.2 }}>
          <p data-row7="" className="whitespace-nowrap text-white/85">
            <span className="text-brand">&gt;</span>{" "}
            <span data-type7="usectl agent attach --role coding-assistant" data-type-row7="0" />
            <span
              data-cur7=""
              className="inline-block align-middle"
              style={{ width: s(6.5), height: s(13), marginLeft: s(2), background: "#11a32a" }}
            />
          </p>
          <p data-row7="" className="whitespace-nowrap text-white/85">
            <span
              data-dot7=""
              className="inline-block rounded-full align-middle"
              style={{ width: s(8), height: s(8), marginRight: s(6), background: "#11a32a" }}
            />
            <span data-type7="Executing updates & inspecting logs ..." data-type-row7="1" />
            <span
              data-cur7=""
              className="inline-block align-middle"
              style={{ width: s(6.5), height: s(13), marginLeft: s(2), background: "#11a32a" }}
            />
          </p>
          <p data-row7="" className="whitespace-nowrap text-white/85">
            <span className="text-brand">&lt;</span>{" "}
            <span data-type7="Status: Synchronized with machine env-prod-01" data-type-row7="2" />
            <span
              data-cur7=""
              className="inline-block align-middle"
              style={{ width: s(6.5), height: s(13), marginLeft: s(2), background: "#11a32a" }}
            />
          </p>
        </div>
      </div>

      {/* state 8 — the pricing calculator (interactive: NO pointer-events-none on purpose;
          the hidden visibility of each block keeps it inert until the state arrives) */}
      {/* pointer-events-none on the full-stage wrapper, auto on its reveal children: the wrapper
          itself is always "visible" (only the children are hidden), so without this it sat on
          top of state 1 and swallowed every hover / click on the hero buttons. Hidden children
          (visibility: hidden) still ignore the pointer until state 8 shows them. */}
      <div
        ref={pricing8Ref}
        className="pointer-events-none absolute inset-0 [&>[data-pricing-reveal]]:pointer-events-auto"
      >
        {/* The scene light that the calculator panel sits ON (user: "რეალურად მაგის უკან უნდა
            იყოს განათება") — a page-level light, NOT the panel's own background. Its SHAPE is the
            team's own export, public/pricing/pricing-background-light.svg (950×901: two blurred
            blobs, #B6F1C0 → #11A32A and #11A32A → #8FC6FF, stdDeviation 100), which replaced the
            hand-fitted mint ellipse on 2026-09-29. Placed flush with the page's right edge (drawn
            inline by SceneLight, so the blur is never clipped by the file's frame) with the
            blobs' centre (~500, 495 in the file) on the old light's centre (≈1470, 545). */}
        <div
          data-pricing-glow
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ left: s(1920 - 950), top: s(50), width: s(950), height: s(901), opacity: 0, visibility: "hidden" }}
        >
          <SceneLight variant="pricing" style={{ inset: 0, width: "100%", height: "100%" }} />
        </div>

        {/* headline — per-line gradient text */}
        <h2
          data-pricing-reveal
          className="absolute font-heading font-medium tracking-[-0.02em]"
          style={{ left: s(187), top: s(150), fontSize: s(72), lineHeight: 1.2, opacity: 0, visibility: "hidden" }}
        >
          <span
            className="inline-block bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, #27a138 15%, #567f93 95%)" }}
          >
            Know your hosting bill
          </span>
          <br />
          <span
            className="inline-block bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, #567f93 5%, #27a138 80%)" }}
          >
            before you launch.
          </span>
        </h2>

        <p
          data-pricing-reveal
          className="absolute font-heading font-light text-white/70"
          style={{
            left: s(187),
            top: s(380),
            fontSize: s(21),
            lineHeight: 1.45,
            maxWidth: s(830),
            opacity: 0,
            visibility: "hidden",
          }}
        >
          Choose the CPU, memory, and storage your project needs and see the monthly price before
          you deploy. Need more capacity later? You&rsquo;ll see the new price before making the
          change.
        </p>

        {/* CTA — bordered box with brighter blueprint corner brackets */}
        <div
          data-pricing-reveal
          className="absolute"
          style={{ left: s(187), top: s(533), opacity: 0, visibility: "hidden" }}
        >
          <a
            href="#start"
            className="relative flex items-center justify-center border border-white/20 font-heading text-brand transition-colors hover:bg-white/5"
            style={{ width: s(345), height: s(60), fontSize: s(17) }}
          >
            {(["-top-px -left-px border-t border-l", "-top-px -right-px border-t border-r",
               "-bottom-px -left-px border-b border-l", "-bottom-px -right-px border-b border-r"] as const).map(
              (pos) => (
                <span
                  key={pos}
                  aria-hidden="true"
                  className={`absolute ${pos} border-white/60`}
                  style={{ width: s(12), height: s(12) }}
                />
              ),
            )}
            Start now from $15 / month
          </a>
          <p
            className="text-center font-heading font-light text-white/40"
            style={{ marginTop: s(20), fontSize: s(13.5) }}
          >
            Not a surprise.
          </p>
        </div>

        {/* the calculator panel */}
        <div
          data-pricing-reveal
          className="absolute"
          style={{
            left: s(1250),
            // up 40 ("ფასები ოდნავ მაღლა"), then back down 5 ("კალკულატორის card პანელი ჩაწიე")
            top: s(218),
            width: s(492),
            height: s(567),
            borderRadius: s(16),
            border: "1px solid rgba(255,255,255,0.09)",
            // Glass, no tint — the colour comes from the scene light BEHIND it (above). The veil
            // is NOT flat: scanning the design's R channel across the panel at design y300 gives
            // +7 over the page at the left edge fading to +2 at the right (and +3 by y760), i.e.
            // a diagonal white gradient ~0.035 → 0.004. A flat 0.015 made the surface disappear.
            background:
              "linear-gradient(115deg, rgba(255,255,255,0.032) 0%, rgba(255,255,255,0.013) 50%, rgba(255,255,255,0.005) 100%)",
            opacity: 0,
            visibility: "hidden",
          }}
        >
          {/* Monthly / Annual toggle */}
          <div
            className="absolute left-0 flex w-full items-center justify-center font-heading"
            style={{ top: s(44), gap: s(12), fontSize: s(15) }}
          >
            <span className={annual ? "text-white/50" : "text-white/90"}>Monthly</span>
            {/* exact design box: 49×27 track, r4; 22×23 knob in #11A32A, r4, inset 2px —
                travel = 49 − 2 − 22 − 2 = 23 */}
            <button
              type="button"
              role="switch"
              aria-checked={annual}
              aria-label="Bill annually"
              onClick={() => setAnnual((a) => !a)}
              className="relative"
              style={{
                width: s(49),
                height: s(27),
                borderRadius: s(4),
                background: "rgba(255,255,255,0.15)",
              }}
            >
              <span
                className="absolute transition-transform duration-200"
                style={{
                  top: s(2),
                  left: s(2),
                  width: s(22),
                  height: s(23),
                  borderRadius: s(4),
                  background: "#11A32A",
                  transform: annual ? `translateX(${s(23)})` : "translateX(0)",
                }}
              />
            </button>
            <span className={annual ? "text-white/90" : "text-white/50"}>Annual</span>
          </div>

          {/* resource rows */}
          <div className="absolute" style={{ left: s(34), right: s(36), top: s(140) }}>
            {PRICING_ROWS.map((row) => (
              <div key={row.key} className="flex items-center justify-between" style={{ height: s(82) }}>
                <div>
                  <p className="font-heading text-white/90" style={{ fontSize: s(17) }}>
                    {row.label}
                  </p>
                  <p className="font-heading font-light text-white/45" style={{ fontSize: s(13.5), marginTop: s(5) }}>
                    {row.sub}
                  </p>
                </div>
                <div className="flex items-center" style={{ gap: s(10) }}>
                  <button
                    type="button"
                    aria-label={`Decrease ${row.label}`}
                    onClick={() => stepCount(row.key, -1, row.max)}
                    disabled={counts[row.key] <= 1}
                    onPointerDown={pressRipple}
                    className={STEP_BTN_CLASS}
                    style={{ width: s(26), height: s(26), fontSize: s(15) }}
                  >
                    &minus;
                  </button>
                  <span className="text-center font-heading text-white/90" style={{ width: s(34), fontSize: s(16) }}>
                    {counts[row.key]}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${row.label}`}
                    onClick={() => stepCount(row.key, 1, row.max)}
                    disabled={counts[row.key] >= row.max}
                    onPointerDown={pressRipple}
                    className={STEP_BTN_CLASS}
                    style={{ width: s(26), height: s(26), fontSize: s(15) }}
                  >
                    +
                  </button>
                  <span
                    className="text-right font-heading font-light text-white/70"
                    style={{ minWidth: s(74), marginLeft: s(14), fontSize: s(15) }}
                  >
                    {fmtPrice(row.price * counts[row.key] * priceFactor)}
                    {priceSuffix}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* total */}
          <div
            className="absolute flex items-center justify-between"
            style={{
              left: s(41),
              right: s(45),
              top: s(423),
              height: s(60),
              paddingLeft: s(24),
              paddingRight: s(24),
              borderRadius: s(8),
              border: "1px dashed rgba(255,255,255,0.25)",
            }}
          >
            <span className="font-heading text-white/80" style={{ fontSize: s(18) }}>
              Your {annual ? "annual" : "monthly"} price
            </span>
            <span className="font-heading font-medium text-brand" style={{ fontSize: s(26) }}>
              {fmtPrice(priceTotal)}
            </span>
          </div>

          {/* design's "free.You" typo corrected */}
          <p
            className="absolute left-0 w-full text-center font-heading font-light text-white/35"
            style={{ top: s(524), fontSize: s(13.5) }}
          >
            The first month is free. You don&rsquo;t need to link a card.
          </p>
        </div>
      </div>

      {/* state 9 — closing CTA */}
      <div ref={final9Ref} className="absolute inset-0" style={{ opacity: 0, visibility: "hidden" }}>
        {/* The scene light on this state: the team's own export, public/last-section/
            text-background-light-form.svg (868×739, the same two blurred blobs as the footer's),
            which replaced the hand-fitted mint ellipse on 2026-09-29. Drawn at LIGHT9_K of its
            size (team: "ძაან დიდზე ანათებს" behind the headline), blur included since it lives in
            the viewBox, with the blobs' centre (~605, 550 in the file) kept on (1660, 410). */}
        <SceneLight
          variant="footer"
          style={{
            left: s(1660 - 605 * LIGHT9_K),
            top: s(410 - 550 * LIGHT9_K),
            width: s(868 * LIGHT9_K),
            height: s(739 * LIGHT9_K),
          }}
        />
        <p
          className="absolute font-heading font-light text-white/50"
          style={{ left: s(187), top: s(300), fontSize: s(52), lineHeight: 1.2 }}
        >
          What will you build next?
        </p>
        <h2
          className="absolute whitespace-nowrap font-heading font-light text-white/85"
          style={{ left: s(187), top: s(390), fontSize: s(60), lineHeight: 1.4 }}
        >
          Give your next product a place to run.{" "}
          <span className="font-medium" style={{ color: "#27a138" }}>
            Keep building
          </span>
          <br />
          <span className="font-medium" style={{ color: "#6b8fa8" }}>
            what matters
          </span>{" "}
          - we&rsquo;ll handle the infrastructure behind
        </h2>
        {/* buttons 618 → 606 and gap 30 → 22 → 14 (team feedback 2026-09-29: "ოდნავ ასაწევია
            ზემოთ… დაშორება ოდნავ შესამცირებელია", then again: "დაშორება შეამცირე") */}
        <div className="absolute flex items-center" style={{ left: s(187), top: s(606), gap: s(14) }}>
          <Link
            href="#start"
            className="flex items-center justify-center rounded-full border border-white/25 font-heading font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
            style={{ height: s(48), paddingLeft: s(32), paddingRight: s(32), fontSize: s(16) }}
          >
            Start Building
          </Link>
          <Link
            href="#how"
            className="flex items-center justify-center rounded-full border border-white/25 font-heading font-normal text-white/90 transition-colors hover:border-brand hover:text-brand"
            style={{ height: s(48), paddingLeft: s(32), paddingRight: s(26), fontSize: s(16), gap: s(4) }}
          >
            See how it works <ButtonArrow />
          </Link>
        </div>
      </div>

    </div>
    </section>
    {/* SSR scroll reserve for the pin — a SIBLING of the section (the section's height is now a
        fixed viewport calc, so an inner spacer could no longer expand the document). Collapsed
        the moment the real pin-spacer exists. */}
    <div ref={ssrReserveRef} aria-hidden="true" style={{ height: PIN_SCROLL_DISTANCE }} />
    </>
  );
}
