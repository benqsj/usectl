import gsap from "gsap";

// The Machine unfold for the stacked (< 1024px) version — the SAME mechanism as the desktop scene
// (HeroSectionClient, "the Machine's real unfold"; see PROJECT.md): ONE inline opened.svg plays
// both states. It mounts with WORKERS / APPLICATION SERVICES pushed down by the exact offsets that
// make it pixel-equivalent to closed.svg, then the platforms rise back, the covered chips fade in,
// and the legs slide down out of each platform's underside. Kept as a copy (not imported from the
// desktop file) so the desktop scene stays untouched; if the desktop version changes, mirror it.

const SVG_NS = "http://www.w3.org/2000/svg";
const easeInOut = gsap.parseEase("power2.inOut");
const easeOut = gsap.parseEase("power2.out");
const easeLeg = gsap.parseEase("power3.out");
const SETTLE_WIN = [0.8, 0.97] as const;
const SETTLE_DY = 1.5;

type Win = readonly [number, number];

export async function mountMachine(host: HTMLElement, idPrefix: string): Promise<(p: number) => void> {
  const text = await (await fetch("/machine-section/opened.svg")).text();
  host.innerHTML = text;
  const svg = host.querySelector("svg");
  if (!svg) return () => {};
  svg.setAttribute("width", "100%");
  svg.removeAttribute("height");
  (svg as unknown as HTMLElement).style.display = "block";
  const els = Array.from(svg.children).filter((el) => el.tagName !== "defs");

  const wrapRange = (from: number, to: number) => {
    const g = document.createElementNS(SVG_NS, "g");
    (els[from].parentNode as Node).insertBefore(g, els[from]);
    for (let i = from; i <= to; i++) g.appendChild(els[i]);
    return g;
  };
  const dbChips = wrapRange(49, 60);
  const wChips = wrapRange(85, 96);

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
    cp.id = `${idPrefix}-leg-${from}`;
    const r = document.createElementNS(SVG_NS, "rect");
    r.setAttribute("x", `${bb.x - 3}`);
    r.setAttribute("y", `${bb.y - 2}`);
    r.setAttribute("width", `${bb.width + 6}`);
    r.setAttribute("height", `${bb.height + 6}`);
    cp.appendChild(r);
    legDefs.appendChild(cp);
    const clip = `url(#${cp.id})`;
    outer.setAttribute("clip-path", clip);
    return { outer, inner, clip, h: bb.height, x: bb.x };
  };
  const wLegs = [61, 65, 69, 73].map(makeLeg);
  const aLegs = [97, 101, 105, 109].map(makeLeg);

  const gW = document.createElementNS(SVG_NS, "g");
  svg.insertBefore(gW, wLegs[0].outer);
  wLegs.forEach((l) => gW.appendChild(l.outer));
  for (let i = 77; i <= 84; i++) gW.appendChild(els[i]);
  gW.appendChild(wChips);
  const gA = document.createElementNS(SVG_NS, "g");
  svg.insertBefore(gA, aLegs[0].outer);
  aLegs.forEach((l) => gA.appendChild(l.outer));
  for (let i = 113; i <= 132; i++) gA.appendChild(els[i]);

  const movers = [
    { el: gW, dx: 38.5, dy: 81.2, win: [0.03, 0.55] as Win },
    { el: gA, dx: 78, dy: 163.2, win: [0.03, 0.55] as Win },
  ];
  const faders = [
    { el: dbChips, win: [0.35, 0.55] as Win },
    { el: wChips, win: [0.35, 0.55] as Win },
  ];
  const legs = [wLegs, aLegs].flatMap((set) =>
    [...set]
      .sort((a, b) => a.x - b.x)
      .map((l, i) => {
        const start = 0.6 + (i % 2) * 0.03 + Math.floor(i / 2) * 0.08;
        return { ...l, win: [start, start + 0.25] as Win };
      }),
  );

  const apply = (p: number) => {
    const localP = (w: Win) => Math.min(1, Math.max(0, (p - w[0]) / (w[1] - w[0])));
    const sp = localP(SETTLE_WIN);
    const settle = sp > 0 && sp < 1 ? SETTLE_DY * Math.sin(Math.PI * sp) : 0;
    for (const m of movers) {
      const e = easeInOut(localP(m.win));
      gsap.set(m.el, { x: m.dx * (1 - e), y: m.dy * (1 - e) + settle });
    }
    for (const f of faders) gsap.set(f.el, { opacity: easeOut(localP(f.win)) });
    for (const l of legs) {
      const lp = localP(l.win);
      gsap.set(l.inner, { y: -(l.h + 10) * (1 - easeLeg(lp)) });
      if (lp >= 1) l.outer.removeAttribute("clip-path");
      else l.outer.setAttribute("clip-path", l.clip);
    }
  };
  apply(0);
  return apply;
}
