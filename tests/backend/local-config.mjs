import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

// An optional separate CLI workspace keeps parallel frontend/backend tests isolated.
export function localConfig() {
  const args = ["supabase", "status", "-o", "json"];
  if (process.env.GCAS_TEST_WORKDIR)
    args.push("--workdir", process.env.GCAS_TEST_WORKDIR);
  const raw = execFileSync("npx", args, { encoding: "utf8" });
  const config = JSON.parse(raw.slice(raw.indexOf("{")));
  assert.equal(new URL(config.API_URL).hostname, "127.0.0.1");
  assert.equal(new URL(config.MAILPIT_URL).hostname, "127.0.0.1");
  return config;
}
