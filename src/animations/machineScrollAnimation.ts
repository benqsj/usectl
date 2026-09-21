import type { RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  MACHINE_PHASES,
  MACHINE_PIN_SCROLL_DISTANCE,
  MACHINE_SKIP_INTRO_FROM,
  MACHINE_SKIP_INTRO_PIN_SCROLL_DISTANCE,
} from "@/lib/machineLayout";
import { gridMetrics, readScale } from "@/lib/grid";
import type { AnchorBox, GridMarksHandle } from "@/lib/gridEffect/useGridMarks";
import { createStepSwap } from "@/animations/stepSwap";
import { SCROLL_RESTORED_EVENT } from "@/components/layout/ScrollChurnGuard";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const PIN_SCROLL_DISTANCE = MACHINE_PIN_SCROLL_DISTANCE;
const P = MACHINE_PHASES;

// Cross marks start scaled down slightly, growing to full size as they fade in. Exported so
// MachineSectionClient.tsx's SSR-hidden inline style uses the exact same value.
export const CROSS_HIDDEN_SCALE = 0.6;
// topside.svg's own start/base scale (it fades in at the base, then grows from there).
export const TOPSIDE_HIDDEN_SCALE = 0.5;
const TOPSIDE_BASE_SCALE = 0.75;
// Replaced 2026-09-21 (per demo, approved): there is no hole to fly through any more — the zoom
// itself IS the effect, so the plate has to keep growing long past what a hole-based version ever
// needed (that one only had to clear its own opening at 9x). 700x reads as diving toward a single
// point on the surface rather than "a bigger image". Safe to push this far because
// useRasterizedSvg rasterises the plate ONCE to a bitmap and everything past that is a plain CSS
// transform:scale on the GPU — the cost doesn't grow with how far we scale it.
const TOPSIDE_MAX_SCALE = 700;
// >1.6 (was 1.6): barely moves at first, then accelerates hard right at the end — the
// "falling into a point" feeling the demo was tuned for, instead of a steady climb.
const TOPSIDE_ZOOM_CURVE = 2.8;

// --- wordmark: SCRUBBED (per user) -------------------------------------------------------------
// The "machine" entrance follows scroll frame by frame instead of playing out on its own: stop
// scrolling and it stops too. Everything below is a pure function of the pin's progress.
// Windows as fractions of that progress: reveal, then (later) the fade-out under the growing plate.
//
// Real bug, found 2026-09-20 from a user report that the word was still visible while topside.svg
// and its hole were growing: these two used to be hardcoded fractions of the WHOLE pin (0.1 / 0.2)
// tuned against the pin distance that existed back when they were written. Every later increase to
// MACHINE_PIN_SCROLL_DISTANCE rescaled `MACHINE_PHASES` (wordIn/wordOut/zoomStart/zoomEnd) to keep
// THEIR absolute px unchanged, but nobody rescaled these two — so as the pin kept growing, "word
// fully gone" kept landing relatively earlier and earlier... except it didn't shrink fast enough
// relative to the also-growing gap before the hole appears, and by the time zoomEnd was pushed out
// further still (see machineLayout.ts's 2026-09-20 entry), the fixed 0.2 no longer had any
// reliable relationship to wordOut/zoomStart at all. Fixed by deriving both from `P.wordIn`/
// `P.wordOut` plus a fixed PX offset (860 / 990 — the exact gaps the original 0.1/0.2 worked out to
// against the pin distance they were tuned at) divided by the CURRENT `PIN_SCROLL_DISTANCE` — so
// these stay correct forever, however many more times the total gets retuned.
const WORD_REVEAL_PX = 860; // word fully revealed this many px after P.wordIn starts it
const WORD_EXIT_LAG_PX = 990; // word fully gone this many px after P.wordOut starts fading it
const WORD_REVEALED_AT = P.wordIn + WORD_REVEAL_PX / PIN_SCROLL_DISTANCE;
const WORD_GONE_AT = P.wordOut + WORD_EXIT_LAG_PX / PIN_SCROLL_DISTANCE;
const CHAR_STAGGER_SPAN = 0.55; // how much of the reveal window the per-character stagger spans
const WORD_HIDDEN_BLUR_PX = 12;
const WORD_HIDDEN_Y_PX = 8;

