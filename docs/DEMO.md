Status: partial — the app runs in the browser; the M1 HaGRID fetch and gesture eval run (no `--check` thresholds yet).

```sh
node demo/fetch-hagrid.mjs        # HaGRIDv2 test annotations (~105 MB) into ~/.cache/agent-data/kitty-pose/hagrid-v2
node demo/eval-hagrid.js          # handFeatures() on 201k real hands: recall, precision, false triggers (~12 s)
python3 -m http.server 8000       # then open http://localhost:8000 (camera needs localhost or HTTPS)
```

## The app
Serve the folder, open it on a phone-sized viewport (or a 2024 iPhone over HTTPS), allow the camera, and make a pose:
the matching cat meme appears. Everything runs on the device (MediaPipe in the browser); nothing is uploaded.

## HaGRID data for the M1 gesture eval
`demo/fetch-hagrid.mjs` fetches the test split of the HaGRIDv2 annotations with MediaPipe hand landmarks
(Kapitanov et al., "HaGRID – HAnd Gesture Recognition Image Dataset", WACV 2024, https://github.com/hukenovs/hagrid;
CC BY-SA 4.0 variant). Only v2 has `hand_landmarks`.

- It reads the remote zip's central directory and downloads only `annotations/test/*.json` with HTTP Range requests
  (about 105 MB of the 719 MB zip), skipping `.ipynb_checkpoints/`, and checks each file's CRC-32.
- It writes `annotations/test/<class>.json` (34 classes) and `SHA256SUMS` to `$HAGRID_DIR`, default
  `~/.cache/agent-data/kitty-pose/hagrid-v2/`. Nothing goes into the repo.
- The sha256 of `SHA256SUMS` is pinned in the script. On a mismatch it prints expected vs got, writes nothing, and exits 1.
- When the cached files already match, it downloads nothing.

Measured 2026-11-22: 105,072,185 bytes fetched in 14.6 s, 34 files, 594 MB on disk; second run 1.3 s, no download.
Options: `--dest DIR`, `--url URL`, `--expect SHA256`, `--no-verify` (to compute a new pin).

## M1 gesture eval
`node demo/eval-hagrid.js [--dir DIR] [--json]` runs `handFeatures()` from `memes.js`, unchanged, on every HaGRIDv2
test hand that has 21 landmarks. The prediction is the first of thumbsUp, shaka, fist, pointing, openPalm that fires,
else none. Each of the 34 HaGRID classes is in exactly one group:

- **mapped** (charter): like→thumbsUp, call→shaka, fist→fist, one→pointing, palm and stop→openPalm. Recall and precision.
- **look-alike (ambiguous)**: dislike, xsign, grip, grabbing→fist; point, thumb_index, thumb_index2, take_picture,
  mute, three_gun→pointing; little_finger→shaka; stop_inverted, timeout, holy, hand_heart, hand_heart2→openPalm.
  A landmark rule cannot tell these from a mapped gesture, so firing on them is printed but **not** counted as a false trigger.
- **distinct (should fire none)**: four, middle_finger, ok, peace, peace_inverted, rock, three, three2, three3, two_up,
  two_up_inverted. Their trigger rate is the **false-trigger rate**.
- **no_gesture**: its own line. It is what the app sees between poses, but the test split has only 607 such hands.

Measured 2026-11-22 (24,772 hands skipped for lack of landmarks; 11.7 s):

| gesture | class | n | recall | precision |
|---|---|---|---|---|
| thumbsUp | like | 4940 | 0.849 | 0.838 |
| shaka | call | 4936 | 0.537 | 0.640 |
| fist | fist | 4877 | 0.945 | 0.196 |
| pointing | one | 4943 | 0.989 | 0.154 |
| openPalm | palm+stop | 9970 | 0.503 | 0.235 |

False triggers: distinct gestures 5.0 % (2,702 of 54,404), no_gesture 56.8 % (345 of 607), both together 5.5 %
(3,047 of 55,011), and every unmapped class including look-alikes 43.3 % (63,349 of 146,205). These match
`lab/2026-11-18-hagrid-baseline.md` on the `agents/lab` branch. Precision counts fires on all other classes,
look-alikes included, so it is low for fist and pointing.
