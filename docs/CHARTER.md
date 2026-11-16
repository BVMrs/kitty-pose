# kitty pose: charter (draft for the owner to edit and approve)

Draft 2026-11-12, from README, `memes.js`, `test/`, CI and the owner directives (no `specs/`, decision register or
ROADMAP exist yet). Anything the owner has not stated is marked `(proposed)`.

## 1. Objective

Strike a pose, get the cat meme: a phone web app that turns your face and hand pose into the matching cat meme.
Pose detection runs on the phone (MediaPipe in the browser), and nothing is uploaded.

## 2. Demo

- **App (exists):** `python3 -m http.server 8000`, then open http://localhost:8000. The public copy is at
  https://bvmrs.github.io/kitty-pose/. You will see the front camera with a cat under it. Making a pose from the README
  table switches the cat within about 0.2 s. The shutter makes a 4:5 meme and opens the share sheet.
- **Dataset run (proposed, not built yet):** `sh demo/fetch-hagrid.sh && node demo/eval-hagrid.js`.
  - **Dataset:** HaGRID, the HAnd Gesture Recognition Image Dataset (Kapitanov, Kvanchiani, Nagaev, Kraynov,
    Makhliarchuk, *WACV 2024*, arXiv:2206.08219, CC BY-SA 4.0). It is the standard open benchmark for this gesture
    set and comes with baselines from its authors.
  - **Download:** the annotation files only, which include MediaPipe hand landmarks for each image (verify first).
    No images are needed, and the checksum is pinned.
  - **What the script does:** it feeds the landmarks to `handFeatures()` from `memes.js` unchanged. It maps HaGRID
    classes to our gestures: `like`→thumbs up, `call`→shaka, `fist`→fist, `one`→point, `palm`/`stop`→open palm. It
    scores the other classes (e.g. `peace`, `ok`, `rock`, `no_gesture`) as "should trigger none".
  - **What you will see:** a confusion table and per-gesture precision and recall on the HaGRID test split, printed
    in under a minute on a laptop with no GPU.

## 3. Success criteria

1. `npm test` passes locally and in CI on every push. Today that is 10 tests.
2. On HaGRID test, recall for each of the 5 mapped gestures is ≥ 0.85, and the false-trigger rate on the
   other classes is ≤ 10 %, printed by `node demo/eval-hagrid.js` (proposed thresholds: set them once a baseline
   exists).
3. Mobile smoke run: headless Chromium at a 390×844 viewport, fed a recorded clip as a fake camera, loads both models,
   shows a meme and logs no console errors (proposed: `npm run smoke`).
4. Privacy: in that smoke run, every network request goes to the app origin, `cdn.jsdelivr.net` or
   `storage.googleapis.com`. Nothing is POSTed (proposed).
5. Owner's check on a 2024 iPhone in Safari with the front camera: every pose in the README table shows its meme.

## 4. Current milestone: M1 "Measured gestures" (proposed)

**Why first:** today the gesture logic is checked only against synthetic hands in `test/memes.test.js`. Thresholds
are tuned by eye in "show detection scores". A repeatable accuracy number on real hands makes every later threshold
change provable, without touching the app or the owner's photos.

Acceptance criteria:
1. `sh demo/fetch-hagrid.sh` downloads the HaGRID test annotations to a git-ignored folder and checks them against
   a pinned sha256. `git status --porcelain` shows no data files afterwards.
2. `node demo/eval-hagrid.js` exits 0. It prints, for the 5 mapped gestures, the sample count, precision and recall,
   plus the false-trigger rate on unmapped classes.
3. `node demo/eval-hagrid.js --check` exits non-zero if any number is below the thresholds the owner agrees in
   question 1.
4. `npm test` still passes, and `git diff --stat master -- assets/ app.js` is empty: measurement only, no app
   change.
5. `docs/DEMO.md` gives the commands from 2. and what the output means, and cites HaGRID.

Next milestones:
- **M2 "Phone smoke test" (proposed):** headless mobile-viewport fake-camera run (success criteria 3, 4) in CI.
- **M3 "Tune from data" (proposed):** adjust `fingerState`/`handFeatures` thresholds, using M1 numbers as the
  regression gate.

## 5. Non-goals

- Any server, account or upload. Video and photos stay on the device (directive).
- Replacing or regenerating the meme photos in `assets/` (directive).
- Training or fine-tuning our own models. We use stock MediaPipe Face and Hand Landmarker (proposed).
- Native iOS or Android apps. The app stays an installable PWA (proposed).
- Automatic merges or deploys. A merge to `master` publishes the site, and only the owner merges (directive).

## 6. Constraints

- **Language and stack:** plain ES-module JavaScript, HTML and CSS. No build step and no bundler (directive). Tests
  use `node --test` on Node 20 (CI). Dev-only scripts under `demo/` must not be loaded by the app.
- **Platform:** must work on a 2024 iPhone in Safari with the front camera. Check changes at a mobile viewport
  (directive). Other browsers are best effort (proposed).
- **Hosting:** GitHub Pages static site, offline after the first visit (`sw.js`). **Models:** MediaPipe
  tasks-vision 0.10.14 (jsDelivr) and float16 `.task` models (Google storage), run in the browser.
- **GPU policy:** inference only, on the phone's GPU through the browser. No cloud GPUs or training (proposed).
  **Budget:** $0 recurring, free hosting and CI only (proposed).
- **Data:** open datasets are fetched by script with a pinned checksum and never committed.

## 7. Open questions for the owner

1. **Accuracy bar for M1?** Recommendation: run the baseline first, then fix the bar at ≥ 0.85 recall per gesture
   and ≤ 10 % false triggers. Raise it in M3.
2. **Face expressions benchmark?** Open, permissively licensed expression datasets are scarce: FER-2013's terms are
   unclear, and AffectNet, CK+ and RAF-DB need a request. Recommendation: hands on HaGRID now. Leave faces to your
   iPhone check (success criterion 5) until you choose a dataset.
3. **Is M1 the right first milestone, ahead of the phone smoke test?** Recommendation: yes. It needs no browser
   automation and gives a number every later change can be held to.
