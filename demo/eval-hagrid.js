#!/usr/bin/env node
// M1 gesture eval: score handFeatures() from memes.js, unchanged, on HaGRIDv2 test-split hand landmarks.
//
// Dataset: HaGRIDv2, Kapitanov et al., "HaGRID - HAnd Gesture Recognition Image Dataset", WACV 2024,
// https://github.com/hukenovs/hagrid. Fetch it first with `node demo/fetch-hagrid.mjs`.
//
// Each of the 34 HaGRID classes falls into exactly one group:
//   - MAPPED: the class is one of our gestures (charter: like→thumbsUp, call→shaka, fist→fist, one→pointing,
//     palm/stop→openPalm). Scored for recall and precision.
//   - NONE: a distinct hand shape that should trigger no gesture. Its trigger rate is the false-trigger rate.
//   - AMBIGUOUS: a hand shape that a landmark rule cannot tell apart from a mapped gesture (e.g. dislike is a fist
//     with the thumb down). Firing on it is not a mistake, so it is not counted as a false trigger. Its rates are
//     still printed.
//   - no_gesture: reported on its own line (it is what the app sees between poses).
// Review (#32): the lab note's split (branch agents/lab) kept three_gun, little_finger and stop_inverted as
// look-alikes, which is the only split giving its 5.5 % (3,047 of 55,011). A landmark rule does not confuse the
// first two with a mapped gesture (thumb+index+middle is not a pointing finger; a pinky-only hand is not a shaka),
// and hiding them would mask a regression (e.g. a relaxed shaka thumb test firing on little_finger). So three_gun
// and little_finger are now distinct (should fire none). stop_inverted stays a look-alike: it is "stop" with the
// fingers down, and openPalm legitimately fires on it (4.9 %). The headline number therefore no longer equals
// the lab note's 5.5 %.
//
// Prediction for one hand: the first of GESTURES that handFeatures([hand], null) fires, else "none".
// Hands without 21 landmarks (MediaPipe failed on them) are skipped and counted.
//
// Usage: node demo/eval-hagrid.js [--dir DIR] [--json]
//   DIR defaults to <fetch-hagrid dest>/annotations/test ($HAGRID_DIR or ~/.cache/agent-data/kitty-pose/hagrid-v2).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handFeatures } from "../memes.js";
import { defaultDest } from "./fetch-hagrid.mjs";

export const GESTURES = ["thumbsUp", "shaka", "fist", "pointing", "openPalm"];
export const MAPPED = { like: "thumbsUp", call: "shaka", fist: "fist", one: "pointing", palm: "openPalm", stop: "openPalm" };
// class -> the mapped gesture it looks like to a landmark rule.
export const AMBIGUOUS = {
  dislike: "fist",          // thumb down, other fingers curled
  xsign: "fist",            // crossed forearms, closed hands
  grip: "fist",
  grabbing: "fist",
  point: "pointing",        // index out sideways (often read as fist)
  thumb_index: "pointing",  // L shape
  thumb_index2: "pointing",
  take_picture: "pointing", // thumb + index frame
  mute: "pointing",         // index on lips
  stop_inverted: "openPalm",// stop, fingers down (kept: it is "stop" turned over, and openPalm fires on it)
  timeout: "openPalm",      // flat hands in a T
  holy: "openPalm",         // palms together
  hand_heart: "openPalm",
  hand_heart2: "openPalm",
};
export const NONE = ["four", "little_finger", "middle_finger", "ok", "peace", "peace_inverted", "rock", "three", "three2",
  "three3", "three_gun", "two_up", "two_up_inverted"];
export const NO_GESTURE = "no_gesture";
export const ALL_CLASSES = [...Object.keys(MAPPED), ...Object.keys(AMBIGUOUS), ...NONE, NO_GESTURE].sort();

export function groupOf(cls) {
  if (cls in MAPPED) return "mapped";
  if (cls in AMBIGUOUS) return "ambiguous";
  if (NONE.includes(cls)) return "none";
  if (cls === NO_GESTURE) return "no_gesture";
  return null;
}

export function predict(hand) {
  const f = handFeatures([hand], null);
  return GESTURES.find((g) => f[g]) || "none";
}

// Confusion counts {class: {prediction: n}} from one parsed annotation file (HaGRIDv2 format:
// {id: {labels: [...], hand_landmarks: [[[x, y] x21] | [], ...]}}). Only boxes labelled with the file's class count.
export function countFile(cls, json, conf = {}, skip = { noLandmarks: 0 }) {
  for (const id in json) {
    const e = json[id], L = e.hand_landmarks || [];
    (e.labels || []).forEach((lab, i) => {
      if (lab !== cls) return;
      const h = L[i];
      if (!Array.isArray(h) || h.length !== 21) { skip.noLandmarks++; return; }
      const p = predict(h.map(([x, y]) => ({ x, y })));
      const row = (conf[cls] ||= {});
      row[p] = (row[p] || 0) + 1;
    });
  }
  return { conf, skip };
}

const sum = (row = {}) => Object.values(row).reduce((a, b) => a + b, 0);
const fired = (row = {}) => sum(row) - (row.none || 0);
const ratio = (a, b) => (b ? a / b : NaN);

