#!/usr/bin/env node
// Plays a face clip into the real app as the camera and dumps what the app saw, frame by frame, to JSON:
// the 52 blendshape scores and the face landmarks faceFeatures() reads, the hand landmarks, and the meme shown.
// test/face-regression.test.js replays those dumps through memes.js and checks the labelled segments.
//
// How: the clip is converted (ffmpeg) to a Y4M file with a frame-index barcode on the bottom edge, held on its
// first frame for --lead s and on its last for --tail s. Headless Chromium plays it as a fake front camera
// (--use-file-for-fake-video-capture) into index.html, served from this folder on 127.0.0.1, at a 390x844 mobile
// viewport. A hook (globalThis.kittyTrace, called by app.js after every detection) records the inputs; the
// barcode says which clip frame was detected, since the app drops frames while MediaPipe is busy.
// Nothing leaves the machine except the app's own model/library downloads (jsDelivr, Google storage).
//
// Usage:
//   node demo/face-dump.mjs CLIP [--labels FILE] [--out FILE] [--lead S] [--tail S] [--width PX] [--fps N]
//   node demo/face-dump.mjs --clips demo/face-clips.json [--out-dir DIR] [--gz]
//                                       every clip in the manifest (see fetch-face-clips.mjs); the committed
//                                       fixtures are made with --out-dir test/fixtures/face --gz
// Out ending in .gz is gzipped (the committed fixtures in test/fixtures/face/ are).
// Labels: JSON {"segments": [{"from": s, "to": s, "meme": "pop" | ["smile", "smug"]}]}, clip seconds;
//   default CLIP minus extension + ".labels.json". Out default: $KITTY_FACE_DUMPS/<name>.dump.json.
// Needs: ffmpeg ($FFMPEG) and Chromium ($CHROMIUM, else chromium / chromium-browser / google-chrome on PATH).
// Headless Chromium has only software WebGL, so the app runs with ?cpu (MediaPipe's CPU delegate) and the clip plays
// at 1/--slow speed (default 10) so nearly every frame is detected; a 5 s clip takes ~100 s on 3 cores.
// $KITTY_GPU_FLAGS replaces the default "--use-angle=swiftshader --enable-unsafe-swiftshader"; KITTY_DEBUG=1 logs
// start-up timing and keeps going when the lead-in was too short.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { BITS, BLOCK, FORMAT, LANDMARKS, cacheDir, checkSegments, dumpsDir, decodeIndex, replay, stampFrame } from "./face-trace.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findExe(envVar, names) {
  if (process.env[envVar]) return process.env[envVar];
  for (const n of names) {
    const r = spawnSync("sh", ["-c", `command -v ${n}`], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  throw new Error(`${names[0]} not found: put it on PATH or set $${envVar}`);
}

// ---------- clip -> stamped Y4M ----------
// Streams ffmpeg's Y4M output, stamping each frame's index; returns { w, h, fps, lead, frames, total }.
export async function makeY4m(ffmpeg, clip, out, { width = 640, fps = 30, slow = 1, lead = 3, tail = 2 } = {}) {
  const ff = spawn(ffmpeg, ["-v", "error", "-i", clip, "-an", "-vf", `fps=${fps},scale=${width}:-2`, "-pix_fmt", "yuv420p",
    "-f", "yuv4mpegpipe", "-"], { stdio: ["ignore", "pipe", "inherit"] });
  const ws = createWriteStream(out);
  const write = (b) => (ws.write(b) ? null : new Promise((r) => ws.once("drain", r)));
  let buf = Buffer.alloc(0), w = 0, h = 0, size = 0, index = 0, frames = 0, last = null;
  const L = Math.round(lead * fps), T = Math.round(tail * fps);
  const emit = async (frame) => {
    await write(Buffer.from("FRAME\n"));
    await write(stampFrame(Buffer.from(frame), w, h, index++));
  };
  for await (const chunk of ff.stdout) {
    buf = Buffer.concat([buf, chunk]);
    if (!w) {
      const nl = buf.indexOf(10);
      if (nl < 0) continue;
      const head = buf.subarray(0, nl).toString();
      w = +/ W(\d+)/.exec(head)[1]; h = +/ H(\d+)/.exec(head)[1]; size = (w * h * 3) / 2;
      await write(Buffer.from(`YUV4MPEG2 W${w} H${h} F${fps}:${slow} Ip A1:1 C420jpeg\n`));
      buf = buf.subarray(nl + 1);
    }
    for (;;) {
      const nl = buf.indexOf(10);
      if (nl < 0 || buf.length < nl + 1 + size) break;
      const frame = buf.subarray(nl + 1, nl + 1 + size);
      if (!frames) for (let k = 0; k < L; k++) await emit(frame);
      await emit(frame); frames++; last = Buffer.from(frame);
      buf = buf.subarray(nl + 1 + size);
    }
  }
  const code = await new Promise((r) => (ff.exitCode !== null ? r(ff.exitCode) : ff.on("close", r)));
  if (code !== 0 || !frames) throw new Error(`ffmpeg failed on ${clip} (exit ${code}, ${frames} frames)`);
  for (let k = 0; k < T; k++) await emit(last);
  await new Promise((r) => ws.end(r));
  if (index > 0xffff) throw new Error(`clip too long: ${index} frames (max 65535)`);
  return { w, h, fps, lead: L, frames, total: index };
}

// ---------- tiny static server for the app ----------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif" };
function serve(root) {
  const srv = createServer((req, res) => {
    const p = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    const f = p.endsWith("/") ? join(p, "index.html") : p;
    if (!f.startsWith(root) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream", "cache-control": "no-store" });
    createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r(srv)));
}

// ---------- minimal Chrome DevTools Protocol client (Node >= 22 global WebSocket) ----------
async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error("CDP connect failed")); });
  let id = 0;
  const waiting = new Map(), listeners = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { const { r, j } = waiting.get(m.id); waiting.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); }
    else if (m.method) for (const l of listeners) l(m.method, m.params);
  };
  return {
    send: (method, params = {}) => new Promise((r, j) => { waiting.set(++id, { r, j }); ws.send(JSON.stringify({ id, method, params })); }),
    on: (fn) => listeners.push(fn),
    close: () => ws.close(),
  };
}

