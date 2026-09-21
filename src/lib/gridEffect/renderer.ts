// Raw WebGL2 for the background grid. No three.js: this layer is on every page and always on, and
// the whole thing is a fullscreen triangle plus one shader — a renderer that pulls in 600 KB to do
// that would cost far more than the effect is worth (see background-line-animations.md §3/§4).
//
// No React in here on purpose. GridCanvas.tsx owns the lifecycle and the listeners; this owns the
// GL objects and nothing else.

import { GRID_FRAGMENT_SHADER, GRID_VERTEX_SHADER } from "./shader";
import { MAX_MARKS } from "./config";
import type { GridMetrics } from "@/lib/grid";

export interface GridDrawState {
  metrics: GridMetrics;
  lineAlpha: number;
  halfThickness: number;
  /** bit (n-1) set => column n hidden in the band under the header */
  hiddenMask: number;
  /** flat [x, y, arm, alpha] × MAX_MARKS, CSS px */
  marks: Float32Array;
  markCount: number;
  markHalfThickness: number;
}

export interface GridRenderer {
  /** returns true if the backing store actually changed size */
  resize(cssWidth: number, cssHeight: number, dpr: number): boolean;
  draw(state: GridDrawState): void;
  dispose(): void;
}

const UNIFORM_NAMES = [
  "u_resolution",
  "u_dpr",
  "u_inset",
  "u_colPitch",
  "u_rowPitch",
  "u_header",
  "u_firstRowY",
  "u_containerRight",
  "u_halfThickness",
  "u_lineAlpha",
  "u_hiddenMask",
  "u_markCount",
  "u_marks[0]",
  "u_markHalfThickness",
] as const;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // Only ever a development problem (the shader is a constant string), but silence here would
    // mean a blank canvas with no clue why.
    console.error("[gridEffect] shader compile failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Returns null when WebGL2 is unavailable — the caller then leaves the CSS grid in place. */
export function createGridRenderer(canvas: HTMLCanvasElement): GridRenderer | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false, // the shader antialiases itself, exactly the way the CSS rasteriser does
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  const vert = compile(gl, gl.VERTEX_SHADER, GRID_VERTEX_SHADER);
  const frag = compile(gl, gl.FRAGMENT_SHADER, GRID_FRAGMENT_SHADER);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  // Shaders are only needed until the program is linked.
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("[gridEffect] program link failed:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  const u = {} as Record<(typeof UNIFORM_NAMES)[number], WebGLUniformLocation | null>;
  for (const name of UNIFORM_NAMES) u[name] = gl.getUniformLocation(program, name);

  // A fullscreen triangle generated from gl_VertexID needs no buffers, but WebGL2 still wants a VAO
  // bound for a draw call to be valid.
  const vao = gl.createVertexArray();

  gl.useProgram(program);
  gl.bindVertexArray(vao);
  gl.disable(gl.BLEND); // one opaque-in-place pass over a cleared transparent buffer
  gl.disable(gl.DEPTH_TEST);

  let bufferWidth = 0;
  let bufferHeight = 0;

  return {
    resize(cssWidth, cssHeight, dpr) {
      const w = Math.max(1, Math.round(cssWidth * dpr));
      const h = Math.max(1, Math.round(cssHeight * dpr));
      if (w === bufferWidth && h === bufferHeight) return false;
      bufferWidth = w;
      bufferHeight = h;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      return true;
    },

    draw(s) {
      if (gl.isContextLost()) return;
      const m = s.metrics;
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(u.u_resolution, bufferWidth, bufferHeight);
      gl.uniform1f(u.u_dpr, bufferWidth / Math.max(1, m.width));
      gl.uniform1f(u.u_inset, m.inset);
      gl.uniform1f(u.u_colPitch, m.colPitch);
      gl.uniform1f(u.u_rowPitch, m.rowPitch);
      gl.uniform1f(u.u_header, m.header);
      gl.uniform1f(u.u_firstRowY, m.firstRowY);
      gl.uniform1f(u.u_containerRight, m.containerRight);
      gl.uniform1f(u.u_halfThickness, s.halfThickness);
      gl.uniform1f(u.u_lineAlpha, s.lineAlpha);
      gl.uniform1ui(u.u_hiddenMask, s.hiddenMask >>> 0);
      gl.uniform1i(u.u_markCount, Math.min(s.markCount, MAX_MARKS));
      gl.uniform4fv(u["u_marks[0]"], s.marks);
      gl.uniform1f(u.u_markHalfThickness, s.markHalfThickness);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    dispose() {
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
