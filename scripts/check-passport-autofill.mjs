import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
const window = {};
vm.runInNewContext(readFileSync("assets/passport-autofill.js", "utf8"), {
  window,
  document: { querySelector: () => null },
});
const parse = (text) =>
  JSON.parse(
    JSON.stringify(
      window.gcasPassport.parsePassport(text, [
        "Kyrgyzstan",
        "Kazakhstan",
        "Germany",
        "Russia",
      ]),
    ),
  );
test("TD3 names remain separate from issuing country and nationality", () => {
  assert.deepEqual(
    parse(
      "P<KGZTESTER<<JANE<ANNA<<<<<<<<<<<<<<<<<<<<<<<<<\nAB12345678KGZ7001011F3001019<<<<<<<<<<<<<<<<<00",
    ),
    {
      firstName: "JANE ANNA",
      lastName: "TESTER",
      middleName: "",
      country: "",
    },
  );
});
test("printed labels corroborate names after MRZ filler cleanup", () => {
  const result = parse(
    "SURNAME: TESTER\nGIVEN NAMES: JANE ANNA\nP<KGZTESTER<<JANE<ANNA<LLLLL<<<<<<<<<<<<<<<<<",
  );
  assert.equal(result.firstName, "JANE ANNA");
});
test("explicit birth country may differ from passport nationality", () => {
  const result = parse(
    "SURNAME: TESTER\nGIVEN NAMES: JANE\nNATIONALITY: KYRGYZSTAN\nPLACE OF BIRTH: ALMATY, KAZAKHSTAN",
  );
  assert.equal(result.country, "Kazakhstan");
  assert.equal(result.firstName, "JANE");
  assert.equal(result.lastName, "TESTER");
  assert.equal(
    parse("NATIONALITY: GERMANY\nPLACE OF BIRTH: BERLIN").country,
    "",
  );
});
test("ambiguous or unreadable values remain empty and explicit middle name is preserved", () => {
  assert.equal(parse("some random text").firstName, "");
  assert.equal(parse("PLACE OF BIRTH: UTOPIA").country, "");
  assert.equal(
    parse("SURNAME\nTESTER\nFIRST NAME\nJANE\nMIDDLE NAME\nANNA").middleName,
    "ANNA",
  );
});

test("misread MRZ padding is excluded without truncating genuine name endings", () => {
  assert.equal(
    parse("P<UTOEXAMPLE<<JANE<K<L<LLLLLLKLLLKLKL").firstName,
    "JANE",
  );
  assert.equal(parse("P<UTOEXAMPLE<<JANE<ANNA<L<L<L").firstName, "JANE ANNA");
  assert.equal(
    parse("P<UTOEXAMPLE<<JANE<ANNA<L<<<<<<").firstName,
    "JANE ANNA L",
  );
  assert.equal(
    parse("P<UTOEXAMPLE<<MARK<LEE<<<<<<<<<<<<<<<<").firstName,
    "MARK LEE",
  );
  assert.equal(
    parse("P<UTOEXAMPLE<<LILLY<KLARA<<<<<<<<<<<<").firstName,
    "LILLY KLARA",
  );
  assert.equal(parse("P<UTOEXAMPLE<<JANEKLLLLLLLLLLLLLLLLLL").firstName, "");
});
test("multilingual labels can share a row with their values", () => {
  const result = parse(
    "FAMILIENNAME / SURNAME: EXAMPLE\nPRENOMS: JANE ANNA\nPLACE OF BIRTH: BERLIN, GERMANY",
  );
  assert.equal(result.firstName, "JANE ANNA");
  assert.equal(result.lastName, "EXAMPLE");
  assert.equal(result.country, "Germany");
});
test("birth-country geometry excludes the adjacent nationality column and date-of-birth labels", () => {
  const word = (text, x0, y0, width = 70) => ({
    text,
    bbox: { x0, y0, x1: x0 + width, y1: y0 + 20 },
  });
  const line = (words) => ({ words });
  const country = window.gcasPassport.parsePassport(
    "",
    ["Germany", "Kazakhstan"],
    [
      {
        paragraphs: [
          {
            lines: [
              line([
                word("Nationality", 0, 100),
                word("Pipe", 300, 100),
                word("of", 380, 100),
                word("hit", 410, 100),
              ]),
              line([word("Kazakhstan", 0, 128), word("Germany", 300, 128)]),
            ],
          },
        ],
      },
    ],
  ).country;
  assert.equal(country, "Germany");
  const notBirth = window.gcasPassport.parsePassport(
    "",
    ["Germany"],
    [
      {
        paragraphs: [
          {
            lines: [
              line([
                word("Date", 300, 100),
                word("of", 380, 100),
                word("birth", 410, 100),
              ]),
              line([word("Germany", 300, 128)]),
            ],
          },
        ],
      },
    ],
  ).country;
  assert.equal(notBirth, "");
});

