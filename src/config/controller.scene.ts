// config/controllers.ts
import type { GLTFLoader } from "three/examples/jsm/Addons.js";
import { Pane } from "tweakpane";
import * as THREE from "three/webgpu";
import { fitModelToView } from "../utils";
import { createBackgroundPlane } from "./background";

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
    C1BG: "#1A3A1F",
    // C2BG: "#F0ECE4",
    C2BG: "#ffb41f",
  };

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

  createBackgroundPlane(SceneA, CameraA, Tweeks.C1BG);
  // createBackgroundPlane(SceneB, CameraB, Tweeks.C2BG);

  let C1: THREE.Group<THREE.Object3DEventMap> | null,
    C2: THREE.Group<THREE.Object3DEventMap> | null;

  const Con = pane.addFolder({
    title: "Controllers",
  });

  Con.addBinding(Tweeks, "C1BG", { color: true, label: "Color 1" });
  Con.addBinding(Tweeks, "C2BG", { color: true, label: "Color 2" });

  Con.addBinding(Tweeks, "rx", {
    min: -Math.PI,
    max: Math.PI,
    step: 0.1,
    label: "Rx",
  }).on("change", ({ value }) => {
    if (C1) {
      C1.rotation.x = value;
    }
    if (C2) {
      C2.rotation.x = value;
    }
  });
  Con.addBinding(Tweeks, "ry", {
    min: -Math.PI,
    max: Math.PI,
    step: 0.1,
    label: "Ry",
  }).on("change", ({ value }) => {
    if (C1) {
      C1.rotation.y = value;
    }
    if (C2) {
      C2.rotation.y = value;
    }
  });
  Con.addBinding(Tweeks, "rz", {
    min: -Math.PI,
    max: Math.PI,
    step: 0.1,
    label: "Rz",
  }).on("change", ({ value }) => {
    if (C1) {
      C1.rotation.z = value;
    }
    if (C2) {
      C2.rotation.z = value;
    }
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
  const renderSceneBToTarget = () => {
    renderer.setRenderTarget(targetB);
    renderer.render(SceneB, CameraB);
    renderer.setRenderTarget(null);
  };

  return {
    SceneA,
    SceneB,
    CameraA,
    CameraB,
    targetB,
    renderSceneBToTarget,
  };
};
