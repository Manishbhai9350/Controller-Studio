import * as THREE from "three/webgpu";
import {
  texture,
  uv,
  Fn,
  vec2,
  vec3,
  float,
  add,
  sub,
  mul,
  min,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { fbm } from "../noises/fbm";
import type { uniforms } from "../types";

interface FluidSimReturn {
  maskNode: ReturnType<typeof texture>;
  update: (trailTexture: THREE.Texture) => void;
  resize: (width: number, height: number) => void;
  destroy: () => void; // ⭐ NEW
}

const createTargets = (
  w: number,
  h: number,
  opts: THREE.RenderTargetOptions,
) => {
  const a = new THREE.RenderTarget(w, h, opts);
  const b = new THREE.RenderTarget(w, h, opts);
  return { a, b };
};

export const SetupFluidSim = (
  renderer: THREE.WebGPURenderer,
  width: number,
  height: number,
  Uniforms: uniforms,
): FluidSimReturn => {
  let simWidth = width;
  let simHeight = height;

  const opts: THREE.RenderTargetOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  };

  // ping-pong buffers
  let { a: targetA, b: targetB } = createTargets(simWidth, simHeight, opts);

  // TSL nodes
  const prevNode = texture(targetA.texture);
  const inputNode = texture(null as unknown as THREE.Texture);
  const maskNode = texture(targetA.texture);

  // 🧠 FLUID SHADER
  const fluidShader = Fn(() => {
    const uvCoord = uv();

    const noiseX = fbm(
      vec2(uvCoord.x.mul(uvCoord.y), uvCoord.y).mul(Uniforms.uFrequency),
    );
    const noiseY = fbm(
      vec2(uvCoord.x, uvCoord.y.mul(uvCoord.x)).mul(Uniforms.uFrequency),
    );

    const disp = vec2(noiseX, noiseY).mul(float(0.001).mul(Uniforms.uScale));

    const blendDarken = Fn(
      ([base, blend]: [
        THREE.ConstNode<"vec3", THREE.Vector3>,
        THREE.ConstNode<"vec3", THREE.Vector3>,
      ]) => min(blend, base),
    );

    // 9-tap advection
    const texel = prevNode.sample(uvCoord);
    const texel2 = prevNode.sample(vec2(add(uvCoord.x, disp.x), uvCoord.y));
    const texel3 = prevNode.sample(vec2(sub(uvCoord.x, disp.x), uvCoord.y));
    const texel4 = prevNode.sample(vec2(uvCoord.x, add(uvCoord.y, disp.y)));
    const texel5 = prevNode.sample(vec2(uvCoord.x, sub(uvCoord.y, disp.y)));
    const texel6 = prevNode.sample(
      vec2(add(uvCoord.x, disp.x), add(uvCoord.y, disp.y)),
    );
    const texel7 = prevNode.sample(
      vec2(add(uvCoord.x, disp.x), sub(uvCoord.y, disp.y)),
    );
    const texel8 = prevNode.sample(
      vec2(sub(uvCoord.x, disp.x), add(uvCoord.y, disp.y)),
    );
    const texel9 = prevNode.sample(
      vec2(sub(uvCoord.x, disp.x), sub(uvCoord.y, disp.y)),
    );

    const flood = texel.rgb.toVar();
    flood.assign(blendDarken(flood, texel2.rgb));
    flood.assign(blendDarken(flood, texel3.rgb));
    flood.assign(blendDarken(flood, texel4.rgb));
    flood.assign(blendDarken(flood, texel5.rgb));
    flood.assign(blendDarken(flood, texel6.rgb));
    flood.assign(blendDarken(flood, texel7.rgb));
    flood.assign(blendDarken(flood, texel8.rgb));
    flood.assign(blendDarken(flood, texel9.rgb));

    // mouse trail input
    const flippedUV = vec2(uvCoord.x, sub(float(1.0), uvCoord.y));
    const input = inputNode.sample(flippedUV);
    const combined = blendDarken(flood, input.rgb);

    return min(vec3(1.0), add(combined, vec3(0.04)));
  });

  // FBO scene
  const fboScene = new THREE.Scene();
  const fboCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

  const mat = new MeshBasicNodeMaterial();
  mat.colorNode = fluidShader();

  const geo = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(geo, mat);
  fboScene.add(quad);

  // 🔥 UPDATE LOOP
  const update = (trailTexture: THREE.Texture) => {
    prevNode.value = targetA.texture;

    inputNode.value = trailTexture;
    inputNode.needsUpdate = true;

    renderer.setRenderTarget(targetB);
    renderer.render(fboScene, fboCamera);
    renderer.setRenderTarget(null);

    maskNode.value = targetB.texture;

    // ping-pong swap
    const temp = targetA;
    targetA = targetB;
    targetB = temp;
  };

  // 📐 RESIZE SAFE
  const resize = (newWidth: number, newHeight: number) => {
    simWidth = newWidth;
    simHeight = newHeight;

    targetA.dispose();
    targetB.dispose();

    const targets = createTargets(simWidth, simHeight, opts);
    targetA = targets.a;
    targetB = targets.b;

    prevNode.value = targetA.texture;
    maskNode.value = targetA.texture;
  };

  // 💀 DESTROY (VERY IMPORTANT)
  const destroy = () => {
    targetA.dispose();
    targetB.dispose();
    geo.dispose();
    mat.dispose();
    renderer.setRenderTarget(null);
  };

  return { maskNode, update, resize, destroy };
};
