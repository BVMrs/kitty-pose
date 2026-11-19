// Compare the area of the camera frame visible in the live view (object-fit: cover in the .cam box)
// with the area app.js snap() crops into the top half of the meme (1080x675).
// Usage: node sim.mjs <hagrid test annotations dir>   (uses only normalized hand bboxes)
import fs from "node:fs";
const dir = process.argv[2];
// crop window (fractions of the video frame) for a target box of aspect A=w/h, cover fit
const win = (vw, vh, A) => { const s = Math.max(A * 1 / (vw / vh) , 1); // scale relative
  const fw = vw / vh >= A ? A / (vw / vh) : 1, fh = vw / vh >= A ? 1 : (vw / vh) / A;
  return { x0: (1 - fw) / 2, x1: (1 + fw) / 2, y0: (1 - fh) / 2, y1: (1 + fh) / 2, fw, fh }; };
const SNAP = 1080 / 675;
// live .cam box = (vw_css) x ((vh_css - safe - bar)/2); bar ~ 80 css px, safe-top ~ 47 (iPhone with notch, standalone PWA) or 0 (Safari)
const phones = { "iPhone 390x844 (css, no browser chrome)": [390, 844 - 47 - 80], "iPhone Safari ~390x664 visible": [390, 664 - 80 / 1] };
const live = (W, H) => W / (H / 2);
const cases = [];
for (const [pn, [W, Hc]] of Object.entries({ "iPhone PWA 390x844": [390, 844 - 47 - 80], "iPhone Safari 390x664": [390, 664 - 80], "small phone 360x640": [360, 640 - 80] })) {
  const A = W / (Hc / 2);
  for (const [vn, vw, vh] of [["portrait 720x1280", 720, 1280], ["landscape 1280x720", 1280, 720], ["4:3 640x480", 640, 480]])
    cases.push({ phone: pn, video: vn, A, L: win(vw, vh, A), S: win(vw, vh, SNAP) });
}
const boxes = [];
for (const fn of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(`${dir}/${fn}`));
  for (const k in j) for (const b of j[k].bboxes || []) boxes.push(b); // [x,y,w,h] normalized
}
// fraction of box area inside window
const inter = (b, w) => { const [x, y, bw, bh] = b; const ix = Math.max(0, Math.min(x + bw, w.x1) - Math.max(x, w.x0)), iy = Math.max(0, Math.min(y + bh, w.y1) - Math.max(y, w.y0)); return (ix * iy) / (bw * bh); };
console.log("hand boxes:", boxes.length);
for (const c of cases) {
  const st = (w) => { let full = 0, half = 0, sum = 0; for (const b of boxes) { const f = inter(b, w); sum += f; if (f > 0.999) full++; if (f < 0.5) half++; } const n = boxes.length; return { frameKept: +(w.fw * w.fh).toFixed(3), handFullyIn: +(full / n).toFixed(3), handMostlyOut: +(half / n).toFixed(3), meanVis: +(sum / n).toFixed(3) }; };
  console.log(c.phone, "|", c.video, "| live aspect", c.A.toFixed(2), "\n  live", JSON.stringify(st(c.L)), "\n  snap", JSON.stringify(st(c.S)));
}
