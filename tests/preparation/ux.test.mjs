import test from "node:test";
import assert from "node:assert/strict";
import { parseMRZ, scanSuggestions } from "../../assets/preparation/mrz.mjs";
import { viewportGeometry } from "../../assets/preparation/viewport.mjs";
import {
  initialDraft,
  sections,
  fields,
  progress,
  preparationProgress,
  storedFields,
} from "../../assets/preparation/schema.mjs";
const first = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<";
const second = "L898902C36UTO7408122F1204159ZE184226B<<<<<10";
const now = new Date("2026-10-16T12:00:00Z");
test("TD3 validates document, date, optional and composite checksums independently", () => {
  const p = parseMRZ(first + "\n" + second, now);
  assert.equal(p.status, "checked");
  assert.equal(p.values.number, "L898902C3");
  assert.equal(p.values.birthDate, "1974-08-12");
  assert.equal(p.values.sex, "Female");
  for (const index of [0, 13, 21, 30, 43]) {
    const bad =
      second.slice(0, index) +
      (second[index] === "0" ? "1" : "0") +
      second.slice(index + 1);
    assert.equal(parseMRZ(first + "\n" + bad, now).status, "invalid");
  }
  assert.equal(
    parseMRZ(first + "\n" + second.slice(1), now).status,
    "unreadable",
  );
  assert.equal(
    parseMRZ("I<UTO" + "<".repeat(39) + "\n" + second, now).status,
    "unreadable",
  );
});
test("only checked MRZ values become suggestions and birth/eligibility are never inferred", () => {
  const bad = second.slice(0, 9) + "0" + second.slice(10);
  const parsed = parseMRZ(first + "\n" + bad, now);
  assert.equal(parsed.values.number, undefined);
  const values = scanSuggestions(
    {
      firstName: "ANNA MARIA",
      lastName: "ERIKSSON",
      middleName: "",
      country: "",
    },
    parseMRZ(first + "\n" + second, now),
    [],
  );
  assert.equal(values.country, "");
  assert.equal(values.eligibility, undefined);
  assert.equal(values.middleName, "");
  assert.equal(values.issuer, "UTO");
  assert(!("text" in values));
  assert(!("mrz" in values));
  const kyrgyz = scanSuggestions(
    { country: "" },
    { ...parsed, values: { issuerCode: "KGZ", nationalityCode: "KGZ" } },
  );
  assert.equal(kyrgyz.issuer, "Kyrgyzstan");
  assert.equal(kyrgyz.country, "");
  assert.equal(kyrgyz.eligibility, undefined);
});
test("checked OCR digit substitutions remain explicit and ambiguous centuries remain blank", () => {
  const corrected = parseMRZ(
    first + "\n" + second.slice(0, 13) + "74O8I2" + second.slice(19),
    now,
  );
  assert.equal(corrected.status, "checked");
  assert.equal(corrected.values.birthDate, "1974-08-12");
  assert(corrected.issues.some((i) => i.includes("substitutions")));
  // In 2075 both 1974 and 2074 are plausible dates of birth, so do not guess.
  const ambiguous = parseMRZ(
    first + "\n" + second,
    new Date("2075-10-16T12:00:00Z"),
  );
  assert.equal(ambiguous.values.birthDate, "");
  assert(ambiguous.issues.some((i) => i.includes("century is ambiguous")));
});
test("page numbers are continuous for every family and passport visibility combination", () => {
  for (const married of ["", "married", "married-us"])
    for (const n of [0, 1, 5]) {
      const d = initialDraft();
      d.answers["entrant.marital"] = married;
      d.childIds = Array.from({ length: n }, (_, i) => String(i));
      const pages = [...new Set(sections(d).map((s) => s.page))];
      assert.deepEqual(
        pages,
        pages.map((_, i) => i + 1),
      );
    }
});
test("progress counts applicable family, images and passport fields only; related worksheet is explicit", () => {
  const d = initialDraft();
  const base = progress(d);
  d.answers["entrant.marital"] = "married";
  const married = progress(d);
  assert(married.total > base.total);
  d.answers["spouse.firstName"] = "ALEX";
  d.answers["entrant.marital"] = "married-us";
  assert(!fields(d).some((f) => f.id.startsWith("spouse.")));
  assert(storedFields(d).some((f) => f.id === "spouse.firstName"));
  d.answers["passport.path"] = "passport";
  const passport = progress(d).total;
  d.answers["passport.samePage"] = true;
  assert.equal(progress(d).total, passport - 1);
  d.answers["passport.path"] = "stateless";
  assert(!fields(d).some((f) => f.id === "passport.bio"));
  d.secondEntry = true;
  assert(
    preparationProgress(d).remaining.some((x) => x.field.id === "secondEntry"),
  );
  const other = initialDraft();
  const combined = preparationProgress(d, other);
  assert.equal(combined.total, progress(d).total + progress(other).total);
  assert.equal(d.answers["eligibility.basis"], undefined);
});
test("viewport geometry adapts keyboard, offset, browser chrome and zoom without phone-specific heights", () => {
  assert.deepEqual(
    viewportGeometry({
      height: 390,
      top: 30,
      layoutHeight: 844,
      editing: true,
    }),
    { bottom: 424, height: 390, top: 30, typing: true },
  );
  assert.equal(
    viewportGeometry({ height: 780, layoutHeight: 844, editing: true }).typing,
    false,
  );
  assert.equal(
    viewportGeometry({
      height: 390,
      layoutHeight: 844,
      editing: true,
      scale: 2,
    }).typing,
    false,
  );
  assert.equal(
    viewportGeometry({ height: 390, layoutHeight: 844, editing: false }).typing,
    false,
  );
});
