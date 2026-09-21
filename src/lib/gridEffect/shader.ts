// GLSL for the background grid.
//
// The grid itself no longer moves (grid-glow.md, 2026-09-21 — the earlier mouse-deformation
// version bent the lines around the cursor; the user asked for that to stop). What is left is a
// single fullscreen pass that (1) draws the static grid + cross marks, exactly matching the CSS
// fallback pixel for pixel, and (2) brightens the lines / marks and lays a soft radial fill under
// them wherever the pointer sits inside a section's own "4 crosses" region.
//
// All maths is in CSS px with y measured from the top of the layer, which is exactly the coordinate
// system BackgroundLines.tsx's CSS lays the same grid out in (see lib/grid.ts). The rest state (no
// region glowing) has to match that CSS pixel for pixel, so line coverage is computed as a true box
// filter over the pixel's own footprint rather than a smoothstep — that is what a browser does when
// it rasterises a 2px div at a fractional position, and anything softer reads as a blurrier grid.

export const GRID_VERTEX_SHADER = /* glsl */ `#version 300 es
// One oversized triangle covering the viewport — no vertex buffer needed.
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const GRID_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2  u_resolution;        // device px
uniform float u_dpr;
uniform vec2  u_mouse;             // CSS px, y from the top — the eased pointer position

// Grid geometry, all CSS px — mirrors gridMetrics() in lib/grid.ts.
uniform float u_inset;
uniform float u_colPitch;
uniform float u_rowPitch;
uniform float u_header;            // 96, fixed
uniform float u_firstRowY;         // header + rowPitch
uniform float u_containerRight;    // width - inset
uniform float u_halfThickness;     // half of LINE_THICKNESS_PX
uniform float u_lineAlpha;
uniform uint  u_hiddenMask;        // bit (n-1) set => column n is hidden in the under-header band

uniform int   u_markCount;
uniform vec4  u_marks[16];          // xy = centre (CSS px), z = arm half-length, w = alpha
uniform float u_markHalfThickness;

// Glow — one soft light that follows u_mouse, but only inside a region, and only as strong as that
// region's own u_regionGlow (== hover intensity × the region's own mark opacity, so a section's
// glow fades out together with its crosses). See grid-glow.md §3.
uniform int   u_regionCount;
uniform vec4  u_regions[4];         // left, top, right, bottom — CSS px
uniform float u_regionGlow[4];      // 0..1
uniform float u_glowRadius;         // CSS px — gaussian falloff radius
uniform float u_lineGlowAlpha;      // peak line alpha inside the glow
uniform float u_fillAlpha;          // peak fill alpha inside the glow
uniform vec3  u_fillColor;
uniform float u_regionFeather;      // CSS px; 0 = hard edge exactly on the region's own lines
uniform float u_markGlowBoost;      // extra mark alpha at the glow's centre

out vec4 outColor;

const float NUM_COLUMNS = 22.0;

// Fraction of a pixel of half-width h, centred on c, that falls inside [lo, hi].
float cov(float c, float lo, float hi, float h) {
  return clamp((min(hi, c + h) - max(lo, c - h)) / (2.0 * h), 0.0, 1.0);
}

// 1 inside [rect.x,rect.z] x [rect.y,rect.w], 0 outside. feather <= 0 is a true hard edge (the
// default — the glow is framed exactly by the crosses, never bleeding past them); feather > 0
// softens it over that many CSS px.
float rectMask(vec2 p, vec4 rect, float feather) {
  if (feather <= 0.0) {
    return (p.x >= rect.x && p.x <= rect.z && p.y >= rect.y && p.y <= rect.w) ? 1.0 : 0.0;
  }
  float insideX = smoothstep(rect.x - feather, rect.x + feather, p.x)
    * (1.0 - smoothstep(rect.z - feather, rect.z + feather, p.x));
  float insideY = smoothstep(rect.y - feather, rect.y + feather, p.y)
    * (1.0 - smoothstep(rect.w - feather, rect.w + feather, p.y));
  return insideX * insideY;
}

void main() {
  // gl_FragCoord is device px with y up; the grid is CSS px with y down.
  vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_dpr;

  // The pixel's own footprint in CSS px — at rest (nothing here bends any more) this is exactly
  // 1 device px, so this is the same plain box filter the grid has always used.
  float hx = max(fwidth(p.x), 1e-4) * 0.5;
  float hy = max(fwidth(p.y), 1e-4) * 0.5;

  // --- 1. the glow, computed once so it can brighten both the lines and the marks below ---------
  float g = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= u_regionCount) break;
    float strength = u_regionGlow[i];
    if (strength <= 0.0) continue;
    vec4 rect = u_regions[i];
    // Bounding-box early-out (padded by the falloff radius) so pixels nowhere near this region's
    // glow don't pay for the mask/gaussian below.
    if (p.x < rect.x - u_glowRadius || p.x > rect.z + u_glowRadius
      || p.y < rect.y - u_glowRadius || p.y > rect.w + u_glowRadius) continue;
    float mask = rectMask(p, rect, u_regionFeather);
    if (mask <= 0.0) continue;
    float falloff = exp(-pow(distance(p, u_mouse) / max(u_glowRadius, 1.0), 2.0));
    g = max(g, strength * mask * falloff);
  }

  // --- 2. the grid at p --------------------------------------------------------------------------
  // Bands, exactly as BackgroundLines.tsx stacks them:
  //   y < 96                    header — this layer draws nothing (Header.tsx has its own copy)
  //   96 <= y < firstRowY       columns only, middle (nav) set hidden, no row line
  //   y >= firstRowY            every column + every row
  bool inHeader = p.y < u_header;
  bool underHeader = !inHeader && p.y < u_firstRowY;

  float colAlpha = 0.0;
  float rowAlpha = 0.0;
  float lineAlpha = mix(u_lineAlpha, u_lineGlowAlpha, g);

  if (!inHeader) {
    float ci = floor((p.x - u_inset) / u_colPitch + 0.5);   // 0-based column index
    if (ci >= 0.0 && ci < NUM_COLUMNS) {
      float cx = u_inset + ci * u_colPitch;
      float c = cov(p.x, cx - u_halfThickness, cx + u_halfThickness, hx);
      if (underHeader) {
        if ((u_hiddenMask & (1u << uint(ci))) != 0u) c = 0.0;
      } else {
        // The main band's columns are a background on a box inset on both sides, so the
        // browser clips the outermost line in half. Reproduced rather than tidied up: without it
        // the first and last column read twice as strong as the CSS does.
        c *= cov(p.x, u_inset, u_containerRight, hx);
      }
      colAlpha = lineAlpha * c;
    }

    if (!underHeader) {
      // Rows are the first 2px of each repeating period, i.e. they cover [y, y+2] — NOT centred on
      // y. Both neighbouring candidates are tested so a pixel straddling the period boundary still
      // gets the right coverage.
      float base = floor((p.y - u_header) / u_rowPitch);
      float c = 0.0;
      for (int k = 0; k <= 1; k++) {
        float j = base + float(k);
        if (j < 1.0) continue;
        float ry = u_header + j * u_rowPitch;
        c = max(c, cov(p.y, ry, ry + u_halfThickness * 2.0, hy));
      }
      rowAlpha = lineAlpha * c;
    }
  }

  // Columns and rows are two separate CSS layers, so where they cross they composite rather than
  // replace each other. Same here, or every intersection would come out a shade too dark.
  float alpha = 1.0 - (1.0 - colAlpha) * (1.0 - rowAlpha);

  // --- 3. cross marks --------------------------------------------------------------------------
  // Short brighter segments of the very column and row they sit on, so they can never be off the
  // grid. A region's own marks get a little brighter right at the glow's centre (markGlowBoost).
  for (int i = 0; i < 16; i++) {
    if (i >= u_markCount) break;
    vec4 m = u_marks[i];
    if (m.w <= 0.0) continue;
    float t = u_markHalfThickness;
    float horizontal = cov(p.y, m.y - t, m.y + t, hy) * cov(p.x, m.x - m.z, m.x + m.z, hx);
    float vertical   = cov(p.x, m.x - t, m.x + t, hx) * cov(p.y, m.y - m.z, m.y + m.z, hy);
    float markAlpha = max(horizontal, vertical) * m.w * (1.0 + u_markGlowBoost * g);
    alpha = max(alpha, min(markAlpha, 1.0));
  }

  // --- 4. soft fill under the lines, then composite fill (bottom) and lines (top), premultiplied -
  float fillA = u_fillAlpha * g;
  float outA = alpha + fillA * (1.0 - alpha);
  vec3 outRGB = vec3(1.0) * alpha + u_fillColor * fillA * (1.0 - alpha);

  outColor = vec4(outRGB, outA);
}
`;