export function score(conf) {
  const unknown = Object.keys(conf).filter((c) => !groupOf(c));
  if (unknown.length) throw new Error(`unknown HaGRID classes (add them to a group): ${unknown.join(", ")}`);
  const of = (g) => Object.keys(conf).filter((c) => groupOf(c) === g);
  const gestures = {};
  for (const g of GESTURES) {
    let n = 0, tp = 0, fp = 0;
    for (const [c, row] of Object.entries(conf)) {
      if (MAPPED[c] === g) { n += sum(row); tp += row[g] || 0; } else fp += row[g] || 0;
    }
    gestures[g] = { classes: Object.keys(MAPPED).filter((c) => MAPPED[c] === g), n, recall: ratio(tp, n),
      precision: ratio(tp, tp + fp) };
  }
  const rate = (classes) => {
    const n = classes.reduce((a, c) => a + sum(conf[c]), 0), t = classes.reduce((a, c) => a + fired(conf[c]), 0);
    return { n, triggered: t, rate: ratio(t, n) };
  };
  const perClass = (classes) => Object.fromEntries(classes.sort().map((c) => [c, { ...rate([c]), counts: conf[c] }]));
  const none = of("none"), amb = of("ambiguous"), ng = of("no_gesture");
  return {
    gestures,
    falseTrigger: { ...rate(none), classes: none.sort() },          // the headline number
    noGesture: rate(ng),
    noneWithNoGesture: rate([...none, ...ng]),                        // the lab note's 5.5 % used the old split (see header)
    allUnmapped: rate([...none, ...ng, ...amb]),                      // = the charter's literal "unmapped = none" (43 %)
    ambiguous: Object.fromEntries(Object.entries(perClass(amb)).map(([c, r]) => [c, { looksLike: AMBIGUOUS[c], ...r }])),
    none: perClass([...none]),
  };
}

export function evaluateDir(dir) {
  const conf = {}, skip = { noLandmarks: 0 };
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  for (const fn of files) countFile(fn.slice(0, -5), JSON.parse(readFileSync(join(dir, fn), "utf8")), conf, skip);
  const missing = ALL_CLASSES.filter((c) => !files.includes(`${c}.json`));
  return { dir, files: files.length, missing, skipped: skip.noLandmarks, conf, ...score(conf) };
}

const pct = (x) => (Number.isNaN(x) ? "  n/a" : `${(100 * x).toFixed(1).padStart(5)} %`);
const f3 = (x) => (Number.isNaN(x) ? "  n/a" : x.toFixed(3));

export function formatReport(r) {
  const out = [];
  out.push(`HaGRIDv2 test split: ${r.dir}`);
  out.push(`${r.files} class files, ${r.skipped} hands skipped (no 21 landmarks)` +
    (r.missing.length ? `, MISSING: ${r.missing.join(", ")}` : ""));
  out.push("", "Mapped gestures (precision counts fires on every other class, look-alikes included)");
  out.push("gesture    HaGRID class     n      recall  precision");
  for (const [g, s] of Object.entries(r.gestures)) {
    out.push(`${g.padEnd(10)} ${s.classes.join("+").padEnd(12)} ${String(s.n).padStart(6)}   ${f3(s.recall)}   ${f3(s.precision)}`);
  }
  const line = (label, x) => `${label.padEnd(44)} ${pct(x.rate)}  (${x.triggered} of ${x.n})`;
  out.push("", "False triggers (a hand that fires any gesture)");
  out.push(line(`distinct gestures (${r.falseTrigger.classes.length} classes)`, r.falseTrigger));
  out.push(line("no_gesture", r.noGesture));
  out.push(line("both together (lab note's 5.5 % was on the old split)", r.noneWithNoGesture));
  out.push(line("all unmapped incl. look-alikes (not scored)", r.allUnmapped));
  out.push("", `Look-alike (ambiguous) classes, not counted as false triggers (${Object.keys(r.ambiguous).length}):`);
  out.push("class          looks like   fires    n      top prediction");
  for (const [c, a] of Object.entries(r.ambiguous)) {
    const top = Object.entries(a.counts || {}).sort((x, y) => y[1] - x[1])[0] || ["-", 0];
    out.push(`${c.padEnd(14)} ${a.looksLike.padEnd(10)} ${pct(a.rate)} ${String(a.n).padStart(6)}   ${top[0]} ${top[1]}`);
  }
  out.push("", "Distinct-gesture classes (should fire none):");
  for (const [c, a] of Object.entries(r.none)) out.push(`${c.padEnd(16)} ${pct(a.rate)}  (${a.triggered} of ${a.n})`);
  return out.join("\n");
}

export function main(argv) {
  let dir = join(defaultDest(), "annotations", "test"), json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i];
    else if (argv[i] === "--json") json = true;
    else { console.error(`unknown option ${argv[i]}\nusage: node demo/eval-hagrid.js [--dir DIR] [--json]`); return 2; }
  }
  if (!existsSync(dir)) { console.error(`no HaGRID annotations in ${dir}; run: node demo/fetch-hagrid.mjs`); return 1; }
  const r = evaluateDir(dir);
  if (json) { const { conf, ...rest } = r; console.log(JSON.stringify({ ...rest, confusion: conf }, null, 1)); }
  else console.log(formatReport(r));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
