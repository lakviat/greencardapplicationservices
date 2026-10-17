import { initialDraft, hasSpouse } from "./schema.mjs?v=20261017-workspace-v26";
// Explicitly called only after the adult confirms authority and asks to reuse
// factual household answers. Eligibility, passport and confirmation answers are
// never copied, inferred or treated as a government decision.
export function spouseWorksheet(source, { reuse = false } = {}) {
  if (!hasSpouse(source))
    throw new Error(
      "A listed spouse is needed to prepare a related principal worksheet.",
    );
  const next = initialDraft();
  next.secondEntry = true;
  next.package = source.package;
  if (!reuse) return next;
  const properties = [
    "firstName",
    "lastName",
    "middleName",
    "noFirstName",
    "noLastName",
    "noMiddleName",
    "sex",
    "birthDate",
    "birthCity",
    "birthCityUnknown",
    "birthCountry",
  ];
  for (const key of properties) {
    if (source.answers[`spouse.${key}`] !== undefined)
      next.answers[`entrant.${key}`] = source.answers[`spouse.${key}`];
    if (source.answers[`entrant.${key}`] !== undefined)
      next.answers[`spouse.${key}`] = source.answers[`entrant.${key}`];
  }
  next.answers["entrant.marital"] = "married";
  next.childIds = [...source.childIds];
  for (const [key, value] of Object.entries(source.answers))
    if (
      key.startsWith("address.") ||
      key.startsWith("child.") ||
      key === "contact.country"
    )
      next.answers[key] = value;
  return next;
}
