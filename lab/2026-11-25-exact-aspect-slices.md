# exact-aspect-slices: gender-patch and size slices with the true image aspect on all 29,662 hands

## Question
`gender-patch` (11-25) trusted only 1,775 hands with known image aspect; the other 28k got an imputed aspect, and its
size-bin numbers were flagged as an artifact. It asked for a follow-up: fetch the JPEG size of every mapped hand and
re-run. With exact aspect, does the recommended patch (`shakaThumb .2`, `up .25`) hold in every gender and hand-size slice?

## Method
- `lab/image-aspect2/sizes.py` (unchanged) read the JPEG header (EXIF-orientation aware) of every HaGRID test image for
  like, call, fist, one, palm, stop by HTTP Range into the original-resolution class zips: 6 x 5,000 images, all matched,
  about 8 min with 6 parallel jobs. Sizes (2.2 MB) are in `lab/exact-aspect-slices/sizes/`.
- `lab/exact-aspect-slices/slice.mjs` = `gender-patch/slice.mjs` with no imputation: every hand is made isotropic with
  its own A0 and scored with the same `pred` and four threshold sets. Adds hand-size, source-shape slices, Wilson
  lower bounds and a "worst slice (n>=100)" line. Output: `output.txt`.
- Data: HaGRIDv2 test landmarks, single-hand images with exactly one box of the class (29,662 hands; 16,792 female, 12,870 male per dataset meta).
  Source shape: 72% portrait 0.7-0.8, 20% landscape >=1.2, 7% <0.7, 2% near-square.

## Results (recall %, all hands, true aspect)
| set | thumbsUp | shaka | fist | pointing | openPalm |
|---|---|---|---|---|---|
| master + aspect | 97.7 | 62.1 | 96.3 | 99.0 | 49.0 |
| **shakaThumb .2, up .25** | 98.0 | **96.2** | 96.1 | 99.0 | 49.0 |
| shakaThumb .3, up .25 | 98.0 | 94.0 | 96.1 | 99.0 | 49.0 |
| iso-resweep grid winner | 98.7 | 96.2 | **78.6** | 98.8 | 71.0 |

Worst slice with n>=100 (gender, size bin, female/male x big, portrait/landscape source):

| set | thumbsUp | shaka | fist | openPalm |
|---|---|---|---|---|
| master + aspect | 94.8 (male, big) | 43.6 (male, big) | 94.5 (female) | 45.5 (male, big) |
| shakaThumb .2, up .25 | 95.7 (male, big) | 92.7 (male, big) | 94.1 (female) | 45.5 (male, big) |
| grid winner | 97.4 | 94.0 (small) | **69.4 (female)** | 65.8 (male, big) |

- The recommended patch is confirmed on exact data: shaka .62 → .96 pooled, male .48 → .955, female .74 → .97; every slice
  of size and source shape is at or above .927 (lower Wilson bound >= .89). thumbsUp and pointing are >= .95 in every slice.
  Nothing regresses (fist .963 → .961, from `up .25` letting a few fist hands read as thumbs).
- **`gender-patch`'s caveat resolves.** With exact aspect, big hands (>=.12 of frame, the selfie case) are not weak for
  thumbsUp (.96-.97) or fist (.99); the "male >=.12 thumbsUp 43%" in `hand-demographics` / imputed runs was the imputation
  artifact. The one real size effect left is male big-hand shaka (.436 master → .927 patched).
- Two gaps remain under the patch: **fist, female .941 vs male .986** (4.5 pts, each side n>2,000, CI far from overlapping)
  and **open palm .49 everywhere** (a labelling ceiling, see `stop-discriminator`).
- The grid winner is confirmed bad for fist at pooled scale too (.786; female .694) and only buys open palm .71, still
  below .85. shakaThumb .2 beats .3 in every slice (pooled 96.2 vs 94.0; male big 92.7 vs 88.0).
- Source shape does not matter once aspect is corrected (portrait vs landscape within 2 pts for every gesture), the
  frame-independence claim of `image-aspect-recall` now holds on all data, not a sample.

## Limits
HaGRID gender is dataset meta; sizes are of the source image, not a phone frame; only recall of mapped classes, no
false-trigger rate for the other 28 classes (their sizes were not fetched; `iso-resweep`'s imputed 7% figure stands and
the false-trigger side of shakaThumb .2 is unmeasured on exact aspect). Same-user leakage across slices is not controlled
(`user-split` found the patch holds on disjoint users). Image-header EXIF orientation: all but a few were 1 (not tabulated).

## What the planner should do next
1. M3 patch: pass aspect to `handFeatures`, `shakaThumb .2`, `up .25`. Expected pooled recall on exact aspect: thumbsUp .98,
   shaka .96, fist .96, pointing .99; only open palm (.49) misses charter criterion 2.
2. Have `demo/eval-hagrid.js` read true sizes (cache the 2.2 MB json by id, or fetch headers once) and print worst-slice
   recall by gender per gesture next to pooled; this set's fist/female row is the one to watch.
3. Decide open palm as an owner label question (include `stop`?). If `stop` stays in, charter criterion 2 cannot be met
   by thresholds (see `stop-discriminator`, `iso-resweep`).
4. Optional small follow-up: female fist .94 vs male .99 — look at what female misses read as (thumbs-up/none) before touching t2.
