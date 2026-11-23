// Mutation test of memes.js against the repo's test suite. Usage: node mutate.mjs <repo> <scratch-dir> [testfiles...]
// Mutants: every numeric literal x1.25 and x0.8 (non 0/1 literals; 0 -> 0.1 skipped), plus operator flips
// (< > swap, && ||, `not(` removed). Each mutant is a copy of the repo with memes.js replaced; `node --test` run there.
import fs from "node:fs"; import path from "node:path"; import { spawnSync, spawn } from "node:child_process";
const [repo, scratch, ...tests] = process.argv.slice(2);
const src = fs.readFileSync(path.join(repo, "memes.js"), "utf8");
// skip comment lines (full-line comments and trailing // comments)
const lines = src.split("\n"); let off = 0; const spans = [];
const codeLine = [];
for (const ln of lines) { const ci = ln.indexOf("//"); codeLine.push([off, ci < 0 ? ln.length : ci]); off += ln.length + 1; }
const inCode = (i) => codeLine.some(([s, n]) => i >= s && i < s + n);
const muts = [];
for (const m of src.matchAll(/(?<![\w."'#-])\d*\.?\d+(?![\w"'])/g)) {
  if (!inCode(m.index)) continue; const v = +m[0]; if (v === 0 || v === 1) continue;
  const line = src.slice(0, m.index).split("\n").length;
  for (const k of [1.25, 0.8]) muts.push({ kind: "num", line, at: m.index, len: m[0].length, to: String(+(v * k).toPrecision(4)), desc: `${m[0]} -> ${+(v * k).toPrecision(4)}` });
}
for (const m of src.matchAll(/ not\(/g)) if (inCode(m.index)) muts.push({ kind: "not-removed", line: src.slice(0, m.index).split("\n").length, at: m.index + 1, len: 3, to: "", desc: "veto not(...) replaced by 1", fix: true });
for (const m of src.matchAll(/ [<>] /g)) if (inCode(m.index)) muts.push({ kind: "cmp", line: src.slice(0, m.index).split("\n").length, at: m.index + 1, len: 1, to: m[0][1] === "<" ? ">" : "<", desc: `${m[0].trim()} flipped` });
for (const m of src.matchAll(/ (&&|\|\|) /g)) if (inCode(m.index)) muts.push({ kind: "logic", line: src.slice(0, m.index).split("\n").length, at: m.index + 1, len: 2, to: m[1] === "&&" ? "||" : "&&", desc: `${m[1]} swapped` });
fs.mkdirSync(scratch, { recursive: true });
let results = [], i = 0;
const run = (mu, idx) => new Promise((res) => {
  const d = path.join(scratch, "m" + idx); fs.rmSync(d, { recursive: true, force: true });
  fs.cpSync(repo, d, { recursive: true, filter: (p) => !/\.git$|node_modules|\.agent-work|\/lab(\/|$)/.test(p) });
  let out = src.slice(0, mu.at) + mu.to + src.slice(mu.at + mu.len);
  if (mu.fix) { // replace the 'not(' call by a neutral helper: 'not0(' always returning 1
    out = src.slice(0, mu.at) + "not0" + src.slice(mu.at + 3); out = out.replace("const not = ", "const not0 = () => 1;\nconst not = "); }
  fs.writeFileSync(path.join(d, "memes.js"), out);
  const p = spawn("node", ["--test", ...tests.map((t) => path.join(d, t))], { cwd: d, stdio: ["ignore", "pipe", "pipe"] });
  let so = ""; p.stdout.on("data", (c) => (so += c)); p.stderr.on("data", () => {});
  const to = setTimeout(() => p.kill(), 30000);
  p.on("close", (code) => { clearTimeout(to); fs.rmSync(d, { recursive: true, force: true });
    res({ ...mu, killed: code !== 0, failed: (so.match(/^# fail (\d+)/m) || [])[1] }); });
});
const N = 6; let next = 0;
await Promise.all(Array.from({ length: N }, async () => { for (;;) { const k = next++; if (k >= muts.length) return; results[k] = await run(muts[k], k); } }));
fs.writeFileSync(path.join(scratch, "results.json"), JSON.stringify(results, null, 1));
const by = {}; for (const r of results) { (by[r.kind] ??= { n: 0, k: 0 }); by[r.kind].n++; if (r.killed) by[r.kind].k++; }
console.log("mutants", results.length, "killed", results.filter((r) => r.killed).length, by);
for (const r of results.filter((r) => !r.killed)) console.log(`L${r.line} ${r.kind} ${r.desc}`);
