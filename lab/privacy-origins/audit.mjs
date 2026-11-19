// Static audit: every origin the shipped app files can contact, vs charter criterion 4.
// usage: node audit.mjs <repo-root>
import fs from "node:fs"; import path from "node:path";
const root = process.argv[2] || ".";
const files = ["index.html", "app.js", "memes.js", "cats.js", "style.css", "sw.js", "manifest.webmanifest"];
const ALLOW = new Set(["cdn.jsdelivr.net", "storage.googleapis.com"]); // charter criterion 4
const IGNORE = new Set(["www.w3.org"]); // SVG xmlns, never fetched
const found = {};
for (const f of files) {
  const t = fs.readFileSync(path.join(root, f), "utf8");
  for (const m of t.matchAll(/https?:\/\/([a-z0-9.-]+)([^"'\s)]*)/gi)) {
    const h = m[1]; if (IGNORE.has(h)) continue;
    (found[h] ??= []).push(`${f}: ${m[0].slice(0, 90)}`);
  }
}
let bad = 0;
for (const [h, uses] of Object.entries(found)) {
  const ok = ALLOW.has(h); if (!ok) bad++;
  console.log(`${ok ? "ALLOWED " : "OUTSIDE "} ${h}  (${uses.length} refs)`); uses.forEach((u) => console.log("    " + u));
}
// SW host regex is unanchored: which hostnames would it treat as 'heavy, cache-first, opaque ok'?
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const re = new RegExp(sw.match(/const heavy = \/(.*)\/\.test/)[1]);
for (const h of ["cdn.jsdelivr.net", "storage.googleapis.com", "storage.googleapis.com.evil.example", "fonts.gstatic.com", "example.com"])
  console.log(`sw heavy(${h}) = ${re.test(h)}`);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
console.log("referrer-policy meta:", /meta name=.referrer/.test(html), "| CSP meta:", /Content-Security-Policy/i.test(html));
console.log("outside-allowlist origins:", bad);
