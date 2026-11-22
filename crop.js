// Pure geometry for snap(): which part of the camera frame the shared meme keeps.
// The live view (.cam) shows the video with `object-fit: cover`, centred; snap() must keep the same window.

// Aspect (width / height) of the camera part of the snap, from the live .cam box. Very tall or very wide boxes are
// clamped so the image stays shareable; a missing box (0×0, hidden) falls back to the old 1080×675 band.
export const SNAP_ASPECT = { min: 0.75, max: 2, fallback: 1.6 };
export function camAspect(boxW, boxH) {
  const a = boxW / boxH;
  if (!(a > 0) || !Number.isFinite(a)) return SNAP_ASPECT.fallback;
  return Math.min(SNAP_ASPECT.max, Math.max(SNAP_ASPECT.min, a));
}

// The largest centred window of the frame (vw×vh) with the given aspect: what `object-fit: cover` shows.
// Returns source rect {sx, sy, sw, sh} in frame pixels.
export function coverCrop(vw, vh, aspect) {
  if (!(vw > 0 && vh > 0 && aspect > 0)) return { sx: 0, sy: 0, sw: Math.max(0, vw) || 0, sh: Math.max(0, vh) || 0 };
  let sw = vw, sh = vw / aspect;
  if (sh > vh) { sh = vh; sw = vh * aspect; }
  return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh };
}

// Layout of the camera part of the snap: output width W, height from the .cam aspect, and the frame window.
export function snapCamera(vw, vh, boxW, boxH, W = 1080) {
  const aspect = camAspect(boxW, boxH);
  return { width: W, height: Math.round(W / aspect), aspect, crop: coverCrop(vw, vh, aspect) };
}
