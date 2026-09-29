"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { mountMachine } from "./machineUnfold";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// PHONE + PORTRAIT-TABLET version of the hero scene (< 1024px) — model "B" from RESPONSIVE-PLAN.md: the nine desktop
// states become ordinary sections stacked one under another, native scroll, and each section plays
// its OWN entrance when it scrolls into view (and rewinds when scrolled back above it). The desktop
// pinned scene (HeroSectionClient) is not built at all on phones — see its early return.
// Sizes are design px at a 390-wide phone, via m(): `calc(var(--m) * px)`, where --m (set on the
// root below) is 100vw/390, capped so a 430 phone doesn't blow everything up.

export const m = (px: number) => `calc(var(--m) * ${px})`;

const PRICING_ROWS = [
  { key: "vcpu", label: "vCPU", sub: "1 vCPU — $10.00/mo · Max 16", price: 10, max: 16 },
  { key: "memory", label: "Memory", sub: "1 GB — $5.00/mo · Max 64GB", price: 5, max: 64 },
  { key: "storage", label: "Storage", sub: "1 GB — $0.10/mo · Max 1TB", price: 0.1, max: 1000 },
] as const;
type RowKey = (typeof PRICING_ROWS)[number]["key"];
const fmtPrice = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

// the desktop pills (HeroSectionClient): white/25 outline, brand green border + label on hover —
// and on press, since phones have no hover
const PILL =
  "flex items-center justify-center rounded-full border border-white/25 font-heading text-foreground transition-colors " +
  "hover:border-brand hover:text-brand active:border-brand active:text-brand";

// the team's public/button/button-arrow/button-arrow.svg, inlined (currentColor → turns green with
// the label), exactly as the desktop "See how it works" button draws it
function ButtonArrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" style={{ width: m(20), height: m(20), flexShrink: 0 }}>
      <path d="M8 16L16 8M16 14L16 8L10 8" stroke="currentColor" strokeOpacity={0.7} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// pricing +/− — same classes and press ripple (.press-ripple in globals.css) as the desktop panel
const STEP_BTN_CLASS =
  "relative flex items-center justify-center overflow-hidden rounded-md border border-white/20 text-white/70 " +
  "transition-[color,border-color,background-color,box-shadow,transform] duration-200 " +
  "enabled:hover:border-[#35c957] enabled:hover:bg-[rgba(17,163,42,0.1)] enabled:hover:text-[#7cf09a] " +
  "enabled:hover:shadow-[0_0_12px_rgba(53,201,87,0.25)] enabled:active:scale-[0.92] disabled:opacity-40";
function pressRipple(e: ReactPointerEvent<HTMLButtonElement>) {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  const r = btn.getBoundingClientRect();
  const size = 2 * Math.hypot(Math.max(e.clientX - r.left, r.right - e.clientX), Math.max(e.clientY - r.top, r.bottom - e.clientY));
  const dot = document.createElement("span");
  dot.className = "press-ripple";
  dot.style.left = `${e.clientX - r.left}px`;
  dot.style.top = `${e.clientY - r.top}px`;
  dot.style.width = dot.style.height = `${size}px`;
  dot.addEventListener("animationend", () => dot.remove(), { once: true });
  btn.appendChild(dot);
}

const GRADIENT_BORDER = (deg: number) =>
  `linear-gradient(#1e1d1d, #1e1d1d) padding-box, linear-gradient(${deg}deg, rgba(17,163,42,0.9), rgba(59,130,246,0.85)) border-box`;

// pods svg: top-level child index where each slab starts (top, middle, bottom) — same split the
// desktop float uses (PODS_SLAB_STARTS in HeroSectionClient)
const PODS_SLAB_STARTS = [112, 58, 0] as const;

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p data-m-copy className="flex items-center font-heading font-light text-white/60" style={{ gap: m(9), fontSize: m(12) }}>
      <Image src="/section-hero/hatch.svg" alt="" width={36} height={12} aria-hidden="true" style={{ width: m(22), height: "auto" }} />
      {children}
    </p>
  );
}

function Heading({ children, as: Tag = "h2" }: { children: ReactNode; as?: "h1" | "h2" }) {
  return (
    <Tag
      data-m-copy
      className="font-heading font-medium text-white"
      style={{ fontSize: m(28), lineHeight: 1.18, letterSpacing: "-0.02em", marginTop: m(12) }}
    >
      {children}
    </Tag>
  );
}

function Para({ children }: { children: ReactNode }) {
  return (
    <p data-m-copy className="font-heading font-light text-white/65" style={{ fontSize: m(14), lineHeight: 1.5, marginTop: m(14) }}>
      {children}
    </p>
  );
}

