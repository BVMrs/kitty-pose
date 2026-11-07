// Pose -> meme. Each meme scores 0..1 from face blendshapes, head angles and hand shapes.
// f: features computed in app.js (see features()). Tune thresholds with settings -> show detection scores.
// img: the meme photo (assets/); cat: the drawn fallback (cats.js), used when there is no photo.

const clamp = (x) => Math.max(0, Math.min(1, x));
const ramp = (x, lo, hi) => clamp((x - lo) / (hi - lo));
const not = (x) => 1 - x;

export const MEMES = [
  // --- mouth and eyes ---
  { id: "pop", img: "assets/pop.jpg", caption: "POP", hint: "mouth wide open, like an O",
    cat: { eyes: "wide", mouth: "scream", extras: "shock" },
    score: (f) => ramp(f.jawOpen, 0.45, 0.7) * not(f.pointing) * not(f.fist) * not(ramp(f.browDown, 0.35, 0.6)) },
  { id: "shocked", img: "assets/shocked.jpg", caption: "wait what", hint: "eyes wide, mouth a little open",
    cat: { eyes: "wide", mouth: "open" },
    score: (f) => ramp(f.eyeWide, 0.2, 0.5) * ramp(f.jawOpen, 0.08, 0.22) * not(ramp(f.jawOpen, 0.45, 0.6)) * not(f.anyHand) },
  { id: "close-stare", img: "assets/close-stare.jpg", caption: "o_o", hint: "eyes wide open, mouth closed",
    cat: { eyes: "wide", mouth: "flat" },
    score: (f) => ramp(f.eyeWide, 0.3, 0.6) * not(ramp(f.jawOpen, 0.08, 0.18)) * not(f.anyHand) },
  { id: "hiss", img: "assets/hiss.jpg", caption: "HSSSS", hint: "angry brows, show your teeth",
    cat: { eyes: "stare", mouth: "scream" },
    score: (f) => ramp(f.browDown, 0.3, 0.6) * ramp(f.jawOpen, 0.12, 0.35) * not(f.fist) },
  { id: "crying", img: "assets/crying.jpg", caption: "it's over", hint: "sad face: brows up, mouth down",
    cat: { eyes: "teary", mouth: "frown" },
    score: (f) => Math.max(ramp(f.browInnerUp, 0.3, 0.6), ramp(f.frown, 0.2, 0.45)) * not(f.anyHand) * not(ramp(f.smile, 0.3, 0.5)) },
  { id: "smile", img: "assets/smile.jpg", caption: "hehe", hint: "big smile",
    cat: { eyes: "happy", mouth: "w", paws: "cheeks", extras: "blush" },
    score: (f) => ramp(f.smile, 0.45, 0.8) * not(ramp(f.squint, 0.5, 0.75)) * not(f.pointing) },
  { id: "smug", img: "assets/smug.jpg", caption: "heh.", hint: "half-closed eyes, one-sided smile",
    cat: { eyes: "smug", mouth: "smirk", extras: "blush" },
    score: (f) => ramp(f.squint, 0.25, 0.6) * ramp(f.smile, 0.2, 0.55) * not(ramp(f.jawOpen, 0.25, 0.45)) },
  { id: "side-eye", img: "assets/side-eye.jpg", caption: "👀", hint: "look sideways with your eyes only",
    cat: { eyes: "side", mouth: "flat" },
    score: (f) => ramp(f.gazeSide, 0.35, 0.65) * not(ramp(Math.abs(f.yaw), 0.3, 0.5)) },
  { id: "lookaway", img: "assets/lookaway.jpg", caption: "not my problem", hint: "turn your head away",
    cat: { eyes: "side", mouth: "flat", tilt: 10 },
    score: (f) => ramp(Math.abs(f.yaw), 0.35, 0.6) * not(f.anyHand) },
  { id: "huh", caption: "huh?", hint: "tilt your head, raise your brows",
    cat: { eyes: "wide", mouth: "w", extras: "question", tilt: -16 },
    score: (f) => ramp(Math.abs(f.roll), 12, 24) * (0.5 + 0.5 * ramp(f.browUp, 0.15, 0.5)) * not(ramp(f.jawOpen, 0.3, 0.5)) },
  { id: "sleepy", caption: "zzz", hint: "close your eyes",
    cat: { eyes: "closed", mouth: "w", extras: "zzz", tilt: 8 },
    score: (f) => ramp(f.blink, 0.55, 0.8) },
  // --- hands ---
  { id: "think", img: "assets/think.jpg", caption: "hmm.", hint: "hand on your chin",
    cat: { eyes: "side", mouth: "flat", paws: "chin" },
    score: (f) => f.handAtChin * not(ramp(f.jawOpen, 0.2, 0.4)) * not(f.pointing) },
  { id: "laugh-point", img: "assets/laugh-point.gif", caption: "HAHAHA", hint: "point at the camera and laugh",
    cat: { eyes: "happy", mouth: "open", paws: "point" },
    score: (f) => f.pointing * Math.max(ramp(f.jawOpen, 0.2, 0.45), ramp(f.smile, 0.45, 0.7)) },
  { id: "point", img: "assets/point.jpg", caption: "you.", hint: "point at the camera, straight face",
    cat: { eyes: "normal", mouth: "flat", paws: "point" },
    score: (f) => f.pointing * not(Math.max(ramp(f.jawOpen, 0.2, 0.45), ramp(f.smile, 0.45, 0.7))) },
  { id: "fistbump", img: "assets/fistbump.jpg", caption: "👊", hint: "fist towards the camera",
    cat: { eyes: "normal", mouth: "w", paws: "stop" },
    score: (f) => f.fist * not(ramp(f.jawOpen, 0.2, 0.4)) },
  { id: "angry-fist", img: "assets/angry-fist.jpg", caption: "FIGHT ME", hint: "fist up and yell",
    cat: { eyes: "stare", mouth: "scream", paws: "stop" },
    score: (f) => f.fist * ramp(f.jawOpen, 0.2, 0.45) },
  { id: "shaka", img: "assets/shaka.jpg", caption: "🤙", hint: "shaka: thumb and pinky out",
    cat: { eyes: "wide", mouth: "open", paws: "thumbs" },
    score: (f) => f.shaka },
  { id: "thumbs", caption: "it's fine. 👍", hint: "thumbs up",
    cat: { eyes: "teary", mouth: "frown", paws: "thumbs" },
    score: (f) => f.thumbsUp },
  { id: "wizard", img: "assets/wizard.jpg", caption: "✨ magic ✨", hint: "both palms open in front of you",
    cat: { eyes: "wide", mouth: "w", extras: "sparkle" },
    score: (f) => f.twoPalms * not(f.handsUp) },
  { id: "stop", caption: "no.", hint: "one open palm towards the camera",
    cat: { eyes: "stare", mouth: "flat", paws: "stop" },
    score: (f) => f.openPalm * not(f.handsUp) * not(f.twoPalms) },
  { id: "yippee", caption: "YIPPEE", hint: "both hands up above your head",
    cat: { eyes: "happy", mouth: "open", paws: "up", extras: "sparkle" },
    score: (f) => f.handsUp },
  // --- default ---
  { id: "stare", img: "assets/stare.jpg", caption: "*stares*", hint: "no expression (default)",
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
  const out = { thumbsUp: 0, pointing: 0, openPalm: 0, twoPalms: 0, fist: 0, shaka: 0, handAtChin: 0, handsUp: 0, anyHand: hands.length ? 1 : 0 };
  const chin = face?.[152], top = face?.[10];
  let up = 0, palms = 0;
  for (const h of hands) {
    const s = fingerState(h);
    const curled = [s.index, s.middle, s.ring, s.pinky].filter((x) => !x).length;
    const thumbUp = s.thumb && h[4].y < h[2].y - s.size * 0.35;
    if (thumbUp && curled === 4) out.thumbsUp = 1;
    else if (s.thumb && s.pinky && !s.index && !s.middle && !s.ring) out.shaka = 1;
    else if (curled === 4) out.fist = 1;
    if (s.index && !s.middle && !s.ring && !s.pinky) out.pointing = 1;
    if (s.index && s.middle && s.ring && s.pinky && s.thumb) { out.openPalm = 1; palms++; }
    if (chin) {
      const knuckles = [5, 9, 13, 8, 12].map((i) => h[i]);
      const near = Math.min(...knuckles.map((k) => d(k, chin)));
      const faceH = top ? d(top, chin) : 0.3;
      out.handAtChin = Math.max(out.handAtChin, 1 - clamp((near / faceH - 0.15) / 0.35));
    }
    if (top && h[0].y < top.y && h[9].y < top.y) up++;
  }
  out.handsUp = up >= 2 ? 1 : 0;
  out.twoPalms = palms >= 2 ? 1 : 0;
  if (out.thumbsUp || out.shaka) out.pointing = 0;
  if (out.handAtChin > 0.6) out.fist = 0;                 // a fist under the chin is the thinker
  return out;
}

// Face features from MediaPipe blendshapes (b: name -> score) and the 478 face landmarks.
export function faceFeatures(b, lm) {
  const g = (k) => b[k] || 0;
  let roll = 0, yaw = 0;
  if (lm) {
    roll = (Math.atan2(lm[263].y - lm[33].y, lm[263].x - lm[33].x) * 180) / Math.PI;
    const l = lm[234], r = lm[454], n = lm[1];             // cheek edges and nose tip
    yaw = r.x !== l.x ? ((n.x - l.x) / (r.x - l.x) - 0.5) * 2 : 0;
  }
  return {
    face: !!lm,
    jawOpen: g("jawOpen"),
    eyeWide: (g("eyeWideLeft") + g("eyeWideRight")) / 2,
    blink: Math.min(g("eyeBlinkLeft"), g("eyeBlinkRight")),
    squint: (g("eyeSquintLeft") + g("eyeSquintRight")) / 2,
    smile: Math.max(g("mouthSmileLeft"), g("mouthSmileRight")),
    frown: (g("mouthFrownLeft") + g("mouthFrownRight")) / 2,
    browInnerUp: g("browInnerUp"),
    browUp: Math.max(g("browOuterUpLeft"), g("browOuterUpRight"), g("browInnerUp")),
    browDown: (g("browDownLeft") + g("browDownRight")) / 2,
    gazeSide: Math.max((g("eyeLookOutLeft") + g("eyeLookInRight")) / 2, (g("eyeLookInLeft") + g("eyeLookOutRight")) / 2),
    roll, yaw,
  };
}
