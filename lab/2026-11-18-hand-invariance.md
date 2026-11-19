# handFeatures under rotation, mirroring, aspect ratio and malformed input

Date 2026-11-18. Track: d (harder tests), against `memes.js` on `agents/lab`. Code: `lab/hand-invariance/`.

## Question
M1 and M3 measure and tune `handFeatures()` on HaGRID. Do its hand features hold under conditions HaGRID
doesn't control but a phone does: a portrait frame, a tilted hand, a left hand, bad landmark input?

## Method
- `run.mjs`: a synthetic hand with the same geometry as `test/memes.test.js`, built in pixel space. It is rotated
  in 15° steps (24 angles), optionally mirrored, scaled, and normalised to x/W, y/H like MediaPipe output. Frames:
  1000², 720×1280 (9:16), 1280×960. Then a seeded fuzz of 2000 trials per kind (random, NaN, short arrays,
  undefined entries, Infinity, all-identical points). Each trial runs `faceFeatures` + `handFeatures` + every `MEMES.score`.
- `aspect.mjs`: an upright hand at six aspect ratios. It compares current code with a prototype where `d()` scales
  x by W/H (a patched copy made in memory and deleted afterwards; `memes.js` is untouched).

## Results
**1. Portrait frames break most hand gestures (the main finding).** `fingerState`/`handFeatures` measure
distances in normalised coordinates, which are anisotropic (x is per frame width, y per frame height). With an
upright hand, current code / aspect-corrected:

| frame | thumbsUp | openPalm | shaka | pointing | fist |
|---|---|---|---|---|---|
| 16:9 landscape | FAIL / ok | FAIL / ok | FAIL / ok | ok | ok |
| 4:3, 1:1, 3:4 | ok | ok | ok | ok | ok |
| 9:16 portrait | FAIL / ok | FAIL / ok | FAIL / ok | ok | ok |
| 9:19.5 | FAIL / ok | FAIL / ok | FAIL / ok | ok | ok |

`app.js:172` asks for 1280×720 ideal; an iPhone held upright usually returns 720×1280-class frames, so the
common case is the failing row. This is a synthetic hand and the real thumb geometry may differ, but the
mechanism is clear: the `thumb` test compares an x-dominated and a y-dominated distance. One line fixes it
(`Math.hypot((a.x-b.x)*aspect, a.y-b.y)`, aspect = videoWidth/videoHeight), and all 5 gestures pass at every ratio.
HaGRID images are mostly landscape-ish, so M1 numbers will not show this. M1 can't see it.

**2. Thumbs up is not rotation tolerant.** Thumbs up fires only from −50° to +75° from upright (square frame). The
test `h[4].y < h[2].y - size*0.35` uses absolute image y. The other four gestures work at all 24 angles (square
frame). Mirrored (left) hands behave symmetrically, so no handedness bug.

**3. Crashes on malformed input.** `handFeatures` throws `Cannot read properties of undefined` for short landmark
arrays (1516/2000 trials) and arrays with holes (1234/2000). `faceFeatures` throws when `lm` has fewer than 455
entries. NaN coordinates produce out-of-range scores in 300/44000 cases (scores are NaN, which then poison the
EMA in `app.js:80` permanently, since NaN*0.6 stays NaN). Random, identical-point and Infinity inputs: no throws and all scores in [0,1].
MediaPipe shouldn't emit these, but one bad frame would freeze the meme display with no recovery.

## What the planner should do next
- Make fixing 1 a small `fix` task before M3 tuning: add an aspect parameter to `handFeatures`, pass
  `video.videoWidth/video.videoHeight`, add a unit test with a 9:16 synthetic hand (and 16:9). The HaGRID eval
  must pass each image's real aspect or it will silently diverge from the app.
- M2's smoke clip should be portrait (390×844 viewport), since landscape hides this bug.
- Thumbs-up rotation tolerance: replace the y comparison with a direction test along wrist→middle-MCP; owner
  call on how much tilt to accept.
- Guard: `Number.isFinite` check per frame in the EMA update (or skip frames with <21 landmarks).

Related: [threshold-sweep](2026-11-18-threshold-sweep.md) and [hagrid-baseline](2026-11-18-hagrid-baseline.md)
used HaGRID landmarks without per-image aspect correction; their recall numbers are therefore in the
"landscape-ish" regime only.
