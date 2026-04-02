import type { UniformNode } from "three/webgpu";

interface mouseMove {
  x: number;
  y: number;
}

interface SetupMouseProps {
  onMouseMove?: (props: mouseMove) => void;
}

interface mouse {
  x: number;
  y: number;
}

interface MouseTrailOptions {
  width: number;
  height: number;
}

interface MouseTrailReturn {
  canvas: HTMLCanvasElement;
  update: () => void;
}

interface uniforms {
  uFrequency: UniformNode<"float", number>;
  uScale: UniformNode<"float", number>;
  uSpeed: UniformNode<"float", number>;
}

interface ControllersProps {
  permian: THREE.Group<THREE.Object3DEventMap> | null;
  basic: THREE.Group<THREE.Object3DEventMap> | null;
}



export interface AppUniforms {
  uFrequency: UniformNode<"float", number>;
  uScale: UniformNode<"float", number>;
  uProgress: UniformNode<"float", number>;
  uSpeed: UniformNode<"float", number>;
  uFallOff: UniformNode<"float", number>;
  uResolution: UniformNode<"vec2", THREE.Vector2>;

  uLineThicknes: UniformNode<"float", number>;
  uLineThreshold: UniformNode<"float", number>;
  uLineFrequency: UniformNode<"float", number>;

  // Colors
  C1BG: UniformNode<"color", THREE.Color>;
  C2BG: UniformNode<"color", THREE.Color>;
  C1Line: UniformNode<"color", THREE.Color>;
  C2Line: UniformNode<"color", THREE.Color>;

  LumWeights: UniformNode<"vec3", THREE.Vector3>;
  uRippleStrength: UniformNode<"float", number>;
}