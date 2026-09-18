"use client";

import { useState } from "react";
import { useGSAP } from "@gsap/react";

declare global {
  interface Window {
    __scrollChurnCancelled?: boolean;
    __scrollChurnCleanup?: () => void;
  }
}

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
// This component captures window.scrollY once — via a `useState` LAZY INITIALIZER, which runs
// during this component's first RENDER, guaranteed to happen before any section's effect can
// collapse a spacer — and restores it 150ms later if it drifted, UNLESS the global
// `window.__scrollChurnCancelled` flag is set. That flag is armed by a separate, plain
// `beforeInteractive` script (`layout.tsx`'s `SCROLL_CHURN_GUARD_SCRIPT`), not by this component
// itself: a first version attached its cancel-on-user-scroll listeners from inside this same React
// effect, and Playwright caught a real gap — a wheel event fired the instant the page responded can
// arrive before React finishes hydrating and this effect gets a chance to attach anything, so it
// went uncaught and the restore fired anyway, snapping the user back to their pre-refresh position
// mid-scroll (reported as the hero server "suddenly opening, then closing again"). A
// `beforeInteractive` script's listeners are live before any input is physically possible.
//
// The reverse swap — capturing the TARGET scrollY in that same early script instead of here — was
// tried and reverted: `beforeInteractive` runs too early for THAT job. Reproduced with Playwright:
// reading `window.scrollY` from the early script can predate the browser's own history
// scroll-restoration finishing, capturing ~0 instead of the real prior position, so every restore
// silently no-op'd (current scrollY already "matched" the wrong captured target). Capturing during
// this component's render — later than the early script, but still before any section's spacer can
// collapse — is the value that's actually reliable.
export function ScrollChurnGuard() {
  // The lazy initializer runs exactly once, synchronously, during this component's first render —
  // same guarantee a render-phase ref read would give, but through React's actually sanctioned
  // "compute once" mechanism (a bare `if (ref.current === null) ref.current = ...` read during
  // render works in practice but trips the `react-hooks/refs` lint rule).
  const [captured] = useState(() => (typeof window !== "undefined" ? window.scrollY : null));

  useGSAP(() => {
    const target = captured;
    if (target === null) return;
    // Comfortably past every section's own spacer-collapse-then-batched-refresh churn.
    const id = window.setTimeout(() => {
      if (!window.__scrollChurnCancelled && window.scrollY !== target) window.scrollTo(0, target);
      window.__scrollChurnCleanup?.();
    }, 150);
    return () => window.clearTimeout(id);
  }, [captured]);

  return null;
}
