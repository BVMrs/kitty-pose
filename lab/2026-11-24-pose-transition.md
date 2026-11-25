# pose-transition: which wrong memes flash while the hand moves from one pose to another?

## Question
choose-dynamics used held poses. In use, people change pose: does the real handFeatures + createChooser show a wrong
meme on the way from pose A to pose B (e.g. fist while opening a palm), and does it depend on how fast the hand moves?

## Method
`lab/pose-transition/sim.mjs` (run: `node lab/pose-transition/sim.mjs`, needs HaGRID test annotations in `.agent-work/hg`).
- Hands: real HaGRID test landmarks for like, call, fist, one, palm (label must match the class). Only hands the app already
  classifies correctly at the true 3:4 aspect (see image-aspect-recall) are used, so a flash is the transition's fault.
  Clean pool: like 2902, call 1918, fist 2899, one 2976, palm 2413.
- Transition: wrist-aligned linear landmark interpolation A→B over T ms at 30 fps, placed under a fixed neutral synthetic face,
  through the real `handFeatures(…, aspect .75)` and `createChooser`. 1 s settle on A, then 1.5 s after B. 150 random hand pairs
  per ordered pose pair (20 pairs), T = 100/200/400/800 ms. Trials where A was not shown after settling are skipped.
- Flash = any meme other than A's, B's or "stare" at any frame.

## Results (≈3000 trials per T)
| T | final shows B | flash of a wrong meme | passes via stare |
|---|---|---|---|
| 100 ms | 99.7% | 0.3% (think) | 0% |
| 200 ms | 99.7% | 0.3% (think) | 0% |
| 400 ms | 99.7% | 0.3% (think) | 0% |
| 800 ms | 99.7% | 3.0% (fistbump 1.9, thumbs 0.6, think 0.5) | 0% |

- Fast and medium transitions are clean: the 220 ms dwell swallows the in-between shapes. The residue is `think` (hand
  passing chin height), already known from hand-near-face.
- Only slow, deliberate transitions leak: at 800 ms the worst pairs are palm→like 19%, like→palm 8%, one→like 8%, fist→palm 5%.
  The intermediate shape (half-curled fingers, thumb mid-way) is held long enough to pass dwell and reads as fistbump/thumbs.
- Final correctness is unaffected at any speed; no transition ever dropped to "stare".

## Caveats
Linear landmark interpolation is not real motion (real fingers curl at different times, which can make intermediate shapes
*more* or *less* ambiguous); the face is neutral and fixed; one hand only; endpoints were filtered to correct ones (so
this is a lower bound on wrong output). Nothing is measured on a device.

## What the planner should do next
- No action for normal use: a 0.3% flash at ≤400 ms needs no fix. The think veto in priority-patch already covers that residue.
- Optional, low priority: if slow changes look flickery on a phone, a longer dwell only for the thumbs/fistbump targets
  would cost latency everywhere; not recommended without a device observation. Add the transition sim to M2 notes as an
  expected-behaviour baseline (≤0.3% flash at 400 ms) rather than as an issue.
