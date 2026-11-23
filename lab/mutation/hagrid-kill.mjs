// For each mutant in results.json that SURVIVED the unit tests and sits in fingerState/handFeatures, re-run
// demo/eval-hagrid.js --json on the mutant and report the largest change in per-gesture recall/precision and in the
// false-trigger rate versus the unmutated code. A mutant "moves the HaGRID gate" if any number shifts by >= 0.005.
// node hagrid-kill.mjs <repo> <scratch> <results.json> <memes-from-line> <memes-to-line>
import fs from "node:fs"; import path from "node:path"; import { spawn, spawnSync } from "node:child_process";
const [repo, scratch, rf, from, to] = process.argv.slice(2);
const src = fs.readFileSync(path.join(repo, "memes.js"), "utf8");
const all = JSON.parse(fs.readFileSync(rf)).filter((r) => !r.killed && r.line >= +from && r.line <= +to);
// re-derive replacement text from the original mutation (kind, at, len, to) and apply
const apply = (mu) => {
  if (mu.fix) { const o = src.slice(0, mu.at) + "not0" + src.slice(mu.at + 3); return o.replace("const not = ", "const not0 = () => 1;\nconst not = "); }
  return src.slice(0, mu.at) + mu.to + src.slice(mu.at + mu.len);
};
const nums = (j) => { const o = {}; for (const [k, g] of Object.entries(j.gestures)) { o[k + ".recall"] = g.recall; o[k + ".prec"] = g.precision; } o.falseTrigger = j.falseTrigger.rate; return o; };
const ev = (cwd) => new Promise((res) => { const p = spawn("node", ["demo/eval-hagrid.js", "--json"], { cwd }); let so = ""; p.stdout.on("data", (c) => (so += c)); p.on("close", () => { try { res(nums(JSON.parse(so))); } catch { res(null); } }); });
const base = await ev(repo);
fs.mkdirSync(scratch, { recursive: true });
const out = []; let next = 0;
await Promise.all(Array.from({ length: 6 }, async (_, w) => {
  const d = path.join(scratch, "h" + w); fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(path.join(d, "demo"), { recursive: true }); for (const f of ["eval-hagrid.js", "fetch-hagrid.mjs"]) fs.copyFileSync(path.join(repo, "demo", f), path.join(d, "demo", f));
  fs.writeFileSync(path.join(d, "package.json"), '{"type":"module"}');
  for (;;) {
    const k = next++; if (k >= all.length) return; const mu = all[k];
    fs.writeFileSync(path.join(d, "memes.js"), apply(mu));
    const n = await ev(d); let worst = 0, which = "";
    if (!n) { out.push({ ...mu, worst: NaN, which: "eval crashed" }); continue; }
    for (const key of Object.keys(base)) { const dl = Math.abs(n[key] - base[key]); if (dl > worst) { worst = dl; which = key; } }
    out.push({ line: mu.line, desc: mu.desc, kind: mu.kind, worst: +worst.toFixed(4), which });
  }
}));
out.sort((a, b) => a.line - b.line);
for (const o of out) console.log(`L${o.line} ${o.kind} ${o.desc} | max shift ${o.worst} (${o.which})`);
const moved = out.filter((o) => o.worst >= 0.005 || Number.isNaN(o.worst)).length;
console.log(`survivors tested ${out.length}; move the HaGRID numbers by >=0.005: ${moved}; no visible effect: ${out.length - moved}`);
