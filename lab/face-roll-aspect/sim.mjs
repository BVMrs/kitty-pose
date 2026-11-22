// Is faceFeatures() roll aspect-correct? Build a 478-point face with eye corners (33, 263) at a TRUE in-image roll,
// project to normalised coords for a W:H frame, run the real faceFeatures + MEMES, find the true angle at which `huh` wins.
// Usage: node sim.mjs
import { MEMES, faceFeatures as ff, handFeatures } from "../../memes.js";
const ASPECTS = [["9:16 portrait", 9 / 16], ["3:4 portrait", 3 / 4], ["1:1", 1], ["4:3", 4 / 3], ["16:9", 16 / 9]];
function landmarks(trueDeg, aspect) {           // pixel space with H = 1, W = aspect; eye span 0.2 H
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const t = (trueDeg * Math.PI) / 180, d = 0.2, c = { x: 0.5 * aspect, y: 0.5 };
  const put = (i, dx, dy) => { lm[i] = { x: (c.x + dx * Math.cos(t) - dy * Math.sin(t)) / aspect, y: c.y + dx * Math.sin(t) + dy * Math.cos(t) }; };
  put(33, -d / 2, 0); put(263, d / 2, 0); put(234, -0.2, 0.1); put(454, 0.2, 0.1); put(1, 0, 0.1);
  return lm;
}
const faceFeatures = (b, lm) => ({ ...ff(b, lm), ...handFeatures([], lm, 1) });
const win = (f) => { let b = "stare", s = 0.35; for (const m of MEMES) { const v = m.score(f); if (v > s) { s = v; b = m.id; } } return b; };
const firstTrue = (aspect, bs) => {            // smallest true tilt (deg) at which the winner is huh
  for (let a = 0; a <= 60; a += 0.25) if (win(faceFeatures(bs, landmarks(a, aspect))) === "huh") return a;
  return null;
};
const BR = { browInnerUp: 0.5, browOuterUpLeft: 0.3, browOuterUpRight: 0.3 };
console.log("aspect          measured roll at true 10/20/30 deg | huh wins from true tilt: neutral brows / raised brows");
for (const [n, a] of ASPECTS) {
  const m = [10, 20, 30].map((d) => faceFeatures({}, landmarks(d, a)).roll.toFixed(1));
  console.log(n.padEnd(15), m.join(" / ").padEnd(22), "|", String(firstTrue(a, {})).padStart(6), "/", String(firstTrue(a, BR)).padStart(6));
}
// does a clear "wait what" face (shocked) survive a true 14 deg head tilt? (browsRaised is switched off by measured 8..16 deg)
const SH = { eyeWideLeft: 0.6, eyeWideRight: 0.6, browInnerUp: 0.6, browOuterUpLeft: 0.3, browOuterUpRight: 0.3, jawOpen: 0.15 };
console.log("\nsurprised face (eyes wide + brows up, mouth slightly open), winner by true tilt:");
for (const [n, a] of ASPECTS) console.log(n.padEnd(15), [0, 5, 10, 15, 20].map((d) => `${d}°:${win(faceFeatures(SH, landmarks(d, a)))}`).join("  "));