test("mixed short filler groups are removed only from the end of given names", () => {
  for (const tail of ["<K<LLL", "<KLLL", "<L<K<LL", "<LLL<K"]) {
    assert.equal(
      parse("P<UTOEXAMPLE<<JANE" + tail + "<<<<<<").firstName,
      "JANE",
    );
  }
  assert.equal(parse("P<UTOEXAMPLE<<MARK<LEE<K<<<<<<").firstName, "MARK LEE K");
  assert.equal(
    parse("P<UTOEXAMPLE<<LILLY<KLARA<<<<<<").firstName,
    "LILLY KLARA",
  );
});
test("later printed names correct early MRZ errors for both surname and given names", () => {
  const reader = window.gcasPassport.createNameReader();
  reader.add("P<UTOEXAMPLF<<JANE<K<LLL<<<<<<<<");
  reader.add("SURNAME: EXAMPLE\nGIVEN NAMES: JANE ANNA");
  reader.add("P<UTOEXAMPLF<<JANE<K<LLLL<<<<<<<<");
  const values = reader.result();
  assert.equal(values.lastName, "EXAMPLE");
  assert.equal(values.firstName, "JANE ANNA");
  assert.equal(values.issues.length, 2);
});
test("inconsistent printed surnames need corroboration or remain blank", () => {
  const reader = window.gcasPassport.createNameReader();
  reader.add("SURNAME: EXAMPLE");
  reader.add("SURNAME: EXAMPLF");
  assert.equal(reader.result().lastName, "");
  assert(reader.result().issues.length);
  reader.add("P<UTOEXAMPLE<<JANE<<<<<<<<<<<<<<<<");
  assert.equal(reader.result().lastName, "EXAMPLE");
});
test("adjacent printed name columns and following fields do not get combined", () => {
  const w = (text, x, y, width = 90) => ({
    text,
    bbox: { x0: x, y0: y, x1: x + width, y1: y + 20 },
  });
  const blocks = [
    {
      paragraphs: [
        {
          lines: [
            {
              words: [
                w("SURNAME", 0, 0),
                w("GIVEN", 500, 0),
                w("NAMES", 600, 0),
              ],
            },
            {
              words: [
                w("EXAMPLE", 0, 24),
                w("JANE", 500, 24),
                w("ANNA", 600, 24),
              ],
            },
            { words: [w("NATIONALITY", 0, 48), w("SEX", 500, 48)] },
            { words: [w("GERMANY", 0, 72), w("F", 500, 72)] },
          ],
        },
      ],
    },
  ];
  const reader = window.gcasPassport.createNameReader();
  reader.add("SURNAME   GIVEN NAMES\nEXAMPLE   JANE ANNA", blocks);
  assert.equal(reader.result().firstName, "JANE ANNA");
  assert.equal(reader.result().lastName, "EXAMPLE");
});
test("translated labels and local script never become the Latin name", () => {
  const result = parse(
    "SURNAME / ФАМИЛИЯ\nПРИМЕР\nEXAMPLE\nGIVEN NAMES / ИМЯ\nДЖЕЙН\nJANE",
  );
  assert.equal(result.firstName, "JANE");
  assert.equal(result.lastName, "EXAMPLE");
  assert.equal(
    parse("SURNAME: O’NEILL\nFIRST NAME: ANNE-MARIE").lastName,
    "O’NEILL",
  );
});

test("sparse printed-label retries cannot contaminate an already readable MRZ name", () => {
  const reader = window.gcasPassport.createNameReader();
  reader.add("P<UTOEXAMPLE<<ANNA<MARIA<<LLLLLLLLLLLLLLLLKL");
  reader.add("P<UTOEXAMPLE<<ANNA<KMARTIA<KLLLLLLLLLLLLLL", [], {
    printedOnly: true,
  });
  assert.equal(reader.result().firstName, "ANNA MARIA");
  reader.add("SURNAME: EXAMPLE\nGIVEN NAMES: ANNA MARIA", [], {
    printedOnly: true,
  });
  assert.equal(reader.result().firstName, "ANNA MARIA");
});