function Buttons() {
  return (
    <div data-m-copy className="flex flex-wrap items-center" style={{ gap: m(10), marginTop: m(22) }}>
      <Link href="#start" className={`${PILL} font-semibold`} style={{ height: m(42), paddingInline: m(22), fontSize: m(13.5) }}>
        Start Building
      </Link>
      <Link
        href="#how"
        className={`${PILL} font-normal text-white/90`}
        style={{ height: m(42), paddingLeft: m(22), paddingRight: m(17), fontSize: m(13.5), gap: m(3) }}
      >
        See how it works <ButtonArrow />
      </Link>
    </div>
  );
}

// the numbered mono panel (states 3 and 4 on desktop)
function Panel({ items }: { items: readonly { no: string; title: string; desc: string }[] }) {
  return (
    <div data-m-panel className="relative font-mono" style={{ marginTop: m(36), paddingLeft: m(20) }}>
      <span
        data-m-panel-line
        aria-hidden="true"
        className="absolute left-0 top-0 h-full"
        style={{ width: 2, background: "linear-gradient(180deg, #11a32a 0%, #3b82f6 100%)", transformOrigin: "top" }}
      />
      <p data-m-panel-item className="text-white/50" style={{ fontSize: m(11), letterSpacing: "0.08em" }}>
        USECTL MANAGED INFRASTRUCTURE
      </p>
      {items.map((it) => (
        <div data-m-panel-item key={it.no} style={{ marginTop: m(18) }}>
          <p className="text-white/90" style={{ fontSize: m(13.5) }}>
            <span className="text-brand">{it.no}</span> {it.title}
          </p>
          <p className="text-white/45" style={{ fontSize: m(12), lineHeight: 1.5, marginTop: m(5) }}>
            {it.desc}
          </p>
        </div>
      ))}
    </div>
  );
}

