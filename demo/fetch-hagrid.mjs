#!/usr/bin/env node
// Fetch the HaGRIDv2 test-split annotations (with MediaPipe hand landmarks) for the M1 gesture eval.
//
// Dataset: HaGRID / HaGRIDv2, Kapitanov et al., "HaGRID - HAnd Gesture Recognition Image Dataset", WACV 2024,
// https://github.com/hukenovs/hagrid (license: a CC BY-SA 4.0 variant, see the repo's license/en_us.pdf).
// Only v2 has `hand_landmarks`. The annotation zip is 719 MB, but the server supports HTTP Range,
// so we read the zip's central directory and fetch only `annotations/test/*.json` (~106 MB compressed).
// `.ipynb_checkpoints/` entries in the zip are junk and are skipped.
//
// Output goes to the shared cache (never the worktree): $HAGRID_DIR, else
// $HOME/.cache/agent-data/kitty-pose/hagrid-v2/. It holds annotations/test/<class>.json and SHA256SUMS
// (`sha256sum -c SHA256SUMS` works). The sha256 of SHA256SUMS is pinned below; a mismatch exits 1.
// If the files are already there and match, nothing is downloaded.
//
// Usage: node demo/fetch-hagrid.mjs [--dest DIR] [--url URL] [--expect SHA256|--no-verify]
// No dependencies: Node >= 20 (global fetch, zlib).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

export const HAGRID_V2_URL =
  "https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/hagrid_v2/annotations_with_landmarks/annotations.zip";
// sha256 of the SHA256SUMS manifest of the 34 extracted annotations/test/*.json files.
export const PINNED_SHA256 = "5ce00cd2609e182947e89535dc5e325c9a1c18b9639dc6e676ca4db595986012";
export const DEFAULT_PREFIX = "annotations/test/";

