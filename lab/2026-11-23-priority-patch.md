# One combined patch for the three list-order tie bugs: does it fix them without regressions?

## Question
Three labs (hand-near-face, hands-up, mixed-hands) each proposed a one-line veto for the same mechanism: flags are 0/1, so ties are broken by `MEMES` list order. Applied together, do the fixes work, and do they cost anything the existing evidence can see?

## Method
`lab/priority-patch/make-patch.mjs` builds `memes-patched.js` from `memes.js` by exact string edits (throws if master drifts). Edits:
1. `think` *= not(thumbsUp) * not(shaka) * not(openPalm)
2. `fistbump`, `angry-fist`, `shaka`, `thumbs` *= not(handsUp)
3. `handFeatures`: `fist = 0` when any hand set thumbsUp/shaka/openPalm/pointing (mirrors the existing `pointing=0` rule).
`run.sh` re-runs the three original sims (same real HaGRID v2 test hands, same synthetic face, aspect 9:16) on the patched file; outputs `*-patched.txt` beside the originals in `lab/<sim>/output.txt`. Also: the single-hand HaGRID eval (`lab/hagrid-annotations/eval.mjs`) on both files, and the repo's `node --test` with the patched file swapped in for `memes.js` (restored with git).

## Results
- **mixed-hands** (shown meme, 300 pairs): thumbs+fist fistbump 90% -> thumbs 98%; shaka+fist 89% fistbump -> shaka 73% (= its alone rate); fist+thumbs fistbump 90% -> thumbs 98%; fist+shaka -> shaka 73%; palm+fist fistbump 68% -> stop 52%; fist+palm -> stop 51%. Pairs with no fist are essentially unchanged (thumbs+shaka still shaka 73% / thumbs 26%: shaka beats thumbs by list order, not addressed).
- **hand-near-face**: thumbs-up at chin level 0% -> 100% kept (at mouth 22% -> 100%); shaka at chin 0% -> 100%; open palm at chin: think 100% -> stop 100%.
- **hands-up**: two raised fists fistbump 97% -> yippee 100%; two thumbs-ups thumbs 99% -> yippee 100%; two palms already 100%. Headroom curve unchanged (78% at top y .20, 99% at .30).
- **Single-hand HaGRID eval: byte-identical** before/after (the new fist rule cannot fire with one hand: fist/pointing/openPalm are disjoint per hand).
- **`node --test` with the patch: 67 pass, 0 fail.** So the existing tests do not pin any of these behaviours (consistent with the mutation lab); each fix needs its own test.

## Costs / caveats
- fist+fist: thumbs now 6% (was ~0): one fist with the thumb slightly out beats the other fist. Mild, arguably correct.
- fist+shaka keeps fistbump 20%, fist+palm 35%: the posed hand loses when MediaPipe's shaka/palm detection itself fails on that hand (alone shaka is only 73%); the veto cannot repair recall.
- A real "thinking" pose with the thumb under the chin reads thumbsUp and now shows `thumbs`, not `think`. HaGRID has no think class, so this trade-off is unmeasured; it needs a recorded clip (M2) before adopting edit 1. A plain open palm at chin now shows `stop`, which seems right.
- Synthetic placement (scale 1.5, flat face), steady-state argmax, no chooser dynamics; same caveats as the source labs.

## What the planner should do next
1. Adopt edits 2 and 3 (low risk, no single-hand change, large measured gains) as a small PR with tests: thumbs hand + fist hand -> thumbs; two fists above forehead -> yippee.
2. Adopt edit 1 only together with a face-regression clip of a real thinking pose (thumb under chin) so the trade-off is checked on real data.
3. Longer term, replace per-meme vetoes with an explicit priority/tiebreak (same mechanism produced all three bugs); shaka-over-thumbs (26% loss in thumbs+shaka) is the remaining list-order case.
