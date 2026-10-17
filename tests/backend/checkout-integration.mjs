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
import {
  PAYMENT_LINKS,
  checkoutDestination,
} from "../../assets/preparation/payment-links.mjs";
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
let handler,
  failStripe = false;
globalThis.Deno = {
  env: { get: (key) => env[key] },
  serve: (callback) => {
    handler = callback;
  },
};
const realFetch = globalThis.fetch,
  sessions = new Map(),
  users = [],
  ids = [],
  requests = [];
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.origin !== "https://api.stripe.com") {
    assert.equal(url.hostname, "127.0.0.1");
    return realFetch(input, init);
  }
  requests.push(url);
  assert.equal(
    init.method,
    "GET",
    "Existing payment links never create Stripe products, prices, links or sessions through the API",
  );
  if (failStripe)
    return Response.json({ error: { type: "api_error" } }, { status: 503 });
  if (url.pathname === "/v1/checkout/sessions") {
    assert(
      Object.values(PAYMENT_LINKS).some(
        (l) => l.id === url.searchParams.get("payment_link"),
      ),
    );
    return Response.json({
      data: [...sessions.values()].filter(
        (s) =>
          s.payment_link === url.searchParams.get("payment_link") &&
          s.created >= Number(url.searchParams.get("created[gte]")),
      ),
      has_more: false,
    });
  }
  const session = sessions.get(url.pathname.split("/").at(-1));
  assert(session, "Only known sessions are retrieved");
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
  const configuredKey = env.STRIPE_SECRET_KEY;
  env.STRIPE_SECRET_KEY = "pending";
  assert.equal(
    (
      await (
        await handler(
          new Request(config.API_URL + "/functions/v1/gcas-api/health"),
        )
      ).json()
    ).checkout,
    false,
    "A placeholder cannot advertise working checkout",
  );
  env.STRIPE_SECRET_KEY = configuredKey;
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
    return {
      ...u,
      token: check(await client.auth.signInWithPassword({ email, password }))
        .session.access_token,
    };
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
    const raw = JSON.stringify({
        id,
        type: "checkout.session.completed",
        data: { object: { id: session.id } },
      }),
      timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", env.STRIPE_WEBHOOK_SECRET)
      .update(timestamp + "." + raw)
      .digest("hex");
    const response = await handler(
      new Request(config.API_URL + "/functions/v1/gcas-api/webhook", {
        method: "POST",
        headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
        body: raw,
      }),
    );
    return { status: response.status, data: await response.json() };
  }
  function visit(url, plan, amount, tax = 0) {
    const s = {
      id: "cs_test_" + randomUUID(),
      created: Math.floor(Date.now() / 1000),
      status: "open",
      mode: "payment",
      livemode: false,
      payment_status: "unpaid",
      currency: "usd",
      amount_subtotal: amount,
      amount_total: amount + tax,
      total_details: {
        amount_tax: tax,
        amount_shipping: 0,
        amount_discount: 0,
      },
      client_reference_id: new URL(url).searchParams.get("client_reference_id"),
      payment_link: PAYMENT_LINKS[plan].id,
      metadata: {},
    };
    s.url = "https://checkout.stripe.com/c/pay/" + s.id;
    sessions.set(s.id, s);
    return s;
  }
  for (const [plan, amount, email, tax] of [
    ["single", 999, "unfinished", 0],
    ["couple", 1999, "", 0],
    ["family", 2999, "applicant@example.test", 213],
  ]) {
    const u = await user(),
      id = await draft(u, plan),
      body = { id, package: plan, contactEmail: email };
    const first = await call(u, "checkout", body);
    assert.equal(first.status, 200, JSON.stringify(first.data));
    const url = checkoutDestination(first.data.url);
    assert.equal(url.origin + url.pathname, PAYMENT_LINKS[plan].url);
    assert.equal(
      url.searchParams.get("prefilled_email"),
      email.includes("@") ? email : u.email,
    );
    const orderId = url.searchParams.get("client_reference_id");
    assert.notEqual(
      orderId,
      id,
      "Public reference maps to a server-owned order",
    );
    const order = check(
      await admin.from("gcas_orders").select("*").eq("id", orderId).single(),
    );
    assert.equal(order.preparation_id, id);
    assert.equal(order.amount, amount);
    let s = visit(url, plan, amount, tax);
    for (let n = 0; n < 7; n++)
      assert.equal(
        (await call(u, "checkout", body)).data.url,
        s.url,
        "Cancellation/retry reuses an existing hosted session without exhausting the new-order allowance",
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
    assert.equal((await event(s)).data.pending, true);
    assert.equal(
      (await call(u, "get", { id })).data.preparation.state,
      "unpaid",
    );
    s.status = "expired";
    const resumed = await call(u, "checkout", body);
    assert.equal(
      new URL(resumed.data.url).searchParams.get("client_reference_id"),
      orderId,
      "Expired sessions retain the same saved preparation and order",
    );
    s = visit(resumed.data.url, plan, amount, tax);
    s.status = "complete";
    s.payment_status = "paid";
    s.payment_intent = {
      id: "pi_" + randomUUID(),
      status: "succeeded",
      amount_received: amount + tax,
      latest_charge: { refunded: false, disputed: false, amount_refunded: 0 },
    };
    s.amount_subtotal++;
    assert.equal(
      (await event(s)).status,
      400,
      "Incorrect base prices cannot unlock a PDF",
    );
    s.amount_subtotal--;
    const realLink = s.payment_link;
    s.payment_link = "plink_unrelated";
    assert.equal(
      (await event(s)).status,
      400,
      "Unrelated payment links cannot unlock a preparation",
    );
    s.payment_link = realLink;
    const eid = "evt_" + randomUUID();
    assert.equal((await event(s, eid)).status, 200);
    assert.equal(
      (await event(s, eid)).status,
      200,
      "Duplicate webhooks are idempotent",
    );
    assert.equal((await call(u, "get", { id })).data.preparation.state, "paid");
    assert.equal(
      (await call(u, "pdf", { id })).status,
      422,
      "PDF completeness is independent of early payment",
    );
    assert.deepEqual(
      (await call(u, "checkout", body)).data,
      { paid: true },
      "Purchased preparations cannot start another payment",
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
    assert.equal(saved.status, 200);
    assert.equal(
      saved.data.preparation.state,
      "paid",
      "Edits preserve purchase",
    );
  }
  const oldOwner = await user(),
    oldId = await draft(oldOwner, "single");
  const oldOrder = check(
    await admin
      .from("gcas_orders")
      .insert({ preparation_id: oldId, amount: 999 })
      .select()
      .single(),
  );
  const oldSession = visit(
    new URL(PAYMENT_LINKS.single.url + "?client_reference_id=" + oldId),
    "single",
    999,
  );
  oldSession.payment_link = null;
  oldSession.metadata = { gcas_order: oldOrder.id };
  oldSession.status = "complete";
  oldSession.payment_status = "paid";
  oldSession.payment_intent = {
    id: "pi_" + randomUUID(),
    status: "succeeded",
    amount_received: 999,
    latest_charge: { refunded: false, disputed: false, amount_refunded: 0 },
  };
  assert.equal(
    (await event(oldSession)).status,
    200,
    "Previously issued checkout sessions still fulfill correctly",
  );
  assert.equal(
    (await call(oldOwner, "get", { id: oldId })).data.preparation.state,
    "paid",
  );
  const u = await user(),
    id = await draft(u, "single"),
    body = { id, package: "single" };
  failStripe = true;
  assert.equal((await call(u, "checkout", body)).status, 503);
  assert.equal((await call(u, "get", { id })).data.preparation.revision, 1);
  failStripe = false;
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
  const retry = await call(u, "checkout", body);
  assert.equal(retry.status, 200);
  assert.equal(
    new URL(retry.data.url).searchParams.get("client_reference_id"),
    stale.id,
    "Next-day retries reuse the existing order and existing Payment Link",
  );
  for (const bad of [
    "https://evil.example/",
    "https://checkout.stripe.com.evil.example/c/pay/test",
    "https://buy.stripe.com/unknown?client_reference_id=" + randomUUID(),
    PAYMENT_LINKS.single.url,
  ])
    assert.throws(() => checkoutDestination(bad));
  console.log(
    "PASS: existing Single/Couple/Family Payment Links, incomplete checkout, valid receipt fallback, server-owned order references, cancellation/retry/expiry reuse, ownership, signed webhook pending/paid/duplicate, strict link/base-price/tax validation, paid editing, no repeat checkout, outage/next-day recovery and destination allowlist (real local Auth/Postgres; simulated Stripe HTTP).",
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
