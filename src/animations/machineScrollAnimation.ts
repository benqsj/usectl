import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { MACHINE_PHASES, MACHINE_PIN_SCROLL_DISTANCE } from "@/lib/machineLayout";
import { readScale } from "@/lib/grid";
import { createStepSwap } from "@/animations/stepSwap";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const PIN_SCROLL_DISTANCE = MACHINE_PIN_SCROLL_DISTANCE;
const P = MACHINE_PHASES;

// Cross marks start scaled down slightly, growing to full size as they fade in. Exported so
// MachineSectionClient.tsx's SSR-hidden inline style uses the exact same value.
export const CROSS_HIDDEN_SCALE = 0.6;
// topside.svg's own start/base scale (it fades in at the base, then grows from there).
export const TOPSIDE_HIDDEN_SCALE = 0.5;
const TOPSIDE_BASE_SCALE = 0.75;
// How much bigger it gets by the time we're through it. Capped deliberately: every new scale makes
// the browser re-rasterise the plate, and past ~10x that costs real frames for no visible gain
// (the plate's edges are long off-screen by then).
const TOPSIDE_MAX_SCALE = 9;

// --- wordmark: SCRUBBED (per user) -------------------------------------------------------------
// The "machine" entrance follows scroll frame by frame instead of playing out on its own: stop
// scrolling and it stops too. Everything below is a pure function of the pin's progress.
// Windows as fractions of that progress: reveal, then (later) the fade-out under the growing plate.
const WORD_REVEALED_AT = 0.1; // fully revealed by here (reveal starts at MACHINE_PHASES.wordIn)
const WORD_GONE_AT = 0.2; // fully gone by here (fade-out starts at MACHINE_PHASES.wordOut)
const CHAR_STAGGER_SPAN = 0.55; // how much of the reveal window the per-character stagger spans
const WORD_HIDDEN_BLUR_PX = 12;
const WORD_HIDDEN_Y_PX = 8;

// Standard "stagger normalised into a fixed window": the last item still reaches 1 at t=1.
const staggerProgress = (t: number, index: number, count: number, span: number) => {
  if (count <= 1) return gsap.utils.clamp(0, 1, t);
  const step = span / (count - 1);
  return gsap.utils.clamp(0, 1, (t - index * step) / (1 - span));
};

// The hatch opening: a rounded square (the plate's own inner panel shape) as a static mask image.
// Only its SIZE animates — mask-composite:exclude punches it out of the plate.
const HOLE_SHAPE = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="2" y="2" width="96" height="96" rx="18" fill="#000"/></svg>',
)}")`;
const HOLE_MASK_IMAGE = `linear-gradient(#000,#000), ${HOLE_SHAPE}`;
// as a % of the plate's own box
const HOLE_MAX_PERCENT = 80;
// The hatch opens ALONGSIDE the growth but well behind it: it only starts once the plate is
// already growing, and its curve is much flatter, so the two finish together. (A "plate first,
// then the hatch" variant was tried 2026-09-18 and rejected — this pacing is the approved one.)
// Slowed down 2026-09-18 (per feedback): the opening was catching up with, and briefly
// outrunning, the plate's own growth by the end of the zoom. Starting later AND lagging
// harder behind the growth curve keeps the hole visibly behind the plate's edge the whole
// way through, not just near the start.
const HOLE_START_AT = 0.18; // fraction of the zoom window before the hatch starts opening at all
const HOLE_CURVE = 3.4; // >1 = the opening lags further behind the growth

