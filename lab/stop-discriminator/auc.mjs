// Can a thumb-free feature separate open palm (palm+stop) from look-alikes? usage: node auc.mjs <annotations test dir>
// Isotropic coords need the image aspect; sizes unknown for most classes, so use the dominant 3:4 portrait (A0=.75) for ALL hands.
import fs from "node:fs";
const dir = process.argv[2], A0 = 0.75;
const POS = new Set(["palm", "stop"]), NEG = ["four","no_gesture","three","three2","three3","two_up","peace","ok","rock","stop_inverted","little_finger","mute","fist","call","like","one","dislike","thumb_index","peace_inverted","two_up_inverted"];
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ang = (o, a, b) => { const u = [a.x-o.x,a.y-o.y], v = [b.x-o.x,b.y-o.y]; return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)||1))))*180/Math.PI; };
const feat = (h) => { const w = h[0], s = d(h[9], w), r = (t,p)=>d(h[t],w)/d(h[p],w);
  const ext = [r(8,6),r(12,10),r(16,14),r(20,18)];
  return { minExt: Math.min(...ext), t2: d(h[4],h[5])/d(h[0],h[5]),
    spreadIM: ang(w,h[8],h[12]), spreadMR: ang(w,h[12],h[16]), spreadRP: ang(w,h[16],h[20]),
    spreadAll: ang(w,h[8],h[20]), tipGap: (d(h[8],h[12])+d(h[12],h[16])+d(h[16],h[20]))/(3*s),
    thumbAng: ang(w,h[4],h[8]), thumbSide: d(h[4],h[8])/s }; };
const rows = [];
for (const cls of [...POS, ...NEG]) { const f = `${dir}/${cls}.json`; if (!fs.existsSync(f) || !fs.statSync(f).size) continue;
  const j = JSON.parse(fs.readFileSync(f));
  for (const k in j) { const e = j[k]; e.labels.forEach((l,i)=>{ const lm = e.hand_landmarks?.[i]; if (l!==cls||!lm||lm.length!==21) return;
    const h = lm.map(([x,y])=>({x:x*A0,y})); const F = feat(h); if (F.minExt > 1.12) rows.push({ cls, pos: POS.has(cls), ...F }); }); } }
// only hands that already pass the 4-finger-extended test matter (that gate is kept)
const auc = (key, sign) => { const P = rows.filter(r=>r.pos).map(r=>sign*r[key]), N = rows.filter(r=>!r.pos).map(r=>sign*r[key]);
  const all = [...P.map(v=>[v,1]),...N.map(v=>[v,0])].sort((a,b)=>a[0]-b[0]); let rk=0, sum=0; all.forEach((x,i)=>{ if(x[1]) sum+=i+1; });
  return (sum - P.length*(P.length+1)/2)/(P.length*N.length); };
const cnt = {}; rows.forEach(r=>cnt[r.cls]=(cnt[r.cls]||0)+1); console.log("hands with 4 fingers extended, by class", JSON.stringify(cnt));
for (const k of ["t2","spreadIM","spreadMR","spreadRP","spreadAll","tipGap","thumbAng","thumbSide"]) console.log(k, "AUC", auc(k,1).toFixed(3), "(vs four only:", (()=>{const P=rows.filter(r=>r.pos).map(r=>r[k]),N=rows.filter(r=>r.cls==="four").map(r=>r[k]);let c=0;for(const p of P)for(const n of N)c+=p>n?1:p===n?.5:0;return (c/(P.length*N.length)).toFixed(3)})()+")");
// threshold scan: openPalm = 4 ext AND (t2>.55 OR spreadAll>T); report palm/stop recall and false-trigger on CLEAN + four + no_gesture
const q=(c)=>rows.filter(r=>r.cls===c);
const CLEAN=["ok","peace","peace_inverted","rock","three","three2","three3","two_up","two_up_inverted","stop_inverted"];
const rate=(cs,fn)=>{const R=cs.flatMap(q);return R.length?(R.filter(fn).length/R.length):NaN}; // among 4-ext hands only
console.log("note: rates below are among hands passing the 4-finger gate; counts of all hands per class needed for absolute rates");
for (const T of [999,40,45,50,55,60]) for (const key of ["spreadAll","tipGap"]) { const t = key==="tipGap"? T/100/2.5 : T; if(key==="tipGap"&&T===999) continue;
  const fn=(r)=>r.t2>.55||r[key]>(T===999?1e9:t);
  console.log(key,T===999?"base":t.toFixed(2),"palm",rate(["palm"],fn).toFixed(2),"stop",rate(["stop"],fn).toFixed(2),"four",rate(["four"],fn).toFixed(2),"clean",rate(CLEAN,fn).toFixed(2),"nogest",rate(["no_gesture"],fn).toFixed(2)); }
