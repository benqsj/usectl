"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { s, readScale, HEADER_HEIGHT_PX } from "@/lib/grid";

gsap.registerPlugin(ScrollTrigger, useGSAP);

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
const SERVER_STATE1 = { left: 1362, top: 85, width: 370 };
const SERVER_NATIVE = { w: 421, h: 687 };
const SERVER_STATE2 = { centerX: 960, top: 126 };
const SERVER_DX = SERVER_STATE2.centerX - (SERVER_STATE1.left + SERVER_STATE1.width / 2); // -587
const SERVER_DY = SERVER_STATE2.top - SERVER_STATE1.top; // 41
const SERVER_SCALE = SERVER_NATIVE.w / SERVER_STATE1.width; // ≈1.138

// State 2 right-side callouts: elbow lines from the server's right edge to their labels
// (design px, read off the reference with a coordinate grid; server top at SERVER_STATE2.top).
const CALLOUT_LINES = [
  "1163,386 1285,386 1330,339 1362,339",
  "1163,516 1250,516 1292,474 1308,474",
  "1163,650 1265,650 1307,606 1330,606",
] as const;
const CALLOUT_LABELS = [
  { text: "Auto-scaling K8s Cluster", x: 1372, y: 330 },
  { text: "Isolated Micro-VM Kernel", x: 1318, y: 465 },
  { text: "Encrypted Postgres Storage", x: 1340, y: 597 },
] as const;

// State 3 stack pieces. START = pixel-aligned over the state-2 server's own cap/base (the piece
// SVGs share new-server.svg's internal coordinates — top piece = server rows 0-284, bottom piece
// = server rows 402-687, verified by center-column pixel profiles). END = the stacked pose from
// the third-section reference.
const CAP_PIECE = { w: 420, h: 284, left: 960 - 420 / 2, top: SERVER_STATE2.top, dy: 107 };
const BOTTOM_PIECE = { w: 417, h: 285, left: 960 - 417 / 2, top: SERVER_STATE2.top + 402, dy: 31 };
// Dashed guide lines between the settled pieces (design px, drawn at the END positions).
const STACK_GUIDES = [
  { x: 752, y1: 388, y2: 699 },
  { x: 960, y1: 511, y2: 787 },
  { x: 1168, y1: 388, y2: 699 },
] as const;

const PANEL_ITEMS = [
  {
    no: "01/",
    title: "Application Services",
    desc: "Automated deployment for APIs, web apps, and microservices.",
    y: 447,
  },
  {
    no: "02/",
    title: "Application Storage",
    desc: "High-availability managed databases and S3-compatible object storage.",
    y: 549,
  },
  {
    no: "03/",
    title: "Background Jobs",
    desc: "Isolated worker queues, scheduled CRONs, and async processing.",
    y: 652,
  },
] as const;

// State 4: the Machine (public/machine-section/, closed.svg + opened.svg — same 834×694 viewBox,
// so the closed→opened "unfold" is a pixel-aligned crossfade). Rendered at 720 design px wide.
const MACHINE = { w: 720, h: 599, left: 960 - 720 / 2, top: 300 };

const PANEL4_ITEMS = [
  { no: "01/", title: "MACHINE BOUNDARY", desc: "Zero cross-project interference", y: 404 },
  { no: "02/", title: "DEDICATED RESOURCES", desc: "CPU, RAM, and Storage isolated per space", y: 486 },
  { no: "03/", title: "ENVIRONMENT CONFIG", desc: "Independent secrets and access policies", y: 569 },
] as const;

// State 5: the Pods view (public/section-5/server2.svg, 689×1007 — the COMPLETE 3-slab exploded
// stack in one SVG, chips and the bottom slab's glow baked in; replaced the old three-instance
// section-4/server.svg hack + CSS glow on 2026-09-28) + three pod-status callouts wired to the
// slabs with rounded elbow arrows (drawn inline so they can dash-draw). The image sits 20px into
// the wrapper so the new art's stack center matches where the old one sat.
const SERVER5 = { w: 480, left: 820, top: 170, imgDy: 20 };
const POD_LABEL_X = 1490;
const PODS = [
  {
    title: "[ POD // FRONTEND ]",
    status: "RUNNING v1.4.2",
    deploying: false,
    desc: "Independent Deploy \u2022 1 vCPU / 2GB",
    y: 330,
  },
  {
    title: "[ POD // API ]",
    status: "DEPLOYING v2.1.0 (80%)",
    deploying: true,
    desc: "Zero Downtime \u2022 2 vCPU / 4GB",
    y: 558,
  },
  {
    title: "[ POD // WORKERS ]",
    status: "RUNNING v1.4.2",
    deploying: false,
    desc: "Async Processing \u2022 1 vCPU / 1GB",
    y: 762,
  },
] as const;
// rounded "right, up, right" elbow ending at the arrow tip (ex, ey) — same shape as arrow-line.svg
const podElbow = (ex: number, ey: number) =>
  `M ${ex - 235} ${ey + 45} H ${ex - 88} Q ${ex - 80} ${ey + 45} ${ex - 80} ${ey + 37} ` +
  `V ${ey + 8} Q ${ex - 80} ${ey} ${ex - 72} ${ey} H ${ex}`;

