import assert from "node:assert/strict";
import fs from "node:fs";
import { PACKAGES } from "../assets/preparation/schema.mjs";
const pages = [
  ...fs.readdirSync(".").filter((f) => f.endsWith(".html")),
  "policies/index.html",
];
const stale =
  /submission assistance|manual review included|human review included|authorize us to submit|confirmation after official submission|up to three applicants|October 18, 2026/i;
for (const file of pages) {
  const html = fs.readFileSync(file, "utf8");
  assert.match(html, /Content-Security-Policy/, file);
  assert.doesNotMatch(
    html,
    /\s(?:style|on\w+)\s*=|unsafe-inline/,
    file + " CSP",
  );
  assert.doesNotMatch(
    html,
    /buy\.stripe\.com|id="intakeForm"|data-dv-countdown/,
    file + " retired flow",
  );
  assert.doesNotMatch(html, stale, file + " obsolete service claim");
  assert.match(
    html,
    ["prepare.html", "auth-callback.html"].includes(file)
      ? /20261017-workspace-v24/
      : /20261016-workspace-v1/,
    file + " cache version",
  );
}
const prepare = fs.readFileSync("prepare.html", "utf8");
assert.doesNotMatch(
  prepare,
  /googletagmanager|google-analytics|site-metrics|assets\/app\.js|buy\.stripe/,
  "Preparation must have no marketing or legacy checkout code",
);
assert.match(prepare, /connect-src 'self'/);
assert.match(prepare, /no-referrer/);
assert.match(prepare, /noindex/);
const callback = fs.readFileSync("auth-callback.html", "utf8");
assert.match(callback, /no-referrer/);
assert.match(callback, /noindex/);
assert.match(callback, /connect-src 'none'/);
assert.doesNotMatch(
  callback,
  /googletagmanager|google-analytics|site-metrics|assets\/app\.js/,
);

for (const name of fs
  .readdirSync("assets/preparation")
  .filter((f) => f.endsWith(".mjs"))) {
  const source = fs.readFileSync("assets/preparation/" + name, "utf8");
  assert.doesNotMatch(
    source,
    /\.(?:innerHTML|outerHTML)\s*=|\beval\s*\(|document\.write\s*\(/,
    name + " unsafe DOM",
  );
  assert.doesNotMatch(
    source,
    /(?:localStorage|sessionStorage)\.(?:setItem|getItem)|indexedDB\.open/,
    name + " sensitive persistence",
  );
}
assert.deepEqual(
  Object.values(PACKAGES).map((p) => p.cents),
  [999, 1999, 2999, 3999],
);
assert(PACKAGES.premium.disabled);
const backend = fs.readFileSync("assets/preparation/backend.mjs", "utf8");
assert.match(backend, /persistSession:\s*false/);
assert.doesNotMatch(backend, /sb_secret_|sk_live_/);
assert.match(backend, /key\s*!==\s*"premium"/);
console.log(
  "Platform pages: obsolete flow removed; workspace privacy and server capability gates passed.",
);

for (const name of [
  "app.js",
  "requirements.js",
  "site-metrics.js",
  "passport-autofill.js",
]) {
  const source = fs.readFileSync("assets/" + name, "utf8");
  assert.doesNotMatch(
    source,
    /\beval\s*\(|document\.write\s*\(|\.innerHTML\s*=/,
    name + " unsafe DOM",
  );
}
const notify = fs
  .readFileSync("index.html", "utf8")
  .match(/<input\b[^>]*name="notifyMarketingConsent"[^>]*>/)?.[0];
assert(notify, "Notification marketing choice must remain separate");
assert.doesNotMatch(
  notify,
  /\s(?:required|checked)(?:\s|=|\/?>)/,
  "Marketing permission must be optional and unchecked",
);
