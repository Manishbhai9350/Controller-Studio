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
  time,
  uv,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import * as THREE from "three/webgpu";
import { fbm, perlin2D } from "../noises/fbm";
import { smoothstep } from "three/src/math/MathUtils.js";

const OffsetZ = 5;

export const createBackgroundPlane = (
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  bgColor: string,
  Uniforms,
) => {
  // visible camera size at distance
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const dist = camera.position.z + OffsetZ;

  const viewHeight = 2 * Math.tan(fov / 2) * dist;
  const viewWidth = viewHeight * camera.aspect;

  const geometry = new THREE.PlaneGeometry(viewWidth, viewHeight, 100, 100);

  const finalColor = Fn(() => {
    // uniforms
    const uFrequency = float(6);
    const uThickness = float(0.03);
    const uOctaves = float(4);

    // centered UV (-1 → 1)
    const centeredUV = uv().mul(2).sub(1);
    const radius = length(centeredUV);

    // your fbm function 👇
    const n = fbm(vec3(centeredUV.mul(uFrequency), uOctaves));

    // circular contour rings
    const rings = fract(radius.mul(uFrequency).add(n));

    const lines = smoothstep(
      uThickness,
      uThickness.add(0.01),
      abs(rings.sub(0.5)),
    );

    return mix(color(bgColor), color("#e80000"), lines);
  })();

  const material = new THREE.MeshBasicNodeMaterial();
  material.colorNode = Fn(() => {
    const z = perlin2D(uv().mul(Uniforms.uFrequency).add(time))
      .mul(Uniforms.uScale)
      .mul(0.2);

    const c = smoothstep(0.4, 0.6,z);

    // const color = mix();

    return vec4(c, 0, 0, 1);
  })();

  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.z = -OffsetZ; // behind model

  scene.add(mesh);

  return { mesh, material };
};
