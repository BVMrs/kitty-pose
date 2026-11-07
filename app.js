import { FaceLandmarker, HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { MEMES, handFeatures } from "./memes.js";
import { catSVG, PALETTES } from "./cats.js";

const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODELS = {
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  hand: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
};
const HAND_LINKS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

const $ = (s) => document.querySelector(s);
const video = $("#video"), overlay = $("#overlay"), octx = overlay.getContext("2d");
const catBox = $("#cat"), caption = $("#caption"), hint = $("#hint"), status = $("#status"), scoresEl = $("#scores");

const store = {
  get(k, d) { try { const v = localStorage.getItem("meow:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("meow:" + k, JSON.stringify(v)); } catch {} },
};

let face, hand, stream, facing = "user", running = false;
let palette = store.get("palette", "ginger"), showScores = store.get("scores", false);
let current = "stare", pending = null, pendingSince = 0, lastFeatures = null;
const ema = Object.fromEntries(MEMES.map((m) => [m.id, 0]));
const custom = {};                                      // meme id -> object URL of the owner's own picture

// ---------- own pictures (IndexedDB, never leave the phone) ----------
const db = new Promise((res) => {
  try {
    const r = indexedDB.open("meow-mirror", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("pics");
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  } catch { res(null); }
});
async function picsLoad() {
  const d = await db; if (!d) return;
  const tx = d.transaction("pics"); const st = tx.objectStore("pics");
  const keys = await new Promise((r) => { const q = st.getAllKeys(); q.onsuccess = () => r(q.result); q.onerror = () => r([]); });
  for (const k of keys) {
    const blob = await new Promise((r) => { const q = st.get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); });
    if (blob) custom[k] = URL.createObjectURL(blob);
  }
}
async function picSet(id, blob) {
  const d = await db; if (!d) return;
  const tx = d.transaction("pics", "readwrite");
  blob ? tx.objectStore("pics").put(blob, id) : tx.objectStore("pics").delete(id);
  if (custom[id]) URL.revokeObjectURL(custom[id]);
  if (blob) custom[id] = URL.createObjectURL(blob); else delete custom[id];
}

// ---------- rendering ----------
function render(id, pop = true) {
  const m = MEMES.find((x) => x.id === id);
  catBox.innerHTML = custom[id] ? `<img src="${custom[id]}" alt="${m.caption}">` : catSVG(m.cat, palette);
  caption.textContent = m.caption;
  hint.textContent = m.id === "stare" ? "try: " + MEMES[Math.floor(Date.now() / 4000) % (MEMES.length - 1)].hint : m.hint;
  if (pop) { catBox.classList.remove("pop"); void catBox.offsetWidth; catBox.classList.add("pop"); }
  if (navigator.vibrate && pop) navigator.vibrate(12);
}

function renderScores() {
  scoresEl.hidden = !showScores;
  if (!showScores) return;
  scoresEl.innerHTML = MEMES.map((m) => `<div class="row${m.id === current ? " on" : ""}"><span>${m.id}</span>
    <i style="width:${Math.round(ema[m.id] * 100)}%"></i><b>${ema[m.id].toFixed(2)}</b></div>`).join("");
}

// ---------- features ----------
function features(fr, hr) {
  const bs = Object.fromEntries((fr.faceBlendshapes?.[0]?.categories || []).map((c) => [c.categoryName, c.score]));
  const lm = fr.faceLandmarks?.[0];
  const g = (k) => bs[k] || 0;
  let roll = 0;
  if (lm) roll = (Math.atan2(lm[263].y - lm[33].y, lm[263].x - lm[33].x) * 180) / Math.PI;
  return {
    face: !!lm,
    jawOpen: g("jawOpen"),
    eyeWide: (g("eyeWideLeft") + g("eyeWideRight")) / 2,
    blink: Math.min(g("eyeBlinkLeft"), g("eyeBlinkRight")),
    squint: (g("eyeSquintLeft") + g("eyeSquintRight")) / 2,
    smile: Math.max(g("mouthSmileLeft"), g("mouthSmileRight")),
    frown: (g("mouthFrownLeft") + g("mouthFrownRight")) / 2,
    browInnerUp: g("browInnerUp"),
    browUp: Math.max(g("browOuterUpLeft"), g("browOuterUpRight"), g("browInnerUp")),
    roll,
    ...handFeatures(hr.landmarks || [], lm),
  };
}

function choose(f, now) {
  for (const m of MEMES) ema[m.id] = ema[m.id] * 0.6 + m.score(f) * 0.4;
  let best = "stare";
  for (const m of MEMES) if (ema[m.id] > ema[best]) best = m.id;
  if (ema[best] < 0.35 && best !== "stare") best = "stare";
  if (best === current) { pending = null; return; }
  if (best !== "stare" && ema[best] < ema[current] + 0.08) return;
  if (pending !== best) { pending = best; pendingSince = now; return; }
  if (now - pendingSince > (best === "stare" ? 600 : 220)) { current = best; pending = null; render(current); }
}

function drawOverlay(fr, hr) {
  const w = overlay.width = video.videoWidth, h = overlay.height = video.videoHeight;
  octx.clearRect(0, 0, w, h);
  octx.lineWidth = Math.max(2, w / 300);
  octx.strokeStyle = "rgba(255,216,74,.9)"; octx.fillStyle = "rgba(255,216,74,.95)";
  for (const lms of hr.landmarks || []) {
    octx.beginPath();
    for (const [a, b] of HAND_LINKS) { octx.moveTo(lms[a].x * w, lms[a].y * h); octx.lineTo(lms[b].x * w, lms[b].y * h); }
    octx.stroke();
  }
  const lm = fr.faceLandmarks?.[0];
  if (lm) {
    octx.fillStyle = "rgba(124,199,255,.85)";
    for (let i = 0; i < lm.length; i += 7) { octx.beginPath(); octx.arc(lm[i].x * w, lm[i].y * h, w / 400, 0, 7); octx.fill(); }
  }
}

// ---------- loop ----------
let frames = 0, fpsT = performance.now(), lastTs = -1;
function loop() {
  if (!running) return;
  const now = performance.now();
  if (video.readyState >= 2 && now !== lastTs) {
    lastTs = now;
    const fr = face.detectForVideo(video, now);
    const hr = hand.detectForVideo(video, now);
    lastFeatures = features(fr, hr);
    choose(lastFeatures, now);
    drawOverlay(fr, hr);
    renderScores();
    frames++;
    if (now - fpsT > 1000) { status.textContent = `${Math.round((frames * 1000) / (now - fpsT))} fps`; frames = 0; fpsT = now; }
  }
  if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(loop); else requestAnimationFrame(loop);
}

async function makeModels() {
  status.textContent = "loading models (one-time, ~12 MB)…";
  const fs = await FilesetResolver.forVisionTasks(MP);
  const opts = (path, delegate) => ({ baseOptions: { modelAssetPath: path, delegate }, runningMode: "VIDEO" });
  for (const delegate of ["GPU", "CPU"]) {
    try {
      face = await FaceLandmarker.createFromOptions(fs, { ...opts(MODELS.face, delegate), numFaces: 1, outputFaceBlendshapes: true });
      hand = await HandLandmarker.createFromOptions(fs, { ...opts(MODELS.hand, delegate), numHands: 2 });
      return delegate;
    } catch (e) { console.warn("delegate", delegate, e); }
  }
  throw new Error("could not load the models");
}

async function startCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } });
  video.srcObject = stream;
  await video.play();
  document.body.classList.toggle("mirror", facing === "user");
}

