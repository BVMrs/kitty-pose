import { test } from "node:test";
import assert from "node:assert/strict";
import { MEMES, handFeatures, fingerState } from "../memes.js";
import { catSVG, PALETTES } from "../cats.js";

// Synthetic right hand, palm towards camera, fingers pointing up (image y grows downwards).
// ext: which fingers are extended [thumb, index, middle, ring, pinky]; at: wrist position.
function hand(ext, at = { x: 0.5, y: 0.8 }, s = 0.1) {
  const P = (dx, dy) => ({ x: at.x + dx * s, y: at.y + dy * s, z: 0 });
  const h = [P(0, 0)];
  // thumb: 1..4 out to the side, tip up when extended, folded across the palm when not
  h.push(P(-0.4, -0.3), P(-0.7, -0.6));
  h.push(ext[0] ? P(-0.8, -1.0) : P(-0.4, -0.75), ext[0] ? P(-0.85, -1.4) : P(-0.1, -0.8));
  const xs = [-0.3, 0, 0.3, 0.55];
  for (let f = 0; f < 4; f++) {
    const x = xs[f];
    h.push(P(x, -1.0), P(x, -1.4));                       // mcp, pip
    if (ext[f + 1]) h.push(P(x, -1.75), P(x, -2.05));     // dip, tip: straight up
    else h.push(P(x, -1.2), P(x, -0.95));                 // curled back towards the palm
  }
  return h;
}

const face = (() => {                                     // just the landmarks memes.js uses
  const f = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  f[10] = { x: 0.5, y: 0.3, z: 0 };                       // forehead top
  f[152] = { x: 0.5, y: 0.6, z: 0 };                      // chin
  return f;
})();

test("finger states from a synthetic hand", () => {
  const s = fingerState(hand([1, 1, 0, 0, 0]));
  assert.equal(s.index, true);
  assert.equal(s.middle, false);
});

test("thumbs up", () => {
  const f = handFeatures([hand([1, 0, 0, 0, 0])], face);
  assert.equal(f.thumbsUp, 1);
  assert.equal(f.pointing, 0);
  assert.equal(f.openPalm, 0);
});

test("pointing", () => {
  const f = handFeatures([hand([0, 1, 0, 0, 0])], face);
  assert.equal(f.pointing, 1);
  assert.equal(f.thumbsUp, 0);
});

test("open palm", () => {
  assert.equal(handFeatures([hand([1, 1, 1, 1, 1])], face).openPalm, 1);
});

test("hand at the chin vs far away", () => {
  const near = handFeatures([hand([0, 0, 0, 0, 0], { x: 0.5, y: 0.72 }, 0.06)], face).handAtChin;
  const far = handFeatures([hand([0, 0, 0, 0, 0], { x: 0.9, y: 0.95 }, 0.06)], face).handAtChin;
  assert.ok(near > 0.7, `near ${near}`);
  assert.ok(far < 0.1, `far ${far}`);
});

test("both hands above the head", () => {
  const up = [hand([1, 1, 1, 1, 1], { x: 0.3, y: 0.25 }, 0.05), hand([1, 1, 1, 1, 1], { x: 0.7, y: 0.25 }, 0.05)];
  assert.equal(handFeatures(up, face).handsUp, 1);
  assert.equal(handFeatures([up[0]], face).handsUp, 0);
});

const base = { face: true, jawOpen: 0, eyeWide: 0, blink: 0, squint: 0, smile: 0, frown: 0, browInnerUp: 0, browOuterUp: 0, browUp: 0, browDown: 0,
  gazeSide: 0, roll: 0, yaw: 0, thumbsUp: 0, pointing: 0, openPalm: 0, twoPalms: 0, fist: 0, shaka: 0, handAtChin: 0, handsUp: 0, anyHand: 0 };
const winner = (f) => MEMES.reduce((a, m) => (m.score({ ...base, ...f }) > a.s ? { id: m.id, s: m.score({ ...base, ...f }) } : a), { id: "", s: -1 }).id;

test("each pose picks its meme", () => {
  const cases = {
    stare: {}, pop: { jawOpen: 0.8 }, shocked: { eyeWide: 0.6, jawOpen: 0.25 }, "close-stare": { eyeWide: 0.7 },
    hiss: { browDown: 0.7, jawOpen: 0.4 }, crying: { browInnerUp: 0.7, frown: 0.4 }, smile: { smile: 0.9 },
    smug: { squint: 0.7, smile: 0.6 }, "side-eye": { gazeSide: 0.8 }, lookaway: { yaw: 0.7 }, huh: { roll: 25, browUp: 0.5, browInnerUp: 0.5, browOuterUp: 0.3 },
    sleepy: { blink: 0.9 }, think: { handAtChin: 0.9, anyHand: 1 }, "laugh-point": { pointing: 1, jawOpen: 0.5, anyHand: 1 },
    point: { pointing: 1, anyHand: 1 }, fistbump: { fist: 1, anyHand: 1 }, "angry-fist": { fist: 1, jawOpen: 0.5, anyHand: 1 },
    shaka: { shaka: 1, anyHand: 1 }, thumbs: { thumbsUp: 1, anyHand: 1 }, wizard: { twoPalms: 1, openPalm: 1, anyHand: 1 },
    stop: { openPalm: 1, anyHand: 1 }, yippee: { handsUp: 1, openPalm: 1, twoPalms: 1, anyHand: 1 },
  };
  for (const [id, f] of Object.entries(cases)) assert.equal(winner(f), id, JSON.stringify(f));
  assert.equal(Object.keys(cases).length, MEMES.length, "every meme has a case");
});

