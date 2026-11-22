// Property/fuzz test of createChooser(). Seeded. Usage: node fuzz.mjs [runs=2000]
import { MEMES, createChooser, handFeatures, faceFeatures } from "../../memes.js";
const RUNS = +(process.argv[2] || 2000);
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const ids = new Set(MEMES.map((m) => m.id));
const FK = ["jawOpen","eyeWide","blink","squint","smile","frown","browInnerUp","browUp","browDown","gazeSide","roll","yaw",
 "thumbsUp","pointing","openPalm","twoPalms","fist","shaka","handAtChin","handsUp","anyHand"];
const rf = () => { const f = { face: rnd() < 0.95 };
  for (const k of FK) f[k] = rnd() < 0.6 ? 0 : (k === "roll" ? (rnd() - .5) * 90 : k === "yaw" ? rnd() * 2 - 1 : rnd() < .5 ? rnd() : (rnd() < .5 ? 1 : 0));
  return f; };
const bad = { invalidId: 0, emaOutOfRange: 0, fastSwitch: 0, staleGapSwitch: 0, stuck: 0, throws: 0 };
const ex = {};
let switches = 0, frames = 0;
for (let r = 0; r < RUNS; r++) {
  const c = createChooser(); let now = 1000, f = rf(), last = now, segLeft = 0, ptsSince = null;
  for (let i = 0; i < 300; i++) {
    if (segLeft-- <= 0) { f = rf(); segLeft = 1 + Math.floor(rnd() * 40); }
    let dt = 16 + rnd() * 40; const u = rnd();
    if (u < 0.01) dt = 20000 + rnd() * 40000;       // tab hidden / camera stall
    else if (u < 0.02) dt = 0;                       // duplicate timestamp
    else if (u < 0.025) dt = -50;                    // clock going backwards
    now += dt;
    let g = f; const v = rnd();
    if (v < 0.01) g = { ...f, jawOpen: NaN, smile: undefined, anyHand: Infinity };
    let changed, prev = c.current;
    try { changed = c.step(g, now); } catch (e) { bad.throws++; ex.throws ??= e.message; break; }
    frames++;
    if (!ids.has(c.current)) { bad.invalidId++; }
    for (const k in c.ema) if (!(c.ema[k] >= 0 && c.ema[k] <= 1)) { bad.emaOutOfRange++; ex.ema ??= `${k}=${c.ema[k]}`; }
    if (changed !== (prev !== c.current)) bad.invalidId++;
    if (changed) { switches++; if (dt > 5000) { bad.staleGapSwitch++; ex.gap ??= `run ${r} frame ${i}: ${prev}->${c.current} after ${Math.round(dt)} ms gap on one frame`; } }
  }
}
// Deterministic probes
const probes = {};
{ // P1: one-frame blip after a long stall. Hold a pose A for 100 ms (pending), stall 30 s, then ONE frame of A.
  const neutral = { ...faceFeatures({}, null), face: true, ...handFeatures([], null) };
  const thumbs = { ...neutral, thumbsUp: 1, anyHand: 1 };
  const c = createChooser(); let t = 0;
  for (let i = 0; i < 6; i++) { c.step(thumbs, t); t += 33; }   // ema high, pending since ~t0
  probes.preStall = c.current;
  const cc = createChooser(); t = 0; cc.step(thumbs, t); t += 33; cc.step(thumbs, t); // pending set, ema 0.4*(1+.6)=0.64 -> pending
  t += 30000; const ch = cc.step(neutral, t);   // stall then a NEUTRAL frame
  probes.stallThenNeutralFrame = { changed: ch, current: cc.current };
  const c3 = createChooser(); t = 0; c3.step(thumbs, 0); c3.step(thumbs, 33); t = 30033;
  probes.stallThenSameFrame = { changed: c3.step(thumbs, t), current: c3.current };
}
{ // P2: backwards clock while pending
  const neutral = { ...faceFeatures({}, null), face: true, ...handFeatures([], null) };
  const thumbs = { ...neutral, thumbsUp: 1, anyHand: 1 };
  const c = createChooser(); for (let i = 0; i < 4; i++) c.step(thumbs, 10000 + i * 33);
  probes.afterFourFramesAt33ms = c.current;
  const d = createChooser(); let t = 10000; const hist = [];
  for (let i = 0; i < 40; i++) { d.step(thumbs, t); t += 33; hist.push(d.current); }
  probes.framesToThumbs = hist.indexOf("thumbs") + 1;
}
{ // P3: real face loss: face memes held then no face and no hand
  const smile = { ...faceFeatures({ mouthSmileLeft: 1, mouthSmileRight: 1 }, null), face: true, ...handFeatures([], null) };
  const c = createChooser(); let t = 0; for (let i = 0; i < 30; i++) { c.step(smile, t); t += 33; }
  probes.smileHeld = c.current;
  const gone = { ...faceFeatures({}, null), ...handFeatures([], null) }; let n = 0;
  while (c.current !== "stare" && n < 200) { c.step(gone, t); t += 33; n++; }
  probes.framesToStareAfterFaceLoss = n; probes.msToStare = n * 33;
}
console.log(JSON.stringify({ runs: RUNS, frames, switches, bad, examples: ex, probes }, null, 1));
