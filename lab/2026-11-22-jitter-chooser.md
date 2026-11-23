# Does the chooser's smoothing already absorb landmark jitter? (held pose, 30 fps)

## Question
`jitter` (11-19) measured per-frame agreement with no EMA or dwell and said ~1 in 5 thumb-gesture images is unstable
at 2 % noise. The app does smooth and dwell. How much of that survives `createChooser()`, and does smoothing the
landmarks before `handFeatures` (the cheap fix proposed there) help?

## Method
`lab/jitter-chooser/sim.mjs <test-dir> [perClass=100]`, HaGRIDv2 test landmarks (same data as `jitter`).
Per image: clean pick as the target (images whose clean pick is the default are skipped). Then 90 frames at 30 fps of
the held hand with fresh i.i.d. Gaussian noise each frame (sigma 1/2/4 % of hand size), neutral face, fed to the
real `createChooser()` starting on the default meme. Classes like, call, palm, stop, fist, one, 100 each (600 clips).
Filters: raw (app today), landmark EMA alpha 0.5, alpha 0.3. Seeded. Metrics: % of frames 1-3 s showing the target;
"bad clip" = more than 2 switches or under 90 % correct. Output: `lab/jitter-chooser/output.txt`.
Caveat: i.i.d. noise per frame is the best case for smoothing. Real MediaPipe jitter is partly correlated, and phone sigma is unmeasured.

## Results (all six classes pooled, 600 clips)
| sigma | filter | frames correct | clips that end on right meme | bad clips |
|---|---|---|---|---|
| 1 % | raw | 99.4 % | 99.3 % | 1.0 % |
| 2 % | raw | 98.0 % | 98.3 % | 3.2 % |
| 2 % | EMA 0.5 / 0.3 | 98.9 / 99.1 % | 99.2 / 99.3 % | 1.8 / 2.0 % |
| 4 % | raw | 95.4 % | 96.2 % | 5.7 % |
| 4 % | EMA 0.5 / 0.3 | 97.3 / 98.4 % | 97.5 / 98.2 % | 4.2 / 3.2 % |

Per class at 4 % raw: thumbs-up 89.4 % of frames correct (13 % bad clips), stop 94.5 % (7 %), palm 95.2 %, shaka 95.4 %,
fist 98.3 %, pointing 100 %. With EMA 0.3: thumbs-up 96.8 %, shaka 99 %, palm 99 %, but `stop` gets no better (95.5 %, 10 % bad).

## Findings
- The chooser already helps a lot: raw per-frame instability of 17-19 % of thumbs-up/shaka images at 2 % noise (`jitter`)
  becomes about 3 % bad clips in a real hold. Visible flicker at 1-2 % noise is rare. It is a 4 %+ problem (far or moving hand).
- Switch counts are ~1.0 in every cell: the failures are rarely flicker. They are clips whose hand sits near a threshold, so the
  meme settles on the wrong one, or never reaches the right one. Smoothing cannot fix a biased decision, only a noisy one.
- Landmark EMA (0.3) removes about half the bad clips at 4 % (5.7 → 3.2 %) at a cost of ~3 frames of lag on movement, not
  measured here. Gain is largest for thumb gestures. `stop` is already a bias problem (the open palm look-alike), not noise.
- Residual 3-4 % at 4 % noise is the bias floor that only the threshold work (`threshold-sweep`) can move.

## What the planner should do next
1. The jitter fix is lower priority than `jitter` implied: do not add finger hysteresis for 1-2 % noise. If done, a landmark
   EMA (alpha ~0.3-0.5, per hand slot, reset on hand loss) is a few lines and halves the 4 % case.
2. First measure real phone landmark sigma on a held hand (M2 smoke clip) to decide whether the 4 % row ever applies.
3. Any filter must be re-checked against `choose-dynamics` (pose→meme latency 235-270 ms) since lag adds to it.
