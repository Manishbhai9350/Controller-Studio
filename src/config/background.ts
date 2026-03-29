import { abs, color, float, fract, length, mix, uv, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { fbm } from '../noises/fbm';
import { smoothstep } from 'three/src/math/MathUtils.js';

export const createBackgroundPlane = (
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  bgColor: string
) => {
  // visible camera size at distance
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const dist = camera.position.z;

  const viewHeight = 2 * Math.tan(fov / 2) * dist;
  const viewWidth = viewHeight * camera.aspect;

  const geometry = new THREE.PlaneGeometry(viewWidth, viewHeight);

  // uniforms
  const uFrequency = float(6);
  const uThickness = float(0.03);
  const uOctaves = float(4);

  // centered UV (-1 → 1)
  const centeredUV = uv().mul(2).sub(1);
  const radius = length(centeredUV);

  // your fbm function 👇
  const n = fbm(vec3(centeredUV.mul(uFrequency),uOctaves));

  // circular contour rings
  const rings = fract(radius.mul(uFrequency).add(n));

  const lines = smoothstep(
    uThickness,
    uThickness.add(0.01),
    abs(rings.sub(0.5))
  );

  const finalColor = mix(
    color(bgColor),
    color("#ffffff"),
    lines
  );

  const material = new THREE.MeshBasicNodeMaterial();
  material.colorNode = finalColor;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = 0; // behind model

  scene.add(mesh);
};