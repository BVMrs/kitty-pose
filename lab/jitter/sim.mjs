// Landmark-jitter robustness: add Gaussian noise (sigma = frac * hand size |h0-h9|) to HaGRID landmarks and measure how
// often the picked meme differs from the noise-free pick. Steady state, neutral face. Seeded, deterministic.
// Usage: node sim.mjs <test-dir> [perClass=300] [draws=20]
import fs from "node:fs";
import { MEMES, handFeatures, faceFeatures } from "../../memes.js";
const dir = process.argv[2], PER = +(process.argv[3] || 300), DRAWS = +(process.argv[4] || 20);
const SIGMAS = [0.01, 0.02, 0.04, 0.08];
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const neutral = faceFeatures({}, null); neutral.face = true;
const pick = (hands) => {
  const f = { ...neutral, ...handFeatures(hands, null) }; let b = "stare", bs = -1;
  for (const m of MEMES) { const s = m.score(f); if (s > bs) { bs = s; b = m.id; } }
  return bs < 0.35 ? "stare" : b;
};
const out = {};
for (const fn of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const cls = fn.replace(".json", ""), j = JSON.parse(fs.readFileSync(`${dir}/${fn}`));
  const r = (out[cls] = { n: 0, agree: SIGMAS.map(() => 0), unstable: SIGMAS.map(() => 0), tot: 0 });
  for (const k in j) {
    if (r.n >= PER) break;
    const e = j[k]; if (!e.labels.includes(cls)) continue;
    const hands = (e.hand_landmarks || []).filter((h) => h && h.length === 21).map((h) => h.map(([x, y]) => ({ x, y })));
    if (!hands.length) continue;
    const base = pick(hands); r.n++;
    SIGMAS.forEach((sg, si) => {
      let same = 0;
      for (let d = 0; d < DRAWS; d++) {
        const nh = hands.map((h) => { const s = Math.hypot(h[0].x - h[9].x, h[0].y - h[9].y) * sg;
          return h.map((p) => ({ x: p.x + gauss() * s, y: p.y + gauss() * s })); });
        if (pick(nh) === base) same++;
      }
      r.agree[si] += same / DRAWS; if (same / DRAWS < 0.9) r.unstable[si]++;
    });
  }
}
console.log("sigma (frac of hand size):", SIGMAS.join(" "));
console.log("class            n   mean agreement with noise-free pick (%)   |  images with <90% agreement (%)");
const T = { n: 0, a: SIGMAS.map(() => 0), u: SIGMAS.map(() => 0) };
for (const [c, r] of Object.entries(out)) {
  if (!r.n) continue; T.n += r.n; r.agree.forEach((a, i) => { T.a[i] += a; T.u[i] += r.unstable[i]; });
  console.log(c.padEnd(16), String(r.n).padStart(4), r.agree.map((a) => (100 * a / r.n).toFixed(1).padStart(6)).join(""), "  |", r.unstable.map((u) => (100 * u / r.n).toFixed(1).padStart(6)).join(""));
}
console.log("ALL".padEnd(16), String(T.n).padStart(4), T.a.map((a) => (100 * a / T.n).toFixed(1).padStart(6)).join(""), "  |", T.u.map((u) => (100 * u / T.n).toFixed(1).padStart(6)).join(""));
