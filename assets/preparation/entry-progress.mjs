import {
  fields,
  progress,
  hasSpouse,
} from "./schema.mjs?v=20261019-workspace-v39";
import { COUNTRIES } from "./countries.mjs?v=20261019-workspace-v39";

const countries = COUNTRIES.map((country) => country.name);
const familyField = (field) =>
  field.section === "family" ||
  field.section === "spouse" ||
  field.id.startsWith("child.");

// Counts describe this saved worksheet, never eligibility or government acceptance.
// Summary responses contain no passport numbers, birth dates, answers or images.
export function entryProgress(preparation) {
  const documents = preparation.payload?.documents || [];
  const personal = { complete: 0, total: 0 };
  const family = { complete: 0, total: 0 };
  let remaining = 0;
  for (const document of documents) {
    const status = progress(document, countries);
    const missing = new Set(status.remaining.map(({ field }) => field.id));
    remaining += missing.size;
    for (const field of fields(document).filter((field) => field.required)) {
      const group = familyField(field) ? family : personal;
      group.total++;
      if (!missing.has(field.id)) group.complete++;
    }
  }
  if (!documents.length) {
    personal.total++;
    family.total++;
    remaining += 2;
  }
  if (
    documents[0]?.secondEntry &&
    hasSpouse(documents[0]) &&
    documents.length < 2
  ) {
    family.total++;
    remaining++;
  }
  const complete = (group) => group.total > 0 && group.complete === group.total;
  const fraction = (group) => (group.total ? group.complete / group.total : 0);
  const pdfReady =
    documents.length > 0 && !remaining && preparation.state === "paid";
  const reported = preparation.submission_reported_at || null;
  const first = documents[0]?.answers || {};
  return {
    name:
      [
        first["entrant.noFirstName"] ? null : first["entrant.firstName"],
        first["entrant.noLastName"] ? null : first["entrant.lastName"],
      ]
        .filter((value) => typeof value === "string")
        .join(" ") || "Your preparation",
    hasInformation: documents.some((document) =>
      Object.values(document.answers || {}).some(
        (value) =>
          value === true || (typeof value === "string" && value.trim()),
      ),
    ),
    personal: { ...personal, done: complete(personal) },
    family: { ...family, done: complete(family) },
    remaining,
    pdfReady,
    submissionReportedAt: reported,
    percent:
      Math.floor(25 * fraction(personal) + 25 * fraction(family)) +
      (pdfReady ? 25 : 0) +
      (reported ? 25 : 0),
  };
}

// Empty retries must not displace a real entry. Older records remain recoverable.
export function currentEntries(preparations) {
  return [...preparations].sort(
    (a, b) =>
      b.year - a.year ||
      Number(!!b.entry?.hasInformation) - Number(!!a.entry?.hasInformation) ||
      String(b.updated_at).localeCompare(String(a.updated_at)),
  );
}
