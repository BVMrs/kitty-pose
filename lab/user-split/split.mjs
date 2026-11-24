// Offline threshold sweep for handFeatures on HaGRIDv2 test landmarks. Usage: node sweep.mjs <test-dir>
// Does not touch memes.js: a parametrised copy of fingerState/handFeatures (hand-only, no face), parity-checked.
import fs from "node:fs";
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
      hands.push({ cls, user: e.user_id, half: parseInt(k.slice(0, 4), 16) & 1, raw: h,
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

// ---- user-disjoint validation ----
const users = [...new Set(hands.map((x) => x.user))].sort();
const perUser = {}; for (const x of hands) perUser[x.user] = (perUser[x.user] || 0) + 1;
console.log("users", users.length, "hands", hands.length, "max hands/user", Math.max(...Object.values(perUser)));
// how many users straddle the old parity halves?
const halves = {}; for (const x of hands) (halves[x.user] ||= new Set()).add(x.half);
console.log("users present in BOTH parity halves:", Object.values(halves).filter((s) => s.size === 2).length, "of", users.length);
const hash = (u) => parseInt(u.slice(0, 8), 16);
const fold = (k) => (x) => hash(x.user) % 2 === k;
const COMB = { ...BASE, shakaThumb: 0.3, up: 0.25, palmT2: 0.3 };
const grid = [];
for (const ext of [1.0, 1.05, 1.08, 1.12, 1.16, 1.2]) for (const t1 of [1.0, 1.05, 1.1, 1.15]) for (const t2 of [0.35, 0.45, 0.55, 0.65])
  for (const up of [0.15, 0.25, 0.35]) for (const palmNoThumb of [false, true]) for (const shakaThumb of [null, 0.3, 0.4]) grid.push({ ext, t1, t2, up, palmNoThumb, shakaThumb });
const minRecall = (r) => Math.min(...G.map((g) => r[g]));
console.log("== grid tuned on user-fold 0 (falseTrig<=.10), reported on user-fold 1 (disjoint people) and on parity half 1 for contrast");
const F0 = fold(0), F1 = fold(1);
const ranked = grid.map((p) => ({ p, a: score(p, F0) })).filter((o) => o.a.falseTrig <= 0.10).sort((x, y) => minRecall(y.a) - minRecall(x.a));
for (const o of ranked.slice(0, 3)) console.log(JSON.stringify(o.p), "tune:", JSON.stringify(fmt(o.a)), "heldout-users:", JSON.stringify(fmt(score(o.p, F1))));
// the lab's combined recommendation, by fold
for (const [n, f] of [["fold0", F0], ["fold1", F1], ["all", () => true]]) console.log("COMB", n, JSON.stringify(fmt(score(COMB, f))));
for (const [n, f] of [["fold0", F0], ["fold1", F1]]) console.log("BASE", n, JSON.stringify(fmt(score(BASE, f))));
// cluster bootstrap over users: CI for COMB metrics
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const byUser = {}; for (const x of hands) (byUser[x.user] ||= []).push(x);
const B = 200, samples = [];
for (let b = 0; b < B; b++) {
  const w = {}; for (let i = 0; i < users.length; i++) { const u = users[Math.floor(rnd() * users.length)]; w[u] = (w[u] || 0) + 1; }
  // weighted score: replicate by weights via counts
  const c = {}; for (const [u, k] of Object.entries(w)) for (const x of byUser[u]) { const q = pred(x, COMB); const r = (c[x.cls] ||= {}); r[q] = (r[q] || 0) + k; }
  const res = {};
  for (const g of G) { let tp = 0, n = 0; for (const [l, r] of Object.entries(c)) if (MAP[l] === g) { tp += r[g] || 0; n += Object.values(r).reduce((a, b) => a + b, 0); } res[g] = tp / n; }
  let t = 0, f = 0, ngT = 0, ngF = 0;
  for (const [l, r] of Object.entries(c)) { if (l !== "no_gesture" && !CLEAN.has(l)) continue; const n = Object.values(r).reduce((a, b) => a + b, 0), tr = n - (r.none || 0); if (l === "no_gesture") { ngT += n; ngF += tr; } else { t += n; f += tr; } }
  res.falseTrig = f / t; res.noGesture = ngF / ngT; samples.push(res);
}
const q = (k, p) => samples.map((s) => s[k]).sort((a, b) => a - b)[Math.floor(p * (B - 1))];
console.log("cluster bootstrap by user (B=200), COMB: 2.5% / 50% / 97.5%");
for (const k of [...G, "falseTrig", "noGesture"]) console.log(k.padEnd(10), q(k, .025).toFixed(3), q(k, .5).toFixed(3), q(k, .975).toFixed(3));
// per-class user concentration: share of hands from top 5 users
for (const cls of ["like", "call", "palm", "stop", "no_gesture"]) {
  const c = {}; for (const x of hands) if (x.cls === cls) c[x.user] = (c[x.user] || 0) + 1;
  const v = Object.values(c).sort((a, b) => b - a), n = v.reduce((a, b) => a + b, 0);
  console.log(cls.padEnd(11), "users", v.length, "n", n, "top5 share", (v.slice(0, 5).reduce((a, b) => a + b, 0) / n).toFixed(3));
}
