// Summarise results.json by region / meme, and list surviving mutants outside the score ramps.
// node report.mjs <memes.js> <results.json>
import fs from "node:fs";
const [mf, rf] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(rf));
const src = fs.readFileSync(mf, "utf8").split("\n");
const mark = (s) => src.findIndex((x) => x.includes(s)) + 1;
const B = { memes: mark("export const MEMES"), hands: mark("// --- hands ---"), hf: mark("Hand shape helpers"), ff: mark("export function faceFeatures"), ch: mark("The app's meme picker") };
const R = (l) => l < B.memes ? "helpers" : l < B.hands ? "face memes" : l < B.hf ? "hand memes+default" : l < B.ff ? "hand features" : l < B.ch ? "face features" : "chooser";
const isCat = (x) => /cat: \{/.test(src[x.line - 1]);
const t = {};
for (const x of r) { const k = isCat(x) ? "cat drawing params" : R(x.line); (t[k] ??= { n: 0, k: 0 }); t[k].n++; if (x.killed) t[k].k++; }
console.log("by region", t);
const per = {};
for (const x of r) {
  if (!/memes/.test(R(x.line)) || isCat(x)) continue;
  let l = x.line; while (l > 0 && !/\{ id: "/.test(src[l - 1])) l--;
  const id = (src[l - 1].match(/id: "([^"]+)"/) || [])[1];
  (per[id] ??= { n: 0, k: 0 }); per[id].n++; if (x.killed) per[id].k++;
}
console.log("per meme score lines (killed/total)", Object.fromEntries(Object.entries(per).map(([k, v]) => [k, `${v.k}/${v.n}`])));
for (const x of r.filter((x) => !x.killed && /helpers|features|chooser/.test(R(x.line)))) console.log(x.line, R(x.line), x.kind, x.desc, "|", src[x.line - 1].trim().slice(0, 100));
