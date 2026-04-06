import { Fn, fract, float, floor, mix, sin, vec2, dot, mat2, cos } from "three/tsl";
import { Matrix2, Node, type ConstNode, type Vector2 } from "three/webgpu";

export const fade = Fn(([t]: [ConstNode<"float", number>]) => {
  return t
    .mul(t)
    .mul(t)
    .mul(t.mul(t.mul(6).sub(15)).add(10));
});

export const fade2D = Fn(([st]: [ConstNode<"vec2", Vector2>]): Node<"vec2"> => {
  return st
    .mul(st)
    .mul(st)
    .mul(st.mul(st.mul(6).sub(15)).add(10));
});

export const randomGradient = Fn(([p]:[ConstNode<"vec2", Vector2>]) => {
  const angle = fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)).mul(
    Math.PI * 2,
  );
  return vec2(cos(angle), sin(angle));
});

export const perlin2D = Fn(([p]:[ConstNode<"vec2", Vector2>]) => {
  const i = floor(p).toVar();
  const f = fract(p).toVar();

  const u = f.mul(f).mul(float(3).sub(f.mul(2)));

  const g00 = randomGradient(i);
  const g10 = randomGradient(i.add(vec2(1, 0)));
  const g01 = randomGradient(i.add(vec2(0, 1)));
  const g11 = randomGradient(i.add(vec2(1, 1)));

  const d00 = dot(g00, f);
  const d10 = dot(g10, f.sub(vec2(1, 0)));
  const d01 = dot(g01, f.sub(vec2(0, 1)));
  const d11 = dot(g11, f.sub(vec2(1, 1)));

  return mix(mix(d00, d10, u.x), mix(d01, d11, u.x), u.y).add(0.5);
});
const rot = mat2(
  new Matrix2(Math.cos(0.5), Math.sin(0.5), Math.sin(0.5) * -1, Math.cos(0.5)),
);

export const random2D = Fn(([st]: [ConstNode<"vec2", Vector2>]) => {
  return fract(sin(dot(st, vec2(12.9898, 78.233))).mul(43758.5453123));
});

export let noise2D = Fn(([st]: [ConstNode<"vec2", Vector2>]): Node<"vec2"> => {
  const i = floor(st);
  const f = fract(st);

  const a = random2D(i);
  const b = random2D(i.add(vec2(1.0, 0.0)));
  const c = random2D(i.add(vec2(0.0, 1.0)));
  const d = random2D(i.add(vec2(1.0, 1.0)));

  const u = f.mul(f).mul(vec2(3.0).sub(f.mul(2.0)));

  return mix(a, b, u.x)
    .add(
      c
        .sub(a)
        .mul(u.y)
        .mul(vec2(1.0).sub(vec2(u.x))),
    )
    .add(d.sub(b).mul(u.x.mul(u.y)));
});

// noise2D = perlin2D;

// Uses any base noise function (valueNoise, perlinNoise, etc.)
export const fbm = Fn(([st]: [ConstNode<"vec2", Vector2>]) => {
  let v = float(0.0); // ✅ float, not vec2
  let a = float(0.5);
  let shift = vec2(100.0);
  let p = st;

  v.assign(v.add(a.mul(perlin2D(p))));
  p.assign(rot.mul(p).mul(2.0).add(shift));
  a.assign(a.mul(0.5));

  v.assign(v.add(a.mul(perlin2D(p))));
  p.assign(rot.mul(p).mul(2.0).add(shift));
  a.assign(a.mul(0.5));

  v.assign(v.add(a.mul(perlin2D(p))));
  p.assign(rot.mul(p).mul(2.0).add(shift));
  a.assign(a.mul(0.5));

  v.assign(v.add(a.mul(perlin2D(p))));
  p.assign(rot.mul(p).mul(2.0).add(shift));
  a.assign(a.mul(0.5));

  v.addAssign(a.mul(perlin2D(p)));

  return v;
});
