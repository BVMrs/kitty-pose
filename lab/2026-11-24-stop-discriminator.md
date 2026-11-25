# Stop-discriminator: can a thumb-free feature recover HaGRID `stop` as open palm?

## Question
`iso-resweep` left open palm at ~.68 because HaGRID `stop` hands hold the thumb against the index, so the t2 thumb test
fails. Its suggestion: find a different discriminator (finger spread) for stop-palm vs look-alikes.

## Method
`lab/stop-discriminator/auc.mjs` (output in `output.txt`): HaGRID v2 test landmarks, coords scaled to 3:4 portrait
(the dominant true aspect, see `image-aspect-recall`). Keep hands where all 4 fingers are extended (min tip/pip ratio
> 1.12, the gate the app already uses). Positives = palm+stop (9,967 hands). Compute AUC for t2, three adjacent-finger
spread angles, overall spread, mean tip gap, thumb angle, thumb-to-index distance, against all other classes and
against `four` alone. Then scan "openPalm = 4 ext AND (t2>.55 OR spreadAll>T)".

## Results
Hands passing the 4-finger gate: palm 4,991, stop 4,976, **four 4,960**, stop_inverted 4,936, no_gesture 345, ok 146, rest <50.
- AUC vs `four` only: t2 .60, thumbAng .64, every spread/gap feature .24-.29 (i.e. `four` is MORE spread than palm/stop,
  so the sign is wrong, none is a usable positive cue). Vs all negatives: all spread features .40-.51 (chance).
- Scan with spreadAll>T (T 40-60 deg): palm .84-.85 unchanged, stop .03-.04 (no gain), but `four` triggers 22%->66% and
  no_gesture 46%->62% as T drops. Spread buys nothing and costs false triggers.
- (tipGap scan columns in output.txt are meaningless: my threshold scaling put them below every hand, so everything
  passes. The AUC rows are the result.)

## Finding
`stop` and `four` are the same hand shape to a landmark classifier: flat hand, four fingers up, thumb tucked
(4,976 vs 4,960 hands). No thumb-free feature separates them (best AUC .64), so open palm for `stop` cannot be
recovered by geometry. The ceiling is a label-definition question, not a threshold: either `four` counts as open palm too
(then both classes pass with palmNoThumb-like logic, and `four` stops being a false trigger), or `stop` is declared
not-open-palm and the criterion-2 recall bar is computed on `palm` only.

## What the planner should do next
1. Owner decision (not mine): treat HaGRID `four` as an acceptable open palm (it is the same pose a user makes), or
   restrict the open-palm eval to `palm`. Either removes the apparent .68 ceiling; do not tune more spread features.
2. If `four` is accepted: re-run the iso-resweep with `four` as a positive; expect palm/stop/four ~.99 with the
   false-trigger rate then dominated by no_gesture (87% with palmNoThumb, so still needs a veto). Not run here.
3. Drop the "spread feature" idea from the M3 backlog.
