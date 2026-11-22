// Recall of handFeatures() on HaGRID test landmarks, sliced by the dataset's meta (gender, age bucket, race) and by landmark
// winding (left/right hand XOR palm/back; HaGRID v2 has no leading_hand field and landmarks have no usable z).
// Single-gesture-hand images only. Usage: node sim.mjs <test-dir>
import fs from "node:fs";
import { handFeatures } from "../../memes.js";
const dir = process.argv[2];
const MAP = { like: "thumbsUp", call: "shaka", fist: "fist", one: "pointing", palm: "openPalm", stop: "openPalm" };
const G = ["thumbsUp", "shaka", "fist", "pointing", "openPalm"];
const pred = (h) => { const f = handFeatures([h], null); return G.find((g) => f[g]) || "none"; };
const wind = (h) => Math.sign((h[5].x - h[0].x) * (h[17].y - h[0].y) - (h[5].y - h[0].y) * (h[17].x - h[0].x));
const ageB = (a) => (a == null ? "?" : a < 20 ? "<20" : a < 30 ? "20-29" : a < 40 ? "30-39" : a < 50 ? "40-49" : "50+");
const R = {}, N = {};
const bump = (dim, val, cls, ok) => { const r = (((R[dim] ||= {})[val] ||= {})[cls] ||= { n: 0, ok: 0 }); r.n++; r.ok += ok; };
for (const fn of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const cls = fn.replace(".json", ""); if (!MAP[cls]) continue;
  const j = JSON.parse(fs.readFileSync(`${dir}/${fn}`));
  for (const k in j) {
    const e = j[k], L = e.hand_landmarks || [];
    if (e.labels.filter((l) => l === cls).length !== 1) continue;
    const i = e.labels.indexOf(cls), h0 = L[i]; if (!h0 || h0.length !== 21) continue;
    const h = h0.map(([x, y]) => ({ x, y })), m = e.meta || {}, ok = pred(h) === MAP[cls] ? 1 : 0;
    bump("gender", m.gender?.[i] ?? m.gender?.[0] ?? "?", cls, ok);
    bump("age", ageB(m.age?.[i] ?? m.age?.[0]), cls, ok);
    bump("race", m.race?.[i] ?? m.race?.[0] ?? "?", cls, ok);
    bump("winding", String(wind(h)), cls, ok);
    // hand size in frame (wrist to middle MCP): small = far from camera
    const s = Math.hypot(h[0].x - h[9].x, h[0].y - h[9].y);
    const sb = s < 0.05 ? "<0.05" : s < 0.08 ? "0.05-0.08" : s < 0.12 ? "0.08-0.12" : ">=0.12";
    bump("size", sb, cls, ok);
    bump("gender within size " + sb, m.gender?.[i] ?? m.gender?.[0] ?? "?", cls, ok);
  }
}
const cls = Object.keys(MAP);
for (const [dim, vals] of Object.entries(R)) {
  console.log(`\n== ${dim}: recall % (n) per class`);
  console.log("value".padEnd(22) + cls.map((c) => c.padStart(11)).join(""));
  for (const [v, cs] of Object.entries(vals).sort())
    console.log(v.padEnd(22) + cls.map((c) => { const r = cs[c]; return (r ? `${(100 * r.ok / r.n).toFixed(1)}(${r.n})` : "-").padStart(11); }).join(""));
}
