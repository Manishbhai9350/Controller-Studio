// config/controllers.ts
import type { GLTFLoader } from "three/examples/jsm/Addons.js";
import { Pane } from "tweakpane";
import * as THREE from "three/webgpu";
import { fitModelToView } from "../utils";
import { createBackgroundPlane } from "./background";
import {
  Fn,
  mix,
  positionLocal,
  positionWorld,
  smoothstep,
  step,
  time,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { perlin2D } from "../noises/fbm";

const SceneA = new THREE.Scene();
const SceneB = new THREE.Scene();
const CameraA = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
const CameraB = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

CameraA.lookAt(0, 0, 0);
CameraB.lookAt(0, 0, 0);

const setupLights = (scene: THREE.Scene) => {
  // Soft ambient base
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);

  // Key light — main light from top left
  const keyLight = new THREE.DirectionalLight(0xffffff, 2);
  keyLight.position.set(-3, 4, 3);

  // Fill light — softer from right
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
  fillLight.position.set(3, 2, 2);

  // Rim light — from behind to give edge definition
  const rimLight = new THREE.DirectionalLight(0xffffff, 1.5);
  rimLight.position.set(0, -2, -4);

  scene.add(ambient, keyLight, fillLight, rimLight);
};

export const SetupControllers = ({
  width,
  height,
  GLB,
  renderer,
  pane,
  Uniforms
}: {
  width: number;
  height: number;
  GLB: GLTFLoader;
  renderer: THREE.WebGPURenderer;
  pane: Pane;
}) => {
  const aspect = width / height;

  [CameraA, CameraB].forEach((Camera) => {
    Camera.aspect = aspect;
    Camera.position.set(0, 0, 2);
    Camera.updateProjectionMatrix();
  });

  const Tweeks = {
    rx: 1.4,
    ry: Math.PI,
    rz: 0,
    mx: 0,
    my: 0,
    mz: 0,
    // C1BG: "#1A3A1F",
    C1BG: "#ceccc7",
    // C2BG: "#F0ECE4",
    C2BG: "#ffb41f",
  };

  // --- Mouse rotation state ---
  let mouse = { x: 0, y: 0 };
  let targetMouse = { x: 0, y: 0 };
  let smoothMouse = { x: 0, y: 0 };

  // strength of effect (very important for premium feel)
  const mouseStrength = 0.4;

  const opts = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    // depthBuffer: false,
    // stencilBuffer: false,
  };
  const targetA = new THREE.RenderTarget(width, height, opts);
  const targetB = new THREE.RenderTarget(width, height, opts);

  setupLights(SceneA);
  setupLights(SceneB);

  const { material: BG1Material, resize: Resize1 } = createBackgroundPlane(
    SceneA,
    CameraA,
    Uniforms.C1BG,
    Uniforms.C1Line
  );
  const { resize: Resize2 } = createBackgroundPlane(
    SceneB,
    CameraB,
    Uniforms.C2BG,
    Uniforms.C2BG
  );

  let C1: THREE.Group<THREE.Object3DEventMap> | null,
    C2: THREE.Group<THREE.Object3DEventMap> | null;

  const Con = pane.addFolder({
    title: "Controllers",
  });

  GLB.load("/models/controller-permian.glb", (glb) => {
    C1 = glb.scene;

    SceneA.add(C1);

    // ✨ Fit to view
    fitModelToView(C1, CameraA, width, height);

    // ✨ Default rotation
    C1.rotation.x = Tweeks.rx;
    C1.rotation.y = Tweeks.ry;
    C1.rotation.z = Tweeks.rz;
  });

  GLB.load("/models/controller-basic.glb", (glb) => {
    C2 = glb.scene;

    SceneB.add(C2);

    // ✨ Fit to view
    fitModelToView(C2, CameraB, width, height);

    // ✨ Default rotation
    C2.rotation.x = Tweeks.rx;
    C2.rotation.y = Tweeks.ry;
    C2.rotation.z = Tweeks.rz;
  });

  const updateMouseRotation = () => {
    // Smooth mouse (LERP feel)
    smoothMouse.x += (targetMouse.x - smoothMouse.x) * 0.05;
    smoothMouse.y += (targetMouse.y - smoothMouse.y) * 0.05;

    const rotX = Tweeks.rx + smoothMouse.y * mouseStrength;
    const rotY = Math.PI + Tweeks.ry + smoothMouse.x * mouseStrength;

    if (C1) {
      C1.rotation.x = rotX;
      C1.rotation.z = rotY;
    }

    if (C2) {
      C2.rotation.x = rotX;
      C2.rotation.z = rotY;
    }
  };

  window.addEventListener("mousemove", (e) => {
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  const renderSceneBToTarget = () => {
    updateMouseRotation();
    renderer.setRenderTarget(targetB);
    renderer.render(SceneB, CameraB);
    renderer.setRenderTarget(null);
  };

  const resize = (w: number, h: number) => {
    const aspect = w / h;

    // --- Update Cameras ---
    [CameraA, CameraB].forEach((Camera, i) => {
      Camera.aspect = aspect;
      Camera.updateProjectionMatrix();

      [Resize1, Resize2][i](Camera.position.z);
      fitModelToView([C1, C2][i], Camera, w, h);
    });

    // --- Update Render Targets ---
    targetA.setSize(w, h);
    targetB.setSize(w, h);
  };

  return {
    SceneA,
    SceneB,
    CameraA,
    CameraB,
    targetB,
    renderSceneBToTarget,
    resize,
  };
};
