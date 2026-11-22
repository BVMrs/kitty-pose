#!/usr/bin/env node
// Fetch the openly licensed face clips listed in demo/face-clips.json (CC BY 4.0 stimuli from Hadjikhani et al.,
// Sci Rep 2017, via Wikimedia Commons; ~0.5 MB in all) into $KITTY_FACE_CLIPS, default
// ~/.cache/agent-data/kitty-pose/face-clips/. Each file's sha256 is pinned in the manifest; a file that already
// matches is not downloaded again, a mismatch exits 1 and keeps nothing. Never into the repo.
// The owner's own clips go in the same folder (with NAME.labels.json) and are never committed.
// Usage: node demo/fetch-face-clips.mjs [--manifest FILE] [--dest DIR]

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cacheDir } from "./face-dump.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

export async function fetchFaceClips({ manifest = join(HERE, "face-clips.json"), dest = process.env.KITTY_FACE_CLIPS || cacheDir("face-clips"),
  fetchImpl = globalThis.fetch, log = () => {} } = {}) {
  const m = JSON.parse(readFileSync(manifest, "utf8"));
  mkdirSync(dest, { recursive: true });
  const out = [];
  for (const c of m.clips) {
    const path = join(dest, c.file);
    if (existsSync(path) && sha256(readFileSync(path)) === c.sha256) { log(`up to date: ${c.file}`); out.push({ path, fetched: 0 }); continue; }
    const r = await fetchImpl(c.url, { headers: { "user-agent": "kitty-pose-fetch/1.0" } });
    if (!r.ok) throw new Error(`${c.url}: HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const got = sha256(buf);
    if (got !== c.sha256) throw new Error(`CHECKSUM MISMATCH for ${c.file}\n  expected sha256 ${c.sha256}\n  got      sha256 ${got}\nNothing was written.`);
    writeFileSync(path + ".part", buf); renameSync(path + ".part", path);
    log(`fetched ${c.file} (${buf.length} bytes)`);
    out.push({ path, fetched: buf.length });
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = { log: (s) => console.error(s) };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--manifest") opt.manifest = a[++i];
    else if (a[i] === "--dest") opt.dest = a[++i];
    else { console.error("usage: node demo/fetch-face-clips.mjs [--manifest FILE] [--dest DIR]"); process.exit(2); }
  }
  fetchFaceClips(opt).then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });
}
