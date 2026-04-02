// config/controllers.ts
import type { GLTFLoader } from "three/examples/jsm/Addons.js";
import { Pane } from "tweakpane";
import * as THREE from "three/webgpu";
import { fitModelToView, setupStudioLights } from "../utils";
import { createBackgroundPlane } from "./background";
import type { AppUniforms } from "../types";

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
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.7);
  keyLight.position.set(-3, 4, 3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.radius = 4; // softness

  // Fill light — softer from right
  const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
  fillLight.position.set(3, 2, 2);
  fillLight.castShadow = true;
  fillLight.shadow.mapSize.width = 2048;
  fillLight.shadow.mapSize.height = 2048;
  fillLight.shadow.radius = 4; // softness

  // Rim light — from behind to give edge definition
  const rimLight = new THREE.DirectionalLight(0xffffff, 2.7);
  rimLight.position.set(0, -2, -4);
  fillLight;
  rimLight.castShadow = true;
  fillLight;
  rimLight.shadow.mapSize.width = 2048;
  fillLight;
  rimLight.shadow.mapSize.height = 2048;
  fillLight;
  rimLight.shadow.radius = 4; // softness

  scene.add(ambient, keyLight, fillLight, rimLight);
};

export const SetupControllers = ({
  width,
  height,
  GLB,
  renderer,
  pane,
  Uniforms,
}: {
  width: number;
  height: number;
  GLB: GLTFLoader;
  renderer: THREE.WebGPURenderer;
  pane: Pane;
  Uniforms: AppUniforms;
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
  };

  // --- Mouse rotation state ---
  let targetMouse = { x: 0, y: 0 };
  let smoothMouse = { x: 0, y: 0 };

  // strength of effect (very important for premium feel)
  const mouseStrength = 0.4;

  const dpr = renderer.getPixelRatio();
  console.log(dpr)

  const opts = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    // depthBuffer: false,
    // stencilBuffer: false,
  };
  const targetB = new THREE.RenderTarget(width * dpr, height * dpr, opts);

  // targetB.texture.minFilter = THREE.LinearFilter;
  // targetB.texture.magFilter = THREE.LinearFilter;
  // targetB.texture.generateMipmaps = false;

  setupStudioLights(SceneA);
  setupStudioLights(SceneB);

  const { resize: Resize1 } = createBackgroundPlane(
    SceneA,
    CameraA,
    Uniforms.C1BG,
    Uniforms.C1Line,
    Uniforms,
  );
  const { resize: Resize2 } = createBackgroundPlane(
    SceneB,
    CameraB,
    Uniforms.C2BG,
    Uniforms.C2Line,
    Uniforms,
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

  let timeOutId: number | undefined;
  window.addEventListener("mousemove", (e) => {
    clearTimeout(timeOutId)
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    timeOutId = setTimeout(() => {
      targetMouse.x = 0
      targetMouse.y = 0
    }, 750);
  });

  window.addEventListener("mouseleave", () => {
    console.log(targetMouse)
  })

  const renderSceneBToTarget = () => {
    updateMouseRotation();
    renderer.setRenderTarget(targetB);
    renderer.render(SceneB, CameraB);
    renderer.setRenderTarget(null);
  };

  const resize = (w: number, h: number) => {
    const correctW = w * dpr;
    const correctH = h * dpr;
    const aspect = correctW /correctH;

    // --- Update Cameras ---
    [CameraA, CameraB].forEach((Camera, i) => {
      Camera.aspect = aspect;
      Camera.updateProjectionMatrix();

      [Resize1, Resize2][i](Camera.position.z);
      if (C1 && C2) {
        fitModelToView([C1, C2][i], Camera, w,h);
      }
    });

    // --- Update Render Targets ---
    targetB.setSize(correctW,correctH ); // 👈
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
