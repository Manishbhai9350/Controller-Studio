import * as THREE from "three/webgpu";

import { Fn, mix, uniform, uv, vec2, vec3, vec4 } from "three/tsl";
import type { AppUniforms } from "../types";

export const DotProductNode = (
  t1: THREE.TextureNode<"vec4">,
  maskNode: THREE.TextureNode<"vec4">,
  Uniforms: AppUniforms,
  t2: THREE.TextureNode<"vec4">,
) => {
  return Fn(() => {
    // base UVs
    const uvs = uv();

    // read fluid data texture
    const data = maskNode.sample(uvs);

    const mask = data.r;

    // unpack distortion from GB channels (0..1 → -1..1)
    const distortX = data.g.mul(2.0).sub(1.0);
    const distortY = data.b.mul(2.0).sub(1.0);

    // distortion strength (tweakable)
    const distortionStrength = uniform(0.03);

    // apply distortion
    const distortedUV = uvs.add(
      vec2(distortX, distortY).mul(Uniforms.uRippleStrength).mul(mask),
    );

    // sample scene with distorted UVs
    const base = t2.sample(uv())
    const sceneColor = t1.sample(uv());

    // luminance (dot product grayscale)
    const gray = sceneColor.rgb.dot(uniform(Uniforms.LumWeights));
    const grayscaleColor = vec4(vec3(gray), 1.0);

    // mix grayscale with original based on mask
    // return mix(sceneColor, grayscaleColor, mask);
    return mix(base, sceneColor, 0);
  })();
};

export const DotProductNodeCABase = (
  t1: THREE.TextureNode<"vec4">,
  maskNode: THREE.TextureNode<"vec4">,
  Uniforms: AppUniforms,
  t2: THREE.TextureNode<"vec4">,
) => {
  return Fn(() => {
    const uvs = uv();
    const data = maskNode.sample(uvs);
    const mask = data.r;

    const distortX = data.g.mul(2.0).sub(1.0);
    const distortY = data.b.mul(2.0).sub(1.0);

    const distortedUV = uvs.add(
      vec2(distortX, distortY).mul(Uniforms.uRippleStrength).mul(mask),
    );

    // CA only where fluid GB channels have distortion data
    const fluidMag = vec2(distortX, distortY).length();

    const offsetR = vec2(distortX, distortY).mul(Uniforms.uRippleStrength).mul(fluidMag).mul(5);
    const offsetB = vec2(distortX, distortY).mul(Uniforms.uRippleStrength).mul(fluidMag).mul(5).negate();

    const r = t1.sample(distortedUV.add(offsetR)).r;
    const g = t1.sample(distortedUV).g;
    const b = t1.sample(distortedUV.add(offsetB)).b;

    const sceneColor = vec4(r, g, b, 1.0);
    const base = t2.sample(uvs);

    return mix(base, sceneColor, mask);
  })();
};

export const DotProductNodeCA = (
  t1: THREE.TextureNode<"vec4">,
  maskNode: THREE.TextureNode<"vec4">,
  Uniforms: AppUniforms,
  t2: THREE.TextureNode<"vec4">,
) => {
  return Fn(() => {
    const uvs = uv();
    const data = maskNode.sample(uvs);
    const mask = data.r;

    const distortX = data.g.mul(2.0).sub(1.0);
    const distortY = data.b.mul(2.0).sub(1.0);

    const distortedUV = uvs.add(
      vec2(distortX, distortY).mul(Uniforms.uRippleStrength).mul(mask),
    );

    // CA only where fluid GB channels have distortion data
    const fluidMag = vec2(distortX, distortY).length();

    const offsetR = vec2(distortX, distortY)
      .mul(Uniforms.uRippleStrength)
      .mul(fluidMag)
      .mul(12);
    const offsetB = vec2(distortX, distortY)
      .mul(Uniforms.uRippleStrength)
      .mul(fluidMag)
      .mul(12)
      .negate();

    const r = t1.sample(distortedUV.add(offsetR)).r;
    const g = t1.sample(distortedUV).g;
    const b = t1.sample(distortedUV.add(offsetB)).b;

    // CA baked into sceneColor
    const sceneColor = vec4(r, g, b, 1.0);

    // grayscale AFTER channel split so CA fringing survives
    const gray = sceneColor.rgb.dot(uniform(Uniforms.LumWeights));
    const grayscaleColor = vec4(vec3(gray), 1.0);

    // blend grayscale with CA color based on mask
    const finalColor = mix(sceneColor, grayscaleColor, mask);

    const base = t2.sample(uvs);

    return mix(base, finalColor, mask);
  })();
};