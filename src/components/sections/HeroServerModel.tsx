"use client";

import { useEffect, useRef, type RefObject } from "react";
// Type-only: the runtime `three` import below is dynamic, so the value namespace it produces
// isn't available in type position. These are erased at build time and add nothing to the bundle.
import type { AnimationAction, AnimationMixer, Light, Mesh, Object3D } from "three";
import { HERO_STACK_GAP_CLOSED_PX } from "@/lib/heroLayers";
import { readScale } from "@/lib/grid";
import {
  HERO_CORE_HEIGHT_RATIO,
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
}

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
export function HeroServerModel({ apiRef, wrapperRef, onReady }: HeroServerModelProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLDivElement>(null);
  // Held in a ref, not read from the closure: an inline callback from the parent would otherwise
  // change identity on every render and re-run this effect — which re-imports and re-parses the
  // whole model.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
      addLight(new THREE.PointLight(0x11ff4a, 1.2, 2, 2), 0, -0.05, 0); // accent-ring glow

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

      /** 0 -> 1, closed -> open, kept centred on screen. */
      const setProgress = (progress: number) => {
        if (!explode || !mixer) return;
        explode.time = explodeDuration * THREE.MathUtils.clamp(progress, 0, 1);
        mixer.update(0);
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
        renderer.render(scene, camera);
      });

      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(HERO_MODEL_URL, (gltf) => {
        if (disposed) return;
        const root = gltf.scene;
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

        setProgress(0);
        resize();
        ready = true;
        apiRef.current = { setProgress };
        onReadyRef.current?.();
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
  }, [apiRef, wrapperRef]);

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
