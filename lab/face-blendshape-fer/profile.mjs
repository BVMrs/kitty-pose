// Usage: node profile.mjs <blends_*_full_set.csv>   (53 cols: 52 MediaPipe blendshapes in canonical order + class)
import { readFileSync } from "node:fs";
import { faceFeatures, MEMES } from "../../memes.js";
const NAMES = ["_neutral","browDownLeft","browDownRight","browInnerUp","browOuterUpLeft","browOuterUpRight","cheekPuff","cheekSquintLeft","cheekSquintRight","eyeBlinkLeft","eyeBlinkRight","eyeLookDownLeft","eyeLookDownRight","eyeLookInLeft","eyeLookInRight","eyeLookOutLeft","eyeLookOutRight","eyeLookUpLeft","eyeLookUpRight","eyeSquintLeft","eyeSquintRight","eyeWideLeft","eyeWideRight","jawForward","jawLeft","jawOpen","jawRight","mouthClose","mouthDimpleLeft","mouthDimpleRight","mouthFrownLeft","mouthFrownRight","mouthFunnel","mouthLeft","mouthLowerDownLeft","mouthLowerDownRight","mouthPressLeft","mouthPressRight","mouthPucker","mouthRight","mouthRollLower","mouthRollUpper","mouthShrugLower","mouthShrugUpper","mouthSmileLeft","mouthSmileRight","mouthStretchLeft","mouthStretchRight","mouthUpperUpLeft","mouthUpperUpRight","noseSneerLeft","noseSneerRight"];
const rows = readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) => l.split(",").map(Number));
const faceMemes = MEMES.filter((m) => ["pop","shocked","close-stare","hiss","crying","smile","smug","side-eye","lookaway","huh","sleepy","stare"].includes(m.id));
const by = {};
for (const r of rows) {
  const cls = r[52], b = Object.fromEntries(NAMES.map((n, i) => [n, r[i]]));
  const f = { ...faceFeatures(b, null), face: true, pointing:0,fist:0,anyHand:0,handAtChin:0,thumbsUp:0,shaka:0,openPalm:0,twoPalms:0,handsUp:0 };
  const s = faceMemes.map((m) => [m.id, m.score(f)]).sort((a, b) => b[1] - a[1])[0];
  const c = (by[cls] ??= { n: 0, sum: {}, win: {} });
  c.n++;
  for (const k of ["jawOpen","smile","frown","browInnerUp","browDown","eyeWide","squint","blink"]) c.sum[k] = (c.sum[k] || 0) + f[k];
  c.win[s[0]] = (c.win[s[0]] || 0) + 1;
}
for (const [cls, c] of Object.entries(by)) {
  console.log(`class ${cls}  n=${c.n}`);
  console.log("  mean:", Object.entries(c.sum).map(([k, v]) => `${k}=${(v / c.n).toFixed(2)}`).join(" "));
  console.log("  winning meme %:", Object.entries(c.win).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / c.n).toFixed(0)}`).join(", "));
}
// Smile trigger operating point (score >= 0.5), per class
const sm = MEMES.find((m) => m.id === "smile");
const hit = {}, tot = {};
for (const r of rows) {
  const b = Object.fromEntries(NAMES.map((n, i) => [n, r[i]]));
  const f = { ...faceFeatures(b, null), pointing: 0 };
  tot[r[52]] = (tot[r[52]] || 0) + 1;
  if (sm.score(f) >= 0.5) hit[r[52]] = (hit[r[52]] || 0) + 1;
}
console.log("smile>=0.5 rate per class:", Object.keys(tot).map((k) => `${k}: ${((hit[k] || 0) / tot[k] * 100).toFixed(1)}%`).join("  "));
