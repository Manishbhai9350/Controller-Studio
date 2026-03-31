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
  time,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { fbm } from "../noises/fbm";
import type { uniforms } from "../types";

interface FluidSimReturn {
  maskNode: ReturnType<typeof texture>;
  update: (trailTexture: THREE.Texture) => void;
  resize: (width: number, height: number) => void; // 👈 add
}

const createTargets = (w: number, h: number, opts) => {
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
  // ping pong render targets
  const opts: THREE.RenderTargetOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  };

  let { a: targetA, b: targetB } = createTargets(simWidth, simHeight, opts);

  // TSL bridge nodes
  const prevNode = texture(null as unknown as THREE.Texture);
  const inputNode = texture(null as unknown as THREE.Texture);
  const maskNode = texture(null as unknown as THREE.Texture);
  prevNode.value = targetA.texture;
  maskNode.value = targetA.texture;
  // fluid shader
  const fluidShader = Fn(() => {
    const uvCoord = uv();

    // aspect corrected UV so mask is not stretched
    // const screenAspect = simWidth / simHeight;
    // const correctedUV = vec2(
    //   uvCoord.x.mul(screenAspect).sub(float((screenAspect - 1.0) / 2.0)),
    //   uvCoord.y,
    // );

    // displacement aspect fix
    // const aspect = simHeight / simWidth;
    // const aspectVec =
    //   simWidth < simHeight ? vec2(1.0, 1.0 / aspect) : vec2(aspect, 1.0);

    // FBM noise displacement
    const noiseX = fbm(
      vec2(mul(vec2(uvCoord.x.mul(uvCoord.y), uvCoord.y), Uniforms.uFrequency)),
    );
    const noiseY = fbm(
      vec2(mul(vec2(uvCoord.x, uvCoord.y.mul(uvCoord.x)), Uniforms.uFrequency)),
    );

    const disp = vec2(noiseX, noiseY).mul(float(0.001).mul(Uniforms.uScale));

    // darken blend helper
    const blendDarken = Fn(
      ([base, blend]: [THREE.VarNode<"vec3">, THREE.VarNode<"vec3">]) =>
        min(blend, base),
    );

    // advection samples
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

    const floodcolor = texel.rgb.toVar();
    floodcolor.assign(blendDarken(floodcolor, texel2.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel3.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel4.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel5.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel6.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel7.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel8.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel9.rgb));

    // mouse trail input
    const flippedUV = vec2(uvCoord.x, sub(float(1.0), uvCoord.y));
    const input = inputNode.sample(flippedUV);
    const combined = blendDarken(floodcolor, input.rgb);

    // If(combined.r.greaterThan(.4), () => {
    //   combined.rgb.assign(vec3(1,1,1))
    // })

    // feedback
    return min(vec3(1.0), add(combined, vec3(.04)));
    // return vec4(correctedUV,0,1);
  });

  // FBO full screen quad
  const fboScene = new THREE.Scene();
  const fboCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

  const mat = new MeshBasicNodeMaterial();
  mat.colorNode = fluidShader();

  const geo = new THREE.PlaneGeometry(2, 2);

  // flip UV for WebGPU readback
  const uvAttr = geo.attributes.uv;
  for (let i = 0; i < uvAttr.count; i++) {
    uvAttr.setY(i, 1.0 - uvAttr.getY(i));
  }

  const quad = new THREE.Mesh(geo, mat);
  fboScene.add(quad);

  // update each frame
  const update = (trailTexture: THREE.Texture) => {
    prevNode.value = targetA.texture;
    inputNode.value = trailTexture;

    renderer.setRenderTarget(targetB);
    renderer.render(fboScene, fboCamera);
    renderer.setRenderTarget(null);

    maskNode.value = targetB.texture;

    const temp = targetA;
    targetA = targetB;
    targetB = temp;
  };

  const resize = (newWidth: number, newHeight: number) => {
    simWidth = newWidth;
    simHeight = newHeight;

    // dispose old targets (VERY IMPORTANT)
    targetA.dispose();
    targetB.dispose();

    // rebuild ping-pong buffers
    const targets = createTargets(simWidth, simHeight, opts);
    targetA = targets.a;
    targetB = targets.b;

    // reconnect textures to TSL nodes
    prevNode.value = targetA.texture;
    maskNode.value = targetA.texture;
  };

  return { maskNode, update, resize };
};
