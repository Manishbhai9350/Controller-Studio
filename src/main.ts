import "./style.css";

import * as THREE from "three/webgpu";
import {
  abs,
  dot,
  float,
  Fn,
  fract,
  length,
  mix,
  mul,
  pass,
  smoothstep,
  step,
  sub,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { SetupMouseTrail } from "./config/mouse";
import {
  DRACOLoader,
  GLTFLoader,
  OrbitControls,
} from "three/examples/jsm/Addons.js";
import { SetupFluidSim } from "./config/fluidsim";
import { Pane } from "tweakpane";
import { SetupControllers } from "./config/controller.scene";
import { initSound } from "./config/audio.engine";
import { perlin2D } from "./noises/fbm";

const main = document.body.querySelector("main");
const Canvas3D: HTMLCanvasElement | null | undefined =
  main?.querySelector("canvas.threejs");

if (!main || !Canvas3D) {
  throw new Error("Something Went Wrong!");
}

initSound();

const pane = new Pane({});
// pane.dispose();

const renderer = new THREE.WebGPURenderer({
  antialias: true,
  canvas: Canvas3D,
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
await renderer.init();

const Uniforms = {
  uFrequency: uniform(25),
  uScale: uniform(25),
  uProgress: uniform(0),
  uSpeed: uniform(1),
  uFallOff: uniform(0.01),
  uResolution: uniform(new THREE.Vector2(innerWidth, innerHeight)),
  uLineThicknes: uniform(.1),
  uLineThreshold: uniform(.5),
  uLineFrequency: uniform(5),

  // Background colors (normalized RGB)
  C1BG: uniform(new THREE.Color(0.8078, 0.8, 0.7804)),
  C2BG: uniform(new THREE.Color(1.0, 0.7765, 0.3294)),

  // Line colors (normalized RGB)
  C1Line: uniform(new THREE.Color(200/255, 179/255,126/255)),
  C2Line: uniform(new THREE.Color(0.902, 0.6627, 0.2392)),

  LumWeights: uniform(new THREE.Vector3(0.299, 0.587, 0.114)),
};

function setColorUniform(
  uniformColor: THREE.UniformNode<"color", THREE.Color>,
  { r, g, b }: { r: number; g: number; b: number },
) {
  uniformColor.value.setRGB(r / 255, g / 255, b / 255);
}
const getRGBObject = (color: THREE.Color) => {
  const { r, g, b } = color;
  return { r: r * 255, g: g * 255, b: b * 255 };
};

const Conf = {
  C1BG: getRGBObject(Uniforms.C1BG.value),
  C2BG: getRGBObject(Uniforms.C2BG.value),
  C1Line: getRGBObject(Uniforms.C1Line.value),
  C2Line: getRGBObject(Uniforms.C2Line.value),
};

pane.addBinding(Uniforms.uLineThicknes,'value',{ min:0,max:1, label:"Line Thickness" })
pane.addBinding(Uniforms.uLineThreshold,'value',{ min:0,max:1, label:"Line Threshold" })
pane.addBinding(Uniforms.uLineFrequency,'value',{ min:0,max:10, label:"Line Frequency" })

// 🎨 BG 1
pane.addBinding(Conf, "C1BG", { label: "BG 1" }).on("change", (ev) => {
  setColorUniform(Uniforms.C1BG, ev.value);
});

// 🎨 Line 1
pane.addBinding(Conf, "C1Line", { label: "Line 1" }).on("change", (ev) => {
  setColorUniform(Uniforms.C1Line, ev.value);
});

// 🎨 BG 2
pane.addBinding(Conf, "C2BG", { label: "BG 2" }).on("change", (ev) => {
  setColorUniform(Uniforms.C2BG, ev.value);
});

// 🎨 Line 2
pane.addBinding(Conf, "C2Line", { label: "Line 2" }).on("change", (ev) => {
  setColorUniform(Uniforms.C2Line, ev.value);
});

// 👁️ Luminance weights (super powerful control)
const lumFolder = pane.addFolder({ title: "Luminance Weights" });

// lumFolder.addBinding(Uniforms.LumWeights.value, "x", {
//   min: 0,
//   max: 1,
//   step: 0.001,
//   label: "Red",
// });

// lumFolder.addBinding(Uniforms.LumWeights.value, "y", {
//   min: 0,
//   max: 1,
//   step: 0.001,
//   label: "Green",
// });

// lumFolder.addBinding(Uniforms.LumWeights.value, "z", {
//   min: 0,
//   max: 1,
//   step: 0.001,
//   label: "Blue",
// });

// pane.addBinding(Uniforms.uFallOff, "value", {
//   min: 0,
//   // max: 100,
//   max: 1,
//   step: 0.0001,
//   label: "FallOff",
// });
// pane.addBinding(Uniforms.uFrequency, "value", {
//   min: 0,
//   // max: 100,
//   max: 20,
//   step: 0.01,
//   label: "Frequency",
// });
// pane.addBinding(Uniforms.uScale, "value", {
//   min: 0,
//   max: 50,
//   step: 0.001,
//   label: "Scale",
// });
// pane.addBinding(Uniforms.uProgress, "value", {
//   min: 0,
//   max: 1,
//   step: 0.001,
//   label: "Progress",
// });

// pane.dispose();

const MouseTrail = SetupMouseTrail({
  width: 512,
  height: (512 * innerHeight) / innerWidth,
});
// main.appendChild(MouseTrail.canvas);

// CanvasTexture wraps the trail canvas
const trailTexture = new THREE.CanvasTexture(MouseTrail.canvas);
trailTexture.minFilter = THREE.LinearFilter;
trailTexture.magFilter = THREE.LinearFilter;
trailTexture.generateMipmaps = false;
trailTexture.flipY = false;

// Loader

// After — no manager
const Draco = new DRACOLoader();
const GLB = new GLTFLoader();

Draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
Draco.setDecoderConfig({ type: "wasm" });
GLB.setDRACOLoader(Draco);

// Controllers

const {
  SceneA,
  CameraA,
  SceneB,
  CameraB,
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

// Fluid sim
const FluidSim = SetupFluidSim(
  renderer,
  innerWidth,
  innerHeight,
  Uniforms,
  // new THREE.Vector2(innerWidth, innerHeight),
);

let Time = new THREE.Timer();
let PrevTime = Time.getElapsed();

// new OrbitControls(CameraA, Canvas3D);
// new OrbitControls(CameraB, Canvas3D);

const renderPipeline = new THREE.RenderPipeline(renderer);

const scenePass = pass(SceneA, CameraA);
// const scenePass = pass(SceneB, CameraB);

const t1 = scenePass.getTextureNode("output");
const t2 = texture(targetB.texture);
const maskNode = FluidSim.maskNode;


// Dot Product Effect
// renderPipeline.outputNode = Fn(() => {
//   const mask = maskNode.sample(vec2(uv().x, uv().y.oneMinus())).r.oneMinus().r;

//   // const nosiedVal = perlin2D(mul(uv().add(mask),2)).mul(.005);
//   const nosiedVal = perlin2D(mul(uv().add(mask), 2)).mul(0.005);
//   const t1Base = t1.sample(uv().add(vec2(nosiedVal)));
//   const luminance = dot(t1Base.rgb, Uniforms.LumWeights);
//   const Lumed = vec4(vec3(luminance), 1).mul(1.05);

//   // return Lumed;
//   return mix(t1, Lumed, mask.oneMinus());
// })();
renderPipeline.outputNode = Fn(() => {
  const mask = maskNode.sample(vec2(uv().x, uv().y.oneMinus())).r.oneMinus().r;
  return mix(t1, t2, smoothstep(0.35, 0.65, abs(float(Uniforms.uProgress).sub(mask))));
})();

// renderPipeline.outputNode = Fn(() => {
//   const screenUV = uv();
//   const resolution = Uniforms.uResolution;

//   const aspect = resolution.x.div(resolution.y);

//   // center UV to -0.5 → 0.5
//   let correctedUV = screenUV.sub(vec2(0.5));

//   // squash X by aspect ratio
//   correctedUV = vec2(correctedUV.x.div(aspect), correctedUV.y);

//   // back to 0 → 1 space
//   correctedUV = correctedUV.add(vec2(0.5));

//   // flip Y because render target is flipped
//   const flippedUV = vec2(correctedUV.x, correctedUV.y.oneMinus());

//   const mask = maskNode.sample(flippedUV).r.oneMinus();

//   // return mix(t1,t2,mask);
//   return maskNode.sample(flippedUV);
//   // return vec4(flippedUV,0,1)
//   // return maskNode;
// })();

new OrbitControls(CameraA, Canvas3D);

function animate() {
  MouseTrail.update();
  trailTexture.needsUpdate = true;

  // 1️⃣ update fluid sim
  FluidSim.update(trailTexture);

  // 2️⃣ render sceneB into texture FIRST
  renderSceneBToTarget();

  // 3️⃣ render final screen LAST
  // renderer.render(SceneA, CameraA);
  renderPipeline.render();

  requestAnimationFrame(animate);
}

animate();

let id = null;

function Resize() {
  clearTimeout(id);

  id = setTimeout(() => {
    const aspect = innerWidth / innerHeight;
    renderer.setSize(innerWidth, innerHeight);

    FluidSim.resize(window.innerWidth, window.innerHeight);
    MouseTrail.resize(512, 512 / aspect);
    ResizeControllers(innerWidth, innerHeight);
  }, 500);
}

window.addEventListener("resize", Resize);
