import type { RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { HERO_STACK_GAP_CLOSED_PX, HERO_STACK_GAP_OPEN_PX } from "@/lib/heroLayers";
import { BUILD_CLOSE_ON_SCROLL, BUILD_PIN_SCROLL_DISTANCE } from "@/lib/buildLayout";
import { readScale } from "@/lib/grid";
import type { HeroServerModelHandle } from "@/components/sections/HeroServerModel";
import type { GridMarksHandle } from "@/lib/gridEffect/useGridMarks";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// BuildSection's server starts OPEN (exploded) and closes as the section stays pinned in place —
// the reverse of the hero's own open-on-scroll sequence, reusing the SAME HeroServerModel verbatim
// (just a much smaller wrapper width — see buildLayout.ts) per explicit request.
//
// Rewritten 2026-09-18 (2nd pass) to actually PIN the section: the first version was a plain,
// unpinned scrub as the section scrolled through the viewport, but the user wanted the opposite of
// that — the server shouldn't travel down the page at all, it should come up close to the text and
// the whole section (heading, paragraph, buttons, AND the open server) should fit in ONE screen,
// closing while the page holds still. That's exactly what a pin is for. Because this now creates a
// real pin-spacer, it needs the same SSR-height fix every other pinned section in this project
// carries (see heroScrollAnimation.ts for the original, fully-diagnosed bug this guards against):
// `ssrScrollReserveRef`, a server-rendered placeholder so the pre-hydration and hydrated page
// heights match. (This file used to ALSO carry its own `scrollYBeforeChurnRef`-based scrollY
// restore, on top of the shared `<ScrollChurnGuard />` in layout.tsx — a real, found-2026-09-21 bug:
// ScrollChurnGuard exists specifically because five independent per-section copies of this same fix
// raced each other (see ScrollChurnGuard.tsx's own doc comment) and this file's own copy — never
// actually removed when that shared guard was introduced, unlike Hero's own copy — was fighting it
// exactly that way, confirmed by tracing every `window.scrollTo` call during a reload: this file's
// own `setTimeout(..., 100)` correction fired on top of ScrollChurnGuard's, each racing GSAP's own
// internal scrollTo calls (every `ScrollTrigger.create({pin:true, ...})` call does its own internal
// scroll-position preservation during setup), landing scrollY somewhere neither intended. Removed;
// the shared guard is the only scrollY restore this file needs.)
const STACK_GAP_CLOSED_PX = HERO_STACK_GAP_CLOSED_PX;
const STACK_GAP_OPEN_PX = HERO_STACK_GAP_OPEN_PX;

// HeroServerModel keeps the model's own visual center fixed regardless of open/closed progress (see
// its own `setProgress` — "kept centred on screen"), so closing alone doesn't move it. Per explicit
// request, the wrapper itself also rises as it closes — an extra translateY on top of that, purely
// cosmetic (the model's internal centering is unaffected), tuned live like every other px constant
// in this file. Dialed back from 120 → 40 once, because a pure `transform` doesn't shrink the
// wrapper's own LAYOUT box, so a bigger lift only left more empty space below it once settled.
//
// Raised again to 160 on 2026-09-18 ("ძაან დიდი დაშორება არის როცა server.svg იხურება") — but this
// time the lift is paired with an equal negative margin-bottom, applied off the same progress, so
// the wrapper's layout box shrinks by exactly what the transform takes away. That's what makes a
// big lift safe now: the closed server ends up much closer to the copy above it WITHOUT leaving the
// hole underneath that forced the earlier climb-down.
// Exported: BuildSectionClient.tsx's own grid-marks box() needs this to know how far the wrapper
// can rise above its own resting (open) position, same principle as the machine screen's server
// frame (grid-trail.md §7) — a frame sized to contain every pose the element can be in.
export const LIFT_ON_CLOSE_PX = 160;

interface BuildScrollRefs {
  sectionRef: RefObject<HTMLElement | null>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  modelRef: RefObject<HeroServerModelHandle | null>;
  // Filled in with a resync function once the trigger exists; BuildSectionClient.tsx calls it from
  // HeroServerModel's `onReady` the instant its GLB finishes loading. See the removed
  // `ScrollTrigger.refresh()` call below for why this exists instead of that: the GLB's async load
  // time is unpredictable (network-dependent), so a STATIC, page-wide `ScrollTrigger.refresh()`
  // fired from it could land at any scroll position/pin state — and that call reverts and
  // re-measures EVERY ScrollTrigger on the page, not just this one. That's exactly the documented
  // cause (see heroScrollAnimation.ts's own "THE FIX for..." comment) of Hero's model popping to the
  // wrong pose, and — newly diagnosed here — of two more bugs reported 2026-09-21: a hard refresh
  // landing the page back at the Hero section regardless of where it was scrolled to (a page-wide
  // revert can shrink some OTHER pin's spacer height, clamping scrollY down toward the top with
  // nothing left to correct it once ScrollChurnGuard's own one-shot restore window has closed), and
  // this section's own bottom corner crosses intermittently failing to reappear on scroll-back-up
  // (the same page-wide revert firing ScrollTrigger's global "refresh" event, which re-runs EVERY
  // useGridMarks instance's refreshAnchor() — including this one — at a moment uncorrelated with
  // this pin's own isPinnedRef/onEnter/onLeave state). A direct call to applyCloseProgress with this
  // trigger's own current progress achieves the same "model must reflect current scroll position"
  // goal without touching anything else on the page.
  modelSyncRef: RefObject<(() => void) | null>;
  ssrScrollReserveRef: RefObject<HTMLDivElement | null>;
  // The 4 corner "+" marks around the server, drawn by the background grid (see
  // lib/gridEffect/useGridMarks.ts) — this only drives whether/where they're anchored, same as
  // every other pinned section's own gridMarks.
  gridMarks: GridMarksHandle;
  // BuildSectionClient.tsx's `markBox()` reads this — `wrapper.offsetTop` only means "distance from
  // the viewport top" while the section is genuinely pinned (`position: fixed`). Written here
  // (true in onEnter/onEnterBack, false in onLeave/onLeaveBack) rather than read via
  // `getComputedStyle` inside `markBox` itself: GSAP fires `onEnter` as part of the SAME update that
  // applies the pin's `position: fixed` styling, and reading computed style synchronously inside
  // that callback isn't guaranteed to see the new value yet (confirmed: markBox() using
  // getComputedStyle returned null even during onEnter, never producing a valid box at all).
  // `self.isActive` on the ScrollTrigger callbacks doesn't have that race.
  isPinnedRef: RefObject<boolean>;
}

export function useBuildScrollAnimation({
  sectionRef,
  wrapperRef,
  modelRef,
  modelSyncRef,
  ssrScrollReserveRef,
  gridMarks,
  isPinnedRef,
}: BuildScrollRefs) {
  useGSAP(
    () => {
      // Collapse the SSR placeholder before anything else — see the matching comment in
      // heroScrollAnimation.ts / infrastructureScrollAnimation.ts for why this has to run on every
      // code path, including prefers-reduced-motion below (which never creates a real pin-spacer).
      if (ssrScrollReserveRef.current) ssrScrollReserveRef.current.style.height = "0px";

      const section = sectionRef.current;
      const wrapper = wrapperRef.current;
      if (!section || !wrapper) return;

      // Pure function of scroll progress (0 = open, 1 = closed) — freezes wherever scroll stops,
      // reverses cleanly, same convention every other continuous scrub in this project uses.
      const applyCloseProgress = (closeProgress: number) => {
        // BUILD_CLOSE_ON_SCROLL off: always the closed pose, whatever the scroll says.
        const clamped = BUILD_CLOSE_ON_SCROLL ? gsap.utils.clamp(0, 1, closeProgress) : 1;
        gsap.set(wrapper, {
          "--stack-gap": `${gsap.utils.interpolate(STACK_GAP_OPEN_PX, STACK_GAP_CLOSED_PX, clamped)}px`,
          y: -LIFT_ON_CLOSE_PX * clamped,
          // Takes the lift out of the layout too, so nothing is left holding the space the server
          // just vacated (see LIFT_ON_CLOSE_PX).
          marginBottom: -LIFT_ON_CLOSE_PX * clamped,
        });
        modelRef.current?.setProgress(1 - clamped);
      };

      applyCloseProgress(0); // (the closed pose when BUILD_CLOSE_ON_SCROLL is off)
      gridMarks.setAppearance({ opacity: 0 });

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        applyCloseProgress(1);
        // No pin, no motion — and no corner marks either: they live in viewport space and are only
        // ever correct while this section is actually pinned (see useGridMarks.ts).
        modelSyncRef.current = () => applyCloseProgress(1);
        return;
      }

      // Held (not const) so onLeave's own resync below can reference it — see that callback's own
      // comment for why this replaces the old static, page-wide `ScrollTrigger.refresh()` call.
      let trigger: ScrollTrigger | null = null;

      trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: () => `+=${BUILD_PIN_SCROLL_DISTANCE * readScale()}`,
        scrub: true,
        pin: true,
        // GSAP disables automatic pin-spacing by default when the pinned element's parent is
        // display:flex (this page's <main class="flex flex-1 flex-col">) — force it on, same fix
        // every other pin in this project needs.
        pinSpacing: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => applyCloseProgress(self.progress),
        onRefresh: (self) => applyCloseProgress(self.progress),
        // Real bug, found via measurement (getBoundingClientRect on the closed wrapper vs. Footer's
        // own top) — not a guess: GSAP measures the pin-spacer's reserved height ONCE, from the
        // section's rendered size at setup time, while `--stack-gap` is still at its OPEN (tall)
        // value. That reservation never shrinks on its own once the cube closes via scroll — closing
        // only changes the wrapper's own CSS var, it doesn't trigger GSAP to re-measure — so a large
        // "phantom" gap (roughly the open/closed height difference) was left between the settled,
        // closed cube and whatever follows (Footer), even though visually nothing was still reserving
        // that space for a reason. Fixed by refreshing once the pin fully releases (closed), so the
        // spacer re-measures against the now-shorter content. Deferred one frame so the DOM has
        // settled from the same tick's `applyCloseProgress(1)` first.
        //
        // Per explicit feedback 2026-09-21: once the close animation finishes and scrolling
        // continues past it (toward the Footer), just hide the marks outright — don't try to keep
        // them visible for a while first. Several earlier attempts (a continuous rect-based fade, a
        // Hero-style independent ScrollTrigger) at softening this transition either read as "the
        // crosses are following me" or turned out fragile/broken in ways headless testing didn't
        // catch. A plain opacity flip on the SAME pin's own onLeave/onLeaveBack/onEnter/onEnterBack
        // — the simplest possible version of this, and the one every other pinned section's own
        // gridMarks already uses — is what was actually wanted.
        //
        // The refresh here is scoped to THIS trigger instance (`trigger.refresh()`), not the static
        // `ScrollTrigger.refresh()` — same fix, same reasoning as modelSyncRef's own doc comment
        // above. The static call reverts and re-measures EVERY ScrollTrigger on the page (and
        // dispatches a global "refresh" event every useGridMarks instance listens to), which is what
        // was actually causing the two bugs reported 2026-09-21 (refresh landing back at Hero, and
        // this section's own bottom crosses intermittently not reappearing). An instance-level
        // refresh() still re-measures THIS pin's own spacer against the now-closed, shorter content
        // — the one thing this call was ever needed for (see the "phantom gap" diagnosis a few lines
        // up) — without touching anything else on the page.
        onLeave: () => {
          applyCloseProgress(1);
          isPinnedRef.current = false;
          gridMarks.setAppearance({ opacity: 0 });
          requestAnimationFrame(() => trigger?.refresh());
        },
        onLeaveBack: () => {
          applyCloseProgress(0);
          isPinnedRef.current = false;
          gridMarks.setAppearance({ opacity: 0 });
        },
        // The moment the pin engages is the only moment the grid marks have a frame of reference
        // (viewport space) — same pattern as the machine screen's own wordmark crosses. `markBox()`
        // (BuildSectionClient.tsx) only ever computes a real box while `isPinnedRef.current` is
        // true, so re-snapping here always lands on the same resting position — scrolling back up
        // can never push the top pair any higher than that, since the position is never derived from
        // anything BUT this one static formula.
        onEnter: () => {
          isPinnedRef.current = true;
          gridMarks.refreshAnchor();
          gridMarks.setAppearance({ opacity: 1 });
        },
        onEnterBack: () => {
          isPinnedRef.current = true;
          gridMarks.refreshAnchor();
          gridMarks.setAppearance({ opacity: 1 });
        },
      });

      // The GLB loads asynchronously and arrives well after this trigger already exists — see
      // modelSyncRef's own doc comment on BuildScrollRefs for the full reasoning. Reads the
      // trigger's own current progress directly rather than going through a page-wide refresh.
      modelSyncRef.current = () => applyCloseProgress(trigger ? trigger.progress : 0);
    },
    { scope: sectionRef },
  );
}
