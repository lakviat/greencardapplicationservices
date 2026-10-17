// Actual API handler + local Auth/Postgres; only Stripe HTTP is simulated.
// No Stripe credential or real payment is used by this regression suite.
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";
import { initialDraft } from "../../assets/preparation/schema.mjs";

const config = localConfig();
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const check = (r) => {
  assert.equal(r.error, null, r.error?.message);
  return r.data;
};
const env = {
  SUPABASE_URL: config.API_URL,
  SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY,
  GCAS_AUTH_READY: "true",
  GCAS_CHECKOUT_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_" + "test_" + "synthetic".repeat(4),
  STRIPE_WEBHOOK_SECRET: "synthetic-webhook-only",
};
let handler;
globalThis.Deno = {
  env: { get: (key) => env[key] },
  serve: (callback) => {
    handler = callback;
  },
};
const realFetch = globalThis.fetch;
const sessions = new Map(),
  requests = [],
  users = [],
  ids = [];
let failStripe = false;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.origin !== "https://api.stripe.com") {
    assert.equal(url.hostname, "127.0.0.1", "No external service is called");
    return realFetch(input, init);
  }
  if (failStripe)
    return Response.json(
      { error: { message: "synthetic unavailable" } },
      { status: 503 },
    );
  if (init.method === "POST") {
    const params = new URLSearchParams(init.body);
    const key = init.headers["Idempotency-Key"];
    requests.push({ params, key });
    let session = [...sessions.values()].find((s) => s.key === key);
    if (!session) {
      session = {
        id: "cs_test_" + randomUUID(),
        key,
        status: "open",
        mode: "payment",
        livemode: false,
        payment_status: "unpaid",
        currency: "usd",
        amount_total: Number(
          params.get("line_items[0][price_data][unit_amount]"),
        ),
        client_reference_id: params.get("client_reference_id"),
        metadata: { gcas_order: params.get("metadata[gcas_order]") },
      };
      session.url = "https://checkout.stripe.com/c/pay/" + session.id;
      sessions.set(session.id, session);
    }
    return Response.json(session);
  }
  const session = sessions.get(url.pathname.split("/").at(-1));
  assert(session, "Only known checkout sessions are retrieved");
  return Response.json(session);
};
const dir = await mkdtemp(resolve("node_modules/.gcas-checkout-"));
try {
  await build({
    entryPoints: ["supabase/functions/gcas-api/index.ts"],
    outfile: resolve(dir, "handler.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
  });
  await import(pathToFileURL(resolve(dir, "handler.mjs")));
  async function user() {
    const email = `synthetic-${randomUUID()}@example.test`,
      password = randomUUID() + "aA1!";
    const u = check(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
    ).user;
    users.push(u.id);
    const client = createClient(config.API_URL, config.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = check(
      await client.auth.signInWithPassword({ email, password }),
    ).session.access_token;
    return { ...u, token };
  }
  async function call(u, route, body) {
    const response = await handler(
      new Request(config.API_URL + "/functions/v1/gcas-api/" + route, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + u.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
    return { status: response.status, data: await response.json() };
  }
  async function draft(u, plan) {
    const id = randomUUID();
    ids.push(id);
    assert.equal((await call(u, "draft", { id, package: plan })).status, 200);
    const d = initialDraft();
    d.id = randomUUID();
    d.package = plan;
    assert.equal(
      (await call(u, "save", { id, revision: 0, payload: { documents: [d] } }))
        .status,
      200,
    );
    return id;
  }
  async function event(session, id = "evt_" + randomUUID()) {
    const body = JSON.stringify({
      id,
      type: "checkout.session.completed",
      data: { object: { id: session.id } },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", env.STRIPE_WEBHOOK_SECRET)
      .update(timestamp + "." + body)
      .digest("hex");
    const response = await handler(
      new Request(config.API_URL + "/functions/v1/gcas-api/webhook", {
        method: "POST",
        headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
        body,
      }),
    );
    return { status: response.status, data: await response.json() };
  }
  for (const [plan, amount, email] of [
    ["single", 999, "unfinished"],
    ["couple", 1999, ""],
    ["family", 2999, "applicant@example.test"],
  ]) {
    const u = await user(),
      id = await draft(u, plan);
    const body = { id, package: plan, contactEmail: email };
    const first = await call(u, "checkout", body);
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.match(first.data.url, /^https:\/\/checkout.stripe.com\//);
    const { params, key } = requests.at(-1);
    assert.equal(
      params.get("line_items[0][price_data][unit_amount]"),
      String(amount),
    );
    assert.equal(
      params.get("customer_email"),
      email.includes("@") ? email : u.email,
    );
    assert.equal(
      params.get("success_url"),
      "https://greencardapplicationservices.com/payment-return.html?result=success",
    );
    assert.equal(
      params.get("cancel_url"),
      "https://greencardapplicationservices.com/payment-return.html?result=canceled",
    );
    assert.equal(params.get("client_reference_id"), id);
    assert(![...params.values()].some((v) => v.includes("passport")));
    assert(key.startsWith("gcas-"));
    const count = requests.length;
    for (let attempt = 0; attempt < 6; attempt++)
      assert.equal(
        (await call(u, "checkout", body)).data.url,
        first.data.url,
        "Existing Checkout remains reusable beyond the new-session rate allowance",
      );
    const again = await call(u, "checkout", body);
    assert.equal(
      again.data.url,
      first.data.url,
      "Cancellation/retry reuses open Stripe session",
    );
    assert.equal(
      requests.length,
      count,
      "Retry does not create a second payment",
    );
    const stranger = await user();
    assert.equal((await call(stranger, "checkout", body)).status, 409);
    assert.equal(
      (
        await call(u, "checkout", {
          ...body,
          package: plan === "single" ? "family" : "single",
        })
      ).status,
      409,
    );
    const s = [...sessions.values()].find((s) => s.url === first.data.url);
    assert.equal(
      (await event(s)).data.pending,
      true,
      "Pending payment never unlocks PDF",
    );
    assert.equal(
      (await call(u, "get", { id })).data.preparation.state,
      "unpaid",
    );
    s.status = "complete";
    s.payment_status = "paid";
    s.payment_intent = {
      id: "pi_" + randomUUID(),
      status: "succeeded",
      amount_received: amount,
      latest_charge: { refunded: false, disputed: false, amount_refunded: 0 },
    };
    const eventId = "evt_" + randomUUID();
    assert.equal((await event(s, eventId)).status, 200);
    assert.equal(
      (await event(s, eventId)).status,
      200,
      "Webhook duplicates are idempotent",
    );
    assert.equal((await call(u, "get", { id })).data.preparation.state, "paid");
    // PDF completion checks remain separate from payment permission.
    assert.equal((await call(u, "pdf", { id })).status, 422);
    const bought = await call(u, "checkout", body);
    assert.deepEqual(bought.data, { paid: true });
    assert.equal(
      requests.length,
      count,
      "Paid preparation cannot create another charge",
    );
    const d = initialDraft();
    d.id = randomUUID();
    d.package = plan;
    d.answers["entrant.firstName"] = "EDITED";
    const saved = await call(u, "save", {
      id,
      revision: 1,
      payload: { documents: [d] },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(
      saved.data.preparation.state,
      "paid",
      "Editing preserves purchase",
    );
  }
  const u = await user(),
    id = await draft(u, "single");
  const body = { id, package: "single" };
  failStripe = true;
  assert.equal((await call(u, "checkout", body)).status, 503);
  assert.equal(
    (await call(u, "get", { id })).data.preparation.revision,
    1,
    "Stripe outage preserves saved answers",
  );
  const stale = check(
    await admin
      .from("gcas_orders")
      .select("*")
      .eq("preparation_id", id)
      .single(),
  );
  check(
    await admin
      .from("gcas_orders")
      .update({ created_at: new Date(Date.now() - 86400000).toISOString() })
      .eq("id", stale.id),
  );
  failStripe = false;
  assert.equal(
    (await call(u, "checkout", body)).status,
    200,
    "Payment can retry after Stripe outage even on the next day",
  );
  assert.notEqual(requests.at(-1).params.get("metadata[gcas_order]"), stale.id);
  assert.equal(
    check(
      await admin
        .from("gcas_orders")
        .select("state")
        .eq("id", stale.id)
        .single(),
    ).state,
    "expired",
  );
  console.log(
    "PASS: actual checkout handler with local Auth/Postgres: incomplete Single/Couple/Family, server prices, email fallback, cancel/retry reuse, ownership, webhook pending/paid/duplicate, paid editing, no repeat charge and outage recovery (simulated Stripe HTTP).",
  );
} finally {
  for (const id of ids) {
    check(await admin.from("gcas_orders").delete().eq("preparation_id", id));
    check(await admin.from("gcas_preparations").delete().eq("id", id));
  }
  for (const id of users) check(await admin.auth.admin.deleteUser(id));
  globalThis.fetch = realFetch;
  delete globalThis.Deno;
  await rm(dir, { recursive: true, force: true });
}
