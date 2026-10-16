import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { makePdf } from "../../supabase/functions/gcas-api/pdf.mjs";
import { initialDraft } from "../../assets/preparation/schema.mjs";

// Inspect the actual PDF content streams, including answers continued over pages.
async function rendered(draft, pack = "single") {
  const pdf = await PDFDocument.load(
    await makePdf([draft], pack, new Date("2026-10-16T12:00:00Z")),
  );
  const text = pdf.context
    .enumerateIndirectObjects()
    .filter(([, object]) => object instanceof PDFRawStream)
    .flatMap(([, stream]) =>
      [
        ...Buffer.from(decodePDFRawStream(stream).decode())
          .toString()
          .matchAll(/<([0-9a-f]+)> Tj/gi),
      ].map((m) => Buffer.from(m[1], "hex").toString("latin1")),
    )
    .join("\n");
  return { pdf, text };
}
test("PDF preserves long answers, conditional family data, dates and continuous page numbering", async () => {
  const d = initialDraft();
  const baseline = await rendered(d);
  d.answers["entrant.lastName"] = "SYNTHETIC-ENTRANT";
  d.answers["entrant.marital"] = "married";
  d.answers["spouse.firstName"] = "SYNTHETIC-SPOUSE";
  const child = randomUUID();
  d.childIds.push(child);
  d.answers[`child.${child}.firstName`] = "SYNTHETIC-CHILD";
  d.answers["eligibility.basis"] = "parents";
  d.answers["eligibility.explanation"] =
    "STARTMARKER " + "Long answer to preserve. ".repeat(58) + "ENDMARKER";
  const { pdf, text } = await rendered(d, "family");
  assert(pdf.getPageCount() > baseline.pdf.getPageCount());
  for (const value of [
    "SYNTHETIC-ENTRANT",
    "SYNTHETIC-SPOUSE",
    "SYNTHETIC-CHILD",
    "STARTMARKER",
    "ENDMARKER",
    "2026-10-16",
    "DV-2027",
    "Household document index",
    "Unofficial Preparation Worksheet",
  ])
    assert(text.includes(value), `PDF must contain ${value}`);
  for (let i = 1; i <= pdf.getPageCount(); i++)
    assert(text.includes(`Page ${i} of ${pdf.getPageCount()}`));
  d.answers["entrant.marital"] = "unmarried";
  assert(!(await rendered(d)).text.includes("SYNTHETIC-SPOUSE"));
});
