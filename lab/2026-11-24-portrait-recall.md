# What is HaGRID recall in the frame shape the app actually runs in?

## Question
The M1/M3 numbers (thumbsUp .85, shaka .54, ...) come from HaGRID landmarks in image-normalised coordinates, fed to `handFeatures(hands, face)` with no aspect.
[hand-invariance](2026-11-18-hand-invariance.md) showed on synthetic hands that this breaks in portrait, and said the HaGRID numbers hold only in the "landscape-ish regime".
`app.js` still passes no aspect (only a comment mentions it). How big is that on real hands, and is the 0.85 bar even meaningful?

## Method
`lab/portrait-recall/run.mjs` (output in `output.txt`): all 175,871 HaGRID test hands, ground-truth class mapping as in `eval.mjs`.
HaGRID gives no image size, so the source aspect A0 is an assumption (4:3 or 16:9). A hand with normalised `(x, y)` has isotropic shape `(x*A0, y)`; shown in a phone frame of aspect A it becomes `x' = x*A0/A`.
Score with `handFeatures` as the app calls it (no aspect) and with `aspect = A`. Frames: 9:16, 3:4, 1:1, 4:3, 16:9. Thresholds as on master (no sweep patch).
`aspect-est.mjs` tries to recover A0 from bone lengths.

## Results (A0 = 4:3; A0 = 16:9 in brackets)
| frame A | mode | thumbsUp | shaka | fist | pointing | openPalm |
|---|---|---|---|---|---|---|
| 4:3 (= raw HaGRID baseline if A0 = 4:3) | app, no aspect | .849 | .537 | .945 | .989 | .503 |
| 9:16 portrait phone | app, no aspect | **.100** (.027) | **.242** (.200) | .951 | .961 | .681 |
| 3:4 | app, no aspect | .222 (.100) | .311 | .940 | .978 | .680 |
| any | aspect-corrected | **.464** (.222) | .411 (.311) | .936 | .986 | .610 (.680) |

1. **Real hands confirm the synthetic finding.** In a 9:16 frame, uncorrected, thumbs-up recall is 10% (3% if source was 16:9) and shaka 24%. Fist and pointing are unaffected (.95/.96).
2. **The raw baseline reproduces exactly (.849, .537, .503 at A = A0 = 4:3).** So the M1 numbers are what the code does on hands squeezed horizontally by A0. The app's own use is a different regime.
3. **The aspect-corrected result is lower, not higher.** With true (isotropic) hand shapes the *current thresholds* give thumbsUp .46 (A0 4:3) or .22 (16:9) and shaka .41/.31. The 0.85 pass mark was reached partly because normalised landmarks are narrower than real hands, which happens to suit the thumb test and the `size*0.35` thumb-height rule. A correct aspect fix alone would lower recall on the benchmark and need re-tuning of the thumb thresholds.
4. **A0 cannot be recovered from the annotations.** Bone-length ratio gives A0 ≈ 0.77–0.84 (`aspect-est.txt`), impossible for landscape images, so it is confounded (sideways hands are nearer the camera / foreshortened differently). Treat as unresolved; the table is parametric in A0, and A0 changes thumbsUp from .46 to .22.
5. Fist and pointing are robust to everything (.94–.99); the whole problem is the thumb.

## What the planner should do next
- Do not treat "thumbsUp .85 / shaka .54" as phone accuracy: on a portrait phone with today's code it is about .1 / .24 under these assumptions. The charter criterion 2 needs a stated frame aspect, and criterion 5 (iPhone check) should be expected to fail for thumbs-up and shaka until aspect is passed.
- Order matters: (1) learn A0 (read JPEG headers of a few hundred HaGRID images; the Range-zip helper in `lab/hagrid-annotations/rangezip.py` can fetch just headers) so the eval can pass true aspect per image; (2) add the `aspect` argument in `app.js` (videoWidth/videoHeight) — `handFeatures` already supports it; (3) only then redo the [threshold-sweep](2026-11-18-threshold-sweep.md) in isotropic coordinates. The sweep's chosen thresholds (`t2>0.3`, height 0.25) were tuned in the squeezed space and are not safe to ship before step 3.
- Same caveat applies to [user-split](2026-11-24-user-split.md): its margins are valid in the normalised-coordinate regime only.

## Limits
Re-projection assumes one A0 for all images (HaGRID mixes sizes) and ignores that a real portrait user holds the hand differently. Landmarks are MediaPipe auto-annotations. No browser or phone run; `app.js` not changed.