const clamp01 = (v: number) => gsap.utils.clamp(0, 1, v);
const easeIO = gsap.parseEase("power2.inOut");
const easeOut = gsap.parseEase("power3.out");
const easeCardIn = gsap.parseEase("power1.out");
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// --- step 3 -> step 4: server separates + icons reveal, then fades into "machine" -------------
// Approved via demo first (see PROJECT.md-style history in this file's siblings): the server
// separates and the 5 infra icons + line-circle.svg reveal one by one, clustered inside
// line-circle.svg, in the gap between the two halves (step 3) — then the top half + icons fade
// out and the "machine" wordmark takes their place, fading out together with the bottom half
// (step 4). Both p1 (step 3's own local progress) and p2 (step 4's) are pure functions of the
// pin's overall `progress`, same as everything else here — so, per explicit feedback that THIS
// specifically must be scrubbed both ways (unlike the triggered text swap elsewhere), scrolling
// back un-reveals everything in reverse, one icon at a time, before the server is allowed to
// close again, and closing/separating never overlaps with the reveal.
const ICON_ORDER = ["storage", "database", "api", "website", "workflow"] as const;
const REVEAL_ITEMS = [...ICON_ORDER, "line-circle"] as const;
type IconKey = (typeof ICON_ORDER)[number];
// Offsets as a FRACTION of the server column's own rendered width/height (not fixed px), from the
// gap's centre — itself measured live from the two halves' actual drawn content (getBBox, not the
// wrapper's rect: both wrapper divs span the identical full canvas) — so the cluster is correctly
// placed at any breakpoint's server-column size (260-650px), not just the one the demo was tuned
// against.
const ICON_OFFSET_PCT: Record<IconKey, { dx: number; dy: number }> = {
  storage: { dx: -0.2118, dy: -0.0627 }, // left, further up
  database: { dx: -0.2118, dy: 0.0697 }, // left, further down
  api: { dx: 0, dy: 0 }, // dead centre, between the two halves
  website: { dx: 0.2118, dy: -0.0627 }, // right, further up
  workflow: { dx: 0.2118, dy: 0.0697 }, // right, further down
};
// Separation finishes growing over step 3's own progress [0, SEP_PROGRESS_END], then holds — the
// rest of the range belongs entirely to the icons, one equal slice each, line-circle last. Lowered
// twice per feedback (was 0.6, then 0.4) so the icons get more of step 3's scroll range each, i.e.
// need more scroll to reveal, one at a time, more slowly.
const SEP_PROGRESS_END = 0.25;
const ICON_RANGE_START = SEP_PROGRESS_END;
const ICON_SLICE = (1 - ICON_RANGE_START) / REVEAL_ITEMS.length;
const BASE_GAP_PERCENT = 1.5; // yPercent -- a small built-in gap even fully "closed"
const SEPARATION_YPERCENT = 31.36; // yPercent each half travels (of its OWN height) at full separation
// Step 4's own timeline (fractions of p2): 0-0.35 top half + icons fade out while the bottom half
// holds at full opacity throughout; the wordmark ramps in over WORD_RAMP_START-WORD_RAMP_END and
// then holds for the rest of step 4 — per feedback, bottom + "machine" do NOT fade out here; that
// only happens as a triggered tween on the step 4 -> step 5 text swap (see the step-swap block).
//
// Retimed 2026-09-18: the word used to start only once the icons were completely gone and to reach
// full strength in the 0.05 that followed, which read as it popping into existence. It now starts
// at 0.15 — while the icons are still on their way out, so the two cross over, which is what was
// asked for — and takes until 0.6 to arrive.
const TOP_ICONS_FADE_END = 0.35;
const WORD_RAMP_START = 0.15;
const WORD_RAMP_END = 0.6;

// --- steps 5+: the per-step diagrams assemble themselves -----------------------------------------
// Same idea as step 3's icon reveal, and scrubbed the same way (a pure function of the pin's
// progress, so scrolling back takes them apart again piece by piece): each diagram's pieces arrive
// in DOM order — see MachineInfraDiagram.tsx / MachineDeployDiagram.tsx — every piece's own drawn
// border leading, its contents (icon + text) following a beat later.
//
// TRIGGERED, NOT SCRUBBED (changed 2026-09-18, per explicit feedback — the first version scrubbed
// these off the pin's progress like step 3's icons do). Arriving at the step now just STARTS the
// sequence and it plays out at its own pace, so how fast the reader scrolls no longer decides how
// the diagram assembles: the pieces always come in one after another, evenly, and the step's own
// scroll range (steps 5 and 6 are double-width, see STEP_WEIGHTS) is the room left over for
// carrying on scrolling once it has finished. Leaving the step fades the whole thing out and
// resets it, so coming back plays it again from the start.
const DIAGRAM_PIECE_DURATION = 0.6; // seconds, per piece
const DIAGRAM_PIECE_STAGGER = 0.18; // seconds between one piece and the next
const DIAGRAM_CONTENT_DELAY = 0.18; // a piece's contents follow its own border by this much
const DIAGRAM_OUT_DURATION = 0.5;
const DIAGRAM_EASE = "power2.out";
const DIAGRAM_HIDDEN_SCALE = 0.96;
const DIAGRAM_HIDDEN_Y = 7; // px it rises from

interface DiagramPiece {
  border: HTMLElement | null;
  content: HTMLElement | null;
}

