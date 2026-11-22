# Does handFeatures recall depend on who the hand belongs to, or how big it is in frame?

## Question
`hagrid-baseline` and `threshold-sweep` report one recall number per gesture. The thresholds in `fingerState` are fixed
ratios (thumb 1.1 / 0.55, finger 1.12), so they bake in one hand shape. HaGRID v2 test carries `meta` (gender, age, race) for
each image. Does recall differ across those groups, and by hand size in frame (a selfie hand is close to the camera)? I also
wanted left vs right hand, but see Caveats.

## Method
- `lab/handedness/sim.mjs <test-dir>` (dir name is historical). Data: the same HaGRIDv2 test landmarks as `hagrid-baseline`
  (re-fetched with `lab/hagrid-annotations/rangezip.py`, 106 MB, into git-ignored `.agent-work/hg/`).
- For each of the 6 mapped classes (like, call, fist, one, palm, stop), take images with exactly one hand of that class and
  run the real `handFeatures([hand], null)`. A hit is the mapped gesture firing first (same rule as `eval.mjs`).
- Slice recall by gender, age bucket, race, landmark winding, and hand size (|wrist - middle MCP| in normalised image units),
  then gender inside each size bin to separate "bigger hand" from "who". Output: `lab/handedness/output.txt`.
- Total about 29.7k hands. Sub-groups are small for race (Indian n~70-85 per class, unknown ~50-95), so those cells carry
  roughly +-5-10 points of sampling error.

## Results (recall %, n in the output file)
Gender (n 2.0-2.9k per cell):

| | like | call (shaka) | fist | one | palm | stop |
|---|---|---|---|---|---|---|
| female | 87.6 | **63.6** | 91.8 | 99.3 | 92.4 | 12.9 |
| male | 81.3 | **41.9** | **98.1** | 98.4 | 87.1 | 7.0 |

- Shaka differs by 22 points, thumbs-up by 6, open palm by 5, and fist goes the other way (male +6). These gaps are far
  outside sampling error (se about 1 point).
- Not explained by hand size: inside the size bins the gap stays (call, 0.08-0.12: 64 vs 44; >=0.12: 60 vs 30; 0.05-0.08:
  68 vs 40). Only the smallest bin (<0.05, far hands) flips or closes it. Likely the thumb ratio tests and pinky extension
  differ with hand proportions, but I did not isolate which test.
- Hand size in frame (all classes pooled by bin): big hands (>=0.12 of frame) are worst for the thumb-based gestures:
  like 77 %, call 48 %, palm 73 % (male >=0.12: like 67, palm 63, call 30). Small hands (<0.05) are best for like (92) and
  palm (98). A selfie hand is usually close, so the app's real use sits on the weak side. Fist and one improve with size.
- Age: shaka 68 % (<20) -> 41 % (50+); palm 94.5 % (<20) -> 83 % (50+); stop 11 -> 4 %. Fist is flat to slightly better with age.
- Race (small cells; White n~4.4k per class dominates): Black like 73 / call 37 / palm 86 vs White 86 / 54 / 91;
  Indian palm 71 (n=83). The direction is consistent with the gender and size effects but cells are too small to rank;
  treat as a flag, not a finding. The meta labels are the dataset's own and I did not audit them.
- Winding (left/right XOR palm/back): no effect, all within 2 points (fist 93.7 vs 95.6, like 85.9 vs 84.0). So mirroring
  of the front camera is not a risk for these features.

## Caveats
- HaGRID v2 landmark JSONs have no `leading_hand` and no usable z, so true left/right and palm/back could not be separated;
  winding only tells that their combination is irrelevant.
- Landmarks come from a MediaPipe pass over the images, so any demographic bias of the landmarker is included and cannot be
  told apart from bias in our thresholds. The thresholds are still the part we control.
- Single dataset, posed gestures. Not a statement about the people, only about these thresholds on this data.

## What the planner should do next
1. Make M1's `eval-hagrid.js` print recall by gender and by hand-size bin (cheap, same data) and have `--check` gate on the
   worst slice, not only the pooled mean. The pooled 0.88 for shaka hides 0.42 for male hands.
2. For M3 (tune from data), tune thresholds against the worst-slice recall, not just the mean. The `threshold-sweep` shaka fix
   (t2>0.3) should be re-run per gender before adopting it, to check that it lifts the male 42 %.
3. A feature fix to try: normalise thumb tests by palm width (|index MCP - pinky MCP|) instead of the fixed 0.55/1.1
   ratios; this should be checked against the big-hand (>=0.12) slice first.
4. Owner call: whether "worst slice >= 0.85" belongs in the success criteria. The charter's current criterion 2 is pooled only.
