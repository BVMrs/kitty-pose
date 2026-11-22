// Face regression: replays per-frame face/hand inputs dumped from real clips (demo/face-dump.mjs) through memes.js
// and checks that each labelled clip segment shows its meme. Dumps: test/fixtures/face/ (openly licensed clips,
// committed) and $KITTY_FACE_DUMPS or ~/.cache/agent-data/kitty-pose/face-dumps/ (e.g. the owner's own clips).
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createChooser, faceFeatures, handFeatures } from "../memes.js";
import { BITS, BLOCK, FORMAT, LANDMARKS, checkSegments, decodeIndex, dumpsDir, encodeIndex, findDumps, replay, stampFrame } from "../demo/face-trace.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("frame-index barcode survives a round trip through an I420 frame", () => {
  const w = 320, h = 240, frame = Buffer.alloc((w * h * 3) / 2, 90);
  for (const i of [0, 1, 89, 1234, 65535]) {
    stampFrame(frame, w, h, i);
    const bits = [];
    for (let k = 0; k < BITS; k++) bits.push(frame[(h - BLOCK / 2) * w + k * BLOCK + BLOCK / 2] > 128 ? 1 : 0);
    assert.equal(decodeIndex(bits), i);
  }
});

test("a corrupt barcode decodes to null, not a wrong index", () => {
  const bits = encodeIndex(300);
  bits[3] ^= 1;
  assert.equal(decodeIndex(bits), null);
  assert.equal(decodeIndex(bits.slice(1)), null);
});

test("faceFeatures/handFeatures read only the face landmarks a dump keeps", () => {
  const read = new Set();
  const pts = Array.from({ length: 478 }, (_, i) => ({ x: 0.3 + (i % 50) / 120, y: 0.2 + i / 800, z: 0 }));
  const lm = new Proxy(pts, { get(t, k) { if (/^\d+$/.test(k)) read.add(+k); return t[k]; } });
  const h = (y) => Array.from({ length: 21 }, (_, i) => ({ x: 0.4 + i / 100, y: y - i / 100, z: 0 }));
  faceFeatures({}, lm);
  handFeatures([h(0.5), h(0.1)], lm);                      // one hand near the chin, one above the head
  handFeatures([h(0.6)], lm);
  assert.deepEqual([...read].filter((i) => !LANDMARKS.includes(i)), [], "update LANDMARKS in demo/face-trace.js and re-dump");
});

// A synthetic dump: 30 fps, 1 s neutral, then 1.5 s mouth wide open.
const NAMES = ["jawOpen", "eyeWideLeft", "eyeWideRight"];
const LM = LANDMARKS.map((i) => [0.5 + (i === 263 ? 0.1 : i === 33 ? -0.1 : i === 454 ? 0.2 : i === 234 ? -0.2 : 0), 0.5, 0]);
const synthetic = (segments) => ({
  format: FORMAT, landmarks: LANDMARKS, blendshapes: NAMES, segments,
  frames: Array.from({ length: 75 }, (_, k) => ({ t: k / 30, now: k * 100, b: [k < 30 ? 0.02 : 0.8, 0, 0], lm: LM, hands: [] })),
});

test("replay of a synthetic dump: neutral stays stare, mouth open shows pop", () => {
  const d = synthetic([{ from: 0, to: 1, meme: "stare" }, { from: 1, to: 2.5, meme: "pop" }]);
  const w = replay(d);
  assert.equal(w[29], "stare");
  assert.equal(w.at(-1), "pop");
  assert.deepEqual(checkSegments(d, w).map((s) => s.ok), [true, true]);
  assert.deepEqual(checkSegments(synthetic([{ from: 1, to: 2.5, meme: "smile" }])).map((s) => s.ok), [false]);
  assert.deepEqual(checkSegments(synthetic([{ from: 1, to: 2.5, meme: ["smile", "pop"] }])).map((s) => s.ok), [true]);
});

test("replay clocks: clip time vs the time the app saw", () => {
  const d = synthetic([]);
  // app clock 100 ms per frame: the 220 ms hold passes after 3 frames instead of 7
  assert.ok(replay(d, { clock: "app" }).indexOf("pop") < replay(d).indexOf("pop"));
});

test("a too-short segment fails rather than passing on no evidence", () => {
  const [s] = checkSegments(synthetic([{ from: 2.4, to: 2.45, meme: "pop" }]));
  assert.equal(s.ok, false);
  assert.ok(s.n < 3);
});

test("the chooser holds a new meme ~0.2 s before showing it", () => {
  const c = createChooser(), pop = { ...faceFeatures({ jawOpen: 0.9 }), ...handFeatures([]), face: true };
  let changedAt = null;
  for (let k = 0; k < 20 && changedAt === null; k++) if (c.step(pop, k * 33)) changedAt = k * 33;
  assert.equal(c.current, "pop");
  assert.ok(changedAt > 220 && changedAt < 400, `changed at ${changedAt} ms`);
});

// ---------- labelled dumps from real clips ----------
const fixtures = findDumps([join(ROOT, "test", "fixtures", "face")]);
const seen = new Set(fixtures.map((x) => x.dump.clip.sha256));
const local = findDumps([dumpsDir()]).filter((x) => !seen.has(x.dump.clip.sha256));
const dumps = [...fixtures, ...local];

if (!dumps.some((x) => x.dump.segments?.length)) test("labelled face clips", { skip: "no labelled dumps (see docs/DEMO.md)" }, () => {});
for (const { path, dump } of dumps) {
  const name = relative(ROOT, path).startsWith("..") ? path : relative(ROOT, path);
  const winners = replay(dump);
  test(`${name}: dump is complete`, () => {
    assert.equal(dump.format, FORMAT);
    assert.deepEqual(dump.landmarks, LANDMARKS);
    assert.ok(dump.blendshapes.includes("jawOpen") && dump.blendshapes.length === 52, "52 MediaPipe blendshapes");
    assert.ok(dump.frames.length > 0 && dump.frames.every((f, k) => k === 0 || f.t > dump.frames[k - 1].t), "frames in clip order");
  });
  for (const s of checkSegments(dump, winners)) {
    const want = [].concat(s.meme).join(" or ");
    test(`${name} ${s.from}..${s.to} s (${s.pose || "labelled"}) shows ${want}`, { todo: s.todo }, () => {
      assert.ok(s.n >= 3, `only ${s.n} frames in the segment`);
      assert.ok(s.ok, `${want} on ${(s.share * 100).toFixed(0)} % of ${s.n} frames; shown: ${s.top}`);
    });
  }
}
