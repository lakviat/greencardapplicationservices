import { el } from "./dom.mjs?v=20261017-workspace-v22";
import {
  FORM_VERSION,
  worksheetRows,
  warnings,
} from "./schema.mjs?v=20261017-workspace-v22";
import {
  questionGroups,
  fieldRows,
  preparedDate,
} from "./presentation.mjs?v=20261017-workspace-v22";
export function worksheet(d) {
  const root = el("article", { class: "worksheet-output document-stack" });
  let page, number;
  const rows = worksheetRows(d);
  const count = new Set(rows.map((s) => s.page)).size;
  for (const section of rows) {
    if (section.page !== number) {
      number = section.page;
      page = el(
        "section",
        {
          class: "document-page output-page",
          "aria-label": `Preview page ${number}`,
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
            el("span", {}, `Prepared ${preparedDate()}`),
          ),
        ),
        el("p", { class: "document-part" }, section.part),
        el(
          "p",
          { class: "output-identification" },
          `Independent preparation only · Worksheet page ${number} of ${count}`,
        ),
      );
      root.append(page);
    }
    for (const group of questionGroups(section)) {
      page.append(
        el(
          "section",
          { class: "output-section" },
          el("h2", {}, group.title),
          ...fieldRows(group).map((row) =>
            el(
              "dl",
              { class: `output-row columns-${row.length}` },
              ...row.map((f) =>
                el(
                  "div",
                  {},
                  el("dt", {}, `${f.reference} · ${f.label}`),
                  el("dd", {}, f.value),
                  ["photo", "passportPhoto"].includes(f.type) && d.assets[f.id]
                    ? el(
                        "small",
                        {},
                        "Private attachment · open this worksheet in My Preparations to view.",
                      )
                    : null,
                ),
              ),
            ),
          ),
        ),
      );
    }
  }
  page.append(
    el(
      "section",
      { class: "output-section" },
      el("h2", {}, "Before official entry"),
      el(
        "p",
        {},
        "Review every answer against the final instructions. Submit separately at dvprogram.state.gov during the announced period. This worksheet has no government confirmation number.",
      ),
      el(
        "ul",
        {},
        warnings(d).map((w) => el("li", {}, w)),
      ),
      el("p", {}, `Requirements version: ${FORM_VERSION.id}`),
    ),
  );
  return root;
}
