// Offline after the first visit: app shell + MediaPipe runtime + models, cache-first.
const V = "kitty-v2";
const SHELL = ["./", "index.html", "style.css", "app.js", "memes.js", "cats.js", "manifest.webmanifest", "icon.svg",
  ...["pop.jpg", "shocked.jpg", "close-stare.jpg", "hiss.jpg", "crying.jpg", "smile.jpg", "smug.jpg", "side-eye.jpg", "lookaway.jpg",
      "think.jpg", "laugh-point.gif", "point.jpg", "fistbump.jpg", "angry-fist.jpg", "shaka.jpg", "wizard.jpg", "stare.jpg"].map((f) => "assets/" + f)];
self.addEventListener("install", (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const heavy = /storage\.googleapis\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(u.host);
  if (heavy) {               // versioned / immutable: cache first
    e.respondWith(caches.open(V).then(async (c) => (await c.match(e.request)) ||
      fetch(e.request).then((r) => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; })));
  } else if (u.origin === location.origin) {   // own files: network first so updates land, cache as fallback
    e.respondWith(fetch(e.request).then((r) => { const cl = r.clone(); caches.open(V).then((c) => c.put(e.request, cl)); return r; })
      .catch(() => caches.match(e.request)));
  }
});
