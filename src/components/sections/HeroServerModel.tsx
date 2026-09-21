"use client";

import { useEffect, useRef, type RefObject } from "react";
// Type-only: the runtime `three` import below is dynamic, so the value namespace it produces
// isn't available in type position. These are erased at build time and add nothing to the bundle.
import type {
  AnimationAction,
  AnimationMixer,
  Light,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from "three";
import { HERO_STACK_GAP_CLOSED_PX } from "@/lib/heroLayers";
import { readScale } from "@/lib/grid";
import {
  HERO_CORE_HEIGHT_RATIO,
  HERO_INTRO,
  HERO_INTRO_PIECES,
  HERO_INTRO_RING,
  HERO_MODEL_BASE_WIDTH_PX,
  HERO_MODEL_ELEVATION_MAX_DEG,
  HERO_MODEL_ELEVATION_MIN_DEG,
  HERO_MODEL_ELEV_DEG_PER_PX,
  HERO_MODEL_MAX_THROW,
  HERO_MODEL_PX_PER_UNIT,
  HERO_MODEL_RESUME_TAU_S,
  HERO_MODEL_REST_ELEVATION_DEG,
  HERO_MODEL_ROTATION_SECONDS,
  HERO_MODEL_START_YAW_DEG,
  HERO_MODEL_URL,
  HERO_STAGE_HEIGHT_RATIO,
  HERO_STAGE_WIDTH_RATIO,
} from "@/lib/heroModel";

export interface HeroServerModelHandle {
  /** 0 = closed assembly, 1 = fully exploded. Driven by the hero's scroll timeline. */
  setProgress: (progress: number) => void;
}

interface HeroServerModelProps {
  /** Filled in once the GLB is parsed; null before that and after unmount. */
  apiRef: RefObject<HeroServerModelHandle | null>;
  /** The hero's cube wrapper — the canvas is sized and positioned relative to its box. */
  wrapperRef: RefObject<HTMLDivElement | null>;
  /** Called once the model is on screen, so the scroll timeline can re-sync to it. */
  onReady?: () => void;
  /**
   * Play the first-load intro (the pieces fall in and stack up — see HERO_INTRO). Only the hero
   * asks for it; BuildSection reuses this component for a server that is already open on entry.
   */
  intro?: boolean;
  /** The CSS glow under the server. With `intro`, it is kept hidden and grows as pieces land. */
  glowRef?: RefObject<HTMLDivElement | null>;
  /**
   * With `intro`: called once, when the model is ready, with whether the intro is actually playing
   * (it is skipped for reduced motion, a scroll-restoring reload, or a visitor already scrolled
   * away). The hero times its text reveal off this.
   */
  onIntro?: (playing: boolean) => void;
  /**
   * Draw the canvas at this many times the usual resolution (capped at 2x device pixels). For a
   * wrapper that gets CSS-scaled up — the hero grows its server on scroll — so it stays sharp.
   */
  pixelRatioBoost?: number;
}

/** A material the intro fades, with the values it goes back to afterwards. */
interface FadingMaterial {
  material: MeshStandardMaterial;
  opacity: number;
  /** null for materials that don't glow. */
  emissiveIntensity: number | null;
}

interface IntroPiece {
  node: Object3D;
  /** Where the explode clip currently puts this piece; the intro's offsets are added on top. */
  restY: number;
  materials: FadingMaterial[];
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smoothstep = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);
/** A short light pulse that peaks right after a landing and dies away. */
const landingFlash = (tau: number) => (tau < 0 ? 0 : Math.exp(-tau / 0.28) * smoothstep(tau / 0.03));
/** A soft squash that starts and ends at 0 — the piece presses down, then settles. */
const landingSquash = (tau: number) =>
  tau < 0 || tau > 0.32 ? 0 : Math.sin((tau / 0.32) * Math.PI) * Math.exp(-tau / 0.16);

/**
 * The hero's server, rendered with three.js in place of the four stacked layer SVGs.
 *
 * Three things drive it, and they are deliberately independent:
 *   1. SCROLL  — `setProgress` scrubs the GLB's own `explode_sequence` clip (t=0 closed, t=end
 *                fully exploded). Scrubbing the authored clip keeps the spacing and easing the
 *                model was designed with instead of re-deriving them here.
 *   2. TIME    — a constant 360° turn, so the server keeps moving while the page is still.
 *   3. POINTER — dragging sideways takes the spin over (in either direction) and hands back a
 *                thrown velocity on release; dragging up/down tilts the camera. The spin eases
 *                back to its own direction and the camera eases back to REST_ELEVATION, so the
 *                hero can never be left in a pose nobody designed.
 *
 * three.js is imported dynamically: it is ~600 KB and nothing above the fold needs it to paint.
 */
export function HeroServerModel({
  apiRef,
  wrapperRef,
  onReady,
  intro = false,
  glowRef,
  onIntro,
  pixelRatioBoost = 1,
}: HeroServerModelProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLDivElement>(null);
  // Held in a ref, not read from the closure: an inline callback from the parent would otherwise
  // change identity on every render and re-run this effect — which re-imports and re-parses the
  // whole model.
  const onReadyRef = useRef(onReady);
  const onIntroRef = useRef(onIntro);
  // Kept current from an effect rather than during render (react-hooks/refs); the model only calls
  // them from the async GLB callback, long after this has run.
  useEffect(() => {
    onReadyRef.current = onReady;
    onIntroRef.current = onIntro;
  });

  useEffect(() => {
    const stage = stageRef.current;
    const grab = grabRef.current;
    const wrapper = wrapperRef.current;
    if (!stage || !grab || !wrapper) return;

    // React 19 StrictMode mounts, cleans up and mounts again in dev; the async import below can
    // resolve after that cleanup, so every path checks this before touching the DOM.
    let disposed = false;
    let teardown: (() => void) | null = null;

    void (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
      if (disposed) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio * Math.max(pixelRatioBoost, 1), 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.8;
      // setSize(..., false) below deliberately leaves the canvas elements own CSS size
      // untouched (only its drawing-buffer attributes), so without this it falls back to
      // rendering at its raw width/height attribute values -- i.e. twice too big on a 2x
      // display -- and it is not positioned relative to stage at all, so it overflows down
      // and to the right instead of filling it. resize() sizes and centres stage itself;
      // this just makes the canvas fill that box exactly.
      renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
      stage.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRT.texture;
      // The GLB's materials are untextured PBR; a little room environment gives the chrome and
      // titanium something to reflect, but at full strength it washed the dark shell out.
      scene.environmentIntensity = 0.3;

      // Orthographic, not perspective: the artwork this replaces is a flat isometric projection,
      // and an ortho camera is what keeps the silhouette matching it at every scale.
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      const baseElevation = HERO_MODEL_REST_ELEVATION_DEG;
      let elevation = baseElevation;
      const placeCamera = () => {
        const e = THREE.MathUtils.degToRad(elevation);
        camera.position.set(0, Math.sin(e), Math.cos(e)).multiplyScalar(4);
        camera.lookAt(0, 0, 0);
      };
      placeCamera();

      const addLight = (light: Light, x: number, y: number, z: number) => {
        light.position.set(x, y, z);
        scene.add(light);
      };
      addLight(new THREE.DirectionalLight(0xffffff, 1.15), 2, 3.5, 2); // key
      addLight(new THREE.DirectionalLight(0xbfd8ff, 0.3), -3, 1.5, -1.5); // cool fill
      addLight(new THREE.DirectionalLight(0x8effb0, 0.45), -1.5, -0.5, -3); // green rim
      scene.add(new THREE.AmbientLight(0xffffff, 0.08));
      const ACCENT_LIGHT_INTENSITY = 1.2;
      const accentLight = new THREE.PointLight(0x11ff4a, ACCENT_LIGHT_INTENSITY, 2, 2);
      addLight(accentLight, 0, -0.05, 0); // accent-ring glow

      // holder keeps the stack vertically centred as it opens; turntable carries the yaw.
      const holder = new THREE.Group();
      scene.add(holder);

      let turntable: Object3D | null = null;
      let mixer: AnimationMixer | null = null;
      let explode: AnimationAction | null = null;
      let explodeDuration = 1;
      let cap: Object3D | null = null;
      let capClosedY = 0;
      let closedCentreY = 0;
      let ready = false;

      // ---- first-load intro -------------------------------------------------------------------
      // Everything the intro changes (piece offsets, rotation, scale, opacity, glow strength) is
      // layered on top of the pose the explode clip gives each piece, and finishIntro() puts every
      // one of them back exactly — so once it is over the model is indistinguishable from one that
      // never played it, and the scroll timeline is never fighting anything.
      const glow = glowRef?.current ?? null;
      let gltfRoot: Object3D | null = null;
      let pieces: IntroPiece[] = [];
      let ring: IntroPiece | null = null;
      /** performance.now() when the intro started; -1 while it isn't playing. */
      let introStart = -1;
      const replacedMaterials = new Set<Material>();
      const introStartOf = (i: number) => HERO_INTRO.delay + i * HERO_INTRO.gapSeconds;
      const introLandOf = (i: number) => introStartOf(i) + HERO_INTRO.fallSeconds;
      // A little tail after the cap lands, so its light pulse can die away before we hand over.
      const introEnd = () => introLandOf(HERO_INTRO_PIECES.length - 1) + 0.8;
      const introParts = () => (ring ? [...pieces, ring] : pieces);

      const setGlow = (opacity: number, scale: number) => {
        if (!glow) return;
        glow.style.opacity = opacity.toFixed(3);
        // The individual `scale` property, so it composes with Tailwind's -translate-x-1/2
        // (which uses `translate`) instead of overwriting it.
        glow.style.scale = scale.toFixed(3);
      };

      const setIntroTransparency = (on: boolean) => {
        for (const part of introParts()) {
          for (const m of part.materials) {
            if (m.material.transparent !== on) {
              m.material.transparent = on;
              m.material.needsUpdate = true;
            }
            if (!on) m.material.opacity = m.opacity;
          }
        }
      };

      const finishIntro = () => {
        introStart = -1;
        for (const piece of pieces) {
          piece.node.position.y = piece.restY;
          piece.node.rotation.set(0, 0, 0);
          piece.node.scale.set(1, 1, 1);
          piece.node.visible = true;
        }
        if (ring) ring.node.visible = true;
        setIntroTransparency(false);
        for (const part of introParts()) {
          for (const m of part.materials) {
            if (m.emissiveIntensity !== null) m.material.emissiveIntensity = m.emissiveIntensity;
          }
        }
        accentLight.intensity = ACCENT_LIGHT_INTENSITY;
        if (glow) glow.style.transition = "opacity 0.6s ease-out, scale 0.6s ease-out";
        setGlow(1, 1);
      };

      /** Poses every piece for intro time `t` (seconds, already scaled by HERO_INTRO.speed). */
      const applyIntro = (t: number) => {
        const n = pieces.length;
        let flash = 0;
        let landed = 0;
        pieces.forEach((piece, i) => {
          const u = (t - introStartOf(i)) / HERO_INTRO.fallSeconds;
          let offset = 0;
          let alpha = 1;
          let twist = 0;
          let tiltX = 0;
          let tiltZ = 0;
          let scaleY = 1;
          let scaleXZ = 1;
          if (u < 1) {
            const uu = clamp01(u);
            offset = HERO_INTRO.height * (1 - uu * uu); // gravity: speeds up into the landing
            const settle = 1 - easeOutCubic(uu); // 1 at the top -> 0 on landing
            const dir = i % 2 ? 1 : -1;
            twist = THREE.MathUtils.degToRad(HERO_INTRO.twistDeg) * dir * settle;
            const wobble = THREE.MathUtils.degToRad(HERO_INTRO.wobbleDeg) * settle;
            tiltX = wobble * Math.sin(uu * Math.PI * 2.2 + i);
            tiltZ = wobble * dir * Math.cos(uu * Math.PI * 1.7 + i * 0.7);
            alpha = smoothstep(u / HERO_INTRO.fade);
          } else {
            landed++;
            const tau = (u - 1) * HERO_INTRO.fallSeconds;
            const k = landingSquash(tau);
            scaleY = 1 - HERO_INTRO.squash * k;
            scaleXZ = 1 + HERO_INTRO.squash * 0.45 * k;
            // The cap lands hardest — it is what "switches the server on".
            flash += landingFlash(tau) * (i === n - 1 ? 1.6 : 0.7);
          }
          piece.node.position.y = piece.restY + offset;
          piece.node.rotation.set(tiltX, twist, tiltZ);
          piece.node.scale.set(scaleXZ, scaleY, scaleXZ);
          piece.node.visible = alpha > 0.002;
          for (const m of piece.materials) m.material.opacity = m.opacity * alpha;
        });

        // The outline doesn't fall: it lights up under the base as the base lands.
        const ringAlpha = smoothstep((t - introLandOf(0)) / HERO_INTRO.ringFadeSeconds);
        if (ring) {
          ring.node.visible = ringAlpha > 0.002;
          for (const m of ring.materials) m.material.opacity = m.opacity * ringAlpha;
        }
        accentLight.intensity = ACCENT_LIGHT_INTENSITY * ringAlpha + 3.2 * flash;
        for (const part of introParts()) {
          for (const m of part.materials) {
            if (m.emissiveIntensity !== null) m.material.emissiveIntensity = m.emissiveIntensity * (1 + 0.8 * flash);
          }
        }
        const share = landed / Math.max(n, 1);
        setGlow(Math.min(1, (landed ? 0.25 + 0.75 * share : 0) + 0.35 * flash), 0.75 + 0.25 * share + 0.06 * flash);
      };

      /**
       * Gives each piece its own copies of its materials — the GLB shares materials between the
       * layers, and each piece has to fade on its own. Only done when the intro is enabled.
       */
      const collectIntroPart = (name: string): IntroPiece | null => {
        const node = gltfRoot?.getObjectByName(name);
        if (!node) return null;
        const materials: FadingMaterial[] = [];
        const copies = new Map<Material, Material>();
        node.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh) return;
          const swap = (m: Material) => {
            let copy = copies.get(m);
            if (!copy) {
              copy = m.clone();
              copies.set(m, copy);
              replacedMaterials.add(m);
              const std = copy as MeshStandardMaterial;
              const glows = !!std.emissive && std.emissive.getHex() !== 0;
              materials.push({ material: std, opacity: std.opacity, emissiveIntensity: glows ? std.emissiveIntensity : null });
            }
            return copy;
          };
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
        });
        return { node, restY: node.position.y, materials };
      };

      /** 0 -> 1, closed -> open, kept centred on screen. */
      const setProgress = (progress: number) => {
        if (!explode || !mixer) return;
        // The mixer only writes a node when the clip's value CHANGES, so a piece still carrying an
        // intro offset has to be put back on its clip pose first — otherwise an unchanged clip
        // value leaves the offset in place and it gets read back below as the new resting height.
        for (const piece of pieces) piece.node.position.y = piece.restY;
        explode.time = explodeDuration * THREE.MathUtils.clamp(progress, 0, 1);
        mixer.update(0);
        for (const piece of pieces) piece.restY = piece.node.position.y;
        // Once the scroll timeline starts pulling the stack apart, the intro has lost its moment:
        // finish it on the spot rather than have pieces still falling into an opening server.
        if (progress > 0 && introStart >= 0) finishIntro();
        // The stack only grows upward, so drop the holder by half that growth — the same net
        // result the CSS stack got by growing downward and being shifted up by half.
        const growth = cap ? cap.position.y - capClosedY : 0;
        holder.position.y = -closedCentreY - growth / 2;
      };

      const resize = () => {
        const wrapperWidth = wrapper.clientWidth;
        if (!wrapperWidth) return;
        const width = Math.round(wrapperWidth * HERO_STAGE_WIDTH_RATIO);
        const height = Math.round(wrapperWidth * HERO_STAGE_HEIGHT_RATIO);
        stage.style.width = `${width}px`;
        stage.style.height = `${height}px`;
        // Anchored to the wrapper's CLOSED centre, which is a constant — the wrapper's own height
        // grows with --stack-gap, so a plain `top: 50%` would drift downward as the stack opens.
        // The gap is a design px like any other and the wrapper around it is now fluid, so it has
        // to be scaled here too — otherwise the anchor drifts as the viewport narrows. resize()
        // re-runs on every window resize, so readScale() is always current.
        stage.style.top = `${(3 * HERO_STACK_GAP_CLOSED_PX * readScale() + wrapperWidth * HERO_CORE_HEIGHT_RATIO) / 2}px`;

        renderer.setSize(width, height, false);
        const pxPerUnit = HERO_MODEL_PX_PER_UNIT * (wrapperWidth / HERO_MODEL_BASE_WIDTH_PX);
        camera.left = -width / pxPerUnit / 2;
        camera.right = width / pxPerUnit / 2;
        camera.top = height / pxPerUnit / 2;
        camera.bottom = -height / pxPerUnit / 2;
        camera.updateProjectionMatrix();
      };

      // ---- pointer: sideways spins, up/down tilts -------------------------------------------
      const restingOmega = () => (reduced ? 0 : (Math.PI * 2) / HERO_MODEL_ROTATION_SECONDS);
      const dragRadPerPx = () => (Math.PI * 2) / Math.max(stage.clientWidth * 1.2, 1);

      let omega = restingOmega();
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let lastT = 0;
      let dragOmega = 0;

      const onPointerDown = (e: PointerEvent) => {
        if (!ready || !turntable) return;
        dragging = true;
        dragOmega = 0;
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = performance.now();
        grab.setPointerCapture(e.pointerId);
        grab.style.cursor = "grabbing";
        e.preventDefault();
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!dragging || !turntable) return;
        const now = performance.now();
        const dt = Math.max((now - lastT) / 1000, 1 / 240);

        const dTheta = (e.clientX - lastX) * dragRadPerPx();
        turntable.rotation.y += dTheta;
        // Smoothed, so one jittery sample doesn't decide how hard the throw lands.
        dragOmega = dragOmega * 0.6 + (dTheta / dt) * 0.4;

        // Drag DOWN pushes the viewpoint up and over the cap — the direction that reads as
        // pulling the server down on screen. No inertia here: it eases straight back on release.
        elevation = THREE.MathUtils.clamp(
          elevation + (e.clientY - lastY) * HERO_MODEL_ELEV_DEG_PER_PX,
          HERO_MODEL_ELEVATION_MIN_DEG,
          HERO_MODEL_ELEVATION_MAX_DEG,
        );
        placeCamera();

        lastX = e.clientX;
        lastY = e.clientY;
        lastT = now;
      };

      const endDrag = (e: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        grab.style.cursor = "";
        if (grab.hasPointerCapture(e.pointerId)) grab.releasePointerCapture(e.pointerId);
        // A drag that ended as a pause should simply resume, not coast off in some stale direction.
        const stale = performance.now() - lastT > 120;
        omega = stale ? 0 : THREE.MathUtils.clamp(dragOmega, -HERO_MODEL_MAX_THROW, HERO_MODEL_MAX_THROW);
      };

      grab.addEventListener("pointerdown", onPointerDown);
      grab.addEventListener("pointermove", onPointerMove);
      grab.addEventListener("pointerup", endDrag);
      grab.addEventListener("pointercancel", endDrag);
      grab.addEventListener("lostpointercapture", endDrag);

      const onResize = () => resize();
      window.addEventListener("resize", onResize);
      resize();

      // ---- the frame loop ---------------------------------------------------------------------
      const clock = new THREE.Clock();
      renderer.setAnimationLoop(() => {
        if (!ready) return;
        const dt = Math.min(clock.getDelta(), 0.05);
        if (turntable && !dragging) {
          // Relaxing the VELOCITY (not the angle) toward the resting one is what makes a
          // backwards throw slow, stop and turn around instead of snapping.
          omega += (restingOmega() - omega) * (1 - Math.exp(-dt / HERO_MODEL_RESUME_TAU_S));
          turntable.rotation.y += omega * dt;
          if (Math.abs(elevation - baseElevation) > 0.01) {
            elevation += (baseElevation - elevation) * (1 - Math.exp(-dt / HERO_MODEL_RESUME_TAU_S));
            placeCamera();
          }
        }
        if (introStart >= 0) {
          const t = ((performance.now() - introStart) / 1000) * HERO_INTRO.speed;
          if (t >= introEnd()) finishIntro();
          else applyIntro(t);
        }
        renderer.render(scene, camera);
      });

      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(HERO_MODEL_URL, (gltf) => {
        if (disposed) return;
        const root = gltf.scene;
        gltfRoot = root;
        holder.add(root);
        turntable = root.getObjectByName("turntable") ?? root;
        turntable.rotation.y = THREE.MathUtils.degToRad(HERO_MODEL_START_YAW_DEG);
        cap = root.getObjectByName("01_cap") ?? null;

        const clip = gltf.animations.find((a) => a.name === "explode_sequence") ?? gltf.animations[0];
        if (clip) {
          mixer = new THREE.AnimationMixer(root);
          explode = mixer.clipAction(clip);
          explode.play();
          explode.paused = true;
          explodeDuration = clip.duration;
          // Order matters: the GLB's authored node positions are the EXPLODED pose, so the closed
          // reference values can only be read after the clip has been wound back to t=0.
          explode.time = 0;
          mixer.update(0);
        }
        capClosedY = cap ? cap.position.y : 0;
        holder.position.y = 0;
        holder.updateMatrixWorld(true);
        const closedBox = new THREE.Box3().setFromObject(root);
        closedCentreY = (closedBox.max.y + closedBox.min.y) / 2;

        if (intro) {
          pieces = HERO_INTRO_PIECES.map(collectIntroPart).filter((p): p is IntroPiece => p !== null);
          ring = collectIntroPart(HERO_INTRO_RING);
        }
        setProgress(0);
        resize();

        // Only when the page genuinely opens on the hero. Skipped for reduced motion, for a reload
        // that ScrollChurnGuard is putting back at an old scroll position (the page is hidden
        // behind `scroll-restoring` while that happens), and for anyone who has already scrolled
        // well away before the model arrived.
        const restoring = document.documentElement.classList.contains("scroll-restoring");
        const atHero = window.scrollY < window.innerHeight * 0.5;
        if (intro && pieces.length && !reduced && !restoring && atHero) {
          if (glow) glow.style.transition = "none";
          setIntroTransparency(true);
          for (const part of introParts()) part.node.visible = false; // nothing flashes in whole first
          introStart = performance.now();
        } else if (glow) {
          if (intro) finishIntro();
          else setGlow(1, 1);
        }
        ready = true;
        apiRef.current = { setProgress };
        onReadyRef.current?.();
        if (intro) onIntroRef.current?.(introStart >= 0);
      });

      teardown = () => {
        renderer.setAnimationLoop(null);
        window.removeEventListener("resize", onResize);
        grab.removeEventListener("pointerdown", onPointerDown);
        grab.removeEventListener("pointermove", onPointerMove);
        grab.removeEventListener("pointerup", endDrag);
        grab.removeEventListener("pointercancel", endDrag);
        grab.removeEventListener("lostpointercapture", endDrag);
        apiRef.current = null;
        mixer?.stopAllAction();
        scene.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry?.dispose();
          const material = mesh.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material?.dispose();
        });
        replacedMaterials.forEach((m) => m.dispose());
        envRT.texture.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
      if (disposed) teardown();
    })();

    return () => {
      disposed = true;
      teardown?.();
    };
  }, [apiRef, wrapperRef, intro, glowRef, pixelRatioBoost]);

  return (
    <>
      {/* The canvas. Larger than the wrapper and overflowing it on purpose (see heroModel.ts);
          width/height/top are set from JS so they track the wrapper at every breakpoint. */}
      <div ref={stageRef} className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2" />

      {/* Transparent grab area for the drag. It sits on the WRAPPER's box — which grows as the
          stack opens — rather than on the much taller canvas, which would otherwise swallow
          clicks on the CTA buttons above it. touch-action:pan-y keeps vertical scrolling working
          on touch, so only horizontal drags are captured there. */}
      <div
        ref={grabRef}
        className="absolute z-[5] cursor-grab touch-pan-y select-none"
        style={{ inset: "-4% -12%" }}
      />
    </>
  );
}
