import * as THREE from "three/webgpu";

import { Fn, mix, uniform, uv, vec2, vec3, vec4 } from "three/tsl";
import type { AppUniforms } from "../types";

export const DotProductNode = (
    t1: THREE.TextureNode<"vec4">,
    maskNode: THREE.TextureNode<"vec4">,
    Uniforms: AppUniforms,
) => {
  return Fn(() => {

    const mask = maskNode.r;
    const gray = t1.rgb.dot(uniform(Uniforms.LumWeights));
    const dotedNode = vec4(vec3(gray), 1.0);

    return mix(t1,dotedNode,mask);
  })();
};
