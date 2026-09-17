"use client";

import { useEffect, useState } from "react";

// Draws an SVG into a canvas once and hands back a PNG data URL.
//
// Why: the machine screen scales topside.svg up by ~9x. Browsers re-rasterise an SVG at every new
// scale, which is exactly what made the zoom stutter on a big screen; a bitmap is scaled on the
// GPU instead. Returns null until it's ready (and on failure), so callers keep the SVG as-is —
// the visual is identical either way, this is purely a performance swap.
export function useRasterizedSvg(src: string, size: number): string | null {
  const [raster, setRaster] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = Math.round((size * img.height) / img.width);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setRaster(canvas.toDataURL("image/png"));
      } catch {
        // tainted canvas / out of memory — keep the SVG
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, size]);

  return raster;
}
