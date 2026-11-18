// Score handFeatures() on HaGRIDv2 test landmarks, one hand at a time. Usage: node eval.mjs <test-dir>
import fs from "node:fs";
import { handFeatures } from "../../memes.js";
const dir = process.argv[2];
const MAP = { like: "thumbsUp", call: "shaka", fist: "fist", one: "pointing", palm: "openPalm", stop: "openPalm" };
const G = ["thumbsUp", "shaka", "fist", "pointing", "openPalm"];
const pred = (h) => { const f = handFeatures([h], null); return G.find((g) => f[g]) || "none"; };
const conf = {}; let skipped = 0, noLm = 0;
for (const fn of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const cls = fn.replace(".json", "");
  const j = JSON.parse(fs.readFileSync(`${dir}/${fn}`));
  for (const k in j) {
    const e = j[k], L = e.hand_landmarks || [];
    e.labels.forEach((lab, i) => {
      if (lab !== cls) return;                  // per-hand label; two-hand classes are scored too
      const h = L[i]; if (!h || h.length !== 21) { noLm++; return; }
      const hh = h.map(([x, y]) => ({ x, y }));
      const t = MAP[lab] || "none"; const p = pred(hh);
      ((conf[lab] ||= {})[p] ||= 0); conf[lab][p]++;
    });
  }
}
console.log(JSON.stringify({ conf, noLm }, null, 1));
const cols = [...G, "none"];
const pr = {};
for (const g of G) {
  const tp = Object.entries(conf).filter(([l]) => MAP[l] === g).reduce((a, [, r]) => a + (r[g] || 0), 0);
  const n = Object.entries(conf).filter(([l]) => MAP[l] === g).reduce((a, [, r]) => a + cols.reduce((s, c) => s + (r[c] || 0), 0), 0);
  const fp = Object.entries(conf).filter(([l]) => MAP[l] !== g).reduce((a, [, r]) => a + (r[g] || 0), 0);
  pr[g] = { n, recall: +(tp / n).toFixed(3), precision: +(tp / (tp + fp)).toFixed(3) };
}
console.log(pr);
const un = Object.entries(conf).filter(([l]) => !MAP[l]);
let tot = 0, trig = 0; for (const [, r] of un) for (const c of cols) { tot += r[c] || 0; if (c !== "none") trig += r[c] || 0; }
console.log({ unmappedHands: tot, falseTrigger: +(trig / tot).toFixed(3) });
const worst = un.map(([l, r]) => [l, +(1 - (r.none || 0) / cols.reduce((s, c) => s + (r[c] || 0), 0)).toFixed(2), Object.entries(r).sort((a,b)=>b[1]-a[1])[0]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log("worst unmapped (class, trigger rate):", JSON.stringify(worst));