// State 6: Continuous Deployment (built against Desktop/new-version/section-6 screenshots).
// The board is public/section-6/right-bottom.svg — its chip layout matches the reference board
// (Group 1728.svg is the same tray empty at 1.5×, left-bottom.svg an unused chip variant; the
// reference's extra heatsink fins exist in no supplied asset and are deliberately omitted).
// A terminal window ("usectl // repository-pipeline") feeds a green push line down to a node on
// the board, a gradient-bordered BUILD badge pops, then two status cards (deploying → live) wire
// to the board with the same rounded elbows as state 5. All numbers are design px at 1920.
const BOARD6 = { w: 580, h: Math.round((580 * 220) / 348), left: 794, top: 530 };
const TERMINAL6 = { left: 966, top: 311, w: 268 };
const PUSH_LINE6 = { x: 1083, top: 461, height: 200 }; // terminal bottom → the board node
const NODE6 = { x: 1083, y: 661, size: 16 };
const BADGE6 = { left: 1227, top: 494 };
const DEPLOY6_X = 1429; // cards' left edge; elbows end just short of it
// same rounded "right, up, right" shape as podElbow but with a free start point
const deployElbow = (sx: number, sy: number, ex: number, ey: number) =>
  `M ${sx} ${sy} H ${ex - 53} Q ${ex - 45} ${sy} ${ex - 45} ${sy - 8} ` +
  `V ${ey + 8} Q ${ex - 45} ${ey} ${ex - 37} ${ey} H ${ex}`;
const DEPLOY6_LINES = [
  { sx: 1378, sy: 700, ey: 612 }, // board right corner → the deploying card
  { sx: 1160, sy: 856, ey: 780 }, // board lower edge → the live card
] as const;

// State 7: AI Infrastructure (built against Desktop/new-version/section-7/). The state-6 board
// shrinks/glides into place as the composition's RIGHT board (right-bottom.svg is byte-identical
// to section-7/bottom-right-server.svg — no swap needed); the main board is last-main-server.svg
// (273×170 — the complete agent board: platform + logo asterisk + green ring + circles + chips
// all baked in; it replaced the empty main-server.svg tray + a hand-drawn inline overlay once the
// user got the full export through), plus bottom-left-server.svg below and short curved
// connectors between board edges.
const AGENT7 = { w: 521, left: 763, top: 480 };
const BOARD6_TO7 = { dx: 1278 - BOARD6.left, dy: 626 - BOARD6.top, scale: 348 / BOARD6.w };
const BOTTOM7 = { w: 330, left: 1085, top: 765 };
const BADGE7 = { left: 1005, top: 320, w: 214 };
const BADGE7_LINE = { x: 1111, top: 384, height: 118 }; // badge bottom → the ring's top corner
const TERMINAL7 = { left: 1455, top: 359, w: 360 };
// short curved edge-to-edge connectors (design px), each ending in a small arrowhead
const CONNECTOR7_LINES = [
  { d: "M 1268 638 C 1282 645, 1288 636, 1300 646", ax: 1302, ay: 647, dir: "right" },
  { d: "M 1133 724 C 1140 750, 1150 762, 1165 778", ax: 1167, ay: 781, dir: "down" },
] as const;

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

