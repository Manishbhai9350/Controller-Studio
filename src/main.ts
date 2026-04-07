import "./style.css";
import * as THREE from "three/webgpu";
import { pass, texture, uniform } from "three/tsl";

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
import {
  DotProductNode,
  DotProductNodeCA,
  TransitionNode,
} from "./config/output.node";
import Stats from "three/examples/jsm/libs/stats.module.js";

// --------------------------------------------------
// BASIC SETUP
// --------------------------------------------------

const isDebug = window.location.hash === "#debug";

const main = document.body.querySelector("main");
const Canvas3D = main?.querySelector("canvas.threejs") as HTMLCanvasElement;
const overlay = document.getElementById("overlay");
const loader = document.getElementById("loader");
const enterBtn = document.getElementById("enter-btn") as HTMLButtonElement;

if (!main || !Canvas3D || !overlay || !loader || !enterBtn)
  throw new Error("Elements missing");

// Initially hide canvas and overlay
main.style.display = "none";
overlay.style.display = "none";

initSound();

const renderer = new THREE.WebGPURenderer({
  antialias: true,
  canvas: Canvas3D,
  powerPreference: "high-performance",
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // instead of default PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
await renderer.init();

const statusText = document.getElementById("status-text");
const techModePill = document.getElementById("tech-mode-pill");
const techMode = renderer instanceof THREE.WebGPURenderer ? "WebGPU" : "WebGL";

if (statusText) {
  statusText.textContent = `${techMode} · Live`;
}
if (techModePill) {
  techModePill.textContent = techMode;
}

const loaderSteps = [
  { id: "ls1", label: "Loading shaders", pct: 20 },
  { id: "ls2", label: "Compiling WebGPU", pct: 40 },
  { id: "ls3", label: "Parsing geometry", pct: 60 },
  { id: "ls4", label: "Building fluid sim", pct: 80 },
  { id: "ls5", label: "Ready", pct: 100 },
];
let loaderIdx = 0;
const loaderBar = document.getElementById("loader-bar");
const loaderStatus = document.getElementById("loader-status")!;

const tickLoader = () => {
  if (loaderIdx >= loaderSteps.length) {
    enterBtn.classList.add("visible");
    loaderStatus.textContent = "Ready to launch";
    return;
  }
  const s = loaderSteps[loaderIdx];
  const sElem = document.getElementById(s.id)!;
  sElem.classList.add("done");
  loaderBar!.style.width = s.pct + "%";
  loaderStatus.textContent = s.label;
  loaderIdx++;
  setTimeout(tickLoader, loaderIdx === loaderSteps.length ? 300 : 520);
};

setTimeout(tickLoader, 400);

const stats = new Stats();
if (isDebug) {
  document.body.appendChild(stats.dom);
}

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
  C2BG: uniform(new THREE.Color(0.18, 0.18, 0.18)),

  // {r: 0.33, g: 0.33, b: 0.33}
  // 🎨 Line colors (normalized)
  C1Line: uniform(new THREE.Color(200 / 255, 179 / 255, 126 / 255)),
  C2Line: uniform(new THREE.Color(0.95, 0.95, 0.7)),

  // Luminance weights (grayscale mixing)
  LumWeights: uniform(new THREE.Vector3(0.299, 0.587, 0.114)),

  uRippleStrength: uniform(0.05),
  uMouseLERP: 0.25,
};

const pane = new Pane();
if (!isDebug) {
  pane.dispose();
}

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

function getFluidSimResolution() {
  const MIN_SCREEN = 512;
  const MAX_SCREEN = 1200;
  const MIN_RT = 318; // Further reduced
  const MAX_RT = 512; // Further reduced

  const screenW = window.innerWidth;
  const aspect = window.innerHeight / window.innerWidth;

  const t = Math.min(
    Math.max((screenW - MIN_SCREEN) / (MAX_SCREEN - MIN_SCREEN), 0),
    1,
  );

  const width = Math.round(MIN_RT + (MAX_RT - MIN_RT) * t);
  const height = Math.round(width * aspect);

  return { width, height };
}

function getMouseTrailResolution() {
  const w = Math.min(window.innerWidth * 0.3, 256); // Further reduced multiplier and max
  const h = w * (window.innerHeight / window.innerWidth);
  return { width: Math.round(w), height: Math.round(h) };
}

// --------------------------------------------------
// MOUSE TRAIL + TEXTURE
// --------------------------------------------------

const MouseTrail = SetupMouseTrail({ ...getMouseTrailResolution(), Uniforms });

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
GLB.setDRACOLoader(Draco); // Re-enable Draco

// --------------------------------------------------
// CONTROLLERS (SCENES)
// --------------------------------------------------

let modelsLoaded = false;
// let mouseRotationEnabled = false;

const {
  SceneA,
  CameraA,
  CameraB,
  targetB,
  renderSceneBToTarget,
  resize: ResizeControllers,
  enableMouseRotation,
  animateModelsIn,
  setModelsLoaded,
} = SetupControllers({
  width: innerWidth,
  height: innerHeight,
  GLB,
  renderer,
  pane,
  Uniforms,
});

let enterClicked = false;

setModelsLoaded((loaded: boolean) => {
  modelsLoaded = loaded;
  if (loaded && enterClicked) {
    handleModelEntrance();
  }
});

// Function to handle model entrance animation
const handleModelEntrance = () => {
  if (modelsLoaded) {
    animateModelsIn();
  }
  // Enable mouse rotation immediately
  // mouseRotationEnabled = true;
  enableMouseRotation();
};

ResizeControllers(innerWidth, innerHeight);

// --------------------------------------------------
// LOADER AND ENTER LOGIC
// --------------------------------------------------

enterBtn.addEventListener("click", () => {
  enterClicked = true;
  loader.classList.add("hidden");
  setTimeout(() => {
    loader.style.display = "none";
    main.style.display = "block";
    overlay.style.display = "block";
    handleModelEntrance();
  }, 1000); // matches the opacity transition duration
});
// --------------------------------------------------
// FLUID SIM
// --------------------------------------------------

let FluidSize = getFluidSimResolution();
let FluidSim = SetupFluidSim(
  renderer,
  FluidSize.width,
  FluidSize.height,
  Uniforms,
);

new OrbitControls(CameraB, Canvas3D);

const BlendFunctions = {
  TransitionNode,
  // DotProductNodeCABase,
  DotProductNodeCA,
  DotProductNode,
};

type BlendFunctionKey = keyof typeof BlendFunctions;
let BlendFunction: BlendFunctionKey = "TransitionNode";

// --------------------------------------------------
// RENDER PIPELINE (VERY IMPORTANT)
// --------------------------------------------------

let renderPipeline: THREE.RenderPipeline;
let scenePass: THREE.PassNode;
let maskNode: THREE.TextureNode<"vec4">;
let outputNode: THREE.TextureNode<"vec4">;
let transitionNode: THREE.TextureNode<"vec4">;

function buildPipeline() {
  renderPipeline = new THREE.RenderPipeline(renderer);

  scenePass = pass(SceneA, CameraA);
  maskNode = FluidSim.maskNode;

  outputNode = scenePass.getTextureNode("output");
  transitionNode = texture(targetB.texture);

  // renderPipeline.outputNode = outputNode;
  // renderPipeline.outputNode = texture(trailTexture);
  // renderPipeline.outputNode = maskNode;
  // renderPipeline.outputNode = vec4(maskNode.r,0,0,1);
  // renderPipeline.outputNode = maskNode;
  // renderPipeline.outputNode = Fn(() => {
  //   return vec4(vec2(maskNode.sample(vec2(uv().x, uv().y)).gb),0,1);
  // })();
  // renderPipeline.outputNode = TransitionNode(
  //   outputNode,
  //   maskNode,
  //   Uniforms,
  //   transitionNode,
  // );
  // renderPipeline.outputNode = DotProductNodeCABase(output,maskNode,Uniforms,scene2)
  // renderPipeline.outputNode = DotProductNode(output,maskNode,Uniforms,scene2)
  // renderPipeline.outputNode = DotProductNodeCA(
  //   output,
  //   maskNode,
  //   Uniforms,
  //   scene2,
  // );
  // renderPipeline.outputNode = mix(output, scene2, step(uv().x, 0.5));
  renderPipeline.outputNode = BlendFunctions[BlendFunction]({
    t1: outputNode,
    maskNode,
    Uniforms,
    t2: transitionNode,
  });
}

buildPipeline();

const onBlendChange = () => {
  // rebuild pipeline with new blend function
  renderPipeline.outputNode = BlendFunctions[BlendFunction]({
    t1: outputNode,
    maskNode,
    Uniforms,
    t2: transitionNode,
  });
  renderPipeline.needsUpdate = true;
};

const BlendFolder = pane.addFolder({
  title: "Blend Function",
  expanded: false,
});
BlendFolder.addBinding({ BlendFunction }, "BlendFunction", {
  label: "Mode",
  options: Object.fromEntries(Object.keys(BlendFunctions).map((k) => [k, k])),
}).on("change", ({ value }) => {
  BlendFunction = value as BlendFunctionKey;
  onBlendChange();
});

// --------------------------------------------------
// ANIMATION LOOP
// --------------------------------------------------


function animate() {
  stats.begin();
  requestAnimationFrame(animate);

  MouseTrail.update();
  trailTexture.needsUpdate = true;

  FluidSim.update(trailTexture);
  renderSceneBToTarget();
  renderPipeline.render();
  stats.end();
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
  const fluidSize = getFluidSimResolution();
  FluidSim.resize(fluidSize.width, fluidSize.height);

  // resize mouse trail
  const mouseSize = getMouseTrailResolution();
  MouseTrail.resize(mouseSize.width, mouseSize.height);

  // resize controller scenes
  ResizeControllers(w, h);
}

window.addEventListener("resize", Resize);