async function evaluate(c, expression) {
  const r = await c.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`page: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
  return r.result.value;
}

// Runs in the page before app.js. Records, per detected frame, the barcode bits and the detector outputs.
const hookSource = (w) => `(() => {
  const LM = ${JSON.stringify(LANDMARKS)}, BITS = ${BITS}, BLOCK = ${BLOCK}, W = ${w};
  const kt = window.__kt = { frames: [], names: null };
  let cx;
  globalThis.kittyTrace = (fr, hr, current, now) => {
    const v = document.querySelector("#video"), s = v.videoWidth / W;
    cx ||= new OffscreenCanvas(BITS * BLOCK, BLOCK).getContext("2d", { willReadFrequently: true });
    cx.drawImage(v, 0, v.videoHeight - BLOCK * s, BITS * BLOCK * s, BLOCK * s, 0, 0, BITS * BLOCK, BLOCK);
    const px = cx.getImageData(0, 0, BITS * BLOCK, BLOCK).data, bits = [];
    for (let k = 0; k < BITS; k++) bits.push(px[((BLOCK >> 1) * BITS * BLOCK + k * BLOCK + (BLOCK >> 1)) * 4] > 128 ? 1 : 0);
    const cats = fr.faceBlendshapes?.[0]?.categories;
    if (cats && !kt.names) kt.names = cats.map((c) => c.categoryName);
    const lm = fr.faceLandmarks?.[0];
    kt.frames.push({ bits, now, app: current, vw: v.videoWidth, vh: v.videoHeight,
      b: cats ? cats.map((c) => c.score) : null,
      lm: lm ? LM.map((i) => [lm[i].x, lm[i].y, lm[i].z]) : null,
      hands: (hr.landmarks || []).map((h) => h.map((p) => [p.x, p.y, p.z])) });
  };
})();`;

export { cacheDir, cdp, dumpsDir, evaluate, findExe, serve };   // serve/cdp/evaluate/findExe: also demo/offline-check.mjs

export async function dumpClip(clip, { labels, out, lead = 2, tail = 2, width = 640, fps = 30, slow = 10, digits = 4, timeout, log = console.error } = {}) {
  const ffmpeg = findExe("FFMPEG", ["ffmpeg"]);
  const chromium = findExe("CHROMIUM", ["chromium", "chromium-browser", "google-chrome"]);
  const tmp = mkdtempSync(join(tmpdir(), "kitty-face-"));
  const t0 = Date.now();
  let browser, srv, c;
  try {
    const y4m = join(tmp, "clip.y4m");
    const v = await makeY4m(ffmpeg, clip, y4m, { width, fps, slow, lead, tail });
    log(`${basename(clip)}: ${v.frames} frames ${v.w}x${v.h} @${fps} fps played at 1/${slow} speed, +${v.lead} lead-in, ${v.total} in all (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

    srv = await serve(ROOT);
    const url = `http://127.0.0.1:${srv.address().port}/index.html?cpu`;
    browser = spawn(chromium, ["--headless=new", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${join(tmp, "profile")}`,
      "--remote-debugging-port=0", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${y4m}`, "--autoplay-policy=no-user-gesture-required", ...(process.env.KITTY_GPU_FLAGS ?? "--use-angle=swiftshader --enable-unsafe-swiftshader").split(" ").filter(Boolean),
      "--window-size=390,844", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
    const port = await new Promise((r, j) => {
      let err = "";
      browser.stderr.on("data", (d) => { err += d; const m = /DevTools listening on ws:\/\/[^:]+:(\d+)/.exec(err); if (m) r(+m[1]); });
      browser.on("close", (code) => j(new Error(`chromium exited (${code}): ${err.slice(-500)}`)));
    });
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
    c = await cdp(page.webSocketDebuggerUrl);
    const errors = [], warns = [], hosts = new Set(), posts = [];
    c.on((m, p) => {
      if (m === "Runtime.exceptionThrown") errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text);
      if (m === "Runtime.consoleAPICalled" && p.type === "warning") warns.push(p.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200));
      if (m === "Runtime.consoleAPICalled" && p.type === "error") {
        const text = p.args.map((a) => a.value ?? a.description).join(" ");
        if (!/^(INFO|W\d{4} )/.test(text)) errors.push(text);           // MediaPipe's wasm logs info lines via console.error
      }
      if (m === "Network.requestWillBeSent") { const u = new URL(p.request.url); if (u.protocol.startsWith("http")) hosts.add(u.host); if (p.request.method === "POST") posts.push(p.request.url); }
    });
    await Promise.all(["Runtime.enable", "Network.enable", "Page.enable"].map((m) => c.send(m)));
    await c.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await c.send("Page.addScriptToEvaluateOnNewDocument", { source: hookSource(v.w) });
    await c.send("Page.navigate", { url });

    // Start the camera once both models are downloaded, so the lead-in covers model start-up.
    const deadline = Date.now() + (timeout ?? 120 + (3 * v.total * slow) / fps) * 1000;
    while (await evaluate(c, `performance.getEntriesByType("resource").filter((e) => e.name.endsWith(".task") && e.responseEnd > 0).length`) < 2) {
      if (Date.now() > deadline) throw new Error("models did not download");
      await sleep(250);
    }
    await evaluate(c, `document.querySelector("#start").click()`);
    const clicked = Date.now();

    const frames = [];
    let names = null, bad = 0, done = false, last = -1;
    while (!done) {
      if (Date.now() > deadline) {
        const ui = await evaluate(c, `[document.querySelector("#status").textContent, document.querySelector("#introErr")?.textContent].join(" / ")`);
        throw new Error(`timed out after ${frames.length} frames (last index ${last}); page: ${ui}; errors: ${errors.slice(0, 3).join(" | ")}`);
      }
      await sleep(250);
      const got = await evaluate(c, `({ frames: window.__kt.frames.splice(0), names: window.__kt.names })`);
      names ||= got.names;
      for (const f of got.frames) {
        const i = decodeIndex(f.bits);
        if (i === null || i >= v.total) { bad++; continue; }
        if (i < last) { done = true; break; }          // the fake camera looped: one full pass is in
        last = i;
        frames.push({ i, t: +((i - v.lead) / fps).toFixed(4), now: f.now, app: f.app, b: f.b, lm: f.lm, hands: f.hands, vw: f.vw, vh: f.vh });
      }
      if (last >= v.total - 1) done = true;
    }
    if (process.env.KITTY_DEBUG) log(`first frame ${frames[0]?.i} (${frames.length} frames); clicked ${((clicked - t0) / 1000).toFixed(1)} s; warnings: ${warns.slice(0, 3).join(" | ")}`);
    if (!frames.length) throw new Error("no frames were detected");
    if (frames[0].i >= v.lead && !process.env.KITTY_DEBUG) throw new Error(`the first detected frame (${frames[0].i}) is past the ${v.lead}-frame lead-in: raise --lead`);
    if (!names) throw new Error("no face was found in any frame");

    const labelSet = labels ?? {};
    const dump = {
      format: FORMAT,
      clip: { name: basename(clip).replace(/\.[^.]+$/, ""), sha256: createHash("sha256").update(readFileSync(clip)).digest("hex"),
        width: v.w, height: v.h, fps, slow, frames: v.frames, lead, tail: tail, video: [frames[0].vw, frames[0].vh] },
      source: labelSet.source,
      landmarks: LANDMARKS, blendshapes: names,
      segments: labelSet.segments || [],
      run: { date: new Date().toISOString().slice(0, 10), seconds: +((Date.now() - t0) / 1000).toFixed(1), detected: frames.length,
        unreadable: bad, errors, hosts: [...hosts].sort(), posts },
      frames: frames.map(({ vw, vh, ...f }) => f),
    };
    // The replay must reproduce the app's own choice on every frame, before and after rounding.
    const same = (w) => w.filter((x, k) => x === dump.frames[k].app).length;
    const exact = same(replay(dump, { clock: "app" }));
    const r = (x) => +x.toFixed(digits);
    for (const f of dump.frames) {
      if (f.b) f.b = f.b.map(r);
      if (f.lm) f.lm = f.lm.map((p) => p.map(r));
      f.hands = f.hands.map((h) => h.map((p) => p.map(r)));
    }
    dump.run.agree = { exact, rounded: same(replay(dump, { clock: "app" })), of: frames.length };
    // The app sometimes detects the same video frame twice; the clip-clock replay wants each clip frame once.
    dump.frames = dump.frames.filter((f, k) => k === 0 || f.i !== dump.frames[k - 1].i);
    dump.run.repeats = frames.length - dump.frames.length;
    const winners = replay(dump);
    const segs = checkSegments(dump, winners);
    out ||= join(dumpsDir(), `${dump.clip.name}.dump.json`);
    mkdirSync(dirname(out), { recursive: true });
    const json = JSON.stringify(dump) + "\n";
    writeFileSync(out, out.endsWith(".gz") ? gzipSync(json, { level: 9 }) : json);
    return { out, dump, winners, segs };
  } finally {
    c?.close();
    browser?.kill();
    srv?.close();
    await sleep(300);
    rmSync(tmp, { recursive: true, force: true });
  }
}

