# createChooser() fuzz: invariants hold, but state survives a stall (stale meme on the first frame after resume)

## Question
`createChooser()` (memes.js) is the app's pose→meme state machine. Does it hold its invariants under random, hostile
input (NaN/undefined features, duplicate and backwards timestamps, 20–60 s stalls)? Earlier labs covered its latency
(choose-dynamics) and landmark noise (jitter), not malformed time or features.

## Method
`lab/chooser-fuzz/fuzz.mjs` (seeded, Node 22): 2000 runs × 300 frames = 600 000 frames of piecewise-constant random
feature vectors (1–40-frame segments; 5 % no-face frames; 1 % NaN/undefined/Infinity features), dt 16–56 ms, with 1 %
20–60 s stalls, 1 % dt=0, 0.5 % dt=-50. Checks: current is a known id, `step()` return value equals "current changed",
every ema in [0,1], no throw. Plus deterministic probes. Output: `lab/chooser-fuzz/output.json`.

## Results
- **Robust:** 0 invalid ids, 0 ema out of range, 0 throws, 0 return-value mismatches over 600 000 frames and 21 458 switches. NaN/undefined/Infinity features are neutralised (`Number.isFinite` guard); backwards or zero dt cannot corrupt state.
- **Stale state across a stall (new):** `ema` is per-frame and `pending/pendingSince` are never aged. Probe: thumbs-up for 2 frames (pending set, not yet shown), 30 s stall, then ONE **neutral** frame → `step()` returns true and the app shows `thumbs`. Same with one thumbs frame. In the fuzz, 1 666 of 21 458 switches (7.8 %) happened on a frame that followed a >5 s gap, i.e. were decided by state from before the gap.
- **Real trigger in the app:** `visibilitychange` (app.js:276) only stops the loop and disables tracks; on return it calls `loop()` with the same chooser. So switching to another app mid-pose and coming back shows the old pose's meme (or flips to it) for the first frame(s), even if the user's face is now neutral. Same for the camera flip and any long inference stall. Cosmetic, but it is a visible glitch on every app-switch on a phone, and the snap button could capture it.
- Other probes: neutral→thumbs shows after 8 frames at 33 ms (≈ 260 ms, matches choose-dynamics); smile held then face lost reverts to default in 22 frames = 726 ms (the "0.6 s" in the comment is really ~0.73 s at 30 fps).

## What the planner should do next
1. Small fix in `createChooser`: if `now - lastNow` > ~500 ms or `<= 0`, clear `pending` and decay/zero `ema` (or expose `chooser.reset()` and call it from the visibility-resume and camera-flip paths). Add a test from probe P1.
2. Optionally make ema time-based (`a = 1-exp(-dt/τ)`) so smoothing does not depend on fps (already noted in choose-dynamics).
3. Keep `fuzz.mjs` as a regression property test (invariants only; it exits 0 today).

Sources: memes.js `createChooser`, app.js loop/visibility handlers (read at 1a3b829).
