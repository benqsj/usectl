import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { HERO_STACK_GAP_CLOSED_PX, HERO_STACK_GAP_OPEN_PX } from "@/lib/heroLayers";
import { BUILD_PIN_SCROLL_DISTANCE } from "@/lib/buildLayout";
import { gridMetrics, readScale } from "@/lib/grid";
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
// real pin-spacer, it needs the same refresh-safety pair every other pinned section in this project
// carries (see heroScrollAnimation.ts for the original, fully-diagnosed bug both of these guard
// against): `ssrScrollReserveRef` (server-rendered placeholder so the pre-hydration and hydrated page
// heights match) and `scrollYBeforeChurnRef` (restores scrollY if React 19 StrictMode's dev-only
// effect churn clamps it away).
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
  ssrScrollReserveRef,
  gridMarks,
  isPinnedRef,
}: BuildScrollRefs) {
  const scrollYBeforeChurnRef = useRef<number | null>(null);

  useGSAP(
    () => {
      if (scrollYBeforeChurnRef.current === null) scrollYBeforeChurnRef.current = window.scrollY;

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
        const clamped = gsap.utils.clamp(0, 1, closeProgress);
        gsap.set(wrapper, {
          "--stack-gap": `${gsap.utils.interpolate(STACK_GAP_OPEN_PX, STACK_GAP_CLOSED_PX, clamped)}px`,
          y: -LIFT_ON_CLOSE_PX * clamped,
          // Takes the lift out of the layout too, so nothing is left holding the space the server
          // just vacated (see LIFT_ON_CLOSE_PX).
          marginBottom: -LIFT_ON_CLOSE_PX * clamped,
        });
        modelRef.current?.setProgress(1 - clamped);
      };

      applyCloseProgress(0);
      gridMarks.setAppearance({ opacity: 0 });

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        applyCloseProgress(1);
        // No pin, no motion — and no corner marks either: they live in viewport space and are only
        // ever correct while this section is actually pinned (see useGridMarks.ts).
        return;
      }

      ScrollTrigger.create({
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
        onLeave: () => {
          applyCloseProgress(1);
          // Geometry-wise this section is no longer pinned — see isPinnedRef's own doc comment —
          // but the marks themselves stay visually on (no setAppearance call here); only their
          // position stops updating.
          isPinnedRef.current = false;
          requestAnimationFrame(() => ScrollTrigger.refresh());
        },
        onLeaveBack: () => {
          applyCloseProgress(0);
          isPinnedRef.current = false;
          // Scrolled back above the section entirely — this is the only direction the marks get
          // hidden again. See onEnter/onEnterBack below for why forward exit doesn't hide them.
          gridMarks.setAppearance({ opacity: 0 });
        },
        // The moment the pin engages is the only moment the grid marks have a frame of reference
        // (viewport space) — same pattern as the machine screen's own wordmark crosses.
        //
        // Split out of a single onToggle per feedback 2026-09-21: this is the LAST section on the
        // page before the footer, and hiding the marks the instant the pin released (right as the
        // model finished settling into its closed pose) read as the crosses vanishing out from under
        // it before there was any chance to see the resting state. onEnter/onEnterBack turn them on;
        // onLeave (forward exit, past the pin) deliberately leaves them alone — they stay visible
        // through the rest of the section instead of cutting out the moment it unpins.
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

      // Per feedback 2026-09-21: two earlier attempts (both since reverted) tried to keep the marks
      // LIVE-TRACKING the server once unpinned, using its `getBoundingClientRect()` — first without
      // any off-screen handling, then fading based on `rect.bottom`, then `rect.top`. All three read
      // as "the crosses are following me down the page", which is exactly what was NOT wanted. The
      // actual ask is simpler: once scrolled down past the pin (heading toward the Footer), just
      // hide the marks — leave their POSITION exactly where it was when the pin let go, don't
      // recompute it at all. `markBox()` (BuildSectionClient.tsx) went back to returning `null` once
      // unpinned for exactly this — `refreshAnchor()` (which is what would move the marks) is never
      // called from here any more; this handler only ever touches opacity. `getBoundingClientRect()`
      // is still read here, but purely as a "how far past the pin are we" signal for the fade curve,
      // not to reposition anything.
      //
      // The fade's own reference point: `nearestRow`'s floor-of-1 doesn't bite exactly at
      // `rect.top < 0` — it bites at `rect.top < m.header + 0.5*m.rowPitch` (the point its own
      // rounding would want to go below row 1). Anchoring the fade there (not at the arbitrary `0`)
      // means it starts exactly when the position would otherwise go stale, not some time after —
      // confirmed via a real screenshot where a `rect.top === 0` reference left the cross fully
      // opaque while already visibly detached.
      const OFFSCREEN_FADE_PX = 200;
      let scrollRaf = 0;
      const onScroll = () => {
        if (isPinnedRef.current || scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0;
          const el = wrapperRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const k = readScale();
          const fadePx = OFFSCREEN_FADE_PX * k;
          const m = gridMetrics(undefined, k);
          const breakPoint = m.header + 0.5 * m.rowPitch;
          const opacity = gsap.utils.clamp(0, 1, (rect.top - breakPoint + fadePx) / fadePx);
          gridMarks.setAppearance({ opacity });
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });

      // Restores whatever scrollY was BEFORE StrictMode's dev-only churn clamped it away — same
      // mechanism as heroScrollAnimation.ts / infrastructureScrollAnimation.ts.
      const targetScrollY = scrollYBeforeChurnRef.current;
      if (targetScrollY !== null) {
        setTimeout(() => {
          if (window.scrollY !== targetScrollY) window.scrollTo(0, targetScrollY);
        }, 100);
      }

      return () => {
        window.removeEventListener("scroll", onScroll);
        if (scrollRaf) cancelAnimationFrame(scrollRaf);
      };
    },
    { scope: sectionRef },
  );
}
