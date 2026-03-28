import "./style.css";

import * as THREE from "three/webgpu";
import { Fn, texture, uniform, uv, vec4 } from "three/tsl";
import { SetupMouseTrail } from "./config/mouse";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { SetupFluidSim } from "./config/fluidsim";
import { Pane } from "tweakpane";

const main = document.body.querySelector("main");
const Canvas3D: HTMLCanvasElement | null | undefined =
  main?.querySelector("canvas.threejs");


if (!main || !Canvas3D) {
  throw new Error("Something Went Wrong!");
}

const pane = new Pane()

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
}

pane.addBinding(Uniforms.uFrequency,'value',{ min:0,max:100, step:.1, label:"Frequency" })
pane.addBinding(Uniforms.uScale,'value',{ min:0,max:10, step:.001, label:"Scale" })
pane.addBinding(Uniforms.uSpeed,'value',{ min:0,max:1000, step:.001, label:"Speed" })

const MouseTrail = SetupMouseTrail({ width: 512, height: 512 });
main.appendChild(MouseTrail.canvas);

// CanvasTexture wraps the trail canvas
const trailTexture = new THREE.CanvasTexture(MouseTrail.canvas);
trailTexture.minFilter = THREE.LinearFilter;
trailTexture.magFilter = THREE.LinearFilter;
trailTexture.generateMipmaps = false;
trailTexture.flipY = false;

// Fluid sim
const FluidSim = SetupFluidSim(renderer, innerWidth, innerHeight, Uniforms);

// Orthographic camera — maps exactly to clip space
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
const scene = new THREE.Scene();

// Fullscreen quad sampling the trail texture
const geo = new THREE.PlaneGeometry(2, 2);
const mat = new THREE.MeshBasicNodeMaterial();
mat.colorNode = FluidSim.maskNode;
// mat.colorNode = texture(trailTexture).sample(uv());
// mat.colorNode = Fn(() => {
//   return vec4(uv(), 0, 1);
// })();

new OrbitControls(camera, Canvas3D);

const quad = new THREE.Mesh(geo, mat);
scene.add(quad);

let Time = new THREE.Timer();
let PrevTime = Time.getElapsed();

function animate() {
  const CurrentTime = Time.getElapsed();
  const Delta = CurrentTime - PrevTime;
  PrevTime = CurrentTime;

  MouseTrail.update();

  // Tell Three.js canvas pixels changed
  trailTexture.needsUpdate = true;


  // Feed trail into fluid sim
  FluidSim.update(trailTexture);

  // Render to screen
  renderer.render(scene, camera);

  requestAnimationFrame(animate);
}

animate();
