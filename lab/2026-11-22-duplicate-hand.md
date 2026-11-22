# Duplicate hand detection: one open palm becomes "wizard"

## Question
`app.js` asks MediaPipe for `numHands: 2`. If the landmarker ever reports one physical hand twice, does `handFeatures()`
/ `MEMES` change the shown meme? (`twoPalms` counts hands, nothing de-duplicates them.)

## Method
`lab/duplicate-hand/sim.mjs`: synthetic hands (copied from `test/memes.test.js`) for palm, fist, thumbs-up, point, shaka.
Score all `MEMES` with a neutral face (missing face features = 0), take the argmax. Compare one hand against
[hand, copy of hand + uniform jitter of 0 / 0.5 / 2 % of the frame], 200 draws each. Output: `lab/duplicate-hand/output.txt`.

## Results
- Single open palm → `stop`. The same palm reported twice → `wizard` 100 % (exact copy), 89 % at 0.5 % jitter, ~43–50 % at 2 %.
- Thumbs-up reported twice with jitter flips to `fistbump` in 11–14 % of draws at 0.5 % jitter and ~50 % at 2 %: the jittered copy
  loses the thumb test and `fist`/`thumbsUp` get mixed.
- Fist, point and shaka are unaffected (flags are OR-ed, no counting).
- Not tested: `handsUp` (needs a face with landmarks 10/152; the sim passes `face = null`), so the same exposure for
  "yippee" is by reading the code (`up >= 2`) only.

## Caveats
Whether MediaPipe HandLandmarker really emits near-duplicate hands for one hand is **not measured here** (no camera or models
in this sandbox). Its tracker normally suppresses overlapping detections, but only a recorded-clip run can say how often.
This shows the exposure, not a rate.

## What the planner should do next
- Cheap hardening: in `handFeatures`, drop a hand whose wrist is within ~0.3 × hand size of an earlier hand's wrist before
  counting `twoPalms` / `handsUp`. Add a unit test with a duplicated palm → `stop`, not `wizard`.
- Measure: during the M2 smoke clip with one visible hand, log how many frames have `hands.length === 2`.
