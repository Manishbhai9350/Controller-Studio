import { abs, dot, Fn, fract, mix, step, time, uv, vec2 } from "three/tsl";
import * as THREE from "three/webgpu";
import { noise2D, perlin2D } from "../noises/fbm";
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
    const uScale = 8;
    const threshold = Uniforms.uLineThreshold;
    const thickness = Uniforms.uLineThicknes.div(2);

    // centered UV (-1 → 1)
    const centeredUV = uv().mul(2).sub(1);

    // your fbm function 👇
    const n = dot(vec2(.33,.62),noise2D(
      vec2(centeredUV.mul(Uniforms.uLineFrequency))
        .add(time)
        .mul(uScale)
        .mul(0.06),
    ));

    // circular contour rings
    const rings = fract(n.mul(12));

    // const lower = threshold.sub(thickness);
    // const upper = threshold.add(thickness);
    const lower = .2;
    const upper = .4;
    const lines = step(lower, rings) // rings >= lower
      .mul(step(rings, upper)); // rings <= upper

    return mix(bgColor, LineColor, abs(lines));
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
