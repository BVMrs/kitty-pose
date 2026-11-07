# meow mirror

Strike a pose, get the cat meme. Open it on your phone:
**https://bvmrs.github.io/kitty-pose/**

| Pose | Cat |
|---|---|
| mouth wide open, eyes wide | **AAAAAAAAA** |
| hand on your chin | **hmm.** |
| thumbs up, sad face | **it's fine. 👍** |
| both hands above your head | **YIPPEE** |
| open palm to the camera | **no.** |
| point with your index finger | **you.** |
| half-closed eyes, one-sided smile | **heh.** |
| head tilted, brows up | **huh?** |
| eyes closed | **zzz** |
| big smile | **content.** |

The shutter makes a 4:5 meme (you on top, the cat below, the caption across) and opens the share sheet.
Tap the cat to change its colour. In settings you can swap any cat for your own picture; it is stored on the
phone only.

## How it works

- [MediaPipe](https://ai.google.dev/edge/mediapipe) Face Landmarker (478 points + 52 expression scores) and Hand
  Landmarker (21 points per hand), running in the browser on the GPU. No server: the video never leaves the phone.
- `memes.js` turns those into features (jaw open, squint, head roll, thumbs-up, pointing, hand at chin, ...) and
  scores each meme 0..1. The winner is smoothed and must hold for ~0.2 s, so the cat doesn't flicker.
- `cats.js` draws every cat from parts (eyes, mouth, paws, extras): original art, no copyrighted meme photos.
- Installable (Share → Add to Home Screen) and offline after the first visit (`sw.js` caches the app and models).

Tune the thresholds with **settings → show detection scores**.

## Develop

No build step. Serve the folder over http(s) (camera access needs a secure context or localhost):

```sh
python3 -m http.server 8000      # http://localhost:8000
npm test                         # gesture and meme logic (node --test)
```
