import test from "node:test";
import assert from "node:assert/strict";
import { initialDraft } from "../../assets/preparation/schema.mjs";
import { spouseWorksheet } from "../../assets/preparation/household.mjs";
test("separate principal requires a listed spouse and explicit household reuse", () => {
  const d = initialDraft();
  assert.throws(() => spouseWorksheet(d));
  d.answers["entrant.marital"] = "married";
  d.answers["entrant.firstName"] = "JANE";
  d.answers["spouse.firstName"] = "ALEX";
  d.answers["entrant.noMiddleName"] = true;
  d.answers["contact.email"] = "jane@example.test";
  d.answers["eligibility.country"] = "Japan";
  d.answers["passport.number"] = "SYNTHETIC123";
  d.answers["preparation.consent"] = true;
  d.assets["entrant.photo"] = { status: "valid", confirmed: true };
  d.answers["address.city"] = "Tokyo";
  d.childIds = ["sample"];
  d.answers["child.sample.firstName"] = "SAM";
  assert.deepEqual(spouseWorksheet(d).answers, {});
  const other = spouseWorksheet(d, { reuse: true });
  assert.equal(other.answers["entrant.firstName"], "ALEX");
  assert.equal(other.answers["spouse.firstName"], "JANE");
  assert.equal(other.answers["spouse.noMiddleName"], true);
  assert.equal(other.answers["child.sample.firstName"], "SAM");
  assert.equal(other.answers["address.city"], "Tokyo");
  for (const key of [
    "contact.email",
    "passport.number",
    "eligibility.country",
    "preparation.consent",
  ])
    assert.equal(other.answers[key], undefined);
  assert.deepEqual(other.assets, {});
  other.childIds.push("second");
  other.answers["child.sample.firstName"] = "CHANGED";
  assert.deepEqual(d.childIds, ["sample"]);
  assert.equal(d.answers["child.sample.firstName"], "SAM");
  assert.equal(d.package, "single");
  assert.equal(other.package, "single");
});
