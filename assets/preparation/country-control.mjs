import { el } from "./dom.mjs?v=20261019-workspace-v39";
import { COUNTRIES } from "./countries.mjs?v=20261019-workspace-v39";
const normalize = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function enhanceCountry(input) {
  const list = el("div", {
    class: "country-options",
    id: `options-${input.id}`,
    role: "listbox",
    "aria-label": "Country suggestions",
    hidden: true,
  });
  const holder = el("div", { class: "country-control" }, input, list);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("placeholder", "Search countries");
  input.removeAttribute("list");
  let matches = [],
    selected = -1;
  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    selected = -1;
  }
  function choose(index) {
    if (!matches[index]) return;
    input.value = matches[index].name;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    close();
    input.focus({ preventScroll: true });
  }
  function show() {
    const query = normalize(input.value.trim());
    matches = COUNTRIES.filter(
      (c) =>
        normalize(c.name).includes(query) || c.code.toLowerCase() === query,
    );
    selected = -1;
    list.replaceChildren(
      ...matches.map((c, i) =>
        el(
          "button",
          {
            type: "button",
            tabindex: "-1",
            role: "option",
            id: `${list.id}-${i}`,
            "aria-selected": "false",
            // Keep mouse focus on the combobox. Cancelling pointerdown also
            // cancels Safari's touch-generated click, losing the selection.
            onmousedown: (e) => e.preventDefault(),
            onclick: () => choose(i),
          },
          c.name,
        ),
      ),
    );
    if (!matches.length)
      list.append(el("p", {}, "No matching country. Check the spelling."));
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.removeAttribute("aria-activedescendant");
  }
  input.addEventListener("input", show);
  input.addEventListener("focus", show);
  input.addEventListener("blur", close);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
      e.stopPropagation();
    } else if (["ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      if (list.hidden) show();
      selected = Math.max(
        0,
        Math.min(
          matches.length - 1,
          selected + (e.key === "ArrowDown" ? 1 : -1),
        ),
      );
      [...list.children].forEach((n, i) =>
        n.setAttribute("aria-selected", String(i === selected)),
      );
      const option = list.children[selected];
      if (option) {
        input.setAttribute("aria-activedescendant", option.id);
        option.scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "Enter" && !list.hidden && selected >= 0) {
      e.preventDefault();
      choose(selected);
    }
  });
  return holder;
}
