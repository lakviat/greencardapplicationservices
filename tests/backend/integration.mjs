// Real local Supabase Auth, Postgres, Storage and Edge Functions. No customer data.
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import jpeg from "jpeg-js";
import {
  initialDraft,
  fields,
  progress,
  FORM_VERSION,
} from "../../assets/preparation/schema.mjs";
import { COUNTRIES } from "../../assets/preparation/countries.mjs";
import { writeFileSync } from "node:fs";
import { localConfig } from "./local-config.mjs";
const config = localConfig();
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const check = (r) => {
  assert.equal(r.error, null, r.error?.message);
  return r.data;
};
const users = [];
async function makeUser() {
  const email = `synthetic-${randomUUID()}@example.test`,
    password = randomUUID() + "aA1!";
  const u = check(
    await admin.auth.admin.createUser({ email, password, email_confirm: true }),
  ).user;
  users.push(u);
  const client = createClient(config.API_URL, config.ANON_KEY, {
    auth: { persistSession: false },
  });
  const s = check(
    await client.auth.signInWithPassword({ email, password }),
  ).session;
  return { user: u, client, token: s.access_token };
}
async function call(who, route, body, query = "") {
  const image = body instanceof Uint8Array;
  const response = await fetch(
    `${config.API_URL}/functions/v1/gcas-api/${route}${query}`,
    {
      method: "POST",
      headers: {
        apikey: config.ANON_KEY,
        Authorization: `Bearer ${who.token}`,
        "Content-Type": image ? "image/jpeg" : "application/json",
      },
      body: image ? body : JSON.stringify(body),
    },
  );
  const data = ["image/jpeg", "application/pdf"].includes(
    response.headers.get("content-type"),
  )
    ? await response.arrayBuffer()
    : await response.json();
  return { status: response.status, data };
}
const a = await makeUser(),
  b = await makeUser(),
  id = randomUUID();
check(
  await admin.from("gcas_preparations").insert({
    id,
    owner_id: a.user.id,
    package: "single",
    version: FORM_VERSION.id,
    year: 2027,
  }),
);
assert.equal((await call(b, "get", { id })).status, 404);
assert.equal(
  (await call(a, "save", { id, revision: 0, payload: { documents: [] } }))
    .status,
  402,
);
const anon = createClient(config.API_URL, config.ANON_KEY, {
  auth: { persistSession: false },
});
assert((await anon.from("gcas_preparations").select()).error);
assert(
  (
    await a.client
      .from("gcas_preparations")
      .update({ state: "paid" })
      .eq("id", id)
  ).error,
);
assert((await a.client.rpc("gcas_payment", {})).error);
const order = check(
  await admin
    .from("gcas_orders")
    .insert({ preparation_id: id, amount: 999 })
    .select()
    .single(),
);
const event = {
  p_event: "evt_" + randomUUID(),
  p_type: "synthetic_local",
  p_order: order.id,
  p_session: "cs_" + randomUUID(),
  p_payment: "pi_" + randomUUID(),
  p_amount: 999,
  p_paid: true,
};
check(await admin.rpc("gcas_payment", event));
check(await admin.rpc("gcas_payment", event));
assert.equal(
  (await b.client.from("gcas_preparations").select().eq("id", id)).data.length,
  0,
);
assert.equal(
  (await a.client.from("gcas_preparations").select().eq("id", id)).data.length,
  1,
);
const d = { ...initialDraft(), id: randomUUID() };
d.answers["preparation.consent"] = true;
d.answers["entrant.lastName"] = "EXAMPLE";
let saved = await call(a, "save", {
  id,
  revision: 0,
  payload: { documents: [d] },
});
assert.equal(saved.status, 200, JSON.stringify(saved.data));
assert.equal(saved.data.preparation.revision, 1);
assert.equal(
  (await call(a, "save", { id, revision: 0, payload: { documents: [d] } }))
    .status,
  409,
);
assert.equal((await call(a, "pdf", { id })).status, 422);
const photo = jpeg.encode(
  { width: 600, height: 600, data: new Uint8Array(600 * 600 * 4).fill(255) },
  85,
).data;
assert.equal(
  (
    await call(
      b,
      "upload",
      photo,
      `?id=${id}&document=${d.id}&field=entrant.photo`,
    )
  ).status,
  404,
);
assert.equal(
  (
    await call(
      a,
      "upload",
      new Uint8Array([255, 216, 255, 0]),
      `?id=${id}&document=${d.id}&field=entrant.photo`,
    )
  ).status,
  400,
);
const uploaded = await call(
  a,
  "upload",
  photo,
  `?id=${id}&document=${d.id}&field=entrant.photo`,
);
assert.equal(uploaded.status, 200, JSON.stringify(uploaded.data));
d.assets["entrant.photo"] = {
  id: uploaded.data.id,
  status: "valid",
  confirmed: true,
};
assert.equal(
  (await call(b, "asset", { id, asset: uploaded.data.id })).status,
  404,
);
assert.equal(
  (await call(a, "asset", { id, asset: uploaded.data.id })).status,
  200,
);
const asset = check(
  await admin
    .from("gcas_assets")
    .select("*")
    .eq("id", uploaded.data.id)
    .single(),
);
assert(
  (await anon.storage.from("gcas-private").download(asset.object_path)).error,
);
d.answers["passport.path"] = "stateless";
d.answers["entrant.marital"] = "unmarried";
d.answers["eligibility.basis"] = "birth";
for (let i = 0; i < 3; i++)
  for (const f of fields(d)) {
    if (["photo", "passportPhoto"].includes(f.type)) continue;
    if (f.type === "checkbox") d.answers[f.id] = true;
    else if (!d.answers[f.id])
      d.answers[f.id] =
        f.type === "country"
          ? "Kyrgyzstan"
          : f.type === "select"
            ? f.options[0].value
            : f.type === "date"
              ? "1990-01-01"
              : f.type === "futureDate"
                ? "2030-01-01"
                : f.type === "email"
                  ? "synthetic@example.test"
                  : "EXAMPLE";
  }
