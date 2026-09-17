import { type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface StaticBarRefs {
  wrapperRef: RefObject<HTMLDivElement | null>;
  fillRef: RefObject<HTMLDivElement | null>;
}

// Scrubs the green overlay's reveal width from 0 -> 100% as the bar scrolls through this range of
// the viewport — no green at all until the bar comes into view, fully revealed (matching
// static.svg's own designed look) well before it scrolls past.
export function useStaticBarFillAnimation({ wrapperRef, fillRef }: StaticBarRefs) {
  useGSAP(
    () => {
      if (!wrapperRef.current || !fillRef.current) return;

      gsap.set(fillRef.current, { clipPath: "inset(0% 100% 0% 0%)" });

      gsap.to(fillRef.current, {
        clipPath: "inset(0% 0% 0% 0%)",
        ease: "none",
        scrollTrigger: {
          trigger: wrapperRef.current,
          start: "top 90%",
          end: "top 40%",
          scrub: true,
        },
      });
    },
    { scope: wrapperRef },
  );
}
