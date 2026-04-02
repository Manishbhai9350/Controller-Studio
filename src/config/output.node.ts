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
    const sceneColor = t1.sample(distortedUV);
    const scene2Color = t2.sample(distortedUV);

    // luminance (dot product grayscale)
    const gray = sceneColor.rgb.dot(uniform(Uniforms.LumWeights));
    const grayscaleColor = vec4(vec3(gray), 1.0);

    // mix grayscale with original based on mask
    return mix(sceneColor, grayscaleColor, mask);
  })();
};
