"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CssGridLines } from "@/components/layout/BackgroundLines";
import { GridCanvas } from "@/components/layout/GridCanvas";
import { GRID_EFFECT_DEFAULTS, type GridEffectParams } from "@/lib/gridEffect/config";
import { getMarks, subscribeMarks } from "@/lib/gridEffect/marks";
import { useGridMarks } from "@/lib/gridEffect/useGridMarks";
import { HEADER_HEIGHT_PX, gridMetrics, readScale } from "@/lib/grid";

const COMPARE_COLOR = "rgba(255,0,0,0.85)";

interface SliderSpec {
  key: keyof GridEffectParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const SLIDERS: SliderSpec[] = [
  { key: "glowRadiusPx", label: "Glow radius", min: 80, max: 400, step: 5, unit: "px" },
  { key: "lineGlowAlpha", label: "Line glow alpha", min: 0.02, max: 0.4, step: 0.01 },
  { key: "fillAlpha", label: "Fill alpha", min: 0, max: 0.15, step: 0.005 },
  { key: "regionFeatherPx", label: "Region feather", min: 0, max: 40, step: 1, unit: "px" },
  { key: "markGlowBoost", label: "Mark glow boost", min: 0, max: 0.5, step: 0.02 },
  { key: "easing", label: "Follow easing", min: 0.04, max: 0.3, step: 0.01 },
  { key: "glowFadeMs", label: "Enter/leave fade", min: 100, max: 800, step: 10, unit: "ms" },
  { key: "markArmPx", label: "Cross arm length", min: 8, max: 24, step: 1, unit: "px" },
  { key: "markThicknessPx", label: "Cross arm thickness", min: 1, max: 2, step: 1, unit: "px" },
  { key: "markAlpha", label: "Cross alpha", min: 0.1, max: 0.5, step: 0.05 },
];

const NO_MARKS: never[] = [];
const getEmptyMarks = () => NO_MARKS;

interface BoxState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function LabLinesClient() {
  const [params, setParams] = useState<GridEffectParams>(GRID_EFFECT_DEFAULTS);
  const [compare, setCompare] = useState(false);
  const [gapX, setGapX] = useState(60);
  const [gapY, setGapY] = useState(70);
  const [box, setBox] = useState<BoxState>({ x: 560, y: 400, width: 760, height: 200 });
  const [copied, setCopied] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const { refreshAnchor, setAppearance } = useGridMarks(boxRef, { gapX, gapY });

  // The dummy box's crosses (and its glow region) are simply always on, so both can be judged
  // against the lines by moving the pointer in and out of the box.
  useEffect(() => {
    setAppearance({ opacity: 1, scale: 1 });
  }, [setAppearance]);

  // Anything that moves the box, resizes it or changes the requested gap has to re-snap.
  useEffect(() => {
    refreshAnchor();
  }, [refreshAnchor, box, gapX, gapY]);

  // The marks store is exactly the "external store" shape this hook exists for — and unlike a
  // subscribe-then-setState effect it also picks up the snapshot useGridMarks published on mount.
  const marks = useSyncExternalStore(subscribeMarks, getMarks, getEmptyMarks);

