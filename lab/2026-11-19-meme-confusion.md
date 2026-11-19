# Meme-level confusion: which of the 21 memes does each HaGRID gesture actually trigger?

## Question
Earlier lab work scored `handFeatures()` flags (thumbsUp, fist, ...). The user sees a *meme*, chosen by `MEMES[].score`
and `choose()`. For all 34 HaGRIDv2 gesture classes, which meme wins when the face is neutral? This covers the
two-hand memes (`wizard`) and the "unmapped should be none" rule at the level the user sees.

## Method
- `lab/meme-confusion/sim.mjs`: per test image, take every hand with 21 landmarks, run `handFeatures(hands, null)` on
  them with a neutral face (`faceFeatures({}, null)`, `face:true`), score all `MEMES`, take the argmax, and fall back to
  `stare` below `choose()`'s 0.35 floor. Steady state: no EMA and no dwell (see choose-dynamics for those).
- Data: HaGRIDv2 test landmarks from `lab/hagrid-annotations` (git-ignored `.agent-work/hg/`). 156,934 images with
  at least one landmarked hand, about 4.9k per class (`no_gesture` 485).
- Caveats: no face landmarks, so `handAtChin`, `handsUp` and every face meme are off. HaGRID hands are mostly arm's length,
  not selfie distance. Raw output: `lab/meme-confusion/output.txt`.

## Results (share of images per class, top picks)
| HaGRID class | what the app shows | note |
|---|---|---|
| fist | fistbump 93 % | thumbs 5 % (`like` look-alike) |
| like | thumbs 81 %, fistbump 18 % | |
| call | shaka 52 %, stare 38 % | matches the earlier recall of .54 |
| one | point 99 % | |
| palm | stop 78 %, **wizard 10 %** | `wizard` fires when a second palm is in the frame |
| stop | stop 17 %, stare 79 % | the earlier "stop" recall of .10 |
| dislike (thumb down) | **fistbump 97 %** | |
| xsign (arms crossed) | **fistbump 96 %** | |
| mute (finger on lips) | **point 90 %** | |
| take_picture | **point 93 %** | |
| thumb_index, thumb_index2 | **point 99 %, 98 %** | the "L" and "gun" shapes |
| point (HaGRID: two fingers pointing) | fistbump 48 %, point 30 % | |
| hand_heart | **wizard 43 %**, stop 38 % | two hands forming a heart read as two open palms |
| holy (palms together) | stop 30 %, **wizard 22 %** | |
| peace, rock, ok, three*, two_up* , middle_finger | stare 79–90 % | fine; the rest is stop 6–15 %, fistbump 2–5 % |
| no_gesture | stare 38 %, stop 26 %, fistbump 21 %, thumbs 8 % | |

Over all classes the app shows a non-default meme for 53 % of hands: point 17.3 %, fistbump 14.8 %, stop 12.7 %,
thumbs 3.0 %, wizard 2.7 %, shaka 2.5 %.

## What this says
1. **Look-alike hands get confident wrong memes.** Thumb down, crossed arms and a fist all give "👊". Finger-on-lips
   (mute), camera-framing (take_picture) and the L/gun shape all give "you." / point. These are the false triggers
   behind the 43 % rate in hagrid-baseline, now with names. For a playful app most are arguably fine ("you." for a gun
   hand), but a thumb-down becoming fistbump and mute becoming point are owner calls.
2. **`wizard` is the least reliable meme.** It has no test in the HaGRID eval (the mapping has no two-hand class) and it
   fires on hand_heart and holy. `twoPalms` only counts open hands. Nothing checks that the palms are apart or at a
   plausible height, so a heart or clasped hands count.
3. **`stop` is mostly lost on real hands** (78 % on `palm`, 17 % on `stop`), as in threshold-sweep. The `stop` meme is
   what a user sees for it.
4. The `fist` flag is also what `dislike` and `xsign` hit, so `HaGRID eval: handle dislike as fist` is right for the
   scoring, but the product question is whether thumb down should be silent.

## What the planner should do next
- Add `wizard` to the M1 eval: score `two_up`-free two-hand classes, with `hand_heart`/`holy` as negatives, and report a
  per-meme table (not only per-flag) in `demo/eval-hagrid.js`. The script here is a starting point: it already scores
  by meme.
- A cheap `twoPalms` guard to try in the sweep: require the two wrists to be at least about 1.5 hand sizes apart, and
  test that it removes `holy` and `hand_heart` without costing `palm`.
- Owner decision (do not decide here): is thumb-down → "👊" and mute → "you." acceptable, or should those be silent? Put
  it to the owner with the table above.
