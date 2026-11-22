#!/usr/bin/env node
// Does the shared meme keep the part of the camera frame the live view shows? Headless Chromium at a 390x844 mobile
// viewport plays a synthetic frame as the fake front camera: luma encodes the frame row (y) and the U chroma the
// frame column (x), as linear ramps. After the app starts, it reads back which frame window is on screen in .cam
// (screenshot) and which window the snap JPEG holds in its camera part (snap() is clicked; the file it would
// share/download is captured), and compares them. Frame sizes: portrait 720x1280, landscape 1280x720, 4:3 640x480.
//
// Usage: node demo/snap-check.mjs [--sizes 720x1280,1280x720,640x480] [--timeout S] [--save DIR]   (--save: keep the snap JPEGs)
// Needs Chromium ($CHROMIUM, else chromium / google-chrome on PATH). The ramps are synthetic on purpose: they make
// the crop measurable; the geometry is the same for any picture. Exits 1 if any window differs by more than 3 %
// of the frame side.

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cdp, evaluate, findExe, serve } from "./face-dump.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOL = 0.03;

// I420 Y4M: Y ramps 16..235 down the rows, U ramps 64..192 across the columns (narrow, so no RGB channel clips), V flat.
function rampY4m(path, w, h, frames = 4) {
  const ySize = w * h, cw = w / 2, ch = h / 2, frame = Buffer.alloc(ySize + 2 * cw * ch);
  for (let y = 0; y < h; y++) frame.fill(Math.round(16 + (219 * y) / (h - 1)), y * w, (y + 1) * w);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) frame[ySize + y * cw + x] = Math.round(64 + (128 * x) / (cw - 1));
  frame.fill(128, ySize + cw * ch);
  const head = Buffer.from(`YUV4MPEG2 W${w} H${h} F30:1 Ip A1:1 C420jpeg\n`), fh = Buffer.from("FRAME\n");
  writeFileSync(path, Buffer.concat([head, ...Array.from({ length: frames }, () => [fh, frame]).flat()]));
}

// In the page: sample an image region and map pixel colour back to frame coordinates through lookup tables read from
// the video frame itself (luma down a column gives y, U along the middle row gives x), so colour-range and gamma
// handling do not matter; then extrapolate the window edges from two rows and two columns.
const MEASURE = `async function measure(src, box, rows, cols) {
  const Y = ([r, g, b]) => 0.257 * r + 0.504 * g + 0.098 * b + 16, U = ([r, g, b]) => -0.148 * r - 0.291 * g + 0.439 * b + 128;
  const sampler = (x) => (cx, cy, n = 3) => { const d = x.getImageData(Math.round(cx) - n, Math.round(cy) - n, 2 * n + 1, 2 * n + 1).data;
    let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const k = d.length / 4; return [r / k, g / k, b / k]; };
  const v = document.querySelector("#video"), fw = v.videoWidth, fh = v.videoHeight;
  const vc = new OffscreenCanvas(fw, fh), vx = vc.getContext("2d", { willReadFrequently: true }); vx.drawImage(v, 0, 0);
  const vp = sampler(vx), ys = [], us = [];
  for (let y = 0; y < fh; y++) ys.push(Y(vp(Math.round(fw * 0.02) + 3, Math.min(fh - 1, Math.max(0, y)), 0)));
  for (let x = 0; x < fw; x++) us.push(U(vp(x, Math.round(fh / 2), 0)));
  const inv = (tab, val) => { let best = Infinity; for (const t of tab) best = Math.min(best, Math.abs(t - val));
    const idx = []; tab.forEach((t, i) => { if (Math.abs(t - val) <= best + 0.5) idx.push(i); }); return idx.reduce((a, b) => a + b, 0) / idx.length; };
  const bmp = await createImageBitmap(src), c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(bmp, 0, 0);
  const px = sampler(x), fy = (p) => inv(ys, Y(p)), fx = (p) => inv(us, U(p));
  const lerp = (a, va, b, vb, t) => va + ((vb - va) * (t - a)) / (b - a);
  const [r1, r2] = rows, [c1, c2] = cols, midX = box.x + box.w * 0.02, midY = box.y + box.h / 2;
  const y1 = fy(px(midX, box.y + r1)), y2 = fy(px(midX, box.y + r2));
  const x1 = fx(px(box.x + c1, midY)), x2 = fx(px(box.x + c2, midY));
  const top = lerp(r1, y1, r2, y2, 0), bottom = lerp(r1, y1, r2, y2, box.h);
  const left = lerp(c1, x1, c2, x2, 0), right = lerp(c1, x1, c2, x2, box.w);
  return { y0: Math.min(top, bottom), y1: Math.max(top, bottom), x0: Math.min(left, right), x1: Math.max(left, right), imgW: bmp.width, imgH: bmp.height };
}`;

