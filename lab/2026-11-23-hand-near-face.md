# Hand position vs face: the "think" zone steals thumbs-up, shaka, open palm and fist

## Question
`think` scores `handAtChin` (any hand landmark among 5,8,9,12,13 within ~0.15 face-heights of the chin gives 1.0, falling to 0 at 0.5) and only vetoes `pointing`. All other gesture memes ignore where the hand is. How much of the frame does `think` take from the five mapped gestures when the hand is simply held near the face (a normal selfie: thumbs-up beside the mouth)? None of the earlier notes varied hand position, since HaGRID has no face.

## Method
`lab/hand-near-face/sim.mjs`, `zone.mjs`. Real HaGRID v2 test hands (single-hand images, class = only label), keeping only hands that already win the right meme at their native position, so we measure position, not shape errors. Each hand is translated rigidly (size kept) so its landmark 9 sits at an offset from a synthetic centred face (top y=.30, chin y=.62, face height .32 of frame; only landmarks 10 and 152 are used by `handFeatures`). Neutral expression, real `MEMES` scores, steady state (no EMA/dwell), argmax with the 0.35 floor as in `choose()`. Frame aspect 9:16 (main run) and 16:9. Sample: up to 400 hands per class (like 395, call 291, fist 384, one 395, palm 224 baseline-correct).

## Results
Share of hands for which the shown meme is the right one (thumbs/shaka/fistbump/point/stop), 9:16, by hand-centre position (fh = face heights):

| position | like | call | fist | one | palm |
|---|---|---|---|---|---|
| 1.0 fh below chin | 100 | 100 | 100 | 100 | 100 |
| 0.5 fh below chin | 100 | 100 | 100 | 100 | 95 (5% think) |
| at chin | **0** | **0** | **0** | 100 | **0** |
| at mouth (0.2 fh above chin) | 22 | 7 | 0 | 100 | 100 |
| 0.6 fh sideways, or in front of eyes, above head | 100 | 100 | 100 | 100 | 100 |

Everything lost goes to `think` (100% of the lost cases in the main table). Fine map for thumbs-up (% showing think, rows = vertical offset, + below chin; cols = horizontal offset in fh):

```
dy\dx    0  .15   .3  .45  .6
-0.2    72    1    0    0    0
 0.0   100   51    0    0    0
 0.2    78    4    0    0    0
 0.4     0    0    0    0    0
```
Zone is about ±0.15 fh sideways and −0.3…+0.3 fh vertically, centred on the chin line, so a thumbs-up held next to the chin is "think" up to 0.15 fh off-axis. Open palm is broader and lower: 100% think at dy=0 for dx ≤ .15, 94% at dy=.2, 28% at dy=.4 (fingertips count as knuckles, a palm covering the chin has fingertips close to it). 16:9 gives the same zone for thumbs-up (72/85% at mouth, 100% at chin). Pointing is never stolen (explicit veto). Fist at chin → think is arguably intended (code comment says so) (and a fist at the mouth is also think).

Tie mechanism: for open palm at the chin both `stop` and `think` score 1.0; `think` is earlier in `MEMES`, so it wins the tie. Thumbs-up/shaka score 1.0 against think's 1.0 too, same tie.

## What the planner should do next
1. Decide intent: is a thumbs-up or shaka at chin level meant to be `think`? Probably not: the README's think is "hand on chin" (flat hand/fist), and the thumbs-up near the face is very common in selfies. Suggested rule, one line each, no new data needed: `think` multiplies by `not(f.thumbsUp)` and `not(f.shaka)`, and optionally `not(f.openPalm)` (palm at chin then shows stop; the chin-hand thinker is usually a curled/finger-side hand).
2. Add a test with a fixed hand-at-chin geometry for each of the 5 gestures, since this seems to have been nobody's intended behaviour (checked `test/memes.test.js` only for the thumbs case: no position-vs-face case).
3. This sim is repeatable offline (`node lab/hand-near-face/sim.mjs <hagrid test dir>`), so a before/after of the fix costs minutes.

Caveats: face is synthetic and centred, real face height varies with distance; a real hand also changes depth near the face. Only translation (no roll). Single hands only.

Sources: HaGRID v2 test annotations (Kapitanov et al., WACV 2024, arXiv:2206.08219), fetched by `demo/fetch-hagrid.mjs`.
