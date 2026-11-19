// Upright hand, vary frame aspect (w/h): which poses fire? Then the same with x scaled to pixels (prototype fix).
import { handFeatures } from "../../memes.js";
const src = await import("node:fs").then(f => f.readFileSync(new URL("../../memes.js", import.meta.url), "utf8"));
// prototype: patched copy where d() works in pixel units given global ASPECT = W/H (x * ASPECT)
const patched = src.replace("const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);",
  "export let ASPECT = 1; export const setAspect = (a) => { ASPECT = a; };\nconst d = (a, b) => Math.hypot((a.x - b.x) * ASPECT, a.y - b.y);")
  .replace("h[4].y < h[2].y - s.size * 0.35", "h[4].y < h[2].y - s.size * 0.35");
await import("node:fs").then(f => f.writeFileSync(new URL("./memes-aspect.mjs", import.meta.url), patched));
const P = await import("./memes-aspect.mjs");
const mk = (ext, W, H) => { const p = (dx, dy) => ({ x: (0.5 * W + dx * 100) / W, y: (0.5 * H + dy * 100 + 100) / H, z: 0 });
  const h = [p(0,0), p(-0.4,-0.3), p(-0.7,-0.6)];
  h.push(ext[0] ? p(-0.8,-1) : p(-0.4,-0.75), ext[0] ? p(-0.85,-1.4) : p(-0.1,-0.8));
  [-0.3,0,0.3,0.55].forEach((x,f)=>{h.push(p(x,-1),p(x,-1.4)); if(ext[f+1]) h.push(p(x,-1.75),p(x,-2.05)); else h.push(p(x,-1.2),p(x,-0.95));}); return h; };
const POSES = { thumbsUp:[1,0,0,0,0], pointing:[0,1,0,0,0], openPalm:[1,1,1,1,1], fist:[0,0,0,0,0], shaka:[1,0,0,0,1] };
for (const [name,[W,H]] of Object.entries({ "16:9 land":[1280,720], "4:3 land":[1280,960], "1:1":[1000,1000], "3:4 port":[720,960], "9:16 port":[720,1280], "9:19.5":[720,1560] })) {
  const row = [];
  for (const [pose, ext] of Object.entries(POSES)) {
    const a = handFeatures([mk(ext,W,H)], null)[pose];
    P.setAspect(W/H); const b = P.handFeatures([mk(ext,W,H)], null)[pose]; P.setAspect(1);
    row.push(`${pose} ${a?"ok":"FAIL"}/${b?"ok":"FAIL"}`);
  }
  console.log(name.padEnd(10), row.join("  "));
}
console.log("(current / aspect-corrected)");
import("node:fs").then(f => f.unlinkSync(new URL("./memes-aspect.mjs", import.meta.url)));
