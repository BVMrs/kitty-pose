# kitty pose

Strike a pose, get the cat meme. Open it on your phone:
**https://bvmrs.github.io/kitty-pose/**

| Pose | Meme |
|---|---|
| mouth wide open (O) | pop cat |
| eyes wide, mouth a little open | shocked cat |
| eyes wide, mouth closed | close-up stare |
| angry brows, teeth | hissing cat |
| sad face | crying cat |
| big smile / smug half-smile | smiling kitten / smug cat |
| eyes to the side / head turned away | side-eye / look-away |
| hand on chin | thinking cat |
| point (straight face / laughing) | "you." / laughing-pointing cat |
| fist (calm / yelling) | fist bump / angry fist |
| shaka 🤙 | shaka cat |
| both palms open | wizard cat |
| one palm, thumbs up, hands up, eyes closed, head tilt | drawn cats (no., it's fine, YIPPEE, zzz, huh?) |

The shutter makes a 4:5 meme (you on top, the cat below, the caption across) and opens the share sheet.
Tap the cat to change its colour. In settings you can swap any cat for your own picture; it is stored on the
phone only.

## How it works

- [MediaPipe](https://ai.google.dev/edge/mediapipe) Face Landmarker (478 points + 52 expression scores) and Hand
  Landmarker (21 points per hand), running in the browser on the GPU. No server: the video never leaves the phone.
- `memes.js` turns those into features (jaw open, squint, head roll, thumbs-up, pointing, hand at chin, ...) and
  scores each meme 0..1. The winner is smoothed and must hold for ~0.2 s, so the cat doesn't flicker.
- Meme photos live in `assets/`. `cats.js` draws a cat from parts (eyes, mouth, paws, extras) for poses without a photo.
- Installable (Share → Add to Home Screen) and offline after the first visit (`sw.js` caches the app and models).

Tune the thresholds with **settings → show detection scores**.

## Develop

No build step. Serve the folder over http(s) (camera access needs a secure context or localhost):

```sh
python3 -m http.server 8000      # http://localhost:8000
npm test                         # gesture and meme logic (node --test)
```