assert.equal(
  progress(
    d,
    COUNTRIES.map((c) => c.name),
  ).remaining.length,
  0,
);
saved = await call(a, "save", { id, revision: 1, payload: { documents: [d] } });
assert.equal(saved.status, 200, JSON.stringify(saved.data));
const pdf = await call(a, "pdf", { id });
assert.equal(pdf.status, 200, JSON.stringify(pdf.data));
assert.equal(Buffer.from(pdf.data).subarray(0, 4).toString(), "%PDF");
writeFileSync("/tmp/gcas-backend-synthetic.pdf", Buffer.from(pdf.data));
assert.equal((await call(a, "email", { id })).status, 503);
check(
  await admin.rpc("gcas_payment", {
    ...event,
    p_event: "evt_" + randomUUID(),
    p_paid: false,
  }),
);
check(
  await admin.rpc("gcas_payment", { ...event, p_event: "evt_" + randomUUID() }),
);
assert.equal((await call(a, "pdf", { id })).status, 402);
assert.equal((await call(b, "delete", { id })).status, 404);
assert.equal((await call(a, "delete", { id })).status, 200);
assert.equal((await call(a, "get", { id })).status, 404);
assert(
  (await admin.storage.from("gcas-private").download(asset.object_path)).error,
);
const row = check(
  await admin.from("gcas_preparations").select("*").eq("id", id).single(),
);
assert.deepEqual(row.payload, { documents: [] });
assert.equal(row.state, "deleted");
// Expiry and cleanup operate on real private files, not only database metadata.
const expiring = randomUUID(),
  expiredAsset = randomUUID();
{
  check(
    await admin.from("gcas_preparations").insert({
      id: expiring,
      owner_id: a.user.id,
      package: "single",
      version: FORM_VERSION.id,
      year: 2027,
      state: "paid",
    }),
  );
  const objectPath = `${a.user.id}/${expiring}/${expiredAsset}.jpg`;
  check(
    await admin.storage
      .from("gcas-private")
      .upload(objectPath, photo, { contentType: "image/jpeg" }),
  );
  check(
    await admin.from("gcas_assets").insert({
      id: expiredAsset,
      preparation_id: expiring,
      document_id: d.id,
      field_id: "entrant.photo",
      object_path: objectPath,
      bytes: photo.length,
      width: 600,
      height: 600,
    }),
  );
  assert(
    (
      await admin.from("gcas_assets").insert({
        id: randomUUID(),
        preparation_id: expiring,
        document_id: d.id,
        field_id: "entrant.photo",
        object_path: "synthetic-quota-denied",
        bytes: 536870913,
        width: 600,
        height: 600,
      })
    ).error,
    "Storage capacity enforced inside the database lock",
  );
  const old = new Date(Date.now() - 172800000).toISOString();
  check(
    await admin
      .from("gcas_assets")
      .update({ created_at: old })
      .eq("id", expiredAsset),
  );
  check(
    await admin
      .from("gcas_preparations")
      .update({
        payload: {
          documents: [{ assets: { "entrant.photo": { id: expiredAsset } } }],
        },
      })
      .eq("id", expiring),
  );
  const orphan = randomUUID(),
    orphanPath = `${a.user.id}/${expiring}/${orphan}.jpg`;
  check(
    await admin.storage
      .from("gcas-private")
      .upload(orphanPath, photo, { contentType: "image/jpeg" }),
  );
  check(
    await admin
      .from("gcas_assets")
      .insert({
        id: orphan,
        preparation_id: expiring,
        document_id: d.id,
        field_id: "entrant.photo",
        object_path: orphanPath,
        bytes: photo.length,
        width: 600,
        height: 600,
        created_at: old,
      }),
  );
  execFileSync(process.execPath, ["scripts/backend-cleanup.mjs"], {
    env: {
      ...process.env,
      SUPABASE_URL: config.API_URL,
      SUPABASE_SECRET_KEY: config.SERVICE_ROLE_KEY,
    },
    stdio: "pipe",
  });
  assert(
    (await admin.storage.from("gcas-private").download(orphanPath)).error,
    "Abandoned upload removed",
  );
  assert.equal(
    (await admin.storage.from("gcas-private").download(objectPath)).error,
    null,
    "Saved image retained",
  );
  check(
    await admin
      .from("gcas_preparations")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", expiring),
  );
  assert.equal((await call(a, "get", { id: expiring })).status, 404);
  execFileSync(process.execPath, ["scripts/backend-cleanup.mjs"], {
    env: {
      ...process.env,
      SUPABASE_URL: config.API_URL,
      SUPABASE_SECRET_KEY: config.SERVICE_ROLE_KEY,
    },
    stdio: "pipe",
  });
  assert.equal(
    check(
      await admin
        .from("gcas_preparations")
        .select("state")
        .eq("id", expiring)
        .single(),
    ).state,
    "deleted",
  );
  assert((await admin.storage.from("gcas-private").download(objectPath)).error);
  check(await admin.from("gcas_preparations").delete().eq("id", expiring));
}
// Delete only these disposable local test fixtures.
check(await admin.from("gcas_orders").delete().eq("preparation_id", id));
check(await admin.from("gcas_preparations").delete().eq("id", id));
for (const u of users) check(await admin.auth.admin.deleteUser(u.id));
console.log(
  "PASS: real Auth, cross-account RLS/API/storage isolation, paid-only writes, idempotency, refund ordering, revision conflicts, malformed uploads, PDF, deletion.",
);
