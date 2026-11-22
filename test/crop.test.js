import { test } from "node:test";
import assert from "node:assert/strict";
import { coverCrop, camAspect, snapCamera, SNAP_ASPECT } from "../crop.js";

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);
// What the live view shows: `object-fit: cover` scales the frame by max(boxW/vw, boxH/vh), centred, and clips.
function liveWindow(vw, vh, bw, bh) {
  const s = Math.max(bw / vw, bh / vh), sw = bw / s, sh = bh / s;
  return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh };
}

// iPhone .cam box from lab/2026-11-19-snap-crop.md (agents/lab branch).
const BOX = [390, 357];
for (const [vw, vh, share] of [[720, 1280, 0.515], [1280, 720, 0.614], [640, 480, 0.819]]) {
  test(`snap keeps the live view's window: ${vw}x${vh} frame, ${BOX.join("x")} .cam`, () => {
    const { crop, height, width } = snapCamera(vw, vh, ...BOX);
    const live = liveWindow(vw, vh, ...BOX);
    for (const k of ["sx", "sy", "sw", "sh"]) near(crop[k], live[k], k);
    near(crop.sw / crop.sh, 390 / 357, "aspect");
    assert.equal(width, 1080);
    assert.equal(height, Math.round(1080 * 357 / 390));
    assert.ok(crop.sx >= 0 && crop.sy >= 0 && crop.sx + crop.sw <= vw + 1e-9 && crop.sy + crop.sh <= vh + 1e-9, "inside the frame");
    assert.ok(Math.abs((crop.sw * crop.sh) / (vw * vh) - share) < 0.005, "share of the frame kept");
  });
}

test("portrait frame: more than the old 1080x675 band (35%)", () => {
  const old = coverCrop(720, 1280, 1080 / 675), now = snapCamera(720, 1280, ...BOX).crop;
  near(old.sh, 450, "old band height");
  assert.ok(now.sh > old.sh * 1.4);
});

test("coverCrop is the whole frame when the aspects match", () => {
  assert.deepEqual(coverCrop(640, 480, 4 / 3), { sx: 0, sy: 0, sw: 640, sh: 480 });
});

test("camAspect clamps extreme boxes and falls back on an empty one", () => {
  assert.equal(camAspect(0, 0), SNAP_ASPECT.fallback);
  assert.equal(camAspect(390, 0), SNAP_ASPECT.fallback);
  assert.equal(camAspect(NaN, 300), SNAP_ASPECT.fallback);
  assert.equal(camAspect(100, 1000), SNAP_ASPECT.min);
  assert.equal(camAspect(1000, 100), SNAP_ASPECT.max);
  assert.equal(camAspect(400, 300), 4 / 3);
});

test("coverCrop does not return NaN for a frame with no size yet", () => {
  const c = coverCrop(0, 0, 1.2);
  for (const v of Object.values(c)) assert.ok(Number.isFinite(v));
});
