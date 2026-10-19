import { test } from "node:test";
import assert from "node:assert/strict";
import { initialDraft, fields } from "../../assets/preparation/schema.mjs";
import {
  entryProgress,
  currentEntries,
} from "../../assets/preparation/entry-progress.mjs";

function completeDocument() {
  const d = initialDraft();
  Object.assign(d.answers, {
    "entrant.marital": "unmarried",
    "passport.path": "stateless",
    "eligibility.basis": "birth",
  });
  for (const field of fields(d)) {
    if (d.answers[field.id] !== undefined) continue;
    if (field.type === "photo")
      d.assets[field.id] = { status: "valid", confirmed: true };
    else
      d.answers[field.id] =
        field.type === "checkbox"
          ? true
          : field.type === "country"
            ? "United States"
            : field.type === "select"
              ? field.options[0].value
              : field.type === "date"
                ? "1990-01-01"
                : field.type === "email"
                  ? "synthetic@example.test"
                  : "TEST";
  }
  return d;
}

test("an empty entry never marks a stage complete or a PDF ready", () => {
  const p = entryProgress({
    state: "paid",
    payload: { documents: [initialDraft()] },
  });
  assert.equal(p.percent, 0);
  assert.equal(p.personal.done, false);
  assert.equal(p.family.done, false);
  assert.equal(p.pdfReady, false);
  assert.equal(entryProgress({ state: "paid" }).pdfReady, false);
});

test("three completed stages yield 75%; payment and official-link clicks cannot claim submission", () => {
  const payload = { documents: [completeDocument()] };
  const unpaid = entryProgress({ state: "unpaid", payload });
  assert.equal(unpaid.remaining, 0);
  assert.equal(unpaid.percent, 50);
  const paid = entryProgress({ state: "paid", payload });
  assert.equal(paid.personal.done, true);
  assert.equal(paid.family.done, true);
  assert.equal(paid.percent, 75);
  assert.equal(paid.pdfReady, true);
  assert.equal(paid.submissionReportedAt, null);
  const reported = entryProgress({
    state: "paid",
    payload,
    submission_reported_at: "2026-10-19T12:00:00Z",
  });
  assert.equal(reported.percent, 100);
  assert.equal(entryProgress({ state: "disputed", payload }).pdfReady, false);
});

test("conditional relatives, unconfirmed photos and expired passports remain pending", () => {
  const d = completeDocument();
  d.answers["entrant.marital"] = "married";
  d.secondEntry = true;
  const p = entryProgress({ state: "paid", payload: { documents: [d] } });
  assert.equal(p.family.done, false);
  assert.equal(p.pdfReady, false);
  d.answers["entrant.marital"] = "unmarried";
  assert.equal(
    entryProgress({ state: "paid", payload: { documents: [d] } }).pdfReady,
    true,
    "stale spouse request is ignored like the worksheet",
  );
  d.assets["entrant.photo"].confirmed = false;
  assert.equal(
    entryProgress({ state: "paid", payload: { documents: [d] } }).personal.done,
    false,
  );
});

test("the summary omits sensitive field values and the current meaningful entry wins over a blank retry", () => {
  const d = completeDocument();
  d.answers["passport.number"] = "PRIVATE-PASSPORT";
  const summary = entryProgress({
    state: "unpaid",
    payload: { documents: [d] },
  });
  assert(!JSON.stringify(summary).includes("PRIVATE-PASSPORT"));
  assert(!JSON.stringify(summary).includes("1990-01-01"));
  d.answers["entrant.noLastName"] = true;
  assert.equal(
    entryProgress({ payload: { documents: [d] } }).name,
    "TEST",
    "name exceptions hide dormant values",
  );
  const entries = [
    {
      id: "blank",
      year: 2027,
      updated_at: "2026-10-20",
      entry: { hasInformation: false },
    },
    { id: "current", year: 2027, updated_at: "2026-10-19", entry: summary },
    { id: "older", year: 2027, updated_at: "2026-10-18", entry: summary },
  ];
  assert.equal(currentEntries(entries)[0].id, "current");
  assert.equal(entries.length, 3, "sorting does not remove earlier records");
});
