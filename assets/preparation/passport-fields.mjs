import { COUNTRIES } from "./countries.mjs?v=20261017-workspace-v36";
import { PASSPORT_COUNTRIES } from "./passport-countries.mjs?v=20261017-workspace-v36";

const normalize = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
const labels = {
  number:
    /\b(?:PASSPORT\s*(?:NUMBER|NO\.?|N[°º])|DOCUMENT\s*(?:NUMBER|NO\.?)|NUMERO (?:DE PASSEPORT|DE PASAPORTE)|PASS(?:PORT)?NUMMER)\b\.?/g,
  birthDate:
    /\b(?:DATE OF BIRTH|BIRTH DATE|DATE DE NAISSANCE|FECHA DE NACIMIENTO|GEBURTSDATUM)\b/g,
  expiry:
    /\b(?:DATE OF EXPIRY|DATE OF EXPIRATION|EXPIRATION DATE|EXPIRY DATE|VALID UNTIL|DATE D[' ]EXPIRATION|DATE DE FIN DE VALIDITE|FECHA DE CADUCIDAD|GUELTIG BIS)\b/g,
  issuer:
    /\b(?:ISSUING (?:COUNTRY|STATE)|COUNTRY CODE|CODE DU PAYS|CODE DE PAYS|CODIGO (?:DEL PAIS|DE PAIS)|STAAT)\b/g,
  sex: /\b(?:SEX|SEXE|SEXO|GESCHLECHT)\b/g,
  birthPlace:
    /\b(?:PLACE OF BIRTH|COUNTRY OF BIRTH|CITY OF BIRTH|BIRTH PLACE|LIEU DE NAISSANCE|GEBURTSORT|LUGAR DE NACIMIENTO)\b/g,
  nationality:
    /\b(?:NATIONALITY|NATIONALITE|NACIONALIDAD|STAATSANGEHOERIGKEIT)\b/g,
  issueDate:
    /\b(?:DATE OF ISSUE|ISSUE DATE|DATE DE DELIVRANCE|FECHA DE EXPEDICION|AUSSTELLUNGSDATUM)\b/g,
  other:
    /\b(?:SURNAME|GIVEN NAMES?|FIRST NAME|LAST NAME|MIDDLE NAME|AUTHORITY|SIGNATURE|PERSONAL (?:NUMBER|NO)|TYPE)\b/g,
};
function matches(line) {
  return Object.entries(labels)
    .flatMap(([key, pattern]) =>
      [...line.matchAll(pattern)].map((m) => ({
        key,
        start: m.index,
        end: m.index + m[0].length,
      })),
    )
    .sort((a, b) => a.start - b.start);
}
const trim = (s) => s.replace(/^[\s:/.\-]+|[\s:/.\-]+$/g, "").trim();
const monthNames = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
export function printedDate(value, kind, now = new Date(), dayFirst = false) {
  const text = normalize(value).replace(
    /([0-9])[OQ]([0-9])/g,
    (match, before, after) => before + "0" + after,
  );
  let year, month, day, m;
  if ((m = text.match(/\b((?:19|20|21)\d{2})[-/. ](\d{1,2})[-/. ](\d{1,2})\b/)))
    [, year, month, day] = m;
  else if (
    (m = text.match(
      /\b(\d{1,2})[\s./-]+([A-Z]{3,9})(?:\s*\/\s*[A-Z]{3,9})?[\s./-]+((?:19|20|21)\d{2})\b/,
    ))
  ) {
    day = m[1];
    year = m[3];
    month =
      {
        JANV: 1,
        FEV: 2,
        FEVR: 2,
        MARS: 3,
        MRZ: 3,
        MAERZ: 3,
        AVR: 4,
        ABR: 4,
        MAI: 5,
        JUIN: 6,
        JUIL: 7,
        AOU: 8,
        AOUT: 8,
        AGO: 8,
        SET: 9,
        OKT: 10,
        DEZ: 12,
        DIC: 12,
        ENE: 1,
      }[m[2]] || monthNames.indexOf(m[2].slice(0, 3)) + 1;
    if (!month) return "";
  } else if (
    (m = text.match(/\b(\d{1,2})[-/. ](\d{1,2})[-/. ]((?:19|20|21)\d{2})\b/))
  ) {
    year = m[3];
    if (+m[1] > 12 || dayFirst) {
      day = m[1];
      month = m[2];
    } else if (+m[2] > 12) {
      month = m[1];
      day = m[2];
    } else if (m[1] === m[2]) {
      day = m[1];
      month = m[2];
    } else return "";
  } else return "";
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date)
    return "";
  const current = now.getUTCFullYear();
  return kind === "birthDate"
    ? +year >= current - 120 && date <= now.toISOString().slice(0, 10)
      ? date
      : ""
    : +year >= current - 30 && +year <= current + 30
      ? date
      : "";
}
export function passportCountry(value) {
  const clean = normalize(value).replace(/<+/g, "");
  const code = clean === "D" ? "DE" : PASSPORT_COUNTRIES[clean];
  const aliases = {
    "KYRGYZ REPUBLIC": "Kyrgyzstan",
    "THE KYRGYZ REPUBLIC": "Kyrgyzstan",
    "RUSSIAN FEDERATION": "Russia",
    "UNITED STATES OF AMERICA": "United States",
    TURKIYE: "Turkey",
    "REPUBLIC OF KOREA": "South Korea",
  };
  const found = COUNTRIES.find(
    (c) =>
      c.code === code ||
      c.code === clean ||
      normalize(c.name) === clean ||
      c.name === aliases[clean],
  );
  return found?.name || "";
}

export function parsePrintedPassport(text, blocks = [], now = new Date()) {
  const lines = normalize(text).split(/\r?\n/).map(trim).filter(Boolean);
  const candidates = {};
  const add = (key, value) => {
    if (value) (candidates[key] ||= []).push(trim(value));
  };
  for (let i = 0; i < lines.length; i++) {
    const found = matches(lines[i]);
    for (let j = 0; j < found.length; j++) {
      const field = found[j];
      const inline = trim(lines[i].slice(field.end, found[j + 1]?.start));
      // Whole-line fallback is safe only for one label; columns use geometry.
      if (inline) add(field.key, inline);
      else if (
        new Set(found.map((f) => f.key)).size === 1 &&
        lines[i + 1] &&
        !matches(lines[i + 1]).length &&
        !lines[i + 1].includes("<<")
      )
        add(field.key, lines[i + 1]);
    }
  }
  // Bound each value to its own label column; neighbouring nationality, birth
  // and expiry fields commonly share a text row in passport layouts.
  const rows = blocks
    .flatMap((b) => (b.paragraphs || []).flatMap((p) => p.lines || []))
    .filter((l) => l.words?.length);
  for (const row of rows) {
    let offset = 0;
    const words = row.words.map((w) => {
      const text = normalize(w.text);
      const start = offset;
      offset += text.length + 1;
      return { ...w, text, start, end: offset - 1 };
    });
    const line = words.map((w) => w.text).join(" ");
    const found = matches(line);
    for (let i = 0; i < found.length; i++) {
      const f = found[i],
        start = words.find((w) => w.end > f.start),
        end = words.find((w) => w.end >= f.end);
      if (!start?.bbox || !end?.bbox) continue;
      const height = Math.max(12, end.bbox.y1 - start.bbox.y0);
      const next = words.find((w) => w.start >= found[i + 1]?.start);
      const right = next?.bbox.x0 || start.bbox.x0 + height * 22;
      for (const valueRow of rows) {
        const region = valueRow.words.filter(
          (w) =>
            w.bbox.x0 >= start.bbox.x0 - height / 2 &&
            w.bbox.x0 < right &&
            w.bbox.y0 >= end.bbox.y1 - height * 0.15 &&
            w.bbox.y0 < end.bbox.y1 + height * 2.8,
        );
        const value = region.map((w) => w.text).join(" ");
        if (value && !matches(normalize(value)).length && !value.includes("<<"))
          add(f.key, value);
      }
    }
  }
  const values = {},
    issues = [];
  const choose = (key, parse) => {
    const found = [
      ...new Set((candidates[key] || []).map(parse).filter(Boolean)),
    ];
    if (found.length === 1) values[key] = found[0];
    else if (found.length > 1)
      issues.push(
        `Different printed values were read for ${key.replace(/([A-Z])/g, " $1").toLowerCase()}. Please enter it from the image.`,
      );
  };
  const dayFirst = /\bDD[\s/.-]+MM[\s/.-]+YYYY\b/.test(normalize(text));
  for (const key of ["birthDate", "expiry", "issueDate"])
    choose(key, (v) => printedDate(v, key, now, dayFirst));
  choose("number", (v) => {
    const clean = normalize(v).replace(/\s/g, "");
    return /^[A-Z0-9]{5,12}$/.test(clean) && /\d/.test(clean) ? clean : "";
  });
  choose("issuer", passportCountry);
  choose("nationality", passportCountry);
  choose("sex", (v) =>
    /^F(?:\b|\/)|FEMALE|FEMININ|FEMENINO|WEIBLICH/.test(v)
      ? "Female"
      : /^M(?:\b|\/)|MALE|MASCULIN|MASCULINO|MAENNLICH/.test(v)
        ? "Male"
        : "",
  );
  const places = candidates.birthPlace || [];
  const birthCountries = new Set(),
    cities = new Set();
  for (const place of places) {
    let city = normalize(place);
    for (const segment of city.split(/[,;/]/)) {
      const country = passportCountry(segment.trim());
      if (country) {
        birthCountries.add(country);
        city = city.replace(segment, "");
      }
    }
    // Also recognize a country at the end of an unpunctuated printed place.
    for (const c of COUNTRIES) {
      const name = normalize(c.name);
      if (city === name || city.endsWith(" " + name)) {
        birthCountries.add(c.name);
        city = city.slice(0, -name.length);
        break;
      }
    }
    city = city.replace(/^[\s,;/]+|[\s,;/]+$/g, "");
    if (
      /^[A-Z][A-Z .'-]{1,79}$/.test(city) &&
      !/\b(REGION|PROVINCE|STATE|DISTRICT|OBLAST)\b/.test(city) &&
      !passportCountry(city)
    )
      cities.add(city);
  }
  if (birthCountries.size === 1) values.country = [...birthCountries][0];
  if (cities.size === 1) values.birthCity = [...cities][0];
  return { ...values, issues };
}
