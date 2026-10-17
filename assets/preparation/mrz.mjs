import { COUNTRIES } from "./countries.mjs?v=20261017-workspace-v22";
import { PASSPORT_COUNTRIES } from "./passport-countries.mjs?v=20261017-workspace-v22";
// ICAO TD3 only. Checksums validate transcription, never identity or eligibility.
// Keep raw OCR/MRZ text out of drafts, analytics and storage.
const digit = (s) =>
  [...s].reduce(
    (sum, c, i) =>
      sum +
      (c === "<" ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55) *
        [7, 3, 1][i % 3],
    0,
  ) % 10;
const check = (value, checksum) =>
  /^\d$/.test(checksum) && digit(value) === Number(checksum);
const numeric = (s) =>
  s
    .replace(/[OQ]/g, "0")
    .replace(/I/g, "1")
    .replace(/B/g, "8")
    .replace(/S/g, "5");
function dateValue(s, kind, now) {
  if (!/^\d{6}$/.test(s)) return "";
  const yy = +s.slice(0, 2),
    month = s.slice(2, 4),
    day = s.slice(4, 6);
  const candidates = [1900, 2000, 2100]
    .map((c) => `${c + yy}-${month}-${day}`)
    .filter((value) => {
      const d = new Date(`${value}T12:00:00Z`);
      if (
        !Number.isFinite(d.getTime()) ||
        d.toISOString().slice(0, 10) !== value
      )
        return false;
      const year = d.getUTCFullYear(),
        current = now.getUTCFullYear();
      return kind === "birth"
        ? value <= now.toISOString().slice(0, 10) && year >= current - 120
        : year >= current - 20 && year <= current + 20;
    });
  return candidates.length === 1 ? candidates[0] : "";
}
export function parseMRZ(text, now = new Date()) {
  const lines = String(text)
    .toUpperCase()
    .split(/\r?\n/)
    .map((s) =>
      s.replace(/[«]/g, "<<").replace(/[‹]/g, "<").replace(/\s/g, ""),
    );
  // The name row is not checksummed. OCR often expands its trailing chevrons;
  // allow that narrow case only to locate the independently checked data row.
  // Never pad/truncate the data row or use this to alter suggested names.
  const first = lines.findIndex(
    (s) =>
      /^P[A-Z<][A-Z<]{3}[A-Z<]+<<[A-Z<]+$/.test(s) &&
      (s.length === 44 ||
        (s.length >= 40 && s.length <= 48 && /[<KL]{5,}$/.test(s))),
  );
  const empty = {
    status: "unreadable",
    checks: {},
    values: {},
    issues: [
      "A complete two-line passport MRZ was not read. Enter missing details manually.",
    ],
  };
  if (first < 0 || !/^[A-Z0-9<]{44}$/.test(lines[first + 1] || ""))
    return empty;
  const a = lines[first],
    original = lines[first + 1];
  let b = original;
  for (const [start, end] of [
    [9, 10],
    [13, 20],
    [21, 28],
    [42, 44],
  ])
    b = b.slice(0, start) + numeric(b.slice(start, end)) + b.slice(end);
  const checks = {
    number: check(b.slice(0, 9), b[9]),
    birth: check(b.slice(13, 19), b[19]),
    expiry: check(b.slice(21, 27), b[27]),
    personal:
      (b[42] === "<" && /^<+$/.test(b.slice(28, 42))) ||
      check(b.slice(28, 42), b[42]),
    composite: check(b.slice(0, 10) + b.slice(13, 20) + b.slice(21, 43), b[43]),
  };
  const valid = Object.values(checks).every(Boolean);
  const values = {};
  // Individual checked values remain suggestions even if another check fails.
  if (checks.number) values.number = b.slice(0, 9).replace(/<+$/, "");
  if (checks.birth) values.birthDate = dateValue(b.slice(13, 19), "birth", now);
  if (checks.expiry) values.expiry = dateValue(b.slice(21, 27), "expiry", now);
  if (valid) {
    values.sex = { M: "Male", F: "Female" }[b[20]] || "";
    values.issuerCode = a.slice(2, 5);
    if (/^[A-Z<]{3}$/.test(b.slice(10, 13)))
      values.nationalityCode = b.slice(10, 13);
  }
  const issues = [];
  if (a.length !== 44)
    issues.push(
      "OCR changed the name-row padding. Names require manual comparison; the separate data-row checks are unchanged.",
    );
  if (!valid)
    issues.push(
      "One or more MRZ checksums failed. Unchecked document details were left blank. Compare every suggestion with the image.",
    );
  if (b !== original)
    issues.push(
      "Possible OCR digit substitutions were checked. Verify the corrected digits against the image.",
    );
  if (checks.birth && !values.birthDate)
    issues.push(
      "The birth date or its century is ambiguous. Enter the full date manually.",
    );
  if (checks.expiry && !values.expiry)
    issues.push(
      "The expiration date is ambiguous. Enter the full date manually.",
    );
  return { status: valid ? "checked" : "invalid", checks, values, issues };
}
export function scanSuggestions(printed, mrz) {
  const issuer =
    COUNTRIES.find((c) => c.code === PASSPORT_COUNTRIES[mrz.values.issuerCode])
      ?.name ||
    mrz.values.issuerCode ||
    "";
  return {
    ...printed,
    ...mrz.values,
    issuer,
    // Country of birth is accepted only from a printed birth-place label.
    country: printed.country || "",
    mrzStatus: mrz.status,
    issues: mrz.issues,
    confidence: {
      names: "review",
      birthDate: mrz.checks.birth ? "checked" : "missing",
      number: mrz.checks.number ? "checked" : "missing",
      expiry: mrz.checks.expiry ? "checked" : "missing",
    },
  };
}
