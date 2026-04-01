import "./style.css";
import * as THREE from "three/webgpu";
import {
  Fn, pass, texture, uv, vec2, uniform
} from "three/tsl";

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
renderer.setPixelRatio(devicePixelRatio);
await renderer.init();

new OrbitControls(new THREE.PerspectiveCamera(), Canvas3D);


// --------------------------------------------------
// UNIFORMS
// --------------------------------------------------

const Uniforms = {
  uFrequency: uniform(25),
  uScale: uniform(25),
  uProgress: uniform(0),
};


// --------------------------------------------------
// RESOLUTION HELPERS
// --------------------------------------------------

function getFluidSimResolution() {
  const w = Math.min(window.innerWidth * 1.2, 1400);
  const h = w * (window.innerHeight / window.innerWidth);
  return { width: Math.round(w), height: Math.round(h) };
}

function getMouseTrailResolution() {
  const w = Math.min(window.innerWidth * 0.8, 1024);
  const h = w * (window.innerHeight / window.innerWidth);
  return { width: Math.round(w), height: Math.round(h) };
}


// --------------------------------------------------
// MOUSE TRAIL + TEXTURE
// --------------------------------------------------

const MouseTrail = SetupMouseTrail(getMouseTrailResolution());

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
  targetB,
  renderSceneBToTarget,
  resize: ResizeControllers,
} = SetupControllers({
  width: innerWidth,
  height: innerHeight,
  GLB,
  renderer,
  pane: new Pane(),
  Uniforms,
});

ResizeControllers(innerWidth, innerHeight);


// --------------------------------------------------
// FLUID SIM
// --------------------------------------------------

let FluidSize = getFluidSimResolution();
let FluidSim = SetupFluidSim(
  renderer,
  FluidSize.width,
  FluidSize.height,
  Uniforms
);


// --------------------------------------------------
// RENDER PIPELINE (VERY IMPORTANT)
// --------------------------------------------------

let renderPipeline: THREE.RenderPipeline;
let scenePass: any;
let maskNode: THREE.TextureNode<"vec4">;

function buildPipeline() {
  renderPipeline = new THREE.RenderPipeline(renderer);

  scenePass = pass(SceneA, CameraA);
  maskNode = FluidSim.maskNode;

  renderPipeline.outputNode = Fn(() => {
    return maskNode.sample(vec2(uv().x, uv().y.oneMinus()));
  })();
}

buildPipeline();


// --------------------------------------------------
// ANIMATION LOOP
// --------------------------------------------------

let isRebuilding = false;

function animate() {
  requestAnimationFrame(animate);
  if (isRebuilding) return;

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

let resizeTimer: any;

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);

  resizeTimer = setTimeout(() => {
    isRebuilding = true;

    // resize renderer
    renderer.setSize(innerWidth, innerHeight);

    // resize mouse trail
    const mt = getMouseTrailResolution();
    MouseTrail.resize(mt.width, mt.height);

    // destroy + recreate fluid sim
    FluidSim.destroy();
    FluidSize = getFluidSimResolution();
    FluidSim = SetupFluidSim(renderer, FluidSize.width, FluidSize.height, Uniforms);

    // resize scenes
    ResizeControllers(innerWidth, innerHeight);

    // 🚨 CRITICAL: rebuild TSL pipeline
    buildPipeline();

    isRebuilding = false;
  }, 300);
});