export function HeroSectionClient() {
  const sectionRef = useRef<HTMLElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const secondTextRef = useRef<HTMLDivElement>(null);
  const thirdTextRef = useRef<HTMLDivElement>(null);
  const serverRef = useRef<HTMLDivElement>(null);
  const serverImgRef = useRef<HTMLImageElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const calloutBoxRef = useRef<HTMLDivElement>(null);
  const calloutsRef = useRef<HTMLDivElement>(null);
  const capPieceRef = useRef<HTMLDivElement>(null);
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
  const badge6Ref = useRef<HTMLDivElement>(null);
  const deploy6Ref = useRef<HTMLDivElement>(null);
  const seventhTextRef = useRef<HTMLDivElement>(null);
  const agent7Ref = useRef<HTMLDivElement>(null);
  const bottom7Ref = useRef<HTMLDivElement>(null);
  const badge7Ref = useRef<HTMLDivElement>(null);
  const badgeLine7Ref = useRef<HTMLDivElement>(null);
  const terminal7Ref = useRef<HTMLDivElement>(null);
  const connectors7Ref = useRef<SVGSVGElement>(null);
  const pricing8Ref = useRef<HTMLDivElement>(null);
  const final9Ref = useRef<HTMLDivElement>(null);
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
      const serverImg = serverImgRef.current;
      const glow = glowRef.current;
      const box = calloutBoxRef.current;
      const callouts = calloutsRef.current;
      const capPiece = capPieceRef.current;
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
      if (
        !section || !heroText || !secondText || !thirdText || !server || !serverImg || !glow ||
        !box || !callouts || !capPiece || !bottomPiece || !guides || !panel || !panelLine ||
        !fourthText || !machine || !machineOpen || !panel4 || !panel4Line ||
        !fifthText || !server5 || !pods ||
        !sixthText || !board6 || !terminal6 || !pushLine6 || !node6 || !badge6 || !deploy6 ||
        !seventhText || !agent7 || !bottom7 || !badge7 || !badgeLine7 ||
        !terminal7 || !connectors7 || !pricing8 || !final9
      ) {
        return;
      }

      // The server-rendered placeholder reserved the pin's scroll room so the pre-hydration page
      // height already matches; collapse it before the real pin-spacer takes over (never both).
      if (ssrReserveRef.current) ssrReserveRef.current.style.height = "0px";

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const k = () => readScale();
      const lines = Array.from(callouts.querySelectorAll<SVGPolylineElement>("polyline"));
      const labels = Array.from(callouts.querySelectorAll<HTMLElement>("[data-callout-label]"));
      const panelItems = Array.from(panel.querySelectorAll<HTMLElement>("[data-panel-item]"));
      const panel4Items = Array.from(panel4.querySelectorAll<HTMLElement>("[data-panel-item]"));
      const podLines = Array.from(pods.querySelectorAll<SVGPathElement>("[data-pod-line]"));
      const podArrows = Array.from(pods.querySelectorAll<SVGPathElement>("[data-pod-arrow]"));
      const podItems = Array.from(pods.querySelectorAll<HTMLElement>("[data-pod-item]"));
      const deployLines = Array.from(deploy6.querySelectorAll<SVGPathElement>("[data-deploy-line]"));
      const deployArrows = Array.from(deploy6.querySelectorAll<SVGPathElement>("[data-deploy-arrow]"));
      const deployItems = Array.from(deploy6.querySelectorAll<HTMLElement>("[data-deploy-item]"));
      const connectorLines = Array.from(connectors7.querySelectorAll<SVGPathElement>("[data-connector-line]"));
      const connectorArrows = Array.from(connectors7.querySelectorAll<SVGPathElement>("[data-connector-arrow]"));
      const board6Glow = board6.querySelector<HTMLElement>("[data-board-glow]");
      const pricingItems = Array.from(pricing8.querySelectorAll<HTMLElement>("[data-pricing-reveal]"));

      // Prepare line "draw" reveals: hide each polyline/path behind its own full dash offset.
      [...lines, ...podLines, ...deployLines, ...connectorLines].forEach((line) => {
        const len = line.getTotalLength();
        line.style.strokeDasharray = `${len}`;
        line.style.strokeDashoffset = `${len}`;
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
      const unfoldProxy = { p: 0 };
      const easeInOut = gsap.parseEase("power2.inOut");
      const easeOut = gsap.parseEase("power2.out");
      type Moving = { el: SVGGElement; dx: number; dy: number; win: readonly [number, number] };
      type Fading = { el: SVGGElement; win: readonly [number, number] };
      let movers: Moving[] | null = null;
      let faders: Fading[] | null = null;
      const localP = (win: readonly [number, number]) =>
        Math.min(1, Math.max(0, (unfoldProxy.p - win[0]) / (win[1] - win[0])));
      const applyUnfold = () => {
        if (!movers || !faders) return;
        for (const m of movers) {
          const e = easeInOut(localP(m.win));
          gsap.set(m.el, { x: m.dx * (1 - e), y: m.dy * (1 - e) });
        }
        for (const f of faders) {
          gsap.set(f.el, { opacity: easeOut(localP(f.win)) });
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
          const wPillars = wrapRange(svg, els, 61, 76);
          const wChips = wrapRange(svg, els, 85, 96); // JOB/QUE — covered by APPS while closed
          const aPillars = wrapRange(svg, els, 97, 112);
          // moving assemblies: WORKERS = pillars..chips, APPS = pillars..its own chips
          const gW = document.createElementNS("http://www.w3.org/2000/svg", "g");
          svg.insertBefore(gW, wPillars);
          gW.appendChild(wPillars);
          for (let i = 77; i <= 84; i++) gW.appendChild(els[i]);
          gW.appendChild(wChips);
          const gA = document.createElementNS("http://www.w3.org/2000/svg", "g");
          svg.insertBefore(gA, aPillars);
          gA.appendChild(aPillars);
          for (let i = 113; i <= 132; i++) gA.appendChild(els[i]);
          movers = [
            { el: gW, dx: 38.5, dy: 81.2, win: [0.05, 0.55] },
            { el: gA, dx: 78, dy: 163.2, win: [0.3, 0.9] },
          ];
          faders = [
            { el: wPillars, win: [0.15, 0.5] },
            { el: aPillars, win: [0.42, 0.85] },
            { el: dbChips, win: [0.35, 0.6] },
            { el: wChips, win: [0.6, 0.85] },
          ];
          // sync to wherever the scrubbed proxy already is (fresh mount = fully collapsed ≡ closed)
          applyUnfold();
        })
        .catch(() => {});

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          // The section's top always sits exactly HEADER_HEIGHT_PX below the viewport top, so the
          // pin is active from the very first scrolled pixel — nothing moves before the scene does.
          start: () => `top ${HEADER_HEIGHT_PX}px`,
          end: `+=${PIN_SCROLL_DISTANCE}`,
          scrub: true,
          pin: true,
          // Explicit on purpose: <main> is display:flex, which silently disables GSAP's automatic
          // pin spacing (documented in PROJECT.md — bit this project before).
          pinSpacing: true,
          invalidateOnRefresh: true,
        },
      });

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
          duration: 0.5,
        },
        0.05,
      );
      tl.fromTo(
        secondText,
        { y: () => 50 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        0.4,
      );
      tl.fromTo(glow, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.45);
      tl.fromTo(
        box,
        { y: () => 30 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.25 },
        0.55,
      );
      lines.forEach((line, i) => {
        tl.to(line, { strokeDashoffset: 0, ease: "none", duration: 0.18 }, 0.6 + i * 0.09);
      });
      labels.forEach((label, i) => {
        tl.fromTo(
          label,
          { x: () => 20 * k(), autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: "power2.out", duration: 0.15 },
          0.68 + i * 0.09,
        );
      });
      tl.to({}, { duration: 0.15 }); // hold at the settled state 2

      // ---- state 2 → state 3 -------------------------------------------------------------
      tl.to(secondText, { y: () => -40 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.25 }, 1.2);
      tl.to(callouts, { autoAlpha: 0, ease: "power1.in", duration: 0.2 }, 1.2);

      // The pieces appear exactly over the old server's own cap/base (invisible change), then the
      // old image fades — the middle layers read as dissolving into the bottom block.
      tl.fromTo(capPiece, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12 }, 1.28);
      tl.fromTo(bottomPiece, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12 }, 1.28);
      tl.to(serverImg, { autoAlpha: 0, duration: 0.22 }, 1.4);
      tl.to(glow, { autoAlpha: 0, duration: 0.22 }, 1.4);

      // Drift into the stacked pose.
      tl.to(capPiece, { y: () => CAP_PIECE.dy * k(), ease: "power2.inOut", duration: 0.45 }, 1.6);
      tl.to(bottomPiece, { y: () => BOTTOM_PIECE.dy * k(), ease: "power2.inOut", duration: 0.45 }, 1.6);
      tl.fromTo(guides, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 2.02);

      tl.fromTo(
        thirdText,
        { y: () => 50 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        1.8,
      );
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
      tl.to(capPiece, { y: () => (CAP_PIECE.dy - 40) * k(), autoAlpha: 0, ease: "power2.in", duration: 0.25 }, 2.4);
      tl.to(bottomPiece, { y: () => (BOTTOM_PIECE.dy + 30) * k(), autoAlpha: 0, ease: "power2.in", duration: 0.25 }, 2.4);

      // the closed Machine arrives...
      tl.fromTo(
        machine,
        { y: () => 70 * k(), scale: 0.92, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, ease: "power2.out", duration: 0.35 },
        2.65,
      );
      // ...settles closed for a beat, then the SAME svg unfolds: the assemblies rise from their
      // collapse offsets to their natural positions, pillars/covered chips fading in as they go —
      // scrubbed 1:1 with scroll via the proxy above. No image swap anywhere.
      tl.to(unfoldProxy, { p: 1, ease: "none", duration: 1.0, onUpdate: applyUnfold }, 3.1);

      tl.fromTo(
        fourthText,
        { y: () => 50 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        2.85,
      );
      tl.fromTo(
        panel4Line,
        { scaleY: 0, autoAlpha: 0, transformOrigin: "50% 0%" },
        { scaleY: 1, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        3.75,
      );
      panel4Items.forEach((item, i) => {
        tl.fromTo(
          item,
          { x: () => 24 * k(), autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: "power2.out", duration: 0.2 },
          3.8 + i * 0.08,
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
        { y: 0, scale: 1, autoAlpha: 1, ease: "power2.out", duration: 0.35 },
        4.85,
      );
      tl.fromTo(
        fifthText,
        { y: () => 50 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        4.95,
      );
      podLines.forEach((line, i) => {
        tl.to(line, { strokeDashoffset: 0, ease: "none", duration: 0.18 }, 5.15 + i * 0.16);
      });
      podArrows.forEach((arrow, i) => {
        tl.fromTo(arrow, { opacity: 0 }, { opacity: 1, duration: 0.08 }, 5.3 + i * 0.16);
      });
      podItems.forEach((item, i) => {
        tl.fromTo(
          item,
          { x: () => 20 * k(), autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: "power2.out", duration: 0.18 },
          5.32 + i * 0.16,
        );
      });
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
        { y: 0, scale: 1, autoAlpha: 1, ease: "power2.out", duration: 0.35 },
        6.5,
      );
      tl.fromTo(
        sixthText,
        { y: () => 50 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        6.6,
      );
      tl.fromTo(
        terminal6,
        { y: () => -40 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        6.95,
      );
      tl.fromTo(
        pushLine6,
        { scaleY: 0, autoAlpha: 0, transformOrigin: "50% 0%" },
        { scaleY: 1, autoAlpha: 1, ease: "none", duration: 0.25 },
        7.3,
      );
      tl.fromTo(
        node6,
        { scale: 0.4, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, ease: "power2.out", duration: 0.12 },
        7.55,
      );
      tl.fromTo(
        badge6,
        { y: () => 16 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.2 },
        7.7,
      );
      deployLines.forEach((line, i) => {
        tl.to(line, { strokeDashoffset: 0, ease: "none", duration: 0.2 }, 7.95 + i * 0.3);
      });
      deployArrows.forEach((arrow, i) => {
        tl.fromTo(arrow, { opacity: 0 }, { opacity: 1, duration: 0.08 }, 8.15 + i * 0.3);
      });
      deployItems.forEach((item, i) => {
        tl.fromTo(
          item,
          { x: () => 20 * k(), autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: "power2.out", duration: 0.18 },
          8.17 + i * 0.3,
        );
      });
      tl.to({}, { duration: 0.3 }); // hold at the settled state 6

      // ---- state 6 → state 7 -------------------------------------------------------------
      tl.to(sixthText, { y: () => -40 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.25 }, 9.0);
      tl.to(deploy6, { autoAlpha: 0, ease: "power1.in", duration: 0.2 }, 9.0);
      tl.to([badge6, terminal6, pushLine6, node6], { autoAlpha: 0, ease: "power1.in", duration: 0.2 }, 9.0);

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
          duration: 0.5,
        },
        9.05,
      );
      if (board6Glow) tl.to(board6Glow, { autoAlpha: 0, duration: 0.25 }, 9.05);

      tl.fromTo(
        seventhText,
        { y: () => 50 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        9.15,
      );
      tl.fromTo(
        agent7,
        { y: () => 60 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.35 },
        9.2,
      );
      tl.fromTo(
        bottom7,
        { y: () => 50 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        9.5,
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
      tl.fromTo(
        badgeLine7,
        { scaleY: 0, autoAlpha: 0, transformOrigin: "50% 0%" },
        { scaleY: 1, autoAlpha: 1, ease: "none", duration: 0.15 },
        10.55,
      );
      tl.fromTo(
        terminal7,
        { y: () => -40 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
        10.75,
      );
      tl.to({}, { duration: 0.3 }); // hold at the settled state 7

      // ---- state 7 → state 8 -------------------------------------------------------------
      tl.to(seventhText, { y: () => -40 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.25 }, 11.45);
      tl.to([badge7, badgeLine7, terminal7, connectors7], { autoAlpha: 0, ease: "power1.in", duration: 0.2 }, 11.45);
      tl.to(agent7, { y: () => 50 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.3 }, 11.5);
      tl.to(bottom7, { y: () => 40 * k(), autoAlpha: 0, ease: "power2.in", duration: 0.3 }, 11.5);
      tl.to(board6, { autoAlpha: 0, ease: "power1.in", duration: 0.25 }, 11.5);

      pricingItems.forEach((item, i) => {
        tl.fromTo(
          item,
          { y: () => 50 * k(), autoAlpha: 0 },
          { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.3 },
          11.85 + i * 0.1,
        );
      });
      tl.to({}, { duration: 0.3 }); // hold at the settled state 8

      // ---- state 8 → state 9 -------------------------------------------------------------
      tl.to(pricing8, { autoAlpha: 0, ease: "power1.in", duration: 0.25 }, 12.9);
      tl.fromTo(
        final9,
        { y: () => 50 * k(), autoAlpha: 0 },
        { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.35 },
        13.2,
      );
      tl.to({}, { duration: 0.35 }); // hold at the settled state 9 before the pin releases
    },
    { scope: sectionRef },
  );

  return (
    // 980 (was 940): the state-7 bottom board reaches y≈974 — still under the 984px the
    // viewport offers below the 96px header at 1920×1080
    <section ref={sectionRef} className="relative overflow-hidden" style={{ minHeight: s(980) }}>
      {/* vertical ruler bar left of the text (public/navigation-bar/navigation-bar.png, 35×913
          native — green ticks at its top). Static: present in every state. */}
      <Image
        src="/navigation-bar/navigation-bar.png"
        alt=""
        width={35}
        height={913}
        aria-hidden="true"
        className="absolute"
        // unoptimized: the optimizer's resample+recompress wipes out this asset's 1px
        // low-opacity ruler ticks entirely — serve the raw PNG instead.
        unoptimized
        style={{ left: s(99), top: s(48), width: s(30), height: s(782) }}
      />

      {/* state 1 — hero text column */}
      <div ref={heroTextRef} className="absolute" style={{ left: s(187), top: s(216), width: s(1180) }}>
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

        <div className="flex items-center" style={{ gap: s(30), marginTop: s(34) }}>
          <Link
            href="#start"
            className="flex items-center justify-center rounded-full border border-white/25 font-heading font-semibold text-foreground transition-colors hover:bg-white/5"
            style={{ height: s(48), paddingLeft: s(32), paddingRight: s(32), fontSize: s(16) }}
          >
            Start Building
          </Link>
          <Link
            href="#how"
            className="flex items-center justify-center rounded-full border border-white/25 font-heading font-normal text-white/90 transition-colors hover:bg-white/5"
            style={{ height: s(48), paddingLeft: s(32), paddingRight: s(32), fontSize: s(16), gap: s(8) }}
          >
            See how it works <span aria-hidden="true">&#8599;</span>
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
        <Image
          ref={serverImgRef}
          src="/section-hero/new-server.svg"
          alt=""
          width={SERVER_NATIVE.w}
          height={SERVER_NATIVE.h}
          priority
          style={{ width: "100%", height: "auto", position: "relative" }}
        />
      </div>

      {/* state 3 — the two stack pieces, born pixel-aligned over the old server's cap/base */}
      <div
        ref={capPieceRef}
        aria-hidden="true"
        className="absolute"
        style={{ left: s(CAP_PIECE.left), top: s(CAP_PIECE.top), width: s(CAP_PIECE.w), opacity: 0, visibility: "hidden" }}
      >
        <Image
          src="/stack-section/top-server-piece.svg"
          alt=""
          width={CAP_PIECE.w}
          height={CAP_PIECE.h}
          style={{ width: "100%", height: "auto" }}
        />
      </div>
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
        {/* the stacked pose's own, stronger ground glow */}
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: s(-24),
            width: "150%",
            height: s(150),
            background: "radial-gradient(ellipse at center, rgba(17,163,42,0.45) 0%, rgba(17,163,42,0) 70%)",
            filter: `blur(${s(12)})`,
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
          className="absolute left-0 top-0"
          style={{ width: s(1920), height: s(940) }}
          viewBox="0 0 1920 940"
          fill="none"
        >
          {CALLOUT_LINES.map((points) => (
            <polyline key={points} points={points} stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
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
            top: s(395),
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
          style={{ left: s(1346), top: s(408), fontSize: s(15), letterSpacing: "0.04em", opacity: 0, visibility: "hidden" }}
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
            left: s(1322),
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
          style={{ left: s(1346), top: s(360), fontSize: s(15), letterSpacing: "0.04em", opacity: 0, visibility: "hidden" }}
        >
          USECTL MANAGED INFRASTRUCTURE
        </p>
        {PANEL4_ITEMS.map((item) => (
          <div
            key={item.no}
            data-panel-item
            className="absolute font-mono"
            style={{ left: s(1346), top: s(item.y), width: s(420), opacity: 0, visibility: "hidden" }}
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
        <Image
          src="/section-5/server2.svg"
          alt=""
          width={689}
          height={1007}
          className="absolute left-0"
          style={{ top: s(SERVER5.imgDy), width: "100%", height: "auto" }}
        />
      </div>

      {/* state 5 — pod status callouts with elbow arrows */}
      <div ref={podsRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
        <svg
          className="absolute left-0 top-0"
          style={{ width: s(1920), height: s(940) }}
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
              {pod.status}
            </p>
            {pod.deploying && (
              <div
                className="overflow-hidden rounded-full"
                style={{ width: s(150), height: s(6), marginTop: s(10), background: "rgba(255,255,255,0.15)" }}
              >
                <div className="h-full rounded-full bg-brand" style={{ width: "80%" }} />
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
            bottom: s(-30),
            width: "115%",
            height: s(140),
            background: "radial-gradient(ellipse at center, rgba(17,163,42,0.3) 0%, rgba(17,163,42,0) 70%)",
            filter: `blur(${s(12)})`,
          }}
        />
        <Image
          src="/section-6/right-bottom.svg"
          alt=""
          width={348}
          height={220}
          style={{ width: "100%", height: "auto", position: "relative" }}
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
          <p className="text-white/85">
            <span className="text-brand">&gt;</span> git push origin main
          </p>
          <p className="text-white/85">
            <span
              className="inline-block rounded-full align-middle"
              style={{ width: s(8), height: s(8), marginRight: s(6), background: "#11a32a" }}
            />
            Code push detected:<span className="text-brand">commit-a7f3d</span>
          </p>
          <p className="text-white/85">
            <span className="text-brand">&lt;</span> Automatic build triggered{" "}
            <span
              className="inline-block align-middle"
              style={{ width: s(7), height: s(14), background: "#11a32a" }}
            />
          </p>
        </div>
      </div>

      {/* state 6 — the push line + the node it lands on */}
      <div
        ref={pushLine6Ref}
        aria-hidden="true"
        className="absolute"
        style={{
          left: s(PUSH_LINE6.x - 1),
          top: s(PUSH_LINE6.top),
          width: 2,
          height: s(PUSH_LINE6.height),
          background: "rgba(17,163,42,0.8)",
          boxShadow: "0 0 6px rgba(17,163,42,0.5)",
          opacity: 0,
          visibility: "hidden",
        }}
      />
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
          boxShadow: "0 0 10px rgba(17,163,42,0.55)",
          opacity: 0,
          visibility: "hidden",
        }}
      />

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
          className="absolute left-0 top-0"
          style={{ width: s(1920), height: s(940) }}
          viewBox="0 0 1920 940"
          fill="none"
        >
          {DEPLOY6_LINES.map((l) => (
            <path
              key={l.sy}
              data-deploy-line
              d={deployElbow(l.sx, l.sy, DEPLOY6_X - 5, l.ey)}
              stroke="rgba(255,255,255,0.17)"
              strokeWidth="1.5"
            />
          ))}
          {DEPLOY6_LINES.map((l) => (
            <path
              key={`${l.sy}-arrow`}
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
            top: s(580),
            width: s(268),
            padding: `${s(16)} ${s(18)}`,
            borderRadius: s(3),
            border: "1px solid rgba(255,255,255,0.16)",
            opacity: 0,
            visibility: "hidden",
          }}
        >
          <p className="flex items-center text-brand" style={{ gap: s(10), fontSize: s(16.5) }}>
            <span
              className="inline-block"
              style={{
                width: s(6),
                height: s(16),
                borderRadius: s(2),
                background: "linear-gradient(180deg, #35e05b 0%, #3b82f6 100%)",
              }}
            />
            [ POD // API ]
          </p>
          <p
            className="flex items-center text-white/85"
            style={{ fontSize: s(14), marginTop: s(12), marginLeft: s(16), gap: s(8) }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: s(8), height: s(8), border: "1px solid #11a32a" }}
            />
            DEPLOYING ... v2.1.0
          </p>
          <div className="flex items-center" style={{ marginTop: s(10), marginLeft: s(16), gap: s(10) }}>
            <div
              className="overflow-hidden rounded-full"
              style={{ width: s(182), height: s(7), background: "rgba(255,255,255,0.18)" }}
            >
              <div className="h-full rounded-full bg-brand" style={{ width: "64%" }} />
            </div>
            <span className="whitespace-nowrap text-white/60" style={{ fontSize: s(13) }}>
              64&nbsp;%
            </span>
          </div>
        </div>

        {/* [ ✓ LIVE // v2.1.0 ] */}
        <div
          data-deploy-item
          className="absolute font-heading"
          style={{
            left: s(DEPLOY6_X),
            top: s(749),
            width: s(268),
            padding: `${s(16)} ${s(18)}`,
            borderRadius: s(3),
            border: "1px solid rgba(255,255,255,0.16)",
            opacity: 0,
            visibility: "hidden",
          }}
        >
          <p className="flex items-center text-brand" style={{ gap: s(10), fontSize: s(16.5) }}>
            <span
              className="inline-block"
              style={{
                width: s(6),
                height: s(16),
                borderRadius: s(2),
                background: "linear-gradient(180deg, #35e05b 0%, #3b82f6 100%)",
              }}
            />
            [ &#10003; LIVE // v2.1.0 ]
          </p>
          <p
            className="flex items-center text-white/85"
            style={{ fontSize: s(14), marginTop: s(12), marginLeft: s(16), gap: s(9) }}
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
            bottom: s(-26),
            width: "110%",
            height: s(120),
            background: "radial-gradient(ellipse at center, rgba(17,163,42,0.25) 0%, rgba(17,163,42,0) 70%)",
            filter: `blur(${s(12)})`,
          }}
        />
        <Image
          src="/section-7/last-main-server.svg"
          alt=""
          width={273}
          height={170}
          style={{ width: "100%", height: "auto", position: "relative" }}
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
        <Image
          src="/section-7/bottom-left-server.svg"
          alt=""
          width={348}
          height={220}
          style={{ width: "100%", height: "auto" }}
        />
      </div>

      {/* state 7 — curved edge-to-edge connectors between the boards */}
      <svg
        ref={connectors7Ref}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0"
        style={{ width: s(1920), height: s(940) }}
        viewBox="0 0 1920 940"
        fill="none"
      >
        {CONNECTOR7_LINES.map((l) => (
          <path key={l.d} data-connector-line d={l.d} stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
        ))}
        {CONNECTOR7_LINES.map((l) => (
          <path
            key={`${l.d}-arrow`}
            data-connector-arrow
            d={
              l.dir === "right"
                ? `M ${l.ax} ${l.ay - 4} L ${l.ax + 8} ${l.ay + 1} L ${l.ax - 1} ${l.ay + 5} Z`
                : `M ${l.ax - 5} ${l.ay - 1} L ${l.ax + 3} ${l.ay - 3} L ${l.ax + 1} ${l.ay + 7} Z`
            }
            fill="rgba(255,255,255,0.2)"
            opacity="0"
          />
        ))}
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
      <div
        ref={badgeLine7Ref}
        aria-hidden="true"
        className="absolute"
        style={{
          left: s(BADGE7_LINE.x - 1),
          top: s(BADGE7_LINE.top),
          width: 2,
          height: s(BADGE7_LINE.height),
          background: "rgba(17,163,42,0.55)",
          opacity: 0,
          visibility: "hidden",
        }}
      />

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
        <div className="font-mono" style={{ padding: `${s(12)} ${s(16)} ${s(16)}`, fontSize: s(11), lineHeight: 2.2 }}>
          <p className="text-white/85">
            <span className="text-brand">&gt;</span> usectl agent attach --role coding-assistant
          </p>
          <p className="text-white/85">
            <span
              className="inline-block rounded-full align-middle"
              style={{ width: s(8), height: s(8), marginRight: s(6), background: "#11a32a" }}
            />
            Executing updates &amp; inspecting logs ...
          </p>
          <p className="text-white/85">
            <span className="text-brand">&lt;</span> Status: Synchronized with machine env-prod-01
          </p>
        </div>
      </div>

      {/* state 8 — the pricing calculator (interactive: NO pointer-events-none on purpose;
          the hidden visibility of each block keeps it inert until the state arrives) */}
      <div ref={pricing8Ref} className="absolute inset-0">
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
            top: s(253),
            width: s(492),
            height: s(567),
            borderRadius: s(16),
            border: "1px solid rgba(255,255,255,0.08)",
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(17,163,42,0.05) 40%, rgba(255,255,255,0.02) 100%)",
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
            <button
              type="button"
              role="switch"
              aria-checked={annual}
              aria-label="Bill annually"
              onClick={() => setAnnual((a) => !a)}
              className="relative rounded-full"
              style={{ width: s(44), height: s(24), background: "rgba(255,255,255,0.15)" }}
            >
              <span
                className="absolute rounded-md bg-brand transition-transform duration-200"
                style={{
                  top: s(3),
                  left: s(3),
                  width: s(18),
                  height: s(18),
                  transform: annual ? `translateX(${s(20)})` : "translateX(0)",
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
                    className="flex items-center justify-center rounded-md border border-white/20 text-white/70 transition-colors enabled:hover:bg-white/5 disabled:opacity-40"
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
                    className="flex items-center justify-center rounded-md border border-white/20 text-white/70 transition-colors enabled:hover:bg-white/5 disabled:opacity-40"
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
        {/* soft green glow hugging the right edge */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            right: s(-160),
            top: s(140),
            width: s(700),
            height: s(560),
            background: "radial-gradient(ellipse at center, rgba(17,163,42,0.14) 0%, rgba(17,163,42,0) 65%)",
            filter: `blur(${s(20)})`,
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
        <div className="absolute flex items-center" style={{ left: s(187), top: s(618), gap: s(30) }}>
          <Link
            href="#start"
            className="flex items-center justify-center rounded-full border border-white/25 font-heading font-semibold text-foreground transition-colors hover:bg-white/5"
            style={{ height: s(48), paddingLeft: s(32), paddingRight: s(32), fontSize: s(16) }}
          >
            Start Building
          </Link>
          <Link
            href="#how"
            className="flex items-center justify-center rounded-full border border-white/25 font-heading font-normal text-white/90 transition-colors hover:bg-white/5"
            style={{ height: s(48), paddingLeft: s(32), paddingRight: s(32), fontSize: s(16), gap: s(8) }}
          >
            See how it works <span aria-hidden="true">&#8599;</span>
          </Link>
        </div>
      </div>

      {/* green corner ticks on the grid intersection, bottom-left (see design-ref) */}
      <div aria-hidden="true">
        <div className="absolute bg-brand" style={{ left: s(99), top: s(912), width: s(35), height: 2 }} />
        <div className="absolute bg-brand/70" style={{ left: s(100), top: s(928), width: s(13), height: 2 }} />
      </div>

      {/* SSR scroll reserve for the pin — collapsed the moment the real pin-spacer exists */}
      <div ref={ssrReserveRef} aria-hidden="true" style={{ height: PIN_SCROLL_DISTANCE }} />
    </section>
  );
}
