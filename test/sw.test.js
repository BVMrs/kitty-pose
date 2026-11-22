// Runs the real sw.js in a vm against a fake Cache API and network, and replays one page load:
// visit 1 online (the page is NOT controlled yet, so only install/activate run), then reload offline.
// Same model as lab/offline-sw/sim.mjs on the agents/lab branch (lab/2026-11-19-offline-sw.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const V = SRC.match(/const V = "([^"]+)"/)[1];
const ORIGIN = "https://app.test";
const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const APP = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const INDEX = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const MODELS = [...APP.matchAll(/"(https:\/\/storage\.googleapis\.com\/[^"]+\.task)"/g)].map((m) => m[1]);
const FONT_CSS = INDEX.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/)[1].replaceAll("&amp;", "&");
const LATIN = "https://fonts.gstatic.com/s/anton/v1/latin.woff2", CYRILLIC = "https://fonts.gstatic.com/s/anton/v1/cyrillic.woff2";
const CSS_BODY = `/* cyrillic */\n@font-face { src: url(${CYRILLIC}) format('woff2'); unicode-range: U+0301, U+0400-045F; }\n` +
  `/* latin */\n@font-face { src: url(${LATIN}) format('woff2'); unicode-range: U+0000-00FF, U+0131; }\n`;
const SIMD = [MP + "/wasm/vision_wasm_internal.js", MP + "/wasm/vision_wasm_internal.wasm"];
const NOSIMD = [MP + "/wasm/vision_wasm_nosimd_internal.js", MP + "/wasm/vision_wasm_nosimd_internal.wasm"];
const HEAVY = [MP + "/vision_bundle.mjs", ...SIMD, ...MODELS];

// One page load: shell, every meme photo (app.js preloads them), MediaPipe bundle + wasm + models, fonts.
const PAGE = [["/", "navigate"], ...["/style.css", "/app.js", "/memes.js", "/cats.js", "/manifest.webmanifest", "/icon.svg",
  ...fs.readdirSync(new URL("../assets", import.meta.url)).map((f) => "/assets/" + f)].map((p) => [p, "same-origin"])]
  .map(([p, m]) => [ORIGIN + p, m])
  .concat([[MP + "/vision_bundle.mjs", "cors"], [SIMD[0], "no-cors"], [SIMD[1], "cors"], ...MODELS.map((u) => [u, "cors"]),
    [FONT_CSS, "no-cors"], [LATIN, "cors"]]);

function makeEnv({ wasm = WebAssembly, timeScale = 0.01 } = {}) {   // wasm: "none" = no WebAssembly at all
  const net = { online: true, status: {}, stall: false, log: [] };
  const store = new Map();
  const key = (r) => new URL(typeof r === "string" ? r : r.url, ORIGIN + "/").href;
  const noSearch = (u) => { const x = new URL(u); x.search = ""; return x.href; };
  const lookup = (m, r, o = {}) => o.ignoreSearch ? [...m].find(([k]) => noSearch(k) === noSearch(key(r)))?.[1] : m.get(key(r));
  const caches = {
    async open(n) {
      if (!store.has(n)) store.set(n, new Map());
      const m = store.get(n);
      return {
        async match(r, o) { return lookup(m, r, o); },
        async put(r, res) { m.set(key(r), res); },
        async addAll(urls) {
          const rs = await Promise.all(urls.map(async (u) => {
            const res = await net.fetch(u);
            if (!res.ok) throw new TypeError("addAll " + u + " -> " + res.status);
            return [key(u), res];
          }));
          for (const [u, res] of rs) m.set(u, res);
        },
      };
    },
    async keys() { return [...store.keys()]; },
    async delete(n) { return store.delete(n); },
    async match(r, o) { for (const m of store.values()) { const h = lookup(m, r, o); if (h) return h; } },
  };
  net.fetch = async (r) => {
    const url = key(r);
    net.log.push(url);
    if (!net.online) throw new TypeError("offline");
    if (net.stall) return new Promise(() => {});
    const status = net.status[url] ?? 200;
    const type = new URL(url).origin === ORIGIN ? "basic" : "cors";
    const res = { url, status, ok: status >= 200 && status < 300, type, from: "net",
      clone() { return { ...this }; }, async text() { return url === FONT_CSS ? CSS_BODY : ""; } };
    return res;
  };
  const handlers = {};
  const self = { addEventListener: (t, f) => (handlers[t] = f), skipWaiting() {}, clients: { claim() {} }, location: { origin: ORIGIN } };
  const ctx = vm.createContext({ self, caches, fetch: (r) => net.fetch(r), URL, location: self.location, Promise, console,
    ...(wasm === "none" ? {} : { WebAssembly: wasm }), Uint8Array, Error, TypeError, Set, setTimeout: (f, ms) => setTimeout(f, ms * timeScale), clearTimeout });
  if (wasm === "none") vm.runInContext("delete globalThis.WebAssembly", ctx);   // the context has its own built-in
  vm.runInContext(SRC, ctx);
  const fire = async (type) => { let p; handlers[type]({ waitUntil: (x) => (p = x) }); return p; };
  const request = async (url, mode = "cors") => {
    let p; const pending = [];
    handlers.fetch({ request: { url, method: "GET", mode }, respondWith: (x) => (p = x), waitUntil: (x) => pending.push(x) });
    if (!p) return { handled: false };
    try { const r = await p; await Promise.all(pending); return { handled: true, status: r.status, res: r }; }
    catch (e) { return { handled: true, error: String(e.message) }; }
  };
  const cached = () => [...(store.get(V) ?? new Map()).keys()];
  return { net, store, caches, fire, request, cached };
}

