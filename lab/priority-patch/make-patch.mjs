// Builds memes-patched.js from ../../memes.js by exact string edits (throws if the master source drifted).
import fs from "node:fs";
let s = fs.readFileSync(new URL("../../memes.js", import.meta.url), "utf8");
const rep = (a, b) => { if (!s.includes(a)) throw new Error("no match: " + a); s = s.replace(a, b); };
// 1. think: a thumbs-up / shaka / open palm held at chin level is not the thinker
rep("score: (f) => f.handAtChin * not(ramp(f.jawOpen, 0.2, 0.4)) * not(f.pointing) }",
    "score: (f) => f.handAtChin * not(ramp(f.jawOpen, 0.2, 0.4)) * not(f.pointing) * not(f.thumbsUp) * not(f.shaka) * not(f.openPalm) }");
// 2. single-hand memes need not(handsUp) (hands-up lab): fistbump, angry-fist, shaka, thumbs
rep("score: (f) => f.fist * not(ramp(f.jawOpen, 0.2, 0.4)) }", "score: (f) => f.fist * not(f.handsUp) * not(ramp(f.jawOpen, 0.2, 0.4)) }");
rep("score: (f) => f.fist * ramp(f.jawOpen, 0.2, 0.45) }", "score: (f) => f.fist * not(f.handsUp) * ramp(f.jawOpen, 0.2, 0.45) }");
rep("score: (f) => f.shaka }", "score: (f) => f.shaka * not(f.handsUp) }");
rep("score: (f) => f.thumbsUp }", "score: (f) => f.thumbsUp * not(f.handsUp) }");
// 3. fist only when no other gesture flag is set (mixed-hands lab), mirroring the pointing rule
rep("if (out.thumbsUp || out.shaka) out.pointing = 0;",
    "if (out.thumbsUp || out.shaka) out.pointing = 0;\n  if (out.thumbsUp || out.shaka || out.openPalm || out.pointing) out.fist = 0;");
fs.writeFileSync(new URL("./memes-patched.js", import.meta.url), s);
