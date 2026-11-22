import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ALL_CLASSES, AMBIGUOUS, GESTURES, MAPPED, NONE, NO_GESTURE, countFile, evaluateDir, formatReport, groupOf, main, score,
} from "../demo/eval-hagrid.js";

// Synthetic hand as HaGRIDv2 stores it: 21 [x, y] pairs, fingers up (same shape as test/memes.test.js).
function hand(ext, s = 0.1, at = [0.5, 0.8]) {
  const P = (dx, dy) => [at[0] + dx * s, at[1] + dy * s];
  const h = [P(0, 0), P(-0.4, -0.3), P(-0.7, -0.6)];
  h.push(ext[0] ? P(-0.8, -1.0) : P(-0.4, -0.75), ext[0] ? P(-0.85, -1.4) : P(-0.1, -0.8));
  [-0.3, 0, 0.3, 0.55].forEach((x, f) => {
    h.push(P(x, -1.0), P(x, -1.4));
    h.push(...(ext[f + 1] ? [P(x, -1.75), P(x, -2.05)] : [P(x, -1.2), P(x, -0.95)]));
  });
  return h;
}
const PALM = hand([1, 1, 1, 1, 1]), FIST = hand([0, 0, 0, 0, 0]), PEACE = hand([0, 1, 1, 0, 0]);

test("the 34 HaGRIDv2 classes fall into exactly one group each", () => {
  assert.equal(ALL_CLASSES.length, 34);
  assert.equal(new Set(ALL_CLASSES).size, 34);
  for (const c of ALL_CLASSES) assert.ok(groupOf(c), c);
  assert.equal(groupOf("no_gesture"), "no_gesture");
  assert.equal(groupOf("dislike"), "ambiguous");
  assert.equal(groupOf("peace"), "none");
  assert.equal(groupOf("like"), "mapped");
  assert.equal(groupOf("nope"), null);
  for (const g of Object.values(AMBIGUOUS)) assert.ok(GESTURES.includes(g));
  for (const g of Object.values(MAPPED)) assert.ok(GESTURES.includes(g));
  assert.ok(!NONE.includes(NO_GESTURE));
});

test("countFile counts only boxes of the file's class that have 21 landmarks", () => {
  const json = {
    a: { labels: ["fist", "no_gesture"], hand_landmarks: [FIST, PALM] },
    b: { labels: ["fist"], hand_landmarks: [[]] },               // MediaPipe failed
    c: { labels: ["fist"], hand_landmarks: [FIST.slice(0, 20)] }, // malformed
    d: { labels: ["fist", "fist"], hand_landmarks: [PALM, FIST] },
  };
  const { conf, skip } = countFile("fist", json);
  assert.deepEqual(conf, { fist: { fist: 2, openPalm: 1 } });
  assert.equal(skip.noLandmarks, 2);
});

test("look-alikes are not false triggers; no_gesture is reported on its own", () => {
  const r = score({
    fist: { fist: 8, none: 2 },
    palm: { openPalm: 5, none: 5 },
    dislike: { fist: 10 },                 // ambiguous: fires, not counted
    peace: { none: 9, fist: 1 },           // none: 1 false trigger
    ok: { none: 10 },
    no_gesture: { openPalm: 3, none: 1 },
  });
  assert.equal(r.gestures.fist.recall, 0.8);
  assert.equal(r.gestures.fist.precision, 8 / 19);
  assert.equal(r.gestures.openPalm.recall, 0.5);
  assert.deepEqual(r.gestures.openPalm.classes, ["palm", "stop"]);
  assert.deepEqual(
    { n: r.falseTrigger.n, triggered: r.falseTrigger.triggered, classes: r.falseTrigger.classes },
    { n: 20, triggered: 1, classes: ["ok", "peace"] });
  assert.deepEqual(r.noGesture, { n: 4, triggered: 3, rate: 0.75 });
  assert.equal(r.noneWithNoGesture.triggered, 4);
  assert.equal(r.allUnmapped.n, 34);
  assert.equal(r.allUnmapped.triggered, 14);
  assert.equal(r.ambiguous.dislike.looksLike, "fist");
  assert.equal(r.ambiguous.dislike.rate, 1);
  assert.ok(Number.isNaN(r.gestures.shaka.recall));     // no samples: n/a, not 0
});

test("an unknown class is an error, not a silent false trigger", () => {
  assert.throws(() => score({ new_class: { none: 1 } }), /new_class/);
});

test("evaluateDir reads class files and the report lists the ambiguous set", () => {
  const dir = mkdtempSync(join(tmpdir(), "eval-hagrid-"));
  try {
    writeFileSync(join(dir, "palm.json"), JSON.stringify({ x: { labels: ["palm"], hand_landmarks: [PALM] } }));
    writeFileSync(join(dir, "peace.json"), JSON.stringify({ y: { labels: ["peace"], hand_landmarks: [PEACE] } }));
    writeFileSync(join(dir, "dislike.json"), JSON.stringify({ z: { labels: ["dislike"], hand_landmarks: [FIST] } }));
    const r = evaluateDir(dir);
    assert.equal(r.files, 3);
    assert.equal(r.missing.length, 31);
    assert.equal(r.gestures.openPalm.recall, 1);
    assert.equal(r.falseTrigger.triggered, 0);
    assert.equal(r.ambiguous.dislike.triggered, 1);
    const text = formatReport(r);
    assert.match(text, /Look-alike \(ambiguous\) classes/);
    assert.match(text, /dislike\s+fist/);
    assert.match(text, /no_gesture\s+n\/a/);
    assert.match(text, /MISSING: /);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("main exits 1 with a hint when the data is not fetched", () => {
  const err = console.error; let msg = "";
  console.error = (m) => { msg += m; };
  try {
    assert.equal(main(["--dir", join(tmpdir(), "no-such-hagrid-dir")]), 1);
    assert.match(msg, /fetch-hagrid/);
  } finally { console.error = err; }
});
