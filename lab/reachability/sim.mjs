// Which memes can win choose() at steady state? Random search + hill-climb on margin = score - max(other scores)
// over the full feature space (not just natural poses). Steady state: ema == score, win needs score>=0.35 and strictly best.
import { MEMES } from "../../memes.js";
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const BS = ["jawOpen","eyeWide","blink","squint","smile","frown","browInnerUp","browUp","browDown","gazeSide"];
const HANDS = [ // discrete hand states reachable from handFeatures(); handAtChin continuous
  {}, {thumbsUp:1},{shaka:1},{fist:1},{pointing:1},{openPalm:1},{openPalm:1,twoPalms:1},{handsUp:1},
  {fist:1,handsUp:1},{openPalm:1,handsUp:1},{openPalm:1,twoPalms:1,handsUp:1},{pointing:1,handsUp:1},{thumbsUp:1,handsUp:1},{shaka:1,handsUp:1},
];
function mk(x, hs, chin) {
  const f = { face: 1, yaw: x.yaw, roll: x.roll };
  BS.forEach((k, i) => (f[k] = x.b[i]));
  Object.assign(f, { thumbsUp:0,pointing:0,openPalm:0,twoPalms:0,fist:0,shaka:0,handAtChin:0,handsUp:0 }, hs, { handAtChin: chin });
  f.anyHand = (Object.keys(hs).length || chin > 0) ? 1 : 0;
  return f;
}
const margin = (f, id) => { let s = 0, o = -1; for (const m of MEMES) { const v = m.score(f); if (m.id === id) s = v; else o = Math.max(o, v); } return { s, margin: Math.min(s, 1) - Math.max(o, 0.35 - 1e-9 > o ? o : o) , o }; };
const win = (f, id) => { let s = 0, o = 0; for (const m of MEMES) { const v = m.score(f); if (m.id === id) s = v; else o = Math.max(o, v); } return { s, o, gap: Math.min(s - 0.35, s - o) }; };
const clip = (v, a, b) => Math.max(a, Math.min(b, v));
const rows = [];
for (const m of MEMES) {
  if (m.id === "stare") continue;
  let best = { gap: -9 };
  for (let hsI = 0; hsI < HANDS.length; hsI++) for (const chin of [0, 1]) {
    for (let restart = 0; restart < 30; restart++) {
      let x = { b: BS.map(() => rnd()), yaw: (rnd() - .5) * 2, roll: (rnd() - .5) * 60 };
      let g = win(mk(x, HANDS[hsI], chin), m.id);
      for (let it = 0; it < 150; it++) {
        const y = { b: x.b.map((v) => clip(v + (rnd() - .5) * 0.3, 0, 1)), yaw: clip(x.yaw + (rnd() - .5) * .3, -1, 1), roll: clip(x.roll + (rnd() - .5) * 10, -45, 45) };
        const h = win(mk(y, HANDS[hsI], chin), m.id);
        if (h.gap >= g.gap) { x = y; g = h; }
      }
      if (g.gap > best.gap) best = { ...g, x, hs: HANDS[hsI], chin };
    }
  }
  // who blocks it when it loses?
  let blocker = "";
  if (best.gap <= 0) { const f = mk(best.x, best.hs, best.chin); blocker = MEMES.filter(k => k.id !== m.id).sort((a, b) => b.score(f) - a.score(f))[0].id; }
  rows.push({ id: m.id, gap: +best.gap.toFixed(3), score: +best.s.toFixed(2), other: +best.o.toFixed(2), hands: JSON.stringify(best.hs) + (best.chin ? "+chin" : ""), blocker });
}
console.table(rows);
