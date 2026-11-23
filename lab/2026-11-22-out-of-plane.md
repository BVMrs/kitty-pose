# How far can the palm turn away from the camera before handFeatures loses the gesture?

## Question
`hand-invariance` covered in-plane roll and frame aspect. A selfie hand also yaws (palm turns sideways) and pitches
(fingers tip toward or away from the lens). `handFeatures` uses only x/y, never `z`. How much out-of-plane rotation
does each gesture survive?

## Method
`lab/out-of-plane/sim.mjs` (run: `node lab/out-of-plane/sim.mjs`, output in `output.txt`). It takes the planar synthetic hand from
`test/memes.test.js`, rotates it about landmark 9 in 10-degree steps from -90 to 90 (yaw, then pitch), projects it
orthographically onto a square frame, and calls the real `handFeatures`. Two depth models:
- **flat**: all z = 0. A planar hand, so the projection is pure foreshortening.
- **fold**: curled fingertips and the folded thumb sit toward the camera, and an extended thumb sticks out of the palm plane.
  These offsets are my guess at hand anatomy, not measured. No real depth data was used (HaGRID has no z), and perspective is ignored.

## Results (contiguous range around 0 degrees where the intended gesture still fires)
| gesture | flat yaw | flat pitch | fold yaw | fold pitch |
|---|---|---|---|---|
| fist | all | all | all | -50..70 |
| pointing | all | -80..80 | all | -50..70 |
| thumbs up | -40..40 | -50..50 | -20..80 | -50..20 |
| open palm | -40..40 | -50..50 | -20..80 | -70..20 |
| shaka | -40..40 | -50..50 | -20..80 | -50..20 |

- Fist and pointing are essentially rotation-proof. The three thumb-based gestures hold about +-40 degrees of yaw and +-50 of pitch in the flat model.
  A casual selfie hand is often turned more than that.
- Past the limit the failure is not a blank: another gesture fires. Thumbs-up beyond 50 degrees of yaw reads as something else
  (fist or shaka). Rotating a thumbs-up past +-60 degrees of pitch also fires another gesture.
- The fold model moves the limits asymmetrically (-20..80 yaw). That asymmetry comes from my arbitrary z offsets, so do not read it
  as real. The robust conclusion is only that the limit sits in the 20-80 degree band and depends on the thumb's depth. The flat numbers
  are the cleaner lower-assumption estimate.

## Caveats
Synthetic, orthographic, one hand shape, no noise. It says where the 2D tests break, not how often real users hit it. Real
MediaPipe landmarks under heavy yaw are also less accurate, which this ignores. Browser unverified.

## What the planner should do next
- Real 3D data would settle it: HaGRID has none, but a short self-recorded yaw/pitch sweep clip through the M2 smoke test would
  measure it. Until then treat +-40 degrees as the design envelope for the thumb gestures.
- MediaPipe returns `z` per landmark, unused here. A thumb test using 3D distance (or the world-landmarks output) is a candidate
  for M3, to be evaluated against this sim and the HaGRID recall gate so it does not regress `threshold-sweep` numbers.
- Add a yaw/pitch case (the flat model, +-30 degrees) to `test/memes.test.js` as a regression guard.
