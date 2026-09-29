"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { m } from "./HeroMobile";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// PHONE footer (< 768px): the desktop Footer is an absolutely-positioned 1920 canvas that can't
// reflow, so phones get this flow-layout version with the same content, stacked. Same staggered
// fade-up on enter as the desktop one.

const NAV_LINKS = [
  { label: "The Machine", href: "#the-machine" },
  { label: "Agents", href: "#agents" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Doc", href: "#documentation" },
] as const;

export function FooterMobile() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from("[data-mf-reveal]", {
        y: 30,
        autoAlpha: 0,
        stagger: 0.08,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: { trigger: ref.current, start: "top 85%" },
      });
    },
    { scope: ref },
  );

  const h3 = "font-heading font-medium text-white/85";
  const link = "font-heading font-light text-white/55";

  return (
    <footer
      ref={ref}
      className="relative overflow-hidden md:hidden"
      style={{
        ["--m" as string]: "min(calc(100vw / 390), 1.1px)",
        background: "#1b1a1a",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: `${m(48)} ${m(20)} ${m(28)}`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          right: m(-140),
          bottom: m(40),
          width: m(360),
          height: m(320),
          background: "radial-gradient(ellipse at center, rgba(90,255,200,0.12) 0%, rgba(90,255,200,0.05) 50%, rgba(90,255,200,0) 75%)",
          filter: "blur(24px)",
        }}
      />

      <div data-mf-reveal className="relative">
        <Link href="/" aria-label="usectl home" className="inline-block">
          <Image src="/logo/logo.svg" alt="usectl" width={151} height={25} style={{ width: m(130), height: "auto" }} />
        </Link>
        <p className="font-heading font-light text-white/60" style={{ marginTop: m(18), fontSize: m(14) }}>
          37 Zhiuli Shartava st., Tbilisi 2209 Georgia
        </p>
        <div className="flex flex-wrap items-center" style={{ marginTop: m(22), gap: m(12) }}>
          <a
            href="#"
            aria-label="Download on the App Store"
            className="flex items-center rounded-lg border border-white/25 bg-black"
            style={{ height: m(42), paddingLeft: m(12), paddingRight: m(14), gap: m(8) }}
          >
            <svg viewBox="0 0 384 512" fill="#fff" style={{ width: m(17), height: m(21) }} aria-hidden="true">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
            <span className="text-left leading-none">
              <span className="block text-white/80" style={{ fontSize: m(8.5) }}>
                Download on the
              </span>
              <span className="block font-medium text-white" style={{ marginTop: m(3), fontSize: m(15) }}>
                App Store
              </span>
            </span>
          </a>
          <a
            href="#"
            aria-label="Get it on Google Play"
            className="flex items-center rounded-lg border border-white/25 bg-black"
            style={{ height: m(42), paddingLeft: m(12), paddingRight: m(14), gap: m(8) }}
          >
            <svg viewBox="0 0 24 26" fill="none" style={{ width: m(17), height: m(19) }} aria-hidden="true">
              <defs>
                <linearGradient id="play-badge-grad-m" x1="0" y1="0" x2="22" y2="26" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#00d7fe" />
                  <stop offset="0.35" stopColor="#00f076" />
                  <stop offset="0.7" stopColor="#ffce00" />
                  <stop offset="1" stopColor="#f63448" />
                </linearGradient>
              </defs>
              <path d="M1 1.5 L22.5 13 L1 24.5 Z" fill="url(#play-badge-grad-m)" />
            </svg>
            <span className="text-left leading-none">
              <span className="block uppercase text-white/80" style={{ fontSize: m(8.5), letterSpacing: "0.04em" }}>
                Get it on
              </span>
              <span className="block font-medium text-white" style={{ marginTop: m(3), fontSize: m(15) }}>
                Google Play
              </span>
            </span>
          </a>
        </div>
      </div>

      <div className="relative grid grid-cols-2" style={{ marginTop: m(40), columnGap: m(20), rowGap: m(36) }}>
        <div data-mf-reveal>
          <h3 className={h3} style={{ fontSize: m(15) }}>
            Navigation
          </h3>
          <ul style={{ marginTop: m(16) }}>
            {NAV_LINKS.map((l) => (
              <li key={l.href} style={{ marginBottom: m(10) }}>
                <Link href={l.href} className={link} style={{ fontSize: m(14.5) }}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div data-mf-reveal>
          <h3 className={h3} style={{ fontSize: m(15) }}>
            Contact
          </h3>
          <p style={{ marginTop: m(16) }}>
            <a href="mailto:hello@usectl.com" className={link} style={{ fontSize: m(14.5) }}>
              hello@usectl.com
            </a>
          </p>
          <p style={{ marginTop: m(10) }}>
            <a href="tel:+995511111111" className={link} style={{ fontSize: m(14.5) }}>
              +995 511 11 11 11
            </a>
          </p>
          <a href="#" aria-label="usectl on X" className="inline-block opacity-60" style={{ marginTop: m(12) }}>
            <Image src="/footer/x-twitter.svg" alt="" width={24} height={24} style={{ width: m(17), height: m(17) }} />
          </a>
        </div>
      </div>

      <div data-mf-reveal className="relative" style={{ marginTop: m(36) }}>
        <h3 className={h3} style={{ fontSize: m(15) }}>
          Subscribe
        </h3>
        <input
          type="email"
          placeholder="email"
          className="block w-full rounded-lg border border-white/15 bg-transparent font-heading font-light text-white/80 outline-none placeholder:text-white/30 focus:border-white/35"
          style={{ marginTop: m(14), height: m(44), paddingInline: m(14), fontSize: 16 }}
        />
        <label className="flex cursor-pointer items-center font-heading font-light text-white/60" style={{ marginTop: m(14), gap: m(9), fontSize: m(13.5) }}>
          <span className="relative inline-block shrink-0" style={{ width: m(16), height: m(16) }}>
            <input
              type="checkbox"
              className="peer absolute inset-0 m-0 cursor-pointer appearance-none border border-white/25 bg-transparent checked:border-brand checked:bg-brand"
              style={{ borderRadius: m(4) }}
            />
            <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full peer-checked:block">
              <path d="M3 6.2 5.1 8.3 9 4.2" stroke="#1e1d1d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          I agree to the terms and conditions.
        </label>
      </div>

      <Image
        src="/logo/logo.svg"
        alt=""
        width={151}
        height={25}
        aria-hidden="true"
        className="pointer-events-none relative block select-none"
        style={{ marginTop: m(40), width: "100%", height: "auto", opacity: 0.05, filter: "grayscale(1) brightness(2.5)" }}
      />

      <p data-mf-reveal className="relative text-center font-heading text-white/45" style={{ marginTop: m(24), fontSize: m(12.5), letterSpacing: "0.05em" }}>
        &copy; 2026 <span className="text-brand">SYSTEMCTL</span>
      </p>
    </footer>
  );
}