// Standard "stagger normalised into a fixed window": the last item still reaches 1 at t=1.
const staggerProgress = (t: number, index: number, count: number, span: number) => {
  if (count <= 1) return gsap.utils.clamp(0, 1, t);
  const step = span / (count - 1);
  return gsap.utils.clamp(0, 1, (t - index * step) / (1 - span));
};

// Removed 2026-09-21 (per feedback: "no hole, just zoom in and fade like we've gone inside"): this
// used to be a two-layer CSS mask (mask-composite: exclude) that punched a literal transparent
// hole through the plate as it grew, so the page background showed through the middle. Replaced
// with a plain opacity fade on the whole plate (see `applyProgress` below) — no aperture, nothing
// cut out of it, it just grows and then dissolves.
//
// `CARD_TRIGGER_AT`/`CARD_TRIGGER_CURVE` below are what's left of that mechanism: NOT a visual any
// more, just the same two numbers the old hole-opening curve used, kept as-is so the steps-3-8
// card still arrives at exactly the same point in the scroll it always did (see `CARD_START`).
const CARD_TRIGGER_AT = 0.65;
const CARD_TRIGGER_CURVE = 3.4;

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
// Exported: createServerAnchorBox (below) needs these to expand the server's frame to the fully-
// split extent, so the crosses sit in the SAME place whether the server is open or closed.
export const BASE_GAP_PERCENT = 1.5; // yPercent -- a small built-in gap even fully "closed"
export const SEPARATION_YPERCENT = 31.36; // yPercent each half travels (of its OWN height) at full separation
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
//
// Step 8 (the last entry) cut back down to 2 on 2026-09-20 — per feedback it needed noticeably too
// much scroll on its own. Brought back to the same "one ordinary step" baseline the others started
// from, rather than removed entirely. `MACHINE_PIN_SCROLL_DISTANCE` was shrunk by exactly the px
// this freed up (see machineLayout.ts's 2026-09-20 entry) so steps 3-7 didn't quietly get longer to
// absorb it — only step 8 got shorter.
const STEP_WEIGHTS = [5, 4, 5, 5, 5, 2];

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

// CARD_START is unchanged by the 2026-09-21 hole removal — still the same point in the zoom
// window `P.cardAtHole` always resolved to (was "the hatch is 90% open", now just a fixed anchor
// derived from the same curve), so the card keeps arriving exactly when it always did even though
// there's no hole left to measure "90% open" against.
const zoomTimeAtCardTrigger = (v: number) =>
  CARD_TRIGGER_AT + Math.pow(v, 1 / CARD_TRIGGER_CURVE) * (1 - CARD_TRIGGER_AT);
const CARD_START = P.zoomStart + zoomTimeAtCardTrigger(P.cardAtHole) * (P.zoomEnd - P.zoomStart);

// --- steps 3-8 cross frames: box() measurements for useGridMarks (grid-trail.md §7) -------------
// Every one of these anchors — the server column, and each diagram wrapper — is a DESCENDANT of
// `cardRef`, which always carries its own approach `scale` (0.52 -> 1, see "4) the card" below).
// Reading a rect while that's still mid-tween would measure a shrunk box. So every measurement here
// reads the anchor relative to the pinned stage (exactly the viewport while pinned, and moves as a
// rigid unit with the anchor even when NOT pinned — see below), with the card's scale forced to 1
// for the instant of the read: the result is always "as it will be once the card has landed",
// correct at ANY time — on mount, before the pin has even engaged — not just once progress has
// already reached `P.cardEnd`.
//
// Plain functions taking ELEMENTS, not refs: `useGridMarks`'s `box` option wants a closure with no
// arguments, and the caller (MachineSectionClient.tsx) builds that closure itself via useCallback
// reading `ref.current` in its OWN body — passing a ref object as an argument to a function called
// during render trips the react-hooks/refs lint rule, even though nothing is actually read until
// the closure runs later.
function anchorBoxRelativeToStage(stage: HTMLElement, anchor: HTMLElement): AnchorBox {
  const stageRect = stage.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  return {
    left: anchorRect.left - stageRect.left,
    right: anchorRect.right - stageRect.left,
    top: anchorRect.top - stageRect.top,
    bottom: anchorRect.bottom - stageRect.top,
  };
}

function measureCardAnchor(stage: HTMLElement, card: HTMLElement, anchor: HTMLElement): AnchorBox {
  const prevScale = gsap.getProperty(card, "scale") as number;
  gsap.set(card, { scale: 1 });
  const box = anchorBoxRelativeToStage(stage, anchor);
  gsap.set(card, { scale: prevScale });
  return box;
}

