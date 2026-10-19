import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";

// The local Kong gateway intercepts OPTIONS before Edge Functions. Exercise the
// actual production HTTP wrapper directly, including both allowed/denied origins.
const source = readFileSync("supabase/functions/gcas-api/index.ts", "utf8");
const wrapper = transformSync(source.slice(source.indexOf("Deno.serve(")), {
  loader: "ts",
}).code;
let handler,
  calls = 0;
vm.runInNewContext(wrapper, {
  Deno: { serve: (fn) => (handler = fn) },
  URL,
  Response,
  origins: new Set(["https://greencardapplicationservices.com"]),
  handle: async () => {
    calls++;
    return { preparations: [] };
  },
});
test("preflight permissions can be reused while every private response remains no-store", async () => {
  const request = (method, origin) =>
    new Request("https://api.example.test/gcas-api/list", {
      method,
      headers: { Origin: origin },
    });
  const preflight = await handler(
    request("OPTIONS", "https://greencardapplicationservices.com"),
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Max-Age"), "3600");
  assert.equal(
    preflight.headers.get("Access-Control-Allow-Origin"),
    "https://greencardapplicationservices.com",
  );
  assert.equal(calls, 0);
  const blocked = await handler(
    request("OPTIONS", "https://untrusted.example.test"),
  );
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(blocked.headers.get("Access-Control-Max-Age"), null);
  const privateResponse = await handler(
    request("POST", "https://greencardapplicationservices.com"),
  );
  assert.equal(calls, 1);
  assert.equal(privateResponse.headers.get("Cache-Control"), "no-store");
  assert.equal(privateResponse.headers.get("Vary"), "Origin");
});
