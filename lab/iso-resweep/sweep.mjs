// Threshold sweep of handFeatures in ISOTROPIC coords (x*A0, y). usage: node sweep.mjs <annotations test dir> <sizes dir>
// A0 = true image aspect where sampled (6 mapped classes, 1,775 hands, lab/image-aspect2/out); every other hand gets an A0
// drawn (seeded) from that empirical pool, because the sizes for unmapped classes were never fetched. Parity-checked vs memes.js.
import fs from "node:fs";
import crypto from "node:crypto";
import { handFeatures } from "../../memes.js";
const [dir, sdir] = process.argv.slice(2);
const MAP = { like: "thumbsUp", call: "shaka", fist: "fist", one: "pointing", palm: "openPalm", stop: "openPalm" };
const CLEAN = new Set(["ok","peace","peace_inverted","rock","three","three2","three3","two_up","two_up_inverted","stop_inverted"]);
const G = ["thumbsUp", "shaka", "fist", "pointing", "openPalm"];
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const known = {}, pool = [];
for (const cls of Object.keys(MAP)) for (const it of JSON.parse(fs.readFileSync(`${sdir}/${cls}.json`)).items) {
  const [w, h] = it.orient >= 5 ? [it.h, it.w] : [it.w, it.h]; known[it.id] = w / h; pool.push(w / h); }
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const hands = []; let nKnown = 0;
for (const fn of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && fs.statSync(`${dir}/${f}`).size > 0)) {
  const cls = fn.replace(".json", ""), j = JSON.parse(fs.readFileSync(`${dir}/${fn}`));
  for (const k in j) { const e = j[k];
    e.labels.forEach((lab, i) => { if (lab !== cls) return; const lm = e.hand_landmarks?.[i]; if (!lm || lm.length !== 21) return;
      const A0 = known[k] ?? pool[Math.floor(rnd() * pool.length)]; if (known[k]) nKnown++;
      const h = lm.map(([x, y]) => ({ x: x * A0, y })), r = (t, p) => d(h[t], h[0]) / d(h[p], h[0]);
      hands.push({ cls, A0, known: !!known[k], half: crypto.createHash("md5").update(e.user_id || k).digest()[0] & 1, raw: lm,
        ext: [r(8, 6), r(12, 10), r(16, 14), r(20, 18)], t1: d(h[4], h[9]) / d(h[3], h[9]), t2: d(h[4], h[5]) / d(h[0], h[5]),
        up: (h[2].y - h[4].y) / d(h[0], h[9]) }); }); }
}
console.log("hands", hands.length, "with true A0", nKnown);
const BASE = { ext: 1.12, t1: 1.1, t2: 0.55, up: 0.35, palmNoThumb: false, shakaThumb: null, palmT2: null };
function pred(x, p) {
  const [i, m, r, pk] = x.ext.map((v) => v > p.ext), thumb = x.t1 > p.t1 && x.t2 > p.t2;
  const curled = [i, m, r, pk].filter((v) => !v).length, out = {};
  if (thumb && x.up > p.up && curled === 4) out.thumbsUp = 1;
  else if ((p.shakaThumb != null ? x.t1 > p.t1 && x.t2 > p.shakaThumb : thumb) && pk && !i && !m && !r) out.shaka = 1;
  else if (curled === 4) out.fist = 1;
  if (i && !m && !r && !pk && !out.thumbsUp && !out.shaka) out.pointing = 1;
  if (i && m && r && pk && (thumb || p.palmNoThumb || (p.palmT2 != null && x.t1 > p.t1 && x.t2 > p.palmT2))) out.openPalm = 1;
  return G.find((g) => out[g]) || "none";
}
function score(p, filter = () => true) {
  const c = {}; for (const x of hands) if (filter(x)) { const q = pred(x, p); ((c[x.cls] ||= {})[q] ||= 0); c[x.cls][q]++; }
  const res = {}, tot = (r) => Object.values(r).reduce((a, b) => a + b, 0);
  for (const g of G) { let tp = 0, n = 0; for (const [l, r] of Object.entries(c)) if (MAP[l] === g) { tp += r[g] || 0; n += tot(r); } res[g] = tp / n; }
  let t = 0, f = 0, ngT = 0, ngF = 0;
  for (const [l, r] of Object.entries(c)) { const n = tot(r), tr = n - (r.none || 0);
    if (l === "no_gesture") { ngT += n; ngF += tr; } else if (CLEAN.has(l)) { t += n; f += tr; } }
  res.falseTrig = f / t; res.noGesture = ngF / ngT; return res;
}
const fmt = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +v.toFixed(3)]));
let bad = 0, nchk = 0;
for (const x of hands.filter((_, i) => i % 40 === 0)) { nchk++;
  const f = handFeatures([x.raw.map(([a, b]) => ({ x: a * x.A0, y: b }))], null, 1);
  if ((G.find((g) => f[g]) || "none") !== pred(x, BASE)) bad++; }
console.log("parity mismatches", bad, "of", nchk);
const P = { ...BASE, shakaThumb: 0.3, up: 0.25 };   // earlier sweep's squeezed-space picks
console.log("baseline (master thresholds), all     ", JSON.stringify(fmt(score(BASE))));
console.log("baseline, true-A0 subset only         ", JSON.stringify(fmt(score(BASE, (x) => x.known))));
console.log("baseline, imputed-A0 hands only       ", JSON.stringify(fmt(score(BASE, (x) => !x.known))));
console.log("old picks (shakaThumb.3 up.25)        ", JSON.stringify(fmt(score(P))));
for (const [k, vs] of Object.entries({ shakaThumb: [0.1, 0.2, 0.3, 0.4], up: [0.15, 0.25, 0.45], palmNoThumb: [true], palmT2: [0.2, 0.3, 0.4], t1: [1.0, 1.15], t2: [0.35, 0.45, 0.65], ext: [1.0, 1.05, 1.2] }))
  for (const v of vs) console.log("one-at-a-time", k, v, JSON.stringify(fmt(score({ ...BASE, [k]: v }))));
const grid = [];
for (const ext of [1.0, 1.05, 1.08, 1.12, 1.16, 1.2]) for (const t1 of [1.0, 1.05, 1.1, 1.15]) for (const t2 of [0.35, 0.45, 0.55, 0.65])
  for (const up of [0.15, 0.25, 0.35]) for (const palmNoThumb of [false, true]) for (const shakaThumb of [null, 0.1, 0.2, 0.3, 0.4]) grid.push({ ext, t1, t2, up, palmNoThumb, shakaThumb });
const A = (x) => x.half === 0, B = (x) => x.half === 1;
for (const [label, maxFT] of [["falseTrig<=.10", 0.10], ["falseTrig<=.05", 0.05]]) {
  const ranked = grid.map((p) => ({ p, a: score(p, A) })).filter((o) => o.a.falseTrig <= maxFT)
    .map((o) => ({ ...o, m: Math.min(...G.map((g) => o.a[g])) })).sort((x, y) => y.m - x.m);
  console.log("--- grid", grid.length, label, "feasible", ranked.length);
  for (const o of ranked.slice(0, 4)) console.log(JSON.stringify(o.p), "A:", JSON.stringify(fmt(o.a)), "B(held-out users):", JSON.stringify(fmt(score(o.p, B))));
}
