"use client";

import { useState } from "react";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

declare global {
  interface Window {
    __scrollChurnCancelled?: boolean;
    __scrollChurnCleanup?: () => void;
    __scrollRestoreReveal?: () => void;
  }
}

const SCROLL_KEY = "__usectl_scrollY";

// Dispatched right after the restore lands. Sections that smooth their own progress by hand (not
// through a ScrollTrigger scrub tween) listen for it and jump straight to the restored position —
// otherwise the page would fade back in mid-glide from the top state to the restored one.
export const SCROLL_RESTORED_EVENT = "usectl:scroll-restored";

// Every pinned section on this page (Hero, Infrastructure intro, Machine, Pricing, Build)
// server-renders an SSR-reserve spacer that gets collapsed to 0px the instant its own GSAP effect
// runs, right before that effect creates the REAL pin-spacer meant to take over the same space.
// GSAP batches the actual pin-spacer creation for multiple ScrollTriggers created in the same tick
// into one deferred refresh pass — so there's a real window, during hydration, where ALL FIVE SSR
// spacers have already collapsed but NONE of the five real pin-spacers exist yet. The document is
// genuinely shorter than the current scrollY during that window, and the browser responds by
// CLAMPING scrollY to fit — which is what a hard refresh anywhere below the very top of the page
// looked like: a scrollY jump right after load, with nothing visibly wrong in the DOM to explain it.
// (An earlier version of this file had each pinned section independently guess-and-restore this —
// itself a bug, since those five per-section captures raced each other; see git history.)
//
// Rewritten 2026-09-21 to stop depending on the BROWSER's own `history.scrollRestoration` at all.
// The original version captured `window.scrollY` once during this component's first render (React
// runs render before any effect, so this was guaranteed to run before any section's spacer could
// collapse) and trusted that the browser had ALREADY restored scrollY to its pre-refresh position by
// then. That trust turned out to be misplaced: traced with Playwright (patched `window.scrollTo`
// across real reloads, plus a fresh browser PROCESS per attempt to rule out any test-harness
// artifact), native restoration for a scroll position close to the BOTTOM of this page frequently
// never applies at all — not late, just silently skipped, reproducibly. A client-side poll-and-wait
// hedge (tried first) didn't help, because there was nothing to wait FOR — no restoration attempt
// ever happens in the failing case, at any point, so `window.scrollY` legitimately stays 0 the whole
// time and there's no signal in this component to distinguish that from a genuine top-of-page load.
//
// Fixed at the root instead: `layout.tsx`'s `SCROLL_CHURN_GUARD_SCRIPT` now sets
// `history.scrollRestoration = "manual"` as early as physically possible, opting this page OUT of
// native restoration entirely, and saves `window.scrollY` to `sessionStorage` on `pagehide` (fires
// as part of the OLD document's unload sequence, which completes before a reload's new document
// begins loading — so the saved value is always the genuine pre-refresh position, and immune to
// THIS load's own churn corrupting it the way a plain continuous `scroll` listener would risk).
// scrollY now reliably starts at 0 on every load (nothing native ever moves it), and this component
// reads the real target back from `sessionStorage` — a plain, already-available string, no timing
// race against anything left to hedge against.
export function ScrollChurnGuard() {
  // The lazy initializer runs exactly once, synchronously, during this component's first render —
  // same guarantee a render-phase ref read would give, but through React's actually sanctioned
  // "compute once" mechanism (a bare `if (ref.current === null) ref.current = ...` read during
  // render works in practice but trips the `react-hooks/refs` lint rule).
  const [captured] = useState(() => {
    if (typeof window === "undefined") return null;
    const saved = window.sessionStorage.getItem(SCROLL_KEY);
    if (saved === null) return null;
    const parsed = Number(saved);
    return Number.isFinite(parsed) ? parsed : null;
  });

  useGSAP(() => {
    const target = captured;
    if (target === null) {
      window.__scrollRestoreReveal?.();
      return;
    }
    let raf = 0;
    // Comfortably past every section's own spacer-collapse-then-batched-refresh churn.
    const id = window.setTimeout(() => {
      if (!window.__scrollChurnCancelled && window.scrollY !== target) {
        window.scrollTo(0, target);
        // Let every trigger see the new position NOW (the scroll event would only arrive next
        // frame), then finish their scrub catch-up tweens instantly — the page was hidden while it
        // sat at the top, so there is nothing to glide from.
        ScrollTrigger.update();
        ScrollTrigger.getAll().forEach((st) => {
          // getTween() is `false`/undefined for triggers without a numeric scrub.
          const scrubTween = st.getTween();
          if (scrubTween) scrubTween.progress(1);
        });
        window.dispatchEvent(new Event(SCROLL_RESTORED_EVENT));
      }
      window.__scrollChurnCleanup?.();
      // One frame for the snapped state to render before the page becomes visible again.
      raf = requestAnimationFrame(() => window.__scrollRestoreReveal?.());
    }, 150);
    return () => {
      window.clearTimeout(id);
      cancelAnimationFrame(raf);
    };
  }, [captured]);

  return null;
}
