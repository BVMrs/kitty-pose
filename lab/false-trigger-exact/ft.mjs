// False-trigger rate of handFeatures threshold sets on the 28 unmapped HaGRID classes, exact image aspect (sampled).
// usage: node ft.mjs <annotations test dir> <sizes dir of unmapped classes>
import fs from "node:fs";
const [dir, sdir] = process.argv.slice(2);
const CLEAN = new Set(["ok","peace","peace_inverted","rock","three","three2","three3","two_up","two_up_inverted","stop_inverted"]);
const G = ["thumbsUp", "shaka", "fist", "pointing", "openPalm"];
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const hands = [];
for (const fn of fs.readdirSync(sdir).filter((f) => f.endsWith(".json") && fs.statSync(`${sdir}/${f}`).size > 0)) {
  const cls = fn.replace(".json", ""), S = JSON.parse(fs.readFileSync(`${sdir}/${fn}`)), j = JSON.parse(fs.readFileSync(`${dir}/${cls}.json`));
  for (const it of S.items) { const e = j[it.id]; if (!e) continue;
    const [w, hh] = it.orient >= 5 ? [it.h, it.w] : [it.w, it.h], A0 = w / hh;
    e.labels.forEach((lab, i) => { if (lab !== cls) return; const lm = e.hand_landmarks?.[i]; if (!lm || lm.length !== 21) return;
      const h = lm.map(([x, y]) => ({ x: x * A0, y })), r = (t, p) => d(h[t], h[0]) / d(h[p], h[0]);
      hands.push({ cls, ext: [r(8, 6), r(12, 10), r(16, 14), r(20, 18)], t1: d(h[4], h[9]) / d(h[3], h[9]), t2: d(h[4], h[5]) / d(h[0], h[5]), up: (h[2].y - h[4].y) / d(h[0], h[9]) }); }); }
}
const BASE = { ext: 1.12, t1: 1.1, t2: 0.55, up: 0.35, shakaThumb: null };
const SETS = { "master+aspect": BASE, "shaka.2 up.25": { ...BASE, shakaThumb: 0.2, up: 0.25 }, "shaka.3 up.25": { ...BASE, shakaThumb: 0.3, up: 0.25 }, "shaka.1 up.25": { ...BASE, shakaThumb: 0.1, up: 0.25 } };
function pred(x, p) {
  const [i, m, r, pk] = x.ext.map((v) => v > p.ext), thumb = x.t1 > p.t1 && x.t2 > p.t2;
  const curled = [i, m, r, pk].filter((v) => !v).length, out = {};
  if (thumb && x.up > p.up && curled === 4) out.thumbsUp = 1;
  else if ((p.shakaThumb != null ? x.t1 > p.t1 && x.t2 > p.shakaThumb : thumb) && pk && !i && !m && !r) out.shaka = 1;
  else if (curled === 4) out.fist = 1;
  if (i && m && r && pk && thumb) out.openPalm = 1;
  if (i && !m && !r && !pk && !out.thumbsUp && !out.shaka) out.pointing = 1;
  return G.find((g) => out[g]) || "none";
}
const classes = [...new Set(hands.map((h) => h.cls))].sort();
console.log("hands", hands.length, "classes", classes.length, "sampled per class", JSON.stringify(Object.fromEntries(classes.map((c) => [c, hands.filter((h) => h.cls === c).length]))));
const rate = (s, p) => { const k = s.filter((x) => pred(x, p) !== "none").length; return [k / s.length, k, s.length]; };
const grp = { "CLEAN look-alike-free": (x) => CLEAN.has(x.cls) && x.cls !== "stop_inverted" ? true : CLEAN.has(x.cls), "no_gesture": (x) => x.cls === "no_gesture", "all unmapped": () => true };
for (const [name, p] of Object.entries(SETS)) {
  console.log("\n##", name);
  for (const [g, f] of Object.entries(grp)) { const [r, k, n] = rate(hands.filter(f), p); console.log(g.padEnd(24), (100 * r).toFixed(1) + "%", `${k}/${n}`); }
  const rows = classes.map((c) => { const s = hands.filter((x) => x.cls === c), by = {}; s.forEach((x) => { const q = pred(x, p); by[q] = (by[q] || 0) + 1; });
    return [c, s.length, 1 - (by.none || 0) / s.length, by]; });
  for (const [c, n, r, by] of rows) if (name !== "shaka.3 up.25" && name !== "shaka.1 up.25") console.log("  ", c.padEnd(16), String(n).padStart(4), (100 * r).toFixed(0).padStart(3) + "%", JSON.stringify(by));
}
// delta: hands whose prediction changes master+aspect -> shaka.2 up.25
const A = SETS["master+aspect"], B = SETS["shaka.2 up.25"], ch = {};
for (const x of hands) { const a = pred(x, A), b = pred(x, B); if (a !== b) { const k = `${x.cls}: ${a}->${b}`; ch[k] = (ch[k] || 0) + 1; } }
console.log("\nchanged by patch (by class):", JSON.stringify(Object.entries(ch).sort((a, b) => b[1] - a[1])));
