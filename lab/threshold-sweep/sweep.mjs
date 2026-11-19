// Offline threshold sweep for handFeatures on HaGRIDv2 test landmarks. Usage: node sweep.mjs <test-dir>
// Does not touch memes.js: a parametrised copy of fingerState/handFeatures (hand-only, no face), parity-checked.
import fs from "node:fs";
import { handFeatures } from "../../memes.js";
const dir = process.argv[2];
const MAP = { like: "thumbsUp", call: "shaka", fist: "fist", one: "pointing", palm: "openPalm", stop: "openPalm" };
const AMBIG = new Set(["dislike","xsign","thumb_index","thumb_index2","take_picture","mute","point","grip","timeout"]);
const CLEAN = new Set(["ok","peace","peace_inverted","rock","three","three2","three3","three_gun","two_up","two_up_inverted","stop_inverted","middle_finger"]);
const G = ["thumbsUp", "shaka", "fist", "pointing", "openPalm"];
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// load: per hand precompute everything the rules use
const hands = [];
for (const fn of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const cls = fn.replace(".json", "");
  const j = JSON.parse(fs.readFileSync(`${dir}/${fn}`));
  for (const k in j) {
    const e = j[k], L = e.hand_landmarks || [];
    e.labels.forEach((lab, i) => {
      if (lab !== cls) return;
      const h = L[i]; if (!h || h.length !== 21) return;
      const r = (t, p) => d(h[t], h[0]) / d(h[p], h[0]);
      const size = d(h[0], h[9]);
      hands.push({ cls, half: parseInt(k.slice(0, 4), 16) & 1, raw: h,
        ext: [r(8, 6), r(12, 10), r(16, 14), r(20, 18)],
        t1: d(h[4], h[9]) / d(h[3], h[9]), t2: d(h[4], h[5]) / d(h[0], h[5]),
        up: (h[2][1] - h[4][1]) / size });
    });
  }
}
console.error("hands", hands.length);
export const BASE = { ext: 1.12, t1: 1.1, t2: 0.55, up: 0.35, palmNoThumb: false, shakaThumb: null };
function pred(x, p) {
  const [i, m, r, pk] = x.ext.map((v) => v > p.ext);
  const thumb = x.t1 > p.t1 && x.t2 > p.t2;
  const curled = [i, m, r, pk].filter((v) => !v).length;
  const thumbUp = thumb && x.up > p.up;
  let out = {};
  if (thumbUp && curled === 4) out.thumbsUp = 1;
  else if ((p.shakaThumb ? x.t2 > p.shakaThumb : thumb) && pk && !i && !m && !r) out.shaka = 1;
  else if (curled === 4) out.fist = 1;
  if (i && !m && !r && !pk && !out.thumbsUp && !out.shaka) out.pointing = 1;
  if (i && m && r && pk && (thumb || p.palmNoThumb || (p.palmT2 != null && x.t2 > p.palmT2))) out.openPalm = 1;
  return G.find((g) => out[g]) || "none";
}
function score(p, filter = () => true) {
  const c = {}; for (const x of hands) { if (!filter(x)) continue; ((c[x.cls] ||= {})[pred(x, p)] ||= 0); c[x.cls][pred(x, p)]++; }
  const res = {};
  for (const g of G) {
    let tp = 0, n = 0;
    for (const [l, r] of Object.entries(c)) if (MAP[l] === g) { tp += r[g] || 0; n += Object.values(r).reduce((a, b) => a + b, 0); }
    res[g] = tp / n;
  }
  let t = 0, f = 0, ngT = 0, ngF = 0;
  for (const [l, r] of Object.entries(c)) {
    if (l !== "no_gesture" && !CLEAN.has(l)) continue;
    const n = Object.values(r).reduce((a, b) => a + b, 0), tr = n - (r.none || 0);
    if (l === "no_gesture") { ngT += n; ngF += tr; } else { t += n; f += tr; }
  }
  res.falseTrig = f / t; res.noGesture = ngF / ngT; res.four = (c.four?.openPalm || 0) / Object.values(c.four || { a: 1 }).reduce((a, b) => a + b, 0);
  return res;
}
const fmt = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +v.toFixed(3)]));
// parity check vs memes.js
let bad = 0;
for (const x of hands.filter((_, i) => i % 50 === 0)) {
  const f = handFeatures([x.raw.map(([a, b]) => ({ x: a, y: b }))], null);
  if ((G.find((g) => f[g]) || "none") !== pred(x, BASE)) bad++;
}
console.log("parity mismatches (sampled 1/50):", bad);
console.log("baseline", fmt(score(BASE)));
const pass = (r) => G.every((g) => r[g] >= 0.85) && r.falseTrig <= 0.10;
const grid = [];
for (const ext of [1.0, 1.05, 1.08, 1.12, 1.16, 1.2])
  for (const t1 of [1.0, 1.05, 1.1, 1.15])
    for (const t2 of [0.35, 0.45, 0.55, 0.65])
      for (const up of [0.15, 0.25, 0.35])
        for (const palmNoThumb of [false, true])
          for (const shakaThumb of [null, 0.3, 0.4]) grid.push({ ext, t1, t2, up, palmNoThumb, shakaThumb });
// tune on half 0, report on half 1; objective: min recall (maximin) subject to falseTrig<=0.10 & noGesture soft
const A = (x) => x.half === 0, B = (x) => x.half === 1;
const ranked = grid.map((p) => ({ p, a: score(p, A) })).filter((o) => o.a.falseTrig <= 0.10)
  .map((o) => ({ ...o, m: Math.min(...G.map((g) => o.a[g])) })).sort((x, y) => y.m - x.m);
console.log("grid", grid.length, "feasible", ranked.length);
for (const o of ranked.slice(0, 5)) console.log(JSON.stringify(o.p), "A:", JSON.stringify(fmt(o.a)), "B:", JSON.stringify(fmt(score(o.p, B))));
// one-at-a-time effects from baseline (full test)
for (const [k, vs] of Object.entries({ palmNoThumb: [true], shakaThumb: [0.3, 0.4], up: [0.15, 0.25], ext: [1.0, 1.05, 1.2], t1: [1.0], t2: [0.35, 0.45] }))
  for (const v of vs) console.log("one-at-a-time", k, v, JSON.stringify(fmt(score({ ...BASE, [k]: v }))));
if (process.env.PERCLASS) {
  const c = {}; for (const x of hands) { const q = pred(x, BASE); ((c[x.cls] ||= {})[q] ||= 0); c[x.cls][q]++; }
  for (const [l, r] of Object.entries(c)) { if (MAP[l]) continue; const n = Object.values(r).reduce((a, b) => a + b, 0); console.log(l.padEnd(14), n, AMBIG.has(l) ? "ambig" : "", JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +(v / n).toFixed(2)])))); }
}

console.log("--- combined");
for (const p of [{ ...BASE, shakaThumb: 0.3, up: 0.25 }, ...[0.2,0.3,0.4].map((palmT2) => ({ ...BASE, shakaThumb: 0.3, up: 0.25, palmT2 })), ...[1.2].map((ext) => ({ ...BASE, shakaThumb: 0.3, up: 0.25, palmT2: 0.3, ext }))])
  console.log(JSON.stringify(p), JSON.stringify(fmt(score(p))));