export function report({ out, dump, winners, segs }) {
  const runs = [];                                         // the shown meme over clip time, as runs
  dump.frames.forEach((f, k) => { const w = winners[k]; if (!runs.length || runs.at(-1).w !== w) runs.push({ w, from: f.t }); });
  const lines = [
    `${dump.clip.name}: ${dump.run.detected} frames detected of ${dump.clip.frames + Math.round((dump.clip.lead + dump.clip.tail) * dump.clip.fps)}` +
      ` (${dump.run.unreadable} unreadable), video ${dump.clip.video.join("x")}, ${dump.run.seconds} s`,
    `  replay == app on ${dump.run.agree.exact}/${dump.run.agree.of} frames (${dump.run.agree.rounded} after rounding); ${dump.run.repeats} repeated frames dropped`,
    `  shown: ${runs.map((r) => `${r.from.toFixed(2)}s ${r.w}`).join(" -> ")}`,
    `  hosts: ${dump.run.hosts.join(", ")}; POSTs: ${dump.run.posts.length}; console errors: ${dump.run.errors.length}`,
    ...dump.run.errors.slice(0, 5).map((e) => `    ! ${String(e).split("\n")[0]}`),
    ...segs.map((s) => `  ${s.ok ? "ok  " : s.todo ? "TODO" : "FAIL"} ${s.from}..${s.to}s want ${[].concat(s.meme).join("|")}: ${(s.share * 100).toFixed(0)}% of ${s.n} frames (${s.top})`),
    `  -> ${out}`,
  ];
  return lines.join("\n");
}

