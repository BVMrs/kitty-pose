// Runs the REAL sw.js (unmodified) in a vm against a fake Cache API / fetch, then replays the app's request list:
// visit 1 (online, page NOT yet controlled by the SW), offline right after, visit 2 (controlled), offline again.
// usage: node lab/offline-sw/sim.mjs [path/to/sw.js]     (run from the repo root)
import vm from "node:vm";
import fs from "node:fs";
const swPath = process.argv[2] || "sw.js";
const src = fs.readFileSync(swPath, "utf8");
const ORIGIN = "https://app.test";

// Request list of one page load, from app.js / index.html. Sizes from curl, 2026-11-19.
const SHELL_REQS = ["/", "/style.css", "/app.js", "/memes.js", "/cats.js", "/manifest.webmanifest", "/icon.svg"];
const MEME_IMGS = fs.readdirSync("assets").map((f) => "/assets/" + f);   // app.js preloads every meme at module eval
const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const EXT = [ // [url, bytes, fetch mode]
  [MP + "/vision_bundle.mjs", 136870, "cors"],
  [MP + "/wasm/vision_wasm_internal.js", 209826, "no-cors"],
  [MP + "/wasm/vision_wasm_internal.wasm", 9423986, "cors"],
  ["https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", 3758596, "cors"],
  ["https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", 7819105, "cors"],
  ["https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;800&display=swap", 4000, "no-cors"],
  ["https://fonts.gstatic.com/s/inter/v20/x.woff2", 48000, "cors"],
];
const abs = (p) => ORIGIN + p;
const PAGE = [...SHELL_REQS, ...MEME_IMGS].map((p) => [abs(p), "same-origin"]).concat(EXT.map((e) => [e[0], e[2]]));

function makeEnv() {
  const net = { online: true, status: {} };
  const store = new Map();
  const norm = (u) => new URL(u, ORIGIN + "/").href;
  const caches = {
    async open(n) {
      if (!store.has(n)) store.set(n, new Map());
      const m = store.get(n);
      return {
        async match(r) { return m.get(typeof r === "string" ? norm(r) : r.url); },
        async put(r, res) { if (res.status === 206) throw new TypeError("Cache.put: 206 not cacheable"); m.set(r.url, res); },
        async addAll(urls) {
          const rs = await Promise.all(urls.map(async (u) => {
            const res = await net.fetch({ url: norm(u) });
            if (!res.ok) throw new TypeError("addAll " + u + " -> " + res.status);
            return [norm(u), res];
          }));
          for (const [u, res] of rs) m.set(u, res);
        },
      };
    },
    async keys() { return [...store.keys()]; },
    async delete(n) { return store.delete(n); },
    async match(r) { for (const m of store.values()) { const h = m.get(r.url); if (h) return h; } },
  };
  net.fetch = async (req) => {
    if (!net.online) throw new TypeError("offline");
    const s = net.status[req.url] ?? 200;
    const type = new URL(req.url).origin === ORIGIN ? "basic" : req.mode === "no-cors" ? "opaque" : "cors";
    return { url: req.url, status: s, ok: s >= 200 && s < 300, type, clone() { return this; } };
  };
  const handlers = {};
  const self = { addEventListener: (t, f) => (handlers[t] = f), skipWaiting() {}, clients: { claim() {} }, location: { origin: ORIGIN } };
  const ctx = vm.createContext({ self, caches, fetch: (r) => net.fetch(r), URL, location: self.location, Promise, console });
  vm.runInContext(src, ctx);
  const fire = async (type) => { let p; handlers[type]({ waitUntil: (x) => (p = x) }); return p; };
  const request = async (url, mode = "cors") => {
    let p; handlers.fetch({ request: { url, method: "GET", mode }, respondWith: (x) => (p = x) });
    if (!p) return { handled: false };
    try { const r = await p; return { handled: true, status: r?.status }; } catch (e) { return { handled: true, error: String(e.message) }; }
  };
  const cached = () => [...(store.get("kitty-v2") ?? new Map()).keys()];
  return { net, caches, fire, request, cached };
}

async function visit(env, controlled) {   // controlled=false: requests never reach the SW (first visit)
  const failed = [];
  for (const [u, mode] of PAGE) {
    if (!controlled) continue;
    const r = await env.request(u, mode);
    if (r.error) failed.push(u);
  }
  return failed;
}
const short = (u) => u.replace(ORIGIN, "").replace(/^https:\/\//, "").slice(0, 70);
const heavy = EXT.filter((e) => e[1] > 1e6).map((e) => e[0]);
const report = {};
{
  const env = makeEnv();
  await env.fire("install"); await env.fire("activate");
  await visit(env, false);                       // visit 1: all requests issued at module eval, before the SW controls the page
  const c1 = env.cached();
  report.after_visit1 = { cached: c1.length, external_cached: c1.filter((u) => !u.startsWith(ORIGIN)).length,
    models_and_wasm_cached: heavy.every((u) => c1.includes(u)) };
  env.net.online = false;
  report.offline_after_visit1_fails = (await visit(env, true)).map(short);
  env.net.online = true;
  await visit(env, true);                        // visit 2 online, controlled
  const c2 = env.cached();
  report.after_visit2 = { cached: c2.length, models_and_wasm_cached: heavy.every((u) => c2.includes(u)) };
  env.net.online = false;
  report.offline_after_visit2_fails = (await visit(env, true)).map(short);

  env.net.online = true; env.net.status[abs("/app.js")] = 404;      // a deploy gap / transient 404
  await env.request(abs("/app.js"));
  env.net.status[abs("/app.js")] = 200; env.net.online = false;
  const c = await (await env.caches.open("kitty-v2")).match(abs("/app.js"));
  report.app_js_cached_status_after_one_transient_404 = c.status;
}
{
  const env = makeEnv();
  env.net.status[abs("/assets/wizard.jpg")] = 404;
  let err = null; try { await env.fire("install"); } catch (e) { err = e.message; }
  report.install_with_one_missing_asset = err ? "REJECTS (whole SW install fails): " + err : "installs";
}
report.own_files_network_first_has_timeout = /AbortController|Promise\.race|setTimeout/.test(src);
console.log(JSON.stringify(report, null, 2));
console.log("first-visit external payload MB:", (EXT.reduce((a, e) => a + e[1], 0) / 1e6).toFixed(1),
  "| models+wasm MB:", (EXT.filter((e) => e[1] > 1e6).reduce((a, e) => a + e[1], 0) / 1e6).toFixed(1));
