import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BackgroundLines } from "@/components/layout/BackgroundLines";
import { ScrollChurnGuard } from "@/components/layout/ScrollChurnGuard";
import "./globals.css";

// Half of a two-part fix for a real layout-churn bug — see ScrollChurnGuard.tsx for the other half
// and the full diagnosis (every pinned section's SSR-reserve spacer collapsing before GSAP's
// batched refresh has created the real pin-spacers that replace them, which can CLAMP window.scrollY
// mid-hydration). This half's only job is arming the "did the user genuinely scroll" cancel flag as
// early as physically possible — a `beforeInteractive` script, injected into the initial HTML and
// run before any Next.js/React code at all, so a real wheel/touch/scroll-key event can never arrive
// before something is listening for it. `ScrollChurnGuard.tsx` (a React effect) is too late for
// that specific job — reproduced with Playwright: wheel-scrolling starting the instant
// `domcontentloaded` fires can beat React's own hydration and its effect never gets to attach in
// time. This script only flips `window.__scrollChurnCancelled`; ScrollChurnGuard.tsx reads that flag
// and cleans these listeners up once its own restore window closes.
//
// Real bug, found 2026-09-21, in what USED to also live here: relying on the BROWSER's own
// `history.scrollRestoration` ("auto", the default) to put scrollY back where it was before a
// refresh, and having `ScrollChurnGuard.tsx` merely read `window.scrollY` during React's first
// render to capture that already-restored value. Traced with Playwright (patched `window.scrollTo`
// and `document.documentElement.scrollHeight` across real reloads): for a scroll position close to
// the BOTTOM of the page, native restoration frequently never applies AT ALL — not late, not
// clamped-then-corrected, just silently skipped — reproducibly, across fresh browser processes, not
// a testing artifact. Most likely cause: Chromium attempts the restoration once, early, and if the
// target would currently exceed the document's max scroll extent AT THAT EXACT MOMENT (plausible
// this early — this page has five separate SSR-reserve placeholders that each collapse to 0px the
// instant their own section's GSAP effect runs, before any of the five REAL pin-spacers that
// replace them exist yet, per the diagnosis above), it appears to give up rather than retry once
// layout settles. A client-side poll-and-wait hedge in `ScrollChurnGuard.tsx` did not help — this
// isn't a timing race `window.scrollY` can ever observe, because no restoration attempt happens at
// all in the failing case, at any point.
//
// Fixed at the root instead of chased further: `history.scrollRestoration = "manual"` here, as
// early as physically possible, opts this page OUT of the browser's own (proven unreliable for this
// page's architecture) restoration entirely — scrollY now reliably starts at 0 on every load, no
// race to hedge against. Restoration becomes this app's own job end-to-end: a `pagehide` listener
// (fires as part of the OLD document's unload sequence, which completes before a reload's new
// document begins loading — ordering-safe, and immune to this-same-load's own churn corrupting the
// value, unlike a continuous `scroll` listener would be) saves `window.scrollY` to `sessionStorage`
// right before the page goes away; `ScrollChurnGuard.tsx` reads it back from there instead of from
// `window.scrollY`.
const SCROLL_CHURN_GUARD_SCRIPT = `(function () {
  try { history.scrollRestoration = "manual"; } catch (e) {}

  var SCROLL_KEY = "__usectl_scrollY";
  function saveScrollY() {
    try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); } catch (e) {}
  }
  window.addEventListener("pagehide", saveScrollY);

  // Only a reload / back-forward should come back to the old position; a fresh visit starts at the top.
  var navType = "";
  try { var nav = performance.getEntriesByType("navigation")[0]; navType = nav ? nav.type : ""; } catch (e) {}
  var saved = null;
  try {
    if (navType === "reload" || navType === "back_forward") saved = sessionStorage.getItem(SCROLL_KEY);
    else sessionStorage.removeItem(SCROLL_KEY);
  } catch (e) {}

  // Hide the page while it is being put back where it was, so the top of the page never flashes
  // before the jump. Revealed by ScrollChurnGuard once the restore has landed (or by the failsafe).
  var root = document.documentElement;
  var revealed = false;
  window.__scrollRestoreReveal = function () {
    if (revealed) return;
    revealed = true;
    root.classList.remove("scroll-restoring");
  };
  if (saved !== null && Number(saved) > 0) {
    root.classList.add("scroll-restoring");
    setTimeout(window.__scrollRestoreReveal, 4000);
  } else {
    revealed = true;
  }

  window.__scrollChurnCancelled = false;
  function cancel() {
    window.__scrollChurnCancelled = true;
    window.__scrollRestoreReveal();
  }
  function onKey(e) {
    if (["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," "].indexOf(e.key) !== -1) cancel();
  }
  window.addEventListener("wheel", cancel, { passive: true });
  window.addEventListener("touchstart", cancel, { passive: true });
  window.addEventListener("keydown", onKey);
  window.__scrollChurnCleanup = function () {
    window.removeEventListener("wheel", cancel);
    window.removeEventListener("touchstart", cancel);
    window.removeEventListener("keydown", onKey);
  };
})();`;

// Hides the hero copy below its masks (globals.css .hero-mask) BEFORE the first paint, on a fresh
// load at the top of the page, so the intro can reveal it. This one has to be a plain inline
// <script> in <head>: a `beforeInteractive` <Script> (like the one above) is queued into
// `self.__next_s` and only runs once Next's runtime loads — after the SSR HTML has already painted,
// which showed the copy for a moment and then hid it (checked in a real browser). Skipped on a
// reload / back-forward that ScrollChurnGuard will restore to a scrolled position, and for reduced
// motion. HeroSectionClient reveals the copy and clears the failsafe below.
const HERO_INTRO_EARLY_SCRIPT = `(function () {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var nav = performance.getEntriesByType("navigation")[0];
    var type = nav ? nav.type : "";
    if (type === "reload" || type === "back_forward") {
      var saved = sessionStorage.getItem("__usectl_scrollY");
      if (saved !== null && Number(saved) > 0) return;
    }
    var root = document.documentElement;
    root.classList.add("hero-intro");
    window.__heroIntroFailsafe = setTimeout(function () { root.classList.remove("hero-intro"); }, 10000);
  } catch (e) {}
})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const siteName = "UseCTL";
const siteDescription = "TODO: Product description";
const siteUrl = "https://usectlcom";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: siteName,
    description: siteDescription,
    siteName,
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: SCROLL_CHURN_GUARD_SCRIPT may add the `scroll-restoring` class and
    // HERO_INTRO_EARLY_SCRIPT the `hero-intro` class to <html> before React hydrates (only this
    // element's own attributes are exempted).
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: HERO_INTRO_EARLY_SCRIPT }} />
      </head>
      <body className="relative min-h-full flex flex-col bg-background text-foreground">
        <Script id="scroll-churn-guard" strategy="beforeInteractive">
          {SCROLL_CHURN_GUARD_SCRIPT}
        </Script>
        <ScrollChurnGuard />
        <BackgroundLines />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