async function launch(chromium, profile, y4m) {
  const proc = spawn(chromium, ["--headless=new", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`,
    "--remote-debugging-port=0", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${y4m}`, "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--window-size=390,844", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const port = await new Promise((r, j) => {
    let err = "";
    proc.stderr.on("data", (d) => { err += d; const m = /DevTools listening on ws:\/\/[^:]+:(\d+)/.exec(err); if (m) r(+m[1]); });
    proc.on("close", (code) => j(new Error(`chromium exited (${code}): ${err.slice(-500)}`)));
  });
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
  const c = await cdp(page.webSocketDebuggerUrl);
  return { c, stop: async () => { c.close(); proc.kill(); await sleep(300); } };
}

async function checkSize(chromium, url, tmp, fw, fh, timeout) {
  const y4m = join(tmp, `ramp-${fw}x${fh}.y4m`);
  rampY4m(y4m, fw, fh);
  const b = await launch(chromium, join(tmp, `profile-${fw}x${fh}`), y4m);
  try {
    const c = b.c, errors = [];
    c.on((m, p) => { if (m === "Runtime.exceptionThrown") errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text); });
    await Promise.all(["Runtime.enable", "Page.enable"].map((m) => c.send(m)));
    await c.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    // Capture the file snap() would share: headless Chromium has no share sheet, so snap() takes the download path.
    await c.send("Page.addScriptToEvaluateOnNewDocument", { source: `{ const o = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (b) => { if (b instanceof Blob && b.type === "image/jpeg") window.__snap = b; return o(b); };
      HTMLAnchorElement.prototype.click = function () {};
      // An upright iPhone rotates the 1280x720 ideal to portrait; Chromium's fake camera would crop to it instead.
      const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (q) => { const v = q?.video;
        if (${fh > fw} && v?.width && v?.height) q = { ...q, video: { ...v, width: v.height, height: v.width } };
        return g(q); }; }` });
    await c.send("Page.navigate", { url });
    const t0 = Date.now();
    while (!(await evaluate(c, `!!document.querySelector("#start")`).catch(() => false))) await sleep(200);
    await evaluate(c, `document.querySelector("#start").click()`);
    // snap() returns early until the models are ready; click until it produces a file.
    for (;;) {
      if (Date.now() - t0 > timeout) {
        const ui = await evaluate(c, `JSON.stringify({ intro: document.querySelector("#intro").hidden, vw: document.querySelector("#video").videoWidth,
          status: document.querySelector("#status").textContent, err: document.querySelector("#introErr")?.textContent })`);
        throw new Error(`no snap after ${timeout / 1000} s; page ${ui}; errors: ${errors.slice(0, 3).join(" | ")}`);
      }
      await sleep(1000);
      if (await evaluate(c, `!!window.__snap`)) break;
      // app.js is a module: until it has run, #start has no handler, so click it again while the intro is up.
      await evaluate(c, `{ const s = document.querySelector("#start"); if (!document.querySelector("#intro").hidden && !s.disabled) s.click(); }`);
      await evaluate(c, `document.querySelector("#intro").hidden && document.querySelector("#video").videoWidth > 0 && document.querySelector("#snap").click()`);
      await sleep(1500);
      if (await evaluate(c, `!!window.__snap`)) break;
    }
    const info = await evaluate(c, `(() => { const v = document.querySelector("#video"), r = document.querySelector(".cam").getBoundingClientRect(),
      card = document.querySelector(".card").getBoundingClientRect();
      return { vw: v.videoWidth, vh: v.videoHeight, cam: { x: r.x, y: r.y, w: r.width, h: r.height }, cardTop: card.y }; })()`);
    // Live: the visible part of .cam (the card overlaps its bottom by 18 px).
    const visH = Math.min(info.cam.h, info.cardTop - info.cam.y);
    const shot = await c.send("Page.captureScreenshot", { format: "png" });
    const live = await evaluate(c, `(async () => { ${MEASURE}
      // Decode in-page, not with fetch("data:..."): the app's CSP connect-src does not allow data: URLs.
      const blob = new Blob([Uint8Array.from(atob("${shot.data}"), (ch) => ch.charCodeAt(0))], { type: "image/png" });
      return measure(blob, { x: ${info.cam.x}, y: ${info.cam.y}, w: ${info.cam.w}, h: ${info.cam.h} },
        [8, ${Math.floor(visH) - 8}], [8, ${Math.floor(info.cam.w) - 8}]); })()`);
    const snap = await evaluate(c, `(async () => { ${MEASURE}
      const bmp = await createImageBitmap(window.__snap), top = bmp.height - 675;
      return measure(window.__snap, { x: 0, y: 0, w: bmp.width, h: top }, [8, top - 80], [20, bmp.width - 20]); })()`);
    const jpeg = Buffer.from(await evaluate(c, `(async () => { const b = new Uint8Array(await window.__snap.arrayBuffer()); let s = "";
      for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(s); })()`), "base64");
    return { fw, fh, ...info, visH, live, snap, jpeg, errors, seconds: (Date.now() - t0) / 1000 };
  } finally { await b.stop(); }
}

async function main(argv) {
  const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
  const sizes = arg("--sizes", "720x1280,1280x720,640x480").split(",").map((s) => s.split("x").map(Number));
  const timeout = +arg("--timeout", 240) * 1000, save = arg("--save", null);
  const chromium = findExe("CHROMIUM", ["chromium", "chromium-browser", "google-chrome"]);
  const tmp = mkdtempSync(join(tmpdir(), "kitty-snap-"));
  const srv = await serve(ROOT);
  const url = `http://127.0.0.1:${srv.address().port}/index.html?cpu`;
  let bad = 0;
  try {
    for (const [fw, fh] of sizes) {
      const r = await checkSize(chromium, url, tmp, fw, fh, timeout);
      const f = (w) => `x ${w.x0.toFixed(0)}–${w.x1.toFixed(0)}, y ${w.y0.toFixed(0)}–${w.y1.toFixed(0)}`;
      const share = (w) => ((w.x1 - w.x0) * (w.y1 - w.y0)) / (r.vw * r.vh);
      const d = Math.max(Math.abs(r.live.x0 - r.snap.x0) / r.vw, Math.abs(r.live.x1 - r.snap.x1) / r.vw,
        Math.abs(r.live.y0 - r.snap.y0) / r.vh, Math.abs(r.live.y1 - r.snap.y1) / r.vh);
      const ok = d <= TOL && r.vw === fw && r.vh === fh;
      if (!ok) bad++;
      console.log(`${ok ? "ok  " : "FAIL"} frame ${r.vw}x${r.vh} (fed ${fw}x${fh}), .cam ${r.cam.w.toFixed(0)}x${r.cam.h.toFixed(0)} (visible ${r.visH.toFixed(0)}), snap ${r.snap.imgW}x${r.snap.imgH}`);
      console.log(`     live: ${f(r.live)} (${(share(r.live) * 100).toFixed(1)} % of the frame)`);
      console.log(`     snap: ${f(r.snap)} (${(share(r.snap) * 100).toFixed(1)} % of the frame); max edge difference ${(d * 100).toFixed(1)} % (${r.seconds.toFixed(0)} s)`);
      if (save) { mkdirSync(save, { recursive: true }); writeFileSync(join(save, `snap-${fw}x${fh}.jpg`), r.jpeg); }
      if (r.errors.length) console.log("     page errors: " + r.errors.slice(0, 3).join(" | "));
    }
  } finally {
    srv.close();
    rmSync(tmp, { recursive: true, force: true });
  }
  process.exit(bad ? 1 : 0);
}

main(process.argv.slice(2)).catch((e) => { console.error(e.stack || e); process.exit(1); });
