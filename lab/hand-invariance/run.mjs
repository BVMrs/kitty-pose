// Property/fuzz harness for handFeatures(): rotation, mirror, scale, aspect ratio, malformed input.
// Run: node lab/hand-invariance/run.mjs   (from repo root)
import { handFeatures, MEMES, faceFeatures } from "../../memes.js";

// Synthetic hand (same geometry as test/memes.test.js), in isotropic pixel units, wrist at origin.
function hand(ext, mirror = false) {
  const P = (dx, dy) => ({ x: (mirror ? -dx : dx) * 100, y: dy * 100, z: 0 });
  const h = [P(0, 0), P(-0.4, -0.3), P(-0.7, -0.6)];
  h.push(ext[0] ? P(-0.8, -1.0) : P(-0.4, -0.75), ext[0] ? P(-0.85, -1.4) : P(-0.1, -0.8));
  [-0.3, 0, 0.3, 0.55].forEach((x, f) => {
    h.push(P(x, -1.0), P(x, -1.4));
    if (ext[f + 1]) h.push(P(x, -1.75), P(x, -2.05)); else h.push(P(x, -1.2), P(x, -0.95));
  });
  return h;
}
// place in a W x H frame at centre, rotated by deg (clockwise on screen), scaled, normalised like MediaPipe
function place(h, deg, W, H, scale = 1) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return h.map((p) => {
    const x = (p.x * c - p.y * s) * scale, y = (p.x * s + p.y * c) * scale;
    return { x: (W / 2 + x) / W, y: (H / 2 + y) / H, z: 0 };
  });
}
const POSES = {
  thumbsUp: [1, 0, 0, 0, 0], pointing: [0, 1, 0, 0, 0], openPalm: [1, 1, 1, 1, 1],
  fist: [0, 0, 0, 0, 0], shaka: [1, 0, 0, 0, 1],
};
const FRAMES = { square: [1000, 1000], portrait916: [720, 1280], landscape43: [1280, 960] };
const res = {};
for (const [fname, [W, H]] of Object.entries(FRAMES)) {
  for (const mirror of [false, true]) for (const [pose, ext] of Object.entries(POSES)) {
    let ok = 0, n = 0; const bad = [];
    for (let deg = 0; deg < 360; deg += 15) {
      const f = handFeatures([place(hand(ext, mirror), deg, W, H)], null);
      n++; if (f[pose]) ok++; else bad.push(deg);
    }
    res[`${fname}${mirror ? " mirrored" : ""} ${pose}`] = { ok, n, bad: bad.join(",") };
  }
}
console.log("== recall of the intended gesture over 24 rotations (0-345 deg), synthetic hand ==");
for (const [k, v] of Object.entries(res)) console.log(k.padEnd(34), `${v.ok}/${v.n}`, v.ok < v.n ? `fails at ${v.bad}` : "");

console.log("\n== rotation tolerance only (square frame): max |deg| from upright where the pose still fires ==");
for (const [pose, ext] of Object.entries(POSES)) {
  let lo = 0, hi = 0;
  while (lo > -180 && handFeatures([place(hand(ext), lo - 5, 1000, 1000)], null)[pose]) lo -= 5;
  while (hi < 180 && handFeatures([place(hand(ext), hi + 5, 1000, 1000)], null)[pose]) hi += 5;
  console.log(pose.padEnd(10), `fires from ${lo} to ${hi} deg`);
}

console.log("\n== fuzz: malformed input must not throw; scores must stay in [0,1] ==");
let throws = {}, outOfRange = 0, total = 0;
const rnd = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; })();
const pt = () => ({ x: rnd() * 1.4 - 0.2, y: rnd() * 1.4 - 0.2, z: rnd() });
const mk = (kind) => {
  const h = Array.from({ length: 21 }, pt);
  if (kind === "nan") h[Math.floor(rnd() * 21)].x = NaN;
  if (kind === "short") h.length = Math.floor(rnd() * 21);
  if (kind === "same") h.forEach((p) => Object.assign(p, { x: 0.5, y: 0.5 }));
  if (kind === "undefined") h[Math.floor(rnd() * 21)] = undefined;
  if (kind === "inf") h[4].y = Infinity;
  return h;
};
for (const kind of ["random", "nan", "short", "same", "undefined", "inf"]) {
  let t = 0, o = 0, c = 0, ex = "";
  for (let i = 0; i < 2000; i++) {
    const hands = Array.from({ length: Math.floor(rnd() * 4) }, () => mk(kind));
    const face = rnd() < 0.5 ? null : Array.from({ length: 478 }, pt);
    try {
      const f = { ...faceFeatures({}, face), ...handFeatures(hands, face) };
      for (const m of MEMES) { const v = m.score(f); c++; if (!(v >= 0 && v <= 1)) o++; }
    } catch (e) { t++; ex ||= e.message; }
  }
  console.log(kind.padEnd(10), `throws ${t}/2000`, `scores out of [0,1]: ${o}/${c}`, ex && `e.g. "${ex}"`);
}
// faceFeatures with a truncated landmark list
try { faceFeatures({}, Array.from({ length: 10 }, pt)); console.log("faceFeatures short lm: ok"); }
catch (e) { console.log("faceFeatures with <455 landmarks throws:", e.message); }
