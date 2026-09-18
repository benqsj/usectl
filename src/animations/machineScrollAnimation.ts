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
// SCRUBBED — a pure function of the pin's progress, like step 3's icon reveal.
//
// This went triggered (a self-playing timeline started on the step boundary) for a while, on the
// grounds that the sequence should look the same however fast you scroll. It came back on
// 2026-09-18 because of what that cost going the other way: a timeline only plays FORWARD, so
// scrolling up from step 8 re-assembled each earlier diagram front-to-back instead of taking it
// apart, and a quick flick crossed three boundaries in a few frames, killing and rebuilding
// timelines mid-flight ("ანიმაციები ძაან უშნოვდება"). Scrubbing gives the reverse for free — every
// piece is a function of where the scroll is, so going back up un-assembles it in exact reverse —
// and the smoothness that the timeline was there to provide now comes from the scrub's own easing
// (`scrub: SCRUB_SECONDS` below) plus a much wider per-piece window.
//
// Each piece's fade spans DIAGRAM_ITEM_WINDOW of its diagram's range, far more than the gap between
// one piece and the next, so neighbours overlap heavily and the thing flows together rather than
// clicking into place one card at a time.
const DIAGRAM_ENTRY_DELAY = 0.1; // a beat after the text swap before the first piece starts
const DIAGRAM_REVEAL_END = 0.75; // everything is in by here; the rest of the range holds still
const DIAGRAM_ITEM_WINDOW = 0.34; // how much of the range ONE piece's own fade spans
const DIAGRAM_CONTENT_LAG = 0.3; // fraction of that window before the piece's contents follow
const DIAGRAM_WRAPPER_FADE = 0.06; // range fraction the whole diagram cross-fades over at each end
const DIAGRAM_HIDDEN_SCALE = 0.96;
const DIAGRAM_HIDDEN_Y = 7; // px it rises from
const easeDiagram = gsap.parseEase("power1.inOut");

// Step 4's own exit: the last STEP4_EXIT_START..1 of its range is where the bottom half and the
// "machine" wordmark leave, so they are gone before the text reaches step 5.
const STEP4_EXIT_START = 0.7;
const STEP4_EXIT_DRIFT_PX = 40;
// How much of the PIN's progress the card's outline cross-fades over at the step 5 -> 6 boundary.
const CARD_OUTLINE_FADE = 0.012;
// Catch-up smoothing. Raw scroll tracks 1:1, so one flick of the wheel can cross three step
// boundaries inside a single frame; easing the progress we RENDER toward the progress the scroll
// asks for turns that into a glide through the steps instead of a teleport, which is most of what
// made fast scrolling — in either direction — look broken.
//
// Why it isn't just `scrub: 0.8` on the ScrollTrigger: that was tried, and it silently killed the
// whole sequence. A numeric `scrub` only means something for a trigger that drives an ANIMATION;
// this one drives nothing but callbacks (`onUpdate` -> applyProgress), and with a number there the
// trigger still pinned but never called them again — measured in the browser, every value frozen at
// its initial state the whole way down the pin. So the catch-up is done here instead, with exactly
// the mechanism GSAP's own scrub uses: a tween on a proxy number, re-aimed on every scroll event.
const SCRUB_SECONDS = 0.6;

interface DiagramPiece {
  border: HTMLElement | null;
  content: HTMLElement | null;
}

