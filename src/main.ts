import "./style.css";
import * as THREE from "three/webgpu";
import { Fn, pass, texture, uv, vec2, uniform, vec4, vec3 } from "three/tsl";

import { SetupMouseTrail } from "./config/mouse";
import { SetupFluidSim } from "./config/fluidsim";
import { SetupControllers } from "./config/controller.scene";

import {
  DRACOLoader,
  GLTFLoader,
  OrbitControls,
} from "three/examples/jsm/Addons.js";

import { Pane } from "tweakpane";
import { initSound } from "./config/audio.engine";
import type { AppUniforms } from "./types";
import { DotProductNode, DotProductNodeCA } from "./config/output.node";

// --------------------------------------------------
// BASIC SETUP
// --------------------------------------------------

const main = document.body.querySelector("main");
const Canvas3D = main?.querySelector("canvas.threejs") as HTMLCanvasElement;

if (!main || !Canvas3D) throw new Error("Canvas missing");

initSound();

const renderer = new THREE.WebGPURenderer({
  antialias: true,
  canvas: Canvas3D,
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // instead of default PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
await renderer.init();

// --------------------------------------------------
// UNIFORMS
// --------------------------------------------------

const Uniforms: AppUniforms = {
  // Noise / animation
  uFrequency: uniform(25),
  uScale: uniform(25),
  uProgress: uniform(0),
  uSpeed: uniform(1),
  uFallOff: uniform(0.01),

  // Resolution
  uResolution: uniform(new THREE.Vector2(innerWidth, innerHeight)),

  // Line shader controls
  uLineThicknes: uniform(0.1),
  uLineThreshold: uniform(0.5),
  uLineFrequency: uniform(5),

  // 🎨 Background colors (normalized)
  C1BG: uniform(new THREE.Color(0.8078, 0.8, 0.7804)),
  C2BG: uniform(new THREE.Color(1.0, 0.7765, 0.3294)),

  // 🎨 Line colors (normalized)
  C1Line: uniform(new THREE.Color(200 / 255, 179 / 255, 126 / 255)),
  C2Line: uniform(new THREE.Color(0.902, 0.6627, 0.2392)),

  // Luminance weights (grayscale mixing)
  LumWeights: uniform(new THREE.Vector3(0.299, 0.587, 0.114)),

  uRippleStrength: uniform(0.05),
  uMouseLERP: .25,
};

const pane = new Pane();

const toTweakColor = (color: THREE.Color) => {
  const target = new THREE.Color();
  color.getRGB(target);
  return {
    r: target.r * 255,
    g: target.g * 255,
    b: target.b * 255,
  };
};

const TweakColors = {
  C1BG: toTweakColor(Uniforms.C1BG.value),
  C2BG: toTweakColor(Uniforms.C2BG.value),
  C1Line: toTweakColor(Uniforms.C1Line.value),
  C2Line: toTweakColor(Uniforms.C2Line.value),
};

console.log(TweakColors);

const ColorFolder = pane.addFolder({ title: "Colors", expanded: false });

ColorFolder.addBinding(TweakColors, "C1BG", {
  label: "Scene 1 BG",
  color: { type: "float" },
}).on("change", ({ value }) => {
  Uniforms.C1BG.value.r = value.r / 1;
  Uniforms.C1BG.value.g = value.g / 1;
  Uniforms.C1BG.value.b = value.b / 1;
});

ColorFolder.addBinding(TweakColors, "C1Line", {
  label: "Scene 1 Line",
  color: { type: "float" },
}).on("change", ({ value }) => {
  Uniforms.C1Line.value.r = value.r / 1;
  Uniforms.C1Line.value.g = value.g / 1;
  Uniforms.C1Line.value.b = value.b / 1;
});

ColorFolder.addBinding(TweakColors, "C2BG", {
  label: "Scene 2 BG",
  color: { type: "float" },
}).on("change", ({ value }) => {
  Uniforms.C2BG.value.r = value.r / 1;
  Uniforms.C2BG.value.g = value.g / 1;
  Uniforms.C2BG.value.b = value.b / 1;
});

ColorFolder.addBinding(TweakColors, "C2Line", {
  label: "Scene 2 Line",
  color: { type: "float" },
}).on("change", ({ value }) => {
  Uniforms.C2Line.value.r = value.r / 1;
  Uniforms.C2Line.value.g = value.g / 1;
  Uniforms.C2Line.value.b = value.b / 1;
});

const MouseFolder = pane.addFolder({ title: "Mouse Setting", expanded: false });

MouseFolder.addBinding(Uniforms.uRippleStrength, "value", {
  label: "Distortion",
  min: 0,
  max: 0.5,
});
MouseFolder.addBinding(Uniforms, "uMouseLERP", {
  label: "Mouse LERP",
  min: 0,
  max: 1,
});

// --------------------------------------------------
// RESOLUTION HELPERS
// --------------------------------------------------

function getFluidSimResolution(renderer: THREE.WebGPURenderer) {
  const MIN_SCREEN = 512;
  const MAX_SCREEN = 2000;
  const MIN_RT = 768;
  const MAX_RT = 1400;

  const screenW = window.innerWidth;
  const aspect = window.innerHeight / window.innerWidth;

  const t = Math.min(
    Math.max((screenW - MIN_SCREEN) / (MAX_SCREEN - MIN_SCREEN), 0),
    1,
  );

  let width = Math.round(MIN_RT + (MAX_RT - MIN_RT) * t);
  let height = Math.round(width * aspect);

  // ⭐⭐⭐ CRITICAL FIX ⭐⭐⭐
  if (!renderer) {
    return { width, height };
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());

  width = Math.max(width, size.x);
  height = Math.max(height, size.y);

  return { width, height };
}

function getMouseTrailResolution() {
  const w = Math.min(window.innerWidth * 0.8, 1024);
  const h = w * (window.innerHeight / window.innerWidth);
  return { width: Math.round(w), height: Math.round(h) };
}

// --------------------------------------------------
// MOUSE TRAIL + TEXTURE
// --------------------------------------------------

const MouseTrail = SetupMouseTrail({...getMouseTrailResolution(),Uniforms});

const trailTexture = new THREE.CanvasTexture(MouseTrail.canvas);
trailTexture.minFilter = THREE.LinearFilter;
trailTexture.magFilter = THREE.LinearFilter;
trailTexture.generateMipmaps = false;
trailTexture.flipY = false;

// --------------------------------------------------
// LOADERS
// --------------------------------------------------

const Draco = new DRACOLoader();
Draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
Draco.setDecoderConfig({ type: "wasm" });

const GLB = new GLTFLoader();
GLB.setDRACOLoader(Draco);

// --------------------------------------------------
// CONTROLLERS (SCENES)
// --------------------------------------------------

const {
  SceneA,
  CameraA,
  CameraB,
  SceneB,
  targetB,
  renderSceneBToTarget,
  resize: ResizeControllers,
} = SetupControllers({
  width: innerWidth,
  height: innerHeight,
  GLB,
  renderer,
  pane,
  Uniforms,
});

ResizeControllers(innerWidth, innerHeight);

// --------------------------------------------------
// FLUID SIM
// --------------------------------------------------

let FluidSize = getFluidSimResolution(renderer);
let FluidSim = SetupFluidSim(
  renderer,
  FluidSize.width,
  FluidSize.height,
  Uniforms,
);

new OrbitControls(CameraB, Canvas3D);

// --------------------------------------------------
// RENDER PIPELINE (VERY IMPORTANT)
// --------------------------------------------------

let renderPipeline: THREE.RenderPipeline;
let scenePass: THREE.PassNode;
let maskNode: THREE.TextureNode<"vec4">;

function buildPipeline() {
  renderPipeline = new THREE.RenderPipeline(renderer);

  scenePass = pass(SceneA, CameraA);
  maskNode = FluidSim.maskNode;

  const output = scenePass.getTextureNode("output");
  const scene2 = texture(targetB.texture);

  // renderPipeline.outputNode = output;
  // renderPipeline.outputNode = Fn(() => {
  //   return vec4(vec2(maskNode.sample(vec2(uv().x, uv().y)).gb),0,1);
  // })();
  // renderPipeline.outputNode = DotProductNode(output,maskNode,Uniforms,scene2)
  renderPipeline.outputNode = DotProductNodeCA(
    output,
    maskNode,
    Uniforms,
    scene2,
  );
  // renderPipeline.outputNode = texture(targetB.texture);
}

buildPipeline();

// --------------------------------------------------
// ANIMATION LOOP
// --------------------------------------------------

function animate() {
  requestAnimationFrame(animate);

  MouseTrail.update();
  trailTexture.needsUpdate = true;

  FluidSim.update(trailTexture);
  renderSceneBToTarget();
  renderPipeline.render();
}

animate();

// --------------------------------------------------
// 🔥 REAL FIX FOR RESIZE (REBUILD EVERYTHING)
// --------------------------------------------------
function Resize() {
  window.location.reload();
  const w = innerWidth;
  const h = innerHeight;

  // renderer
  renderer.setSize(w, h);
  renderer.setPixelRatio(devicePixelRatio);

  // camera
  CameraA.aspect = w / h;
  CameraA.updateProjectionMatrix();

  // update uniform resolution
  Uniforms.uResolution.value.set(w, h);

  // resize fluid sim targets
  const fluidSize = getFluidSimResolution(renderer);
  FluidSim.resize(fluidSize.width, fluidSize.height);

  // resize mouse trail
  const mouseSize = getMouseTrailResolution();
  MouseTrail.resize(mouseSize.width, mouseSize.height);

  // resize controller scenes
  ResizeControllers(w, h);
}

window.addEventListener("resize", Resize);