/**
 * One of the three diagrams for steps 5/6/7-8. NOT the `[data-machine-diagram][data-diagram-step=
 * "N"]` wrapper itself — that div is `absolute inset-y-0 ... items-center`, i.e. deliberately
 * stretched to the CARD's full height so its content can be vertically centred inside it, so its
 * own rect is nearly the whole card, not the diagram. The diagram's real visible frame is that
 * wrapper's one child — `MachineInfraDiagram`/`MachineDeployDiagram`/`MachineAgentDiagram` each
 * render exactly one root `<div>` (`w-[105|108|115%]`, its own `aspectRatio`) — so `firstElementChild`
 * is exactly "the MachineInfraDiagram frame" grid-trail.md §7 means.
 */
export function measureDiagramBox(stage: HTMLElement, card: HTMLElement, step: number): AnchorBox | null {
  const wrapper = card.querySelector<HTMLElement>(`[data-diagram-step="${step}"]`);
  const root = wrapper?.firstElementChild;
  if (!(root instanceof HTMLElement)) return null;
  if (step !== 3) return measureCardAnchor(stage, card, root);

  // Step 6 (deploy) only: its root spans the WHOLE composition (108% wide) including the Github
  // card, which deliberately hangs off to the left of the "Machine frame" a viewer actually reads
  // as the diagram (see MachineDeployDiagram.tsx's own comment on why it's widened) — anchoring to
  // the root pulled the crosses a full grid column further left than steps 5/7. Anchoring to the
  // frame border alone (first `[data-diagram-border]` in DOM order, always "the Machine frame")
  // overshot the other way — one column further RIGHT than steps 5/7, per follow-up feedback.
  // Splitting the difference (midpoint between the root's own left edge and the frame's left edge,
  // frame's right/top/bottom otherwise) lands the same grid column steps 5/7 land on (verified: 13,
  // same as step 5's own snap) without hand-picking a magic px offset.
  const frameBorder = root.querySelector<HTMLElement>("[data-diagram-border]");
  if (!frameBorder) return measureCardAnchor(stage, card, root);
  const rootBox = measureCardAnchor(stage, card, root);
  const frameBox = measureCardAnchor(stage, card, frameBorder);
  return { ...frameBox, left: (rootBox.left + frameBox.left) / 2 };
}

/**
 * The server column, expanded by `sepFraction` (0 = closed, 1 = fully split) of the separation the
 * two halves actually travel. Per feedback 2026-09-21: only the TOP edge tracks the split (pulled up
 * by `SEPARATION_YPERCENT` of the column's own height) — the BOTTOM stays at wherever it sat before
 * any separation started, not pushed further down. Called every frame while the split is actually
 * moving (see `applySepFraction` below), so the top cross opens WITH it instead of sitting
 * pre-expanded the whole time.
 *
 * A same-day follow-up tried adding one MORE grid line of push on top of this, SCALED BY
 * `sepFraction` (reasoning: "match how far server.svg itself visually shifts") — reverted right
 * away on further feedback: with two separate additive terms both growing as `sepFraction` climbs,
 * the row snap had two distinct thresholds to cross instead of one, producing a visible DOUBLE jump
 * (+1 line, then +2) instead of a single clean move.
 *
 * A later, different follow-up asked for something that only sounds similar: not extra travel WHILE
 * opening, but the whole thing — including where it first appears, closed, before any opening starts
 * — one line higher than before. That's a CONSTANT offset, not one scaled by `sepFraction`: subtracting
 * a fixed `rowPitch` shifts the entire closed→open range up by the same one line everywhere, so the
 * single continuous transition the box above this comment already produces stays single (still just
 * one threshold to cross, now one row higher throughout) — it doesn't reintroduce the double-jump the
 * earlier, sepFraction-scaled attempt caused.
 */
export function measureServerBox(
  stage: HTMLElement,
  server: HTMLElement,
  card: HTMLElement,
  sepFraction: number,
): AnchorBox {
  const box = measureCardAnchor(stage, card, server);
  const height = box.bottom - box.top;
  const rowPitch = gridMetrics(undefined, readScale()).rowPitch;
  return {
    left: box.left,
    right: box.right,
    top: box.top - rowPitch - (SEPARATION_YPERCENT / 100) * height * sepFraction,
    bottom: box.bottom,
  };
}

