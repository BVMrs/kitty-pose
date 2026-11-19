// Which meme would the app pick for each HaGRID class? Steady state, neutral face, no EMA/dwell.
// Usage: node sim.mjs <test-dir>   (test-dir = HaGRIDv2 annotations/test JSONs, see lab/hagrid-annotations)
import fs from "node:fs";
import { MEMES, handFeatures, faceFeatures } from "../../memes.js";
const dir = process.argv[2];
const neutral = faceFeatures({}, null); neutral.face = true;       // a face is present, no expression
const pick = (f) => {
  let best = "stare", bs = -1;
  for (const m of MEMES) { const s = m.score(f); if (s > bs) { bs = s; best = m.id; } }
  return bs < 0.35 ? "stare" : best;                               // choose()'s floor
};
const res = {};
for (const fn of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const cls = fn.replace(".json", "");
  const j = JSON.parse(fs.readFileSync(`${dir}/${fn}`));
  const r = (res[cls] = { n: 0, picks: {} });
  for (const k in j) {
    const e = j[k]; if (!e.labels.includes(cls)) continue;
    const hands = (e.hand_landmarks || []).filter((h) => h && h.length === 21).map((h) => h.map(([x, y]) => ({ x, y })));
    if (!hands.length) continue;
    const p = pick({ ...neutral, ...handFeatures(hands, null) });
    r.n++; r.picks[p] = (r.picks[p] || 0) + 1;
  }
}
for (const [c, r] of Object.entries(res)) {
  const top = Object.entries(r.picks).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m, n]) => `${m} ${(100 * n / r.n).toFixed(0)}%`);
  console.log(c.padEnd(16), String(r.n).padStart(5), top.join(", "));
}
const tot = {}; let N = 0;
for (const r of Object.values(res)) { N += r.n; for (const [m, n] of Object.entries(r.picks)) tot[m] = (tot[m] || 0) + n; }
console.log("ALL", N, Object.entries(tot).sort((a,b)=>b[1]-a[1]).map(([m,n])=>`${m} ${(100*n/N).toFixed(1)}%`).join(", "));
