// Why do open palm / shaka fail in isotropic coords? usage: node diag.mjs <annotations test dir> <sizes dir>
import fs from "node:fs";
const [adir, sdir] = process.argv.slice(2);
const MAP = { like: "thumbsUp", call: "shaka", fist: "fist", one: "pointing", palm: "openPalm", stop: "openPalm" };
const hands = [];
for (const cls of Object.keys(MAP)) {
  const sz = JSON.parse(fs.readFileSync(`${sdir}/${cls}.json`)).items, ann = JSON.parse(fs.readFileSync(`${adir}/${cls}.json`));
  for (const it of sz) { const e = ann[it.id]; if (!e) continue;
    const [w, h] = it.orient >= 5 ? [it.h, it.w] : [it.w, it.h]; const A0 = w / h;
    e.labels.forEach((l, i) => { const lm = e.hand_landmarks?.[i]; if (l === cls && lm?.length === 21) hands.push({ cls, A0, id: it.id, h: lm.map(([x, y]) => ({ x: x * A0, y })) }); }); }
}
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const feat = (h) => {
  const w = h[0], r = (t, p) => d(h[t], w) / d(h[p], w);
  return { ext: [8,12,16,20].map((t,i)=>r(t,[6,10,14,18][i])), t1: d(h[4],h[9])/d(h[3],h[9]), t2: d(h[4],h[5])/d(h[0],h[5]), up: (h[2].y-h[4].y)/d(h[0],h[9]) };
};
const q = (a, p) => { a = [...a].sort((x, y) => x - y); return +a[Math.floor(p * (a.length - 1))].toFixed(2); };
for (const cls of ["palm", "stop", "call", "like"]) {
  const F = hands.filter((x) => x.cls === cls).map((x) => feat(x.h));
  const pct = (fn) => +(F.filter(fn).length / F.length).toFixed(2);
  console.log(cls, F.length, "q10/50/90 t1", [.1,.5,.9].map((p)=>q(F.map(f=>f.t1),p)), "t2", [.1,.5,.9].map((p)=>q(F.map(f=>f.t2),p)),
    "ext idx/mid/ring/pinky pass:", [0,1,2,3].map((i)=>pct(f=>f.ext[i]>1.12)), "t1ok", pct(f=>f.t1>1.1), "t2ok", pct(f=>f.t2>.55), "up q50", q(F.map(f=>f.up),.5));
}
