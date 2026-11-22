// Offline after the first visit: app shell + MediaPipe runtime + models.
// On the first visit the page is not controlled by this worker yet, so its own requests for the 21 MB of
// MediaPipe files never reach the fetch handler: they are precached here, at install, instead.
const V = "kitty-v4";
const SHELL = ["./", "index.html", "style.css", "app.js", "memes.js", "cats.js", "manifest.webmanifest", "icon.svg",
  ...["pop.jpg", "shocked.jpg", "close-stare.jpg", "hiss.jpg", "crying.jpg", "smile.jpg", "smug.jpg", "side-eye.jpg", "lookaway.jpg",
      "think.jpg", "laugh-point.gif", "point.jpg", "fistbump.jpg", "angry-fist.jpg", "shaka.jpg", "wizard.jpg", "stare.jpg"].map((f) => "assets/" + f)];
// Must match app.js (bundle version, wasm base, model URLs) and index.html (font CSS).
const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODELS = ["https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"];
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;800&display=swap";
// The same probe vision_bundle.mjs 0.10.14 uses to pick vision_wasm_internal (SIMD) or vision_wasm_nosimd_internal,
// so the variant cached here is the one the page will ask for (9.4 MB each; a 2024 iPhone takes the SIMD one).
const SIMD_PROBE = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]);
// Exact hosts only: an unanchored regex would also match look-alikes (the Google storage host with a suffix appended).
const HEAVY_HOSTS = new Set(["storage.googleapis.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"]);
const NET_TIMEOUT_MS = 3000;   // own files: wait this long for the network before serving the cached copy

async function wasmVariants() {
  let simd;
  try { await WebAssembly.instantiate(SIMD_PROBE); simd = true; } catch { simd = typeof WebAssembly === "object" ? false : null; }
  const v = simd === null ? ["wasm_internal", "wasm_nosimd_internal"] : [simd ? "wasm_internal" : "wasm_nosimd_internal"];
  return v.flatMap((n) => [`${MP}/wasm/vision_${n}.js`, `${MP}/wasm/vision_${n}.wasm`]);
}

// Cache one URL unless some cache (e.g. the previous version's) already has a 2xx copy (not an opaque one, which a
// cors request could not use); only 2xx responses are stored.
async function precache(c, url) {
  const old = await caches.match(url);
  if (old?.ok) return c.put(url, old);
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " -> " + r.status);
  await c.put(url, r.clone());
  return r;
}

// Font CSS plus its Latin woff2 files (Google serves ~24 unicode-range subsets; the captions only need Latin).
async function precacheFonts(c) {
  const r = await precache(c, FONT_CSS);
  const css = await (r || (await c.match(FONT_CSS))).clone().text();
  const latin = css.split("@font-face").filter((b) => /unicode-range:\s*U\+0000-00FF/i.test(b));
  const urls = [...new Set(latin.flatMap((b) => [...b.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/["']/g, ""))))];
  return Promise.allSettled(urls.map((u) => precache(c, u)));
}

// Non-atomic: a CDN hiccup leaves those files to the runtime cache instead of failing the whole install.
async function precacheHeavy() {
  const c = await caches.open(V);
  const urls = [MP + "/vision_bundle.mjs", ...(await wasmVariants()), ...MODELS];
  return Promise.allSettled([...urls.map((u) => precache(c, u)), precacheFonts(c)]);
}

self.addEventListener("install", (e) => e.waitUntil(
  Promise.all([caches.open(V).then((c) => c.addAll(SHELL)), precacheHeavy()]).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));

function networkFirst(e) {
  const req = e.request;
  const cached = () => caches.match(req, { ignoreSearch: req.mode === "navigate" });   // "./?cpu" -> "./"
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const timer = setTimeout(() => cached().then((c) => c && finish(c)), NET_TIMEOUT_MS);
    fetch(req).then(async (r) => {
      clearTimeout(timer);
      if (r.ok) { const cl = r.clone(); e.waitUntil(caches.open(V).then((c) => c.put(req, cl))); return finish(r); }
      finish((await cached()) || r);       // a 404/500 (deploy gap) never replaces or hides the good copy
    }, async (err) => {
      clearTimeout(timer);
      const c = await cached();
      if (c) finish(c); else if (!done) { done = true; reject(err); }
    });
  });
}

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (HEAVY_HOSTS.has(u.host)) {              // versioned / immutable: cache first
    e.respondWith(caches.open(V).then(async (c) => (await c.match(e.request)) ||
      fetch(e.request).then((r) => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; })));
  } else if (u.origin === location.origin) {   // own files: network first so updates land, cache as fallback
    e.respondWith(networkFirst(e));
  }
});