// ---- CRC-32 (zip), so we do not depend on zlib.crc32 (Node >= 20.15 / 22.2) ----
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// ---- HTTP Range reader ----
export function rangeReader(url, { retries = 3, fetchImpl = globalThis.fetch } = {}) {
  let bytes = 0;
  async function withRetry(what, fn) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (attempt >= retries) throw new Error(`${what} failed after ${attempt} attempts: ${e.message}`);
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
  return {
    get bytes() { return bytes; },
    size: () =>
      withRetry(`HEAD ${url}`, async () => {
        const r = await fetchImpl(url, { method: "HEAD" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const n = Number(r.headers.get("content-length"));
        if (!Number.isSafeInteger(n) || n <= 0) throw new Error("no Content-Length");
        return n;
      }),
    read: (start, end) => // inclusive end
      withRetry(`GET ${url} bytes=${start}-${end}`, async () => {
        const r = await fetchImpl(url, { headers: { Range: `bytes=${start}-${end}` } });
        if (r.status !== 206) throw new Error(`expected 206 Partial Content, got HTTP ${r.status} (no Range support?)`);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length !== end - start + 1) throw new Error(`short read: ${buf.length} of ${end - start + 1} bytes`);
        bytes += buf.length;
        return buf;
      }),
  };
}

// ---- Zip central directory ----
// Returns [{ name, method, crc, compSize, size, offset }] plus the offset where the central directory starts.
export async function readCentralDirectory(reader, total) {
  const tailLen = Math.min(total, 22 + 0xffff);
  const tail = await reader.read(total - tailLen, total - 1);
  const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("not a zip: end of central directory not found");
  let count = tail.readUInt16LE(eocd + 10);
  let cdSize = tail.readUInt32LE(eocd + 12);
  let cdOffset = tail.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    // zip64: locator sits right before the EOCD record
    const loc = eocd - 20;
    if (loc < 0 || tail.readUInt32LE(loc) !== 0x07064b50) throw new Error("zip64 locator not found");
    const z64off = Number(tail.readBigUInt64LE(loc + 8));
    const z64 = await reader.read(z64off, z64off + 55);
    if (z64.readUInt32LE(0) !== 0x06064b50) throw new Error("bad zip64 end of central directory");
    count = Number(z64.readBigUInt64LE(32));
    cdSize = Number(z64.readBigUInt64LE(40));
    cdOffset = Number(z64.readBigUInt64LE(48));
  }
  const cd = await reader.read(cdOffset, cdOffset + cdSize - 1);
  const entries = [];
  for (let p = 0, i = 0; i < count; i++) {
    if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error(`bad central directory entry ${i}`);
    const e = {
      method: cd.readUInt16LE(p + 10),
      crc: cd.readUInt32LE(p + 16),
      compSize: cd.readUInt32LE(p + 20),
      size: cd.readUInt32LE(p + 24),
      offset: cd.readUInt32LE(p + 42),
    };
    const nameLen = cd.readUInt16LE(p + 28), extraLen = cd.readUInt16LE(p + 30), commentLen = cd.readUInt16LE(p + 32);
    e.name = cd.toString("utf8", p + 46, p + 46 + nameLen);
    // zip64 extended info: fields present only for values that are 0xffffffff, in this order
    for (let x = p + 46 + nameLen, xe = x + extraLen; x + 4 <= xe; ) {
      const id = cd.readUInt16LE(x), len = cd.readUInt16LE(x + 2);
      if (id === 0x0001) {
        let q = x + 4;
        for (const k of ["size", "compSize", "offset"]) {
          if (e[k] === 0xffffffff) { e[k] = Number(cd.readBigUInt64LE(q)); q += 8; }
        }
      }
      x += 4 + len;
    }
    entries.push(e);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { entries, cdOffset };
}

// Pick annotations/test/*.json, skipping directories and .ipynb_checkpoints.
export function selectEntries(entries, prefix = DEFAULT_PREFIX) {
  return entries.filter(
    (e) =>
      e.name.startsWith(prefix) &&
      e.name.endsWith(".json") &&
      !e.name.split("/").includes(".ipynb_checkpoints") &&
      !e.name.slice(prefix.length).includes("/"),
  );
}

// Fetch and decompress one entry. `end` is the byte after the entry (next entry's offset or the central directory).
export async function extractEntry(reader, e, end) {
  const buf = await reader.read(e.offset, end - 1);
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error(`${e.name}: bad local header`);
  const start = 30 + buf.readUInt16LE(26) + buf.readUInt16LE(28);
  const comp = buf.subarray(start, start + e.compSize);
  if (comp.length !== e.compSize) throw new Error(`${e.name}: truncated data`);
  let data;
  if (e.method === 0) data = comp;
  else if (e.method === 8) data = inflateRawSync(comp);
  else throw new Error(`${e.name}: unsupported compression method ${e.method}`);
  if (data.length !== e.size) throw new Error(`${e.name}: size ${data.length}, expected ${e.size}`);
  if (crc32(data) !== e.crc) throw new Error(`${e.name}: CRC-32 mismatch`);
  return data;
}

// `sha256sum`-style manifest, sorted by path; its own sha256 is the pinned checksum.
export function manifest(files /* [{ name, sha256 }] */) {
  return [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((f) => `${f.sha256}  ${f.name}\n`).join("");
}

// Recompute SHA256SUMS from the files on disk; returns its sha256, or null if anything is missing.
export function verifyDir(dir) {
  const sumsPath = join(dir, "SHA256SUMS");
  if (!existsSync(sumsPath)) return null;
  const files = [];
  for (const line of readFileSync(sumsPath, "utf8").split("\n").filter(Boolean)) {
    const name = line.slice(66);
    const p = join(dir, name);
    if (!existsSync(p)) return null;
    files.push({ name, sha256: sha256(readFileSync(p)) });
  }
  return files.length ? sha256(manifest(files)) : null;
}

export async function fetchHagrid({
  url = HAGRID_V2_URL,
  dest,
  expect = PINNED_SHA256, // null: do not verify (used to compute the pin)
  prefix = DEFAULT_PREFIX,
  concurrency = 4,
  fetchImpl,
  log = () => {},
} = {}) {
  dest = resolve(dest);
  if (expect && verifyDir(dest) === expect) {
    log(`up to date: ${dest} (sha256 ${expect})`);
    return { dest, sha256: expect, skipped: true, bytes: 0, files: null };
  }
  const reader = rangeReader(url, { fetchImpl });
  const total = await reader.size();
  const { entries, cdOffset } = await readCentralDirectory(reader, total);
  const picked = selectEntries(entries, prefix);
  if (!picked.length) throw new Error(`no ${prefix}*.json entries in ${url}`);
  // an entry ends where the next one (by offset) begins
  const offsets = [...new Set(entries.map((e) => e.offset)), cdOffset].sort((a, b) => a - b);
  const endOf = (e) => offsets[offsets.indexOf(e.offset) + 1];
  const compTotal = picked.reduce((s, e) => s + e.compSize, 0);
  log(`${url}: ${total} bytes, ${entries.length} entries; fetching ${picked.length} ${prefix}*.json (${compTotal} bytes)`);

  const tmp = `${dest}.part-${process.pid}`;
  rmSync(tmp, { recursive: true, force: true });
  const files = [];
  try {
    let next = 0;
    const worker = async () => {
      while (next < picked.length) {
        const e = picked[next++];
        const data = await extractEntry(reader, e, endOf(e));
        const p = join(tmp, e.name);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, data);
        files.push({ name: e.name, sha256: sha256(data), size: data.length });
        log(`  ${e.name} ${data.length} bytes`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, picked.length) }, worker));
    const sums = manifest(files);
    const got = sha256(sums);
    if (expect && got !== expect) {
      throw new Error(
        `CHECKSUM MISMATCH for ${prefix}*.json from ${url}\n  expected sha256 ${expect}\n  got      sha256 ${got}\n` +
          `The upstream data changed or the download is corrupt. Nothing was written to ${dest}.`,
      );
    }
    writeFileSync(join(tmp, "SHA256SUMS"), sums);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    renameSync(tmp, dest);
    return { dest, sha256: got, skipped: false, bytes: reader.bytes, files };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export function defaultDest(env = process.env) {
  return env.HAGRID_DIR || join(env.HOME || homedir(), ".cache", "agent-data", "kitty-pose", "hagrid-v2");
}

async function main(argv) {
  const opt = { dest: defaultDest(), url: HAGRID_V2_URL, expect: PINNED_SHA256 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dest") opt.dest = argv[++i];
    else if (a === "--url") opt.url = argv[++i];
    else if (a === "--expect") opt.expect = argv[++i];
    else if (a === "--no-verify") opt.expect = null;
    else {
      console.error("usage: node demo/fetch-hagrid.mjs [--dest DIR] [--url URL] [--expect SHA256|--no-verify]");
      return 2;
    }
  }
  const t0 = Date.now();
  try {
    const r = await fetchHagrid({ ...opt, log: (m) => console.error(m) });
    if (!r.skipped) {
      console.error(`fetched ${r.bytes} bytes in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${r.files.length} files`);
      if (!opt.expect) console.error("NOT VERIFIED (--no-verify)");
    }
    console.log(`${r.dest}\nsha256 ${r.sha256}`);
    return 0;
  } catch (e) {
    console.error(`\nERROR: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
