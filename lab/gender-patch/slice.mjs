// Per-gender / per-hand-size recall of the iso-resweep candidate threshold sets (true-aspect coords).
// usage: node slice.mjs <annotations test dir> <sizes dir>   (A0 imputed from the true-size pool where not sampled, seeded)
import fs from "node:fs";
const [dir, sdir] = process.argv.slice(2);
const MAP = { like: "thumbsUp", call: "shaka", fist: "fist", one: "pointing", palm: "openPalm", stop: "openPalm" };
const G = ["thumbsUp", "shaka", "fist", "pointing", "openPalm"];
let seed = 777; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const known = {}, pool = [];
for (const cls of Object.keys(MAP)) for (const it of JSON.parse(fs.readFileSync(`${sdir}/${cls}.json`)).items) {
  const [w, h] = it.orient >= 5 ? [it.h, it.w] : [it.w, it.h]; known[it.id] = w / h; pool.push(w / h); }
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const hands = [];
for (const cls of Object.keys(MAP)) {
  const j = JSON.parse(fs.readFileSync(`${dir}/${cls}.json`));
  for (const k in j) { const e = j[k]; if (e.labels.filter((l) => l === cls).length !== 1) continue;
    const i = e.labels.indexOf(cls), lm = e.hand_landmarks?.[i]; if (!lm || lm.length !== 21) continue;
    const A0 = known[k] ?? pool[Math.floor(rnd() * pool.length)];
    const h = lm.map(([x, y]) => ({ x: x * A0, y })), r = (t, p) => d(h[t], h[0]) / d(h[p], h[0]);
    const m = e.meta || {}, size = d(h[0], h[9]);
    hands.push({ cls, known: k in known, gender: m.gender?.[i] ?? m.gender?.[0] ?? "?", size: size < 0.05 ? "<.05" : size < 0.08 ? ".05-.08" : size < 0.12 ? ".08-.12" : ">=.12",
      ext: [r(8, 6), r(12, 10), r(16, 14), r(20, 18)], t1: d(h[4], h[9]) / d(h[3], h[9]), t2: d(h[4], h[5]) / d(h[0], h[5]), up: (h[2].y - h[4].y) / d(h[0], h[9]) }); }
}
const BASE = { ext: 1.12, t1: 1.1, t2: 0.55, up: 0.35, palmNoThumb: false, shakaThumb: null };
const SETS = { master: BASE, "shaka.2 up.25": { ...BASE, shakaThumb: 0.2, up: 0.25 }, "shaka.3 up.25": { ...BASE, shakaThumb: 0.3, up: 0.25 },
  "grid t2.35 shaka.1 up.15 ext1.0 t1 1.0": { ext: 1.0, t1: 1.0, t2: 0.35, up: 0.15, palmNoThumb: false, shakaThumb: 0.1 } };
function pred(x, p) {
  const [i, m, r, pk] = x.ext.map((v) => v > p.ext), thumb = x.t1 > p.t1 && x.t2 > p.t2;
  const curled = [i, m, r, pk].filter((v) => !v).length, out = {};
  if (thumb && x.up > p.up && curled === 4) out.thumbsUp = 1;
  else if ((p.shakaThumb != null ? x.t1 > p.t1 && x.t2 > p.shakaThumb : thumb) && pk && !i && !m && !r) out.shaka = 1;
  else if (curled === 4) out.fist = 1;
  if (i && !m && !r && !pk && !out.thumbsUp && !out.shaka) out.pointing = 1;
  if (i && m && r && pk && (thumb || p.palmNoThumb)) out.openPalm = 1;
  return G.find((g) => out[g]) || "none";
}
const rec = (p, f) => { const o = {}; for (const g of G) { const s = hands.filter((x) => MAP[x.cls] === g && f(x)); o[g] = s.length ? s.filter((x) => pred(x, p) === g).length / s.length : NaN; o["n_" + g] = s.length; } return o; };
console.log("hands", hands.length, "gender counts", JSON.stringify(Object.fromEntries(["female", "male", "?"].map((g) => [g, hands.filter((x) => x.gender === g).length]))));
for (const [name, p] of Object.entries(SETS)) {
  console.log("\n##", name);
  for (const [lab, f] of [["all", () => true], ["female", (x) => x.gender === "female"], ["male", (x) => x.gender === "male"],
    ["male >=.12", (x) => x.gender === "male" && x.size === ">=.12"], ["female >=.12", (x) => x.gender === "female" && x.size === ">=.12"], ["size >=.12", (x) => x.size === ">=.12"], ["true-A0 only", (x) => x.known], ["known female", (x) => x.known && x.gender === "female"], ["known male", (x) => x.known && x.gender === "male"], ["known >=.12", (x) => x.known && x.size === ">=.12"], ["known <.12", (x) => x.known && x.size !== ">=.12"]]) {
    const r = rec(p, f); console.log(lab.padEnd(14), G.map((g) => `${g} ${(100 * r[g]).toFixed(1)}(${r["n_" + g]})`).join("  "));
  }
}
