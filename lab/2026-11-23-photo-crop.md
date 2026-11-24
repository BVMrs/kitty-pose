# photo-crop: what the shared meme keeps of each cat photo

## Question
`snap()` (app.js ~L226) draws the meme photo with a centred cover-crop into a fixed 1080×675 band (aspect 1.6).
The photos have very different shapes (273² to 335×597). How much of each photo survives, how far is it upscaled,
and does the crop cut out the cat's face? (Earlier `snap-crop` covered only the camera half.)

## Method
`lab/photo-crop/crop.py <assets> [outdir]` repeats the same arithmetic (k = max(W/w, 675/h), centred window) on the 17 files
in `assets/` and writes a contact sheet (crop beside the full photo). I looked at the sheet by eye for the face.
No browser, so the canvas draw itself is unverified; the geometry is the code's own formula.

## Results
- Mean upscale 2.89×; worst: laugh-point 4.91× (220 px gif), hiss/point/think 3.96× (273 px), lookaway 3.6×, shocked/side-eye/smile/wizard 3.22×. Only crying/pop (1.5×) and fistbump (1.66×) are near native. Soft, blurry shared images are expected; the JPEG 0.92 quality setting is not the limit, source size is.
- Fraction of the photo kept: mean 57%, min 35% for the four 335×597 portraits (shocked, side-eye, smile, wizard), 44% lookaway, 47% stare, rest 56–92%.
- **shocked.jpg is the real defect:** the cat's startled face sits in the top third of the portrait; the centred window keeps the middle (a paw and fur) and the face is gone. So "wait what" shares a picture of a paw.
- side-eye keeps one eye and nose (reads, but the second eye is lost); wizard keeps hat and face but loses the arena backdrop; the others keep the face.

## What the planner should do next
1. Small feature/maintenance issue: add an optional focus point per meme (`fy`, 0..1 vertical, default .5) used by `snap()` and, for consistency, CSS `object-position` in the live card; set `shocked` to ~.15. Acceptance: for each photo the face centre lies inside the cropped window (testable in `test/crop.test.js` with a table of face-centre coordinates).
2. Optional: replace 220–273 px sources (laugh-point, hiss, point, think) with larger ones if licensing allows; otherwise accept softness.
3. Owner call (not decided here): whether `object-fit: cover` for the live card should match the share crop.

Reproduce: `python3 -I lab/photo-crop/crop.py assets .agent-work/crop`.
