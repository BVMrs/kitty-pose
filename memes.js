// Pose -> meme. Each meme scores 0..1 from face blendshapes, head angle and hand shapes.
// f: features computed in app.js (see features()). Tune thresholds with the debug panel (tap "scores").

const clamp = (x) => Math.max(0, Math.min(1, x));
const ramp = (x, lo, hi) => clamp((x - lo) / (hi - lo));

export const MEMES = [
  { id: "scream", caption: "AAAAAAAAA", hint: "open your mouth wide, eyes wide",
    cat: { eyes: "wide", mouth: "scream", extras: "shock" },
    score: (f) => ramp(f.jawOpen, 0.35, 0.65) * (0.6 + 0.4 * ramp(f.eyeWide, 0.1, 0.4)) },
  { id: "think", caption: "hmm.", hint: "hand on your chin",
    cat: { eyes: "side", mouth: "flat", paws: "chin" },
    score: (f) => f.handAtChin * (1 - ramp(f.jawOpen, 0.2, 0.4)) },
  { id: "thumbs", caption: "it's fine. 👍", hint: "thumbs up, sad face",
    cat: { eyes: "teary", mouth: "frown", paws: "thumbs" },
    score: (f) => f.thumbsUp * (0.55 + 0.45 * Math.max(ramp(f.browInnerUp, 0.15, 0.45), ramp(f.frown, 0.1, 0.35))) },
  { id: "yippee", caption: "YIPPEE", hint: "both hands up above your head",
    cat: { eyes: "happy", mouth: "open", paws: "up", extras: "sparkle" },
    score: (f) => f.handsUp },
  { id: "stop", caption: "no.", hint: "open palm towards the camera",
    cat: { eyes: "stare", mouth: "flat", paws: "stop" },
    score: (f) => f.openPalm * (1 - f.handsUp) },
  { id: "point", caption: "you.", hint: "point with your index finger",
    cat: { eyes: "normal", mouth: "flat", paws: "point" },
    score: (f) => f.pointing },
  { id: "smug", caption: "heh.", hint: "half-closed eyes, one-sided smile",
    cat: { eyes: "smug", mouth: "smirk", extras: "blush" },
    score: (f) => ramp(f.squint, 0.25, 0.6) * ramp(f.smile, 0.2, 0.55) * (1 - ramp(f.jawOpen, 0.25, 0.45)) },
  { id: "huh", caption: "huh?", hint: "tilt your head, raise your brows",
    cat: { eyes: "wide", mouth: "w", extras: "question", tilt: -16 },
    score: (f) => ramp(Math.abs(f.roll), 12, 24) * (0.5 + 0.5 * ramp(f.browUp, 0.15, 0.5)) * (1 - ramp(f.jawOpen, 0.3, 0.5)) },
  { id: "sleepy", caption: "zzz", hint: "close your eyes",
    cat: { eyes: "closed", mouth: "w", extras: "zzz", tilt: 8 },
    score: (f) => ramp(f.blink, 0.55, 0.8) },
  { id: "happy", caption: "content.", hint: "big smile",
    cat: { eyes: "happy", mouth: "w", paws: "cheeks", extras: "blush" },
    score: (f) => ramp(f.smile, 0.45, 0.8) * (1 - ramp(f.squint, 0.5, 0.75)) },
  { id: "stare", caption: "*stares*", hint: "no expression (default)",
    cat: { eyes: "stare", mouth: "flat" },
    score: (f) => (f.face ? 0.18 : 0) },
];

// Hand shape helpers on MediaPipe's 21 hand landmarks (normalised image coordinates).
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function fingerState(h) {
  const w = h[0];
  const ext = (tip, pip) => d(h[tip], w) > d(h[pip], w) * 1.12;
  return {
    thumb: d(h[4], h[9]) > d(h[3], h[9]) * 1.1 && d(h[4], h[5]) > d(h[0], h[5]) * 0.55,
    index: ext(8, 6), middle: ext(12, 10), ring: ext(16, 14), pinky: ext(20, 18),
    size: d(h[0], h[9]),
  };
}

export function handFeatures(hands, face) {
  const out = { thumbsUp: 0, pointing: 0, openPalm: 0, handAtChin: 0, handsUp: 0 };
  const chin = face?.[152], top = face?.[10];
  let up = 0;
  for (const h of hands) {
    const s = fingerState(h);
    const curled = [s.index, s.middle, s.ring, s.pinky].filter((x) => !x).length;
    if (s.thumb && curled === 4 && h[4].y < h[2].y - s.size * 0.35) out.thumbsUp = 1;
    if (s.index && !s.middle && !s.ring && !s.pinky) out.pointing = Math.max(out.pointing, 1);
    if (s.index && s.middle && s.ring && s.pinky && s.thumb) out.openPalm = 1;
    if (chin) {
      const knuckles = [5, 9, 13, 8, 12].map((i) => h[i]);
      const near = Math.min(...knuckles.map((k) => d(k, chin)));
      const faceH = top ? d(top, chin) : 0.3;
      out.handAtChin = Math.max(out.handAtChin, 1 - clamp((near / faceH - 0.15) / 0.35));
    }
    if (top && h[0].y < top.y && h[9].y < top.y) up++;
  }
  out.handsUp = up >= 2 ? 1 : 0;
  if (out.thumbsUp) out.pointing = 0;
  return out;
}
