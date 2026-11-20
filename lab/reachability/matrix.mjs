// Hand state x face expression: which meme wins at steady state (ema == score, threshold .35, stare floor .18).
// Expressions are set at the "hi" end of each meme's own ramp (a clear but ordinary expression).
import { MEMES } from "../../memes.js";
const base = { face:1,jawOpen:0,eyeWide:0,blink:0,squint:0,smile:0,frown:0,browInnerUp:0,browUp:0,browDown:0,gazeSide:0,yaw:0,roll:0,
  thumbsUp:0,pointing:0,openPalm:0,twoPalms:0,fist:0,shaka:0,handAtChin:0,handsUp:0,anyHand:0 };
const FACES = {
  neutral:{}, smile:{smile:.8}, bigsmile_open:{smile:.8,jawOpen:.5}, pop:{jawOpen:.7}, yell_angry:{jawOpen:.5,browDown:.6},
  sad:{browInnerUp:.6,frown:.45}, wide_eyes:{eyeWide:.6}, smug:{squint:.6,smile:.55}, blink:{blink:.8}, tilt:{roll:24,browUp:.5}, turn:{yaw:.6},
};
const HANDS = { none:{}, thumbsUp:{thumbsUp:1}, shaka:{shaka:1}, fist:{fist:1}, point:{pointing:1}, palm:{openPalm:1}, twoPalms:{openPalm:1,twoPalms:1}, chin_fist:{fist:0,handAtChin:1}, handsUp:{handsUp:1,openPalm:1,twoPalms:1} };
const ids = (f) => { const sc = MEMES.map(m => [m.id, m.score(f)]).sort((a,b)=>b[1]-a[1]); return sc[0][1] < .35 ? "stare" : sc[0][0]; };
const rows = [];
for (const [hn, h] of Object.entries(HANDS)) {
  const r = { hand: hn };
  for (const [fn, fe] of Object.entries(FACES)) { const f = { ...base, ...fe, ...h }; f.anyHand = hn === "none" ? 0 : 1; r[fn] = ids(f); }
  rows.push(r);
}
console.table(rows);
// How often does the hand meme survive a face expression?
for (const [hn, h] of Object.entries(HANDS)) { if (hn === "none") continue;
  const own = ids({ ...base, ...h, anyHand:1 }); let keep = 0, n = 0;
  for (const [fn, fe] of Object.entries(FACES)) { n++; if (ids({ ...base, ...fe, ...h, anyHand:1 }) === own) keep++; }
  console.log(`${hn}: neutral-face meme=${own}, kept under ${keep}/${n} expressions`); }
