import { el } from "./dom.mjs?v=20261017-workspace-v27";
export function dateControl(field, value, { change, focus, blur }) {
  const [year = "", month = "", day = ""] = String(value || "").split("-");
  const group = el("div", {
    class: "date-parts",
    role: "group",
    "aria-labelledby": `label-${field.id}`,
  });
  const controls = {};
  for (const [key, label, current] of [
    ["day", "Day", day],
    ["month", "Month", month],
    ["year", "Year", year],
  ]) {
    const id = `${field.id}-${key}`;
    const input =
      key === "month"
        ? el(
            "select",
            {},
            el("option", { value: "" }, "Month"),
            ...Array.from({ length: 12 }, (_, i) =>
              el(
                "option",
                { value: String(i + 1).padStart(2, "0") },
                `${String(i + 1).padStart(2, "0")} · ${new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2000, i, 1)))}`,
              ),
            ),
          )
        : el("input", {
            type: "text",
            inputmode: "numeric",
            maxlength: key === "year" ? 4 : 2,
            placeholder: key === "year" ? "YYYY" : "DD",
            autocomplete: "off",
          });
    input.id = id;
    input.value = current;
    input.dataset.control = "";
    input.setAttribute("aria-label", `${field.label}: ${label.toLowerCase()}`);
    input.setAttribute("aria-describedby", `error-${field.id}`);
    input.addEventListener("focus", focus);
    input.addEventListener("blur", (e) => {
      if (!group.contains(e.relatedTarget)) blur();
    });
    controls[key] = input;
    input.addEventListener("input", () => {
      const y = controls.year.value,
        m = controls.month.value,
        d = controls.day.value;
      change(y || m || d ? `${y}-${m}-${d.padStart(2, "0")}` : "");
    });
    group.append(el("label", { for: id }, el("span", {}, label), input));
  }
  return group;
}
