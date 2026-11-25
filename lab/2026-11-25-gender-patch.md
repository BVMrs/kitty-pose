# gender-patch: do the iso-resweep threshold candidates close or widen the gender gap?

## Question
`hand-demographics` (11-22) found shaka recall 64% female vs 42% male under today's thresholds and asked that the
`threshold-sweep` shaka fix be re-run per gender before adoption. `iso-resweep` (11-24) then picked new candidates in
true-aspect coordinates but only reported pooled and user-disjoint numbers. Do the candidates help every slice?

## Method
`lab/gender-patch/slice.mjs` (same `pred` as `lab/iso-resweep/sweep.mjs`, aspect-corrected coords). HaGRIDv2 test
landmarks (re-fetched with `rangezip.py` into git-ignored `.agent-work/ann`), single-hand images of the 6 mapped
classes (29,662 hands; 16,792 female, 12,870 male per dataset meta). Four threshold sets, recall per gender. True image
aspect is known only for the 1,775 hands sampled in `image-aspect2`; the rest get a seeded draw from that pool.
Hence the **known-aspect rows are the trustworthy ones**; imputed aspect is exact on average only. Full output:
`lab/gender-patch/output.txt`.

## Results (recall %, known-aspect hands only, n about 130-180 per gender cell, so +-3-8 pt)
| set | thumbsUp F/M | shaka F/M | fist F/M | openPalm F/M |
|---|---|---|---|---|
| master + aspect | 97.0 / 99.2 | 76.9 / **46.5** | 90.2 / 99.1 | 47.5 / 50.0 |
| shakaThumb .2, up .25 | 98.2 / 99.2 | 98.8 / **93.8** | 90.2 / 99.1 | 47.5 / 50.0 |
| shakaThumb .3, up .25 | 98.2 / 99.2 | 97.0 / 91.5 | 90.2 / 99.1 | 47.5 / 50.0 |
| grid (t2 .35, ext 1.0, t1 1.0, up .15, shakaThumb .1) | 98.8 / 99.2 | 98.2 / 95.3 | **63.6 / 91.2** | 73.0 / 67.3 |

- Gender gap in shaka is real even after the aspect fix (31 pts under master) and the single-line `shakaThumb .2` removes
  it (5 pts left, both above .90). It costs nothing elsewhere (fist, palm identical to master).
- The iso-resweep grid winner is not gender-neutral: its fist recall falls to 64% for female hands vs 91% for male (pooled
  80%), so the pooled "fist .81" hides a worst slice of .64. It also stays far from .85 on open palm in both genders.
- shakaThumb .2 beats .3 in both genders (male 93.8 vs 91.5); on all 29.7k hands (imputed aspect) .2 gives 93.9% vs 90.8%
  and male 92.8 vs 88.3.
- Fist is the remaining gender gap under master (female 90 vs male 99): female fist hands with a loose thumb read as
  thumbs-up/none. Unchanged by shakaThumb; only moved (down) by lowering shared t2.

## Caveats / what is NOT a result
- Hand-size bins from the imputed-aspect run (e.g. "male >=.12 thumbsUp 43%") are an artifact: a wrong guessed aspect
  skews big, close hands most. On known aspect, big hands (n=28) are fine (thumbsUp 96-100%, shaka 93%). So
  `hand-demographics`' big-hand weakness was in part the squeezed-coordinate effect; it does not survive the aspect fix
  here, but n=28 is small. Re-measure with aspect for every hand (needs JPEG headers of the other 28k images).
- Gender is the dataset's own meta, single dataset, posed gestures.

## What the planner should do next
1. Adopt aspect arg + `shakaThumb .2` (and `up .25` for thumbsUp) as the M3 patch: it closes the shaka gender gap
   (46 -> 94 male) with no side effects. Prefer it over the iso-resweep grid winner, which sacrifices female fist.
2. Make `--check` in the HaGRID eval gate on worst gender slice per gesture, not only pooled; the fist/female cell would
   have flagged the grid winner.
3. Follow-up: fetch image sizes for all 29.7k mapped hands (Range reads of JPEG headers) so size and gender slices are
   exact, then re-run `slice.mjs`.
