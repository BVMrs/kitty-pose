// One hand holds a pose, the other hand is also in frame (relaxed fist, open palm, pointing, same pose).
// Real HaGRID test hands placed either side of a synthetic face; real MEMES scores, steady-state argmax, 0.35 floor.
// Usage: node sim.mjs <hagrid test dir> [aspect, default 0.5625]
import fs from "node:fs";
import { MEMES, handFeatures, faceFeatures } from "../../memes.js";
const dir = process.argv[2], aspect = Number(process.argv[3] || 0.5625);
const neutral = { ...faceFeatures({}, null), face: true };
const pick = (f) => { let b = "stare", bs = -1; for (const m of MEMES) { const s = m.score(f); if (s > bs) { bs = s; b = m.id; } } return bs < 0.35 ? "stare" : b; };
const load = (cls, n = 300) => { const j = JSON.parse(fs.readFileSync(`${dir}/${cls}.json`)); const hs = [];
  for (const k in j) { const e = j[k]; if (e.labels.length !== 1 || e.labels[0] !== cls) continue; const h = (e.hand_landmarks || []).filter((h) => h && h.length === 21); if (h.length === 1) hs.push(h[0].map(([x, y]) => ({ x, y }))); if (hs.length >= 3000) break; }
  return hs.filter((_, i) => i % Math.floor(hs.length / n) === 0).slice(0, n); };
// wrist at (wx,wy), scaled by k (HaGRID hands are small; selfie ~1.5)
const place = (h, wx, wy, k, mirror) => h.map((p) => ({ x: wx + (mirror ? -1 : 1) * (p.x - h[0].x) * k / aspect * aspect, y: wy + (p.y - h[0].y) * k }));
const K = 1.5;
const face = []; face[10] = { x: .5, y: .30 }; face[152] = { x: .5, y: .62 };
const cls = { thumbs: "like", shaka: "call", point: "one", palm: "palm", fist: "fist" };
const H = Object.fromEntries(Object.entries(cls).map(([k, c]) => [k, load(c)]));
const want = { thumbs: "thumbs", shaka: "shaka", point: "point", palm: "stop", fist: "fistbump" };
// gesture hand at the right of frame at chest height; incidental hand on the left, at same height ("second hand in view")
console.log(`aspect ${aspect}, hand scale ${K}; shown meme (steady state, neutral face); 300 pairs each`);
console.log("main pose + other hand -> % main meme | top other results");
for (const main of Object.keys(H)) for (const other of Object.keys(H)) {
  const cnt = {}; const n = H[main].length;
  for (let i = 0; i < n; i++) {
    const a = place(H[main][i], .7, .85, K, false), b = place(H[other][(i * 7 + 3) % H[other].length], .3, .85, K, true);
    const f = { ...neutral, ...handFeatures([a, b], face, aspect) }; const w = pick(f); cnt[w] = (cnt[w] || 0) + 1;
  }
  const alone = {}; for (let i = 0; i < n; i++) { const w = pick({ ...neutral, ...handFeatures([place(H[main][i], .7, .85, K, false)], face, aspect) }); alone[w] = (alone[w] || 0) + 1; }
  const fmt = (c) => Object.entries(c).sort((p, q) => q[1] - p[1]).slice(0, 3).map(([k, v]) => `${k} ${(100 * v / n).toFixed(0)}%`).join(", ");
  console.log(`${main.padEnd(6)} + ${other.padEnd(6)} | alone: ${fmt(alone).padEnd(34)} | pair: ${fmt(cnt)}`);
}
