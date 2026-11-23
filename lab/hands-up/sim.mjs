// Reachability + false triggers of handsUp/yippee. Real HaGRID palm/fist/like hands, rigidly placed.
// Usage: node sim.mjs <hagrid test dir> [aspect, default 0.5625]
import fs from "node:fs";
import { MEMES, handFeatures, faceFeatures } from "../../memes.js";
const dir = process.argv[2], aspect = Number(process.argv[3] || 0.5625);
const neutral = { ...faceFeatures({}, null), face: true };
const pick = (f) => { let b = "stare", bs = -1; for (const m of MEMES) { const s = m.score(f); if (s > bs) { bs = s; b = m.id; } } return bs < 0.35 ? "stare" : b; };
const load = (cls, n = 300) => { const j = JSON.parse(fs.readFileSync(`${dir}/${cls}.json`)); const hs = [];
  for (const k in j) { const e = j[k]; if (e.labels.length !== 1 || e.labels[0] !== cls) continue; const h = (e.hand_landmarks || []).filter((h) => h && h.length === 21); if (h.length === 1) hs.push(h[0].map(([x, y]) => ({ x, y }))); if (hs.length >= 3000) break; }
  return hs.filter((_, i) => i % Math.floor(hs.length / n) === 0).slice(0, n); };
const ext = (h) => { const ys = h.map((p) => p.y); return { len: Math.max(...ys) - Math.min(...ys), up: h[0].y - Math.min(...ys) }; }; // wrist-to-highest-point (frame heights)
const place = (h, wx, wy) => { const dx = wx - h[0].x, dy = wy - h[0].y; return h.map((p) => ({ x: p.x + dx, y: p.y + dy })); };
// A: how much headroom (forehead-top y) a raised hand needs so every landmark stays in frame (y>=0)
for (const cls of ["palm", "like", "fist"]) {
  const hs = load(cls), u = hs.map((h) => ext(h).up).sort((a, b) => a - b);
  const q = (p) => u[Math.floor(p * (u.length - 1))].toFixed(3);
  console.log(`${cls}: wrist->highest landmark (frame heights, native size) p10 ${q(.1)} p50 ${q(.5)} p90 ${q(.9)}`);
}
// B: yippee rate for two copies (mirrored x) of an upright palm, wrists at y=wy, face top at topY (face h .32); full-in-frame or not
const palms = load("palm");
console.log(`\naspect ${aspect}. Two open palms, wrist y relative to forehead-top (face top y=.30); shown meme:`);
for (const dy of [0.02, 0.0, -0.02, -0.05, -0.1]) { // wrist y = topY - dy -> dy>0 means wrist above forehead by dy
  const top = { x: .5, y: .30 }, chin = { x: .5, y: .62 }, face = []; face[10] = top; face[152] = chin;
  const cnt = {}; let inFrame = 0;
  for (const h of palms) {
    const a = place(h, .3, top.y - dy), b = place(h.map((p) => ({ x: 1 - p.x, y: p.y })), .7, top.y - dy);
    const hf = handFeatures([a, b], face, aspect); const w = pick({ ...neutral, ...hf }); cnt[w] = (cnt[w] || 0) + 1;
    if (Math.min(...a.map((p) => p.y)) >= 0) inFrame++;
  }
  console.log(`  wrists ${dy >= 0 ? "above" : "below"} forehead by ${Math.abs(dy).toFixed(2)}: in-frame ${(100*inFrame/palms.length).toFixed(0)}%  ` + Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(100*n/palms.length).toFixed(0)}%`).join(", "));
}
// C: for each face top y, what share of palms can be both above the forehead (wrist y < top) and fully in frame?
console.log("\nforehead-top y -> share of HaGRID palms whose wrist can be above forehead AND fingertips in frame");
for (const t of [.1, .15, .2, .25, .3, .35, .4]) { const ok = palms.filter((h) => ext(h).up < t - 0.0).length; console.log(`  top y ${t.toFixed(2)}: ${(100*ok/palms.length).toFixed(0)}%`); }
// D: false triggers: two hands in any pose at/above forehead height beside the head (hands on head, wave, 2 fists up)
for (const cls of ["fist", "like", "palm"]) {
  const hs = load(cls, 200); const top = { x: .5, y: .30 }, chin = { x: .5, y: .62 }, face = []; face[10] = top; face[152] = chin;
  const cnt = {};
  for (const h of hs) { const a = place(h, .3, .25), b = place(h.map((p) => ({ x: 1 - p.x, y: p.y })), .7, .25); const w = pick({ ...neutral, ...handFeatures([a, b], face, aspect) }); cnt[w] = (cnt[w] || 0) + 1; }
  console.log(`two ${cls} wrists at y=.25 (forehead .30): ` + Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(100*n/hs.length).toFixed(0)}%`).join(", "));
}
