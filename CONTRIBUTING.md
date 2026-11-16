# Contributing to kitty pose

kitty pose is a static web app: plain ES modules (`index.html`, `app.js`, `memes.js`, `cats.js`, `sw.js`,
`style.css`) served as-is by GitHub Pages from `master`. There is no build step and no server. Pose detection
(MediaPipe Face and Hand Landmarker) runs in the browser, and no camera frames leave the phone.

**Merging to `master` publishes the site.** Only the owner merges. Nothing merges automatically.

## Ground rules

- Keep it static: no bundler, no backend, no upload of video or images. Third-party code comes in only as pinned
  CDN imports (for example `@mediapipe/tasks-vision@0.10.14` in `app.js`).
- It must keep working on a 2024 iPhone in Safari with the front camera. Check UI changes in a mobile viewport
  (for example 390×844 in the browser's device mode).
- The meme photos in `assets/` belong to the owner. Do not replace or re-encode them.

## Branch naming

- Agent branches are named `claude/<slug>`, where the slug is short and kebab-case (for example
  `claude/add-contributing-v2`). One branch per task. Agents do not switch or reuse branches.
- Human branches can use any short descriptive name. Never commit directly to `master`.

## Commit messages

Follow the existing history (`git log --format='%s%n%b'`):

- The subject starts with the area, then a colon, then what changed, in lowercase and present tense.
  Separate related changes with commas or semicolons. For example:
  `kitty pose: meme photos per pose, new gestures (fist, shaka, two palms, side-eye, head turn, angry)`.
- Use the body when the reason is not obvious from the subject.
- Commits written with an agent end with a `Co-Authored-By:` trailer naming the model.
- Prefer small commits. Each commit should leave `npm test` passing.

## Pull requests

1. Run the same command as CI (`.github/workflows/test.yml`, Node 20, on every push and pull request):

   ```sh
   npm test
   ```

2. Open the PR against `master`. The description should say:
   - what changed and why
   - how you verified it: the `npm test` result, plus what you saw when you ran the app (which poses, which
     viewport or device)
   - the risks, and any follow-ups you did not do
3. CI must be green, and the owner must approve.
4. PRs are **squash merged**, so the PR title becomes the commit subject. Write it in the commit style above.
5. After each merge, the runner rebases the open agent PRs (`claude/*`) onto `master`. Keep PRs independent so
   these rebases stay clean.

## PR sizing

- One concern per PR: a new pose, a threshold retune, a UI fix, or a docs change. Do not combine them.
- Keep the diff under about 400 changed lines, not counting binary assets. Split anything larger into a series
  of PRs that each work on their own.

## Shared files

Many PRs touch these files, so keep them out of feature PRs unless the task is about them:

- `README.md`, `CLAUDE.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`. Put proposed edits in the PR description
  instead.
- Dependency lists (`package.json`, and `flake.nix`, `Cargo.toml` or `dune-project` if any are added) have one
  entry per line, sorted alphabetically. Today `package.json` has no dependencies, and the tests use only
  `node:test`.

Some files have to change together:

- New or renamed files under `assets/`, and new top-level `.js` or `.css` files, also go into the `SHELL` list in
  `sw.js`. Bump the cache name `V` (`kitty-vN`) there whenever shipped files change, so that installed copies
  update.
- A new meme with `img:` in `memes.js` needs that file in `assets/`. The test
  "photos exist for every meme that names one" checks this.

## Testing conventions

- Tests live in `test/*.test.js` and use only `node:test` and `node:assert/strict`. `npm test` runs
  `node --test`, so new files that match the pattern are picked up without any configuration.
- Test pure logic, not the camera. Use the synthetic landmarks in `test/memes.test.js`: `hand(ext, at, s)` builds
  a 21-point hand from a list of extended fingers, and `face` is a 478-point face with the landmarks `memes.js`
  reads.
- Each new gesture or meme gets a test showing that its pose wins (see "each pose picks its meme"). Add a negative
  case when it could be confused with an existing pose (see "thumbs up is not a fist").
- Every meme and palette must render a valid SVG ("every meme and palette renders an svg").
- Never edit a test just to make it pass. A failing test is evidence of a problem. Fix the code, or explain the
  spec change in the PR.

## Running the app

Camera access needs a secure context, and `localhost` counts as one:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Turn on **settings → show detection scores** to see the per-meme scores while you
tune thresholds. To test on a phone, use the deployed site, or serve over HTTPS on your LAN.

## Review rubric

Reviewers label each finding with a severity:

- **Critical**: it breaks the app, sends camera data off the device, or fails on iPhone Safari.
- **High**: a pose maps to the wrong meme, a regression in an existing gesture, the offline/PWA install breaks,
  or there are missing tests for new logic.
- **Medium / Low**: naming, structure, small UX polish, or nits.

Only Critical or High findings, or failing tests, block a merge. Medium and Low findings are optional, or can
become follow-up issues.

## Definition of done

- The app still loads as a static site. Nothing needs to be built or installed.
- `npm test` passes locally and in CI.
- The demo still runs: `python3 -m http.server 8000`, then the camera opens, a pose shows its meme, and the
  shutter makes the meme image. Check this in a mobile viewport.
- `sw.js` is updated if shipped files changed. Docs you touched are updated, and changes needed in shared docs
  are listed in the PR description.
