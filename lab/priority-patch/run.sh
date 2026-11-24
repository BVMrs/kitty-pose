#!/bin/sh
# Usage: sh run.sh  (needs the HaGRID test cache from demo/fetch-hagrid.mjs). Re-runs three earlier sims on memes-patched.js.
set -e; cd "$(dirname "$0")"
D=${HAGRID_DIR:-$HOME/.cache/agent-data/kitty-pose/hagrid-v2}/annotations/test
node make-patch.mjs; mkdir -p run
for d in mixed-hands hand-near-face hands-up; do for f in ../$d/sim.mjs; do sed 's#\.\./\.\./memes\.js#../memes-patched.js#' $f > run/$d.mjs; done; done
node run/mixed-hands.mjs $D > mixed-patched.txt; node run/hand-near-face.mjs $D > near-patched.txt; node run/hands-up.mjs $D > up-patched.txt
rm -rf run
