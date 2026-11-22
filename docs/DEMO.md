Status: partial — the app runs in the browser; the M1 HaGRID gesture eval and the M2 face-clip dump run (no `--check` thresholds yet; all 3 labelled clips pass); offline after one visit; the shared meme keeps what the live view shows (both checked in headless Chromium).

```sh
node demo/fetch-hagrid.mjs        # HaGRIDv2 test annotations (~105 MB) into ~/.cache/agent-data/kitty-pose/hagrid-v2
node demo/eval-hagrid.js          # handFeatures() on 201k real hands: recall, precision, false triggers (~12 s)
node demo/fetch-face-clips.mjs    # 3 CC BY face clips (~0.5 MB) into ~/.cache/agent-data/kitty-pose/face-clips
node demo/face-dump.mjs --clips demo/face-clips.json   # play them into the app as the camera, dump per-frame JSON (~5 min)
python3 -m http.server 8000       # then open http://localhost:8000 (camera needs localhost or HTTPS)
node demo/offline-check.mjs       # headless Chromium: one online visit, then reload with no network (~30 s)
node demo/snap-check.mjs          # headless Chromium: the snap keeps the live view's window, 3 frame sizes (~40 s)
```

## The app
Serve the folder, open it on a phone-sized viewport (or a 2024 iPhone over HTTPS), allow the camera, and make a pose:
the matching cat meme appears. Everything runs on the device (MediaPipe in the browser); nothing is uploaded.

## HaGRID data for the M1 gesture eval
`demo/fetch-hagrid.mjs` fetches the test split of the HaGRIDv2 annotations with MediaPipe hand landmarks
(Kapitanov et al., "HaGRID – HAnd Gesture Recognition Image Dataset", WACV 2024, https://github.com/hukenovs/hagrid;
CC BY-SA 4.0 variant). Only v2 has `hand_landmarks`.

- It reads the remote zip's central directory and downloads only `annotations/test/*.json` with HTTP Range requests
  (about 105 MB of the 719 MB zip), skipping `.ipynb_checkpoints/`, and checks each file's CRC-32.
- It writes `annotations/test/<class>.json` (34 classes) and `SHA256SUMS` to `$HAGRID_DIR`, default
  `~/.cache/agent-data/kitty-pose/hagrid-v2/`. Nothing goes into the repo.
- The sha256 of `SHA256SUMS` is pinned in the script. On a mismatch it prints expected vs got, writes nothing, and exits 1.
- When the cached files already match, it downloads nothing.

Measured 2026-11-22: 105,072,185 bytes fetched in 14.6 s, 34 files, 594 MB on disk; second run 1.3 s, no download.
Options: `--dest DIR`, `--url URL`, `--expect SHA256`, `--no-verify` (to compute a new pin).

## M1 gesture eval
`node demo/eval-hagrid.js [--dir DIR] [--json]` runs `handFeatures()` from `memes.js`, unchanged, on every HaGRIDv2
test hand that has 21 landmarks. The prediction is the first of thumbsUp, shaka, fist, pointing, openPalm that fires,
else none. Each of the 34 HaGRID classes is in exactly one group:

- **mapped** (charter): like→thumbsUp, call→shaka, fist→fist, one→pointing, palm and stop→openPalm. Recall and precision.
- **look-alike (ambiguous)**: dislike, xsign, grip, grabbing→fist; point, thumb_index, thumb_index2, take_picture,
  mute→pointing; stop_inverted, timeout, holy, hand_heart, hand_heart2→openPalm.
  A landmark rule cannot tell these from a mapped gesture, so firing on them is printed but **not** counted as a false trigger.
- **distinct (should fire none)**: four, little_finger, middle_finger, ok, peace, peace_inverted, rock, three, three2,
  three3, three_gun, two_up, two_up_inverted. Their trigger rate is the **false-trigger rate**.
