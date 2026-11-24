# iso-resweep: handFeatures thresholds re-swept in isotropic (true-aspect) coordinates

## Question
`image-aspect-recall` showed that once handFeatures gets the aspect, thumbsUp/shaka recall jumps, and left open
palm (.49) open "needs an isotropic re-sweep". The earlier `threshold-sweep` picks (shakaThumb .3, up .25) were
tuned in squeezed coordinates. Which thresholds are right in the coordinates the app would use after an aspect fix?

## Method
`lab/iso-resweep/sweep.mjs` (diag.mjs for the per-class feature quantiles). 175,871 HaGRID test hands. x is
multiplied by the true image aspect A0 where known (1,775 hands whose JPEG headers were read in
`lab/image-aspect2/out`). Every other hand gets an A0 drawn, seeded, from that empirical pool (the sizes of
unmapped classes were never fetched). That is an assumption: it is exact for the 6 mapped classes only on the 1,775 sampled hands.
Parity check against the real `handFeatures` (0 mismatches of 4,397). Grid of 2,880 settings (ext, t1, t2,
up, palmNoThumb, shakaThumb), chosen on users-half A, reported on user-disjoint half B (md5 of user_id).
Data: `.agent-work/ann`; run: `node sweep.mjs <annotations/test> <sizes dir>`; full output in `output.txt`.

## Results
Master thresholds in isotropic coords (all hands / true-A0 subset): thumbsUp .85/.98, shaka .59/.64, fist .96/.94,
pointing .99/.98, openPalm .45/.49, false trigger 1.3%, no_gesture 53%. So the thumbsUp gain from `image-aspect-recall`
is real and needs no threshold change; the other two still fail the .85 bar.

Why open palm fails (`diag.mjs`): the `palm` class passes (t1ok .96, t2ok .96) but `stop` does not (t2 median .34 vs
the .55 bar, only 3% pass): in `stop` the thumb is held against the index. Shaka: only 64% of `call` hands pass t2 > .55.
Both are the same single test, the thumb-to-index-base distance t2.

Best grids (falseTrig <= .10 on A; held-out users B in brackets):
- `ext 1.0, t1 1.0, t2 .35, up .15, shakaThumb .1`: thumbsUp .979 (.977), shaka .963 (.951), fist .808 (.791),
  pointing .982 (.990), openPalm .681 (.677), false trig 6.5% (6.9%), no_gesture 79%.
- With false trigger <= 5%: `ext 1.16, t1 1.0, t2 .35, up .15, shakaThumb .1`: thumbsUp .983, shaka .971,
  fist .811, openPalm .676, false trig 4.7%, no_gesture 74%.
- Held-out half B tracks A within ~1.5 pt, so the choice is not overfit to users.
- t2 .35 costs fist (.96 -> .81): fists with the thumb loose now read as thumbs-up. Lowering t2 alone is a
  trade, not a free lunch (one-at-a-time t2 .35: shaka .88, fist .84, palm .60).
- No setting reaches openPalm .85 without `palmNoThumb` (palm .998, but false trig 11.5%, no_gesture 87%).
  Best non-thumb-test variant, `palmT2 .2`: palm .66, false trig 5.6%.
- The earlier squeezed-space picks (shakaThumb .3, up .25) still give shaka .91 and thumbsUp .88 here, only
  slightly behind the new grid winners on shaka (.93-.96).

## What the planner should do next
1. Ship the aspect argument first (it alone moves thumbsUp .33 -> .98 on a phone); keep thresholds for a second change.
2. Then apply the cheap part of this sweep: `shakaThumb` t2 0.2 (shaka .64 -> .96 on A, .956 on B) and `up` 0.15-0.25.
   Do not lower the shared t2 to .35: it costs fist .96 -> .81.
3. Open palm cannot pass .85 with a thumb test at any value that keeps no_gesture sane; owner decision: accept
   `stop` (thumb tucked) as not-open-palm, or use `palmNoThumb` and accept 11% false triggers. A better answer is a
   different discriminator for stop-palm (a 4-finger-spread feature), which this sweep did not search.
4. Re-run with sizes fetched for the unmapped classes to replace the imputed A0 (false-trigger numbers carry that caveat).
