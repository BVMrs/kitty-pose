// Same question with selfie-size hands: scale HaGRID hands about the wrist, then headroom needed and who wins when cheering.
// Usage: node scale.mjs <hagrid test dir>
import fs from "node:fs";
import { MEMES, handFeatures, faceFeatures } from "../../memes.js";
const dir = process.argv[2], aspect = 0.5625;
const neutral = { ...faceFeatures({}, null), face: true };
const score = (f) => MEMES.map((m) => [m.id, m.score(f)]);
const pick = (f) => { let b = "stare", bs = -1; for (const [id, s] of score(f)) if (s > bs) { bs = s; b = id; } return bs < 0.35 ? "stare" : b; };
const load = (cls, n = 300) => { const j = JSON.parse(fs.readFileSync(`${dir}/${cls}.json`)); const hs = [];
  for (const k in j) { const e = j[k]; if (e.labels.length !== 1 || e.labels[0] !== cls) continue; const h = (e.hand_landmarks || []).filter((h) => h && h.length === 21); if (h.length === 1) hs.push(h[0].map(([x, y]) => ({ x, y }))); if (hs.length >= 3000) break; }
  return hs.filter((_, i) => i % Math.floor(hs.length / n) === 0).slice(0, n); };
const place = (h, wx, wy, k, mirror) => h.map((p) => ({ x: wx + (mirror ? -1 : 1) * (p.x - h[0].x) * k, y: wy + (p.y - h[0].y) * k }));
const palms = load("palm"), fists = load("fist");
const face = []; face[10] = { x: .5, y: .30 }; face[152] = { x: .5, y: .62 };
console.log("share of palms whose raised hand (wrist above forehead, top y .30) stays fully in frame, by hand scale k (1 = HaGRID size)");
for (const k of [1, 1.5, 2, 2.5]) {
  const ok = palms.filter((h) => { const up = h[0].y - Math.min(...h.map((p) => p.y)); return up * k <= .30 - 0.0; }).length;
  const need = palms.map((h) => (h[0].y - Math.min(...h.map((p) => p.y))) * k).sort((a, b) => a - b);
  console.log(`  k=${k}: in frame ${(100 * ok / palms.length).toFixed(0)}% ; median headroom needed above the wrist ${need[150].toFixed(2)}`);
}
console.log("\ncheering pairs, wrists at y=.20 (forehead .30), k=1.5, hands mirrored; mean scores of yippee vs winner, and shown meme");
for (const [name, a, b] of [["palm+palm", palms, palms], ["fist+fist", fists, fists], ["palm+fist", palms, fists]]) {
  const cnt = {}; let y = 0, n = 0;
  for (let i = 0; i < a.length; i++) {
    const hf = handFeatures([place(a[i], .3, .2, 1.5, false), place(b[i], .7, .2, 1.5, true)], face, aspect);
    const f = { ...neutral, ...hf }; const w = pick(f); cnt[w] = (cnt[w] || 0) + 1; y += hf.handsUp; n++;
  }
  console.log(`  ${name}: handsUp ${(100*y/n).toFixed(0)}%; shown ` + Object.entries(cnt).sort((p, q) => q[1] - p[1]).map(([k, c]) => `${k} ${(100*c/n).toFixed(0)}%`).join(", "));
}
