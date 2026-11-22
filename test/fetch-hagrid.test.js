import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { crc32, fetchHagrid, manifest, selectEntries, defaultDest } from "../demo/fetch-hagrid.mjs";

// Minimal zip writer (deflate, no zip64) shaped like the HaGRIDv2 annotations zip.
function makeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text), comp = deflateRawSync(data), n = Buffer.from(name);
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, n, comp); centrals.push(ch, n);
    offset += 30 + n.length + comp.length;
  }
  const cd = Buffer.concat(centrals), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const FILES = [
  ["annotations/", ""],
  ["annotations/train/like.json", JSON.stringify({ a: randomBytes(300000).toString("base64") })],
  ["annotations/test/.ipynb_checkpoints/like-checkpoint.json", "{}"],
  ["annotations/test/like.json", JSON.stringify({ id1: { labels: ["like"], hand_landmarks: [[[0.1, 0.2]]] } })],
  ["annotations/test/no_gesture.json", JSON.stringify({ id2: { labels: ["no_gesture"], hand_landmarks: [[]] } })],
  ["annotations/val/like.json", "{}"],
];
const TEST_FILES = FILES.filter(([n]) => /^annotations\/test\/[^/]+\.json$/.test(n));
const sha = (s) => createHash("sha256").update(s).digest("hex");
const PIN = sha(manifest(TEST_FILES.map(([name, text]) => ({ name, sha256: sha(text) }))));

let server, base, zip, requests, served, ranges = true;
before(async () => {
  zip = makeZip(FILES);
  server = createServer((req, res) => {
    requests++;
    const m = /bytes=(\d+)-(\d+)/.exec(req.headers.range || "");
    if (req.method === "HEAD" || !m || !ranges) {
      res.writeHead(200, { "Content-Length": zip.length });
      return res.end(req.method === "HEAD" ? undefined : zip);
    }
    const s = +m[1], e = Math.min(+m[2], zip.length - 1);
    served += e - s + 1;
    res.writeHead(206, { "Content-Length": e - s + 1, "Content-Range": `bytes ${s}-${e}/${zip.length}` });
    res.end(zip.subarray(s, e + 1));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/annotations.zip`;
});
after(() => server.close());

function fresh() {
  requests = 0; served = 0; ranges = true;
  const root = mkdtempSync(join(tmpdir(), "hagrid-test-"));
  return { root, dest: join(root, "hagrid-v2") };
}

test("fetches only annotations/test/*.json via Range, skips .ipynb_checkpoints, pins sha256", async (t) => {
  const { root, dest } = fresh();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const r = await fetchHagrid({ url: base, dest, expect: PIN });
  assert.equal(r.sha256, PIN);
  assert.equal(r.skipped, false);
  assert.deepEqual(readdirSync(join(dest, "annotations", "test")).sort(), ["like.json", "no_gesture.json"]);
  for (const [name, text] of TEST_FILES) assert.equal(readFileSync(join(dest, name), "utf8"), text);
  assert.ok(!existsSync(join(dest, "annotations", "train")));
  // the train entry is large; Range means we never pulled it
  assert.ok(served < zip.length / 2, `served ${served} of ${zip.length} bytes`);
  // SHA256SUMS is sha256sum -c compatible
  const sums = readFileSync(join(dest, "SHA256SUMS"), "utf8");
  assert.match(sums, /^[0-9a-f]{64} {2}annotations\/test\/like\.json\n/m);
  assert.equal(sha(sums), PIN);
  assert.deepEqual(readdirSync(root), ["hagrid-v2"], "no temp dir left behind");
});

test("second run with matching files downloads nothing", async (t) => {
  const { root, dest } = fresh();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  await fetchHagrid({ url: base, dest, expect: PIN });
  requests = 0;
  const r = await fetchHagrid({ url: base, dest, expect: PIN });
  assert.equal(r.skipped, true);
  assert.equal(requests, 0);
});

test("a tampered cached file is detected and re-fetched", async (t) => {
  const { root, dest } = fresh();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  await fetchHagrid({ url: base, dest, expect: PIN });
  writeFileSync(join(dest, "annotations/test/like.json"), "{}");
  const r = await fetchHagrid({ url: base, dest, expect: PIN });
  assert.equal(r.skipped, false);
  assert.equal(readFileSync(join(dest, "annotations/test/like.json"), "utf8"), TEST_FILES[0][1]);
});

test("checksum mismatch fails loudly and leaves the destination untouched", async (t) => {
  const { root, dest } = fresh();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  await assert.rejects(fetchHagrid({ url: base, dest, expect: "0".repeat(64) }), /CHECKSUM MISMATCH[\s\S]*got +sha256 [0-9a-f]{64}/);
  assert.deepEqual(readdirSync(root), []);
});

test("a server without Range support fails instead of downloading the whole zip", async (t) => {
  const { root, dest } = fresh();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  ranges = false;
  await assert.rejects(fetchHagrid({ url: base, dest, expect: PIN }), /expected 206/);
});

test("selectEntries keeps top-level test JSONs only", () => {
  const names = FILES.map(([name]) => ({ name }));
  assert.deepEqual(selectEntries(names).map((e) => e.name), TEST_FILES.map(([n]) => n));
});

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("default destination is the shared cache, outside the repo", () => {
  assert.equal(defaultDest({ HOME: "/h" }), "/h/.cache/agent-data/kitty-pose/hagrid-v2");
  assert.equal(defaultDest({ HOME: "/h", HAGRID_DIR: "/x" }), "/x");
});
