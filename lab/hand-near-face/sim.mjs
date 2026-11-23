// Hand position vs face: place real HaGRID hands (landmarks rigidly translated, size kept) at grid positions
// around a synthetic selfie face, neutral expression, and see which meme wins (steady state, real MEMES scores).
// Usage: node sim.mjs <hagrid test dir> [frame aspect w/h, default 0.5625]
import fs from "node:fs";
import { MEMES, handFeatures, faceFeatures } from "../../memes.js";
const dir = process.argv[2], aspect = Number(process.argv[3] || 0.5625);
const CLS = { like: "thumbsUp", call: "shaka", fist: "fist", one: "pointing", palm: "openPalm" };
// face: centred, chin y=.62, top y=.30 (face height .32 frame heights); only 10 and 152 matter to handFeatures
const face = []; face[10] = { x: .5, y: .30 }; face[152] = { x: .5, y: .62 };
const neutral = { ...faceFeatures({}, null), face: true };
const pick = (f) => { let b = "stare", bs = -1; for (const m of MEMES) { const s = m.score(f); if (s > bs) { bs = s; b = m.id; } } return bs < 0.35 ? "stare" : b; };
const want = { like: "thumbs", call: "shaka", fist: "fistbump", one: "point", palm: "stop" };
// hand centre (landmark 9) offsets, in face heights, relative to the chin: dy<0 up toward mouth/eyes
const POS = { "far-low (below chin by 1.0 fh)": [0, 1.0], "below chin 0.5 fh": [0, .5], "at chin": [0, 0], "at mouth (-0.2 fh)": [0, -.2], "beside cheek (+0.6 fh x)": [.6, -.2], "beside head (+1.2 fh x)": [1.2, -.4], "in front of eyes (-0.7 fh)": [0, -.7], "above head": [0, -1.4] };
const FH = .32, N = 400;
const sample = {};
for (const [cls] of Object.entries(CLS)) {
  const j = JSON.parse(fs.readFileSync(`${dir}/${cls}.json`));
  const hs = [];
  for (const k in j) { const e = j[k]; if (e.labels.length !== 1 || e.labels[0] !== cls) continue; const h = (e.hand_landmarks || []).filter((h) => h && h.length === 21); if (h.length === 1) hs.push(h[0].map(([x, y]) => ({ x, y }))); if (hs.length >= 3000) break; }
  sample[cls] = hs.filter((_, i) => i % Math.floor(hs.length / N) === 0).slice(0, N);
}
// first keep only hands that are recognised at their native position (so we measure position, not shape failures)
const place = (h, cx, cy) => { const dx = cx - h[9].x, dy = cy - h[9].y; return h.map((p) => ({ x: p.x + dx, y: p.y + dy })); };
console.log(`aspect ${aspect}; face height ${FH}; hands N<=${N} per class, only those that win the right meme at their native spot`);
for (const [cls, hs] of Object.entries(sample)) {
  const ok = hs.filter((h) => pick({ ...neutral, ...handFeatures([h], null, aspect) }) === want[cls]);
  console.log(`\n${cls} -> ${want[cls]}  (${ok.length}/${hs.length} baseline-correct)`);
  for (const [name, [ox, oy]] of Object.entries(POS)) {
    const cnt = {}; let hit = 0, chinSum = 0;
    for (const h of ok) {
      const p = place(h, .5 + ox * FH / aspect, .62 + oy * FH);
      const hf = handFeatures([p], face, aspect); chinSum += hf.handAtChin;
      const w = pick({ ...neutral, ...hf }); cnt[w] = (cnt[w] || 0) + 1; if (w === want[cls]) hit++;
    }
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, n]) => `${m} ${(100 * n / ok.length).toFixed(0)}%`).join(", ");
    console.log(`  ${name.padEnd(30)} kept ${(100 * hit / ok.length).toFixed(0).padStart(3)}%  meanChin ${(chinSum / ok.length).toFixed(2)}  ${top}`);
  }
}
