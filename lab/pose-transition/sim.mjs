// Hand moves from pose A to pose B (linear landmark interpolation, wrist-aligned) through the real
// handFeatures + createChooser at 30 fps. Which memes flash on the way?
// usage: node sim.mjs [hagrid-root]   (root holds annotations/test/<class>.json; default .agent-work/hg)
import fs from "node:fs";
import path from "node:path";
import { handFeatures, faceFeatures, createChooser } from "../../memes.js";
const root = process.argv[2] || ".agent-work/hg";
const dir = path.join(root, "annotations", "test");
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const AS = 0.75;   // true HaGRID aspect (72% are 3:4 portrait), see image-aspect-recall
const CLASSES = { like: "thumbs", call: "shaka", fist: "fistbump", one: "point", palm: "stop" };
const GOOD = { like: "thumbsUp", call: "shaka", fist: "fist", one: "pointing", palm: "openPalm" };
const hands = {};
for (const c of Object.keys(CLASSES)) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, c + ".json")));
  const out = [];
  for (const k of Object.keys(d)) {
    const e = d[k];
    (e.hand_landmarks || []).forEach((h, i) => {
      if (h && h.length === 21 && (e.labels || [])[i] === c) out.push(h.map(([x, y]) => ({ x, y })));
    });
    if (out.length > 3000) break;
  }
  // keep only hands the app already gets right, so a flash is the transition's doing, not the endpoint's
  hands[c] = out.filter((h) => handFeatures([h], null, AS)[GOOD[c]]);
}
const face = Array.from({ length: 478 }, () => ({ x: .5, y: .5 }));
Object.assign(face, { 33: { x: .45, y: .4 }, 263: { x: .55, y: .4 }, 234: { x: .4, y: .45 }, 454: { x: .6, y: .45 }, 1: { x: .5, y: .45 }, 10: { x: .5, y: .25 }, 152: { x: .5, y: .65 } });
const ff = faceFeatures({}, face);
const place = (h) => { const w = h[0]; return h.map((p) => ({ x: p.x - w.x + .5, y: p.y - w.y + .95 })); };
const lerp = (a, b, t) => a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * t, y: p.y + (b[i].y - p.y) * t }));
const FPS = 30, dt = 1000 / FPS;
function run(A, B, T) {
  const a = place(A), b = place(B), c = createChooser(); let now = 0; const seq = [];
  const frame = (h) => { c.step({ ...ff, ...handFeatures([h], face, AS) }, now); now += dt; return c.current; };
  for (let i = 0; i < 30; i++) frame(a);                    // settle on A (1 s)
  const startShown = c.current;
  const n = Math.round(T / dt);
  for (let i = 0; i < n + 45; i++) {
    const m = frame(i < n ? lerp(a, b, (i + 1) / n) : b);
    if (!seq.length || seq[seq.length - 1] !== m) seq.push(m);
  }
  return { startShown, seq, final: c.current };
}
const N = +process.env.N || 150;
const names = Object.keys(CLASSES);
for (const T of [100, 200, 400, 800]) {
  let pairs = 0, ok = 0, flash = 0, viaStare = 0, startBad = 0;
  const flashShow = {}, bad = {};
  for (const A of names) for (const B of names) {
    if (A === B) continue;
    let pf = 0, pn = 0;
    for (let k = 0; k < N; k++) {
      const ha = hands[A][Math.floor(rnd() * hands[A].length)], hb = hands[B][Math.floor(rnd() * hands[B].length)];
      const r = run(ha, hb, T);
      if (r.startShown !== CLASSES[A]) { startBad++; continue; }
      pairs++; pn++;
      if (r.final === CLASSES[B]) ok++;
      const mids = r.seq.slice(1).filter((m) => m !== CLASSES[A] && m !== CLASSES[B] && m !== "stare");
      if (mids.length) { flash++; pf++; for (const m of new Set(mids)) flashShow[m] = (flashShow[m] || 0) + 1; }
      if (r.seq.includes("stare")) viaStare++;
    }
    bad[`${A}>${B}`] = pn ? pf / pn : 0;
  }
  const top = Object.entries(flashShow).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([m, c]) => `${m} ${(100 * c / pairs).toFixed(1)}%`).join(", ");
  const worst = Object.entries(bad).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => `${k} ${(100 * v).toFixed(0)}%`).join(", ");
  console.log(`T=${T}ms  trials=${pairs} (skipped ${startBad} unsettled)  final correct ${(100 * ok / pairs).toFixed(1)}%  flash of a wrong meme ${(100 * flash / pairs).toFixed(1)}%  passes via stare ${(100 * viaStare / pairs).toFixed(1)}%`);
  console.log(`   wrong memes shown: ${top}\n   worst pairs: ${worst}`);
}
console.log("endpoint-clean hands:", Object.fromEntries(names.map((n) => [n, hands[n].length])));
