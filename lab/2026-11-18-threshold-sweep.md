# M3 preview: how far can threshold changes alone take `handFeatures()` on HaGRID?

## Question
[hagrid-baseline](2026-11-18-hagrid-baseline.md) found only fist and pointing meet the charter's recall ≥ 0.85.
Which threshold changes in `fingerState`/`handFeatures` close the gap, and what do they cost in false triggers?
This answers it before M3, with no app change.

## Method
- `lab/threshold-sweep/sweep.mjs`: a parametrised copy of the hand rules. It runs on the same HaGRIDv2 test landmarks
  (175,871 hands with 21 landmarks). It matches `memes.js` on a 1/50 sample (0 mismatches in 3.5k hands) and reproduces
  the baseline recalls exactly.
- Scoring fix, as the baseline report recommended. "False trigger" is measured only on **clean negatives**: ok, peace(_inverted),
  rock, three/three2/three3/three_gun, two_up(_inverted), stop_inverted, middle_finger.
  Look-alike classes (dislike, xsign, mute, point, grip, thumb_index*, take_picture, timeout) are ignored.
  Near-misses (four, hand_heart*, holy, grabbing, little_finger) and `no_gesture` are reported separately.
- Grid of 1,728 settings over `ext` (finger extension ratio), thumb tests `t1`/`t2`, thumbs-up height, an optional
  "palm needs no thumb", and an optional looser shaka thumb. Tuned on one half of the images (image id parity) and reported on the other half.
- Output: `lab/threshold-sweep/output.txt`. Run: `node lab/threshold-sweep/sweep.mjs <dir with test/*.json>`.

## Results (full test split)
Baseline: thumbsUp .849, shaka .537, fist .945, pointing .989, openPalm .503; clean false-trigger **1.4 %**
(not 5.5 %: that figure included near-misses); no_gesture triggers 57 %.

One change at a time:
| change | effect |
|---|---|
| shaka thumb test `t2 > 0.3` (the `t1` test dropped for shaka) | shaka .537 → **.928**; false trigger stays 1.4 %; no_gesture +0.4 pt. **Free win.** |
| thumbs-up height `0.35 → 0.25` | thumbsUp .849 → **.878**; fist .945 → .939. Free win. |
| openPalm without any thumb test | openPalm .503 → 1.00, but clean false trigger 1.4 → **9.9 %**, no_gesture 57 → 87 %, and `four` reads as open palm 99.8 % |
| openPalm needs only `t2 > 0.2 / 0.3 / 0.4` | openPalm .976 / .881 / .724; clean false trigger 9.0 / 7.3 / 4.7 %; no_gesture 85 / 82 / 76 % |
| `ext` 1.0–1.2 | ±0.5 pt on everything except false trigger (2.7 % at 1.0, 1.0 % at 1.2). Not worth moving. |
| `t2` 0.35 globally | shaka .878 and thumbsUp .905 but fist falls to .855 and openPalm only .676. Worse than the targeted fixes. |

Combined (shaka `t2>0.3`, up 0.25, palm needs `t2>0.3`): thumbsUp .878, shaka .928, fist .939, pointing .989,
openPalm .881, clean false trigger 7.3 %, no_gesture trigger 82 %. **All five pass 0.85 and the clean-negative bar of ≤ 10 %.**
The best of the full grid (every recall ≥ .90, false trigger 9.3 %) holds on the held-out half to within 1 pt, so this is not overfitting
on the grid size. It does, however, use `palmNoThumb`.

## What it means
1. Three of the four recall gaps are cheap: the shaka and thumbs-up changes cost almost nothing.
2. **Open palm is a real trade-off, not a threshold bug.** The landmarks cannot tell "stop" (thumb tucked) from `four` or from
   a resting hand: without a thumb requirement `four` fires 99.8 % and `no_gesture` 87 %. The app shows "no." for those.
   The thumb requirement is what keeps the no-hand-pose rate down, and the charter has no bar for it.
3. `no_gesture` is already 57 % triggered at baseline, on only 607 hands. Hands resting in view are the app's most common
   input, so the charter should add a bar for it (as a separate line, with a larger sample from val/train).
4. In the app, `stop` also multiplies by `not(handsUp)*not(twoPalms)` and the meme scores have thresholds I did not model. App-level
   false triggers may be lower than these landmark-level numbers.

## What the planner should do next
- Build M1 with the clean-negative definition above, reporting `no_gesture`, `four`, and the look-alike classes separately.
  Do not put look-alikes in the `--check` bar.
- Add a bar for no_gesture (suggest ≤ 60 % until M3, then lower). Fetch val `no_gesture` too: 607 hands is thin.
- M3 order: (1) shaka thumb test and thumbs-up height; (2) open palm only after the owner answers whether "stop" must work
  with a tucked thumb. Offer them a choice: strict (recall .50, no_gesture 57 %) or `t2>0.3` (recall .88, no_gesture 82 %).
- Do not re-tune on the full test split: tune on val, keep test for the final number.

## Limits
Landmark-level, one hand, MediaPipe auto-annotations as input, no face features, and HaGRID's hand poses are not selfie-distance.
A phone check of "stop" with a tucked thumb is the real test. The held-out split is by image-id parity, so the same person can appear in both halves.
