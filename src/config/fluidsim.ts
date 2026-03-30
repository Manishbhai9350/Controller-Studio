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
  time
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { fbm } from "../noises/fbm";
import type { uniforms } from "../types";

interface FluidSimReturn {
  maskNode: ReturnType<typeof texture>;
  update: (trailTexture: THREE.Texture) => void;
}

export const SetupFluidSim = (
  renderer: THREE.WebGPURenderer,
  width: number,
  height: number,
  Uniforms: uniforms,
): FluidSimReturn => {

  // ping pong render targets
  const opts: THREE.RenderTargetOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  };

  let targetA = new THREE.RenderTarget(width, height, opts);
  let targetB = new THREE.RenderTarget(width, height, opts);

  // TSL bridge nodes
  const prevNode = texture(targetA.texture);
  const inputNode = texture(new THREE.Texture());
  const maskNode = texture(targetA.texture);

  // fluid shader
  const fluidShader = Fn(() => {
    const uvCoord = uv();

    // aspect corrected UV so mask is not stretched
    // const screenAspect = width / height;
    // const correctedUV = vec2(
    //   uvCoord.x.mul(screenAspect).sub(float((screenAspect - 1.0) / 2.0)),
    //   uvCoord.y,
    // );

    // displacement aspect fix
    // const aspect = height / width;
    // const aspectVec =
    //   width < height ? vec2(1.0, 1.0 / aspect) : vec2(aspect, 1.0);

    // FBM noise displacement
    const noiseVal = fbm(
      vec3(
        mul(uvCoord, Uniforms.uFrequency),
        time.mul(0.001).mul(Uniforms.uSpeed),
      ),
    );

    const disp = noiseVal
      // .mul(aspectVec)
      .mul(float(0.001).mul(Uniforms.uScale));

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

    const floodcolor = texel.rgb.toVar();
    floodcolor.assign(blendDarken(floodcolor, texel2.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel3.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel4.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel5.rgb));

    // mouse trail input
    const flippedUV = vec2(uvCoord.x, sub(float(1.0), uvCoord.y));
    const input = inputNode.sample(flippedUV);
    const combined = blendDarken(floodcolor, input.rgb);

    // If(combined.r.greaterThan(.4), () => {
    //   combined.rgb.assign(vec3(1,1,1))
    // })

    // feedback
    return min(vec3(1.0), add(combined, vec3(0.015)));
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

  return { maskNode, update };
};