// Server-only: inline both supplied drawings so their layers can share the scroll animation.
import fs from "node:fs";
import path from "node:path";

function readSvg(file: string, prefix: string) {
  const raw = fs.readFileSync(path.join(process.cwd(), "public", "sources", file), "utf-8");
  return raw
    .replace(/id="([^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`)
    .replace(/^<svg\b[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
}

export function readHeroMachineSvg(idPrefix: string): string {
  const closed = readSvg("hero-machine.svg", `${idPrefix}-closed`);
  const exploded = readSvg("titanium-server-exploded.svg", `${idPrefix}-open`);
  const defsStart = exploded.indexOf("<defs>");
  // This Figma export consists of paths and single-level filter groups. Keep those groups
  // intact, then wrap each physical layer without changing its paths, gradients or filters.
  const children = exploded.slice(0, defsStart).match(/<g\b[\s\S]*?<\/g>|<path\b[^>]*\/>/g) ?? [];
  if (defsStart < 0 || children.length !== 250) {
    throw new Error("Unexpected titanium-server-exploded.svg structure; recheck the layer boundaries.");
  }
  const layers = [
    ["base", 3, 44, 0],
    ["tray1", 44, 149, 80],
    ["tray2", 149, 224, 160],
    ["lid", 224, 250, 240],
  ] as const;
  const open = children.slice(0, 3).join("") + layers.map(([name, start, end, offset]) =>
    `<g data-layer="${name}" transform="translate(0 ${offset})">${children.slice(start, end).join("")}</g>`,
  ).join("") + exploded.slice(defsStart);

  // Both exports have identical layer dimensions; their canvases differ by (116, 82.15).
  // Align them before blending so the animation lands on the exact exploded artwork.
  return `<svg viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:100%;height:auto;display:block;overflow:visible">
    <g data-assembly="">
      <g data-pose="closed">${closed}</g>
      <g data-pose="open" opacity="0" transform="translate(116 82.15)">${open}</g>
    </g>
  </svg>`;
}