interface MachineScrollRefs {
  // Pin trigger AND pin target — the whole full-viewport screen.
  sectionRef: RefObject<HTMLElement | null>;
  // Wrapper around hatch + wordmark + crosses.
  wordmarkRef: RefObject<HTMLElement | null>;
  hatchRef: RefObject<HTMLElement | null>;
  // The 4 corner "+" marks, drawn by the background grid rather than by elements in this section
  // (see lib/gridEffect/useGridMarks.ts) — this only drives how visible they are.
  gridMarks: GridMarksHandle;
  // Four more sets, one per piece of steps 3-8 content (grid-trail.md §7 — replaces an earlier,
  // wrong "one fixed frame for everything" version): the server's own frame (steps 3-4, sized to
  // its fully-split extent so it doesn't move when the server opens) and one frame per diagram
  // (steps 5, 6, 7-8). Each fades in/out with its own content, never all at once.
  serverMarks: GridMarksHandle;
  infraMarks: GridMarksHandle;
  deployMarks: GridMarksHandle;
  agentMarks: GridMarksHandle;
  // Written every frame the split is actually moving, read by MachineSectionClient.tsx's own
  // box() callback for `serverMarks` (see `measureServerBox`'s `sepFraction` param) — a plain ref,
  // not state, since it only ever needs to be read at the exact moment `serverMarks.refreshAnchor()`
  // runs, never to trigger a render.
  serverSepFractionRef: RefObject<number>;
  // topside.svg — grows continuously, then fades out (opacity) right at the end, as if we'd flown
  // straight into it. No hole/aperture cut into it any more (removed 2026-09-21).
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
  // Start at the card's approach, skipping the wordmark + topside fly-through (machineLayout.ts,
  // MACHINE_SKIP_INTRO_*). The rest of the sequence is untouched.
  skipIntro?: boolean;
}

