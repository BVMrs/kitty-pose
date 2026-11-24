# Prior art: could MediaPipe's own Gesture Recognizer replace or back up `handFeatures`?

Date 2026-11-24. Track (c), literature and prior art. Nothing was run on the app, and there are no recall numbers
here, because the canned classifier has not been run on HaGRID.

## Question
The labs found `handFeatures` fragile in several ways. It is not aspect-correct (portrait thumbsUp recall is ~.10),
it needs an upright hand, it depends on thumb geometry, and it is tuned on one dataset. Google ships a pre-trained
classifier on the same 21 landmarks, the Gesture Recognizer. Does it fit this app?

## What the source says
Source: https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer (fetched 2026-11-24).
- Canned classes: `Closed_Fist, Open_Palm, Pointing_Up, Thumb_Down, Thumb_Up, Victory, ILoveYou`, plus `None`.
- The bundle is the hand landmarker plus a gesture embedding model plus a small classifier.
- Reported latency: 16.8 ms on CPU and 20.9 ms on GPU (Pixel 6).
- The page reports no accuracy figures and no per-class or fairness results. It points to a PDF model card, whose
  text I could not extract.
- Handedness is the subject's, so a mirrored image swaps the labels. This is irrelevant for us because we do not use handedness.
- `numHands` defaults to 1. The app already passes 2.
- A custom classifier head can be bundled. Training one needs Model Maker, which I could not confirm from the page.
- The licence is not stated on the page. Check it before adopting.

Measured with `curl -I`, same origin as today's hand model (storage.googleapis.com), so criterion 4 (privacy) is unaffected:
- `gesture_recognizer.task`: 8,373,440 B.
- `hand_landmarker.task`: 7,819,105 B (what the app loads now).
- The delta is +0.55 MB (+7 %), and the recognizer bundle includes its own hand landmarker.
- `sw.js` and `app.js` hard-code the hand model URL, so adopting it means changing both.

HaGRID (arXiv:2206.08219): 18 classes, 554,800 images, 37,583 subjects. It is the natural benchmark for any
replacement, and `lab/hagrid-annotations` already holds landmarks, not images.

## Fit to the app's gesture set
| App meme | Canned class | Verdict |
|---|---|---|
| thumbs | Thumb_Up | direct |
| fistbump / angry-fist | Closed_Fist | direct |
| stop (open palm) | Open_Palm | direct |
| point / laugh-point | Pointing_Up | named "Up", so it may need an upright finger. Unverified |
| shaka | `ILoveYou` is thumb+index+pinky, a different sign | **no match**, so rules stay |
| wizard, yippee, think, all face memes | none | rules stay (two-hand, hand-near-face and face logic) |
| (no meme yet) | Thumb_Down, Victory | free extra triggers |

Only 4 of 6 hand gestures map, and shaka, the app's weakest one, has no class. A full swap is not possible.

## Where it could still help (hypotheses, not measured)
1. **Second opinion on the weak gestures.** The classifier takes the landmark vector. If it is trained on augmented
   (rotated, scaled) data, it could be more robust than `handFeatures` to the failures in hand-invariance, out-of-plane and
   portrait-recall. Whether it handles portrait aspect depends on whether it normalises for it. The task is
   specified on image-normalised landmarks, like our rules, so the same squeeze may apply. This needs testing.
2. **Veto or tie-break for list-order bugs.** `None` from the recognizer could replace the priority patch's heuristics.
3. **Cost.** The chooser logic is ~15 µs per frame (frame-cost), so there is no CPU reason to switch. The classifier
   adds an unmeasured per-frame cost and its input is the landmark embedding.

## What does not apply
- Its handedness output (we don't use it).
- Its accuracy claims. None are published on the page, and HaGRID is not its stated training set.
- Replacing face logic. The Face Landmarker blendshapes stay.

## Recommendation for the planner
Do not adopt it blind. Run a cheap offline check first. A page with 7 classes and no published per-class numbers means
we have to measure it ourselves.
1. Node script that loads `@mediapipe/tasks-vision` `GestureRecognizer` in WASM on HaGRID *images*. The existing
   `lab/hagrid-annotations/rangezip.py` Range fetch can sample ~200 images per class. Compare with `handFeatures` per
   class on the same images, with portrait crops added. This is CPU only, so there is no GPU spend. Note it needs
   images, not just the landmark JSON, so it is a different data fetch (~tens of MB for 200 images × 6 classes).
2. Decide only if canned recall on like/fist/palm/one beats the patched rules by a clear margin on portrait frames.
   Otherwise leave the rules.
3. Keep shaka rules whatever happens.

Follow-up filed: `.agent-work/followups.json`.
