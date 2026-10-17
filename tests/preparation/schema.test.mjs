import test from "node:test";
import assert from "node:assert/strict";
import {
  initialDraft,
  fields,
  sections,
  validate,
  progress,
  recommendPackage,
  PACKAGES,
  worksheetRows,
  FORM_VERSION,
} from "../../assets/preparation/schema.mjs";
import { COUNTRIES } from "../../assets/preparation/countries.mjs";
const countries = COUNTRIES.map((c) => c.name);
const field = (d, id) => fields(d).find((f) => f.id === id);
test("starts empty, Single, versioned, zero percent; all baseline groups present", () => {
  const d = initialDraft();
  assert.equal(d.package, "single");
  assert.equal(progress(d, countries).percent, 0);
  assert.equal(d.version, FORM_VERSION.id);
  for (const id of [
    "identity",
    "eligibility",
    "photo",
    "address",
    "contact",
    "education",
    "family",
    "passport",
  ])
    assert(sections(d).some((s) => s.id === id));
  for (const f of fields(d)) {
    assert(
      f.id && f.reference && f.section && f.pdfKey && f.effectiveYear === 2027,
    );
  }
});
test("names require real input or explicit absence; rejecting absence of every name", () => {
  const d = initialDraft();
  assert(validate(field(d, "entrant.middleName"), d));
  d.answers["entrant.noMiddleName"] = true;
  assert.equal(validate(field(d, "entrant.middleName"), d), "");
  d.answers["entrant.noLastName"] = true;
  d.answers["entrant.noFirstName"] = true;
  assert.match(validate(field(d, "entrant.lastName"), d), /At least one/);
});
test("date and contact checks reject impossible, future and mismatched values", () => {
  const d = initialDraft();
  for (const date of ["2025-02-29", "2026-13-01", "9999-01-01"]) {
    d.answers["entrant.birthDate"] = date;
    assert(validate(field(d, "entrant.birthDate"), d));
  }
  d.answers["entrant.birthDate"] = "2000-02-29";
  assert.equal(validate(field(d, "entrant.birthDate"), d), "");
  d.answers["contact.email"] = "one@example.test";
  d.answers["contact.emailConfirm"] = "two@example.test";
  assert(validate(field(d, "contact.emailConfirm"), d));
});
test("country facts are not automatically eligibility decisions", () => {
  const d = initialDraft();
  d.answers["entrant.birthCountry"] = "Kyrgyzstan";
  d.answers["eligibility.basis"] = "birth";
  d.answers["eligibility.country"] = "Japan";
  assert(validate(field(d, "eligibility.country"), d));
  d.answers["eligibility.basis"] = "spouse";
  assert(fields(d).some((f) => f.id === "eligibility.explanation"));
  assert(validate(field(d, "eligibility.explanation"), d));
  d.answers["address.country"] = "Not a country";
  assert(
    progress(d, countries).remaining.some(
      (x) => x.field.id === "address.country",
    ),
  );
});
test("marriage and arbitrary household sizes expand required fields on Single", () => {
  const d = initialDraft();
  const initial = fields(d).length;
  d.answers["entrant.marital"] = "married";
  d.childIds = Array.from({ length: 8 }, (_, i) => `child${i}`);
  assert.equal(sections(d).filter((s) => s.childId).length, 8);
  assert(fields(d).length > initial + 60);
  assert(fields(d).some((f) => f.id === "spouse.photo"));
  assert.equal(d.package, "single");
  d.answers["child.child0.firstName"] = "Sample";
  d.package = "family";
  d.package = "single";
  assert.equal(d.answers["child.child0.firstName"], "Sample");
  d.answers["entrant.marital"] = "married-us";
  assert(!fields(d).some((f) => f.id === "spouse.photo"));
});
test("recommendations do not mutate package or charge; prices stay fixed", () => {
  const d = initialDraft();
  d.secondEntry = true;
  assert.equal(recommendPackage(d), "single");
  d.answers["entrant.marital"] = "married";
  assert.equal(recommendPackage(d), "couple");
  d.childIds = ["one"];
  assert.equal(recommendPackage(d), "family");
  assert.equal(d.package, "single");
  assert.deepEqual(
    Object.values(PACKAGES).map((p) => p.cents),
    [999, 1999, 2999, 3999],
  );
  assert(PACKAGES.premium.disabled);
});
test("passport exemption and signature page conditions are explicit", () => {
  const d = initialDraft();
  d.answers["passport.path"] = "passport";
  assert(fields(d).some((f) => f.id === "passport.signature"));
  d.answers["passport.samePage"] = true;
  assert(!fields(d).some((f) => f.id === "passport.signature"));
  d.answers["passport.path"] = "stateless";
  assert(!fields(d).some((f) => f.id === "passport.number"));
  assert(fields(d).some((f) => f.id === "passport.explanation"));
});
test("photo technical pass without user visual confirmation is incomplete", () => {
  const d = initialDraft();
  d.assets["entrant.photo"] = { status: "valid", confirmed: false };
  assert(validate(field(d, "entrant.photo"), d));
  d.assets["entrant.photo"].confirmed = true;
  assert.equal(validate(field(d, "entrant.photo"), d), "");
  delete d.assets["entrant.photo"];
  assert(validate(field(d, "entrant.photo"), d));
});
test("PDF mapping covers every visible answer and excludes hidden conditional records", () => {
  const d = initialDraft();
  d.answers["entrant.lastName"] = "EXAMPLE";
  d.answers["spouse.firstName"] = "Hidden";
  const rows = worksheetRows(d).flatMap((s) => s.fields);
  assert.equal(rows.length, fields(d).length);
  assert.equal(rows.find((f) => f.id === "entrant.lastName").value, "EXAMPLE");
  assert(!rows.some((f) => f.value === "Hidden"));
});
test("a complete baseline reaches 100 only when all required information is present", () => {
  const d = initialDraft();
  d.answers["entrant.marital"] = "unmarried";
  d.answers["eligibility.basis"] = "birth";
  d.answers["passport.path"] = "stateless";
  for (const f of fields(d)) {
    if (!f.required || d.answers[f.id]) continue;
    d.answers[f.id] =
      f.type === "checkbox"
        ? true
        : f.type === "date"
          ? "2000-01-01"
          : f.type === "country"
            ? "Japan"
            : f.type === "select"
              ? f.options[0].value
              : f.type === "email"
                ? "sample@example.test"
                : "EXAMPLE";
    if (f.type === "photo")
      d.assets[f.id] = { status: "valid", confirmed: true };
  }
  assert.equal(progress(d, countries).percent, 100);
  delete d.assets["entrant.photo"];
  assert(progress(d, countries).percent < 100);
});
