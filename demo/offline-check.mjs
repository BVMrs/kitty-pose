#!/usr/bin/env node
// Offline after ONE visit, in a real browser: headless Chromium at a 390x844 mobile viewport opens the app once
// online (served from this folder on 127.0.0.1), waits for sw.js to install, then restarts with the same profile,
// the local server stopped and every DNS lookup failing, reloads the page, starts the (fake) camera and waits for
// MediaPipe to detect frames. Prints what the service worker precached and where every response of the offline
// visit came from; exits 1 unless the app detects frames with nothing from the network.
//
// Usage: node demo/offline-check.mjs [--timeout S]       Needs Chromium ($CHROMIUM, else chromium / google-chrome on PATH).
// Runs the app with ?cpu (MediaPipe's CPU delegate), as demo/face-dump.mjs does, since headless WebGL is software.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cdp, evaluate, findExe, serve } from "./face-dump.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (u) => u.replace(/^https?:\/\/(127\.0\.0\.1:\d+)?/, "").replace(/^\/npm\/@mediapipe\/tasks-vision@[^/]+/, "…").slice(0, 110);

async function launch(chromium, profile, extra = []) {
  const proc = spawn(chromium, ["--headless=new", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`,
    "--remote-debugging-port=0", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--window-size=390,844", ...extra, "about:blank"],
    { stdio: ["ignore", "ignore", "pipe"] });
  const port = await new Promise((r, j) => {
    let err = "";
    proc.stderr.on("data", (d) => { err += d; const m = /DevTools listening on ws:\/\/[^:]+:(\d+)/.exec(err); if (m) r(+m[1]); });
    proc.on("close", (code) => j(new Error(`chromium exited (${code}): ${err.slice(-500)}`)));
  });
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
  const c = await cdp(page.webSocketDebuggerUrl);
  await Promise.all(["Runtime.enable", "Network.enable", "Page.enable"].map((m) => c.send(m)));
  await c.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  const stop = async () => { c.close(); proc.kill(); await new Promise((r) => (proc.exitCode !== null ? r() : proc.on("close", r))); };
  return { c, stop };
}

const SW_STATE = `(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  const names = await caches.keys(), urls = [];
  for (const n of names) for (const q of await (await caches.open(n)).keys()) urls.push(q.url);
  return { state: r?.active?.state ?? r?.installing?.state ?? null, names, urls };
})()`;

async function main(argv) {
  const timeout = (argv.includes("--timeout") ? +argv[argv.indexOf("--timeout") + 1] : 240) * 1000;
  const chromium = findExe("CHROMIUM", ["chromium", "chromium-browser", "google-chrome"]);
  const tmp = mkdtempSync(join(tmpdir(), "kitty-offline-"));
  const profile = join(tmp, "profile");
  let b;
  try {
    // ---- visit 1, online ----
    const srv = await serve(ROOT);
    const url = `http://127.0.0.1:${srv.address().port}/?cpu`;
    b = await launch(chromium, profile);
    const t0 = Date.now();
    await b.c.send("Page.navigate", { url });
    let sw;
    for (;;) {
      sw = await evaluate(b.c, SW_STATE).catch(() => null);
      if (sw?.state === "activated") break;
      if (Date.now() - t0 > timeout) throw new Error(`the service worker did not activate (state ${sw?.state})`);
      await sleep(500);
    }
    const external = sw.urls.filter((u) => !u.startsWith("http://127.0.0.1"));
    console.log(`visit 1 (online): service worker activated after ${((Date.now() - t0) / 1000).toFixed(1)} s; cache ${sw.names.join(", ")}: ` +
      `${sw.urls.length} entries, ${external.length} external:`);
    for (const u of external) console.log("  " + short(u));
    await b.stop(); b = null;
    await new Promise((r) => srv.close(r));

    // ---- visit 2, offline: no server, no DNS ----
    b = await launch(chromium, profile, ["--host-resolver-rules=MAP * ~NOTFOUND"]);
    const resp = [], failed = [], errors = [];
    b.c.on((m, p) => {
      if (m === "Network.responseReceived" && /^https?:/.test(p.response.url)) resp.push({ url: p.response.url, sw: p.response.fromServiceWorker, status: p.response.status });
      if (m === "Network.loadingFailed" && !p.canceled) failed.push(p.requestId + " " + p.errorText);
      if (m === "Runtime.exceptionThrown") errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text);
    });
    await b.c.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__frames = 0; globalThis.kittyTrace = () => { window.__frames++; };" });
    const t1 = Date.now();
    await b.c.send("Page.navigate", { url });
    let frames = 0;
    for (;;) {
      await sleep(500);
      const s = await evaluate(b.c, `({ frames: window.__frames ?? 0, intro: !document.querySelector("#intro")?.hidden,
        btn: !!document.querySelector("#start") && !document.querySelector("#start").disabled,
        status: document.querySelector("#status")?.textContent, err: document.querySelector("#introErr")?.textContent })`).catch(() => null);
      if (s?.intro && s.btn && !s.err) await evaluate(b.c, `document.querySelector("#start").click()`);
      if (s?.err) throw new Error("app error offline: " + s.err);
      if ((frames = s?.frames ?? 0) >= 5) break;
      if (Date.now() - t1 > timeout) throw new Error(`no detections offline after ${timeout / 1000} s (status: ${s?.status}; errors: ${errors.slice(0, 3).join(" | ")})`);
    }
    const fromNet = resp.filter((r) => !r.sw);
    console.log(`visit 2 (offline): ${frames} frames detected after ${((Date.now() - t1) / 1000).toFixed(1)} s; ` +
      `${resp.length} responses, ${resp.length - fromNet.length} from the service worker, ${fromNet.length} from the network; ` +
      `${failed.length} failed loads; ${errors.length} page errors`);
    for (const r of fromNet) console.log("  network: " + short(r.url) + " " + r.status);
    for (const f of failed) console.log("  failed: " + f);
    const ok = frames > 0 && fromNet.length === 0;
    console.log(ok ? "OK: the app starts and detects offline after one visit" : "FAIL");
    return ok ? 0 : 1;
  } finally {
    await b?.stop();
    rmSync(tmp, { recursive: true, force: true });
  }
}

main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e.message); process.exit(1); });
