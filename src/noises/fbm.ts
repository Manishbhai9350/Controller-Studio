import {
  Fn,
  fract,
  vec3,
  float,
  floor,
  mix,
  Loop,
  sin,
  vec2,
  dot,
  mat2,
  cos,
} from "three/tsl";
import { Matrix2, type ConstNode, type VarNode, type Vector2, type Vector3 } from "three/webgpu";
import { hash31 } from "./hash";


export const fade = Fn(([t]:[ConstNode<"float", number>]) => {
  return t.mul(t).mul(t).mul(
    t.mul(t.mul(6).sub(15)).add(10)
  );
});


export const randomGradient = Fn(([p]:[ConstNode<"vec2", Vector2>]) => {
  const x = sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453).fract();
  const y = sin(dot(p, vec2(269.5, 183.3))).mul(43758.5453).fract();
  
  // map 0→1 to -1→1
  return vec2(x.mul(2).sub(1), y.mul(2).sub(1));
});


export const perlin2D = Fn(([p]:[ConstNode<"vec2", Vector2>]) => {
  const i = floor(p);
  const f = fract(p);

  const u = fade(f);

  // Corners
  const g00 = randomGradient(i.add(vec2(0,0)));
  const g10 = randomGradient(i.add(vec2(1,0)));
  const g01 = randomGradient(i.add(vec2(0,1)));
  const g11 = randomGradient(i.add(vec2(1,1)));

  // Distance vectors
  const d00 = f.sub(vec2(0,0));
  const d10 = f.sub(vec2(1,0));
  const d01 = f.sub(vec2(0,1));
  const d11 = f.sub(vec2(1,1));

  // Dot products (the key difference vs value noise)
  const n00 = dot(g00, d00);
  const n10 = dot(g10, d10);
  const n01 = dot(g01, d01);
  const n11 = dot(g11, d11);

  // Bilinear interpolation with fade curve
  const nx0 = mix(n00, n10, u.x);
  const nx1 = mix(n01, n11, u.x);
  const nxy = mix(nx0, nx1, u.y);

  return nxy;
});

const rot = mat2(new Matrix2(Math.cos(0.5), Math.sin(0.5), Math.sin(0.5) * -1, Math.cos(0.5)));

export const random2D = Fn(([st]: [ConstNode<"vec2", Vector2>]) => {
  return fract(sin(dot(st, vec2(12.9898, 78.233))).mul(43758.5453123));
});

export let noise2D = Fn(([st]: [ConstNode<"vec2", Vector2>]) => {
  const i = floor(st);
  const f = fract(st);

  const a = random2D(i);
  const b = random2D(i.add(vec2(1.0, 0.0)));
  const c = random2D(i.add(vec2(0.0, 1.0)));
  const d = random2D(i.add(vec2(1.0, 1.0)));

  const u = f.mul(f).mul(vec2(3.0).sub(f.mul(2.0)));

  return mix(a, b, u.x)
    .add(c.sub(a).mul(u.y).mul(vec2(1.0).sub(vec2(u.x))))
    .add(d.sub(b).mul(u.x.mul(u.y)));
});

noise2D = perlin2D;

// Uses any base noise function (valueNoise, perlinNoise, etc.)
export  const fbm = Fn(([st]: [ConstNode<"vec2", Vector2>]) => {
  let v = float(0.0);
  let a = float(0.5);
  let shift = vec2(100.0);

  let p = st;

  // OCTAVE 1
  v = v.add(a.mul(noise2D(p)));
  p = rot.mul(p).mul(2.0).add(shift);
  a = a.mul(0.5);

  // OCTAVE 2
  v = v.add(a.mul(noise2D(p)));
  p = rot.mul(p).mul(2.0).add(shift);
  a = a.mul(0.5);

  // OCTAVE 3
  v = v.add(a.mul(noise2D(p)));
  p = rot.mul(p).mul(2.0).add(shift);
  a = a.mul(0.5);

  // OCTAVE 4
  v = v.add(a.mul(noise2D(p)));
  p = rot.mul(p).mul(2.0).add(shift);
  a = a.mul(0.5);

  // OCTAVE 5
  v = v.add(a.mul(noise2D(p)));

  return v;
});


