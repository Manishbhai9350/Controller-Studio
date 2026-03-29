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