const visit = async (env) => {
  const failed = [];
  for (const [u, mode] of PAGE) { const r = await env.request(u, mode); if (r.error || r.status !== 200) failed.push(u); }
  return failed;
};

test("offline works after ONE online visit: install precaches MediaPipe bundle, wasm, models and Latin fonts", async () => {
  const env = makeEnv();
  await env.fire("install"); await env.fire("activate");   // visit 1: page uncontrolled, its own requests bypass the SW
  const c = env.cached();
  for (const u of [...HEAVY, FONT_CSS, LATIN]) assert.ok(c.includes(u), "precached: " + u);
  assert.ok(!c.includes(CYRILLIC), "only the Latin font subset is precached");
  env.net.online = false;
  assert.deepEqual(await visit(env), [], "offline reload after visit 1");
});

test("sw.js names the same MediaPipe version, models and font CSS as app.js and index.html", () => {
  assert.ok(APP.includes(`"${MP}/vision_bundle.mjs"`) && APP.includes(`"${MP}/wasm"`), "app.js loads " + MP);
  assert.ok(SRC.includes(`const MP = "${MP}"`), "sw.js precaches " + MP);
  for (const u of [...MODELS, FONT_CSS]) assert.ok(SRC.includes(`"${u}"`), "sw.js lists " + u);
  assert.equal(MODELS.length, 2);
});

test("the SW caches the same wasm variant vision_bundle.mjs 0.10.14 will pick", async () => {
  const bundleProbe = [0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11];
  assert.match(SRC, new RegExp(bundleProbe.join(",")), "SIMD probe bytes match the bundle's");
  const variants = async (wasm) => { const env = makeEnv({ wasm }); await env.fire("install");
    return env.cached().filter((u) => u.includes("/wasm/")).sort(); };
  assert.deepEqual(await variants(WebAssembly), [...SIMD].sort());                      // Node, like Safari 16.4+, has SIMD
  assert.deepEqual(await variants({ instantiate: () => Promise.reject(new Error("no simd")) }), [...NOSIMD].sort());
  assert.deepEqual(await variants("none"), [...SIMD, ...NOSIMD].sort(), "probe impossible: cache both");
});

test("a CDN failure does not fail install; a missing shell file still does", async () => {
  const env = makeEnv();
  env.net.status[MODELS[1]] = 503; env.net.status[FONT_CSS] = 500;
  await env.fire("install");
  assert.ok(env.cached().includes(ORIGIN + "/app.js"));
  assert.ok(!env.cached().includes(MODELS[1]), "a 503 is not cached");
  assert.ok(env.cached().includes(MODELS[0]));

  const env2 = makeEnv();
  env2.net.status[ORIGIN + "/assets/wizard.jpg"] = 404;
  await assert.rejects(env2.fire("install"));
});

test("a transient 404 of an own file neither replaces nor hides the cached copy", async () => {
  const env = makeEnv();
  await env.fire("install"); await env.fire("activate");
  env.net.status[ORIGIN + "/app.js"] = 404;
  assert.equal((await env.request(ORIGIN + "/app.js")).status, 200, "served the cached copy");
  delete env.net.status[ORIGIN + "/app.js"];
  env.net.online = false;
  assert.equal((await env.request(ORIGIN + "/app.js")).status, 200);
});

test("own files: network first, cached copy after the timeout on a stalled network", async () => {
  const env = makeEnv();
  await env.fire("install"); await env.fire("activate");
  const r = await env.request(ORIGIN + "/memes.js");
  assert.equal(r.res.from, "net", "online: fresh copy from the network");
  env.net.stall = true;
  const t0 = Date.now();
  const s = await env.request(ORIGIN + "/memes.js");
  assert.equal(s.status, 200);
  assert.ok(Date.now() - t0 < 1000, "fell back to the cache after the (scaled) 3 s timeout");
  assert.equal((await env.request(ORIGIN + "/?cpu", "navigate")).status, 200, "navigation with a query string uses ./");
});

test("an update reuses the previous version's heavy files instead of downloading 21 MB again", async () => {
  const env = makeEnv();
  const old = await env.caches.open("kitty-v3");
  for (const u of HEAVY) await old.put(u, { url: u, status: 200, ok: true, type: "cors", clone() { return { ...this }; } });
  await old.put(SIMD[0], { url: SIMD[0], status: 0, ok: false, type: "opaque", clone() { return { ...this }; } });   // runtime-cached via <script>
  await env.fire("install"); await env.fire("activate");
  for (const u of HEAVY.filter((u) => u !== SIMD[0])) assert.ok(!env.net.log.includes(u), "not refetched: " + u);
  assert.ok(env.net.log.includes(SIMD[0]), "an opaque old copy is refetched, not reused");
  for (const u of HEAVY) assert.ok(env.cached().includes(u), "copied into " + V + ": " + u);
  assert.deepEqual(await env.caches.keys(), [V]);
});

test("heavy hosts are matched exactly: look-alike hosts are not cached, the real ones are", async () => {
  const env = makeEnv();
  await env.fire("install"); await env.fire("activate");
  const REAL = [...MODELS, MP + "/vision_bundle.mjs", FONT_CSS, LATIN];
  for (const x of REAL) {
    const suffixed = new URL(x); suffixed.host += ".evil.example";
    assert.equal((await env.request(suffixed.href)).handled, false, "look-alike is not heavy: " + suffixed.href);
    const prefixed = new URL(x); prefixed.host = "x" + prefixed.host;
    assert.equal((await env.request(prefixed.href)).handled, false, "prefixed host is not heavy: " + prefixed.href);
  }
  for (const u of REAL) assert.equal((await env.request(u)).handled, true, "heavy: " + u);
});
