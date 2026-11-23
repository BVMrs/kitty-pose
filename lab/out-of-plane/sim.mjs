// Out-of-plane hand rotation: does handFeatures keep the right gesture when the palm yaws / pitches away from the camera?
// Synthetic 3D hand (same planar shape as test/memes.test.js hand(), plus a z model), rotated about landmark 9,
// orthographic projection onto the image, square frame. Usage: node sim.mjs
import { handFeatures } from "../../memes.js";
// z model: "flat" = every landmark z=0; "fold" = curled fingers' dip/tip and the folded thumb tip sit toward the camera
// (z=-0.45 hand units, MediaPipe: smaller z = closer), extended thumb sticks out of the palm plane (z=-0.3).
function hand(ext, zmodel) {
  const P = (dx, dy, dz = 0) => ({ x: dx, y: dy, z: zmodel === "fold" ? dz : 0 });
  const h = [P(0, 0)];
  h.push(P(-0.4, -0.3), P(-0.7, -0.6, ext[0] ? -0.15 : 0));
  h.push(ext[0] ? P(-0.8, -1.0, -0.3) : P(-0.4, -0.75, -0.45), ext[0] ? P(-0.85, -1.4, -0.3) : P(-0.1, -0.8, -0.45));
  const xs = [-0.3, 0, 0.3, 0.55];
  for (let f = 0; f < 4; f++) {
    const x = xs[f];
    h.push(P(x, -1.0), P(x, -1.4));
    if (ext[f + 1]) h.push(P(x, -1.75), P(x, -2.05));
    else h.push(P(x, -1.2, -0.45), P(x, -0.95, -0.45));
  }
  return h;
}
const rad = (d) => (d * Math.PI) / 180;
function project(h, yaw, pitch, roll = 0) {
  const c = h[9], cy = Math.cos(rad(yaw)), sy = Math.sin(rad(yaw)), cp = Math.cos(rad(pitch)), sp = Math.sin(rad(pitch));
  return h.map((p) => {
    let x = p.x - c.x, y = p.y - c.y, z = p.z - c.z;
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];          // yaw about the vertical axis
    [y, z] = [y * cp - z * sp, y * sp + z * cp];           // pitch about the horizontal axis
    return { x: 0.5 + x * 0.1, y: 0.5 + y * 0.1, z };      // scale 0.1 like the unit test
  });
}
const GEST = { thumbsUp: [1, 0, 0, 0, 0], pointing: [0, 1, 0, 0, 0], openPalm: [1, 1, 1, 1, 1], fist: [0, 0, 0, 0, 0], shaka: [1, 0, 0, 0, 1] };
const key = { thumbsUp: "thumbsUp", pointing: "pointing", openPalm: "openPalm", fist: "fist", shaka: "shaka" };
const fires = (g, hh) => handFeatures([hh], null)[key[g]] === 1;
const fmt = (a) => a.length ? a.join(",") : "none";
for (const zm of ["flat", "fold"]) {
  console.log(`\n=== z model: ${zm} ===`);
  for (const axis of ["yaw", "pitch"]) {
    console.log(`-- ${axis}: angles (deg, -90..90 step 10) where the gesture still fires; (* = also a different gesture fires)`);
    for (const [g, ext] of Object.entries(GEST)) {
      const ok = [], other = [];
      for (let a = -90; a <= 90; a += 10) {
        const hh = project(hand(ext, zm), axis === "yaw" ? a : 0, axis === "pitch" ? a : 0);
        if (fires(g, hh)) ok.push(a);
        const f = handFeatures([hh], null);
        if (Object.keys(GEST).some((k) => k !== g && f[k] === 1)) other.push(a);
      }
      // contiguous range around 0
      let lo = 0, hi = 0; while (ok.includes(lo - 10)) lo -= 10; while (ok.includes(hi + 10)) hi += 10;
      console.log(`${g.padEnd(9)} fires on [${lo}, ${hi}] contiguous; all: ${fmt(ok)}; other gesture fires at: ${fmt(other)}`);
    }
  }
}