// ONE pin for the whole "machine" sequence (per the approved demo):
//   wordmark entrance (triggered)
//   -> topside fades in ON TOP of it and starts growing the moment the wordmark starts leaving
//   -> the growth never pauses, all the way to 700x, then fades out (opacity) right at the very
//      end — no hole/aperture (removed 2026-09-21, per a second approved demo): it just grows and
//      dissolves, as if we'd flown straight into it (all scrubbed)
//   -> by the time it's most of the way through that fade the steps 3-8 card is already there,
//      small and far away, and scroll flies us towards it until it sits at full size (scrubbed)
//   -> then the six steps swap their text (triggered, same as everywhere else) while the static
//      bar fills (scrubbed).
//
// This file used to also carry its own `scrollYBeforeChurnRef`-based scrollY restore, on top of the
// shared `<ScrollChurnGuard />` (layout.tsx) — removed 2026-09-21, same real bug and same fix as
// buildScrollAnimation.ts's own doc comment describes: ScrollChurnGuard exists specifically because
// five independent per-section copies of this fix raced each other, and this file's own copy was
// never actually removed when that shared guard replaced them, so it kept fighting it (and GSAP's
// own internal scrollTo calls during every pinned ScrollTrigger's setup) on refresh.
export function useMachineScrollAnimation({
  sectionRef,
  wordmarkRef,
  hatchRef,
  gridMarks,
  serverMarks,
  infraMarks,
  deployMarks,
  agentMarks,
  serverSepFractionRef,
  topsideRef,
  tintRef,
  cardRef,
  fillRef,
  stepCount,
  ssrScrollReserveRef,
  skipIntro = false,
}: MachineScrollRefs) {
  useGSAP(
    (_context, contextSafe) => {
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
      // The card's own outline/chamfer accent — permanently hidden for the whole embedded steps
      // 3-8 sequence now (see the initial gsap.set below), per feedback 2026-09-21.
      const cardDiagonal = card.querySelector<HTMLElement>("[data-card-diagonal]");

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
        // Multiplied by the wordmark's own fade: the crosses used to be its CHILDREN and left with
        // it for free. They are grid marks now, outside this DOM entirely, so the exit has to be
        // applied to them explicitly or they would stay lit over the fly-through.
        gridMarks.setAppearance({
          opacity: crossIn * (1 - exit),
          scale: CROSS_HIDDEN_SCALE + (1 - CROSS_HIDDEN_SCALE) * crossIn,
        });

        gsap.set(wordmark, {
          opacity: 1 - exit,
          filter: exit > 0 ? `blur(${exit * WORD_HIDDEN_BLUR_PX}px)` : "none",
        });
      };

      applyWordmark(0);
      serverMarks.setAppearance({ opacity: 0 });
      infraMarks.setAppearance({ opacity: 0 });
      deployMarks.setAppearance({ opacity: 0 });
      agentMarks.setAppearance({ opacity: 0 });
      gsap.set(topside, { opacity: 0, scale: TOPSIDE_HIDDEN_SCALE });
      // Per feedback 2026-09-21: none of steps 3-8 should show the card's own border/chamfer inside
      // the machine screen (it used to fade out from step 6 on, since those diagrams are wider than
      // the column and crossed it — now off for the whole embedded sequence, steps 3-5 included).
      gsap.set(card, { opacity: 0, scale: 0.52, borderColor: "rgba(255,255,255,0)" });
      if (cardDiagonal) gsap.set(cardDiagonal, { opacity: 0 });
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
        applyWordmark(skipIntro ? 1 : WORD_REVEALED_AT);
        // …but no corner marks. They are drawn in VIEWPORT space by the background grid, which is
        // only ever right while this screen is pinned (i.e. also standing still in the viewport).
        // With the pin gone the wordmark scrolls and they would stay behind, floating on their own.
        gridMarks.setAppearance({ opacity: 0 });
        serverMarks.setAppearance({ opacity: 0 });
        infraMarks.setAppearance({ opacity: 0 });
        deployMarks.setAppearance({ opacity: 0 });
        agentMarks.setAppearance({ opacity: 0 });
        gsap.set(topside, { opacity: 0 });
        gsap.set(card, { opacity: 1, scale: 1, filter: "none" });
        gsap.set(fill, { clipPath: "inset(0% 0% 0% 0%)" });
        return;
      }

      gsap.set(fill, { clipPath: "inset(0% 100% 0% 0%)" });

      let currentStep = 0;
      // The last sepFraction the server's grid marks were actually re-measured at — only re-runs
      // useGridMarks's (layout-forcing) refreshAnchor() when this has genuinely changed, so once the
      // split settles at 0 or 1 it stops paying for it every frame.
      let lastServerSepFraction = -1;
      const instantUntil = performance.now() + 250;

      const applyProgress = contextSafe!((progress: number, forceInstant: boolean) => {
        const instant = forceInstant || performance.now() < instantUntil;

        // 1) wordmark — scrubbed
        applyWordmark(progress);

        // 2+3) topside: fades in over the wordmark, then ONE continuous exponential ramp (constant
        // "speed towards you", no plateau) all the way to TOPSIDE_MAX_SCALE, then fades back out
        // (opacity) right at the very end. No mask/hole any more (removed 2026-09-21) — just scale
        // + opacity, so it reads as flying straight into the plate rather than through an opening.
        const fadeIn = clamp01((progress - P.plateIn) / (P.plateFull - P.plateIn));
        const t = clamp01((progress - P.zoomStart) / (P.zoomEnd - P.zoomStart));
        const scale = TOPSIDE_BASE_SCALE * Math.pow(TOPSIDE_MAX_SCALE / TOPSIDE_BASE_SCALE, Math.pow(t, TOPSIDE_ZOOM_CURVE));
        gsap.set(topside, {
          opacity: fadeIn * (1 - clamp01((t - 0.93) / 0.07)),
          scale,
        });

        // 4) the card: already there when the hatch is ~90% open, then flown towards, slowly
        // (skipping the intro, the card starts its approach right at the start of the pin)
        const cardStart = skipIntro ? MACHINE_SKIP_INTRO_FROM : CARD_START;
        const approachRaw = clamp01((progress - cardStart) / (P.cardEnd - cardStart));
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

          // F-server (grid-trail.md §7, widened per feedback 2026-09-21 — the old [0.8, 1] window
          // fully appeared only once the split had already started, reading as "invisible until it
          // opens"): fades in over the card's own approach, well before it has finished landing, so
          // there's real lead time before step 3 starts splitting it open. Holds through the split
          // and step 4, fades out with the exact same `exit` that takes the bottom half + wordmark
          // away.
          const serverCrossIn = clamp01((approachRaw - 0.5) / 0.35);
          serverMarks.setAppearance({
            opacity: serverCrossIn * (1 - exit),
            scale: CROSS_HIDDEN_SCALE + (1 - CROSS_HIDDEN_SCALE) * serverCrossIn,
          });

          // The frame itself OPENS AND CLOSES WITH the split (per feedback 2026-09-21) rather than
          // sitting pre-expanded the whole time: `serverSepFractionRef` feeds the live value into
          // `measureServerBox` (via MachineSectionClient.tsx's own box() callback), and
          // refreshAnchor() re-snaps against it — only while it has actually changed since the last
          // frame, so once fully closed or fully open this goes back to costing nothing.
          if (sepFraction !== lastServerSepFraction) {
            lastServerSepFraction = sepFraction;
            serverSepFractionRef.current = sepFraction;
            serverMarks.refreshAnchor();
          }
        } else {
          serverMarks.setAppearance({ opacity: 0 });
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

          // This diagram's own frame (grid-trail.md §7): the SAME wrapper value that drives the
          // diagram's own cross-fade, so the frame can never be visible without its content or vice
          // versa. `data-diagram-step` is "2"/"3"/"4" for infra/deploy/agent respectively.
          const diagramMarks =
            d.stepIndex === 2 ? infraMarks : d.stepIndex === 3 ? deployMarks : d.stepIndex === 4 ? agentMarks : null;
          diagramMarks?.setAppearance({
            opacity: wrapper,
            scale: CROSS_HIDDEN_SCALE + (1 - CROSS_HIDDEN_SCALE) * wrapper,
          });

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
      // The pin's own progress -> the full sequence's progress (identity unless skipping the intro).
      const fromPin = (p: number) => (skipIntro ? MACHINE_SKIP_INTRO_FROM + p * (1 - MACHINE_SKIP_INTRO_FROM) : p);
      const applySmoothed = contextSafe!((rawTarget: number, forceInstant: boolean) => {
        const target = fromPin(rawTarget);
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

      // Skipping the intro, this screen takes over from the hero's dive IN PLACE: it is pulled up by
      // the hero's own height so that its pin starts on the exact scroll position the hero's pin
      // ends on — the card then appears where the dive left off instead of the whole screen
      // scrolling up from below. (Until then it passes, empty and transparent, over the pinned
      // hero.) Re-measured on every refresh, since the hero's height follows the viewport.
      const hero = skipIntro ? document.querySelector<HTMLElement>("[data-hero-section]") : null;
      const alignToHero = () => {
        if (hero && section) section.style.marginTop = `${-hero.offsetHeight}px`;
      };
      alignToHero();

      const machineTrigger = ScrollTrigger.create({
        onRefreshInit: alignToHero,
        trigger: section,
        start: "top top",
        end: () => `+=${(skipIntro ? MACHINE_SKIP_INTRO_PIN_SCROLL_DISTANCE : PIN_SCROLL_DISTANCE) * readScale()}`,
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
        // The moment the pin engages is the moment the wordmark (and the card behind it) stop
        // moving relative to the viewport, which is the only frame of reference any of these grid
        // marks have. One rect read here, never in the scroll loop — except serverMarks, which also
        // re-reads live while the split itself is moving (see the sepFraction block above).
        //
        // Real bug, found via measurement: infraMarks/deployMarks/agentMarks were framing almost the
        // whole viewport instead of their own small diagram — because nothing was ever calling their
        // refreshAnchor() beyond the hook's own mount-time effect, and at mount the embedded card
        // hasn't necessarily settled into its final pinned layout yet (its own effects can still be
        // running). serverMarks was already fine — it gets its own explicit refresh whenever
        // sepFraction changes — these three just never got the same treatment.
        onToggle: (self) => {
          if (self.isActive) {
            gridMarks.refreshAnchor();
            serverMarks.refreshAnchor();
            infraMarks.refreshAnchor();
            deployMarks.refreshAnchor();
            agentMarks.refreshAnchor();
          }
        },
      });

      // After a refresh is put back at its old scroll position (ScrollChurnGuard), jump straight
      // there instead of gliding from the top state — the glide is only for real scrolling.
      const onScrollRestored = () => {
        if (machineTrigger.isActive) applySmoothed(machineTrigger.progress, true);
      };
      window.addEventListener(SCROLL_RESTORED_EVENT, onScrollRestored);
      return () => window.removeEventListener(SCROLL_RESTORED_EVENT, onScrollRestored);
    },
    { scope: sectionRef, dependencies: [stepCount, skipIntro] },
  );
}
