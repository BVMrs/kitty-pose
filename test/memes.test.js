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

const base = { face: true, jawOpen: 0, eyeWide: 0, blink: 0, squint: 0, smile: 0, frown: 0, browInnerUp: 0, browUp: 0, roll: 0,
  thumbsUp: 0, pointing: 0, openPalm: 0, handAtChin: 0, handsUp: 0 };
const winner = (f) => MEMES.reduce((a, m) => (m.score({ ...base, ...f }) > a.s ? { id: m.id, s: m.score({ ...base, ...f }) } : a), { id: "", s: -1 }).id;

test("each pose picks its meme", () => {
  assert.equal(winner({}), "stare");
  assert.equal(winner({ jawOpen: 0.8, eyeWide: 0.5 }), "scream");
  assert.equal(winner({ handAtChin: 0.9 }), "think");
  assert.equal(winner({ thumbsUp: 1, browInnerUp: 0.5 }), "thumbs");
  assert.equal(winner({ handsUp: 1, openPalm: 1 }), "yippee");
  assert.equal(winner({ openPalm: 1 }), "stop");
  assert.equal(winner({ pointing: 1 }), "point");
  assert.equal(winner({ squint: 0.7, smile: 0.6 }), "smug");
  assert.equal(winner({ roll: 25, browUp: 0.5 }), "huh");
  assert.equal(winner({ blink: 0.9 }), "sleepy");
  assert.equal(winner({ smile: 0.9 }), "happy");
});

test("every meme and palette renders an svg", () => {
  for (const m of MEMES) for (const p of Object.keys(PALETTES)) {
    const s = catSVG(m.cat, p);
    assert.match(s, /^<svg[\s\S]*<\/svg>$/);
    assert.doesNotMatch(s, /undefined/);
  }
});
