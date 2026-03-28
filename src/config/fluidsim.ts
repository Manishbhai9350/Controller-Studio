// config/fluidSim.ts
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
  sin,
  cos,
  dot,
  fract,
  mix,
  time,
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
  // ── Two render targets — the ping pong pair ──
  const opts: THREE.RenderTargetOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  };
  let targetA = new THREE.RenderTarget(width, height, opts);
  let targetB = new THREE.RenderTarget(width, height, opts);

  // TSL nodes — bridges between sim and rest of pipeline
  const prevNode = texture(targetA.texture); // shader reads this
  const inputNode = texture(new THREE.Texture()); // mouse trail input
  const maskNode = texture(targetA.texture); // compositor reads this

  // ── FBM noise for organic displacement ──
  //   const fbm1 = (
  //     uvCoord: THREE.ConstNode<"vec2", THREE.Vector2>,
  //     octaves: number,
  //   ) => {
  //     let value = float(0.0);
  //     let amplitude = float(0.5);
  //     let frequency = float(1.0);

  //     for (let i = 0; i < octaves; i++) {
  //       const scaled = mul(uvCoord, frequency);
  //       const nx = fract(
  //         mul(sin(dot(scaled, vec2(127.1, 311.7))), float(43758.5453)),
  //       );
  //       const ny = fract(
  //         mul(sin(dot(scaled, vec2(269.5, 183.3))), float(43758.5453)),
  //       );
  //       const n = mix(float(-1.0), float(1.0), mul(add(nx, ny), float(0.5)));
  //       value = add(value, mul(amplitude, n));
  //       amplitude = mul(amplitude, float(0.5));
  //       frequency = mul(frequency, float(2.0));
  //     }
  //     return value;
  //   };

  // ── Fluid shader ──
  const fluidShader = Fn(() => {
    const uvCoord = uv();

    const aspect = height / width;
    const aspectVec =
      width < height ? vec2(1.0, 1.0 / aspect) : vec2(aspect, 1.0);

    // FBM displacement — makes spread uneven and organic
    const noisedValue = fbm(
      vec3(
        mul(uvCoord, Uniforms.uFrequency),
        time.mul(0.001).mul(Uniforms.uSpeed),
      ),
    );
    const disp = noisedValue
      .mul(aspectVec)
      .mul(float(0.001).mul(Uniforms.uScale));

    const blendDarken = Fn(
      ([base, blend]: [THREE.VarNode<"vec3">, THREE.VarNode<"vec3">]) =>
        min(blend, base),
    );

    // Sample previous frame at 5 positions
    const texel = prevNode.sample(uvCoord);
    const texel2 = prevNode.sample(vec2(add(uvCoord.x, disp.x), uvCoord.y));
    const texel3 = prevNode.sample(vec2(sub(uvCoord.x, disp.x), uvCoord.y));
    const texel4 = prevNode.sample(vec2(uvCoord.x, add(uvCoord.y, disp.y)));
    const texel5 = prevNode.sample(vec2(uvCoord.x, sub(uvCoord.y, disp.y)));

    // Keep darkest — this is the spread
    const floodcolor = texel.rgb.toVar();
    floodcolor.assign(blendDarken(floodcolor, texel2.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel3.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel4.rgb));
    floodcolor.assign(blendDarken(floodcolor, texel5.rgb));

    // Blend in mouse trail — darkest wins
    const flippedUV = vec2(uvCoord.x, sub(float(1.0), uvCoord.y));
    const input = inputNode.sample(flippedUV);
    const combined = blendDarken(floodcolor, input.rgb);

    // Fade back to white — ~67 frames to recover
    return min(vec3(1.0), add(combined, vec3(0.015)));
  });

  // ── FBO scene — orthographic quad, processes every pixel ──
  const fboScene = new THREE.Scene();
  const fboCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

  const mat = new MeshBasicNodeMaterial();
  mat.colorNode = fluidShader();

  const geo = new THREE.PlaneGeometry(2, 2);

  // Flip UVs for WebGPU read-back consistency
  const uvAttr = geo.attributes.uv;
  for (let i = 0; i < uvAttr.count; i++) {
    uvAttr.setY(i, 1.0 - uvAttr.getY(i));
  }

  const fboQuad = new THREE.Mesh(geo, mat);
  fboScene.add(fboQuad);

  // ── Update — called every frame ──
  const update = (trailTexture: THREE.Texture) => {
    // Point shader at last frame
    prevNode.value = targetA.texture;
    inputNode.value = trailTexture;

    // Render fluid pass into targetB
    renderer.setRenderTarget(targetB);
    renderer.render(fboScene, fboCamera);
    renderer.setRenderTarget(null);

    // maskNode points at fresh result
    maskNode.value = targetB.texture;

    // Swap — B becomes new A next frame
    const temp = targetA;
    targetA = targetB;
    targetB = temp;
  };

  return { maskNode, update };
};