interface DiagramEntry {
  el: HTMLElement;
  stepIndex: number;
  // Last step this diagram stays up for (inclusive). Usually the same as stepIndex; steps that
  // share their text with the next one (7+8) set data-diagram-until so the visual spans both and
  // arrives with the text rather than a step later.
  untilStep: number;
  pieces: DiagramPiece[];
  timeline: gsap.core.Timeline | null;
}

const DIAGRAM_HIDDEN = { opacity: 0, scale: DIAGRAM_HIDDEN_SCALE, y: DIAGRAM_HIDDEN_Y };
const DIAGRAM_SHOWN = { opacity: 1, scale: 1, y: 0 };

interface EdgeRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// The tight, screen-mapped bounding box of a server part's ACTUAL drawn content (via getBBox +
// getScreenCTM) — not `part.getBoundingClientRect()`, which would just return the full shared
// canvas both parts' wrapper divs span.
function contentRect(part: HTMLElement): EdgeRect {
  const svg = part.querySelector<SVGSVGElement>("svg");
  const fallback = part.getBoundingClientRect();
  if (!svg) return fallback;
  let bbox: DOMRect;
  let ctm: DOMMatrix | null;
  try {
    bbox = svg.getBBox();
    ctm = svg.getScreenCTM();
  } catch {
    return fallback;
  }
  if (!ctm) return fallback;
  const p1 = new DOMPoint(bbox.x, bbox.y).matrixTransform(ctm);
  const p2 = new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height).matrixTransform(ctm);
  return {
    left: Math.min(p1.x, p2.x),
    right: Math.max(p1.x, p2.x),
    top: Math.min(p1.y, p2.y),
    bottom: Math.max(p1.y, p2.y),
  };
}

// The gap's centre: midpoint between the top half's actual visible bottom edge and the bottom
// half's actual top edge, in iconField-local coordinates — plus the field's own rendered size, so
// callers can turn the fractional offsets above into px at whatever size this breakpoint renders.
function getGapCenter(top: HTMLElement, bottom: HTMLElement, field: HTMLElement) {
  const topRect = contentRect(top);
  const bottomRect = contentRect(bottom);
  const fieldRect = field.getBoundingClientRect();
  return {
    x: (topRect.left + topRect.right) / 2 - fieldRect.left,
    y: (topRect.bottom + bottomRect.top) / 2 - fieldRect.top,
    fieldWidth: fieldRect.width,
    fieldHeight: fieldRect.height,
  };
}

// The 6 steps (3-8) no longer split the post-approach range evenly: step 3 (index 0) gets extra
// scroll room for the icon reveal — twice an ordinary step's width, per feedback ("icons need 2x
// the scroll to finish") — and every other step keeps its original width. Weights are in units of
// one ORIGINAL (uniform-6-way) step-width; 5 vs 2 works out to exactly that: step 3 = 5/15 = 1/3 of
// the post-approach range = 2x the original 1/6, and each other step = 2/15 = 0.8x its original
// width (a ~20% trim — the range itself didn't grow, so step 3's extra has to come from somewhere).
//
// Every step that carries a diagram (indices 2-5) is double-width: at one ordinary step's width
// those assembled far too quickly, and the extra room is what they hold still for once the sequence
// has played. Index 4 joined them when the agent diagram moved onto step 7 — it's the step the
// sequence now actually starts on. The pin itself grew by exactly the added weight each time
// (7200 -> 8000 -> 8400 -> 8800, see machineLayout.ts), so a weight unit is still the same ~200px
// of scroll it always was and no other step changed length.
const STEP_WEIGHTS = [5, 2, 4, 4, 4, 4];

// Cumulative start fraction (of the post-approach [P.cardEnd, 1] range) for each step, plus a
// lookup from a progress fraction back to the step index it falls in. Falls back to plain uniform
// division if `count` doesn't match STEP_WEIGHTS' own length (e.g. the step content changes size).
function stepBoundaries(count: number) {
  const weights = STEP_WEIGHTS.length === count ? STEP_WEIGHTS : Array(count).fill(1);
  const total = weights.reduce((a, b) => a + b, 0);
  const starts: number[] = [];
  let acc = 0;
  for (const w of weights) {
    starts.push(acc);
    acc += w / total;
  }
  return { starts, widths: weights.map((w) => w / total) };
}

function stepIndexAt(starts: number[], fraction: number): number {
  for (let i = starts.length - 1; i >= 0; i--) {
    if (fraction >= starts[i]) return i;
  }
  return 0;
}

