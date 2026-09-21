"use client";

import Link from "next/link";
import { useCallback, useRef, type CSSProperties } from "react";
import { HeroServerModel, type HeroServerModelHandle } from "@/components/sections/HeroServerModel";
import { useBuildScrollAnimation, LIFT_ON_CLOSE_PX } from "@/animations/buildScrollAnimation";
import { HERO_STACK_GAP_CLOSED_PX, HERO_STACK_GAP_OPEN_PX } from "@/lib/heroLayers";
import { HERO_CORE_HEIGHT_RATIO } from "@/lib/heroModel";
import { HEADER_HEIGHT_PX, readScale, s } from "@/lib/grid";
import { BUILD_CLOSE_ON_SCROLL, BUILD_PIN_SCROLL_DISTANCE } from "@/lib/buildLayout";
import { useGridMarks } from "@/lib/gridEffect/useGridMarks";

// Same relationship the hero's own corner crosses use around its identically-sized (480px) cube —
// see HeroSectionClient.tsx. gapY: 0 = the row nearest each edge, not pushed away.
const BUILD_MODEL_WIDTH_PX = 480;
const BUILD_MARK_GAP_X_PX = 129;
const BUILD_MARK_GAP_Y_PX = 0;

// Built from a user-supplied screenshot (see PROJECT.md), 2026-09-18. Heading/paragraph/button
// typography and the two button boxes' exact px dimensions are all explicit spec, not eyeballed.
// The paragraph's `max-w` is hand-tuned against the screenshot's 2-line wrap (no exact width was
// given), same "trial-and-error against a reference image" approach used throughout this project.
//
// The 4 corner crosses visible in the reference screenshot around the cube were NOT added — no
// exact spec was given for them, and Hero's own identical corner crosses went through a whole
// multi-round positioning saga before being removed entirely (see PROJECT.md) — flagging rather
// than guessing at a repeat of that.
//
// Rewritten 2026-09-18 (2nd pass): user wanted the OPPOSITE of the first version — the server
// shouldn't travel down the page, it should sit close to the text, small enough that the heading,
// paragraph, buttons AND the fully-open server all fit in one screen together, closing while the
// page is held still. See buildScrollAnimation.ts for the pin.
//
// A border + top-left chamfer were added here on a later follow-up, then reverted the same day —
// the user decided this section shouldn't have one at all, and asked for the same chamfer technique
// to go on PricingCalculatorSectionClient.tsx's card instead (see that file for the working version,
// including the diagonal-accent fix this section's own attempt needed).
export function BuildSectionClient() {
  const sectionRef = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HeroServerModelHandle | null>(null);
  const modelSyncRef = useRef<(() => void) | null>(null);
  const ssrScrollReserveRef = useRef<HTMLDivElement>(null);
  // Written by useBuildScrollAnimation's own ScrollTrigger callbacks — see its doc comment and
  // markBox's own below for why this, not getComputedStyle, is the right signal.
  const isPinnedRef = useRef(false);

  // The box the marks snap around — only meaningful while genuinely pinned; see `isPinnedRef`'s own
  // doc comment for why that, not `getComputedStyle`, is the signal to branch on.
  //
  // The wrapper's live rect isn't usable directly while pinned (its height shrinks via --stack-gap
  // and it rises via a transform as the server closes — see buildScrollAnimation.ts), so this uses
  // offsetTop/offsetWidth instead — layout-only, unaffected by either, and equal to the viewport
  // position while pinned (`start: "top top"`). The bottom edge is the model's own core height
  // (~330px) rather than its full open (~750px) or closed (~465px) extent — tuned live per feedback
  // 2026-09-21: both of those, added to the ~700px the heading/paragraph/buttons above already
  // consume, landed the bottom pair past the fold on a typical 900-1080px-tall viewport; the core
  // height alone lands it at ~1036, on-screen with real margin, while still relating to the model's
  // actual footprint rather than being a made-up number. Computed once at onEnter and held stable
  // for the whole close animation — this frame doesn't need to track the split moment to moment the
  // way the machine screen's own server frame does.
  //
  // Returns null once unpinned — a "live-track the server" variant was tried instead, but per
  // feedback that read as "the crosses are following me", not the desired "they stay put". Once
  // unpinned, `refreshAnchor()` is simply never called again (see buildScrollAnimation.ts's own
  // `onScroll`, which only ever touches opacity), so this branch existing only matters if something
  // else forces a refresh (e.g. a window resize) — returning null there means the marks' position is
  // left exactly as it was, not silently recomputed from a now-meaningless `offsetTop` read.
  const markBox = useCallback(() => {
    const el = wrapperRef.current;
    if (!el || !isPinnedRef.current) return null;
    const k = readScale();
    const coreHeight = BUILD_MODEL_WIDTH_PX * HERO_CORE_HEIGHT_RATIO * k;
    if (BUILD_CLOSE_ON_SCROLL) {
      return {
        left: el.offsetLeft,
        right: el.offsetLeft + el.offsetWidth,
        top: el.offsetTop - LIFT_ON_CLOSE_PX * k,
        bottom: el.offsetTop + coreHeight,
      };
    }
    // Static, already-closed server (BUILD_CLOSE_ON_SCROLL off): frame what is actually on screen —
    // the closed stack, lifted by LIFT_ON_CLOSE_PX (raw px: it is applied as a plain translateY).
    // The frame above was sized for every pose of the old close animation and put the bottom pair
    // below the fold on laptop-height viewports (reported 2026-09-21: "the bottom pluses are
    // missing"). The bottom edge is also kept at least ~0.6 of a grid row above the viewport's
    // bottom, so the nearest-row snap can never round the pair off-screen.
    const top = el.offsetTop - LIFT_ON_CLOSE_PX;
    const closedHeight = 3 * HERO_STACK_GAP_CLOSED_PX * k + coreHeight;
    const rowPitch = 114 * k; // ROW_PITCH (lib/grid.ts) in px
    return {
      left: el.offsetLeft,
      right: el.offsetLeft + el.offsetWidth,
      top,
      bottom: Math.min(top + closedHeight, window.innerHeight - rowPitch * 0.6),
    };
  }, []);

  const gridMarks = useGridMarks(wrapperRef, {
    gapX: BUILD_MARK_GAP_X_PX,
    gapY: BUILD_MARK_GAP_Y_PX,
    box: markBox,
  });

  useBuildScrollAnimation({
    sectionRef,
    wrapperRef,
    modelRef,
    modelSyncRef,
    ssrScrollReserveRef,
    gridMarks,
    isPinnedRef,
  });

  // The GLB arrives well after the scroll trigger is built — this re-applies the current scroll
  // progress to the model directly once it's ready, same pattern as HeroSectionClient's own
  // modelSyncRef. Used to call the static, page-wide `ScrollTrigger.refresh()` instead — see
  // buildScrollAnimation.ts's own doc comment on modelSyncRef for why that was a real bug (refresh
  // landing back at Hero on reload, this section's own bottom crosses intermittently not
  // reappearing), not just an inefficiency.
  const handleModelReady = useCallback(() => modelSyncRef.current?.(), []);

  return (
    // Outer <section> is a plain block (no height of its own) — deliberately NOT `min-h-screen`
    // itself, same reasoning as MachineSectionClient.tsx's identical structure (see PROJECT.md): the
    // trailing ssrScrollReserveRef spacer below needs to add real EXTRA document height on top of
    // the inner min-h-screen div, not get absorbed into satisfying that div's own minimum or thrown
    // off-center by being counted as a third flex child inside it.
    <section ref={sectionRef} className="relative" style={{ paddingTop: HEADER_HEIGHT_PX }}>
      {/* Real bug, found via getBoundingClientRect() (not eyeballed) — TWO of them, both about the
          gap between the header and this section:
          1. The pin's `start: "top top"` puts the section flush with the viewport's true top
             (y=0), same as the sticky header (higher z-index). Centering content in a plain
             `min-h-screen` box ignores that the header visually covers its own 96px, so the
             heading rendered at `top: 64px` while pinned — HALF HIDDEN behind the header.
          2. The FIRST fix used `marginTop: HEADER_HEIGHT_PX` on this inner div — which "escapes"
             the parent (a plain <section>, no border/padding of its own) via ordinary CSS margin
             collapsing WHILE the section is in normal document flow, but does NOT collapse once
             the section becomes `position: fixed` while pinned (a fixed-position box establishes
             its own block-formatting context, which never collapses margins with its children).
             Same markup, two different rendered positions depending on pin state — exactly the
             92px downward "jump" the user reported right at the moment pinning engaged (confirmed
             with a fine-grained scroll trace: h2's top read a steady 164px right before pinning,
             then snapped to 256px the instant `position` became `fixed`).
          Fixed by moving the header-clearance offset to `paddingTop` on the SECTION itself instead
          of `marginTop` on the child — padding never collapses, so it renders identically whether
          the section is in normal flow or pinned. Re-verified with the same fine-grained trace:
          h2Top now changes smoothly, linearly, by exactly the scroll delta right up to the pin
          engaging, with zero discontinuity at that instant. */}
      <div
        className="flex flex-col items-center justify-center px-6 pt-16 pb-4 text-center"
        style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_PX}px)` }}
      >
        <h2 className="font-heading text-[calc(var(--s)*98)] leading-none font-medium tracking-[-0.02em] text-foreground">
          What will you build next?
        </h2>

        <p className="mx-auto mt-6 max-w-[calc(var(--s)*900)] text-center font-heading text-[calc(var(--s)*28)] leading-none font-normal tracking-[-0.02em] text-white/70">
          Give your next product a place to run. Keep building what matters — we&rsquo;ll handle the
          infrastructure behind
        </p>

        <div className="mt-10 flex items-center justify-center gap-[calc(var(--s)*28)]">
          <Link
            href="#"
            className="inline-flex items-center justify-center rounded-[calc(var(--s)*40)] bg-brand font-heading text-[calc(var(--s)*14)] leading-none font-bold text-white"
            style={{ width: 166, height: 48, paddingTop: 15, paddingRight: 22, paddingBottom: 15, paddingLeft: 22 }}
          >
            Create Machine
          </Link>
          <Link
            href="#"
            className="inline-flex items-center justify-center rounded-[calc(var(--s)*40)] border border-white/20 font-heading text-[calc(var(--s)*14)] leading-none font-medium text-white"
            style={{ width: 192, height: 48, paddingTop: 15, paddingRight: 22, paddingBottom: 15, paddingLeft: 22 }}
          >
            From $15/month
          </Link>
        </div>

        {/* The server, reusing HeroServerModel verbatim at the EXACT same wrapper size as the hero's
            own cube (400px / 480px, same --core-height) — per explicit request, reverted from a
            shrunk-down 180/210px version that read as "too small." `mt-[calc(var(--s)*360)]` (vs. the hero's own
            `mt-[calc(var(--s)*35)]`) is not arbitrary: HeroServerModel's canvas "stage" is centered on the
            wrapper's fixed CLOSED-state center regardless of current openness (see
            HeroServerModel.tsx's `resize()`), so at this width the stage's top edge sits
            `stageHeight/2 - closedCenterY` ≈ 345px ABOVE the wrapper's own top edge even at rest —
            the hero never shows this because its text fades and the cube scales/recenters before it
            opens, but this section's buttons are static above a model that's already fully open on
            entry, so the clearance has to be static too. Verified via screenshot: no overlap. */}
        <div
          ref={wrapperRef}
          aria-hidden="true"
          className="relative mx-auto mt-[calc(var(--s)*280)] w-[calc(var(--s)*480)] [--core-height:calc(var(--s)*330.32)] h-[calc(3*var(--stack-gap)_+_var(--core-height))]"
          // Server-rendered in the pose the effect will put it in, so nothing jumps on hydration:
          // open when it closes on scroll, otherwise already closed and lifted (the same values
          // buildScrollAnimation.ts's applyCloseProgress(1) sets).
          style={
            BUILD_CLOSE_ON_SCROLL
              ? ({ "--stack-gap": `${HERO_STACK_GAP_OPEN_PX}px` } as CSSProperties)
              : ({
                  "--stack-gap": `${HERO_STACK_GAP_CLOSED_PX}px`,
                  transform: `translateY(-${LIFT_ON_CLOSE_PX}px)`,
                  marginBottom: `-${LIFT_ON_CLOSE_PX}px`,
                } as CSSProperties)
          }
        >
          {/* Same ambient glow as the hero's cube wrapper. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 h-[calc(var(--s)*130)] w-[170%] -translate-x-1/2 rounded-full blur-2xl"
            style={{
              top: `calc(3 * var(--stack-gap) + var(--core-height) - 45px)`,
              background: "radial-gradient(ellipse at center, rgba(72,144,72,0.55) 0%, rgba(72,144,72,0) 70%)",
            }}
          />

          <HeroServerModel apiRef={modelRef} wrapperRef={wrapperRef} onReady={handleModelReady} />
        </div>
      </div>

      {/* Server-rendered placeholder that pre-reserves the same scroll distance GSAP's pin-spacer
          will later add — see buildScrollAnimation.ts, where it's collapsed to 0 right before the
          real pin-spacer is created. Keeps the page's total height identical before/after hydration
          (same fix every other pinned section in this project uses — see PROJECT.md). Sits as a
          SIBLING of the inner min-h-screen div, not nested inside it — see the comment on the outer
          <section> above for why. */}
      <div ref={ssrScrollReserveRef} aria-hidden="true" style={{ height: s(BUILD_PIN_SCROLL_DISTANCE) }} />

      {/* This used to be a permanent `h-24` (96px) trailing spacer: this section's pin uses
          `start: "top top"`, and with nothing following it in the document the pin-spacer's reserved
          distance and the viewport-height the trigger itself occupies cancelled out with ZERO
          margin, permanently stranding `position: fixed` at the document's max scroll (see
          PROJECT.md for the original diagnosis). Now that `Footer` follows immediately with its own
          real height, that same margin requirement is already satisfied by genuine content — kept
          only as a tiny fixed buffer (not the full 96px) purely as insurance against a future layout
          change removing the footer; re-verified via scroll-scan that the pin still releases
          cleanly with this much smaller value. */}
      <div aria-hidden="true" className="h-4" />
    </section>
  );
}
