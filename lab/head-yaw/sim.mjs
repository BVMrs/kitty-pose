// Head yaw/pitch -> faceFeatures yaw & roll, and the memes that react (lookaway, side-eye, huh).
// Rigid head (cm, x right, y down, z toward camera), orthographic projection, scale 0.02/cm, aspect 1.
// Landmarks used by faceFeatures: 1 nose tip, 33/263 outer eye corners, 234/454 cheek edges. Depth model is a GUESS
// (canonical mesh values recalled, not looked up), so protrusion p is swept. Usage: node sim.mjs
import { faceFeatures, MEMES } from "../../memes.js";
const rad = (d) => (d * Math.PI) / 180;
function lms(yawD, pitchD, rollD, p, w) {
  const base = { 1: [0, 1, p], 33: [-4.5, -2, 1], 263: [4.5, -2, 1], 234: [-w, 0, 0], 454: [w, 0, 0] };
  const cy = Math.cos(rad(yawD)), sy = Math.sin(rad(yawD)), cp = Math.cos(rad(pitchD)), sp = Math.sin(rad(pitchD));
  const cr = Math.cos(rad(rollD)), sr = Math.sin(rad(rollD));
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [k, [x0, y0, z0]] of Object.entries(base)) {
    let x = x0, y = y0, z = z0;
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    [x, y] = [x * cr - y * sr, x * sr + y * cr];
    lm[k] = { x: 0.5 + x * 0.02, y: 0.5 + y * 0.02, z };
  }
  return lm;
}
const lookaway = MEMES.find((m) => m.id === "lookaway"), huh = MEMES.find((m) => m.id === "huh"), side = MEMES.find((m) => m.id === "side-eye");
const out = [];
const log = (s) => { out.push(s); console.log(s); };
const hold = (f, extra) => ({ anyHand: 0, pointing: 0, ...f, ...extra });
log("== A. feature yaw vs true head yaw (pitch 0, roll 0), protrusion p-dz sweep, cheek half-width 7.5");
log("true yaw: " + [10, 20, 30, 40, 50, 60].join("   "));
for (const p of [5, 7, 9]) {
  log(`p=${p}: ` + [10, 20, 30, 40, 50, 60].map((y) => faceFeatures({}, lms(y, 0, 0, p, 7.5)).yaw.toFixed(2)).join("  "));
}
log("\n== B. true yaw where lookaway score reaches .5 / 1 (no hand), and where side-eye (gaze 0.65) is half / fully suppressed");
for (const p of [5, 7, 9]) {
  const sc = (s, y) => s(hold(faceFeatures({}, lms(y, 0, 0, p, 7.5)), { gazeSide: 0.65 }));
  let a = null, b = null, c = null, d = null;
  for (let y = 0; y <= 80; y += 0.5) {
    if (a === null && lookaway.score(hold(faceFeatures({}, lms(y, 0, 0, p, 7.5)))) >= 0.5) a = y;
    if (b === null && lookaway.score(hold(faceFeatures({}, lms(y, 0, 0, p, 7.5)))) >= 0.999) b = y;
    if (c === null && sc(side.score, y) <= 0.5) c = y;
    if (d === null && sc(side.score, y) <= 0.001) d = y;
  }
  log(`p=${p}: lookaway .5 at ${a} deg, full at ${b}; side-eye halved at ${c}, dead at ${d}`);
}
log("\n== C. fake roll from yaw+pitch (true roll 0), p=7: image roll in degrees, rows yaw, cols camera pitch of head");
const ps = [-30, -20, -10, 0, 10, 20, 30];
log("yaw\\pitch " + ps.join("     "));
for (const y of [10, 20, 30, 40, 50]) log(String(y).padStart(5) + "      " + ps.map((q) => faceFeatures({}, lms(y, q, 0, 7, 7.5)).roll.toFixed(1).padStart(5)).join("  "));
log("\n== D. huh score with raised brows (browUp .5, jaw 0) and NO true tilt, p=7");
log("yaw\\pitch " + ps.join("     "));
for (const y of [10, 20, 30, 40, 50]) log(String(y).padStart(5) + "      " + ps.map((q) => huh.score(hold(faceFeatures({}, lms(y, q, 0, 7, 7.5)), { browUp: 0.5, jawOpen: 0 })).toFixed(2).padStart(5)).join("  "));
log("\n== E. true roll 0..30 at yaw 30, pitch 20: measured roll (error vs true)");
for (const r of [0, 10, 20, 30]) log(`true ${r}: measured ${faceFeatures({}, lms(30, 20, r, 7, 7.5)).roll.toFixed(1)}`);
import { writeFileSync } from "node:fs";
writeFileSync(new URL("./output.txt", import.meta.url), out.join("\n") + "\n");
