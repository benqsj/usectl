"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// Burger menu for < 1024px (the desktop nav doesn't fit there). The button lives in the header;
// the panel is PORTALED to <body> because the header's backdrop-filter makes it the containing
// block for fixed children (and its overflow clip would cut the panel off). The panel slides in
// under the 64px header, so the header — and the X — stay on top of it.
// Look: same vocabulary as the page — dark glass over the grid, mono "0N/" numbering in brand
// green (the state-3/4 panels), Space Grotesk links, the mint scene light low right, and the
// two pill buttons. Links blur-rise in with a stagger, like every text column on the page.

type NavLink = { label: string; href: string };

export function MobileMenu({ links }: { links: readonly NavLink[] }) {
  const [open, setOpen] = useState(false);
  // true only on the client (the portal needs document.body) — no setState-in-effect
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  // build the open/close timeline once the portal exists
  useGSAP(
    () => {
      const panel = panelRef.current;
      if (!panel) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
      tl.fromTo(panel, { autoAlpha: 0 }, { autoAlpha: 1, duration: reduced ? 0.01 : 0.3, ease: "power2.out" });
      if (!reduced) {
        tl.fromTo(
          panel.querySelectorAll("[data-menu-row]"),
          { autoAlpha: 0, y: 22, filter: "blur(8px)" },
          { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.55, stagger: 0.06 },
          0.08,
        );
        tl.fromTo(panel.querySelectorAll("[data-menu-line]"), { scaleX: 0 }, { scaleX: 1, duration: 0.6, stagger: 0.06 }, 0.12);
        tl.fromTo(panel.querySelectorAll("[data-menu-foot]"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.08 }, 0.35);
        tl.fromTo(panel.querySelector("[data-menu-light]"), { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 1 }, 0);
      }
      tlRef.current = tl;
    },
    { dependencies: [mounted] },
  );

  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (open) {
      tl.timeScale(1).play();
      document.documentElement.style.overflow = "hidden";
    } else {
      tl.timeScale(1.6).reverse();
      document.documentElement.style.overflow = "";
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => mq.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [open]);

  // three green bars in the page's own greens (brand #11a32a → the lighter #35c957 / #1ed148 the
  // hover states and the ruler fill use); middle one shorter. Open: outer two cross into an X,
  // the middle one shrinks away.
  const bar = "absolute left-1/2 top-1/2 block h-[2px] rounded-full transition-all duration-300 ease-out";

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="relative ml-auto h-10 w-10 shrink-0 rounded-md border border-[rgba(17,163,42,0.45)] bg-[rgba(17,163,42,0.06)] transition-[border-color,background-color,box-shadow] hover:border-[#35c957] hover:shadow-[0_0_12px_rgba(53,201,87,0.25)] active:bg-[rgba(17,163,42,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 lg:hidden"
      >
        <span
          className={bar}
          style={{
            width: 20,
            background: "linear-gradient(90deg, #11a32a, #35c957)",
            transform: open ? "translate(-50%, -50%) rotate(45deg)" : "translate(-50%, calc(-50% - 6px))",
          }}
        />
        <span
          className={bar}
          style={{
            width: open ? 0 : 14,
            opacity: open ? 0 : 1,
            background: "#1ed148",
            transform: "translate(calc(-50% + 3px), -50%)",
          }}
        />
        <span
          className={bar}
          style={{
            width: 20,
            background: "linear-gradient(90deg, #11a32a, #35c957)",
            transform: open ? "translate(-50%, -50%) rotate(-45deg)" : "translate(-50%, calc(-50% + 6px))",
          }}
        />
      </button>

      {mounted &&
        createPortal(
          <div
            ref={panelRef}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col overflow-y-auto lg:hidden"
            style={{ visibility: "hidden", opacity: 0, background: "rgba(27,26,26,0.94)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
          >
            <div
              data-menu-light
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                right: "-30%",
                bottom: "-10%",
                width: "90%",
                height: "55%",
                background: "radial-gradient(ellipse at center, rgba(90,255,200,0.13) 0%, rgba(17,163,42,0.06) 45%, rgba(17,163,42,0) 72%)",
                filter: "blur(30px)",
              }}
            />

            <nav aria-label="Mobile" className="relative mx-auto w-full max-w-[640px] px-5 pt-8 sm:px-8">
              <p data-menu-row className="font-mono text-[11px] tracking-[0.12em] text-white/40">
                NAVIGATION
              </p>
              <ul className="mt-4">
                {links.map((l, i) => (
                  <li key={l.href} className="relative">
                    <Link
                      data-menu-row
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-baseline gap-4 py-4 font-heading text-[30px] leading-none text-white/85 transition-colors hover:text-white sm:text-[38px]"
                    >
                      <span className="w-8 font-mono text-[12px] text-brand sm:text-[13px]">0{i + 1}/</span>
                      <span className="flex-1">{l.label}</span>
                      <span aria-hidden="true" className="text-[18px] text-white/35 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand">
                        &#8599;
                      </span>
                    </Link>
                    <span
                      data-menu-line
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 block h-px origin-left"
                      style={{ background: "linear-gradient(90deg, rgba(17,163,42,0.55), rgba(59,130,246,0.25) 45%, rgba(255,255,255,0.06) 100%)" }}
                    />
                  </li>
                ))}
              </ul>
            </nav>

            <div className="relative mx-auto mt-auto w-full max-w-[640px] px-5 pb-10 pt-10 sm:px-8">
              <div data-menu-foot className="flex flex-wrap gap-3">
                <Link
                  href="#start"
                  onClick={() => setOpen(false)}
                  className="flex h-12 items-center justify-center rounded-full border border-white/25 px-6 font-heading text-[15px] font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
                >
                  Start Building
                </Link>
                <Link
                  href="#how"
                  onClick={() => setOpen(false)}
                  className="flex h-12 items-center justify-center gap-1.5 rounded-full border border-white/25 px-6 font-heading text-[15px] text-foreground transition-colors hover:border-brand hover:text-brand"
                >
                  See how it works <span aria-hidden="true">&#8599;</span>
                </Link>
              </div>
              <div data-menu-foot className="mt-8 flex items-center justify-between font-heading text-[13px] text-white/45">
                <a href="mailto:hello@usectl.com" className="transition-colors hover:text-white">
                  hello@usectl.com
                </a>
                <span>
                  &copy; 2026 <span className="text-brand">SYSTEMCTL</span>
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
