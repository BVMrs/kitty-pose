# HaGRID baseline for M1: what the annotations really contain, and how `handFeatures()` scores on them

## Question
CHARTER M1 proposes `demo/eval-hagrid.js`, which feeds HaGRID annotation landmarks to `handFeatures()`. It says
"verify first" that the landmarks exist and that the download is small. Is that true, and what are the first
real numbers?

## Method
- Read the HaGRID README (https://github.com/hukenovs/hagrid) and sent HEAD and Range requests to the annotation zip.
- `lab/hagrid-annotations/rangezip.py`: opens the remote zip with HTTP Range requests and extracts only the `test/` JSONs.
- `lab/hagrid-annotations/eval.mjs`: runs `handFeatures([hand], null)` unchanged on each test hand that has 21 landmarks.
  The prediction is the first of thumbsUp, shaka, fist, pointing, openPalm that fires, else "none".
- Charter mapping: like→thumbsUp, call→shaka, fist→fist, one→pointing, palm and stop→openPalm.
- Data is HaGRIDv2 `annotations_with_landmarks`, test split, in git-ignored `.agent-work/hg/`. Nothing was committed.

## Findings: the download
1. **Landmarks exist, but only in HaGRIDv2.** v1 has no `hand_landmarks`. They are MediaPipe auto-annotations: 21 points,
   normalised x,y, one list per bbox. Scripts must use the v2 URL:
   `https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/hagrid_v2/annotations_with_landmarks/annotations.zip`
2. **It is not small.** The zip is 719,041,314 bytes (3.0 GB train JSON, 0.62 GB test JSON, 0.38 GB val JSON uncompressed).
3. **The server supports Range**, so the test split alone costs about 106 MB (about 100 s here) instead of 719 MB.
   Zip layout: `annotations/{train,val,test}/<class>.json`, 34 classes including `no_gesture`.
   The `.ipynb_checkpoints/` dirs inside the zip are junk and must be skipped.
4. **Checksum:** the host gives an S3 multipart ETag `dce88057a11a665ec53ef1ac9bf2acd4-138` (not a plain MD5) and
   `x-obs-meta-md5chksum` = base64 `RmgrSAaZwEcXghpYsKGS3w==`, i.e. md5 `46682b480699c04717821a58b0a192df`.
   Pinning a sha256 needs one full download. If we only fetch ranges, pin a sha256 of the extracted test JSONs.
   The host is a Russian cloud and `Last-Modified` is 2024-09-24, so a mirror risk exists: the script must fail loudly.
5. **Coverage:** 24,772 test hands have no landmarks (MediaPipe failed). They are skipped, so the sample is biased toward
   easy hands. The README says 201,131 of 229,392 test boxes have landmarks.
6. **License:** the README calls it a variant of CC BY-SA 4.0 and points to `license/en_us.pdf`. I did not read the PDF.
   Treat redistribution as unverified. We only fetch by script, so that is fine.

## Results (test split, per hand, landmarks only; 4.9–5.0k hands per class)
| gesture | HaGRID class | n | recall | precision (all test classes) |
|---|---|---|---|---|
| thumbsUp | like | 4940 | 0.849 | 0.838 |
| shaka | call | 4936 | 0.537 | 0.640 |
| fist | fist | 4877 | 0.945 | 0.196 |
| pointing | one | 4943 | 0.989 | 0.154 |
| openPalm | palm + stop | 9970 | 0.503 | 0.235 |

Charter bar: recall ≥ 0.85 for every gesture. **Only fist and pointing pass; thumbsUp is at 0.849, just below.**

Per-class detail, the useful part:
- **stop recall is about 0.10** (517 of 4978 fire openPalm). palm is 0.90 (4498 of 4991). `openPalm` needs the thumb
  extended, and HaGRID `stop` has the fingers together with the thumb tucked. A real "no." pose is likely to miss too.
  `four` (4 fingers, thumb in) hits 0.43.
- **call recall is 0.45 lost to "none"** (2215 of 4928): shaka needs thumb and pinky out, and the thumb test is strict.
  33 call hands come out as thumbsUp.
- **like**: 719 of 5,000 (14 %) read as fist, because the `thumbUp` height test fails when the thumb is angled.
- **fist**: 248 (5 %) read as thumbsUp.

False triggers. The charter says every unmapped class should trigger none. That gives **43 % false triggers** (63k of 146k
hands), but most of that is a mapping artefact, because many classes look like a mapped gesture:
- dislike→fist 0.98, xsign→fist 0.98, thumb_index/thumb_index2→pointing 0.98–1.0, take_picture→pointing 0.95,
  mute→pointing 0.89, point→fist 0.45, grip→fist 0.46.
- These are the same hand shape to a landmark rule, so they are not failures. Excluding such look-alikes, the other
  classes (peace, ok, rock, three, four, two_up, …) give **5.5 % false triggers** (3,047 of 55,011).
- `ok` → openPalm 7 %; `no_gesture` → 57 % trigger something (345 of 607) (173 openPalm, 110 fist), which is the one that matters for the app.
  The test split has few no_gesture hands (607) with landmarks.

## Recommendation for the planner
1. Keep the M1 plan, but change the download to a **Range-fetch of `test/*.json` only** (about 106 MB, no 719 MB zip),
   using the v2 URL. Make `rangezip.py` the starting point, or do it in Node with `fetch` and a Range header (no deps).
   Also write the 34-class list, the 21-landmark check and the skip count into the report.
2. Fix the **scoring definition** before choosing thresholds. Add an "ambiguous" set (dislike, xsign, thumb_index*, take_picture,
   mute, point, grip, timeout…) that is not scored as a false trigger. Otherwise `--check` can never pass.
   Report no_gesture separately, with the bar chosen from that number.
3. The bar of 0.85 is not met today for shaka, openPalm and thumbsUp. M3 candidates, in order of gain: let `openPalm`
   accept a tucked thumb (fixes stop); relax the shaka thumb test; relax `thumbUp` for angled thumbs. All of this needs the
   M1 harness first, and it changes the app, which M1 forbids.
4. Open question for the owner (do not decide): is "stop" meant to be a flat hand without the thumb out? The README table decides.

## Limits
- One hand per row; two-hand and "hands up" features, `handAtChin` and face-based features are not tested here.
- HaGRID images are mostly of people with an arm at a desk, not selfie-distance, and the landmarks are MediaPipe
  auto-annotations, not human labels. They match what the app sees (also MediaPipe), but are not ground truth for the hand pose.
- Mirroring: the app's front camera may mirror the image. The features here are mirror-invariant, so this has no effect.

