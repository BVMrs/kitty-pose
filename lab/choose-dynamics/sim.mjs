// Simulates app.js choose() (copied verbatim in logic; app.js is not importable in node: it imports a CDN URL
// and touches the DOM) against synthetic per-frame score streams. Seeded, no deps.
// usage: node sim.mjs
const IDS = ["stare", "A", "B"];
function makeChooser() {
  const ema = { stare: 0, A: 0, B: 0 };
  let current = "stare", pending = null, pendingSince = 0;
  const switches = [];
  function choose(scores, now) {              // scores: {id: raw score}; stare raw = 0.18 when face present
    for (const id of IDS) ema[id] = ema[id] * 0.6 + scores[id] * 0.4;   // app.js:  MEMES loop
    let best = "stare";
    for (const id of IDS) if (ema[id] > ema[best]) best = id;
    if (ema[best] < 0.35 && best !== "stare") best = "stare";
    if (best === current) { pending = null; return; }
    if (best !== "stare" && ema[best] < ema[current] + 0.08) return;
    if (pending !== best) { pending = best; pendingSince = now; return; }
    if (now - pendingSince > (best === "stare" ? 600 : 220)) { current = best; pending = null; switches.push([now, current]); }
  }
  return { choose, get current() { return current; }, switches };
}
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

// Scenario 1: step response. Pose held from t=0 (score hi) for 3 s, then released.
function step(fps, jitterMs = 0) {
  const c = makeChooser(); const dt = 1000 / fps; let t = 0, onset = null;
  for (let k = 0; k < fps * 3; k++, t += dt) {
    c.choose({ stare: 0.18, A: 1, B: 0 }, t + (rnd() - 0.5) * jitterMs);
    if (onset === null && c.current === "A") onset = t;
  }
  const tRel = t; let back = null;
  for (let k = 0; k < fps * 3; k++, t += dt) {
    c.choose({ stare: 0.18, A: 0, B: 0 }, t);
    if (back === null && c.current === "stare") back = t - tRel;
  }
  return { onset, back };
}
// Scenario 2: pose held 3 s, but each frame the detector misses with prob 1-p (iid) or in bursts (Markov, mean burst b frames).
function dropout(fps, p, burst) {
  const c = makeChooser(); const dt = 1000 / fps; let t = 0, miss = false, shownOK = 0, n = fps * 3, flicks = 0, prev = "stare";
  const pLeave = 1 / burst;                                   // P(miss -> hit)
  const pEnter = burst === 1 ? 1 - p : (pLeave * (1 - p)) / p; // keep stationary hit rate p
  let first = null;
  for (let k = 0; k < n; k++, t += dt) {
    miss = miss ? rnd() > pLeave : rnd() < pEnter;
    c.choose({ stare: 0.18, A: miss ? 0 : 1, B: 0 }, t);
    if (first === null && c.current === "A") first = t;
    if (first !== null) { if (c.current === "A") shownOK++; if (c.current !== prev && prev === "A") flicks++; }
    prev = c.current;
  }
  return { first, held: first === null ? 0 : shownOK / (n - first / dt), flicks };
}
// Scenario 3: noisy continuous score around mu (face blendshape near a ramp edge). Counts switches over 10 s.
function noisy(fps, mu, sigma) {
  const c = makeChooser(); const dt = 1000 / fps; let t = 0, n = fps * 10, onA = 0;
  for (let k = 0; k < n; k++, t += dt) {
    const s = Math.max(0, Math.min(1, mu + sigma * gauss()));
    c.choose({ stare: 0.18, A: s, B: 0 }, t);
    if (c.current === "A") onA++;
  }
  return { switches: c.switches.length, onA: onA / n };
}
// Scenario 4: hand-to-hand transition A held 2 s then B held (raw switch, no gap) and with a 0.3 s gap of no-hand.
function trans(fps, gapMs) {
  const c = makeChooser(); const dt = 1000 / fps; let t = 0, at = null, first = null;
  for (let k = 0; k < fps * 2; k++, t += dt) c.choose({ stare: 0.18, A: 1, B: 0 }, t);
  const t0 = t;
  for (let k = 0; t - t0 < gapMs; k++, t += dt) c.choose({ stare: 0.18, A: 0, B: 0 }, t);
  const t1 = t;
  for (let k = 0; k < fps * 3; k++, t += dt) { c.choose({ stare: 0.18, A: 0, B: 1 }, t); if (first === null && c.current === "B") first = t - t1; }
  return { first, path: c.switches.map((s) => s[1]).join(">") };
}

const out = [];
const P = (s) => { out.push(s); console.log(s); };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
P("## 1. step response (pose appears at t=0; ms to meme change / ms to return to stare after release)");
for (const fps of [8, 15, 30, 60]) { const r = step(fps); P(`fps ${fps}: onset ${r.onset.toFixed(0)} ms, back to stare ${r.back.toFixed(0)} ms`); }
P("\n## 2. detector dropouts while a pose is held 3 s (200 runs each): median time to first show, share of held time on the right meme, flickers away")
P("fps | hit rate | burst(frames) | first show ms | shown % | flickers/run | runs never shown");
for (const fps of [15, 30]) for (const p of [0.95, 0.85, 0.7, 0.5]) for (const burst of [1, 5]) {
  const R = Array.from({ length: 200 }, () => dropout(fps, p, burst));
  const f = R.filter((r) => r.first !== null).map((r) => r.first).sort((a, b) => a - b);
  P(`${fps} | ${p} | ${burst} | ${f.length ? f[f.length >> 1].toFixed(0) : "-"} | ${(100 * mean(R.map((r) => r.held))).toFixed(0)} | ${mean(R.map((r) => r.flicks)).toFixed(2)} | ${R.filter((r) => r.first === null).length}`);
}
P("\n## 3. noisy continuous score (face blendshape on a ramp edge), 30 fps, 10 s, 50 runs: switches/run and share of time on A");
P("mu | sigma | switches | on A %");
for (const mu of [0.2, 0.35, 0.45, 0.6]) for (const sigma of [0.05, 0.15, 0.3]) {
  const R = Array.from({ length: 50 }, () => noisy(30, mu, sigma));
  P(`${mu} | ${sigma} | ${mean(R.map((r) => r.switches)).toFixed(1)} | ${(100 * mean(R.map((r) => r.onA))).toFixed(0)}`);
}
P("\n## 4. A -> B transitions at 30 fps (ms from B appearing to B shown; path of memes shown)");
for (const gap of [0, 100, 300]) { const r = trans(30, gap); P(`gap ${gap} ms: ${r.first?.toFixed(0)} ms, path ${r.path}`); }
import { writeFileSync } from "node:fs";
writeFileSync(new URL("./output.txt", import.meta.url), out.join("\n") + "\n");
