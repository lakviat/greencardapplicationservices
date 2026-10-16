import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  FORM_VERSION,
  worksheetRows,
  warnings,
} from "../../../assets/preparation/schema.mjs";
import {
  questionGroups,
  fieldRows,
  preparedDate,
} from "../../../assets/preparation/presentation.mjs";
// No public image URLs. Attachments are referenced by worksheet/question and
// remain behind account authorization. Never silently replace unsupported text.
export async function makePdf(documents, pack, now = new Date()) {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page,
    y,
    documentIndex = 0,
    year = 2027,
    part = "";
  const ink = rgb(0.08, 0.17, 0.26),
    muted = rgb(0.3, 0.38, 0.46),
    line = rgb(0.76, 0.8, 0.84),
    yellow = rgb(0.98, 0.88, 0.55);
  function wrap(value, font = normal, size = 10, width = 495) {
    const result = [];
    let current = "";
    for (const word of String(value)
      .replace(/[\r\n\t]/g, " ")
      .split(/\s+/)) {
      if (
        current &&
        font.widthOfTextAtSize(current + " " + word, size) > width
      ) {
        result.push(current);
        current = "";
      }
      if (font.widthOfTextAtSize(word, size) > width) {
        for (const ch of word) {
          if (font.widthOfTextAtSize(current + ch, size) > width) {
            result.push(current);
            current = "";
          }
          current += ch;
        }
      } else current += (current ? " " : "") + word;
    }
    if (current) result.push(current);
    return result.length ? result : [""];
  }
  function newPage(continued = false) {
    page = pdf.addPage([595, 842]);
    y = 804;
    page.drawText("GREEN CARD APPLICATION SERVICES", {
      x: 40,
      y,
      size: 11,
      font: bold,
      color: ink,
    });
    y -= 16;
    page.drawText("Unofficial Preparation Worksheet", {
      x: 40,
      y,
      size: 9,
      font: normal,
      color: muted,
    });
    y -= 18;
    page.drawLine({
      start: { x: 40, y },
      end: { x: 555, y },
      thickness: 1,
      color: ink,
    });
    y -= 17;
    page.drawText(
      `DV-${year} · Principal ${documentIndex + 1} · Prepared ${preparedDate(now)}`,
      { x: 40, y, size: 8, font: normal, color: muted },
    );
    y -= 18;
    page.drawText(part + (continued ? " (continued)" : ""), {
      x: 40,
      y,
      size: 10,
      font: bold,
      color: ink,
    });
    y -= 24;
  }
  function heading(title) {
    const lines = wrap(title, bold, 10, 495),
      h = lines.length * 12 + 10;
    if (y - h < 90) newPage(true);
    page.drawRectangle({
      x: 40,
      y: y - h,
      width: 515,
      height: h,
      color: yellow,
      borderWidth: 0.5,
      borderColor: line,
    });
    lines.forEach((s, i) =>
      page.drawText(s, {
        x: 50,
        y: y - 14 - i * 12,
        size: 10,
        font: bold,
        color: ink,
      }),
    );
    y -= h + 6;
  }
  function row(fields) {
    const width = 515 / fields.length;
    const cells = fields.map((f) => ({
      label: wrap(`${f.reference} · ${f.label}`, bold, 8, width - 16),
      value: wrap(f.value, normal, 10, width - 16),
      photo: ["photo", "passportPhoto"].includes(f.type),
    }));
    const labelLines = Math.max(...cells.map((c) => c.label.length));
    let offset = 0;
    while (offset < Math.max(...cells.map((c) => c.value.length))) {
      if (y < 65 + labelLines * 12 + 28) newPage(true);
      const available = Math.floor((y - 65 - labelLines * 12 - 14) / 14);
      const take = Math.max(
        1,
        Math.min(
          available,
          Math.max(...cells.map((c) => c.value.length - offset)),
        ),
      );
      const height = labelLines * 12 + take * 14 + 14;
      cells.forEach((cell, i) => {
        const x = 40 + i * width;
        page.drawRectangle({
          x,
          y: y - height,
          width,
          height,
          borderColor: line,
          borderWidth: 0.5,
        });
        cell.label.forEach((s, j) =>
          page.drawText(s, {
            x: x + 8,
            y: y - 13 - j * 12,
            size: 8,
            font: bold,
            color: muted,
          }),
        );
        cell.value.slice(offset, offset + take).forEach((s, j) =>
          page.drawText(s, {
            x: x + 8,
            y: y - 16 - labelLines * 12 - j * 14,
            size: 10,
            font: normal,
            color: ink,
          }),
        );
      });
      y -= height + 4;
      offset += take;
      if (offset < Math.max(...cells.map((c) => c.value.length))) newPage(true);
    }
    fields
      .filter((f) => ["photo", "passportPhoto"].includes(f.type))
      .forEach((f) =>
        text(
          `Private attachment: ${f.label}. View the image in this worksheet in My Preparations.`,
          8,
        ),
      );
  }
  function text(value, size = 9) {
    for (const s of wrap(value, normal, size, 515)) {
      if (y < 65) newPage(true);
      page.drawText(s, { x: 40, y, size, font: normal, color: muted });
      y -= size + 5;
    }
    y -= 5;
  }
  for (const [i, d] of documents.entries()) {
    documentIndex = i;
    year = d.year;
    let logicalPage;
    for (const section of worksheetRows(d)) {
      part = section.part;
      if (section.page !== logicalPage) {
        logicalPage = section.page;
        newPage();
      }
      for (const group of questionGroups(section)) {
        heading(group.title);
        for (const fields of fieldRows(group)) row(fields);
        y -= 6;
      }
    }
    heading("Before official entry");
    text(
      "Independent preparation only. No government entry has been submitted or confirmed.",
    );
    warnings(d).forEach((w) => text(w));
    text(
      "Submit your official entry separately at https://dvprogram.state.gov. Verify final instructions at https://travel.state.gov. Do not submit duplicate entries for the same principal.",
    );
    text(`Requirements version: ${FORM_VERSION.id}`, 8);
  }
  if (pack === "family") {
    part = "Household document index";
    newPage();
    documents.forEach((d, i) => {
      heading(`Principal ${i + 1} · ${d.childIds.length} children`);
      worksheetRows(d).forEach((s) =>
        s.fields
          .filter((f) => ["photo", "passportPhoto"].includes(f.type))
          .forEach((f) => text(`${s.title} · ${f.label}: ${f.value}`)),
      );
    });
  }
  const count = pdf.getPageCount();
  pdf
    .getPages()
    .forEach((p, i) =>
      p.drawText(
        `Unofficial Preparation Worksheet · Page ${i + 1} of ${count}`,
        { x: 40, y: 28, size: 8, font: normal, color: muted },
      ),
    );
  return pdf.save();
}
