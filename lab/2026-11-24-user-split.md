# Do the threshold-sweep gains hold on people the tuning never saw?

## Question
[threshold-sweep](2026-11-18-threshold-sweep.md) tuned on one half of the HaGRID test images (image-id parity) and reported on the other.
Its own limit note says the same person can appear in both halves. HaGRID gives a `user_id` per image. Is the M3 recommendation
(shaka `t2>0.3`, thumbs-up height 0.25, open palm needs `t2>0.3`) still true when the evaluation people are disjoint, and how wide is the uncertainty?

## Method
`lab/user-split/split.mjs` (same rule copy as the sweep, plus `user_id`). Run: `node lab/user-split/split.mjs <test dir>` (~100 s, output in `output.txt`).
- Same 175,871 test hands. Users: 4,107. Max 510 hands per user.
- Users are split into two folds by hash of `user_id`. The 1,728-setting grid is tuned on fold 0 and reported on fold 1.
- Cluster bootstrap over users (B=200) gives 95% intervals for the combined recommendation.

## Results
1. **The parity split was leaky.** 3,588 of 4,107 users (87%) have images in both parity halves.
2. **The recommendation holds on unseen people.** Combined patch ("COMB"), fold 0 / fold 1: thumbsUp .875/.880, shaka .935/.920, fist .940/.938,
   pointing .989/.990, openPalm .886/.875, clean false trigger 7.5/7.2 %. Baseline on the same folds: shaka .55/.52, openPalm .51/.50.
3. **Bootstrap 95% intervals (COMB, by user):**
   | metric | 2.5% | median | 97.5% |
   |---|---|---|---|
   | thumbsUp | .855 | .878 | .898 |
   | shaka | .918 | .928 | .938 |
   | fist | .925 | .940 | .950 |
   | pointing | .986 | .989 | .992 |
   | openPalm | .865 | .880 | .893 |
   | clean false trigger | .068 | .073 | .076 |
   | no_gesture trigger | .793 | .822 | .850 |
   The thumbs-up lower bound (.855) clears the charter's 0.85 by only 0.5 pt; every other bar has margin ≥ 1.5 pt.
4. **Grid tuning does not overfit people.** The best grid setting tuned on fold 0 loses ≤ 1.5 pt on fold 1 (e.g. shaka .937→.923). It uses
   `palmNoThumb`, i.e. openPalm .99, but no_gesture triggering .85 and `four` read as palm 99.8 %. So the open-palm trade-off from the sweep is untouched.
5. **No single person dominates:** the top 5 users supply ≤ 3 % of any mapped class. `no_gesture` has only 607 hands from 386 users, which is why its
   interval is the widest (.79–.85).

## What the planner should do next
- Treat the threshold-sweep numbers as valid for new people; no change to its recommendation.
- In `eval-hagrid.js --check`, set the thumbs-up bar at ≥ .85 only with a bootstrap-aware margin: the point estimate .878 is fine, but a bar tighter than
  .86 would fail on resampling. Report the number with a user-clustered interval, or split by `user_id`, not by image parity.
- Fetching val/train `no_gesture` is still the way to narrow the no_gesture interval.

## Limits
Still MediaPipe auto-annotated landmarks, hand-only, landmark level (as in the sweep). Test split users may overlap train/val users (not checked; irrelevant here since nothing is trained).
Selection of the fold-0 winner uses the same objective as the sweep; the COMB row is not tuned on folds at all.
