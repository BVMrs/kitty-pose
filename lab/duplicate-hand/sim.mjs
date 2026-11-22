// Does one real hand reported twice (numHands:2 in app.js) change the shown meme? Synthetic hands from test/memes.test.js.
import { MEMES, handFeatures } from "../../memes.js";
import { hand } from "./hand.mjs";
const face = null;
const pick = (hs) => { const f = new Proxy(handFeatures(hs, face), { get: (t, k) => (k in t ? t[k] : 0) });
  let b = null, bs = -1; for (const m of MEMES) { const s = m.score(f); if (s > bs) { bs = s; b = m.id; } } return b; };
const G = { palm: [1,1,1,1,1], fist: [0,0,0,0,0], thumbsUp: [1,0,0,0,0], point: [0,1,0,0,0], shaka: [1,0,0,0,1] };
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const jit = (h, a) => h.map((p) => ({ ...p, x: p.x + (rnd() - .5) * 2 * a, y: p.y + (rnd() - .5) * 2 * a }));
for (const [name, ext] of Object.entries(G)) for (const [pos, at] of [["chest", { x: .5, y: .8 }], ["above head", { x: .5, y: .05 }]]) {
  const h = hand(ext, at);
  const row = [pick([h])];
  for (const a of [0, 0.005, 0.02]) { const c = {}; for (let i = 0; i < 200; i++) { const m = pick([h, jit(h, a)]); c[m] = (c[m] || 0) + 1; } row.push(`${a}: ` + Object.entries(c).map(([k, v]) => `${k} ${v / 2}%`).join(", ")); }
  console.log(`${name} @${pos}: single=${row[0]} | dup ` + row.slice(1).join(" | "));
}
