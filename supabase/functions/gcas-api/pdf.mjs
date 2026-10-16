import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  FORM_VERSION,
  worksheetRows,
  warnings,
} from "../../../assets/preparation/schema.mjs";
// A PDF has the same ordered schema and answers as the editor. Unsupported
// glyphs cause a clear error rather than silently changing an applicant's data.
export async function makePdf(documents, pack) {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page, y;
  const width = 515;
  function newPage() {
    page = pdf.addPage([595, 842]);
    y = 787;
    page.drawText("GREEN CARD APPLICATION SERVICES", {
      x: 40,
      y,
      size: 13,
      font: bold,
      color: rgb(0.09, 0.18, 0.33),
    });
    y -= 22;
    page.drawText("DV Lottery Entry Preparation Worksheet — Unofficial", {
      x: 40,
      y,
      size: 10,
      font: normal,
    });
    y -= 24;
  }
  const measure = (s, font, size) => font.widthOfTextAtSize(s, size);
  function lines(value, font = normal, size = 10) {
    const out = [];
    let line = "";
    for (const word of String(value)
      .replace(/[\r\n\t]/g, " ")
      .split(/\s+/)) {
      if (line && measure(line + " " + word, font, size) > width) {
        out.push(line);
        line = "";
      }
      if (measure(word, font, size) > width) {
        for (const character of word) {
          if (measure(line + character, font, size) > width) {
            out.push(line);
            line = "";
          }
          line += character;
        }
      } else line += (line ? " " : "") + word;
    }
    if (line) out.push(line);
    return out;
  }
  function text(
    value,
    { font = normal, size = 10, color = rgb(0.12, 0.16, 0.22) } = {},
  ) {
    for (const line of lines(value, font, size)) {
      if (y < 62) newPage();
      page.drawText(line, { x: 40, y, size, font, color });
      y -= size + 5;
    }
  }
  for (const [i, d] of documents.entries()) {
    newPage();
    text(`DV-${d.year} · Principal worksheet ${i + 1}`, {
      font: bold,
      size: 14,
    });
    text(
      `Prepared ${new Date().toISOString().slice(0, 10)} · Version ${FORM_VERSION.id}`,
      { size: 8 },
    );
    text(
      "Preparation only. No government entry has been submitted or confirmed.",
      { size: 9 },
    );
    y -= 8;
    for (const section of worksheetRows(d)) {
      if (y < 110) newPage();
      page.drawRectangle({
        x: 35,
        y: y - 5,
        width: 525,
        height: 21,
        color: rgb(1, 0.93, 0.57),
      });
      text(section.title, { font: bold, size: 11 });
      y -= 7;
      for (const f of section.fields) {
        const needed =
          lines(f.label, bold, 9).length * 14 + lines(f.value).length * 15 + 5;
        if (y - needed < 62) newPage();
        text(f.label, { font: bold, size: 9 });
        text(f.value);
        y -= 5;
      }
    }
    if (y < 180) newPage();
    text("Before submitting an official entry", { font: bold, size: 12 });
    for (const warning of warnings(d)) text(warning, { size: 9 });
    text(
      "Enter the official government application separately at https://dvprogram.state.gov. Check current instructions at https://travel.state.gov. Do not submit duplicate entries for the same principal.",
    );
  }
  if (pack === "family") {
    newPage();
    text("Household document index", { font: bold, size: 14 });
    documents.forEach((d, i) => {
      text(`Principal ${i + 1} · ${d.childIds.length} children`, {
        font: bold,
      });
      worksheetRows(d).forEach((s) =>
        s.fields
          .filter((f) => ["photo", "passportPhoto"].includes(f.type))
          .forEach((f) => text(`${s.title}: ${f.label} — ${f.value}`)),
      );
    });
  }
  const count = pdf.getPageCount();
  pdf.getPages().forEach((p, i) =>
    p.drawText(`Unofficial · ${i + 1} / ${count}`, {
      x: 40,
      y: 28,
      size: 8,
      font: normal,
    }),
  );
  return pdf.save();
}
