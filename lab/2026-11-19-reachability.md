# Meme reachability and hand-vs-face precedence (steady-state `choose()`)

## Question
Can every meme in `MEMES` win `choose()`, and when a hand pose and a facial expression are made together, which wins?
Not covered by `choose-dynamics` (timing) or `meme-confusion` (neutral face only).

## Method
Pure `memes.js` scores, no browser. At steady state `ema == score`, so a meme wins when its score is >= 0.35 and it is the
strict maximum (ties go to the earlier entry in `MEMES`, via `ema[m] > ema[best]`).
1. `lab/reachability/sim.mjs`: random restart + hill-climb over all face features (10 blendshape features, yaw, roll) x 14 discrete hand
   states x chin on/off, maximising `min(score-0.35, score-max(other))`. Output: `output.txt`.
2. `lab/reachability/matrix.mjs`: 9 hand states x 11 expressions, each expression set at the top of its own ramp
   (e.g. smile .8, jawOpen .7, squint .6). Output: `matrix-output.txt`.
Run: `node lab/reachability/sim.mjs`, `node lab/reachability/matrix.mjs`.

## Results
- **No dead memes.** All 21 non-default memes can win with margin 0.65 (score 1.0) somewhere in the feature space.
- **Hand memes do not survive a clear expression.** With a perfect hand feature (=1.0), the hand meme is kept under only 4 of 11 expressions
  (neutral, sad, wide eyes, head turned). A clear smile, big smile, pop, angry yell, smug squint, blink or head tilt replaces it:
  thumbs-up + smile -> `smile`; shaka/palm/two palms/chin/hands up + smile -> `smile`; blink -> `sleepy`;
  roll 24 deg -> `huh`; mouth-open fist -> `angry-fist` (intended).
- Cause: `smile`, `smug`, `sleepy`, `huh`, `hiss`, `pop`, `side-eye` have no `not(f.anyHand)`/gesture term, and with both at 1.0 the
  earlier list entry (all face memes precede hand memes) wins ties. Only `shocked`, `close-stare`, `crying`, `lookaway`, `think` carry `not(anyHand)`.
- Sensible cases that work: point + smile -> `laugh-point`; fist + yell -> `angry-fist`.
- In real use a hand scores 1.0 (binary) while a typical smile ramps to ~0.5-0.8, so the loss is less absolute than this worst case;
  a laughing thumbs-up or a head-tilt while pointing is the realistic trigger. Needs real clips (M2) to size it.

## Caveats
Expressions are set by hand at ramp ends, not drawn from data (face data is the weak spot, see `face-blendshape-fer`).
Hand features are exact 0/1, which HaGRID shows they are not (recall .5-.99).

## What the planner should do next
- Owner decision (do not decide here): should a recognised hand gesture outrank face-only memes? If yes, the one-line fix is a
  `not(f.anyHand)`-style factor on `smile/smug/sleepy/huh/hiss/pop/side-eye`, or a hand-bonus in `choose()`; add a test table
  "hand x expression -> meme" from `matrix.mjs` as a regression test (keeps the intended `laugh-point`, `angry-fist`).
- Fold the matrix into the M2 smoke clips (thumbs-up while smiling is the first pair to record).
