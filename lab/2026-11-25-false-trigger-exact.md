# false-trigger-exact: does shakaThumb .2 + up .25 cost false triggers once aspect is exact?

## Question
`exact-aspect-slices` (11-25) confirmed the recommended M3 patch (pass aspect, `shakaThumb .2`, `up .25`) on the 29.7k mapped
hands but left one side open: its false-trigger rate on the other 28 HaGRID classes was only known from imputed aspect
(`iso-resweep`'s ~7%). Does loosening the shaka thumb test make unrelated hands show a meme, with each hand's true image aspect?

## Method
- `lab/image-aspect2/sizes.py` (unchanged) read JPEG headers (EXIF-aware) by HTTP Range from the class zips for all 28
  unmapped classes, up to 500 random test images each: 15,104 hands, 28 classes, ~10 min. The zips are at
  `.../datasets/hagrid_v2/hagrid_v2_zip/<class>.zip` for v2-only classes, and at the old `hagrid_dataset_new_554800` path for
  the v1 classes (ok, peace, rock, three, two_up, ... ; the v2 path 403s for them). Sizes are in `lab/false-trigger-exact/sizes/`.
- `lab/false-trigger-exact/ft.mjs` makes each hand isotropic with its own A0 and applies the same finger-flag `pred` as
  `exact-aspect-slices/slice.mjs` (checked against `handFeatures` there), for master+aspect, `shaka.2 up.25`, `shaka.3 up.25`,
  `shaka.1 up.25`. A "false trigger" is any of the five gestures firing. Output: `output.txt`.
- Groups follow `iso-resweep`: CLEAN = ok, peace(+inverted), rock, three, three2, three3, two_up(+inverted), stop_inverted
  (4,954 hands; hands that should clearly show nothing). The other classes are look-alikes of a gesture or half-closed hands.

## Results
| group | master+aspect | shaka.2 up.25 | shaka.3 up.25 |
|---|---|---|---|
| CLEAN (no look-alike), n=4,954 | **0.4%** (18) | **0.4%** (18) | 0.4% |
| no_gesture, n=607 | 53.9% | 54.0% | 53.9% |
| all 28 unmapped, n=15,104 | 40.4% | 41.2% | 41.2% |

What the patch changes (120 hands of 15,104):
- `little_finger` none→shaka **90** (pinky-only, 3% → 22% of 494; thumb tucked but the loosened thumb test accepts it)
- `hand_heart2` none→shaka 29 (64→70% already firing, mostly fist/palm/shaka mix)
- fist→thumbsUp on no_gesture 11, grip 5, point 3, other 2: these were already triggering (as fist); only the shown meme changes.
- Only two classes gain triggers: little_finger and hand_heart2. Every other class is identical to the digit.

Per-class master+aspect fire rates worth knowing: dislike 100% (fist), thumb_index 100% / mute 96% / take_picture 95% (pointing),
xsign 97% (fist), grip 94% (fist), four 24% and hand_heart 30% and timeout 32% and holy 45% (open palm), point 75%
(fist 48%, pointing 22%), no_gesture 54% (palm 25%, fist 19%, thumbsUp 7%).

## Findings
1. With exact aspect the clean false-trigger rate is **0.4%**, not 5-7% (the older figures used squeezed or imputed aspect).
   It does not move under the patch. Charter criterion 2 (<=10%) is met on this definition with a wide margin.
2. The patch's whole false-trigger cost is **little_finger → shaka** (+18 pts of that class). It is a semantically close
   neighbour (pinky up) and is plausibly acceptable, but it is the one thing a visitor can find: pinky-only now shows the
   shaka meme about 1 time in 5. `shakaThumb .3` costs the same (+89), so the cost comes from the thumb test being loose at all
   rather than the exact value; recall .962 vs .940 favours .2.
3. The charter's literal "unmapped classes trigger none" still cannot hold: no_gesture fires 54% (a relaxed hand, a half
   fist). That is a charter wording/owner question (`hagrid-baseline` already said 43%); it is not a patch effect (+0.1 pt).
4. The classes that fire most are fist/pointing look-alikes (dislike, xsign, grip, mute, take_picture, thumb_index):
   the app cannot separate them from fist/pointing with finger flags (cf. `meme-confusion`). They are a labelling issue for
   the eval, not a threshold issue.

## Limits
Up to 500 images/class (the whole test split of each class is 5,000), sampled at random, so per-class rates carry about
+-2-4 pts; the CLEAN and no_gesture totals are tighter (n=4,954 / 607). One label per hand for multi-box images is taken from
the class's own box. No MediaPipe run: the landmarks are HaGRID's own, a different distribution from what the app's model reports.

## What the planner should do next
1. Adopt the patch in M3 as recommended; record in the PR that the only new false trigger is pinky-only → shaka (22%).
2. `demo/eval-hagrid.js`: report the false-trigger rate by group (CLEAN look-alike-free / no_gesture / look-alikes), with
   true sizes cached, so the criterion has a definition. Suggest criterion 2's 10% applies to CLEAN only.
3. Owner question for the charter: is "pinky only → shaka" acceptable? If not, add a pinky-only veto requiring the thumb to be
   out (shakaThumb `.2` plus `t1 > 1.1`) and measure on `little_finger` before merging; not tried here.
