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
  min,
  abs,
  max,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { fbm } from "../noises/fbm";
import type { uniforms } from "../types";

interface FluidSimReturn {
  maskNode: THREE.TextureNode<"vec4">;
  update: (trailTex: THREE.Texture) => void;
  resize: (w: number, h: number) => void;
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
  // To this — use a 1x1 white DataTexture as fallback:
  const fallback = new THREE.DataTexture(
    new Uint8Array([255, 255, 255, 255]),
    1,
    1,
  );
  fallback.needsUpdate = true;
  const inputNode = texture(fallback);
  const maskNode = texture(targetB.texture);

  // 🧠 FLUID SHADER
  const fluidShader = Fn(() => {
    const uvCoord = uv();

    const noiseX = fbm(
      vec2(uvCoord.x.mul(uvCoord.y), uvCoord.y).mul(Uniforms.uFrequency),
    ).mul(.4);
    const noiseY = fbm(
      vec2(uvCoord.x, uvCoord.y.mul(uvCoord.x)).mul(Uniforms.uFrequency),
    ).mul(.4);

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

    // Edge Distortion F
    const texR = prevNode.sample(vec2(add(uvCoord.x, disp.x), uvCoord.y));
    const texL = prevNode.sample(vec2(sub(uvCoord.x, disp.x), uvCoord.y));
    const texU = prevNode.sample(vec2(uvCoord.x, add(uvCoord.y, disp.y)));
    const texD = prevNode.sample(vec2(uvCoord.x, sub(uvCoord.y, disp.y)));
    const texRU = prevNode.sample(add(uvCoord, disp));
    const texRD = prevNode.sample(add(uvCoord, vec2(disp.x, disp.y.negate())));
    const texLU = prevNode.sample(sub(uvCoord, vec2(disp.x, disp.y.negate())));
    const texLD = prevNode.sample(sub(uvCoord, vec2(disp.x, disp.y)));

    const DLDRU = texLD.r.sub(texRU.r);
    const DRDLU = texRD.r.sub(texLU.r);
    const gradX = sub(texR.r, texL.r);
    const gradY = sub(texU.r, texD.r);

    const edgeStrength = min(
      float(1.0),
      add(abs(gradX), abs(gradY)).mul(3), // boost edges
    );

    const edgeXYStrength = max(
      max(abs(DLDRU), abs(DRDLU)).sub(add(abs(gradX), abs(gradY))),
      float(0),
    );

    const edgeHVStrength = float(1).sub(edgeXYStrength);

    const distortionX = add(gradX.mul(0.6), noiseX.mul(0.4))
      .mul(edgeHVStrength)
      .mul(edgeStrength);
    const distortionY = add(gradY.mul(0.6), noiseY.mul(0.4))
      .mul(edgeHVStrength)
      .mul(edgeStrength);

    distortionX.addAssign(noiseX.mul(edgeXYStrength).mul(edgeStrength));
    distortionY.addAssign(noiseY.mul(edgeXYStrength).mul(edgeStrength));

    // mouse trail input
    const input = inputNode.sample(uvCoord);
    const combined = blendDarken(flood, input.rgb);

    const mask = min(vec3(1.0), add(combined, vec3(0.05 ))).r;

    // pack data into channels
    return vec3(
      mask, // R → mask
      distortionX.mul(0.5).add(0.5), // G → remapped -1..1 → 0..1
      distortionY.mul(0.5).add(0.5), // B → remapped -1..1 → 0..1
    );
    // return vec4(flippedUV.mul(inputNode.r),0,1)
    // return inputNode;
  });

  // FBO scene
  const fboScene = new THREE.Scene();
  const fboCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

  const mat = new MeshBasicNodeMaterial();
  mat.colorNode = fluidShader();

  const geo = new THREE.PlaneGeometry(2, 2);

  // flip Y of UVs (v -> 1 - v)
  const uvAttr = geo.attributes.uv;

  for (let i = 0; i < uvAttr.count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    uvAttr.setXY(i, u, 1 - v);
  }

  uvAttr.needsUpdate = true;

  const quad = new THREE.Mesh(geo, mat);
  fboScene.add(quad);

  // 🔥 UPDATE LOOP
  const update = (trailTexture: THREE.Texture) => {
    prevNode.value = targetA.texture;

    inputNode.value = trailTexture;
    inputNode.needsUpdate = true;
    mat.needsUpdate = true; // 👈 add this

    renderer.setRenderTarget(targetB);
    renderer.render(fboScene, fboCamera);
    renderer.setRenderTarget(null);

    const temp = targetA;
    targetA = targetB;
    targetB = temp;

    maskNode.value = targetA.texture;
    maskNode.needsUpdate = true; // 👈 add this too
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

  return { maskNode, update, resize };
};
