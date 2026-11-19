# Does "offline after the first visit" hold? Service-worker simulation

Date 2026-11-19. Track: (b) simulate. Code: `lab/offline-sw/sim.mjs` (`node lab/offline-sw/sim.mjs`, no deps).

## Question
README/charter promise the app works offline after the first visit (`sw.js`). Charter M2 (smoke test) will
check network hosts but not this. Does the shipped `sw.js` actually deliver it, and what does a first visit cost?

## Method
No browser is installed in the lab, so I ran the **unmodified `sw.js`** in a Node `vm` against a fake Cache API
and fetch, then replayed the app's real request list (from `app.js` / `index.html`; sizes by `curl` on 2026-11-19):
visit 1 → go offline → visit 2 → go offline. Modelling assumption, per the Service Worker spec: on the very first
visit the page is not controlled by the SW, so requests issued before `clients.claim()` bypass it. `app.js`
issues the MediaPipe bundle, wasm and both model fetches and preloads all meme images at module evaluation, in the
same tick it calls `serviceWorker.register`, so none of them can be intercepted. This is **not verified in a real
browser** (M2 would do that); treat it as a strong prediction.

## Results
- First-visit payload: **21.4 MB external** (wasm 9.4, hand model 7.8, face model 3.8, bundle 0.14, fonts ~0.05),
  plus 0.5 MB of own files. Models are served `cache-control: public, max-age=3600`; jsDelivr is `immutable`.
- After visit 1 the SW cache holds 25 entries: the shell and all 17 meme images (install `addAll`), and **0 external
  entries**. Going offline right then, 7/7 external requests fail: bundle (static import, so the app does not even
  start), wasm, both models, font CSS and font file. The page shell loads and then cannot start the camera.
- After a **second online visit** the cache holds 32 entries including wasm and models, and offline works (0 failures).
  So "offline after the first visit" is really "after the second visit".
- Own files are network-first with no timeout (`own_files_network_first_has_timeout: false`): on a stalled
  connection (lie-fi, tunnel) the cached copy is never used and the page hangs.
- A transient 404 for an own file (deploy gap) is cached: the own-origin branch has no `r.ok` check, so one 404 for
  `app.js` replaces the good copy and is served offline afterwards.
- `install` uses `addAll`, which is atomic: one missing shell entry (e.g. a renamed meme photo) rejects the whole SW
  install, silently (the registration `.catch(() => {})`) so the app just stops being offline-capable.
  (Existing follow-up "Test that sw.js SHELL lists every meme photo" covers the missing-file case.)

## Not covered / uncertain
- Real Safari behaviour. From my knowledge of WebKit (not re-checked today): Safari's ITP deletes script-writable
  storage, including Cache API, after 7 days without user interaction for sites not added to the Home Screen. Even
  a fixed SW would lose its 21 MB cache for non-installed use. Worth confirming on the owner's iPhone.
- Whether the HTTP cache makes visit 2 cheap: the models' `max-age=3600` suggests not after an hour.

## What the planner should do next
1. Make the SW cache the heavy files on install, not on first controlled use: add the bundle, wasm (simd and nosimd
   variants, 9.4 MB each) and two models to a *separate* non-atomic precache (`Promise.allSettled`, so a CDN hiccup
   does not fail install). Or call `navigator.serviceWorker.ready.then(...)` and re-fetch those URLs. Either takes
   about ten lines and is testable with this sim.
2. Fix the small SW bugs: only cache `r.ok` own responses, add a ~3 s network timeout before falling back to cache.
3. Add to M2 smoke test: load the page twice, then `context.setOffline(true)` and reload; assert models load. This is
   the only way to settle the Safari question beyond the sim.
4. Charter: reword the offline claim until fixed (and note the Safari 7-day cap).
