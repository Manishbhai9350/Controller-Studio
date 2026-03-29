import * as THREE from 'three/webgpu'

export const LERP = (target: number, current: number, delta: number) =>
  current + (target - current) * delta;

export const fitModelToView = (
  model: THREE.Group,
  camera: THREE.PerspectiveCamera,
  sceneWidth: number,
  sceneHeight: number,
) => {
  // 1️⃣ Compute bounding box
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // 2️⃣ Center model to world origin
  model.position.sub(center);

  // 3️⃣ Calculate camera visible size at distance
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = camera.position.z;

  const visibleHeight = 2 * Math.tan(fov / 2) * distance;
  const visibleWidth = visibleHeight * camera.aspect;

  // 4️⃣ Calculate scale factor (fit 60% of screen)
  const scaleX = visibleWidth / size.x;
  const scaleY = visibleHeight / size.y;
  const scale = Math.min(scaleX, scaleY) * 0.6;

  model.scale.setScalar(scale);
};


export function setupStudioLights(scene: THREE.Scene) {
  // soft global light
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);

  // key light (top-left)
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(-3, 4, 3);

  // fill light (right side soft)
  const fill = new THREE.DirectionalLight(0xffffff, 1.2);
  fill.position.set(3, 1, 2);

  // rim light (back glow)
  const rim = new THREE.DirectionalLight(0xffffff, 2);
  rim.position.set(0, 2, -4);

  // subtle bottom bounce
  const bounce = new THREE.DirectionalLight(0xffffff, 0.6);
  bounce.position.set(0, -3, 1);

  scene.add(ambient, key, fill, rim, bounce);
}
