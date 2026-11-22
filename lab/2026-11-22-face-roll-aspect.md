# Face roll is not aspect-corrected: the "huh" head tilt depends on the camera frame shape

## Question
`handFeatures` got an `aspect` argument after `hand-invariance`. `faceFeatures(b, lm)` computes `roll` from eye corners
(landmarks 33, 263) in normalised coordinates with no aspect. Does the head-tilt threshold (`huh` 12..24°, the `browsRaised` cutoff 8..16°) then
change with the frame shape? app.js passes `videoWidth/videoHeight` to `handFeatures` only (app.js:77).

## Method
`lab/face-roll-aspect/sim.mjs`: synthetic 478-point face with the eye line at a known TRUE in-image angle, projected to normalised coords for
five frame shapes, then the real `faceFeatures` + `MEMES` (hand features absent). Reports measured roll, the smallest true tilt at which `huh`
wins, and the winner for a clearly surprised face as the head tilts. Run `node lab/face-roll-aspect/sim.mjs`; output in `output.txt`.
(`yaw` is a ratio of x distances, so it is unaffected.)

## Results
Measured roll = atan(tan(true) * W/H).
| frame | measured at true 20° | `huh` from true tilt (neutral / brows raised) |
|---|---|---|
| 9:16 portrait | 11.6° | 33.5° / 27.5° |
| 3:4 | 15.3° | 26.5° / 21.3° |
| 1:1 (intended) | 20.0° | 20.5° / 16.3° |
| 4:3 | 25.9° | 15.8° / 12.5° |
| 16:9 | 32.9° | 12° / 9.5° |

- On a phone held upright (9:16, the normal case, same as the hand bug) a deliberate head tilt must be ~34° (28° with brows up) to give `huh`,
  vs ~20° designed. Tilt-triggered `huh` is hard to reach and the "tilt your head" hint underperforms. Desktop 16:9 triggers at 10-12°, which is
  an ordinary slight lean.
- A surprised face (wide eyes, brows up) stays `shocked` up to 20° of true tilt on 9:16 and 3:4, but flips to `huh` at 15° on 4:3 and 16:9.
- The thresholds in `memes.js` and the existing tests (`roll` 25, 18, 15 fed directly) are in "measured" degrees that only equal true degrees at 1:1.

## Caveats
Synthetic geometry, perfect landmarks; a real head also pitches/yaws, so in-image roll of the eye line is only an approximation of head tilt.
No browser, so the actual `videoWidth/videoHeight` on iOS is unverified (same caveat as `snap-crop`).

## What the planner should do next
- Small fix (owner's call to merge): give `faceFeatures` an `aspect` argument and use `atan2(dy, dx*aspect)` for roll, passed from app.js like
  the hand call; add a test with 9:16 and 16:9 landmarks. Filed as a follow-up.
- Fold a tilted-head clip into the M2 smoke clips; record it at portrait size.
