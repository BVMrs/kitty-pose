// Fine sweep of the "think zone": % of hands whose meme becomes think, by hand-centre offset from the chin (face heights).
import fs from "node:fs";
import { MEMES, handFeatures, faceFeatures } from "../../memes.js";
const dir = process.argv[2], aspect = Number(process.argv[3] || 0.5625);
const face = []; face[10] = { x: .5, y: .30 }; face[152] = { x: .5, y: .62 }; const FH = .32;
const neutral = { ...faceFeatures({}, null), face: true };
const pick = (f) => { let b = "stare", bs = -1; for (const m of MEMES) { const s = m.score(f); if (s > bs) { bs = s; b = m.id; } } return bs < 0.35 ? "stare" : b; };
for (const [cls, w] of [["like", "thumbs"], ["palm", "stop"], ["one", "point"]]) {
  const j = JSON.parse(fs.readFileSync(`${dir}/${cls}.json`)); let hs = [];
  for (const k in j) { const e = j[k]; if (e.labels.length !== 1 || e.labels[0] !== cls) continue; const h = (e.hand_landmarks || []).filter((h) => h?.length === 21); if (h.length === 1) hs.push(h[0].map(([x, y]) => ({ x, y }))); }
  hs = hs.filter((_, i) => i % Math.max(1, Math.floor(hs.length / 300)) === 0).slice(0, 300);
  hs = hs.filter((h) => pick({ ...neutral, ...handFeatures([h], null, aspect) }) === w);
  console.log(`\n${cls} (${hs.length} hands) % showing think; rows dy (fh, + = below chin), cols dx (fh)`);
  const dxs = [0, .15, .3, .45, .6, .8]; console.log("dy\\dx " + dxs.map((x) => String(x).padStart(5)).join(""));
  for (let dy = -.8; dy <= .81; dy += .2) {
    let row = dy.toFixed(1).padStart(5) + " ";
    for (const dx of dxs) {
      let t = 0; for (const h of hs) { const ddx = .5 + dx * FH / aspect - h[9].x, ddy = .62 + dy * FH - h[9].y;
        const p = h.map((q) => ({ x: q.x + ddx, y: q.y + ddy })); if (pick({ ...neutral, ...handFeatures([p], face, aspect) }) === "think") t++; }
      row += String(Math.round(100 * t / hs.length)).padStart(5);
    } console.log(row);
  }
}
