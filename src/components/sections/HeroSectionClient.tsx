"use client";

import Image from "next/image";
import { Fragment, useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { HeroServerModel, type HeroServerModelHandle } from "@/components/sections/HeroServerModel";
import { CUBE_SCALE_TARGET, useHeroScrollAnimation } from "@/animations/heroScrollAnimation";
import { HERO_PIN_SCROLL_DISTANCE, HERO_STACK_GAP_CLOSED_PX } from "@/lib/heroLayers";
import { HERO_CORE_HEIGHT_RATIO, HERO_INTRO_TEXT, heroIntroTextStartSeconds } from "@/lib/heroModel";
import { useGridMarks } from "@/lib/gridEffect/useGridMarks";
import { INFRASTRUCTURE_STEPS_INTRO } from "@/lib/infrastructureSteps";
import { HEADER_HEIGHT_PX, readScale, s } from "@/lib/grid";

// The 4 corner "+" marks around the server, restored 2026-09-20 — as grid marks this time, not
// cross.svg images. The whole reason they were pulled in the first place (PROJECT.md's grid-snap ->
// cube-relative -> "just delete them" saga) was that a fixed-px offset and a vw-fluid grid only
// line up at the width you tuned them at; a mark that IS a grid intersection cannot have that
// problem. These two numbers reproduce the approved 1920 look — columns 7/16, rows 4/7 — and the
// snap picks the nearest equivalent everywhere else.
//
// gapX 129 is the exact distance from the model box's edge to column 7 at 1920. gapY is ZERO,
// which means "the row nearest each edge" rather than "push away by N" — at 1920 the model box is
// almost exactly four row pitches tall, so the pair lands on its top and bottom edges, and at any
// other width the snap keeps that framing as closely as the grid allows.
const HERO_MARK_GAP_X_PX = 129;
const HERO_MARK_GAP_Y_PX = 0;
const HERO_MODEL_WIDTH_PX = 480;

// ---- the copy's mask reveal (see globals.css .hero-mask and HERO_INTRO_TEXT) ---------------------

/** One unit that slides up out of its own mask. `line` groups units that belong to the same line. */
function Mask({ line, button = false, children }: { line: number; button?: boolean; children: ReactNode }) {
  return (
    <span className={button ? "hero-mask hero-mask-btn" : "hero-mask"} data-hero-line={line}>
      <span className="hero-mask-in">{children}</span>
    </span>
  );
}

/** Splits `text` into masked words, keeping real spaces between them so lines still wrap normally. */
function MaskWords({ text, line }: { text: string; line: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={i}>
          <Mask line={line}>{word}</Mask>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

// ---- "03 — isolated spaces" overlay -----------------------------------------------------------------
// Comes in over the pinned hero once the server has risen (heroScrollAnimation.ts, SPACE_* and
// layoutSpace(), which positions the callouts and the other machines around the server).
// Copy and structure from the design reference public/sources/Variant C, "03 — isolated spaces",
// converted from its 1440 artboard to 1920 design px (x 4/3) and to the dark theme.
// Trimmed on feedback the same day: only the two right-hand callouts are kept (no left-hand ones,
// no "machine" dimension), and the copy is InfrastructureSection's step 1.
const SPACE_CALLOUTS = [{ text: "the server you saw" }, { text: "handled by usectl" }] as const;
const SPACE_COPY = INFRASTRUCTURE_STEPS_INTRO[0];
// ---- "02 — your stack" overlay -------------------------------------------------------------------
// Takes over from "01" in place: "01" fades out, this copy fades in on the same spot, the server stays
// exactly as it is but turns into the reference's line drawing, and the project's five services come
// in around it, each wired to a layer.
// Reference: public/sources/Variant C, "02 — your stack" (with its services sped up on feedback);
// motion and placement in heroScrollAnimation.ts (STACK_*, layoutStack()). Copy is step 2 of
// lib/infrastructureSteps.ts, like the "01" overlay above uses step 1.
// `side` is which side of the server the chip sits on, `layer` which layer its line goes to
// (0 = cap … 3 = base).
const STACK_COPY = INFRASTRUCTURE_STEPS_INTRO[1];
const STACK_CHIPS = [
  { label: "website", icon: "website", side: "right", layer: 0 },
  { label: "api", icon: "api", side: "right", layer: 1 },
  { label: "worker", icon: "workflow", side: "right", layer: 2 },
  { label: "database", icon: "database", side: "left", layer: 2 },
  { label: "storage", icon: "storage", side: "left", layer: 3 },
] as const;

// Parked until the timeline brings them in (GSAP's autoAlpha takes over from these).
const SPACE_HIDDEN: CSSProperties = { opacity: 0, visibility: "hidden" };

/** Seconds to wait for the model to say whether the intro plays before revealing the copy anyway. */
const TEXT_FALLBACK_SECONDS = 4;

/**
 * Plays the copy's reveal: each line's words one after another, each line starting once the
 * previous line's last word has started + lineGap. `startDelayMs` is when the first word goes.
 * Clears `html.hero-intro` once everything is up, which also drops the masks' clipping.
 */
function revealHeroText(root: HTMLElement, startDelayMs: number) {
  const html = document.documentElement;
  if (!html.classList.contains("hero-intro")) return;
  const units = [...root.querySelectorAll<HTMLElement>("[data-hero-line]")];
  const t = HERO_INTRO_TEXT;
  let cursor = 0;
  let lastLine = -1;
  let inLine = 0;
  let lineStart = 0;
  const animations = units.map((unit) => {
    const line = Number(unit.dataset.heroLine);
    if (line !== lastLine) {
      if (lastLine !== -1) cursor = lineStart + (inLine - 1) * t.wordGapSeconds + t.lineGapSeconds;
      lineStart = cursor;
      lastLine = line;
      inLine = 0;
    }
    const delay = lineStart + inLine * t.wordGapSeconds;
    inLine++;
    const inner = unit.firstElementChild as HTMLElement;
    return inner.animate(
      [{ transform: `translateY(calc(${t.distancePercent}% + 12px))` }, { transform: "translateY(0)" }],
      { duration: t.unitSeconds * 1000, delay: startDelayMs + delay * 1000, easing: t.easing, fill: "both" },
    );
  });
  void Promise.all(animations.map((a) => a.finished)).then(
    () => {
      html.classList.remove("hero-intro");
      animations.forEach((a) => a.cancel()); // resting state is plain CSS again (transform: none)
    },
    () => html.classList.remove("hero-intro"),
  );
}

export function HeroSectionClient() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cubeWrapperRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const spaceRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HeroServerModelHandle | null>(null);
  const modelSyncRef = useRef<(() => void) | null>(null);

  // The box the marks are snapped around is deliberately NOT getBoundingClientRect(): this wrapper
  // is scaled, shifted and grown by the scroll timeline, and its section is position:fixed while
  // pinned, so a live rect says something different at every scroll position. This is the wrapper's
  // pure LAYOUT box at the top of the page — offsetTop/offsetLeft are relative to the <section>
  // (position:relative) and unaffected by scroll, pinning or the timeline's transforms, and the
  // height is the CLOSED height computed from the same formula the CSS uses rather than read back
  // from --stack-gap, which the timeline owns. Same reasoning as measureRecenterY in
  // heroScrollAnimation.ts, which was a real refresh bug there.
  const markBox = useCallback(() => {
    const el = cubeWrapperRef.current;
    if (!el) return null;
    const k = readScale();
    const closedHeight = 3 * HERO_STACK_GAP_CLOSED_PX * k + HERO_MODEL_WIDTH_PX * HERO_CORE_HEIGHT_RATIO * k;
    // The hero is the first thing in <main>, and the header is sticky (so it occupies flow) —
    // the section therefore starts exactly one header below the document top.
    const top = HEADER_HEIGHT_PX + el.offsetTop;
    return { left: el.offsetLeft, right: el.offsetLeft + el.offsetWidth, top, bottom: top + closedHeight };
  }, []);

  const gridMarks = useGridMarks(cubeWrapperRef, {
    gapX: HERO_MARK_GAP_X_PX,
    gapY: HERO_MARK_GAP_Y_PX,
    box: markBox,
  });

  useHeroScrollAnimation({
    sectionRef,
    contentRef,
    cubeWrapperRef,
    modelRef,
    modelSyncRef,
    ssrScrollReserveRef,
    gridMarks,
    spaceRef,
    stackRef,
  });

  // The GLB arrives well after the timeline is built, always starting at its closed pose. This
  // jumps it straight to the pose the current scroll position calls for — see modelSyncRef's own
  // comment in heroScrollAnimation.ts for why a plain ScrollTrigger.refresh() alone isn't enough
  // (it re-syncs through the scrub's eased catch-up, which visibly animates closed -> open instead
  // of just already being there).
  const handleModelReady = useCallback(() => modelSyncRef.current?.(), []);

  // The copy comes in with the server's intro: timed off the moment the intro starts, or straight
  // away (no animation) when the model decides not to play it. If the model never reports — WebGL
  // unavailable, a very slow network — the copy is revealed anyway after TEXT_FALLBACK_SECONDS.
  const textHandledRef = useRef(false);
  const handleIntro = useCallback((playing: boolean) => {
    if (textHandledRef.current || !contentRef.current) return;
    textHandledRef.current = true;
    if (playing) revealHeroText(contentRef.current, heroIntroTextStartSeconds() * 1000);
    else document.documentElement.classList.remove("hero-intro");
  }, []);
  useEffect(() => {
    // From here on this component owns the reveal (including its own fallback just below), so the
    // early script's blunt failsafe must not yank the class out from under a running animation.
    window.clearTimeout((window as Window & { __heroIntroFailsafe?: number }).__heroIntroFailsafe);
    const id = window.setTimeout(() => {
      if (textHandledRef.current || !contentRef.current) return;
      textHandledRef.current = true;
      revealHeroText(contentRef.current, 0);
    }, TEXT_FALLBACK_SECONDS * 1000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <section
      ref={sectionRef}
      data-hero-section=""
      className="relative flex flex-col items-center px-6 pt-16 pb-28 text-center md:pb-36"
    >
      <div ref={contentRef}>
        {/* Every word / logo / button is wrapped in a <Mask> for the intro's reveal; `line` numbers
            the lines in the order they come in. With no intro the masks are plain inline boxes. */}
        <div className="flex items-center justify-center gap-3">
          <Mask line={0}>
            <Image src="/herosection/Subtract.svg" alt="" width={58} height={26} aria-hidden="true" />
          </Mask>
          <span className="font-heading text-[calc(var(--s)*22)] leading-none font-light tracking-[-0.02em] text-white/70">
            <MaskWords line={0} text="Managed Kubernetes & AI Agent Infrastructure" />
          </span>
        </div>

        <h1 className="mt-[4px] font-heading text-[calc(var(--s)*98)] leading-[1.05] font-bold sm:text-nowrap">
          <MaskWords line={1} text="One server." />{" "}
          <span className="text-brand">
            <MaskWords line={1} text="Unlimited" />
          </span>{" "}
          <MaskWords line={1} text="machines." />
        </h1>

        <p className="mx-auto mt-2 max-w-[calc(var(--s)*1080)] text-[calc(var(--s)*28)] text-white/70">
          <MaskWords
            line={2}
            text="Zero-ops hosting for your apps and AI agents. Everything you need to take your idea live, without a DevOps team. Build it. Launch it."
          />
        </p>

        <div className="mt-[calc(var(--s)*35)] flex flex-wrap items-center justify-center gap-4">
          <Mask line={3} button>
            <Button href="#">Create Machine</Button>
          </Mask>
          <Mask line={3} button>
            <Button href="#" withArrow>
              See how it works
            </Button>
          </Mask>
        </div>
      </div>

      {/* The server, now a real 3D model (HeroServerModel) instead of four stacked layer SVGs.
          This wrapper's BOX is unchanged from the SVG version on purpose — same w-[400px], same
          --core-height, same height tracking --stack-gap — because it is what the rest of the
          hero is measured against: the scroll timeline scales and re-centres THIS element, and
          the model was scaled (see HERO_MODEL_PX_PER_UNIT) so the closed server lands in exactly
          the same 400x409px the SVG stack occupied. The <canvas> itself is larger than this box
          and overflows it, since the exploded stack is about twice as tall and the silhouette
          widens as it turns.

          --stack-gap is still animated 45px -> 140px by the timeline even though no layer reads
          it for positioning any more: the wrapper's own height is derived from it, and keeping
          that growth identical is what keeps the page's total height (and the SSR reservation
          below) behaving exactly as it did before. */}
      <div
        ref={cubeWrapperRef}
        aria-hidden="true"
        className="relative mx-auto mt-[calc(var(--s)*84)] w-[calc(var(--s)*480)] [--core-height:calc(var(--s)*330.32)] h-[calc(3*var(--stack-gap)_+_var(--core-height))]"
        style={{ "--stack-gap": `${HERO_STACK_GAP_CLOSED_PX}px` } as CSSProperties}
      >
        {/* Soft ambient glow beneath the server, matching server-cube.png's reference look — the
            model has no equivalent "shadow/glow" of its own, so it's a plain CSS radial gradient.
            Positioned off the same formula as the wrapper's own height, so it tracks the base
            layer down as the stack opens. Starts hidden: it belongs to the server, so
            HeroServerModel brings it in with the model (growing it piece by piece during the
            first-load intro) instead of it glowing under an empty stage while the GLB loads. */}
        <div
          ref={glowRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 h-[calc(var(--s)*130)] w-[170%] -translate-x-1/2 rounded-full blur-2xl"
          style={{
            top: `calc(3 * var(--stack-gap) + var(--core-height) - 45px)`,
            opacity: 0,
            background: "radial-gradient(ellipse at center, rgba(72,144,72,0.55) 0%, rgba(72,144,72,0) 70%)",
          }}
        />

        <HeroServerModel
          apiRef={modelRef}
          wrapperRef={cubeWrapperRef}
          onReady={handleModelReady}
          intro
          glowRef={glowRef}
          onIntro={handleIntro}
          pixelRatioBoost={CUBE_SCALE_TARGET}
        />
      </div>

      {/* "03 — isolated spaces": spans the viewport from the section's top, which IS the viewport top
          while the section is pinned. Desktop only — at phone width there is no room beside the
          server. Positions of everything but the copy are set by layoutSpace(). */}
      <div
        ref={spaceRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden h-screen text-left md:block"
      >
        <svg data-space-svg className="absolute inset-0 h-full w-full" fill="none">
          {SPACE_CALLOUTS.map((c, i) => (
            <g key={c.text} data-space-line={i} style={SPACE_HIDDEN}>
              <path stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
              <circle r="3" fill="rgba(255,255,255,0.9)" />
            </g>
          ))}
        </svg>

        {/* Same copy as InfrastructureSection's step 1 (lib/infrastructureSteps.ts). */}
        <div
          data-space-text
          className="absolute left-[calc(var(--s)*85)] top-[calc(96px+var(--s)*60)] flex w-[calc(var(--s)*627)] flex-col gap-[calc(var(--s)*24)]"
          style={SPACE_HIDDEN}
        >
          <div className="font-mono text-[calc(var(--s)*17)] tracking-[0.02em] text-brand">{SPACE_COPY.eyebrow}</div>
          <h2 className="m-0 font-heading text-[calc(var(--s)*72)] leading-[1.02] font-normal tracking-[-0.025em] text-white">
            {SPACE_COPY.heading}
          </h2>
          <p className="m-0 w-[calc(var(--s)*533)] text-[calc(var(--s)*23)] leading-[1.5] text-white/70">
            {SPACE_COPY.paragraph}
          </p>
        </div>

        {SPACE_CALLOUTS.map((c, i) => (
          <div
            key={c.text}
            data-space-label={i}
            className="absolute right-[calc(var(--s)*85)] whitespace-nowrap font-mono text-[calc(var(--s)*16)] leading-[1.5] text-white/80"
            style={SPACE_HIDDEN}
          >
            {c.text}
          </div>
        ))}

        {[0, 1].map((i) => (
          <Image
            key={i}
            data-space-other
            src="/herosection/for-animation.png"
            alt=""
            width={500}
            height={444}
            className="absolute h-auto"
            style={SPACE_HIDDEN}
          />
        ))}
        <div
          data-space-caption
          className="absolute right-[calc(var(--s)*85)] font-mono text-[calc(var(--s)*15)] text-white/50"
          style={SPACE_HIDDEN}
        >
          other projects · their own machines
        </div>
      </div>

      {/* "02 — your stack": same frame as the "01" overlay above. Chip positions and line paths are
          set by layoutStack() / the line tracker in heroScrollAnimation.ts — the lines are
          re-attached to the server's corners every frame while this is on screen. */}
      <div
        ref={stackRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden h-screen text-left md:block"
        style={SPACE_HIDDEN}
      >
        <div
          data-stack-text
          className="absolute left-[calc(var(--s)*85)] top-[calc(96px+var(--s)*60)] flex w-[calc(var(--s)*627)] flex-col gap-[calc(var(--s)*24)]"
          style={SPACE_HIDDEN}
        >
          <div className="font-mono text-[calc(var(--s)*17)] tracking-[0.02em] text-brand">{STACK_COPY.eyebrow}</div>
          <h2 className="m-0 font-heading text-[calc(var(--s)*72)] leading-[1.02] font-normal tracking-[-0.025em] text-white">
            {STACK_COPY.heading}
          </h2>
          <p className="m-0 w-[calc(var(--s)*533)] text-[calc(var(--s)*23)] leading-[1.5] text-white/70">
            {STACK_COPY.paragraph}
          </p>
        </div>

        {/* The services (lines, chips, label) in one box, so the dive can take them away together
            without fighting the reveal timeline that brings each of them in. */}
        <div data-stack-services className="absolute inset-0">
          <svg data-stack-svg className="absolute inset-0 h-full w-full" fill="none">
            {STACK_CHIPS.map((c, i) => (
              <g key={c.label} data-stack-line={i}>
                <path
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset="1"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="1"
                />
                <circle r="3.5" fill="var(--brand)" opacity="0" />
              </g>
            ))}
          </svg>

          <div
            data-stack-label
            className="absolute right-[calc(var(--s)*85)] top-[calc(96px+var(--s)*60)] flex items-center gap-[calc(var(--s)*13)] font-mono text-[calc(var(--s)*17)] text-brand"
            style={SPACE_HIDDEN}
          >
            <span className="block h-px w-[calc(var(--s)*37)] bg-brand" />
            your project — {STACK_CHIPS.length} services
          </div>

          {STACK_CHIPS.map((c, i) => (
            <div
              key={c.label}
              data-stack-chip={i}
              data-side={c.side}
              data-layer={c.layer}
              className="absolute flex h-[calc(var(--s)*45)] items-center gap-[calc(var(--s)*11)] rounded-[calc(var(--s)*8)] border border-white/40 bg-background px-[calc(var(--s)*16)] font-mono text-[calc(var(--s)*17)] whitespace-nowrap text-white/85"
              style={SPACE_HIDDEN}
            >
              <Image
                src={`/infrastructur/server-icons/${c.icon}.svg`}
                alt=""
                width={68}
                height={68}
                className="h-[calc(var(--s)*24)] w-[calc(var(--s)*24)] object-contain"
                style={{ filter: "brightness(2.6)" }}
              />
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Placeholder that pre-reserves the same scroll distance GSAP's pin-spacer will later add
          (see heroScrollAnimation.ts, where it's collapsed to 0 right before that real pin-spacer
          is created) — server-rendered so the page is the SAME total height before and after
          client JS runs. Without this, a hard refresh while scrolled deep would restore scrollY
          against the shorter pre-hydration document, then destabilize once hydration grew the page
          underneath it — a real, diagnosed bug (see PROJECT.md for the exact repro). */}
      <div ref={ssrScrollReserveRef} aria-hidden="true" style={{ height: s(HERO_PIN_SCROLL_DISTANCE) }} />
    </section>
  );
}
