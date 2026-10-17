import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePrintedPassport,
  printedDate,
} from "../../assets/preparation/passport-fields.mjs";
import {
  parseMRZ,
  scanSuggestions,
  mergeMRZ,
} from "../../assets/preparation/mrz.mjs";
const now = new Date("2026-10-17T12:00:00Z");
const first = "P<KGZERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<";
const second = "L898902C36UTO7408122F1204159ZE184226B<<<<<10";
test("printed labels recover document details without a readable MRZ", () => {
  const p = parsePrintedPassport(
    "PASSPORT NO. AB1234567\nISSUING COUNTRY: KGZ\nDATE OF BIRTH: 12 AUG 1974\nDATE OF EXPIRY: 15 APR 2030\nSEX: F\nPLACE OF BIRTH: ALMATY, KAZAKHSTAN\nNATIONALITY: KYRGYZSTAN",
    [],
    now,
  );
  assert.deepEqual(p, {
    number: "AB1234567",
    issuer: "Kyrgyzstan",
    birthDate: "1974-08-12",
    expiry: "2030-04-15",
    sex: "Female",
    birthCity: "ALMATY",
    country: "Kazakhstan",
    nationality: "Kyrgyzstan",
    issues: [],
  });
  const result = scanSuggestions(p, parseMRZ("", now));
  assert.equal(result.number, "AB1234567");
  assert.equal(result.issuer, "Kyrgyzstan");
  assert.equal(result.confidence.expiry, "printed");
});
test("dates require a real day and an unambiguous order or explicit format", () => {
  for (const [v, expected] of [
    ["15.04.2030", "2030-04-15"],
    ["2030/04/15", "2030-04-15"],
    ["04/15/2030", "2030-04-15"],
    ["15 APR / AVR 2030", "2030-04-15"],
    ["04/05/2030", ""],
    ["31 FEB 2030", ""],
    ["12 JUN 3020", ""],
  ])
    assert.equal(printedDate(v, "expiry", now), expected, v);
  assert.equal(
    parsePrintedPassport("DD/MM/YYYY\nDATE OF EXPIRY: 04/05/2030", [], now)
      .expiry,
    "2030-05-04",
  );
});
test("multiple printed columns do not swap birth and expiry or nationality and birthplace", () => {
  const w = (text, x, y, width = 140) => ({
    text,
    bbox: { x0: x, y0: y, x1: x + width, y1: y + 20 },
  });
  const line = (...words) => ({ words });
  const blocks = [
    {
      paragraphs: [
        {
          lines: [
            line(
              w("DATE", 0, 0, 50),
              w("OF", 60, 0, 30),
              w("BIRTH", 100, 0, 60),
              w("DATE", 500, 0, 50),
              w("OF", 560, 0, 30),
              w("EXPIRY", 600, 0, 70),
            ),
            line(w("12 AUG 1974", 0, 30), w("15 APR 2030", 500, 30)),
            line(
              w("NATIONALITY", 0, 100),
              w("PLACE", 500, 100, 60),
              w("OF", 570, 100, 30),
              w("BIRTH", 610, 100, 70),
            ),
            line(
              w("Kyrgyzstan", 0, 130),
              w("ALMATY, KAZAKHSTAN", 500, 130, 280),
            ),
          ],
        },
      ],
    },
  ];
  const p = parsePrintedPassport(
    "DATE OF BIRTH     DATE OF EXPIRY\n12 AUG 1974        15 APR 2030",
    blocks,
    now,
  );
  assert.equal(p.birthDate, "1974-08-12");
  assert.equal(p.expiry, "2030-04-15");
  assert.equal(p.country, "Kazakhstan");
  assert.equal(p.nationality, "Kyrgyzstan");
});
test("printed birth country is explicit; city, nationality and issuer do not imply it", () => {
  const p = parsePrintedPassport(
    "ISSUING COUNTRY: KGZ\nNATIONALITY: KYRGYZSTAN\nPLACE OF BIRTH: BISHKEK",
    [],
    now,
  );
  assert.equal(p.country, undefined);
  assert.equal(p.birthCity, "BISHKEK");
  assert.equal(
    parsePrintedPassport("PLACE OF BIRTH: OSH REGION, KGZ", [], now).birthCity,
    undefined,
  );
  assert.equal(
    parsePrintedPassport("PLACE OF BIRTH: ALMATY, KAZ", [], now).country,
    "Kazakhstan",
  );
});
test("partial MRZ keeps independently checked fields; retries do not discard them", () => {
  const p = parseMRZ(first + "\n" + second.slice(0, 28), now);
  assert.equal(p.values.number, "L898902C3");
  assert.equal(p.values.expiry, "2012-04-15");
  assert.equal(p.values.issuerCode, "KGZ");
  const badNumber = second.slice(0, 9) + "0" + second.slice(10);
  const merged = mergeMRZ(p, parseMRZ(first + "\n" + badNumber, now));
  assert.equal(merged.values.number, "L898902C3");
  assert.equal(
    parseMRZ(first + "\n\n" + second, now).values.number,
    "L898902C3",
  );
});
test("conflicts are visible and blank MRZ dates do not erase printed dates", () => {
  const p = parsePrintedPassport(
    "PASSPORT NO. AB1234567\nPASSPORT NO. CD9876543",
    [],
    now,
  );
  assert.equal(p.number, undefined);
  assert(p.issues.length);
  const result = scanSuggestions(
    { birthDate: "2007-04-12", number: "AB1234567" },
    {
      status: "invalid",
      checks: { birth: true, number: true },
      values: { birthDate: "", number: "L898902C3" },
      issues: [],
    },
  );
  assert.equal(result.birthDate, "2007-04-12");
  assert.equal(result.number, "L898902C3");
  assert(result.issues.some((s) => s.includes("differs")));
});
