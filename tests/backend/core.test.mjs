import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, webcrypto } from "node:crypto";
import {
  sanitizePayload,
  plan,
  checkoutEmail,
  verifyStripeSignature,
} from "../../supabase/functions/gcas-api/core.mjs";
import {
  initialDraft,
  worksheetRows,
} from "../../assets/preparation/schema.mjs";
const document = () => ({
  ...initialDraft(),
  id: randomUUID(),
  answers: { "entrant.lastName": "EXAMPLE" },
});
test("server owns prices and rejects Premium and prototype plan names", () => {
  assert.equal(plan("single").cents, 999);
  for (const key of ["premium", "__proto__", "constructor", "free"])
    assert.throws(() => plan(key));
});
test("save rejects forged assets, extra worksheets and invalid versions", () => {
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
  d.version = "old";
  assert.throws(() => sanitizePayload({ documents: [d] }, "single"), /version/);
});
test("partial saves need no consent field and discard legacy consent answers", () => {
  for (const value of [undefined, false, true]) {
    const d = document();
    if (value !== undefined) d.answers["preparation.consent"] = value;
    const saved = sanitizePayload({ documents: [d] }, "single").documents[0];
    assert.deepEqual(saved.answers, { "entrant.lastName": "EXAMPLE" });
  }
  const documents = [document(), document()];
  assert.equal(sanitizePayload({ documents }, "family").documents.length, 2);
});
test("save preserves dormant answers but strips runtime image URLs and preserves legitimate asset identity", () => {
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
  assert.equal(p.documents[0].answers["spouse.firstName"], "Hidden");
  assert(!("url" in p.documents[0].assets["entrant.photo"]));
});
test("dormant spouse assets retain ownership checks and return only when applicable", () => {
  const d = document(),
    asset = randomUUID();
  d.answers["entrant.marital"] = "unmarried";
  d.answers["spouse.firstName"] = "ALEX";
  d.assets["spouse.photo"] = { id: asset, confirmed: true };
  const stored = {
    id: asset,
    document_id: d.id,
    field_id: "spouse.photo",
    width: 600,
    height: 600,
    bytes: 100,
  };
  assert.throws(
    () => sanitizePayload({ documents: [d] }, "single"),
    /does not belong/,
  );
  assert.throws(
    () =>
      sanitizePayload({ documents: [d] }, "single", [
        { ...stored, document_id: randomUUID() },
      ]),
    /does not belong/,
  );
  assert.throws(
    () =>
      sanitizePayload({ documents: [d] }, "single", [
        { ...stored, field_id: "entrant.photo" },
      ]),
    /does not belong/,
  );
  const saved = sanitizePayload({ documents: [d] }, "single", [stored])
    .documents[0];
  assert.equal(saved.assets["spouse.photo"].id, asset);
  assert(
    !worksheetRows(saved)
      .flatMap((s) => s.fields)
      .some((f) => f.id.startsWith("spouse.")),
  );
  saved.answers["entrant.marital"] = "married";
  assert.equal(
    worksheetRows(saved)
      .flatMap((s) => s.fields)
      .find((f) => f.id === "spouse.firstName").value,
    "ALEX",
  );
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

test("checkout prefills worksheet email without changing verified account identity", () => {
  assert.equal(
    checkoutEmail(" applicant@example.test ", "owner@example.test"),
    "applicant@example.test",
  );
  assert.equal(
    checkoutEmail(undefined, "owner@example.test"),
    "owner@example.test",
  );
  for (const value of [
    null,
    {},
    "invalid",
    "123 Example Street",
    "a@example.test\r\nBcc:x@y.test",
    "a".repeat(255) + "@example.test",
  ])
    assert.throws(
      () => checkoutEmail(value, "owner@example.test"),
      /valid worksheet email/,
    );
});
