// Real face frames (k76 dumps: RAVDESS acted emotions + Hadjikhani clips) x real HaGRID hands -> which meme shows, master vs hand-veto patch.
// usage: node sim.mjs <annotations test dir> <face dump dir>
import fs from "node:fs";
import { MEMES, faceFeatures, handFeatures } from "../../memes.js";
const [adir, ddir] = process.argv.slice(2);
let seed = 5; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const ASP = 0.75;   // 72% of HaGRID images are 3:4 portrait (image-aspect-recall)
const MAP = { like: "thumbsUp", call: "shaka", fist: "fist", one: "pointing", palm: "openPalm", stop: "openPalm" };
const HAND_MEME = { thumbsUp: "thumbs", shaka: "shaka", fist: "fistbump", pointing: "point", openPalm: "stop" };
// hands by label: 5 mapped gestures + "unmapped" (peace, ok, rock, ...; no_gesture excluded)
const hands = { thumbsUp: [], shaka: [], fist: [], pointing: [], openPalm: [], unmapped: [] };
for (const f of fs.readdirSync(adir)) {
  const cls = f.replace(".json", ""); if (cls === "no_gesture") continue;
  const j = JSON.parse(fs.readFileSync(`${adir}/${f}`)); const g = MAP[cls] ?? (["two_up", "two_up_inverted", "three", "three2", "four", "dislike", "ok", "peace", "peace_inverted", "rock", "mute", "grabbing", "grip", "holy", "point", "stop_inverted", "timeout", "take_picture", "little_finger", "middle_finger", "three3", "xsign", "hand_heart", "hand_heart2", "thumb_index", "thumb_index2", "heart", "heart2", "grabbing", "palm_inverted", "call_inverted"].includes(cls) ? "unmapped" : null);
  if (!g) continue;
  for (const k in j) { const e = j[k]; if (e.labels.length !== 1) continue; const lm = e.hand_landmarks?.[0]; if (lm?.length === 21) hands[g].push(lm.map(([x, y]) => ({ x, y }))); }
}
const GEST = ["thumbsUp", "shaka", "openPalm", "twoPalms", "fist", "handsUp", "pointing"];
const VETO = new Set(["pop", "smile", "smug", "side-eye", "huh", "sleepy", "hiss"]);
const veto = (f) => 1 - Math.max(...GEST.map((g) => f[g]));
function winner(f, patched) {
  let best = "stare", bs = -1; const sc = {};
  for (const m of MEMES) { let s = m.score(f); if (patched && VETO.has(m.id)) s *= veto(f); sc[m.id] = s; if (s > bs) { bs = s; best = m.id; } }
  return bs < 0.35 ? "stare" : best;
}
// face frames
const frames = [];
for (const fn of fs.readdirSync(ddir).filter((x) => x.endsWith(".dump.json"))) {
  const d = JSON.parse(fs.readFileSync(`${ddir}/${fn}`)); const names = d.blendshapes;
  const label = fn.startsWith("rav-") ? ({ "01": "neutral", "04": "sad", "05": "angry", "06": "fearful" }[fn.split("-")[3]] ?? fn.split("-")[3]) : fn.split("-")[1].replace(".dump.json", "");
  for (const fr of d.frames) { if (!fr.lm || !fr.b) continue; const b = Object.fromEntries(names.map((n, i) => [n, fr.b[i]]));
    frames.push({ label, f: faceFeatures(b, fr.lm) }); }
}
const labels = [...new Set(frames.map((x) => x.label))];
console.log("face frames", frames.length, Object.fromEntries(labels.map((l) => [l, frames.filter((x) => x.label === l).length])));
console.log("hands", Object.fromEntries(Object.entries(hands).map(([k, v]) => [k, v.length])));
const N = 20;   // hands sampled per gesture, each paired with every face frame
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const res = {};  // [gesture][label] -> {base:{hand,face,other}, pat:{...}}
const faceOnly = (f) => ({ ...f, thumbsUp: 0, pointing: 0, openPalm: 0, twoPalms: 0, fist: 0, shaka: 0, handAtChin: 0, handsUp: 0, anyHand: 0 });
const top = {}, lost = {};  // face-only winner per label for reference
for (const x of frames) { const w = winner(faceOnly(x.f), false); (top[x.label] ??= {})[w] = (top[x.label][w] || 0) + 1; }
for (const g of Object.keys(hands)) {
  const hs = Array.from({ length: N }, () => pick(hands[g]));
  for (const x of frames) for (const h of hs) {
    const f = { ...x.f, ...handFeatures([h], null, ASP) };
    const want = g === "unmapped" ? null : HAND_MEME[g];
    const flags = GEST.some((k) => f[k]);
    const fo = winner(faceOnly(x.f), false), b = winner(f, false), p = winner(f, true);
    // gestures: only frames where handFeatures recognises the gesture (isolates the face-vs-hand conflict from hand recall);
    // unmapped: only frames whose face-only meme is not the default (there is an expression to lose)
    if (want ? !f[g] : fo === "stare") continue;
    const r = (((res[g] ??= {})[x.label] ??= { n: 0, base: 0, pat: 0 }));
    r.n++; const key = g + " " + (want ? (b === want ? "hand" : b) : (b === fo ? "face" : b)); lost[key] = (lost[key] || 0) + 1; const kp = "P " + g + " " + (want ? (p === want ? "hand" : p) : (p === fo ? "face" : p)); lost[kp] = (lost[kp] || 0) + 1;
    if (want) { if (b === want) r.base++; if (p === want) r.pat++; }
    else { if (b === fo) r.base++; if (p === fo) r.pat++; }   // unmapped: does the face-only meme survive?
  }
}
console.log("\nface-only winner by label:"); for (const [l, o] of Object.entries(top)) console.log(" ", l, JSON.stringify(o));
console.log("\n% of recognised-gesture frames where the HAND meme shows (unmapped row: of expression frames, the face-only meme survives), master -> veto patch");
for (const g of Object.keys(hands)) {
  const row = labels.map((l) => { const r = res[g]?.[l] ?? {n:0,base:0,pat:0}; return `${l} ${r.n ? (100 * r.base / r.n).toFixed(0) : '-'}->${r.n ? (100 * r.pat / r.n).toFixed(0) : '-'} (n${r.n})`; });
  const all = labels.reduce((a, l) => { const r = res[g]?.[l] ?? {n:0,base:0,pat:0}; return [a[0] + r.base, a[1] + r.pat, a[2] + r.n]; }, [0, 0, 0]);
  console.log(g.padEnd(9), row.join(" | "), `|| ALL ${(100 * all[0] / all[2]).toFixed(1)}->${(100 * all[1] / all[2]).toFixed(1)}`);
}

console.log("\nwho shows (all labels pooled; P = patched)");
for (const g of Object.keys(hands)) for (const pre of ["", "P "]) { const e = Object.entries(lost).filter(([k]) => k.startsWith(pre + g + " ")); const t = e.reduce((a, x) => a + x[1], 0); console.log(pre + g, e.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k.slice((pre + g).length + 1) + " " + (100 * v / t).toFixed(1)).join(", ")); }