async function start() {
  $("#start").disabled = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("this browser has no camera access (open the page in Safari or Chrome, over https)");
    const [, delegate] = await Promise.all([startCamera(), face ? Promise.resolve("ready") : makeModels()]);
    $("#intro").hidden = true;
    status.textContent = delegate === "CPU" ? "running on CPU (slower)" : "";
    running = true; render(current, false); loop();
    try { await navigator.wakeLock?.request("screen"); } catch {}
  } catch (e) {
    status.textContent = "⚠️ " + (e.message || e);
    $("#start").disabled = false;
  }
}

// ---------- snap: you + the cat + the caption, as one image ----------
async function snap() {
  if (!running) return;
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#111"; x.fillRect(0, 0, W, H);
  const vw = video.videoWidth, vh = video.videoHeight, top = H / 2;
  const s = Math.max(W / vw, top / vh), sw = W / s, sh = top / s;
  x.save();
  if (facing === "user") { x.translate(W, 0); x.scale(-1, 1); }
  x.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, W, top);
  x.restore();
  const m = MEMES.find((mm) => mm.id === current);
  x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || "#fff3e0";
  x.fillRect(0, top, W, H - top);
  const img = new Image();
  img.src = custom[current] || "data:image/svg+xml;charset=utf-8," + encodeURIComponent(catSVG(m.cat, palette));
  await img.decode().catch(() => {});
  const ih = H - top - 40, iw = custom[current] ? Math.min(W - 40, (img.naturalWidth / img.naturalHeight) * ih) : ih;
  x.drawImage(img, (W - iw) / 2, top + 20, iw, ih);
  x.font = "120px Anton, Impact, 'Arial Black', sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.lineWidth = 14; x.strokeStyle = "#000"; x.fillStyle = "#fff"; x.lineJoin = "round";
  x.strokeText(m.caption.toUpperCase(), W / 2, top, W - 60); x.fillText(m.caption.toUpperCase(), W / 2, top, W - 60);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
  const file = new File([blob], `meow-${m.id}.jpg`, { type: "image/jpeg" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: m.caption }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- settings ----------
function buildSettings() {
  $("#palettes").innerHTML = Object.entries(PALETTES).map(([k, p]) =>
    `<button class="sw${k === palette ? " on" : ""}" data-p="${k}" style="background:${p.fur}" aria-label="${k} cat"></button>`).join("");
  $("#pics").innerHTML = MEMES.map((m) => `<div class="pic">
      <div class="thumb">${custom[m.id] ? `<img src="${custom[m.id]}" alt="">` : catSVG(m.cat, palette)}</div>
      <div class="meta"><b>${m.caption}</b><small>${m.hint}</small></div>
      <label class="btn sm">pick<input type="file" accept="image/*" data-id="${m.id}" hidden></label>
      ${custom[m.id] ? `<button class="btn sm ghost" data-reset="${m.id}">reset</button>` : ""}
    </div>`).join("");
  $("#scoresToggle").checked = showScores;
}
$("#palettes").addEventListener("click", (e) => {
  const p = e.target.dataset.p; if (!p) return;
  palette = p; store.set("palette", p); buildSettings(); render(current, false);
});
$("#pics").addEventListener("change", async (e) => {
  const id = e.target.dataset.id, f = e.target.files?.[0]; if (!id || !f) return;
  await picSet(id, f); buildSettings(); if (id === current) render(current, false);
});
$("#pics").addEventListener("click", async (e) => {
  const id = e.target.dataset.reset; if (!id) return;
  await picSet(id, null); buildSettings(); if (id === current) render(current, false);
});
$("#scoresToggle").addEventListener("change", (e) => { showScores = e.target.checked; store.set("scores", showScores); renderScores(); });
$("#settingsBtn").addEventListener("click", () => { buildSettings(); $("#settings").showModal(); });
$("#closeSettings").addEventListener("click", () => $("#settings").close());
$("#start").addEventListener("click", start);
$("#snap").addEventListener("click", snap);
$("#flip").addEventListener("click", async () => { facing = facing === "user" ? "environment" : "user"; if (running) await startCamera(); });
catBox.addEventListener("click", () => {
  const ks = Object.keys(PALETTES); palette = ks[(ks.indexOf(palette) + 1) % ks.length]; store.set("palette", palette); render(current, false);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { running = false; stream?.getTracks().forEach((t) => (t.enabled = false)); }
  else if (stream) { stream.getTracks().forEach((t) => (t.enabled = true)); if (face && !running) { running = true; loop(); } }
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
picsLoad().then(() => render(current, false));
