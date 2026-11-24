// Estimate the typical HaGRID image aspect A0 from landmark geometry alone: a bone's true length is the same whether it
// points up or sideways, so median |dy| of near-vertical bones / median |dx| of near-horizontal bones = A0 (x_norm = px/W).
import fs from "node:fs";
const dir = process.argv[2];
const v = {}, hz = {};
const bones = { "0-9": [0, 9], "5-9": [5, 9], "0-5": [0, 5], "9-10": [9, 10], "13-14": [13, 14] };
const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
for (const fn of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(`${dir}/${fn}`));
  for (const k in j) for (const h of j[k].hand_landmarks || []) {
    if (h?.length !== 21) continue;
    for (const [n, [a, b]] of Object.entries(bones)) {
      const dx = Math.abs(h[a][0] - h[b][0]), dy = Math.abs(h[a][1] - h[b][1]);
      if (dy > 3 * dx) (v[n] ||= []).push(dy); else if (dx > 3 * dy) (hz[n] ||= []).push(dx);
    }
  }
}
for (const n in bones) console.log(n, "vert n", v[n].length, "med dy", med(v[n]).toFixed(4), "| horiz n", hz[n].length, "med dx", med(hz[n]).toFixed(4), "| A0 ~", (med(v[n]) / med(hz[n])).toFixed(3));
