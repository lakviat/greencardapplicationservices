import { el } from "./dom.mjs?v=20261017-workspace-v25";
import { worksheetRows } from "./schema.mjs?v=20261017-workspace-v25";
// Unpaid previews contain only a small sample. Never put the complete document
// in the DOM behind a blur: screenshots, printing or CSS removal would reveal it.
export function worksheet(d) {
  const names = worksheetRows(d)[0].fields.filter((f) =>
    ["entrant.lastName", "entrant.firstName", "entrant.middleName"].includes(
      f.id,
    ),
  );
  return el(
    "article",
    { class: "worksheet-output document-stack limited-preview" },
    el(
      "section",
      {
        class: "document-page output-page",
        "aria-label": "Limited worksheet preview",
      },
      el(
        "header",
        { class: "document-masthead" },
        el(
          "div",
          {},
          el("strong", {}, "GREEN CARD APPLICATION SERVICES"),
          el("span", {}, "Unofficial Preparation Worksheet"),
        ),
        el(
          "div",
          {},
          el("strong", {}, `DV-${d.year}`),
          el("span", {}, "SAMPLE PREVIEW"),
        ),
      ),
      el("p", { class: "document-part" }, "Part One — Entrant Information"),
      el(
        "section",
        { class: "output-section" },
        el("h2", {}, "1. Name"),
        el(
          "dl",
          { class: "output-row columns-3" },
          names.map((f) =>
            el("div", {}, el("dt", {}, f.label), el("dd", {}, f.value)),
          ),
        ),
      ),
      el(
        "div",
        { class: "preview-redacted", "aria-hidden": "true" },
        ["Birth information", "Contact & address", "Household information"].map(
          (title) =>
            el(
              "section",
              {},
              el("h2", {}, title),
              el("div", { class: "redacted-line" }),
              el("div", { class: "redacted-line" }),
            ),
        ),
      ),
      el(
        "aside",
        { class: "preview-lock" },
        el(
          "span",
          { class: "preview-lock-symbol", "aria-hidden": "true" },
          "◇",
        ),
        el("h2", {}, "Your complete PDF, after payment"),
        el(
          "p",
          {},
          "All applicable answers are organized into a filled preparation worksheet. This sample shows only the name section.",
        ),
        el(
          "p",
          {},
          "The official DV entry must be completed separately online at dvprogram.state.gov.",
        ),
      ),
      el(
        "p",
        { class: "preview-watermark" },
        "LIMITED PREVIEW · NOT FOR SUBMISSION",
      ),
    ),
  );
}
