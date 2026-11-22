import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? "";
const dir = (n) => csp.split(";").map((x) => x.trim().split(/\s+/)).find((d) => d[0] === n)?.slice(1) ?? [];

test("no-referrer meta present", () => assert.match(html, /<meta name="referrer" content="no-referrer">/));
test("connect-src limited to self, jsdelivr and model storage", () =>
  assert.deepEqual(dir("connect-src"), ["'self'", "https://cdn.jsdelivr.net", "https://storage.googleapis.com"]));
test("script-src allows wasm but not unsafe-eval/inline", () => {
  const s = dir("script-src");
  assert.ok(s.includes("'wasm-unsafe-eval'"));
  assert.ok(!s.includes("'unsafe-eval'") && !s.includes("'unsafe-inline'"));
});
test("every https origin the app code uses is allowed", () => {
  const allowed = csp.match(/https:\/\/[a-z.]+/g);
  for (const f of ["app.js"]) for (const o of readFileSync(new URL("../" + f, import.meta.url), "utf8").match(/https:\/\/[a-z.]+/g) ?? [])
    assert.ok(allowed.includes(o), o);
});