// The card shows up once the hatch is P.cardAtHole open — derived from the hole curve (hole = t²)
// rather than hardcoded, so it stays correct if the zoom range is retimed.
// hole as a function of the growth's own progress `t`
const holeAt = (t: number) => Math.pow(clamp01((t - HOLE_START_AT) / (1 - HOLE_START_AT)), HOLE_CURVE);
const zoomTimeAtHole = (hole: number) => HOLE_START_AT + Math.pow(hole, 1 / HOLE_CURVE) * (1 - HOLE_START_AT);
// the card shows up once the hatch is P.cardAtHole open — inverse of the curve above
const CARD_START = P.zoomStart + zoomTimeAtHole(P.cardAtHole) * (P.zoomEnd - P.zoomStart);

interface MachineScrollRefs {
  // Pin trigger AND pin target — the whole full-viewport screen.
  sectionRef: RefObject<HTMLElement | null>;
  // Wrapper around hatch + wordmark + crosses.
  wordmarkRef: RefObject<HTMLElement | null>;
  hatchRef: RefObject<HTMLElement | null>;
  crossRefs: RefObject<(HTMLElement | null)[]>;
  // topside.svg — grows, and its middle opens, as we fly through it.
  topsideRef: RefObject<HTMLElement | null>;
  // Light green wash right after we're inside; fades out before the content has arrived.
  tintRef: RefObject<HTMLElement | null>;
  // The steps 3-8 card, rendered INSIDE this pinned screen (no page scroll in between): it comes
  // towards the viewer out of the depth and then stays put while the steps change.
  cardRef: RefObject<HTMLElement | null>;
  // The card's static-bar green fill (clipped left-to-right across the six steps).
  fillRef: RefObject<HTMLElement | null>;
  stepCount: number;
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
}

