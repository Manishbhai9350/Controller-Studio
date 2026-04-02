import {
  abs,
  attribute,
  color,
  float,
  Fn,
  fract,
  length,
  mix,
  positionLocal,
  positionWorld,
  smoothstep,
  step,
  time,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import * as THREE from "three/webgpu";
import { fbm, perlin2D } from "../noises/fbm";
import type { AppUniforms } from "../types";

const OffsetZ = 5;

export const createBackgroundPlane = (
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  bgColor: THREE.UniformNode<"color", THREE.Color>,
  LineColor: THREE.UniformNode<"color", THREE.Color>,
  Uniforms: AppUniforms,
) => {
  // visible camera size at distance
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let dist = camera.position.z + OffsetZ;

  let viewHeight = 2 * Math.tan(fov / 2) * dist;
  let viewWidth = viewHeight * camera.aspect;

  let geometry = new THREE.PlaneGeometry(viewWidth, viewHeight, 100, 100);

  const finalColor = Fn(() => {
    // uniforms
    const uFrequency = 8;
    const uScale = 8;
    const threshold = Uniforms.uLineThreshold;
    const thickness = Uniforms.uLineThicknes.div(2);

    // centered UV (-1 → 1)
    const centeredUV = uv().mul(2).sub(1);

    // your fbm function 👇
    const n = perlin2D(
      vec2(centeredUV.mul(Uniforms.uLineFrequency)).add(time).mul(0.3),
    ).mul(uScale);

    // circular contour rings
    const rings = fract(n);

    const lower = threshold.sub(thickness);
    const upper = threshold.add(thickness);
    const lines = step(lower, rings) // rings >= lower
      .mul(step(rings, upper)); // rings <= upper

    return mix(Uniforms.C1BG, Uniforms.C1Line, abs(lines));
  })();

  const material = new THREE.MeshBasicNodeMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  material.colorNode = finalColor;

  mesh.position.z = -OffsetZ; // behind model

  scene.add(mesh);

  const resize = (cameraZ = 0) => {
    dist = cameraZ + OffsetZ;
    viewHeight = 2 * Math.tan(fov / 2) * dist;
    viewWidth = viewHeight * camera.aspect;
    mesh.geometry.dispose();
    geometry = new THREE.PlaneGeometry(viewWidth, viewHeight, 100, 100);
    mesh.geometry = geometry;
  };

  return { mesh, material, resize };
};