  // Read in an effect, not during render: gridMetrics() needs the resolved --s off the DOM, and a
  // `typeof window` branch in the body is a hydration mismatch waiting to happen.
  const [metrics, setMetrics] = useState<ReturnType<typeof gridMetrics> | null>(null);
  useEffect(() => {
    const read = () => setMetrics(gridMetrics(undefined, readScale()));
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  const drag = useCallback(
    (mode: "move" | "resize") => (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      const start = box;
      const onMove = (move: PointerEvent) => {
        const dx = move.clientX - startX;
        const dy = move.clientY - startY;
        setBox(
          mode === "move"
            ? { ...start, x: start.x + dx, y: start.y + dy }
            : {
                ...start,
                width: Math.max(80, start.width + dx),
                height: Math.max(60, start.height + dy),
              },
        );
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [box],
  );

  const copyRow = useCallback(() => {
    const row = [
      `| \`glowRadiusPx\` | ${params.glowRadiusPx} |`,
      `| \`lineGlowAlpha\` | ${params.lineGlowAlpha} |`,
      `| \`fillAlpha\` | ${params.fillAlpha} |`,
      `| \`fillColor\` | ${params.fillColor} |`,
      `| \`regionFeatherPx\` | ${params.regionFeatherPx} |`,
      `| \`markGlowBoost\` | ${params.markGlowBoost} |`,
      `| \`easing\` | ${params.easing} |`,
      `| \`glowFadeMs\` | ${params.glowFadeMs} |`,
      `| Cross arm length | ${params.markArmPx} |`,
      `| Cross arm thickness | ${params.markThicknessPx} |`,
      `| Cross alpha | ${params.markAlpha} |`,
      `| Cross gapX / gapY | ${gapX} / ${gapY} |`,
    ].join("\n");
    void navigator.clipboard?.writeText(row);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [params, gapX, gapY]);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-background font-mono text-xs text-white/70">
      {/* The real grid: the CSS fallback that paints first, and the canvas that takes over. */}
      <div className="pointer-events-none absolute inset-0">
        <CssGridLines />
        <GridCanvas params={params} />
      </div>

      {/* Compare overlay — today's CSS grid in red, on a layer the canvas does NOT hide, so any
          rest-state misalignment between the two shows up as a red line next to a white one. */}
      {compare && (
        <div className="pointer-events-none absolute inset-0">
          <CssGridLines color={COMPARE_COLOR} />
        </div>
      )}

      {/* Stand-in for the sticky header, so the "no lines above 96px" band reads correctly. */}
      <div
        data-lab-ui
        className="pointer-events-none absolute inset-x-0 top-0 border-b border-white/10"
        style={{ height: HEADER_HEIGHT_PX }}
      >
        <span className="absolute bottom-1 left-2 text-white/25">header band — grid draws nothing here</span>
      </div>

      {/* Resizable stand-in for a section's content: drag it, resize it from the corner, and move
          the pointer inside the crosses' rectangle to see the glow follow it. */}
      <div
        ref={boxRef}
        data-lab-ui
        onPointerDown={drag("move")}
        className="absolute cursor-move border border-dashed border-white/25"
        style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
      >
        <span className="absolute top-1 left-2 text-white/40">
          drag me · resize from the corner · hover inside the crosses for the glow
        </span>
        <div
          onPointerDown={drag("resize")}
          className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize bg-white/25"
        />
      </div>

      <div data-lab-ui className="absolute top-[120px] right-6 max-h-[calc(100vh-140px)] w-[320px] overflow-y-auto rounded border border-white/15 bg-black/70 p-4 backdrop-blur-sm">
        <div className="mb-3 text-[11px] tracking-wide text-white/40 uppercase">grid glow lab</div>

        <div className="mb-4 flex gap-1">
          {(["white", "brand"] as const).map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setParams((p) => ({ ...p, fillColor: color }))}
              className={`flex-1 rounded border px-2 py-1 ${
                params.fillColor === color ? "border-brand bg-brand/20 text-white" : "border-white/15 text-white/60"
              }`}
            >
              {color}
            </button>
          ))}
        </div>

        {SLIDERS.map((slider) => (
          <label key={slider.key} className="mb-3 block">
            <span className="flex justify-between">
              <span>{slider.label}</span>
              <span className="text-white/90">
                {params[slider.key] as number}
                {slider.unit ?? ""}
              </span>
            </span>
            <input
              type="range"
              className="w-full accent-[var(--brand)]"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={params[slider.key] as number}
              onChange={(e) => setParams((p) => ({ ...p, [slider.key]: Number(e.target.value) }))}
            />
          </label>
        ))}

        <div className="my-3 border-t border-white/10 pt-3 text-[11px] tracking-wide text-white/40 uppercase">
          cross snapping
        </div>
        {(
          [
            ["gapX", gapX, setGapX],
            ["gapY", gapY, setGapY],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="mb-3 block">
            <span className="flex justify-between">
              <span>{label}</span>
              <span className="text-white/90">{value}px</span>
            </span>
            <input
              type="range"
              className="w-full accent-[var(--brand)]"
              min={0}
              max={200}
              step={2}
              value={value}
              onChange={(e) => set(Number(e.target.value))}
            />
          </label>
        ))}

        <div className="mb-3 leading-relaxed text-white/50">
          snapped to:{" "}
          {marks.length
            ? marks.map((mark) => `c${mark.col}/r${mark.row}`).join("  ")
            : "—"}
          {metrics ? (
            <>
              <br />k = {metrics.k.toFixed(4)} · pitch {metrics.colPitch.toFixed(1)} × {metrics.rowPitch.toFixed(1)}
            </>
          ) : null}
        </div>

        <label className="mb-3 flex items-center gap-2">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          <span>compare: today&apos;s CSS grid in red</span>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyRow}
            className="flex-1 rounded border border-white/15 px-2 py-1 text-white/80 hover:bg-white/10"
          >
            {copied ? "copied" : "copy values"}
          </button>
          <button
            type="button"
            onClick={() => setParams(GRID_EFFECT_DEFAULTS)}
            className="rounded border border-white/15 px-2 py-1 text-white/60 hover:bg-white/10"
          >
            reset
          </button>
        </div>
      </div>
    </div>
  );
}