- **Review of three_gun, little_finger, stop_inverted (#32)**: the lab note only reaches its 5.5 % with all three as
  look-alikes. three_gun (0.6 % fire) and little_finger (10.5 %) are moved to distinct: no mapped gesture is
  meant to fire on them, and hiding them would mask a regression (e.g. a loose shaka thumb test firing on a raised
  pinky). stop_inverted (4.9 %) stays a look-alike: it is "stop" turned over and openPalm fires on it legitimately.
- **no_gesture**: its own line. It is what the app sees between poses, but the test split has only 607 such hands.

Measured 2026-11-22 (24,772 hands skipped for lack of landmarks; 11.7 s):

| gesture | class | n | recall | precision |
|---|---|---|---|---|
| thumbsUp | like | 4940 | 0.849 | 0.838 |
| shaka | call | 4936 | 0.537 | 0.640 |
| fist | fist | 4877 | 0.945 | 0.196 |
| pointing | one | 4943 | 0.989 | 0.154 |
| openPalm | palm+stop | 9970 | 0.503 | 0.235 |

False triggers (re-measured 2026-11-22 after the split change): distinct gestures 5.1 % (3,251 of 64,290),
no_gesture 56.8 % (345 of 607), both together 5.5 % (3,596 of 64,897), and every unmapped class including
look-alikes 43.3 % (63,349 of 146,205). The lab note's 5.5 % (3,047 of 55,011) used the old split without the two
moved classes; the per-class counts are otherwise the same as `lab/2026-11-18-hagrid-baseline.md` on `agents/lab`. Precision counts fires on all other classes,
look-alikes included, so it is low for fist and pointing.

## M2 face regression: dump a clip, replay it in `npm test`
No open, licence-clean dataset covers our face poses, and only video covers head turn and tilt, so the face check
uses clips: openly licensed ones now, and the owner's own clips (one per face pose in the README table) when recorded.

`node demo/face-dump.mjs CLIP` plays a clip into the real app as the front camera and writes what the app saw to JSON:

- It converts the clip with ffmpeg to Y4M (640 px wide, 30 fps), holds the first frame for `--lead` s (default 2) and
  the last for `--tail` s (default 2), and stamps a frame-index barcode on the bottom 8 px rows.
- Headless Chromium plays it as a fake camera into `index.html?cpu`, served from the repo on 127.0.0.1, at 390×844
  with a mobile device scale. It clicks "Start the camera" once the models are downloaded.
- `app.js` calls `globalThis.kittyTrace` (if set) after each detection. The script sets it and records, per frame, the
  clip time from the barcode, the 52 blendshape scores, the 7 face landmarks `memes.js` reads, both hands' landmarks,
  and the meme the app showed.
- The output is `$KITTY_FACE_DUMPS/<name>.dump.json` (default `~/.cache/agent-data/kitty-pose/face-dumps/`). It also
  lists the hosts the page contacted, any POSTs and any console errors.
- Labels come from `CLIP` minus its extension plus `.labels.json`:
  `{"segments": [{"from": 1.0, "to": 3.0, "meme": "pop"}]}`, in clip seconds. `meme` can be a list of acceptable ids.

`npm test` (`test/face-regression.test.js`) replays every dump through `faceFeatures()`, `handFeatures()` and the app's
chooser (`createChooser()` in `memes.js`), at 30 fps clip time. For each labelled segment, the expected meme must be
shown on ≥ 60 % of the frames from `from + 0.4 s` to `to`. A segment with `"todo"` is reported, not failed.

- Dumps of the CC BY clips are committed in `test/fixtures/face/` (gzipped, ~20 KB each).
- Dumps in the cache folder (for example of the owner's own clips) are tested too, but only on that machine.
- No video is committed.

The committed clips are 3 stimuli from Hadjikhani et al., "Look me in the eyes: constraining gaze in the eye-region
provokes abnormally high subcortical activation in autism", *Scientific Reports* 7, 3163 (2017),
doi:10.1038/s41598-017-03378-5, CC BY 4.0, via Wikimedia Commons. Each is a 5 s morph of one face from neutral to
anger, fear or happiness. `demo/face-clips.json` pins their sha256 and holds the labels.

Measured 2026-11-22 (Chromium 149 headless, 3 CPU cores, ~100 s per clip):

| clip | frames detected | replay = app | neutral → stare | end of morph |
|---|---|---|---|---|
| anger (brows down, no teeth) | 217 of 250 | 217/217 | 100 % of 41 | stare 100 % of 24 (want stare) |
| fear (eyes wide, brows up) | 280 of 282 | 280/280 | 100 % of 49 | close-stare 100 % of 49 (want shocked or close-stare) |
| happy (closed-mouth smile) | 230 of 280 | 230/230 | 100 % of 39 | smile 100 % of 46 (want smile or smug) |

No console errors and no POSTs. The only hosts contacted were 127.0.0.1, cdn.jsdelivr.net, storage.googleapis.com,
fonts.googleapis.com and fonts.gstatic.com.
Fear: MediaPipe scores `eyeWide` only 0.05 on this face but `browInnerUp` 0.45 and outer brows ~0.1, which used to
show `crying` (issue #34). `memes.js` now reads inner + outer brows up without a frown as wide eyes (fear/surprise,
FACS AU1+2) for shocked and close-stare, and crying needs a frown or inner brows up *without* raised outer brows or
wide eyes (sadness, AU1+4+15). The fear row was re-measured 2026-11-22 after that change; the app shows close-stare
from 2.9 s (1 m 40 s with `nix-shell -p ffmpeg-headless chromium`). The committed fixture is the earlier run
(249 frames); its replay also shows close-stare on 100 % of the 38 end-of-morph frames.

Your own clip: record each pose from the README table for a few seconds (front camera, face filling about half the
frame), write `NAME.labels.json`, then run `node demo/face-dump.mjs NAME.mov` and `npm test`.

## Offline after one visit
`sw.js` precaches, at install, the shell and meme photos (atomic) and, non-atomically (`Promise.allSettled`, so a CDN
hiccup does not fail the install), the MediaPipe bundle, the wasm variant this browser will load (the SIMD probe is
the bundle's own; both variants if WebAssembly is missing), both `.task` models and the Latin subset of the fonts.
`app.js` registers the worker once the models have loaded, so the precache reads them from the HTTP cache instead of
downloading 21 MB a second time. Own files are network-first with a 3 s timeout, and only 2xx responses are cached.

`node demo/offline-check.mjs` opens the app once online in headless Chromium (390x844 mobile viewport, `?cpu`),
waits for the worker to activate, restarts with the local server stopped and all DNS failing, reloads, starts the
fake camera and waits for detections. Measured 2026-11-22 (Chromium 149):

- visit 1: worker active after 4.6 s, cache `kitty-v4` holds 33 entries, 8 external (bundle, SIMD wasm .js + .wasm,
  both models, font CSS, 2 woff2). The worker's fetches of the jsDelivr files had `transferSize` 0 (HTTP cache).
- visit 2, offline: 6 frames detected after 5.9 s; 34 of 34 responses from the service worker, 0 from the network.
- The same check on the previous `sw.js`: 0 external entries cached, no detection offline within 60 s.

Not checked here: Safari. WebKit may drop the Cache API data of a site that is not on the Home Screen after 7 days
without a visit; add the app to the Home Screen to keep it offline-capable.

## The shared meme keeps what the live view shows
`snap()` crops the camera frame with the aspect of the live `.cam` box (`crop.js`: `snapCamera`, the centred
`object-fit: cover` window), so a raised hand that is on screen is in the meme. The image is 1080 wide; the camera
part is as tall as that aspect gives (clamped to 0.75–2 width/height) and the cat part below stays 1080x675.

`node demo/snap-check.mjs [--save DIR]` plays a synthetic frame whose luma and U chroma ramp with the frame row and
column as the fake front camera (390x844 viewport, `?cpu`), reads which frame window the screenshot of `.cam` shows
and which the snap JPEG holds, and fails if an edge differs by more than 3 % of the frame side. Measured 2026-11-22
(Chromium 149, `.cam` 390x374; absolute edges are good to about ±3 %, live and snap are read the same way):

| frame | live view keeps | snap keeps (before → now) | snap size (before → now) |
|---|---|---|---|
| portrait 720x1280 | 54.3 % | 35.0 % → 54.1 % | 1080x1350 → 1080x1711 |
| landscape 1280x720 | 60.6 % | 89.6 % → 60.2 % | 1080x1350 → 1080x1711 |
| 4:3 640x480 | 78.5 % | 84.5 % → 77.6 % | 1080x1350 → 1080x1711 |

Not checked here: which frame size iOS Safari delivers when the phone is upright (assumed portrait; the check rotates
the 1280x720 `ideal` for portrait feeds the way iOS does).
