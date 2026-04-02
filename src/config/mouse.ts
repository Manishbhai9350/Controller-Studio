// config/mouseTrail.ts

import type { AppUniforms } from "../types";
import { LERP } from "../utils";

interface MouseTrailOptions {
  width: number;
  height: number;
  Uniforms: AppUniforms;
}

interface MouseTrailReturn {
  canvas: HTMLCanvasElement;
  update: () => void;
  resize: (width: number, height: number) => void; // 👈 new
}

function mountCanvas(canvas: HTMLCanvasElement) {
  if (canvas.parentElement) return; // prevent duplicate mount

  canvas.style.position = "fixed";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";

  // document.body.appendChild(canvas);
}

export const SetupMouseTrail = ({
  width,
  height,
  Uniforms,
}: MouseTrailOptions): MouseTrailReturn => {
  let canvasWidth = width;
  let canvasHeight = height;
  // Canvas setup
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d")!;

  mountCanvas(canvas);

  function initContextState() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 100;
  }

  // Fill white to start
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

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

    mouse.x = LERP(targetMouse.x, mouse.x, Uniforms.uMouseLERP);
    mouse.y = LERP(targetMouse.y, mouse.y, Uniforms.uMouseLERP);

    const dx = mouse.x - lastMouse.x;
    const dy = mouse.y - lastMouse.y;
    const speed = Math.sqrt(dx * dx + dy * dy);

    let LerpFactor = 0.1;
    const targetOpacity = speed > 0.001 ? 1 : 0;

    // if (targetOpacity == 0) {
    //   LerpFactor = 0.05;
    // } else {
    // }
    // LerpFactor = 0.3;
    opacity = LERP(targetOpacity, opacity, LerpFactor);

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // if (opacity > 0.01) {
    ctx.beginPath();
    ctx.moveTo(lastMouse.x * canvasWidth, lastMouse.y * canvasHeight);
    ctx.lineTo(mouse.x * canvasWidth, mouse.y * canvasHeight);
    ctx.lineCap = "round";
    ctx.lineWidth = 100;
    ctx.strokeStyle = `rgba(0, 1, 0, ${opacity})`;
    // ctx.strokeStyle = `rgba(0, 0, 0, 1)`;
    ctx.stroke();
    // }
  };

  const resize = (newWidth: number, newHeight: number) => {
    canvasWidth = newWidth;
    canvasHeight = newHeight;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 💥 re-init drawing state after resize
    initContextState();

    // clear
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // optional reset to avoid jump
    mouse = null;
    lastMouse = null;
  };
  return { canvas, update, resize };
};
