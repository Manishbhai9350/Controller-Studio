// config/mouseTrail.ts

import { LERP } from "../utils";

interface MouseTrailOptions {
  width: number;
  height: number;
}

interface MouseTrailReturn {
  canvas: HTMLCanvasElement;
  update: () => void;
}

export const SetupMouseTrail = ({
  width,
  height,
}: MouseTrailOptions): MouseTrailReturn => {
  // Canvas setup
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Fill white to start
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);

  // State
  let mouse: { x: number; y: number } | null = null;
  let lastMouse: { x: number; y: number } | null = null;
  let targetMouse: { x: number; y: number } | null = null;
  let opacity = 0;

  // Listen for raw mouse position
  window.addEventListener("mousemove", (e) => {
    targetMouse = {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    };
  });

  const update = () => {
    // return;
    if (!mouse && targetMouse) {
      mouse = { ...targetMouse };
      lastMouse = { ...targetMouse };
      return;
    }

    if (!mouse || !targetMouse) return;

    lastMouse = { ...mouse };

    mouse.x = LERP(targetMouse.x, mouse.x, 0.05);
    mouse.y = LERP(targetMouse.y, mouse.y, 0.05);

    const dx = mouse.x - lastMouse.x;
    const dy = mouse.y - lastMouse.y;
    const speed = Math.sqrt(dx * dx + dy * dy);

    let LerpFactor = 0.1;
    const targetOpacity = speed > 0.001 ? 1 : 0;
    if (targetOpacity == 0) {
      LerpFactor = 0.05;
    } else {
      LerpFactor = 0.1;
    }
    opacity = LERP(targetOpacity, opacity, LerpFactor);

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);

    // if (opacity > 0.01) {
    ctx.beginPath();
    ctx.moveTo(lastMouse.x * width, lastMouse.y * height);
    ctx.lineTo(mouse.x * width, mouse.y * height);
    ctx.lineCap = "round";
    ctx.lineWidth = 100;
    ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`;
    // ctx.strokeStyle = `rgba(0, 0, 0, 1)`;
    ctx.stroke();
    // }
  };

  return { canvas, update };
};
