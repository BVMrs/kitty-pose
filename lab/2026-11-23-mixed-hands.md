# Two different hands in frame: flags are OR-ed, so the "loudest" hand wins, not the posed one

## Question
`handFeatures` ORs the per-hand flags into one feature vector. Earlier labs covered a duplicated hand (duplicate-hand) and
matched pairs (hands-up). What does the app show when ONE hand holds a pose and the other hand is just also in view (a relaxed fist, an open palm, a second gesture)?

## Method
`lab/mixed-hands/sim.mjs`, output in `output.txt`. 300 real HaGRID v2 test hands per class (like, call, one, palm, fist; landmarks fetched by Range-reading the annotations zip, ~106 MB, into a git-excluded scratch dir) are placed at hand scale 1.5 (selfie-ish, unmeasured) either side of a synthetic neutral face on a 9:16 frame, wrists at y .85 (below the chin at .62). All 25 ordered pairs, plus each pose alone. Real `handFeatures` + `MEMES`, steady-state argmax with the 0.35 floor (no chooser dynamics).
Caveat: pairs are random hands from different photos, so left/right shape and relative geometry are not natural; "alone" baselines include the fixed chin-zone effects seen in hand-near-face (palm alone: stop 51%, think 28%).

## Results (shown meme, % of 300)
- **A fist in the second hand overrides the pose.** thumbs + fist: fistbump 90%, thumbs 9% (alone: thumbs 98%). shaka + fist: fistbump 89%, shaka 7% (alone 73%). palm + fist: fistbump 68%, stop 15%. Cause: both flags are 1 and `fistbump` is earlier in the list, ties go to the first.
- **Two different gestures: list order decides.** thumbs + shaka: shaka 73%, thumbs 26%; shaka + point: shaka 73%, point 25% (pointing is zeroed globally once any hand has thumbsUp/shaka); thumbs + point: thumbs 97%.
- **Pointing beats a fist, palm and fist-like.** point + palm: point 99%; fist + point: point 96%; palm + point: point 99%. So a pointing hand makes the other hand's shape irrelevant, while a fist makes everything else irrelevant, except pointing.
- **Two open palms** (the wizard pose): wizard only 27%; stop 46%, think 23%. Matches the earlier "two-hands-as-two-palms" finding: wizard needs both palms to pass the strict thumb test.
- Same-pose pairs are fine: thumbs+thumbs 97%, point+point 100%, fist+fist 91%, shaka+shaka 92%.
- Practical read: with a phone held in the other hand, the visible gripping hand often looks like a fist or a curled hand. If MediaPipe reports it, the pose shown is fistbump, not the posed gesture, in ~9 of 10 cases for thumbs-up and shaka.

## What the planner should do next
1. Decide whether a second visible hand should be able to veto the posed hand. Cheapest fix (one line in `fist` score or `handFeatures`): count `fist` only when no other gesture flag is set (thumbsUp/shaka/openPalm/pointing from any hand), mirroring the existing `pointing=0` rule. That would fix thumbs/shaka/palm + fist (~60-80 pts) and does not change single-hand behaviour. Add a HaGRID-pair test (e.g. thumbs hand + fist hand → thumbs) to `eval-hagrid`.
2. Measure how often the phone-holding hand is detected at all (needs a real clip; M2 smoke test could include a two-hand clip). This simulation only says what happens if it is.
3. Related existing findings to fix together: `think` vetoes (hand-near-face), `not(handsUp)` on single-hand memes (hands-up); all are the same list-order tie mechanism, so a generic "most specific wins" tie-break (e.g. priority list, or small per-meme bias) would cover them at once.
