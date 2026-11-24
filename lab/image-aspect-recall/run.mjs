// Join sampled true HaGRID image sizes (lab/image-aspect2/out) to landmarks; score handFeatures with the TRUE per-image aspect.
// usage: node run.mjs <annotations test dir> <sizes dir>
import fs from "node:fs";
import { handFeatures } from "../../memes.js";
const [adir, sdir] = process.argv.slice(2);
const MAP = { like: "thumbsUp", call: "shaka", fist: "fist", one: "pointing", palm: "openPalm", stop: "openPalm" };
const G = ["thumbsUp", "shaka", "fist", "pointing", "openPalm"];
const hands = [];
const dist = {};
for (const cls of Object.keys(MAP)) {
  const sz = JSON.parse(fs.readFileSync(`${sdir}/${cls}.json`)).items, ann = JSON.parse(fs.readFileSync(`${adir}/${cls}.json`));
  for (const it of sz) {
    const e = ann[it.id]; if (!e) continue;
    const [w, h] = it.orient >= 5 ? [it.h, it.w] : [it.w, it.h];
    const A0 = w / h;
    e.labels.forEach((l, i) => { const lm = e.hand_landmarks?.[i]; if (l === cls && lm?.length === 21) hands.push({ cls, lm, A0 }); });
    const b = A0 < 0.7 ? "<.7" : A0 < 0.8 ? ".7-.8 (3:4)" : A0 < 1.2 ? ".8-1.2" : A0 < 1.5 ? "1.2-1.5 (4:3)" : ">=1.5 (16:9)";
    dist[b] = (dist[b] || 0) + 1;
  }
}
console.log(hands.length, "hands; A0 buckets:", dist);
const pred = (h, a) => { const f = handFeatures([h], null, a); return G.find((g) => f[g]) || "none"; };
const iso = (lm, A0, A) => lm.map(([x, y]) => ({ x: (x * A0) / A, y }));
const recall = (sel, fn) => { const n = {}, ok = {}; for (const h of hands) { if (!sel(h)) continue; const g = MAP[h.cls]; n[g] = (n[g] || 0) + 1; if (pred(...fn(h)) === g) ok[g] = (ok[g] || 0) + 1; } return Object.fromEntries(G.map((g) => [g, n[g] ? +((ok[g] || 0) / n[g]).toFixed(3) : null])); };
const all = () => true;
const rows = {
  "raw normalised, no aspect (M1 eval)": recall(all, (h) => [h.lm.map(([x, y]) => ({ x, y })), undefined]),
  "true isotropic, aspect=A0 (correct code, src frame)": recall(all, (h) => [iso(h.lm, h.A0, h.A0), h.A0]),
  "9:16 phone, no aspect (today's app)": recall(all, (h) => [iso(h.lm, h.A0, 9 / 16), undefined]),
  "9:16 phone, aspect=9/16": recall(all, (h) => [iso(h.lm, h.A0, 9 / 16), 9 / 16]),
  "3:4 phone, no aspect": recall(all, (h) => [iso(h.lm, h.A0, 3 / 4), undefined]),
  "3:4 phone, aspect=3/4": recall(all, (h) => [iso(h.lm, h.A0, 3 / 4), 3 / 4]),
  "4:3 frame, aspect=4/3": recall(all, (h) => [iso(h.lm, h.A0, 4 / 3), 4 / 3]),
  "raw, portrait-source only (A0<.8)": recall((h) => h.A0 < 0.8, (h) => [h.lm.map(([x, y]) => ({ x, y })), undefined]),
  "raw, landscape-source only (A0>=1.2)": recall((h) => h.A0 >= 1.2, (h) => [h.lm.map(([x, y]) => ({ x, y })), undefined]),
  "true iso, portrait-source only": recall((h) => h.A0 < 0.8, (h) => [iso(h.lm, h.A0, h.A0), h.A0]),
  "true iso, landscape-source only": recall((h) => h.A0 >= 1.2, (h) => [iso(h.lm, h.A0, h.A0), h.A0]),
};
console.table(rows);
