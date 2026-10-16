import { el } from "./dom.mjs";
import { FORM_VERSION, worksheetRows, warnings, PACKAGES } from "./schema.mjs";
// Same schema and field order as the editor. The future authenticated PDF service
// can render this print layout; no payment or server entitlement is simulated.
export function worksheet(d) {
  const root = el("article", { class: "worksheet-output" });
  root.append(
    el(
      "header",
      {},
      el("p", { class: "eyebrow" }, "GREEN CARD APPLICATION SERVICES"),
      el("h1", {}, "DV Lottery Entry Preparation Worksheet — Unofficial"),
      el(
        "p",
        {},
        `DV-${d.year} · Prepared ${new Date().toISOString().slice(0, 10)} · ${PACKAGES[d.package].label}`,
      ),
      el("p", {}, `Requirements version: ${d.version}`),
      el(
        "p",
        {},
        "Independent preparation worksheet. This is not a government submission, confirmation, or eligibility decision.",
      ),
    ),
  );
  root.append(
    el(
      "p",
      {},
      `Required children listed: ${d.childIds.length}. Each independently eligible principal needs a separate worksheet and official entry.`,
    ),
  );
  for (const section of worksheetRows(d)) {
    root.append(
      el(
        "section",
        { class: "output-section" },
        el("h2", {}, `${section.part} · ${section.title}`),
        el(
          "dl",
          {},
          section.fields.map((f) =>
            el(
              "div",
              {},
              el("dt", {}, `${f.reference} · ${f.label}`),
              el("dd", {}, f.value),
            ),
          ),
        ),
      ),
    );
  }
  root.append(
    el(
      "section",
      { class: "output-section" },
      el("h2", {}, "Before official entry"),
      el(
        "p",
        {},
        "Verify every answer against your documents and the final government instructions. Submit your official entry separately at dvprogram.state.gov during the announced registration period. Do not submit more than one entry per person. Retain the government confirmation number after official submission; this worksheet has no confirmation number.",
      ),
      el(
        "ul",
        {},
        warnings(d).map((w) => el("li", {}, w)),
      ),
    ),
  );
  return root;
}
