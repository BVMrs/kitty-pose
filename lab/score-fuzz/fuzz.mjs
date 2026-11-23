// Property fuzz of MEMES[].score over random blendshape vectors (no hands) and random hand flags.
import { MEMES, faceFeatures, handFeatures } from "../../memes.js";
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const NAMES = ["jawOpen","eyeWideLeft","eyeWideRight","eyeBlinkLeft","eyeBlinkRight","eyeSquintLeft","eyeSquintRight","mouthSmileLeft","mouthSmileRight","mouthFrownLeft","mouthFrownRight","browInnerUp","browOuterUpLeft","browOuterUpRight","browDownLeft","browDownRight","eyeLookOutLeft","eyeLookInRight","eyeLookInLeft","eyeLookOutRight"];
const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
const mk = (roll, yaw) => { // synth landmarks giving roll (deg) and yaw (-1..1)
  const L = lm.map((p) => ({ ...p })); const r = roll * Math.PI / 180;
  L[33] = { x: .4, y: .5 }; L[263] = { x: .4 + .2 * Math.cos(r), y: .5 + .2 * Math.sin(r) };
  L[234] = { x: .3, y: .5 }; L[454] = { x: .7, y: .5 }; L[1] = { x: .5 + yaw * .2, y: .55 }; return L; };
const noHand = handFeatures([], null);
const HF = ["thumbsUp","pointing","openPalm","fist","shaka"];
const N = 200000, bad = [], win = {}, co = {}; let multi = 0, outOfRange = {};
const sparse = () => { const b = {}; const k = 1 + Math.floor(rnd() * 5); for (let i = 0; i < k; i++) b[NAMES[Math.floor(rnd() * NAMES.length)]] = rnd(); return b; };
for (let i = 0; i < N; i++) {
  const b = sparse(); const f = faceFeatures(b, mk((rnd() - .5) * 60, (rnd() - .5) * 1.4));
  const hf = { ...noHand }; const hand = rnd() < .3;
  if (hand) { hf.anyHand = 1; hf[HF[Math.floor(rnd() * 5)]] = 1; if (hf.thumbsUp || hf.shaka) hf.pointing = 0; hf.handAtChin = rnd() < .3 ? rnd() : 0; }
  const F = { ...f, ...hf };
  const sc = MEMES.map((m) => [m.id, m.score(F)]);
  for (const [id, s] of sc) if (!(Number.isFinite(s) && s >= 0 && s <= 1)) { outOfRange[id] = (outOfRange[id] || 0) + 1; if (bad.length < 5) bad.push([id, s]); }
  const strong = sc.filter(([id, s]) => id !== "stare" && s >= 0.6);
  if (strong.length > 1) multi++;
  for (let a = 0; a < strong.length; a++) for (let c = a + 1; c < strong.length; c++) { const k = strong[a][0] + "+" + strong[c][0]; co[k] = (co[k] || 0) + 1; }
  let best = "stare", bs = -1; for (const [id, s] of sc) if (s > bs) { bs = s; best = id; }
  if (bs < .35) best = "stare"; win[best] = (win[best] || 0) + 1;
}
console.log("outOfRange", outOfRange, bad);
console.log("frames with >=2 memes scoring >=0.6:", (100 * multi / N).toFixed(1) + "%");
console.log("top co-activations:", Object.entries(co).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${(100 * n / N).toFixed(1)}%`).join("; "));
console.log("winner share:", Object.entries(win).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(100 * n / N).toFixed(1)}`).join(", "));
// NaN / extreme feature inputs
const ext = [NaN, -5, 5, Infinity, undefined, null, "x"]; let nanBad = {};
for (const v of ext) { const F = { ...faceFeatures({}, mk(0, 0)), ...noHand }; for (const k of Object.keys(F)) { if (k === "face") continue; const G = { ...F, [k]: v };
  for (const m of MEMES) { const s = m.score(G); if (!(Number.isFinite(s) && s >= 0 && s <= 1)) { const key = `${k}=${String(v)}`; (nanBad[key] ||= new Set()).add(m.id); } } } }
console.log("bad score under bad feature (feature=value -> memes):");
for (const [k, s] of Object.entries(nanBad)) console.log(" ", k, [...s].join(","));