// ONE pin for the whole "machine" sequence (per the approved demo):
//   wordmark entrance (triggered)
//   -> topside fades in ON TOP of it and starts growing the moment the wordmark starts leaving
//   -> the growth never pauses; the hatch opens alongside it, just slower (hole = t²), so both
//      finish together and we end up through the opening (all scrubbed)
//   -> at 90% open the steps 3-8 card is already there, small and far away, and scroll flies us
//      towards it until it sits at full size (scrubbed)
//   -> then the six steps swap their text (triggered, same as everywhere else) while the static
//      bar fills (scrubbed).
export function useMachineScrollAnimation({
  sectionRef,
  wordmarkRef,
  hatchRef,
  crossRefs,
  topsideRef,
  tintRef,
  cardRef,
  fillRef,
  stepCount,
  ssrScrollReserveRef,
}: MachineScrollRefs) {
  // Survives React 19 StrictMode's dev-only mount -> cleanup -> remount cycle — see the matching
  // comment in heroScrollAnimation.ts.
  const scrollYBeforeChurnRef = useRef<number | null>(null);

  useGSAP(
    (_context, contextSafe) => {
      if (scrollYBeforeChurnRef.current === null) scrollYBeforeChurnRef.current = window.scrollY;

      // Collapse the SSR placeholder before anything else, on every code path (including
      // prefers-reduced-motion, which never creates a real pin-spacer).
      if (ssrScrollReserveRef.current) ssrScrollReserveRef.current.style.height = "0px";

      const section = sectionRef.current;
      const wordmark = wordmarkRef.current;
      const hatch = hatchRef.current;
      const topside = topsideRef.current;
      const tint = tintRef.current;
      const card = cardRef.current;
      const fill = fillRef.current;
      const chars = section ? Array.from(section.querySelectorAll<HTMLElement>("[data-blur-char]")) : [];
      const crosses = crossRefs.current.filter((el): el is HTMLElement => el !== null);
      if (!section || !wordmark || !hatch || !topside || !card || !fill || chars.length === 0) return;

      const steps = createStepSwap(card);

      // Step 3 -> step 4's own elements (present only once the right column got swapped from the
      // static stack to the 2-part machineServer — see MachineSection.tsx). Queried once, like
      // `chars`/`crosses` above, and guarded everywhere below so the section still works if this
      // card ever goes back to rendering the plain stack.
      const serverTop = card.querySelector<HTMLElement>('[data-server-part="top"]');
      const serverBottom = card.querySelector<HTMLElement>('[data-server-part="bottom"]');
      const iconField = card.querySelector<HTMLElement>("[data-icon-field]");
      const iconNodes = iconField
        ? new Map(
            Array.from(iconField.querySelectorAll<HTMLElement>("[data-icon-node]")).map((el) => [
              el.dataset.iconNode as IconKey | "line-circle",
              el,
            ]),
          )
        : null;
      const machineWord = card.querySelector<HTMLElement>("[data-machine-word]");
      const hasStep34Visual = !!(serverTop && serverBottom && iconField && iconNodes && machineWord);

      // Step 3 is the first (weighted) slice after the card finishes approaching (P.cardEnd), step
      // 4 the second — same boundaries `nextStep` below looks up, just kept as local progress
      // fractions (p1/p2) for this sub-animation instead of a discrete step index.
      const { starts: stepStarts, widths: stepWidths } = stepBoundaries(stepCount);
      const step3Start = P.cardEnd + stepStarts[0] * (1 - P.cardEnd);
      const step3Width = stepWidths[0] * (1 - P.cardEnd);
      const step4Start = P.cardEnd + (stepStarts[1] ?? 1) * (1 - P.cardEnd);
      const step4Width = (stepWidths[1] ?? stepWidths[0]) * (1 - P.cardEnd);

      // The per-step right-column diagrams (step 5's Pod diagram, step 6's deploy chain, …). Each
      // wrapper says which step index it belongs to; its pieces are revealed one at a time in DOM
      // order, each as a border + contents pair. Queried once, like everything else above, and the
      // whole feature is a no-op when the card carries none of them.
      // The card's own outline. Steps 6-8 (indices 3-5) drop it entirely: those steps' diagrams are
      // wider than the column they sit in and were crossing the border, which read as broken.
      const cardDiagonal = card.querySelector<HTMLElement>("[data-card-diagonal]");
      const CARD_BORDER_COLOR = "rgba(255,255,255,0.1)"; // what `border-white/10` resolves to
      const BORDERLESS_FROM_STEP = 3;

      const diagrams: DiagramEntry[] = Array.from(
        card.querySelectorAll<HTMLElement>("[data-machine-diagram]"),
      ).map((el) => ({
        el,
        stepIndex: Number(el.dataset.diagramStep ?? -1),
        untilStep: Number(el.dataset.diagramUntil ?? el.dataset.diagramStep ?? -1),
        pieces: Array.from(el.querySelectorAll<HTMLElement>("[data-diagram-item]")).map((item) => ({
          border: item.querySelector<HTMLElement>("[data-diagram-border]"),
          content: item.querySelector<HTMLElement>("[data-diagram-content]"),
        })),
        timeline: null,
      }));

      // Back to the start: nothing drawn, and any half-played sequence dropped.
      const resetDiagram = (d: DiagramEntry) => {
        d.timeline?.kill();
        d.timeline = null;
        d.pieces.forEach(({ border, content }) => {
          if (border) gsap.set(border, DIAGRAM_HIDDEN);
          if (content) gsap.set(content, DIAGRAM_HIDDEN);
        });
      };

      // Fully assembled with no animation — for refreshes and for landing mid-step on load, where
      // replaying the sequence would be wrong.
      const showDiagramAtOnce = (d: DiagramEntry) => {
        d.timeline?.kill();
        d.timeline = null;
        d.pieces.forEach(({ border, content }) => {
          if (border) gsap.set(border, DIAGRAM_SHOWN);
          if (content) gsap.set(content, DIAGRAM_SHOWN);
        });
      };

      // The sequence itself: piece after piece, each one's border first and its icons/text just
      // behind. Runs on its own clock — the only thing scroll decides is when it starts.
      const playDiagram = (d: DiagramEntry) => {
        resetDiagram(d);
        const tl = gsap.timeline();
        d.pieces.forEach(({ border, content }, i) => {
          const at = i * DIAGRAM_PIECE_STAGGER;
          if (border) tl.to(border, { ...DIAGRAM_SHOWN, duration: DIAGRAM_PIECE_DURATION, ease: DIAGRAM_EASE }, at);
          if (content)
            tl.to(
              content,
              { ...DIAGRAM_SHOWN, duration: DIAGRAM_PIECE_DURATION, ease: DIAGRAM_EASE },
              at + DIAGRAM_CONTENT_DELAY,
            );
        });
        d.timeline = tl;
      };

      // Pure function of scroll progress — reveal (staggered per character), then fade-out as the
      // plate takes over. Nothing here plays on its own, so stopping the scroll stops the motion.
      const applyWordmark = (progress: number) => {
        const reveal = clamp01((progress - P.wordIn) / (WORD_REVEALED_AT - P.wordIn));
        const exit = clamp01((progress - P.wordOut) / (WORD_GONE_AT - P.wordOut));

        const hatchIn = easeOut(clamp01(reveal / 0.35));
        gsap.set(hatch, {
          opacity: hatchIn,
          filter: `blur(${(1 - hatchIn) * WORD_HIDDEN_BLUR_PX}px)`,
          y: (1 - hatchIn) * WORD_HIDDEN_Y_PX,
        });
        chars.forEach((char, i) => {
          const v = easeOut(staggerProgress(reveal, i, chars.length, CHAR_STAGGER_SPAN));
          gsap.set(char, {
            opacity: v,
            filter: `blur(${(1 - v) * WORD_HIDDEN_BLUR_PX}px)`,
            y: (1 - v) * WORD_HIDDEN_Y_PX,
          });
        });
        const crossIn = easeOut(clamp01((reveal - 0.55) / 0.45));
        gsap.set(crosses, { opacity: crossIn, scale: CROSS_HIDDEN_SCALE + (1 - CROSS_HIDDEN_SCALE) * crossIn });

        gsap.set(wordmark, {
          opacity: 1 - exit,
          filter: exit > 0 ? `blur(${exit * WORD_HIDDEN_BLUR_PX}px)` : "none",
        });
      };

      applyWordmark(0);
      gsap.set(topside, { opacity: 0, scale: TOPSIDE_HIDDEN_SCALE });
      gsap.set(card, { opacity: 0, scale: 0.52 });
      if (tint) gsap.set(tint, { opacity: 0 });
      steps.jumpToStep(0);
      if (hasStep34Visual) {
        gsap.set([serverTop!, serverBottom!], { opacity: 1, yPercent: 0 });
        gsap.set(Array.from(iconNodes!.values()), { opacity: 0, scale: 0.55, xPercent: -50, yPercent: -50 });
        gsap.set(machineWord!, { opacity: 0, scale: 0.55, xPercent: -50, yPercent: -50 });
      }
      diagrams.forEach((d) => {
        gsap.set(d.el, { opacity: 0 });
        resetDiagram(d);
      });

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // No pin, no motion: the wordmark and the content are simply there, the plate is not.
        applyWordmark(WORD_REVEALED_AT);
        gsap.set(topside, { opacity: 0 });
        gsap.set(card, { opacity: 1, scale: 1, filter: "none" });
        gsap.set(fill, { clipPath: "inset(0% 0% 0% 0%)" });
        return;
      }

      gsap.set(fill, { clipPath: "inset(0% 100% 0% 0%)" });

      let currentStep = 0;
      const instantUntil = performance.now() + 250;

      const applyProgress = contextSafe!((progress: number, forceInstant: boolean) => {
        const instant = forceInstant || performance.now() < instantUntil;

        // 1) wordmark — scrubbed
        applyWordmark(progress);

        // 2+3) topside: fades in over the wordmark, then ONE continuous exponential ramp (constant
        // "speed towards you", no plateau) while its hatch opens on a slower, squared curve.
        const fadeIn = clamp01((progress - P.plateIn) / (P.plateFull - P.plateIn));
        const t = clamp01((progress - P.zoomStart) / (P.zoomEnd - P.zoomStart));
        const scale = TOPSIDE_BASE_SCALE * Math.pow(TOPSIDE_MAX_SCALE / TOPSIDE_BASE_SCALE, Math.pow(t, 1.6));
        const holePercent = holeAt(t) * HOLE_MAX_PERCENT;
        gsap.set(topside, {
          opacity: fadeIn * (1 - clamp01((t - 0.93) / 0.07)),
          scale,
          webkitMaskImage: HOLE_MASK_IMAGE,
          maskImage: HOLE_MASK_IMAGE,
          webkitMaskSize: `100% 100%, ${holePercent}% ${holePercent}%`,
          maskSize: `100% 100%, ${holePercent}% ${holePercent}%`,
        });

        // 4) the card: already there when the hatch is ~90% open, then flown towards, slowly
        const approachRaw = clamp01((progress - CARD_START) / (P.cardEnd - CARD_START));
        const approach = easeCardIn(approachRaw);
        // blur only while it's still small — a blur filter on a full-size card is expensive
        const cardBlur = Math.max(0, 1 - approachRaw * 3) * 10;
        gsap.set(card, {
          opacity: Math.min(1, approachRaw * 4),
          scale: 0.52 + 0.48 * approach,
          force3D: true,
          filter: cardBlur > 0.15 ? `blur(${cardBlur.toFixed(2)}px)` : "none",
        });
        if (tint) {
          gsap.set(tint, {
            opacity:
              progress <= P.zoomStart
                ? 0
                : (1 - gsap.parseEase("power1.in")(clamp01(approachRaw / 0.85))) * easeIO(clamp01((t - 0.3) / 0.4)),
          });
        }

        // 5) the six steps, inside — step 3 (index 0) is a wider slice than the rest (see
        // stepBoundaries), so this is a lookup against its actual boundaries, not a plain
        // ((progress - cardEnd) / (1 - cardEnd)) * stepCount division.
        gsap.set(fill, { clipPath: `inset(0% ${100 - 100 * clamp01((progress - P.cardEnd) / (1 - P.cardEnd))}% 0% 0%)` });
        const nextStep = stepIndexAt(stepStarts, clamp01((progress - P.cardEnd) / (1 - P.cardEnd)));
        if (nextStep !== currentStep || instant) {
          const prevStep = currentStep;
          if (instant) steps.jumpToStep(nextStep);
          else if (nextStep !== currentStep) steps.animateToStep(nextStep, currentStep);

          // Step 4 (index 1) -> step 5 (index 2): the bottom half + "machine" wordmark fade out
          // HERE, triggered together with the text swap — per feedback, they hold at full
          // strength through the rest of step 4 (see the scrubbed block below) instead of fading
          // mid-scroll, and only go away once the text actually moves on to step 5. `prevStep < 2`
          // (rather than `=== 1`) so a scroll fast enough to skip straight past step 4 still fades
          // them, same as animateToStep already treats any-size step jumps as one swap.
          // Their exit was 0.6s of straight power2.out fade, which read as them blinking off rather
          // than leaving. Now it's twice as long, on a gentle in-out, and the bottom half drifts a
          // little further down as it goes so there's some movement to follow. (The `y` has to be
          // put back when scrolling into this from the other side — see the p2 < 1 block below —
          // because nothing else writes it.)
          if (hasStep34Visual && instant && nextStep >= 2) {
            gsap.set([serverBottom!, machineWord!], { opacity: 0 });
            gsap.set(serverBottom!, { y: 40 });
          } else if (hasStep34Visual && !instant && nextStep >= 2 && prevStep < 2) {
            gsap.killTweensOf([serverBottom!, machineWord!]);
            gsap.to([serverBottom!, machineWord!], { opacity: 0, duration: 1.2, ease: "power1.inOut" });
            gsap.to(serverBottom!, { y: 40, duration: 1.4, ease: "power1.inOut" });
          }

          // Each diagram is on for its own step and off everywhere else — and arriving at that
          // step is the ONLY thing that starts its sequence (see playDiagram: it then runs on its
          // own clock, not on scroll). Leaving fades the whole thing out and resets it, so coming
          // back plays it again from the first piece.
          // Card outline on/off — see BORDERLESS_FROM_STEP above.
          {
            const outlined = nextStep < BORDERLESS_FROM_STEP;
            const wasOutlined = prevStep < BORDERLESS_FROM_STEP;
            const targets = cardDiagonal ? [card, cardDiagonal] : [card];
            if (instant) {
              gsap.killTweensOf(targets);
              gsap.set(card, { borderColor: outlined ? CARD_BORDER_COLOR : "rgba(255,255,255,0)" });
              if (cardDiagonal) gsap.set(cardDiagonal, { opacity: outlined ? 1 : 0 });
            } else if (outlined !== wasOutlined) {
              gsap.killTweensOf(targets);
              gsap.to(card, {
                borderColor: outlined ? CARD_BORDER_COLOR : "rgba(255,255,255,0)",
                duration: 0.5,
                ease: "power1.inOut",
              });
              if (cardDiagonal)
                gsap.to(cardDiagonal, { opacity: outlined ? 1 : 0, duration: 0.5, ease: "power1.inOut" });
            }
          }

          diagrams.forEach((d) => {
            // A diagram can cover a RANGE of steps (stepIndex..untilStep) — moving between steps
            // inside that range leaves it alone, so it plays once, on the way in.
            const inRange = (step: number) => step >= d.stepIndex && step <= d.untilStep;
            const show = inRange(nextStep);
            if (instant) {
              gsap.killTweensOf(d.el);
              gsap.set(d.el, { opacity: show ? 1 : 0 });
              if (show) showDiagramAtOnce(d);
              else resetDiagram(d);
            } else if (show !== inRange(prevStep)) {
              gsap.killTweensOf(d.el);
              if (show) {
                gsap.set(d.el, { opacity: 1 });
                playDiagram(d);
              } else {
                gsap.to(d.el, {
                  opacity: 0,
                  duration: DIAGRAM_OUT_DURATION,
                  ease: "power1.inOut",
                  onComplete: () => resetDiagram(d),
                });
              }
            }
          });

          currentStep = nextStep;
        }

        // 6) step 3 -> step 4: server separates + icons reveal, then fades into "machine" —
        // scrubbed both ways off the SAME `progress`, so it can't drift from the step above.
        // Per feedback, the bottom half + "machine" do NOT fade out as part of this scrub — once
        // revealed they just hold (p2 up to 1, i.e. right through the rest of step 4): they only
        // fade away as a normal TRIGGERED tween, together with the text swap into step 5 (see the
        // step-swap block below), same as everything else that changes on a step boundary.
        if (hasStep34Visual) {
          const p1 = clamp01((progress - step3Start) / step3Width);
          const p2 = clamp01((progress - step4Start) / step4Width);

          const sepFraction = clamp01(p1 / SEP_PROGRESS_END);
          const topOpacity = lerp(1, 0, p2 / TOP_ICONS_FADE_END);

          gsap.set(serverTop!, { opacity: topOpacity, yPercent: -(sepFraction * SEPARATION_YPERCENT) });
          gsap.set(serverBottom!, { yPercent: BASE_GAP_PERCENT + sepFraction * SEPARATION_YPERCENT });

          const center = getGapCenter(serverTop!, serverBottom!, iconField!);
          REVEAL_ITEMS.forEach((key, i) => {
            const node = iconNodes!.get(key);
            if (!node) return;
            const start = ICON_RANGE_START + i * ICON_SLICE;
            const eased = easeOutCubic(clamp01((p1 - start) / ICON_SLICE));
            const off = key === "line-circle" ? { dx: 0, dy: 0 } : ICON_OFFSET_PCT[key];
            gsap.set(node, {
              left: center.x + off.dx * center.fieldWidth,
              top: center.y + off.dy * center.fieldHeight,
              opacity: eased * topOpacity,
              scale: lerp(0.55, 1, eased),
            });
          });

          const wordRampRaw =
            p2 <= WORD_RAMP_START
              ? 0
              : p2 <= WORD_RAMP_END
                ? (p2 - WORD_RAMP_START) / (WORD_RAMP_END - WORD_RAMP_START)
                : 1;
          const wordRamp = easeOutCubic(clamp01(wordRampRaw));
          gsap.set(machineWord!, { left: center.x, top: center.y, scale: lerp(0.55, 1, wordRamp) });

          // Bottom half + "machine" opacity: only while still short of step 5 (p2 < 1) — hold at
          // full strength (bottom always visible, word following its ramp-in) the instant it steps
          // outside that range ownership passes to the triggered tween below, which is the only
          // thing allowed to take it to 0 (and back), so this per-frame code can't fight it.
          if (p2 < 1) {
            gsap.set(serverBottom!, { opacity: 1, y: 0 });
            gsap.set(machineWord!, { opacity: wordRamp });
          }
        }

        // (The step 5+ diagrams are deliberately NOT handled here: they are triggered on the step
        // boundary above and play on their own clock. See the DIAGRAM_* block at the top.)
      });

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: () => `+=${PIN_SCROLL_DISTANCE * readScale()}`,
        scrub: true,
        pin: true,
        pinSpacing: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => applyProgress(self.progress, false),
        onRefresh: (self) => applyProgress(self.progress, true),
        // onUpdate only fires INSIDE the pinned range, so the scene has to be put straight when
        // scroll leaves it either way — otherwise a refresh that happened while scrolled past
        // leaves a stale step showing once you come back.
        onLeave: () => applyProgress(1, true),
        onLeaveBack: () => applyProgress(0, true),
      });

      // Restores whatever scrollY was BEFORE StrictMode's dev-only churn clamped it away — same
      // mechanism as heroScrollAnimation.ts.
      const targetScrollY = scrollYBeforeChurnRef.current;
      if (targetScrollY !== null) {
        setTimeout(() => {
          if (window.scrollY !== targetScrollY) window.scrollTo(0, targetScrollY);
        }, 100);
      }
    },
    { scope: sectionRef, dependencies: [stepCount] },
  );
}