interface DiagramEntry {
  el: HTMLElement;
  // The range of steps this diagram is up for, inclusive. Steps that share their text with the next
  // one (7+8) span both via data-diagram-until, so the visual arrives with the text.
  stepIndex: number;
  untilStep: number;
  pieces: DiagramPiece[];
  // Its span in the PIN's own progress, worked out once from the step boundaries.
  start: number;
  end: number;
  revealSpan: number;
  stagger: number;
  // What its pieces were last parked at while the diagram was invisible: 0 (before its range) or 1
  // (after it). Null while it is on screen and being written every frame. See the reveal block.
  restState: number | null;
}

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
// Weights in units of one ORIGINAL (uniform-six-way) step. Step 3 keeps its extra room for the icon
// reveal; every other step is now 4-5 units rather than 2, because each of them carries either a
// whole diagram to assemble or (step 4) a reveal AND an exit window, and at one ordinary step's
// width those went by far too fast. The pin itself grew by exactly the added weight each time
// (7200 -> 8000 -> 8400 -> 8800 -> 10000, see machineLayout.ts), so a weight unit is still the same
// ~200px of scroll it always was and the entrance/flight/approach ahead of the steps never moved.
const STEP_WEIGHTS = [5, 4, 5, 5, 5, 5];

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
      const BORDERLESS_FROM_STEP = 3;

      const stepSpan = (i: number) => {
        const from = P.cardEnd + (stepStarts[i] ?? 1) * (1 - P.cardEnd);
        return { from, to: from + (stepWidths[i] ?? stepWidths[0]) * (1 - P.cardEnd) };
      };

      const diagrams: DiagramEntry[] = Array.from(
        card.querySelectorAll<HTMLElement>("[data-machine-diagram]"),
      ).map((el) => {
        const stepIndex = Number(el.dataset.diagramStep ?? -1);
        const untilStep = Number(el.dataset.diagramUntil ?? el.dataset.diagramStep ?? -1);
        const pieces = Array.from(el.querySelectorAll<HTMLElement>("[data-diagram-item]")).map((item) => ({
          border: item.querySelector<HTMLElement>("[data-diagram-border]"),
          content: item.querySelector<HTMLElement>("[data-diagram-content]"),
        }));
        const { from, to: firstStepEnd } = stepSpan(stepIndex);
        const { to } = stepSpan(untilStep);
        // Last piece still lands on DIAGRAM_REVEAL_END, so the stagger closes up as pieces are added.
        const usable = Math.max(DIAGRAM_REVEAL_END - DIAGRAM_ENTRY_DELAY - DIAGRAM_ITEM_WINDOW, 0);
        return {
          el,
          stepIndex,
          untilStep,
          pieces,
          start: from,
          end: to,
          // The pieces come in over the FIRST step only, even when the diagram stays up for two of
          // them (steps 7+8 share their text, so the agent diagram spans both) — otherwise the
          // assembly would stretch across a step and a half and crawl.
          revealSpan: firstStepEnd - from,
          stagger: pieces.length > 1 ? usable / (pieces.length - 1) : 0,
          restState: null,
        };
      });

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
        d.pieces.forEach(({ border, content }) => {
          const hidden = { opacity: 0, scale: DIAGRAM_HIDDEN_SCALE, y: DIAGRAM_HIDDEN_Y };
          if (border) gsap.set(border, hidden);
          if (content) gsap.set(content, hidden);
        });
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
          // The text swap is the ONLY thing still triggered on a step boundary. Everything that used
          // to live here — the server bottom + "machine" exit, the card's outline, the diagram on/off
          // switch — is scrubbed further down instead: a boundary is a moment, and a state written
          // only at a moment can neither reverse nor be re-derived after a refresh, which is exactly
          // what made scrolling back up fall apart.
          if (instant) steps.jumpToStep(nextStep);
          else steps.animateToStep(nextStep, currentStep);
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

          // The exit, scrubbed: over the last stretch of step 4 the bottom half and the wordmark
          // fade away and the bottom half drifts a little further down, so both are GONE before the
          // text swaps to step 5 — which is what was asked for, and it also means scrolling back up
          // brings them in again in exact reverse. This used to be a tween fired on the step
          // boundary, which could neither reverse nor survive a refresh, and fought this same
          // per-frame code for ownership of `opacity`.
          const exit = easeDiagram(clamp01((p2 - STEP4_EXIT_START) / (1 - STEP4_EXIT_START)));
          gsap.set(serverBottom!, { opacity: 1 - exit, y: exit * STEP4_EXIT_DRIFT_PX });
          gsap.set(machineWord!, { opacity: wordRamp * (1 - exit) });
        }

        // 7) the card's own outline: on for steps 3-5, off for 6-8 (those diagrams are wider than
        // the column and crossed it). Derived from progress with a short cross-fade either side of
        // the boundary, so it reverses with everything else.
        {
          const { from: borderlessAt } = stepSpan(BORDERLESS_FROM_STEP);
          const off = clamp01((progress - borderlessAt + CARD_OUTLINE_FADE / 2) / CARD_OUTLINE_FADE);
          gsap.set(card, { borderColor: `rgba(255,255,255,${0.1 * (1 - off)})` });
          if (cardDiagonal) gsap.set(cardDiagonal, { opacity: 1 - off });
        }

        // 8) steps 5+: each diagram assembles itself piece by piece across its own step range —
        // frame first, then each card, every piece's border leading its contents. All of it is a
        // pure function of `progress`, so scrolling back up takes it apart in the same order it was
        // built, and a refresh lands on exactly the right state with nothing to re-assert.
        diagrams.forEach((d) => {
          const span = d.end - d.start;
          const p = span > 0 ? (progress - d.start) / span : 0;
          // The reveal runs on the first step's clock; the wrapper's own fade uses the whole range.
          const pReveal = d.revealSpan > 0 ? (progress - d.start) / d.revealSpan : 0;
          // Cross-fades in and out at the edges of its own range so two diagrams never cut over
          // each other, and is fully transparent outside it.
          const wrapper = clamp01(
            Math.min(p / DIAGRAM_WRAPPER_FADE, (1 - p) / DIAGRAM_WRAPPER_FADE, 1),
          );
          gsap.set(d.el, { opacity: wrapper });

          // Invisible: park the pieces at the end state that matches WHICH side of the range we are
          // on — hidden before it, fully built after it — and only when that changes, so an
          // off-screen diagram costs nothing per frame.
          //
          // This used to be a bare `return`, which was the bug behind "it doesn't take itself apart
          // when I scroll back up": once a diagram faded out its pieces were never written again, so
          // they stayed frozen fully-revealed, and scrolling back into it faded in a diagram that
          // was already finished. Measured in the browser — every piece read 1.00 with the wrapper
          // at 0.00.
          if (wrapper <= 0) {
            const rest = p < 0 ? 0 : 1;
            if (d.restState !== rest) {
              d.pieces.forEach(({ border, content }) => {
                const v = { opacity: rest, scale: lerp(DIAGRAM_HIDDEN_SCALE, 1, rest), y: lerp(DIAGRAM_HIDDEN_Y, 0, rest) };
                if (border) gsap.set(border, v);
                if (content) gsap.set(content, v);
              });
              d.restState = rest;
            }
            return;
          }
          d.restState = null;

          d.pieces.forEach(({ border, content }, i) => {
            const from = DIAGRAM_ENTRY_DELAY + i * d.stagger;
            const borderIn = easeDiagram(clamp01((pReveal - from) / DIAGRAM_ITEM_WINDOW));
            const contentIn = easeDiagram(
              clamp01(
                (pReveal - from - DIAGRAM_ITEM_WINDOW * DIAGRAM_CONTENT_LAG) /
                  (DIAGRAM_ITEM_WINDOW * (1 - DIAGRAM_CONTENT_LAG)),
              ),
            );
            const apply = (node: HTMLElement | null, v: number) => {
              if (!node) return;
              gsap.set(node, {
                opacity: v,
                scale: lerp(DIAGRAM_HIDDEN_SCALE, 1, v),
                y: lerp(DIAGRAM_HIDDEN_Y, 0, v),
              });
            };
            apply(border, borderIn);
            apply(content, contentIn);
          });
        });
      });

      // The catch-up itself (see SCRUB_SECONDS): a tween on a proxy number, re-aimed at the scroll's
      // own progress on every scroll event, rendering the eased value as it goes. `overwrite` means
      // a new aim replaces the old one rather than queueing behind it, so it always converges on
      // where the scroll actually is, and lands exactly there when the reader stops.
      const smoothed = { p: 0 };
      const applySmoothed = contextSafe!((target: number, forceInstant: boolean) => {
        if (forceInstant) {
          gsap.killTweensOf(smoothed);
          smoothed.p = target;
          applyProgress(target, true);
          return;
        }
        gsap.to(smoothed, {
          p: target,
          duration: SCRUB_SECONDS,
          ease: "power2.out",
          overwrite: true,
          onUpdate: () => applyProgress(smoothed.p, false),
        });
      });

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: () => `+=${PIN_SCROLL_DISTANCE * readScale()}`,
        scrub: true,
        pin: true,
        pinSpacing: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => applySmoothed(self.progress, false),
        onRefresh: (self) => applySmoothed(self.progress, true),
        // onUpdate only fires INSIDE the pinned range, so the scene has to be put straight when
        // scroll leaves it either way — otherwise a refresh that happened while scrolled past
        // leaves a stale step showing once you come back.
        onLeave: () => applySmoothed(1, true),
        onLeaveBack: () => applySmoothed(0, true),
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
