# frame-cost: how much of the frame budget is the app's own JS?

## Question
The loop (`app.js:102-118`) runs two MediaPipe `detectForVideo` calls per video frame plus our own code. Is our own
per-frame code (blendshape→object, `faceFeatures`, `handFeatures`, `createChooser().step` over 22 memes) a
meaningful part of the ~33 ms budget at 30 fps, so that optimising it could matter?

## Method
`lab/frame-cost/bench.mjs` (Node v22, V8, desktop CPU): mirrors `features()` + `choose()` with MediaPipe-shaped input
(52 blendshape categories, 478 face landmarks, 0/1/2 hands × 21 points, 9:16 aspect), a 512-frame pool of random
inputs, 20k warm-up frames, then 2000 samples of 10 frames each (per-frame µs). Also a cold run and a per-piece
breakdown. Output: `lab/frame-cost/output.txt`.

## Results
| hands | median | p95 | p99 | max (GC batch) |
|---|---|---|---|---|
| 0 | 12.7 µs | 28.7 | 42.6 | 1.8 ms |
| 1 | 14.0 µs | 17.6 | 35.9 | 2.0 ms |
| 2 | 15.3 µs | 23.9 | 54.7 | 4.0 ms |

- Cold (no JIT warm-up), 2 hands: first frame 60 µs, frames 2-10 ~22 µs, frames 100-200 ~20 µs.
- Breakdown (2 hands, µs/frame): blendshape list→object 13.9 (the largest piece; `Object.fromEntries` over 52
  entries allocates every frame), `handFeatures` 3.1, `chooser.step` 2.1. The pieces don't sum to the median
  (separate timing loops, different inlining), so read them as ordering, not exact shares.
- 15 µs is 0.05 % of a 33 ms frame. Even a phone 20× slower than this desktop core is ~0.3 ms (<1 %). The single
  worst batch (4 ms in 10 frames, so ≤0.4 ms/frame) is GC, not compute.

## Conclusion
The pose→meme logic is free. Nothing in `memes.js` needs optimising, and the logic tests/fuzzers can run at
millions of frames per minute. Any fps problem on a phone is inference (two models, 2 hands) or rendering.

## Not measured (needs a browser; none here)
`drawOverlay` (`app.js:84-99`) assigns `overlay.width`/`height` every frame, which per the HTML spec clears and may
reallocate the canvas backing store even when the size is unchanged; and it draws 478/7≈69 face dots plus hands via
one path per dot. `renderScores` rebuilds `innerHTML` for 22 rows every frame when "show detection scores" is on.
Both are plausibly much costlier than the 15 µs above but unmeasured. Inference cost per frame is likewise unmeasured
(the in-app fps readout with the scores toggle is the existing tool for it).

## What the planner should do next
- Do not spend effort on logic performance.
- If M2's headless smoke test exists, have it record `performance.now()` deltas around `drawOverlay` and
  `renderScores` and around the two `detectForVideo` calls, so the real split is a number (follow-up filed).
- Cheap guard-rail if desired: only set `overlay.width/height` when they differ.