async function main(argv) {
  const opt = {}, jobs = [];
  let clip, labelsPath, manifest, outDir, gz = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--labels") labelsPath = argv[++i];
    else if (a === "--clips") manifest = argv[++i];
    else if (a === "--out") opt.out = argv[++i];
    else if (a === "--out-dir") outDir = argv[++i];
    else if (a === "--gz") gz = true;
    else if (["--lead", "--tail", "--width", "--fps", "--slow", "--digits", "--timeout"].includes(a)) opt[a.slice(2)] = +argv[++i];
    else if (!a.startsWith("--") && !clip) clip = a;
    else {
      console.error("usage: node demo/face-dump.mjs CLIP [--labels FILE] [--out FILE] [--lead S] [--tail S] [--width PX] [--fps N] [--slow N] [--digits N]\n" +
        "       node demo/face-dump.mjs --clips demo/face-clips.json [--out-dir DIR] [--gz]");
      return 2;
    }
  }
  if (manifest) {
    const m = JSON.parse(readFileSync(manifest, "utf8"));
    const dir = process.env.KITTY_FACE_CLIPS || cacheDir("face-clips");
    for (const e of m.clips) jobs.push({ clip: join(dir, e.file), opt: { ...opt,
      out: join(outDir || dumpsDir(), e.file.replace(/\.[^.]+$/, "") + (gz ? ".dump.json.gz" : ".dump.json")), lead: e.lead ?? opt.lead, tail: e.tail ?? opt.tail,
      labels: { source: { url: e.url, licence: m.licence, credit: m.credit }, segments: e.segments } } });
  } else if (clip) {
    const lp = labelsPath || clip.replace(/\.[^.]+$/, "") + ".labels.json";
    if (!existsSync(lp)) console.error(`no labels (${lp}): dumping without segments`);
    jobs.push({ clip, opt: { ...opt, labels: existsSync(lp) ? JSON.parse(readFileSync(lp, "utf8")) : undefined } });
  } else return main(["--help"]);

  let failed = 0;
  for (const j of jobs) {
    if (!existsSync(j.clip)) { console.error(`missing ${j.clip} (run node demo/fetch-face-clips.mjs)`); failed++; continue; }
    const r = await dumpClip(j.clip, j.opt);
    console.log(report(r));
    if (r.segs.some((s) => !s.ok && !s.todo) || r.dump.run.errors.length) failed++;
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e.message); process.exit(1); });
}
