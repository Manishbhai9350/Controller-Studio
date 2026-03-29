// config/controllers.ts
import type { GLTFLoader } from "three/examples/jsm/Addons.js";
import { Pane } from "tweakpane";
import * as THREE from "three/webgpu";
import { fitModelToView } from "../utils";
import { createBackgroundPlane } from "./background";

const sceneA = new THREE.Scene();
const sceneB = new THREE.Scene();
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

const C1BG = "#1A3A1F";
const C2BG = "#F0ECE4";

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

  const opts = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  };
  const targetA = new THREE.RenderTarget(width, height, opts);
  const targetB = new THREE.RenderTarget(width, height, opts);

  setupLights(sceneA);
  setupLights(sceneB);

  createBackgroundPlane(sceneA, CameraA, C1BG);
  createBackgroundPlane(sceneB, CameraB, C2BG);

  const Tweeks = {
    rx: 1.4,
    ry: 0,
    rz: 0,
    mx: 0,
    my: 0,
    mz: 0,
  };

  let C1: THREE.Group<THREE.Object3DEventMap> | null,
    C2: THREE.Group<THREE.Object3DEventMap> | null;

  const Con = pane.addFolder({
    title: "Controllers",
  });

  // Con.addBinding(Tweeks, "rx", {
  //   min: -2 * Math.PI,
  //   max: 2 * Math.PI,
  //   step: 0.1,
  //   label: "Rx",
  // }).on("change", ({ value }) => {
  //   if (C1) {
  //     C1.rotation.x = value;
  //   }
  //   if (C2) {
  //     C2.rotation.x = value;
  //   }
  // });
  // Con.addBinding(Tweeks, "ry", {
  //   min: -2 * Math.PI,
  //   max: 2 * Math.PI,
  //   step: 0.1,
  //   label: "Ry",
  // }).on("change", ({ value }) => {
  //   if (C1) {
  //     C1.rotation.y = value;
  //   }
  //   if (C2) {
  //     C2.rotation.y = value;
  //   }
  // });
  // Con.addBinding(Tweeks, "rz", {
  //   min: -2 * Math.PI,
  //   max: 2 * Math.PI,
  //   step: 0.1,
  //   label: "Rz",
  // }).on("change", ({ value }) => {
  //   if (C1) {
  //     C1.rotation.z = value;
  //   }
  //   if (C2) {
  //     C2.rotation.z = value;
  //   }
  // });

  GLB.load("/models/controller-permian.glb", (glb) => {
    C1 = glb.scene;

    sceneA.add(C1);

    // ✨ Fit to view
    fitModelToView(C1, CameraA, width, height);

    // ✨ Default rotation
    C1.rotation.set(1.4, 0, 0);
  });

  GLB.load("/models/controller-basic.glb", (glb) => {
    C2 = glb.scene;

    sceneB.add(C2);

    // ✨ Fit to view
    fitModelToView(C2, CameraB, width, height);

    // ✨ Default rotation
    C2.rotation.set(1.4, 0, 0);
  });
  const update = () => {
    renderer.setRenderTarget(targetA);
    renderer.render(sceneA, CameraA);

    renderer.setRenderTarget(targetB);
    renderer.render(sceneB, CameraB);

    renderer.setRenderTarget(null);
  };

  return {
    targetA,
    targetB,
    update,
  };
};
