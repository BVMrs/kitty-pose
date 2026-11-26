# Expression vs hand: how often a real face overrides a recognised gesture, and what a veto costs

## Question
`reachability` (2026-11-19) showed, with hand-set perfect expressions, that smile/smug/sleepy/huh/hiss/pop/side-eye have no
hand term and beat hand memes on score ties; it said "needs real clips to size it". With real face frames and real hands,
how often does the hand meme lose today, and what does a hand veto on those 7 face memes cost? (Owner call whether a hand
should outrank a face; this sizes it, it does not decide.)

## Method (`lab/expression-vs-hand/sim.mjs`, output in `output.txt`)
- Face: 3,780 real frames from the 28 k76 dumps (RAVDESS neutral/sad/angry/fearful, Hadjikhani anger/fear/happy, Livingstone sad),
  through the real `faceFeatures(blendshapes, landmarks)`.
- Hands: HaGRID test landmarks (single-label images), 20 random hands per gesture class, each paired with every face frame,
  through the real `handFeatures(hand, null, 0.75)` (3:4 portrait, see `image-aspect-recall`). Face and hand are independent
  samples: this is a model of co-occurrence, not recorded co-occurrence.
- Winner = steady-state `choose()` (max score, ties to list order, < .35 -> stare). Patch = score of the 7 face memes
  multiplied by `1 - max(thumbsUp, shaka, openPalm, twoPalms, fist, handsUp, pointing)`. `laugh-point` / `angry-fist` untouched.
- Gesture rows only count frames where `handFeatures` recognises the gesture (so hand recall, covered elsewhere, is excluded).
  The "unmapped" row (peace, ok, rock, ... 72.9k hands) counts frames whose face-only meme is not the default stare.

## Results
Share of recognised-gesture frames that show the hand's meme, master -> patch:

| hand | all faces | happy faces | sad | angry | fearful | neutral |
|---|---|---|---|---|---|---|
| thumbs-up, shaka, open palm (identical) | 91.5 -> 100 | 43 -> 100 | 88 -> 100 | 91 -> 100 | 95 -> 100 | 100 |
| fist | 82.7 -> 89.6 | 43 -> 100 | 79 -> 88 | 73 -> 74 | 79 -> 85 | 98 |
| pointing | 80.4 -> 81.6 | 32 -> 32 | 77 -> 79 | 71 -> 75 | 74 -> 74 | 98 |

- On master, a thumbs-up/shaka/palm is replaced by a face meme in **8.5%** of frames over this mixed face set (smile 3.8, hiss 2.7,
  smug 1.7, pop 0.3); with a happy face it loses **57%**. Fear/anger clips and the neutral set are unaffected (their faces
  score no face meme at all; 'angry brows, mouth closed' maps to stare).
- Fist: the remaining ~10% non-hand frames are `angry-fist` (9-10%, intended, mouth open) and a few smile/smug; patch removes the
  smile/smug part. Pointing: `laugh-point` takes 13% -> 18% (intended: smile/jaw-open + point); `hiss` (4.2%) is removed.
- **Cost of the patch** is a false-trigger amplifier: with an unmapped hand (peace, ok, rock...) in view and a real expression,
  the face meme survives 53.6% on master, 43.6% patched. The 10 points go to a falsely recognised gesture
  (fistbump +3.5, stop +2.9, laugh-point +2.7, point +0.8), i.e. HaGRID's ~7% hand false-trigger rate now also costs expression memes.
  Worst on `sad` (56->43) and `happy` (81->60) faces. Face-only frames and frames with no hand are byte-identical.

## Caveats
Acted (RAVDESS) / posed faces, not people holding a thumbs-up; independent pairing; hands not placed relative to the face
(chin zone is in `hand-near-face`); raw per-frame winner, no chooser smoothing; the 7-meme veto list is my choice.

## What the planner should do next
- Owner question (not decided): should a recognised gesture outrank a face-only meme? Numbers: yes costs 10 pts of expression
  memes under a mis-recognised hand and buys +8.5 pts of gesture memes (+57 with a smile). A softer variant (veto only
  thumbsUp/shaka/openPalm/fist, leave pointing alone) is a one-line change if the owner wants fewer regressions.
- If yes, bundle with `priority-patch`/`gender-patch`; add the "hand x expression -> meme" table (smile, hiss, smug x the five gestures)
  as a regression test; record thumbs-up-while-smiling as a clip in M2.
- Order matters: the false-trigger rate should drop first (shaka thumb test from `gender-patch`, no_gesture look-alikes), since the
  veto multiplies its cost.
