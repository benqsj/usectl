// GLSL for the background grid.
//
// The grid never moves and never changes colour (grid-trail.md, 2026-09-21 — first an earlier
// version bent the lines around the cursor, then a glow briefly brightened them near it; the user
// asked for neither: "არსებული ხაზები არ მოძრაობს, არც ფერს იცვლის" — the existing lines don't move
// and don't change colour either). This shader takes no pointer input at all any more — it draws
// the static grid + cross marks and nothing else. The pointer trail is a separate 2D canvas
// (GridTrail.tsx) painted on top of this one.
//
// All maths is in CSS px with y measured from the top of the layer, which is exactly the coordinate
// system BackgroundLines.tsx's CSS lays the same grid out in (see lib/grid.ts). This has to match
// that CSS pixel for pixel, so line coverage is computed as a true box filter over the pixel's own
// footprint rather than a smoothstep — that is what a browser does when it rasterises a 2px div at
// a fractional position, and anything softer reads as a blurrier grid.

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
uniform vec4  u_marks[32];          // xy = centre (CSS px), z = arm half-length, w = alpha
uniform float u_markHalfThickness;

out vec4 outColor;

const float NUM_COLUMNS = 22.0;

// Fraction of a pixel of half-width h, centred on c, that falls inside [lo, hi].
float cov(float c, float lo, float hi, float h) {
  return clamp((min(hi, c + h) - max(lo, c - h)) / (2.0 * h), 0.0, 1.0);
}

void main() {
  // gl_FragCoord is device px with y up; the grid is CSS px with y down.
  vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_dpr;

  // The pixel's own footprint in CSS px.
  float hx = max(fwidth(p.x), 1e-4) * 0.5;
  float hy = max(fwidth(p.y), 1e-4) * 0.5;

  // Bands, exactly as BackgroundLines.tsx stacks them:
  //   y < 96                    header — this layer draws nothing (Header.tsx has its own copy)
  //   96 <= y < firstRowY       columns only, middle (nav) set hidden, no row line
  //   y >= firstRowY            every column + every row
  bool inHeader = p.y < u_header;
  bool underHeader = !inHeader && p.y < u_firstRowY;

  float colAlpha = 0.0;
  float rowAlpha = 0.0;

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
      colAlpha = u_lineAlpha * c;
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
      rowAlpha = u_lineAlpha * c;
    }
  }

  // Columns and rows are two separate CSS layers, so where they cross they composite rather than
  // replace each other. Same here, or every intersection would come out a shade too dark.
  float alpha = 1.0 - (1.0 - colAlpha) * (1.0 - rowAlpha);

  // Cross marks: short brighter segments of the very column and row they sit on, so they can never
  // be off the grid.
  for (int i = 0; i < 32; i++) {
    if (i >= u_markCount) break;
    vec4 m = u_marks[i];
    if (m.w <= 0.0) continue;
    float t = u_markHalfThickness;
    float horizontal = cov(p.y, m.y - t, m.y + t, hy) * cov(p.x, m.x - m.z, m.x + m.z, hx);
    float vertical   = cov(p.x, m.x - t, m.x + t, hx) * cov(p.y, m.y - m.z, m.y + m.z, hy);
    alpha = max(alpha, max(horizontal, vertical) * m.w);
  }

  // Premultiplied white over a transparent canvas.
  outColor = vec4(vec3(alpha), alpha);
}
`;
