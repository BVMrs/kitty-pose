Status: partial — the app runs in the browser; the M1 HaGRID data fetch works, the gesture eval is not written yet.

```sh
node demo/fetch-hagrid.mjs        # HaGRIDv2 test annotations (~105 MB) into ~/.cache/agent-data/kitty-pose/hagrid-v2
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
