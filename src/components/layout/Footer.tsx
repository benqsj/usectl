"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { s } from "@/lib/grid";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Footer (built 2026-09-28 against Desktop/new-version/footer/ — one 1708-wide screenshot,
// design px = ref × 1.124). A REAL section after the pinned hero: its opaque background is what
// ends the fixed BackgroundLines grid, exactly like the design (no grid inside the footer).
// The App Store / Google Play badges are drawn inline (no badge assets exist in the repo);
// x-twitter.svg was restored from git (main:public/footer/x-twitter.svg). The giant watermark is
// logo.svg itself, desaturated via CSS filter. "© 2026 SYSTEMCTL" is what the design says — NOT
// usectl — kept verbatim on purpose.

const NAV_LINKS = [
  { label: "The Machine", href: "#the-machine" },
  { label: "Agents", href: "#agents" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Doc", href: "#documentation" },
] as const;

export function Footer() {
  const footerRef = useRef<HTMLElement>(null);

  // scroll-into-view entrance — the same staggered fade-up the pricing section had while it was
  // standalone (user asked for that exact feel back, on the footer)
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from("[data-footer-reveal]", {
        y: 40,
        autoAlpha: 0,
        stagger: 0.1,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: { trigger: footerRef.current, start: "top 80%" },
      });
    },
    { scope: footerRef },
  );

  return (
    <footer
      ref={footerRef}
      className="relative overflow-hidden"
      style={{ height: s(800), background: "#1b1a1a", borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* soft green wash over the watermark's right side */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          left: s(1050),
          top: s(300),
          width: s(900),
          height: s(560),
          background: "radial-gradient(ellipse at center, rgba(17,163,42,0.10) 0%, rgba(17,163,42,0) 65%)",
          filter: `blur(${s(30)})`,
        }}
      />

      {/* giant desaturated logo watermark */}
      <Image
        src="/logo/logo.svg"
        alt=""
        width={151}
        height={25}
        aria-hidden="true"
        className="pointer-events-none absolute select-none"
        style={{
          left: s(140),
          top: s(400),
          width: s(1560),
          height: "auto",
          opacity: 0.05,
          filter: "grayscale(1) brightness(2.5)",
        }}
      />

      {/* brand column */}
      <div data-footer-reveal className="absolute" style={{ left: s(187), top: s(76) }}>
        <Link href="/" aria-label="usectl home" className="inline-block">
          <Image src="/logo/logo.svg" alt="usectl" width={151} height={25} style={{ width: s(172), height: "auto" }} />
        </Link>
        <p className="font-heading font-light text-white/60" style={{ marginTop: s(30), fontSize: s(16) }}>
          37 Zhiuli Shartava st., Tbilisi 2209 Georgia
        </p>

        {/* store badges (inline art — no official assets in the repo) */}
        <div className="flex items-center" style={{ marginTop: s(48), gap: s(20) }}>
          <a
            href="#"
            aria-label="Download on the App Store"
            className="flex items-center rounded-lg border border-white/25 bg-black transition-colors hover:bg-white/5"
            style={{ height: s(44), paddingLeft: s(13), paddingRight: s(15), gap: s(9) }}
          >
            <svg viewBox="0 0 384 512" fill="#fff" style={{ width: s(19), height: s(24) }} aria-hidden="true">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
            <span className="text-left leading-none">
              <span className="block text-white/80" style={{ fontSize: s(9) }}>
                Download on the
              </span>
              <span className="block font-medium text-white" style={{ marginTop: s(3), fontSize: s(16.5) }}>
                App Store
              </span>
            </span>
          </a>
          <a
            href="#"
            aria-label="Get it on Google Play"
            className="flex items-center rounded-lg border border-white/25 bg-black transition-colors hover:bg-white/5"
            style={{ height: s(44), paddingLeft: s(13), paddingRight: s(15), gap: s(9) }}
          >
            <svg viewBox="0 0 24 26" fill="none" style={{ width: s(19), height: s(21) }} aria-hidden="true">
              <defs>
                <linearGradient id="play-badge-grad" x1="0" y1="0" x2="22" y2="26" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#00d7fe" />
                  <stop offset="0.35" stopColor="#00f076" />
                  <stop offset="0.7" stopColor="#ffce00" />
                  <stop offset="1" stopColor="#f63448" />
                </linearGradient>
              </defs>
              <path d="M1 1.5 L22.5 13 L1 24.5 Z" fill="url(#play-badge-grad)" />
            </svg>
            <span className="text-left leading-none">
              <span className="block uppercase text-white/80" style={{ fontSize: s(9), letterSpacing: "0.04em" }}>
                Get it on
              </span>
              <span className="block font-medium text-white" style={{ marginTop: s(3), fontSize: s(16.5) }}>
                Google Play
              </span>
            </span>
          </a>
        </div>
      </div>

      {/* navigation column */}
      <div data-footer-reveal className="absolute font-heading" style={{ left: s(707), top: s(76) }}>
        <h3 className="font-medium text-white/85" style={{ fontSize: s(16) }}>
          Navigation
        </h3>
        <ul style={{ marginTop: s(28) }}>
          {NAV_LINKS.map((link) => (
            <li key={link.href} style={{ marginBottom: s(14) }}>
              <Link
                href={link.href}
                className="font-light text-white/55 transition-colors hover:text-white"
                style={{ fontSize: s(15.5) }}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* contact column */}
      <div data-footer-reveal className="absolute font-heading" style={{ left: s(1058), top: s(76) }}>
        <h3 className="font-medium text-white/85" style={{ fontSize: s(16) }}>
          Contact
        </h3>
        <p style={{ marginTop: s(28) }}>
          <a
            href="mailto:hello@usectl.com"
            className="font-light text-white/55 transition-colors hover:text-white"
            style={{ fontSize: s(15.5) }}
          >
            hello@usectl.com
          </a>
        </p>
        <p style={{ marginTop: s(14) }}>
          <a
            href="tel:+995511111111"
            className="font-light text-white/55 transition-colors hover:text-white"
            style={{ fontSize: s(15.5) }}
          >
            +995 511 11 11 11
          </a>
        </p>
        <a href="#" aria-label="usectl on X" className="inline-block opacity-60 transition-opacity hover:opacity-100" style={{ marginTop: s(16) }}>
          <Image src="/footer/x-twitter.svg" alt="" width={24} height={24} style={{ width: s(18), height: s(18) }} />
        </a>
      </div>

      {/* subscribe column */}
      <div data-footer-reveal className="absolute font-heading" style={{ left: s(1439), top: s(76) }}>
        <h3 className="font-medium text-white/85" style={{ fontSize: s(16) }}>
          Subscribe
        </h3>
        <input
          type="email"
          placeholder="email"
          className="block rounded-lg border border-white/15 bg-transparent font-light text-white/80 outline-none placeholder:text-white/30 focus:border-white/35"
          style={{ marginTop: s(24), width: s(232), height: s(42), paddingLeft: s(14), paddingRight: s(14), fontSize: s(14) }}
        />
        <label
          className="flex cursor-pointer items-center font-light text-white/60"
          style={{ marginTop: s(18), gap: s(9), fontSize: s(14.5) }}
        >
          <input type="checkbox" className="accent-brand" style={{ width: s(14), height: s(14) }} />
          I agree to the terms and conditions.
        </label>
      </div>

      {/* copyright */}
      <p
        data-footer-reveal
        className="absolute left-0 w-full text-center font-heading text-white/45"
        style={{ top: s(735), fontSize: s(14), letterSpacing: "0.05em" }}
      >
        &copy; 2026 <span className="text-brand">SYSTEMCTL</span>
      </p>
    </footer>
  );
}