// Issue #34: inner brows up is sadness only without raised outer brows or wide eyes (FACS AU1+4+15 vs fear AU1+2+5).
test("sad brows show crying, fear brows do not", () => {
  assert.equal(winner({ browInnerUp: 0.5, frown: 0.3 }), "crying");                 // brows up, mouth down
  assert.equal(winner({ browInnerUp: 0.6 }), "crying");                             // inner brows only
  assert.equal(winner({ frown: 0.4, browOuterUp: 0.1 }), "crying");                 // a frown wins either way
  // the Hadjikhani 2017 fear face as MediaPipe scores it: eyeWide 0.05, brows up, mouth closed
  const fear = { browInnerUp: 0.45, browOuterUp: 0.1, eyeWide: 0.05, jawOpen: 0.02, frown: 0.01 };
  assert.equal(winner(fear), "close-stare");
  assert.equal(winner({ ...fear, jawOpen: 0.25 }), "shocked");
  assert.equal(winner({ browInnerUp: 0.6, eyeWide: 0.4 }), "close-stare");
  // head tilt + raised brows is huh, also at a partial tilt and tilted the other way (review of #54)
  const huhBrows = { browUp: 0.5, browInnerUp: 0.5, browOuterUp: 0.3 };
  for (const roll of [25, 18, -18, 15]) assert.equal(winner({ ...huhBrows, roll }), "huh", `roll ${roll}`);
  // fear brows with the mouth corners pulled down are sad again
  assert.equal(winner({ ...fear, frown: 0.45 }), "crying");
});

test("fist and shaka from synthetic hands", () => {
  assert.equal(handFeatures([hand([0, 0, 0, 0, 0])], face).fist, 1);
  const sh = handFeatures([hand([1, 0, 0, 0, 1])], face);
  assert.equal(sh.shaka, 1);
  assert.equal(sh.fist, 0);
  assert.equal(handFeatures([hand([1, 0, 0, 0, 0])], face).fist, 0);   // thumbs up is not a fist
});

test("photos exist for every meme that names one", async () => {
  const fs = await import("node:fs");
  for (const m of MEMES) if (m.img) assert.ok(fs.existsSync(new URL("../" + m.img, import.meta.url)), m.img);
});

test("every meme and palette renders an svg", () => {
  for (const m of MEMES) for (const p of Object.keys(PALETTES)) {
    const s = catSVG(m.cat, p);
    assert.match(s, /^<svg[\s\S]*<\/svg>$/);
    assert.doesNotMatch(s, /undefined/);
  }
});

// Upright hand drawn at a fixed physical shape on a frame of the given aspect (width/height): x is
// normalised by the width, so the same hand spans fewer x units on a wide frame.
function handAt(ext, aspect) {
  return hand(ext).map((p) => ({ ...p, x: 0.5 + (p.x - 0.5) / aspect }));
}

for (const [name, aspect] of [["9:16", 9 / 16], ["16:9", 16 / 9]]) {
  test(`gestures from an upright hand at ${name}`, () => {
    const at = (ext) => handFeatures([handAt(ext, aspect)], face, aspect);
    assert.equal(at([1, 0, 0, 0, 0]).thumbsUp, 1);
    assert.equal(at([0, 1, 0, 0, 0]).pointing, 1);
    assert.equal(at([1, 1, 1, 1, 1]).openPalm, 1);
    assert.equal(at([0, 0, 0, 0, 0]).fist, 1);
    assert.equal(at([1, 0, 0, 0, 1]).shaka, 1);
  });
}

// --- malformed landmarks (issue #25) ---
import { faceFeatures, createChooser } from "../memes.js";
test("short, holey and NaN landmarks never throw and every score stays finite in [0,1]", () => {
  const good = hand([1, 1, 1, 1, 1]);
  const nanHand = good.map((p, i) => (i === 8 ? { x: NaN, y: 0.2 } : p));
  const holey = good.map((p, i) => (i === 4 ? undefined : p));
  const nanFace = face.map((p, i) => (i === 152 || i === 263 ? { x: NaN, y: NaN } : p));
  const faces = [null, undefined, [], face.slice(0, 100), face.slice(0, 454), nanFace, face];
  const handSets = [[], undefined, [good.slice(0, 10)], [holey], [nanHand], [null], [good, nanHand], [good]];
  for (const lm of faces) for (const hs of handSets) for (const aspect of [1, NaN, 0, undefined]) {
    const f = { ...faceFeatures({ jawOpen: NaN, smile: undefined }, lm), ...handFeatures(hs, lm, aspect) };
    const c = createChooser();
    for (const m of MEMES) { const v = m.score(f); assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, `${m.id}=${v}`); }
    c.step(f, 0);
    for (const v of Object.values(c.ema)) assert.ok(Number.isFinite(v));
  }
});
test("a malformed hand is ignored but valid ones still count", () => {
  const f = handFeatures([[], hand([1, 1, 1, 1, 1])], face);
  assert.equal(f.anyHand, 1);
  assert.equal(handFeatures([[]], face).anyHand, 0);
});

test("a zero face height (top and chin coincide) keeps handAtChin finite", () => {
  const pt = { x: 0.5, y: 0.5 };
  const f = handFeatures([Array(21).fill(pt)], Array(478).fill(pt));
  assert.ok(Number.isFinite(f.handAtChin));
  assert.equal(f.handAtChin, 1);
});
