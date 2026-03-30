import "./style.css";

import * as THREE from "three/webgpu";
import {
  Fn,
  mix,
  pass,
  sub,
  texture,
  uniform,
  uv,
  vec2,
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

const main = document.body.querySelector("main");
const Canvas3D: HTMLCanvasElement | null | undefined =
  main?.querySelector("canvas.threejs");

if (!main || !Canvas3D) {
  throw new Error("Something Went Wrong!");
}

const pane = new Pane();

const renderer = new THREE.WebGPURenderer({
  antialias: true,
  canvas: Canvas3D,
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
await renderer.init();

const Uniforms = {
  uFrequency: uniform(50),
  uScale: uniform(6),
  uSpeed: uniform(1),
  uResolution: uniform(new THREE.Vector2(innerWidth, innerHeight)),
};

pane.addBinding(Uniforms.uFrequency, "value", {
  min: 0,
  max: 100,
  step: 0.1,
  label: "Frequency",
});
pane.addBinding(Uniforms.uScale, "value", {
  min: 0,
  max: 10,
  step: 0.001,
  label: "Scale",
});
pane.addBinding(Uniforms.uSpeed, "value", {
  min: 0,
  max: 1000,
  step: 0.001,
  label: "Speed",
});

const MouseTrail = SetupMouseTrail({ width: 512, height: 512 * innerHeight / innerWidth });
main.appendChild(MouseTrail.canvas);

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

const { SceneA, CameraA, SceneB, CameraB, targetB, renderSceneBToTarget } =
  SetupControllers({
    width: innerWidth,
    height: innerHeight,
    GLB,
    renderer,
    pane,
  });

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

// const scenePass = pass(SceneA, CameraA);
const scenePass = pass(SceneA, CameraA);

const t1 = scenePass.getTextureNode("output");
const t2 = texture(targetB.texture);
const maskNode = FluidSim.maskNode;

renderPipeline.outputNode = t1;

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

function animate() {
  const CurrentTime = Time.getElapsed();
  const Delta = CurrentTime - PrevTime;
  PrevTime = CurrentTime;

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
