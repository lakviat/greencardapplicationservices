import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, webcrypto } from "node:crypto";
import {
  sanitizePayload,
  plan,
  verifyStripeSignature,
} from "../../supabase/functions/gcas-api/core.mjs";
import { initialDraft } from "../../assets/preparation/schema.mjs";
const document = () => ({
  ...initialDraft(),
  id: randomUUID(),
  answers: { "preparation.consent": true, "entrant.lastName": "EXAMPLE" },
});
test("server owns prices and rejects Premium and prototype plan names", () => {
  assert.equal(plan("single").cents, 999);
  for (const key of ["premium", "__proto__", "constructor", "free"])
    assert.throws(() => plan(key));
});
test("save rejects forged assets, missing consent, extra worksheets and invalid versions", () => {
  const d = document();
  assert.equal(
    sanitizePayload({ documents: [d] }, "single").documents[0].answers[
      "entrant.lastName"
    ],
    "EXAMPLE",
  );
  d.assets["entrant.photo"] = { id: randomUUID() };
  assert.throws(
    () => sanitizePayload({ documents: [d] }, "single"),
    /does not belong/,
  );
  d.assets = {};
  assert.throws(() =>
    sanitizePayload({ documents: [d, document()] }, "single"),
  );
  d.answers["preparation.consent"] = false;
  assert.throws(
    () => sanitizePayload({ documents: [d] }, "single"),
    /permission/,
  );
  d.answers["preparation.consent"] = true;
  d.version = "old";
  assert.throws(() => sanitizePayload({ documents: [d] }, "single"), /version/);
});
test("save strips hidden answers and runtime image URLs and preserves legitimate asset identity", () => {
  const d = document(),
    asset = randomUUID();
  d.answers["spouse.firstName"] = "Hidden";
  d.assets["entrant.photo"] = {
    id: asset,
    url: "blob:private",
    confirmed: true,
  };
  const p = sanitizePayload({ documents: [d] }, "single", [
    {
      id: asset,
      document_id: d.id,
      field_id: "entrant.photo",
      width: 600,
      height: 600,
      bytes: 100,
    },
  ]);
  assert(!("spouse.firstName" in p.documents[0].answers));
  assert(!("url" in p.documents[0].assets["entrant.photo"]));
});
test("raw webhook signature rejects alteration, wrong secret, expiry; accepts key rotation signatures", async () => {
  const secret = "test-only",
    now = 1800000000000,
    stamp = Math.floor(now / 1000),
    raw = '{"id":"evt_synthetic"}';
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = Buffer.from(
    await webcrypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${stamp}.${raw}`),
    ),
  ).toString("hex");
  const header = `t=${stamp},v1=${"0".repeat(64)},v1=${sig}`;
  assert.equal(
    (await verifyStripeSignature(raw, header, secret, now)).id,
    "evt_synthetic",
  );
  await assert.rejects(verifyStripeSignature(raw + " ", header, secret, now));
  await assert.rejects(verifyStripeSignature(raw, header, "wrong", now));
  await assert.rejects(
    verifyStripeSignature(raw, header, secret, now + 301000),
  );
});
