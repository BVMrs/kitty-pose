// Held-pose jitter through the real createChooser(): per-frame i.i.d. Gaussian landmark noise (sigma = frac * hand size),
// 30 fps, 3 s hold, neutral face, starting from the default meme. Compares: raw (app today) vs landmark EMA prefilter.
// Usage: node sim.mjs <test-dir> [perClass=100]
import fs from "node:fs";
import { MEMES, handFeatures, faceFeatures, createChooser } from "../../memes.js";
const dir = process.argv[2], PER = +(process.argv[3] || 100);
const CLASSES = ["like", "call", "palm", "stop", "fist", "one"];
const SIGMAS = [0.01, 0.02, 0.04];
const FILTERS = { raw: null, ema0_5: 0.5, ema0_3: 0.3 };
let seed = 777; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const neutral = faceFeatures({}, null); neutral.face = true;
const pickClean = (hands) => { const f = { ...neutral, ...handFeatures(hands, null) }; let b = "stare", bs = -1;
  for (const m of MEMES) { const s = m.score(f); if (s > bs) { bs = s; b = m.id; } } return bs < 0.35 ? "stare" : b; };
const FR = 90, DT = 1000 / 30;
function run(hands, base, sg, alpha) {
  const ch = createChooser(); let prev = null, switches = 0, correct = 0, flashWrong = 0, tFirst = null, n = 0;
  for (let i = 0; i < FR; i++) {
    let nh = hands.map((h) => { const s = Math.hypot(h[0].x - h[9].x, h[0].y - h[9].y) * sg;
      return h.map((p) => ({ x: p.x + gauss() * s, y: p.y + gauss() * s })); });
    if (alpha) { nh = prev ? nh.map((h, k) => h.map((p, j) => ({ x: prev[k][j].x + alpha * (p.x - prev[k][j].x), y: prev[k][j].y + alpha * (p.y - prev[k][j].y) }))) : nh; prev = nh; }
    const f = { ...neutral, ...handFeatures(nh, null) };
    if (ch.step(f, i * DT)) { switches++; if (tFirst === null && ch.current === base) tFirst = i * DT; }
    if (i >= 30) { n++; if (ch.current === base) correct++; else if (base !== "stare" || true) flashWrong += 0; }
  }
  return { switches, correct: correct / n, settled: ch.current === base, tFirst };
}
console.log("sigma filter class n | time-correct% (frames 1-3 s) | meme switches per 3 s | ends on right meme %");
for (const sg of SIGMAS) for (const [fn, a] of Object.entries(FILTERS)) {
  const T = { n: 0, c: 0, sw: 0, end: 0, flick: 0 };
  for (const cls of CLASSES) {
    const j = JSON.parse(fs.readFileSync(`${dir}/${cls}.json`)); let n = 0, c = 0, sw = 0, end = 0, fl = 0;
    for (const k in j) { if (n >= PER) break; const e = j[k]; if (!e.labels.includes(cls)) continue;
      const hands = (e.hand_landmarks || []).filter((h) => h && h.length === 21).map((h) => h.map(([x, y]) => ({ x, y })));
      if (!hands.length) continue; const base = pickClean(hands); if (base === "stare") continue; n++;
      const r = run(hands, base, sg, a); c += r.correct; sw += r.switches; end += r.settled; if (r.switches > 2 || r.correct < 0.9) fl++; }
    console.log(String(sg).padEnd(5), fn.padEnd(7), cls.padEnd(5), String(n).padStart(3), "|", (100 * c / n).toFixed(1).padStart(5), "|", (sw / n).toFixed(2), "|", (100 * end / n).toFixed(1), "| bad-clip%", (100 * fl / n).toFixed(1));
    T.n += n; T.c += c; T.sw += sw; T.end += end; T.flick += fl;
  }
  console.log(String(sg).padEnd(5), fn.padEnd(7), "ALL  ", String(T.n).padStart(3), "|", (100 * T.c / T.n).toFixed(1).padStart(5), "|", (T.sw / T.n).toFixed(2), "|", (100 * T.end / T.n).toFixed(1), "| bad-clip%", (100 * T.flick / T.n).toFixed(1), "\n");
}