function Terminal({ rows, dataKey }: { rows: { lead: string; parts: { t: string; brand?: boolean }[]; dot?: boolean }[]; dataKey: string }) {
  return (
    <div
      data-m-terminal={dataKey}
      className="overflow-hidden"
      style={{ borderRadius: m(8), border: "1px solid rgba(255,255,255,0.14)", background: "rgba(30,29,29,0.92)" }}
    >
      <div className="flex items-center" style={{ gap: m(5), padding: `${m(9)} ${m(12)}`, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded-full bg-white/25" style={{ width: m(7), height: m(7) }} />
        ))}
        <span className="font-heading font-light text-white/60" style={{ fontSize: m(11.5), marginLeft: m(6) }}>
          usectl // repository-pipeline
        </span>
      </div>
      <div className="font-mono" style={{ padding: `${m(10)} ${m(12)} ${m(12)}`, fontSize: m(11), lineHeight: 2.1 }}>
        {rows.map((r, i) => (
          <p key={i} className="whitespace-nowrap text-white/85">
            {r.dot ? (
              <span className="inline-block rounded-full bg-brand align-middle" style={{ width: m(6), height: m(6), marginRight: m(8) }} />
            ) : (
              <span className="text-brand">{r.lead} </span>
            )}
            {r.parts.map((p, j) => (
              <span key={j} data-m-type={p.t} className={p.brand ? "text-brand" : undefined}>
                {p.t}
                {j < r.parts.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}

export function HeroMobile({
  serverSvg,
  podsSvg,
  agentSvg,
  rightBoardSvg,
}: {
  serverSvg: string;
  podsSvg: string;
  agentSvg: string;
  rightBoardSvg: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [counts, setCounts] = useState<Record<RowKey, number>>({ vcpu: 1, memory: 1, storage: 1 });
  const [annual, setAnnual] = useState(false);
  const factor = annual ? 12 : 1;
  const suffix = annual ? "/yr" : "/mo";
  const total = (10 * counts.vcpu + 5 * counts.memory + 0.1 * counts.storage) * factor;
  const step = (key: RowKey, d: number, max: number) =>
    setCounts((c) => ({ ...c, [key]: Math.min(max, Math.max(1, c[key] + d)) }));

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      // crossing the 768 breakpoint swaps between two different builds — simplest correct answer
      // for a preview is a reload (only happens when resizing a desktop window / rotating a tablet)
      const mq = window.matchMedia("(max-width: 1023px)");
      const onChange = () => window.location.reload();
      mq.addEventListener("change", onChange);
      if (!mq.matches) return () => mq.removeEventListener("change", onChange);

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-m-section]"));
      if (reduced) {
        gsap.set(root.querySelectorAll("[data-m-hidden]"), { autoAlpha: 1 });
        return () => mq.removeEventListener("change", onChange);
      }

      // --- shared pieces -------------------------------------------------------------------
      const copyIn = (tl: gsap.core.Timeline, section: HTMLElement, at = 0) => {
        const copy = section.querySelectorAll("[data-m-copy]");
        tl.fromTo(
          copy,
          { autoAlpha: 0, y: 16, filter: "blur(8px)" },
          { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out", stagger: 0.09 },
          at,
        );
      };
      const panelIn = (tl: gsap.core.Timeline, section: HTMLElement, at: number | string) => {
        const line = section.querySelector("[data-m-panel-line]");
        const items = section.querySelectorAll("[data-m-panel-item]");
        if (!line) return;
        tl.fromTo(line, { scaleY: 0 }, { scaleY: 1, duration: 0.7, ease: "power2.out" }, at);
        tl.fromTo(items, { autoAlpha: 0, x: 12 }, { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.1, ease: "power2.out" }, "<0.15");
      };
      // types every [data-m-type] span of a terminal, row by row
      const typeIn = (tl: gsap.core.Timeline, term: Element | null, at: number | string, cps = 38) => {
        if (!term) return;
        const spans = Array.from(term.querySelectorAll<HTMLElement>("[data-m-type]"));
        spans.forEach((sp, i) => {
          const full = sp.dataset.mType ?? "";
          const sep = sp.textContent?.endsWith(" ") ? " " : "";
          const p = { n: 0 };
          sp.textContent = "";
          tl.to(
            p,
            {
              n: full.length,
              duration: Math.max(0.15, full.length / cps),
              ease: "none",
              onUpdate: () => {
                const n = Math.round(p.n);
                sp.textContent = full.slice(0, n) + (n === full.length ? sep : "");
              },
            },
            i === 0 ? at : ">0.05",
          );
        });
      };
      const counter = (tl: gsap.core.Timeline, el: Element | null, bar: Element | null, to: number, at: number | string) => {
        if (!el || !bar) return;
        const p = { v: 0 };
        tl.fromTo(bar, { scaleX: 0 }, { scaleX: to / 100, duration: 1.2, ease: "power1.inOut" }, at);
        tl.to(p, { v: to, duration: 1.2, ease: "power1.inOut", onUpdate: () => (el.textContent = String(Math.round(p.v))) }, "<");
      };
      const onEnter = (section: HTMLElement, start = "top 70%") =>
        gsap.timeline({
          paused: true,
          scrollTrigger: { trigger: section, start, toggleActions: "play none none reverse" },
        });

      const [s1, s2, s3, s4, s5, s6, s7, s8, s9] = sections;

      // 1. Hero — plays on load
      {
        gsap.set(s1, { visibility: "visible" });
        const tl = gsap.timeline({ delay: 0.15 });
        copyIn(tl, s1);
        tl.fromTo(s1.querySelector("[data-m-server]"), { autoAlpha: 0, y: 40, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 1.1, ease: "power3.out" }, 0.35);
        tl.add(() => s1.querySelector("[data-m-server]")?.classList.add("m-float"));
      }

      // 2. Infrastructure Freedom — stat card, then the three layer labels wire in
      {
        const tl = onEnter(s2);
        copyIn(tl, s2);
        tl.fromTo(s2.querySelector("[data-m-stat]"), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" }, 0.3);
        s2.querySelectorAll("[data-m-label]").forEach((row, i) => {
          const line = row.querySelector("path");
          const len = line?.getTotalLength() ?? 60;
          if (line) gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
          tl.fromTo(row.querySelector("[data-m-dot]"), { scale: 0 }, { scale: 1, duration: 0.3, ease: "back.out(3)" }, 0.6 + i * 0.22);
          if (line) tl.to(line, { strokeDashoffset: 0, duration: 0.45, ease: "power2.out" }, "<0.1");
          tl.fromTo(row.querySelector("[data-m-label-text]"), { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 0.4 }, "<0.25");
        });
      }

      // 3. Your Stacks — the two pieces start docked and pull apart, guides draw between them
      {
        const tl = onEnter(s3);
        copyIn(tl, s3);
        const top = s3.querySelector("[data-m-top]");
        const bottom = s3.querySelector("[data-m-bottom]");
        tl.fromTo([top, bottom], { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.08 }, 0.2);
        tl.fromTo(top, { yPercent: 28 }, { yPercent: 0, duration: 0.9, ease: "power2.inOut" }, 0.75);
        tl.fromTo(s3.querySelectorAll("[data-m-guide]"), { scaleY: 0 }, { scaleY: 1, duration: 0.6, stagger: 0.08, ease: "power2.out" }, 1.1);
        tl.fromTo(bottom, { filter: "grayscale(1) brightness(0.8)" }, { filter: "grayscale(0) brightness(1)", duration: 0.8 }, 1.1);
        panelIn(tl, s3, 1.3);
      }

      // 4. Isolated Spaces — closed Machine arrives, then unfolds into the open one
      {
        const tl = onEnter(s4);
        copyIn(tl, s4);
        // same unfold as desktop: the collapsed (≡ closed.svg) machine arrives, the platforms rise,
        // hidden chips fade in, then the legs come down — one inline svg, no image swap
        const host = s4.querySelector<HTMLElement>("[data-m-machine]");
        const unfold = { p: 0 };
        let apply: ((p: number) => void) | null = null;
        if (host) mountMachine(host, "m-machine").then((fn) => { apply = fn; fn(unfold.p); }).catch(() => {});
        tl.fromTo(host, { autoAlpha: 0, y: 36, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out" }, 0.25);
        tl.fromTo(unfold, { p: 0 }, { p: 1, duration: 2.2, ease: "none", onUpdate: () => apply?.(unfold.p) }, 0.95);
        panelIn(tl, s4, 1.4);
      }

      // 5. Pods — the three slabs rise in bottom-first, then float; cards follow, API deploys to 80%
      {
        const svg = s5.querySelector("[data-m-pods] svg");
        const slabs: SVGGraphicsElement[][] = [[], [], []];
        if (svg) {
          Array.from(svg.children)
            .filter((el) => el.tagName !== "defs")
            .forEach((el, i) => slabs[PODS_SLAB_STARTS.findIndex((st) => i >= st)].push(el as SVGGraphicsElement));
        }
        const tl = onEnter(s5);
        copyIn(tl, s5);
        [2, 1, 0].forEach((si, k) => {
          tl.fromTo(slabs[si], { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" }, 0.25 + k * 0.18);
        });
        tl.fromTo(s5.querySelectorAll("[data-m-pod]"), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.14, ease: "power2.out" }, 1.0);
        counter(tl, s5.querySelector("[data-m-pod-pct]"), s5.querySelector("[data-m-pod-bar]"), 80, 1.5);
        // idle float, only while the section is on screen
        const floats = slabs.map((els, i) =>
          gsap.to(els, { y: -4 - i, duration: 2.1 + i * 0.25, ease: "sine.inOut", yoyo: true, repeat: -1, paused: true, delay: i * 0.3 }),
        );
        ScrollTrigger.create({
          trigger: s5,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => floats.forEach((f) => (self.isActive && tl.progress() === 1 ? f.play() : f.pause())),
        });
        tl.eventCallback("onComplete", () => floats.forEach((f) => f.play()));
        tl.eventCallback("onReverseComplete", () => floats.forEach((f) => f.pause(0)));
      }

      // 6. Continuous Deployment — typed push, bubbles run down to the board, POD deploys → LIVE
      {
        const tl = onEnter(s6);
        copyIn(tl, s6);
        const term = s6.querySelector("[data-m-terminal]");
        tl.fromTo(term, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0.3);
        typeIn(tl, term, 0.7);
        tl.fromTo(s6.querySelector("[data-m-flow]"), { autoAlpha: 0, scaleY: 0 }, { autoAlpha: 1, scaleY: 1, duration: 0.5, ease: "power2.out" }, 1.3);
        tl.fromTo(s6.querySelector("[data-m-board]"), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" }, "<0.2");
        tl.fromTo(s6.querySelector("[data-m-badge6]"), { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, ">-0.2");
        tl.fromTo(s6.querySelector("[data-m-card-pod]"), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5 }, ">0.1");
        counter(tl, s6.querySelector("[data-m-deploy-pct]"), s6.querySelector("[data-m-deploy-bar]"), 100, ">");
        const link = s6.querySelector<SVGPathElement>("[data-m-link] path");
        if (link) {
          const len = link.getTotalLength();
          gsap.set(link, { strokeDasharray: len, strokeDashoffset: len });
          tl.to(link, { strokeDashoffset: 0, duration: 0.4, ease: "power2.out" }, ">");
        }
        tl.fromTo(s6.querySelector("[data-m-card-live]"), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, ">-0.05");
      }

      // 7. AI Infrastructure — the board arrives and lights up, the agent attaches in the terminal
      {
        const tl = onEnter(s7);
        copyIn(tl, s7);
        const board = s7.querySelector("[data-m-agent]");
        tl.fromTo(board, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out" }, 0.25);
        const outline = board?.querySelector("[data-agent-outline]");
        if (outline) tl.to(outline, { attr: { stroke: "#11A32A", "stroke-opacity": 0.8 }, duration: 0.5 }, 1.0);
        tl.fromTo(s7.querySelector("[data-m-glow7]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 1.0);
        tl.fromTo(s7.querySelector("[data-m-badge7]"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45 }, 1.1);
        const term = s7.querySelector("[data-m-terminal]");
        tl.fromTo(term, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 1.3);
        typeIn(tl, term, 1.6, 44);
      }

      // 8. Pricing
      {
        const tl = onEnter(s8);
        copyIn(tl, s8);
        tl.fromTo(s8.querySelector("[data-m-calc]"), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0.3);
        tl.fromTo(s8.querySelectorAll("[data-m-calc-row]"), { autoAlpha: 0, x: 10 }, { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.1 }, 0.6);
      }

      // 9. closing CTA
      {
        const tl = onEnter(s9);
        copyIn(tl, s9);
        tl.fromTo(s9.querySelector("[data-m-glow9]"), { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 1.2, ease: "power2.out" }, 0);
      }

      return () => mq.removeEventListener("change", onChange);
    },
    { scope: rootRef },
  );

  // phones: full width; portrait tablets: --m caps at 1.3px and the column centres at 600 design px
  const sectionStyle = { paddingInline: m(20), paddingTop: m(56), paddingBottom: m(56), maxWidth: m(600), marginInline: "auto" };

  return (
    <div ref={rootRef} className="relative overflow-x-clip" style={{ ["--m" as string]: "min(calc(100vw / 390), 1.3px)" }}>
      {/* 1 — hero */}
      {/* hidden until the effect plays its load-in (reduced motion reveals it at once) */}
      <section data-m-section data-m-hidden className="relative" style={{ ...sectionStyle, paddingTop: m(44), visibility: "hidden" }}>
        <Eyebrow>Managed Kubernetes &amp; AI Agent Infrastructure</Eyebrow>
        <Heading as="h1">Build your product. We&rsquo;ll handle the infrastructure.</Heading>
        <Para>
          Deploy your apps, databases, workers, and AI agents without building a DevOps team. usectl takes you from code to
          production with managed infrastructure and predictable pricing.
        </Para>
        <Buttons />
        <div className="relative mx-auto" style={{ width: m(200), marginTop: m(34) }}>
          <div
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: m(-10), width: m(200), height: m(64), background: "radial-gradient(ellipse at center, rgba(17,163,42,0.35) 0%, rgba(17,163,42,0) 70%)", filter: "blur(8px)" }}
          />
          <div data-m-server className="relative" dangerouslySetInnerHTML={{ __html: serverSvg }} />
        </div>
      </section>

      {/* 2 — Infrastructure Freedom */}
      <section data-m-section className="relative" style={sectionStyle}>
        <Eyebrow>Infrastructure Freedom</Eyebrow>
        <Heading>You came here to build.</Heading>
        <Para>
          Your next feature. Your first customer. The idea you can&rsquo;t stop thinking about. usectl handles the infrastructure,
          giving you more time to move your product forward.
        </Para>
        <div
          data-m-stat
          className="font-heading text-white/85"
          style={{ marginTop: m(30), padding: `${m(16)} ${m(18)}`, fontSize: m(14.5), lineHeight: 1.5, borderRadius: m(10), border: "1px solid transparent", background: GRADIENT_BORDER(120) }}
        >
          <p>
            <span className="text-brand">0 Hours</span> spent on DevOps configuration.
          </p>
          <p>
            <span className="text-brand">100%</span> Focus on Product Logic
          </p>
        </div>
        <div style={{ marginTop: m(22) }}>
          {["Auto-scaling K8s Cluster", "Isolated Micro-VM Kernel", "Encrypted Postgres Storage"].map((t) => (
            <div data-m-label key={t} className="flex items-center" style={{ height: m(40) }}>
              <span data-m-dot className="shrink-0 rounded-full border border-brand" style={{ width: m(9), height: m(9), boxShadow: "0 0 8px rgba(17,163,42,0.6)" }} />
              <svg viewBox="0 0 60 12" className="shrink-0" style={{ width: m(46), height: m(10) }} aria-hidden="true">
                <path d="M2 10 H30 C34 10 34 2 38 2 H58" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              </svg>
              <span data-m-label-text className="font-heading text-white/80" style={{ fontSize: m(14), marginLeft: m(8) }}>
                {t}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 3 — Your Stacks */}
      <section data-m-section className="relative" style={sectionStyle}>
        <Eyebrow>Infrastructure Freedom</Eyebrow>
        <Heading>
          Your Stacks,
          <br />
          in one place.
        </Heading>
        <Para>
          Run your apps, databases, storage, and background jobs together. Everything stays connected and organized while
          usectl manages the infrastructure underneath.
        </Para>
        <div className="relative mx-auto" style={{ width: m(210), marginTop: m(32) }}>
          <Image data-m-top src="/stack-section/top-server-piece.svg" alt="" width={420} height={284} className="relative z-10 block w-full" style={{ height: "auto" }} />
          <div className="relative flex justify-center" style={{ height: m(32), gap: m(46) }} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                data-m-guide
                className="block h-full"
                style={{ width: 0, borderLeft: "1px dashed rgba(255,255,255,0.3)", transformOrigin: "top" }}
              />
            ))}
          </div>
          <Image data-m-bottom src="/stack-section/bottom-server-piece.svg" alt="" width={417} height={285} className="block w-full" style={{ height: "auto" }} />
        </div>
        <Panel
          items={[
            { no: "01/", title: "Application Services", desc: "Automated deployment for APIs, web apps, and microservices." },
            { no: "02/", title: "Application Storage", desc: "High-availability managed databases and S3-compatible object storage." },
            { no: "03/", title: "Background Jobs", desc: "Isolated worker queues, scheduled CRONs, and async processing." },
          ]}
        />
      </section>

      {/* 4 — Isolated Spaces (Machine) */}
      <section data-m-section className="relative" style={sectionStyle}>
        <Eyebrow>Isolated Spaces</Eyebrow>
        <Heading>
          Give every project
          <br />
          its own space.
        </Heading>
        <Para>
          Keep your app and the services it depends on together, with their own resources and access settings. In usectl, we
          call this project space a Machine.
        </Para>
        {/* one inline opened.svg that starts collapsed (≡ closed.svg) and unfolds — machineUnfold.ts */}
        <div data-m-machine className="relative mx-auto" style={{ width: m(300), marginTop: m(28), aspectRatio: "834 / 694" }} />
        <Panel
          items={[
            { no: "01/", title: "MACHINE BOUNDARY", desc: "Zero cross-project interference" },
            { no: "02/", title: "DEDICATED RESOURCES", desc: "CPU, RAM, and Storage isolated per space" },
            { no: "03/", title: "ENVIRONMENT CONFIG", desc: "Independent secrets and access policies" },
          ]}
        />
      </section>

      {/* 5 — Pods */}
      <section data-m-section className="relative" style={sectionStyle}>
        <Eyebrow>Isolated Spaces</Eyebrow>
        <Heading>
          Run each part
          <br />
          independently.
        </Heading>
        <Para>
          Your frontend, API, and workers can each have their own resources and deploy separately while staying connected inside
          the same project. In usectl, each running workload is a Pod.
        </Para>
        <div data-m-pods className="relative mx-auto" style={{ width: m(190), marginTop: m(26) }} dangerouslySetInnerHTML={{ __html: podsSvg }} />
        <div className="font-mono" style={{ marginTop: m(24), display: "grid", gap: m(12) }}>
          {[
            { t: "[ POD // FRONTEND ]", st: "RUNNING v1.4.2", d: "Independent Deploy • 1 vCPU / 2GB" },
            { t: "[ POD // API ]", st: "DEPLOYING v2.1.0", d: "Zero Downtime • 2 vCPU / 4GB", deploying: true },
            { t: "[ POD // WORKERS ]", st: "RUNNING v1.4.2", d: "Async Processing • 1 vCPU / 1GB" },
          ].map((p) => (
            <div data-m-pod key={p.t} style={{ padding: `${m(12)} ${m(14)}`, borderRadius: m(8), border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
              <p className="text-brand" style={{ fontSize: m(13), letterSpacing: "0.04em" }}>
                {p.t}
              </p>
              <p className="flex items-center text-white/85" style={{ fontSize: m(12), marginTop: m(8), gap: m(8) }}>
                <span className="inline-block rounded-full" style={{ width: m(7), height: m(7), background: p.deploying ? "transparent" : "#11a32a", border: p.deploying ? "1px solid #11a32a" : "none" }} />
                {p.st}
                {p.deploying && (
                  <span className="text-white/55">
                    (<span data-m-pod-pct>0</span>%)
                  </span>
                )}
              </p>
              {p.deploying && (
                <div className="overflow-hidden rounded-full bg-white/10" style={{ height: m(3), marginTop: m(8) }}>
                  <div data-m-pod-bar className="h-full origin-left bg-brand" style={{ transform: "scaleX(0)" }} />
                </div>
              )}
              <p className="text-white/45" style={{ fontSize: m(11.5), marginTop: m(8) }}>
                {p.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 6 — Continuous Deployment */}
      <section data-m-section className="relative" style={sectionStyle}>
        <Eyebrow>Continuous Deployment</Eyebrow>
        <Heading>
          Push your code.
          <br />
          We&rsquo;ll put it live.
        </Heading>
        <Para>
          Connect your repository and push your next update. usectl builds it, deploys it, and serves it over HTTPS while the
          rest of your project keeps running.
        </Para>
        <div style={{ marginTop: m(30) }}>
          <Terminal
            dataKey="6"
            rows={[
              { lead: ">", parts: [{ t: "git push origin main" }] },
              { lead: "", dot: true, parts: [{ t: "Code push detected:" }, { t: "commit-a7f3d", brand: true }] },
              { lead: "<", parts: [{ t: "Automatic build triggered" }] },
            ]}
          />
        </div>
        {/* bubbles flowing from the terminal down to the board */}
        <div data-m-flow className="relative mx-auto" style={{ width: m(8), height: m(46), transformOrigin: "top" }} aria-hidden="true">
          <span className="absolute left-1/2 top-0 h-full -translate-x-1/2" style={{ width: 1, background: "linear-gradient(#11a32a, rgba(17,163,42,0.1))" }} />
          {[0, 1, 2].map((i) => (
            <span key={i} className="m-bubble absolute left-1/2 rounded-full bg-brand" style={{ width: m(4), height: m(4), marginLeft: m(-2), animationDelay: `${i * 0.45}s` }} />
          ))}
        </div>
        <div className="relative mx-auto" style={{ width: m(250) }}>
          <div data-m-board dangerouslySetInnerHTML={{ __html: rightBoardSvg }} />
          <div
            data-m-badge6
            className="absolute left-1/2 top-0 flex -translate-x-1/2 items-center whitespace-nowrap font-mono text-white/85"
            style={{ height: m(28), paddingInline: m(12), gap: m(8), fontSize: m(11), letterSpacing: "0.05em", borderRadius: m(3), border: "1px solid transparent", background: GRADIENT_BORDER(90) }}
          >
            <span className="rounded-full bg-brand" style={{ width: m(6), height: m(6) }} /> BUILD: IN-PROGRESS
          </div>
        </div>
        <div className="font-mono" style={{ marginTop: m(18) }}>
          <div data-m-card-pod style={{ padding: `${m(12)} ${m(14)}`, borderRadius: m(8), border: "1px solid rgba(255,255,255,0.12)" }}>
            <p className="text-brand" style={{ fontSize: m(13.5) }}>
              [ POD // API ]
            </p>
            <p className="text-white/70" style={{ fontSize: m(11.5), marginTop: m(6) }}>
              DEPLOYING ... v2.1.0
            </p>
            <div className="flex items-center" style={{ gap: m(10), marginTop: m(8) }}>
              <div className="flex-1 overflow-hidden rounded-full bg-white/10" style={{ height: m(3) }}>
                <div data-m-deploy-bar className="h-full origin-left bg-brand" style={{ transform: "scaleX(0)" }} />
              </div>
              <span className="text-white/60" style={{ fontSize: m(11.5) }}>
                <span data-m-deploy-pct>0</span>&nbsp;%
              </span>
            </div>
          </div>
          <svg data-m-link viewBox="0 0 20 28" className="mx-auto block" style={{ width: m(20), height: m(28) }} aria-hidden="true">
            <path d="M10 0 V28" stroke="rgba(17,163,42,0.8)" strokeWidth="1.2" fill="none" />
          </svg>
          <div data-m-card-live style={{ padding: `${m(12)} ${m(14)}`, borderRadius: m(8), border: "1px solid transparent", background: GRADIENT_BORDER(90) }}>
            <p className="text-brand" style={{ fontSize: m(13.5) }}>
              [ &#10003; LIVE // v2.1.0 ]
            </p>
            <p className="flex items-center text-white/70" style={{ fontSize: m(11.5), marginTop: m(6), gap: m(8) }}>
              <span className="rounded-full bg-brand" style={{ width: m(6), height: m(6) }} /> HTTPS Active
            </p>
          </div>
        </div>
      </section>

      {/* 7 — AI Infrastructure */}
      <section data-m-section className="relative" style={sectionStyle}>
        <Eyebrow>AI Infrastructure</Eyebrow>
        <Heading>
          Give your agent
          <br />
          a place to work.
        </Heading>
        <Para>
          Run AI agents alongside the apps, APIs, databases, and tools they use. Your coding assistant can also deploy updates
          and inspect logs through the usectl CLI.
        </Para>
        <div className="relative mx-auto" style={{ width: m(290), marginTop: m(30) }}>
          <div
            data-m-glow7
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: m(-18), width: m(270), height: m(76), background: "radial-gradient(ellipse at center, rgba(17,163,42,0.3) 0%, rgba(17,163,42,0) 70%)", filter: "blur(10px)" }}
          />
          <div data-m-agent className="relative" dangerouslySetInnerHTML={{ __html: agentSvg }} />
        </div>
        <div
          data-m-badge7
          className="mx-auto w-fit font-mono"
          style={{ marginTop: m(22), padding: `${m(8)} ${m(14)}`, fontSize: m(11.5), lineHeight: 1.8, letterSpacing: "0.05em", borderRadius: m(3), border: "1px solid transparent", background: GRADIENT_BORDER(90) }}
        >
          <p className="text-white/85">POD // AI AGENT</p>
          <p className="text-white/85">
            <span className="text-brand">ACTIVE</span> coding-assistant
          </p>
        </div>
        <div style={{ marginTop: m(18) }}>
          <Terminal
            dataKey="7"
            rows={[
              { lead: ">", parts: [{ t: "usectl agent attach --role coding-assistant" }] },
              { lead: "", dot: true, parts: [{ t: "Executing updates & inspecting logs ..." }] },
              { lead: "<", parts: [{ t: "Status: Synchronized with env-prod-01" }] },
            ]}
          />
        </div>
      </section>

      {/* 8 — Pricing */}
      <section data-m-section className="relative" style={sectionStyle}>
        <Heading>
          Know your hosting bill
          <br />
          before you launch.
        </Heading>
        <Para>
          Choose the CPU, memory, and storage your project needs and see the monthly price before you deploy. Need more capacity
          later? You&rsquo;ll see the new price before making the change.
        </Para>
        <div
          data-m-calc
          className="font-heading"
          style={{ marginTop: m(28), padding: m(18), borderRadius: m(14), border: "1px solid rgba(255,255,255,0.09)", background: "linear-gradient(115deg, rgba(255,255,255,0.032) 0%, rgba(255,255,255,0.01) 100%)" }}
        >
          <div className="flex items-center justify-center" style={{ gap: m(10), fontSize: m(13.5) }}>
            <span className={annual ? "text-white/50" : "text-white/90"}>Monthly</span>
            {/* the desktop switch: 49×27 track r4, 22×23 #11A32A knob, travel 23 */}
            <button
              type="button"
              role="switch"
              aria-checked={annual}
              aria-label="Bill annually"
              onClick={() => setAnnual((a) => !a)}
              className="relative cursor-pointer"
              style={{ width: m(44), height: m(24), borderRadius: m(4), background: "rgba(255,255,255,0.15)" }}
            >
              <span
                className="absolute transition-transform duration-200"
                style={{ top: m(2), left: m(2), width: m(20), height: m(20), borderRadius: m(4), background: "#11A32A", transform: annual ? `translateX(${m(20)})` : "translateX(0)" }}
              />
            </button>
            <span className={annual ? "text-white/90" : "text-white/50"}>Annual</span>
          </div>
          {PRICING_ROWS.map((row) => (
            <div data-m-calc-row key={row.key} className="flex items-center justify-between" style={{ marginTop: m(18) }}>
              <div>
                <p className="text-white/90" style={{ fontSize: m(15) }}>
                  {row.label}
                </p>
                <p className="font-light text-white/45" style={{ fontSize: m(11), marginTop: m(3) }}>
                  {row.sub}
                </p>
              </div>
              <div className="flex items-center" style={{ gap: m(8) }}>
                {([-1, 1] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-label={`${d < 0 ? "Decrease" : "Increase"} ${row.label}`}
                    onClick={() => step(row.key, d, row.max)}
                    onPointerDown={pressRipple}
                    disabled={d < 0 ? counts[row.key] <= 1 : counts[row.key] >= row.max}
                    className={STEP_BTN_CLASS}
                    style={{ width: m(30), height: m(30), fontSize: m(15), order: d < 0 ? 0 : 2 }}
                  >
                    {d < 0 ? "−" : "+"}
                  </button>
                ))}
                <span className="text-center text-white/90" style={{ width: m(30), fontSize: m(15), order: 1 }}>
                  {counts[row.key]}
                </span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between" style={{ marginTop: m(22), padding: `${m(12)} ${m(16)}`, borderRadius: m(8), border: "1px dashed rgba(255,255,255,0.25)" }}>
            <span className="text-white/80" style={{ fontSize: m(14.5) }}>
              Your {annual ? "annual" : "monthly"} price
            </span>
            <span className="font-medium text-brand" style={{ fontSize: m(22) }}>
              {fmtPrice(total)}
              <span className="text-white/50" style={{ fontSize: m(12) }}>
                {suffix}
              </span>
            </span>
          </div>
          <p className="text-center font-light text-white/45" style={{ marginTop: m(12), fontSize: m(11.5) }}>
            The first month is free. You don&rsquo;t need to link a card.
          </p>
        </div>
        {/* the desktop CTA: bordered box with brighter blueprint corner brackets, brand label */}
        <a
          href="#start"
          className="relative flex items-center justify-center border border-white/20 font-heading text-brand transition-colors hover:bg-white/5 active:bg-white/5"
          style={{ marginTop: m(18), height: m(50), fontSize: m(14.5) }}
        >
          {(["-top-px -left-px border-t border-l", "-top-px -right-px border-t border-r", "-bottom-px -left-px border-b border-l", "-bottom-px -right-px border-b border-r"] as const).map((pos) => (
            <span key={pos} aria-hidden="true" className={`absolute ${pos} border-white/60`} style={{ width: m(10), height: m(10) }} />
          ))}
          Start now from $15 / month
        </a>
        <p className="text-center font-heading font-light text-white/40" style={{ marginTop: m(10), fontSize: m(12.5) }}>
          Not a surprise.
        </p>
      </section>

      {/* 9 — closing CTA */}
      <section data-m-section className="relative overflow-hidden" style={{ ...sectionStyle, paddingBottom: m(90) }}>
        <div
          data-m-glow9
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ right: m(-120), top: m(20), width: m(320), height: m(320), background: "radial-gradient(circle, rgba(90,255,200,0.14) 0%, rgba(17,163,42,0.06) 45%, rgba(17,163,42,0) 70%)", filter: "blur(20px)" }}
        />
        <p data-m-copy className="relative font-heading font-light text-white/50" style={{ fontSize: m(20), lineHeight: 1.25 }}>
          What will you build next?
        </p>
        <h2 data-m-copy className="relative font-heading font-light text-white/85" style={{ fontSize: m(25), lineHeight: 1.3, marginTop: m(12) }}>
          Give your next product a place to run.{" "}
          <span className="font-medium" style={{ color: "#27a138" }}>
            Keep building
          </span>{" "}
          <span className="font-medium" style={{ color: "#6b8fa8" }}>
            what matters
          </span>{" "}
          - we&rsquo;ll handle the infrastructure behind
        </h2>
        <div className="relative">
          <Buttons />
        </div>
      </section>
    </div>
  );
}
