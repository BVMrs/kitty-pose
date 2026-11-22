// Face regression: the pure half of demo/face-dump.mjs, shared with test/face-regression.test.js.
// A dump is the per-frame input the app's faceFeatures()/handFeatures() saw while a clip played as the camera,
// plus the meme the app showed. replay() feeds those inputs through memes.js again, so a threshold change shows
// up as a different winner in a labelled segment.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { homedir } from "node:os";
import { join } from "node:path";
import { createChooser, faceFeatures, handFeatures } from "../memes.js";

export const FORMAT = "kitty-face-dump/1";
// Face landmarks memes.js reads: 1 nose tip, 10 forehead top, 33/263 eye corners, 152 chin, 234/454 cheek edges.
// test/face-regression.test.js checks that faceFeatures()/handFeatures() read nothing else.
export const LANDMARKS = [1, 10, 33, 152, 234, 263, 454];

// ---------- frame index barcode ----------
// The fake camera loops the clip and drops frames while MediaPipe is busy, so each frame carries its own index:
// BITS blocks of BLOCK x BLOCK luma pixels along the bottom-left edge, the index's 16 bits then their complement.
export const BLOCK = 8, BITS = 32;
export const encodeIndex = (i) => {
  const v = i & 0xffff, bits = [];
  for (let k = 15; k >= 0; k--) bits.push((v >> k) & 1);
  return [...bits, ...bits.map((b) => 1 - b)];
};
export function decodeIndex(bits) {
  if (bits.length !== BITS) return null;
  for (let k = 0; k < 16; k++) if (bits[k] === bits[k + 16]) return null;   // complement check failed
  return bits.slice(0, 16).reduce((v, b) => v * 2 + b, 0);
}
// Stamps the barcode into one I420 frame's Y plane (and greys the U/V under it). frame: Buffer of w*h*3/2 bytes.
export function stampFrame(frame, w, h, index) {
  const bits = encodeIndex(index), cw = w >> 1, ySize = w * h, cSize = cw * (h >> 1);
  for (let k = 0; k < BITS; k++) {
    const val = bits[k] ? 235 : 16;
    for (let y = h - BLOCK; y < h; y++) frame.fill(val, y * w + k * BLOCK, y * w + (k + 1) * BLOCK);
    for (let y = (h - BLOCK) >> 1; y < h >> 1; y++) {
      const o = y * cw + ((k * BLOCK) >> 1);
      frame.fill(128, ySize + o, ySize + o + BLOCK / 2);
      frame.fill(128, ySize + cSize + o, ySize + cSize + o + BLOCK / 2);
    }
  }
  return frame;
}

// ---------- replay ----------
// Rebuilds the app's per-frame features from a dump frame, exactly as app.js features() does.
export function frameFeatures(dump, fr) {
  const b = {};
  if (fr.b) dump.blendshapes.forEach((name, k) => { b[name] = fr.b[k]; });
  let lm;
  if (fr.lm) { lm = []; dump.landmarks.forEach((idx, k) => { const [x, y, z] = fr.lm[k]; lm[idx] = { x, y, z }; }); }
  const hands = (fr.hands || []).map((h) => h.map(([x, y, z]) => ({ x, y, z })));
  const [cw, ch] = dump.clip?.video || [];
  const aspect = (fr.vw && fr.vh ? fr.vw / fr.vh : cw / ch) || 1; // as app.js: videoWidth / videoHeight || 1
  return { ...faceFeatures(b, lm), ...handFeatures(hands, lm, aspect) };
}

// Runs the app's chooser over every frame in order; returns the shown meme after each frame.
// clock "clip": time is the frame's clip time, i.e. a phone keeping up with every frame (the dump plays the clip
// slower than real time so that the detector sees nearly every frame); "app": the time the app saw (recorded now).
export function replay(dump, { clock = "clip" } = {}) {
  const c = createChooser();
  return dump.frames.map((fr) => { c.step(frameFeatures(dump, fr), clock === "app" ? fr.now : fr.t * 1000); return c.current; });
}

// For each labelled segment {from, to, meme} (clip seconds; meme is an id or a list of acceptable ids), the frames in [from + settle, to] and the share of
// them on which the expected meme was shown. A segment passes when share >= minShare and it has >= minFrames frames.
export function checkSegments(dump, winners = replay(dump), { settle = 0.4, minShare = 0.6, minFrames = 3 } = {}) {
  return (dump.segments || []).map((s) => {
    const got = [];
    dump.frames.forEach((fr, k) => { if (fr.t >= s.from + (s.settle ?? settle) && fr.t <= s.to) got.push(winners[k]); });
    const counts = {};
    for (const w of got) counts[w] = (counts[w] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n}`).join(", ");
    const want = [].concat(s.meme);
    const share = got.length ? want.reduce((n, id) => n + (counts[id] || 0), 0) / got.length : 0;
    const need = s.minShare ?? minShare;
    return { ...s, n: got.length, share, top, ok: got.length >= minFrames && share >= need };
  });
}

// Labelled dumps (NAME.dump.json or .dump.json.gz) for the regression test: committed fixtures plus any in $KITTY_FACE_DUMPS
// (default ~/.cache/agent-data/kitty-pose/face-dumps), e.g. dumps of the owner's own clips, which stay local.
export const cacheDir = (sub, env = process.env) => join(env.HOME || homedir(), ".cache", "agent-data", "kitty-pose", sub);
export const dumpsDir = (env = process.env) => env.KITTY_FACE_DUMPS || cacheDir("face-dumps", env);
export function findDumps(dirs) {
  const out = [];
  for (const dir of dirs) {
    if (!dir || !existsSync(dir)) continue;
    for (const f of readdirSync(dir).sort()) if (/\.dump\.json(\.gz)?$/.test(f)) {
      const path = join(dir, f), raw = readFileSync(path);
      const dump = JSON.parse((f.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"));
      if (dump.format === FORMAT) out.push({ path, dump });
    }
  }
  return out;
}
