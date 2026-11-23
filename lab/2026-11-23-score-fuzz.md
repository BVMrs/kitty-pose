# Property fuzz of MEMES[].score: range, bad inputs, co-activation

## Question
Do the 21 `score()` functions always return a finite value in [0,1] for any feature vector the app can produce, and
which memes most often score high together (so list order, not evidence, decides the winner)?

## Method
`lab/score-fuzz/fuzz.mjs` (seeded LCG, output in `output.txt`). 200,000 frames: 1-5 random blendshapes in 0..1 through
the real `faceFeatures()` with synthetic landmarks (roll ±30°, yaw ±0.7), and a hand in 30% of frames (one random
gesture flag, optional chin proximity). Then a second pass puts NaN / ±5 / Infinity / undefined / null / "x" into each
feature of a neutral frame, one at a time.
Caveat: the random prior is flat, not real-world, so winner shares (lookaway 19%, huh 13%) only reflect the yaw/roll
ranges I chose. The co-activation *pairs* are the informative part. The data is not the HaGRID set (it sits outside this
agent's directory boundary), so nothing here is a measurement on real faces.

## Results
- **Range:** 0 out-of-range or non-finite scores in 200k frames. `faceFeatures` clamps nothing but `g()` zeroes
  non-finite blendshapes, and the hand flags are 0/1.
- **Bad inputs:** NaN, undefined, strings or Infinity in almost any feature make several scores NaN; out-of-range
  values (±5) make the hand scores leave [0,1] (e.g. `thumbs` = 5). But none of this is reachable: `faceFeatures`
  and `handFeatures` sanitize their outputs, and `createChooser.step` maps a non-finite score to 0 and clamps. So
  `score()` is only safe *because* of those two layers. A test that calls `m.score()` on hand-built features, as
  `test/memes.test.js` does, would not see a bad value either.
- **Co-activation:** 17.2% of random frames have two or more non-default memes at ≥0.6. Most frequent pairs:
  crying+lookaway 2.2%, lookaway+huh 1.9%, smile+lookaway 1.8%, crying+huh 1.3%, pop+lookaway 1.1%, think+stop/shaka/
  fistbump/thumbs 0.6-0.7% each. Face-vs-head-pose pairs dominate because `lookaway` and `huh` have no
  expression veto (lookaway is vetoed only by a hand, huh only by a wide-open jaw). The think pairs are the known
  hand-near-face finding.

## What the planner should do next
1. No action needed on score range; the sanitising layers are the contract. Optional: a one-line test that
   `createChooser` survives a NaN score (it does today) so the contract is pinned (mutation lab found chooser
   constants 9/22 pinned).
2. If expression-vs-head-pose precedence matters, `lookaway` (and `huh`) need a veto on a strong expression, as
   reachability/head-yaw already suggested. This fuzz only shows the pairs overlap; real-face frequency is unmeasured.
