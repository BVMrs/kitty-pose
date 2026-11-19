# Face expressions offline: what open data exists, and a first look at `faceFeatures()` on FER2013 blendshapes

Date 2026-11-18. Track (c) literature/prior art plus a small run. Answers charter open question 2 (which face dataset).

## Question
Can the face half of kitty pose (smile, pop, hiss, crying, ...) get an offline, repeatable benchmark like HaGRID gave the hands, without images
of the owner, without a licence request, and without running MediaPipe in Node?

## Method
1. Searched for open, directly downloadable face-expression data; read licence statements (links below).
2. Found `SamerAttrah/FER2013_blendshapes_dataset_example_Partial` on Hugging Face (Apache-2.0 tag, 36 MB zip). It holds the 52
   MediaPipe Face Landmarker blendshape scores for FER2013 faces, plus an integer class. The columns are in canonical MediaPipe order
   (col 25 = jawOpen, 44/45 = mouthSmile; the class means below are consistent with that).
3. `lab/face-blendshape-fer/profile.mjs` feeds each row into the real `faceFeatures()` and the real `MEMES[].score` functions
   (hand features zeroed) and reports per-class means and the winning face meme. Data is fetched to /tmp, not committed.
   Run: `node lab/face-blendshape-fer/profile.mjs <blends_test_full_set.csv>`.

## Results
Licences (as far as the sources show):
| Dataset | Access | Verdict for us |
|---|---|---|
| FER2013 | Kaggle; licence statements conflict (CC BY 4.0, CC BY-NC, "Other", MIT in various mirrors); 48x48 grey | unresolved, check Kaggle page; low-res |
| FER+ | label-only repo, images come from FER2013 | better labels, same image question |
| CelebA | non-commercial research only, no redistribution; has `Smiling`, `Mouth_Slightly_Open`, `Arched_Eyebrows` | usable locally, never committed; covers only 3 of our face poses |
| AM-FED | CC BY-NC-SA 3.0 | non-commercial, video |
| AFEW | academic/non-commercial, no redistribution | no |
| Google FEC | URL list only, Flickr provenance concerns | no |
| AffectNet / RAF-DB | application required (not verified here) | no |
| MediaPipe blendshape model card | Apache 2.0; its own eval set is private | no benchmark to reuse |

The blendshape CSV (test split 1,647 rows, val 1,658; classes 0/1/2 = 291/1111/245 in test):
| class (my inference) | n | mean smile | mean jawOpen | top winning meme |
|---|---|---|---|---|
| 0 (happy: smile .61) | 291 | 0.61 | 0.07 | smile 45 %, smug 18 %, side-eye 13 % |
| 1 (mixed non-happy) | 1111 | 0.09 | 0.15 | stare 43 %, crying 25 %, side-eye 14 %, pop 6 % |
| 2 (neutral-like: jawOpen .04) | 245 | 0.05 | 0.04 | stare 58 %, side-eye 19 %, crying 14 % |

Smile meme score >= 0.5: fires on 57 % of class 0 (val 52 %), 5.2 % of class 1 (4.2 %), 0.4 % of class 2 (0.8 %).
So `smile` has useful precision (~0.88 test) at moderate recall on 48x48 faces. The default "stare" cat is only 43-58 % for non-happy
faces: `crying` (brows up / frown) and `side-eye` fire on neutral faces 14-19 % of the time. That is a likely false-trigger source, but see caveats.

## Caveats
- The class meaning is **undocumented** (the README, paper abstract and HF card do not say). 0/1/2 above is my inference from class means. 3 classes, 1,647 of
  3,589 test faces: detection dropped about half, and the dropped faces are probably the hard ones. The numbers are optimistic for MediaPipe on 48x48 input; the phone gives it 640x480 or better.
- No ground truth for pop, hiss, shocked, sleepy, side-eye, lookaway, huh. Only smile (and loosely crying/stare) can be scored. Yaw/roll need landmarks, not in this CSV (so `lookaway`/`huh` untested).
- Apache-2.0 on the HF card is the uploader's label; the faces are FER2013's, whose licence is unclear. We use derived numbers in /tmp only.

## What the planner should do next
1. Do not adopt FER2013/CelebA as a pinned M1 face gate. Recommend: face benchmark stays out of M1 (consistent with charter Q2); use the iPhone check.
2. If the owner wants a number, a cheap, licence-clean route is a **self-recorded pose clip set** (owner's own face, posed per README row) run through the headless-browser smoke test (M2), with blendshapes dumped to JSON. That tests all 12 face memes including yaw/roll, and is the only route that covers them.
3. Optional follow-up: relabel-free sanity test using this CSV as a regression for `smile` only (needs the Kaggle licence resolved first).
4. Candidate small fix to examine in M3: `crying` and `side-eye` firing on neutral faces (14-25 %); needs a scoring comparison against the `stare` baseline 0.18.

## Sources
- MediaPipe blendshape model card (Apache 2.0): https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf
- HF dataset used: https://huggingface.co/datasets/SamerAttrah/FER2013_blendshapes_dataset_example_Partial ; paper https://arxiv.org/abs/2501.13432 ; code https://github.com/Samir-atra/Emotion_estimation_from_video_footage_with_LSTM_ML_algorithm
- CelebA terms: https://mmlab.ie.cuhk.edu.hk/projects/CelebA.html
- FER+ : https://github.com/Microsoft/FERPlus ; AFEW licence: https://users.cecs.anu.edu.au/~few_group/AFEW_Ver_4_2014_License.pdf ; Google FEC: https://exposing.ai/google_fec
- FER2013 licence claims: https://huggingface.co/datasets/imadhavan/FER2025/blob/main/data.json , https://hyper.ai/en/datasets/17027
