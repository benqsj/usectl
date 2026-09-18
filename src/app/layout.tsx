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
// time. But a `beforeInteractive` script runs too EARLY to be trusted for CAPTURING the scroll
// position to restore (also reproduced: window.scrollY read this early can predate the browser's
// own history scroll-restoration, capturing 0-ish garbage instead of the real prior position) —
// so capturing the target and doing the actual restore stays in ScrollChurnGuard.tsx, which reads
// it during React's render phase (reliably after restoration, same as before). This script only
// flips `window.__scrollChurnCancelled`; ScrollChurnGuard.tsx reads that flag and cleans these
// listeners up once its own restore window closes.
const SCROLL_CHURN_GUARD_SCRIPT = `(function () {
  window.__scrollChurnCancelled = false;
  function cancel() { window.__scrollChurnCancelled = true; }
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
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
