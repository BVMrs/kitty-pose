// Re-project HaGRID test hands (landmarks normalised to an image of assumed aspect A0) into a phone frame of aspect A,
// then score handFeatures as the app calls it (no aspect arg) vs aspect-corrected. Usage: node run.mjs <test dir>
import fs from "node:fs";
import { handFeatures } from "../../memes.js";
const dir = process.argv[2];
const MAP = { like: "thumbsUp", call: "shaka", fist: "fist", one: "pointing", palm: "openPalm", stop: "openPalm" };
const G = ["thumbsUp", "shaka", "fist", "pointing", "openPalm"];
const hands = [];
for (const fn of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const cls = fn.replace(".json", ""), j = JSON.parse(fs.readFileSync(`${dir}/${fn}`));
  for (const k in j) { const e = j[k]; e.labels.forEach((l, i) => { const h = e.hand_landmarks?.[i]; if (l === cls && h?.length === 21) hands.push([cls, h]); }); }
}
const pred = (h, a) => { const f = handFeatures([h], null, a); return G.find((g) => f[g]) || "none"; };
// true hand shape is isotropic: (x*A0, y). In a frame of aspect A the same hand fills a window of the same height, x' = x*A0/A
const proj = (h, A0, A) => h.map(([x, y]) => ({ x: (x * A0) / A, y }));
const rows = [];
for (const A0 of [4 / 3, 16 / 9]) for (const A of [9 / 16, 3 / 4, 1, 4 / 3, 16 / 9]) for (const mode of ["app(no aspect)", "corrected"]) {
  const n = {}, ok = {}; let un = 0, trig = 0;
  for (const [cls, h] of hands) {
    const p = pred(proj(h, A0, A), mode === "corrected" ? A : undefined);
    if (MAP[cls]) { n[MAP[cls]] = (n[MAP[cls]] || 0) + 1; if (p === MAP[cls]) ok[MAP[cls]] = (ok[MAP[cls]] || 0) + 1; }
    else if (cls !== "no_gesture" && !/dislike|three|peace|ok|rock|four|mute|grip|two|hand_heart|take_picture|timeout|point|holy|gun|call2|inverted|middle|xsign|thumb_index|little|stop_inverted|one$|palm/i.test(cls)) { /* skip look-alikes */ }
    else if (!MAP[cls]) { un++; if (p !== "none") trig++; }
  }
  rows.push({ A0: +A0.toFixed(2), A: +A.toFixed(2), mode, ...Object.fromEntries(G.map((g) => [g, +(ok[g] / n[g]).toFixed(3)])), trigAll: +(trig / un).toFixed(3) });
}
console.log(hands.length, "hands"); console.table(rows);
