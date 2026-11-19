# Timing and flicker of the meme chooser (`choose()` in app.js), simulated

Date 2026-11-19. Track: b (simulation). Code: `lab/choose-dynamics/sim.mjs`, output in `output.txt`.

## Question
README and CHARTER say a pose switches the cat "within about 0.2 s". The M1 HaGRID numbers are per image.
They say nothing about what the user sees over time. Given the EMA (0.6/0.4), the 0.35 floor, the +0.08 margin
and the 220 ms / 600 ms dwell in `choose()`, how long does a switch take, how fast does it return to the default,
and how does it behave when the detector drops frames?

## Method
`choose()` is copied line for line into a standalone simulation (`app.js` imports a CDN URL and touches the DOM, so it
can't be imported in node). Three memes are modelled: `stare` (raw 0.18 with a face), `A` and `B`. Time is a
fake clock and the random numbers are seeded. Scenarios: (1) the raw score steps 0→1 and back, at 8, 15, 30 and 60 fps;
(2) a held pose with detector misses, iid or in bursts of mean 5 frames, hit rate 0.5–0.95, 200 runs per cell;
(3) a noisy continuous score (a face blendshape near a ramp edge); (4) A→B transitions with and without a gap.
Limits: raw scores are synthetic, and the real detector's miss pattern is unknown, so burst length is a guess.
It doesn't measure real MediaPipe latency, which M2 would have to.

## Results
1. **Switch latency is about 235–270 ms, not 200 ms, and does not improve with fps.** 8 fps: 250 ms,
   15 fps: 267, 30 fps: 233, 60 fps: 233. The 220 ms dwell timer dominates, and the EMA adds only about two frames
   (the score crosses 0.35 on frame 2: 0.4, 0.64). Only the dwell or the EMA could make it faster.
2. **Return to the default cat takes 650–875 ms** after the pose is released (600 ms dwell plus EMA decay:
   0.6^n·1 < 0.18, about 4 frames). At low fps it is slower (875 ms at 8 fps). That is deliberate hysteresis,
   but it makes the app feel sticky when the user is already making the next pose, though A→B switches don't wait for it (4).
3. **Dropouts are mostly absorbed.** With iid misses even a 50 % hit rate shows the right meme 100 % of the time.
   With bursts of ~5 frames, shown-time is 99 % at p=.85, 96 % at p=.70 and 92 % at p=.5 at 15 fps, with
   0.07–0.29 flickers per 3 s hold. At 30 fps and p=.5 with bursts, 4 of 200 runs never showed the meme in 3 s
   (first show 600 ms median). So the chooser tolerates the per-image recall levels M1 measured (.5–.99),
   *if* misses are independent frame to frame. A user holding a shaka whose true recall is .54 gets a meme
   only if the misses are not pose-specific, and they will be: the same hand shape fails every frame. Per-frame
   hit rate on a held pose is close to 0 or 1, not .54. **The HaGRID recall numbers therefore map to "works for
   most hands, never for some", not to a flaky meme.** That is a reason to prefer fixing thresholds (M3) over smoothing.
4. **Pose-to-pose transitions are clean:** A→B takes 233–267 ms from B appearing, and never passes through
   `stare` even with a 300 ms gap with no hand (the 600 ms stare dwell is not reached).
5. **Noisy face scores near a ramp edge do not flicker.** With the mean score 0.35 and σ up to 0.3, there are
   about 1.1 switches per 10 s (one switch on, then it stays). The +0.08 margin and the EMA hold it. Below a mean
   of 0.2 it never shows. The cost is that a score hovering at 0.35–0.45 holds a meme for as long as the user
   keeps the pose, with an 80 % duty cycle.

## What the planner should do next
- Charter wording: change "within about 0.2 s" to "about 0.25 s" (or lower the dwell). A measurement in M2 should assert a
  latency budget (say ≤ 400 ms at 15 fps including model time), not 200 ms.
- Owner call (not decided here): is a 600 ms return to the default wanted? The simulation shows 650 ms. Dropping the
  stare dwell to 400 ms gives about 450 ms. Keep it a tunable, not a bug.
- M3 should treat HaGRID recall as a per-hand-shape pass/fail, not as a flicker rate (result 3). The smoothing
  doesn't rescue shaka/open palm; the threshold sweep does.
- M2 smoke test should log the time from fed-clip pose onset to the `#caption` change, to turn this
  simulation into a measurement (the fake-camera clip is the only way to get a real miss pattern).
