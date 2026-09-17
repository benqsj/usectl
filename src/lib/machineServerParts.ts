// SERVER-ONLY (uses node:fs) — import from Server Components only (InfrastructureSection.tsx).
//
// Splits the 2-part titanium server (public/infrastructur/machine/) into its bottom and top part,
// each with a "dark" and a "lit" (green) variant, for InfrastructureSection's intro:
//   step 1: bottom part lit -> scroll opens the server -> step 2: top part lit.
//
// titanium-server-1.svg is the closed state, titanium-server-2.svg the open one. The two files are
// identical except that every bottom-part element sits lower in -2, so the split is derived, not
// hardcoded: elements that are identical in both files = top part, elements that differ = bottom
// part (+ its floor shadow). The open offset is the difference between the two viewBox heights.
// We render -1's elements in -2's (taller) viewBox and translate the bottom part by that offset.
//
// Colors: the bottom part is the only one designed "lit". Its green side-wall gradient (paint3) is
// copied onto the top part's side wall (paint9) for the top part's lit variant. For the bottom
// part's dark variant, the top part's dark wall (paint9) and dark band (paint11) stops go onto
// paint3 / paint6, and its green glows, wash and floor glow are hidden or greyed out.
// ensureGradients() throws at build time if a Figma re-export moves these paint indices.

import fs from "node:fs";
import path from "node:path";

export interface MachineServerParts {
  // viewBox of the open state (both parts are rendered in it)
  width: number;
  height: number;
  // how far (in viewBox units) the bottom part moves down when the server opens
  openOffset: number;
  bottom: { dark: string; lit: string };
  top: { dark: string; lit: string };
}

const DIR = path.join(process.cwd(), "public", "infrastructur", "machine");
const GRADIENT_RE = /(<linearGradient[^>]*?id="(paint\d+)_[^"]*"[^>]*>)([\s\S]*?)(<\/linearGradient>)/g;
// The export is flat: top-level children are single-line <path/>s or one-level <g>…</g> groups.
const CHILD_RE = /<g\b[\s\S]*?<\/g>|<path\b[^>]*\/>/g;

function parse(file: string) {
  const svg = fs.readFileSync(path.join(DIR, file), "utf-8");
  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const defsStart = svg.indexOf("<defs>");
  const defsEnd = svg.indexOf("</defs>");
  if (!viewBox || defsStart < 0 || defsEnd < 0) throw new Error(`machineServerParts: unexpected structure in ${file}`);
  const bodyStart = svg.indexOf(">") + 1;
  return {
    width: Number(viewBox[1]),
    height: Number(viewBox[2]),
    children: svg.slice(bodyStart, defsStart).match(CHILD_RE) ?? [],
    defs: svg.slice(defsStart, defsEnd + "</defs>".length),
  };
}

// Figma suffixes every id with a per-file node id (e.g. `_182_19450`) — strip it to compare.
const normalize = (s: string) => s.replace(/_\d+_\d+/g, "");

function gradientStops(defs: string) {
  const stops = new Map<string, string>();
  for (const m of defs.matchAll(GRADIENT_RE)) stops.set(m[2], m[3]);
  return stops;
}

function ensureGradients(stops: Map<string, string>, names: string[]) {
  for (const n of names) {
    if (!stops.has(n)) throw new Error(`machineServerParts: titanium-server-1.svg has no ${n} gradient — re-check indices`);
  }
}

function swapStops(defs: string, replacements: Record<string, string>) {
  return defs.replace(GRADIENT_RE, (full, open, name, _stops, close) =>
    replacements[name] === undefined ? full : `${open}${replacements[name]}${close}`,
  );
}

// Unique ids per inlined copy (4 variants x possibly several sections on the page).
function prefixIds(svg: string, prefix: string) {
  const ids = new Set(Array.from(svg.matchAll(/id="([^"]+)"/g), (m) => m[1]));
  let out = svg;
  for (const id of ids) {
    out = out.split(`id="${id}"`).join(`id="${prefix}${id}"`).split(`url(#${id})`).join(`url(#${prefix}${id})`);
  }
  return out;
}

export function readMachineServerParts(idPrefix: string): MachineServerParts {
  const closed = parse("titanium-server-1.svg");
  const open = parse("titanium-server-2.svg");
  if (closed.children.length !== open.children.length) {
    throw new Error("machineServerParts: titanium-server-1/-2 no longer have matching elements");
  }

  const bottomChildren: string[] = [];
  const topChildren: string[] = [];
  closed.children.forEach((child, i) => {
    (normalize(child) === normalize(open.children[i]) ? topChildren : bottomChildren).push(child);
  });

  const stops = gradientStops(closed.defs);
  ensureGradients(stops, ["paint3", "paint6", "paint9", "paint11"]);

  const bottomLit = bottomChildren.join("");
  const bottomDark = bottomChildren
    .join("")
    .replace(/fill="#00FF87" fill-opacity="0\.07"/g, 'fill="#00FF87" fill-opacity="0"')
    .replace(/<g ([^>]*)opacity="0\.425"/g, '<g $1opacity="0"')
    .replace(/stroke="#00FF87" stroke-opacity="0\.5"/g, 'stroke="#ffffff" stroke-opacity="0.06"')
    .replace(/fill="#0F1A14"/g, 'fill="#141518"')
    .replace(/stroke="#7DFFC0"/g, 'stroke="#ffffff" stroke-opacity="0.1"')
    .replace(/(fill|stroke)="#11A32A" (fill|stroke)-opacity="[\d.]+"/g, '$1="#11A32A" $2-opacity="0"')
    .replace(/fill="url\(#paint5_/g, 'fill-opacity="0" fill="url(#paint5_');
  const bottomDarkDefs = swapStops(closed.defs, { paint3: stops.get("paint9")!, paint6: stops.get("paint11")! })
    .replace(/#3A5A40/g, "#2A2B2E")
    .replace(/stop-color="#00FF87" stop-opacity="0\.35"/g, 'stop-color="#00FF87" stop-opacity="0"');

  const topLitDefs = swapStops(closed.defs, { paint9: stops.get("paint3")! });

  const wrap = (body: string, defs: string, prefix: string) =>
    prefixIds(
      `<svg viewBox="0 0 ${open.width} ${open.height}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:100%;height:auto;display:block;overflow:visible">${body}${defs}</svg>`,
      `${idPrefix}-${prefix}-`,
    );

  return {
    width: open.width,
    height: open.height,
    openOffset: open.height - closed.height,
    bottom: { dark: wrap(bottomDark, bottomDarkDefs, "bd"), lit: wrap(bottomLit, closed.defs, "bl") },
    top: { dark: wrap(topChildren.join(""), closed.defs, "td"), lit: wrap(topChildren.join(""), topLitDefs, "tl") },
  };
}
