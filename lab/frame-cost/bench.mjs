// Per-frame JS cost of the app's own logic (app.js features() + choose()), Node/V8, desktop CPU.
// Mirrors app.js:74-82 with a MediaPipe-shaped result: 52 blendshape categories, 478 face landmarks, 0-2 hands x 21.
import { MEMES, faceFeatures, handFeatures, createChooser } from "../../memes.js";
const NAMES = ["jawOpen","eyeWideLeft","eyeWideRight","eyeBlinkLeft","eyeBlinkRight","eyeSquintLeft","eyeSquintRight","mouthSmileLeft","mouthSmileRight","mouthFrownLeft","mouthFrownRight","browInnerUp","browOuterUpLeft","browOuterUpRight","browDownLeft","browDownRight","eyeLookOutLeft","eyeLookInRight","eyeLookInLeft","eyeLookOutRight"];
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const cats = () => Array.from({ length: 52 }, (_, i) => ({ categoryName: NAMES[i] ?? "x" + i, score: rnd() * 0.5, index: i, displayName: "" }));
const face = () => { const L = Array.from({ length: 478 }, () => ({ x: .3 + rnd() * .4, y: .2 + rnd() * .5, z: 0 }));
  L[33] = { x: .4, y: .5, z: 0 }; L[263] = { x: .6, y: .5, z: 0 }; L[234] = { x: .3, y: .5, z: 0 }; L[454] = { x: .7, y: .5, z: 0 }; L[1] = { x: .5, y: .55, z: 0 }; L[10] = { x: .5, y: .2, z: 0 }; L[152] = { x: .5, y: .8, z: 0 }; return L; };
const hand = () => Array.from({ length: 21 }, (_, i) => ({ x: .3 + rnd() * .3, y: .4 + rnd() * .3, z: 0 }));
const mkFrame = (nh) => ({ fr: { faceBlendshapes: [{ categories: cats() }], faceLandmarks: [face()] }, hr: { landmarks: Array.from({ length: nh }, hand) } });
const features = (fr, hr, aspect) => {
  const bs = Object.fromEntries((fr.faceBlendshapes?.[0]?.categories || []).map((c) => [c.categoryName, c.score]));
  const lm = fr.faceLandmarks?.[0];
  return { ...faceFeatures(bs, lm), ...handFeatures(hr.landmarks || [], lm, aspect) };
};
const POOL = 512;
for (const nh of [0, 1, 2]) {
  const frames = Array.from({ length: POOL }, () => mkFrame(nh));
  const ch = createChooser(); let t = 0;
  const run = (n) => { for (let i = 0; i < n; i++) { const { fr, hr } = frames[i % POOL]; ch.step(features(fr, hr, 0.5625), (t += 33.3)); } };
  run(20000); // warm JIT
  const samples = [];
  for (let k = 0; k < 2000; k++) { const s = process.hrtime.bigint(); run(10); samples.push(Number(process.hrtime.bigint() - s) / 1e3 / 10); }
  samples.sort((a, b) => a - b);
  const q = (p) => samples[Math.floor(p * (samples.length - 1))].toFixed(1);
  console.log(`hands=${nh}: per-frame µs  median ${q(.5)}  p95 ${q(.95)}  p99 ${q(.99)}  max ${q(1)}   (${MEMES.length} memes)`);
}
// cold: first 200 frames before JIT warm-up
{
  const frames = Array.from({ length: 200 }, () => mkFrame(2)); const ch = createChooser(); const ts = []; let t = 0;
  for (const { fr, hr } of frames) { const s = process.hrtime.bigint(); ch.step(features(fr, hr, 0.5625), (t += 33.3)); ts.push(Number(process.hrtime.bigint() - s) / 1e3); }
  console.log(`cold (2 hands) first frame ${ts[0].toFixed(0)} µs, frames 2-10 mean ${(ts.slice(1, 10).reduce((a, b) => a + b) / 9).toFixed(0)} µs, frames 100-200 mean ${(ts.slice(100).reduce((a, b) => a + b) / 100).toFixed(0)} µs`);
}
// piece breakdown, 2 hands
{
  const frames = Array.from({ length: POOL }, () => mkFrame(2)); const N = 100000; const T = (f) => { const s = process.hrtime.bigint(); for (let i = 0; i < N; i++) f(frames[i % POOL], i); return Number(process.hrtime.bigint() - s) / 1e3 / N; };
  const ch = createChooser(); let t = 0; const F = frames.map(({ fr, hr }) => features(fr, hr, .5625));
  T((f) => features(f.fr, f.hr, .5625));
  console.log("breakdown µs/frame:",
    "blendshape->object", T((f) => Object.fromEntries(f.fr.faceBlendshapes[0].categories.map((c) => [c.categoryName, c.score]))).toFixed(2),
    "| handFeatures(2)", T((f) => handFeatures(f.hr.landmarks, f.fr.faceLandmarks[0], .5625)).toFixed(2),
    "| chooser.step", T((f, i) => ch.step(F[i % POOL], (t += 33.3))).toFixed(2));
}
