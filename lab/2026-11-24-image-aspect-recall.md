# What aspect are HaGRID images really, and what does the aspect fix do to recall?

## Question
[portrait-recall](2026-11-24-portrait-recall.md) could not recover the source image aspect A0 and showed thumbsUp .46 (A0 4:3) or .22 (16:9) once aspect was corrected, which suggested the fix would *lower* benchmark recall. Measure A0 and redo it.

## Method
`lab/image-aspect2/sizes.py` (an HTTP Range read of the JPEG headers inside the per-class HaGRID zips, EXIF-orientation aware, about 150 KB of JSON for 1,800 images) sampled 300 random test images for each of like, call, fist, one, palm and stop. `lab/image-aspect-recall/run.mjs` joins them to the test landmarks (1,775 hands). Each hand is made isotropic with its own true A0, `(x*A0, y)`, then projected to a frame of aspect A. `handFeatures` is scored as the app calls it (no aspect) and with `aspect = A`. Thresholds are master's. Output is in `output.txt`.

## Results
Source images are mostly **portrait 3:4**: 72% are 0.7-0.8 (typically 1440x1920), 13% are 4:3, 7% are 16:9 or wider, 7% are below 0.7 (for example 1080x1920) and 2.5% are square. HaGRID is not a landscape dataset, so both of portrait-recall's assumed A0s were wrong.

| scoring | thumbsUp | shaka | fist | pointing | openPalm |
|---|---|---|---|---|---|
| raw normalised, no aspect (the M1 eval; sample reproduces .85/.54/.50 within noise) | .838 | .567 | .930 | .986 | .512 |
| **true isotropic hand, aspect passed** (same at any frame shape) | **.980** | .638 | .937 | .983 | .487 |
| 9:16 phone, today's app (no aspect) | **.330** | .369 | .892 | .976 | .657 |
| 3:4 phone, no aspect | .848 | .500 | .920 | .983 | .550 |

- Passing the aspect, which `handFeatures` already supports, takes thumbsUp from .33 to .98 on a 9:16 phone frame, with **no threshold change**. Shaka goes from .37 to .64.
- It also makes recall independent of frame shape (identical rows for 9:16, 3:4 and 4:3). Today the app's accuracy depends on how the phone is held.
- The earlier "aspect fix lowers recall" worry is withdrawn. It came from assuming a landscape source. For the real, mostly portrait, data the raw M1 number was already depressed by the squeeze.
- Open palm does not improve (.49) and shaka only reaches .64. They still need the threshold sweep, now in isotropic coordinates. Open palm is *better* uncorrected on a phone (.66) only because the squeeze happens to loosen its thumb test.
- Landscape-source hands differ from portrait-source hands in the raw eval (shaka .75 vs .52, palm .29 vs .57), so the raw M1 recall mixes two coordinate regimes. The corrected rows are the same across both (shaka .62/.64, palm .50/.49).

## What the planner should do next
1. Pass `aspect = videoWidth/videoHeight` to `handFeatures` in `app.js`. This is the highest-value gesture fix found so far: thumbsUp .33→.98 on a portrait phone, with no tuning. Add a test with a 9:16 thumbs-up.
2. Change `demo/eval-hagrid.js` to read true image sizes (fetch the JPEG headers once, cache the A0 per id, as `image-aspect2/sizes.py` does) and score isotropic landmarks with aspect passed. Then restate the charter's criterion 2 numbers, since .85/.54/.50 are not what a phone would see.
3. Redo [threshold-sweep](2026-11-18-threshold-sweep.md) and [user-split](2026-11-24-user-split.md) in isotropic coordinates. The shaka and open-palm thresholds (`t2>0.3`, the looser thumb test) were tuned in squeezed space and are not safe to ship before that. The thumbsUp height rule needs rechecking too, since it already scores .98.
4. The same unaccounted aspect affects `faceFeatures` roll ([face-roll-aspect](2026-11-22-face-roll-aspect.md)). Fix both in one change.

## Limits
Sample is 300 images per class (95% CI about ±5 pts on shaka and palm, ±1.5 on thumbsUp). `hand_landmarks` are assumed normalised to the EXIF-oriented image, and orientation was 1 for the images seen, so this is unverified for the rest. Only the six mapped classes were sampled; no false-trigger rates here. An A0 of 0.75 is the *source* shape, and a phone user holds hands differently. No browser run, `app.js` untouched.
