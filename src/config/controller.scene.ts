// config/controllers.ts
import type { GLTFLoader } from "three/examples/jsm/Addons.js";
import * as THREE from "three/webgpu";

const sceneA = new THREE.Scene();
const sceneB = new THREE.Scene();
const CameraA = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
const CameraB = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

CameraA.position.set(0, 0.5, 5);
CameraB.position.set(0, 0.5, 5);
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
}: {
  width: number;
  height: number;
  GLB: GLTFLoader;
  renderer: THREE.WebGPURenderer;
}) => {
  const aspect = width / height;

  [CameraA, CameraB].forEach((Camera) => {
    Camera.aspect = aspect;
    Camera.position.set(0, 0.5, 2);
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

  GLB.load("/models/controller-permian.glb", (glb) => {
    const model = glb.scene;

    // Scale up to reasonable size
    model.scale.setScalar(10);

    sceneA.add(model);
    console.log("permian loaded");
  });

  GLB.load("/models/controller-basic.glb", (glb) => {
    const model = glb.scene;

    model.scale.setScalar(10);

    sceneB.add(model);
    console.log("basic loaded");
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
