# Privacy surface: which origins can the app contact? (charter success criterion 4)

## Question
Criterion 4 says every network request goes to the app origin, `cdn.jsdelivr.net` or `storage.googleapis.com`, and
nothing is POSTed. Does the shipped code meet that, and what would the M2 smoke test have to assert?

## Method
`lab/privacy-origins/audit.mjs` statically extracts every `http(s)://` host from index.html, app.js, memes.js, cats.js,
style.css, sw.js and the manifest, and compares it with the allowlist. It also probes the service worker's host regex.
No browser was available in this sandbox (no chromium or playwright), so this is static and nothing was observed at
runtime. Output: `lab/privacy-origins/output.txt`.

## Results
- 2 of 4 contacted third-party hosts are outside the charter allowlist: `fonts.googleapis.com` (CSS) and
  `fonts.gstatic.com` (the font files), both from the `<link>` tags in index.html lines 16-18. They load on every page
  view, so the visitor's IP, user agent and the `github.io` Referer reach Google. Camera data does not.
- The app code itself is fine: the only `fetch()` in app.js is the model download (GET). There is no POST,
  `sendBeacon`, XHR or WebSocket. Storage is localStorage settings plus IndexedDB for custom meme photos.
- An M2 smoke test written to criterion 4 as it stands would fail on its first run because of the font hosts. Either
  the criterion or the app has to change (open issue already exists: "Charter privacy criterion: include Google Fonts
  hosts or self-host fonts"). Self-hosting is preferable: two woff2 files, cached with the shell by the SW, and
  first-visit offline no longer depends on an opaque cross-origin response.
- There is no `<meta name="referrer">` and no CSP. A CSP with `connect-src 'self'` plus the two allowed hosts would turn
  criterion 4 from a test into a browser-enforced property (MediaPipe wasm needs `'wasm-unsafe-eval'` in script-src;
  to be tried in a real browser).
- `sw.js` tests `u.host` with an unanchored regex: `storage.googleapis.com.evil.example` matches (see output.txt), so
  such a host would be treated as "heavy" and cached opaque. Low risk, since only the app's own code makes requests,
  but trivial to anchor with an exact set.
- Not verified: `visibilitychange` sets `track.enabled = false` rather than stopping the track. Whether iOS Safari
  turns the camera indicator off in that state is a device question for the owner's iPhone check.

## What the planner should do next
1. Self-host Anton and Inter (fixes the criterion mismatch, privacy and offline together) and keep criterion 4 as
   written. Otherwise add the two font hosts to the allowlist and say why.
2. Add a no-referrer meta and a CSP meta, verified in the M2 headless run.
3. Anchor the SW host test with an exact set.
4. In M2, record every request (`page.on('request')`) and assert the host set and that no method is non-GET.
