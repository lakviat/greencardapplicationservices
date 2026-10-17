import { el, button, link } from "./dom.mjs?v=20261017-workspace-v22";
import {
  FORM_VERSION,
  PACKAGES,
  price,
  initialDraft,
  sections,
  worksheetRows,
  fields,
  validate,
  progress,
  preparationProgress,
  warnings,
  recommendPackage,
  hasSpouse,
} from "./schema.mjs?v=20261017-workspace-v22";
import { COUNTRIES } from "./countries.mjs?v=20261017-workspace-v22";
import {
  readImage,
  drawCrop,
  photoCopy,
  passportCopy,
  scanPassport,
} from "./media.mjs?v=20261017-workspace-v22";
import {
  CAPABILITIES,
  unavailable,
  capabilities,
} from "./backend.mjs?v=20261017-workspace-v22";
import { cloudWorkspace } from "./cloud.mjs?v=20261017-workspace-v22";
import { worksheet } from "./worksheet.mjs?v=20261017-workspace-v22";
import { spouseWorksheet } from "./household.mjs?v=20261017-workspace-v22";
import { enhanceCountry } from "./country-control.mjs?v=20261017-workspace-v22";
import { attachViewport } from "./viewport.mjs?v=20261017-workspace-v22";
import { questionGroups } from "./presentation.mjs?v=20261017-workspace-v22";
import { dateControl } from "./date-control.mjs?v=20261017-workspace-v22";
const app = document.querySelector("#workspace");
let draft = initialDraft();
const sessionDrafts = [draft];
const relatedDrafts = new WeakMap();
const dirtyRecords = new WeakSet();
let cloudStatus = "";
const cloud = cloudWorkspace({
  dialog: openDialog,
  close: closeDialog,
  related: (d) => relatedDrafts.get(d),
  status: (text) => {
    cloudStatus = text;
    draftStatus.textContent = text;
  },
  saved: (records) => {
    records.forEach((r) => dirtyRecords.delete(r));
    dirty = sessionDrafts.some((r) => dirtyRecords.has(r));
  },
  load: (records) => {
    for (const r of records) {
      const old = sessionDrafts.find((x) => x.id === r.id);
      if (old && dirtyRecords.has(old))
        throw new Error(
          "You have unsaved edits to this preparation. Keep this tab open and resolve those before reopening it.",
        );
    }
    for (const r of records) {
      const index = sessionDrafts.findIndex((x) => x.id === r.id);
      if (index >= 0) {
        Object.values(sessionDrafts[index].assets).forEach((a) =>
          URL.revokeObjectURL(a.url),
        );
        sessionDrafts.splice(index, 1, r);
      } else sessionDrafts.push(r);
    }
    if (records.length === 2) {
      relatedDrafts.set(records[0], records[1]);
      relatedDrafts.set(records[1], records[0]);
    }
    draft = records[0];
    navigate("document");
  },
  remove: (records) => {
    for (const r of records) {
      Object.values(r.assets).forEach((a) => URL.revokeObjectURL(a.url));
      r.answers = {};
      r.assets = {};
      const index = sessionDrafts.indexOf(r);
      if (index >= 0) sessionDrafts.splice(index, 1);
    }
    if (!sessionDrafts.length) sessionDrafts.push(initialDraft());
    draft = sessionDrafts[0];
    dirty = sessionDrafts.some((r) => dirtyRecords.has(r));
    navigate("dashboard");
  },
  signOut: () => {
    for (const r of sessionDrafts) {
      Object.values(r.assets).forEach((a) => URL.revokeObjectURL(a.url));
      r.answers = {};
      r.assets = {};
    }
    sessionDrafts.splice(0, sessionDrafts.length, initialDraft());
    draft = sessionDrafts[0];
    dirty = false;
    cloudStatus = "Signed out";
    navigate("dashboard");
  },
});
const countryNames = COUNTRIES.map((c) => c.name);
const touched = new Set();
let active = "entrant.lastName",
  dirty = false,
  view = "document",
  dialog = null,
  dialogCleanup = null,
  dialogTrigger = null;
const status = el("p", {
  class: "sr-only",
  role: "status",
  "aria-live": "polite",
});
const documentArea = el("div", {
  class: "document-stack",
  id: "document-pages",
});
const sidebar = el("nav", {
  class: "workspace-index",
  "aria-label": "Worksheet sections",
});
const display = el("main", { id: "main", class: "workspace-main" });
const guideLabel = el(
  "span",
  { class: "current-section" },
  "Entrant information",
);
const percentLabel = el("strong", { "data-progress-label": "" }, "0%");
const progressBar = el("progress", {
  max: 100,
  value: 0,
  "aria-label": "Required fields completed",
});
const remainingButton = button("Items remaining", openMissing, {
  class: "remaining-button",
  "aria-haspopup": "dialog",
});
const packageIndicator = button("Single · $9.99", openPackages, {
  class: "package-indicator",
  "aria-haspopup": "dialog",
});
const saveButton = button("Save progress", openSave, {
  class: "button primary",
  "aria-haspopup": "dialog",
});
const reviewButton = button("Review", () => navigate("review"), {
  class: "button",
});
const compactRemaining = el("span", { class: "compact-remaining" }, "27 left");
const actionsButton = button("•••", openActions, {
  class: "actions-toggle",
  "aria-label": "More preparation actions",
  "aria-haspopup": "dialog",
});
const bottom = el(
  "footer",
  { class: "workspace-bottom" },
  button("←", previousField, {
    class: "previous-field",
    "aria-label": "Previous field",
  }),
  el(
    "div",
    { class: "completion" },
    percentLabel,
    compactRemaining,
    progressBar,
    guideLabel,
  ),
  button("→", nextField, {
    class: "next-field",
    "aria-label": "Next required field",
  }),
  el(
    "div",
    { class: "workspace-actions" },
    packageIndicator,
    saveButton,
    reviewButton,
  ),
  actionsButton,
);
const header = el(
  "header",
  { class: "workspace-header" },
  link(
    el(
      "span",
      { class: "brand-content" },
      el("img", { src: "/assets/favicon.png", alt: "", width: 39, height: 52 }),
      el(
        "span",
        { class: "workspace-brand" },
        el("strong", {}, "GREEN CARD"),
        el("span", {}, "APPLICATION SERVICES"),
      ),
    ),
    "/",
    {
      class: "workspace-home",
      "aria-label": "Green Card Application Services home",
    },
  ),
  el(
    "div",
    { class: "workspace-title" },

    el("strong", {}, "DV-2027 worksheet"),
  ),
  button("My preparations", () => navigate("dashboard"), {
    class: "button dashboard-link",
  }),
);
const notice = el(
  "div",
  { class: "workspace-notice" },
  button("Unofficial preparation · About this worksheet", openSources, {
    class: "disclosure-button",
  }),
);
const draftStatus = el(
  "span",
  { class: "draft-status" },
  "In this tab · not saved",
);
const top = el(
  "div",
  { class: "workspace-toolbar" },
  el(
    "div",
    {},
    el("span", { class: "edition-badge" }, "DV-2027 · provisional"),
    draftStatus,
  ),
  button("Requirements & sources", openSources, { class: "text-button" }),
);
const help = el(
  "aside",
  { class: "guidance-card", "aria-label": "Field guidance" },
  el("span", { class: "eyebrow" }, "A LITTLE GUIDANCE"),
  el("h2", { "data-guide-title": "" }, "Begin with your name"),
  el(
    "p",
    { "data-guide-copy": "" },
    "Type your name exactly as shown on your document.",
  ),
  el(
    "p",
    { class: "guidance-note" },
    "You stay in control. Review every answer; automated checks do not determine eligibility.",
  ),
  remainingButton,
);
app.append(
  header,
  top,
  el(
    "div",
    { class: "workspace-layout" },
    el("aside", { class: "workspace-sidebar" }, sidebar, help),
    display,
  ),
  bottom,
  status,
);
const countries = el(
  "datalist",
  { id: "countries" },
  COUNTRIES.map((c) => el("option", { value: c.name }, c.code)),
);
app.append(countries);
const viewport = attachViewport(bottom);
function announce(text) {
  status.textContent = text;
}
function changed() {
  dirty = true;
  dirtyRecords.add(draft);
  cloudStatus = "";
  cloud.changed(draft);
  draft.reviewed = false;
  updateProgress();
}
function currentField() {
  return fields(draft).find((f) => f.id === active);
}
function fieldError(field) {
  if (
    field.type === "country" &&
    draft.answers[field.id] &&
    !countryNames.includes(draft.answers[field.id])
  )
    return "Select an exact country name from the suggestions.";
  return validate(field, draft);
}
function updateProgress() {
  const p = preparationProgress(draft, relatedDrafts.get(draft), countryNames);
  percentLabel.textContent = `${p.percent}%`;
  progressBar.value = p.percent;
  compactRemaining.textContent = `${p.remaining.length} left`;
  percentLabel.setAttribute(
    "aria-label",
    `${p.percent}% complete, ${p.remaining.length} items remaining`,
  );
  const remainingText = `${p.remaining.length} ${p.remaining.length === 1 ? "item" : "items"} remaining`;
  // Avoid replacing a button's text node on input blur: Safari can cancel
  // the in-progress pointer click when its original target is removed.
  if (remainingButton.textContent !== remainingText)
    remainingButton.textContent = remainingText;
  const packageText = `${PACKAGES[draft.package].label} · ${price(draft.package)}`;
  if (packageIndicator.textContent !== packageText)
    packageIndicator.textContent = packageText;
  draftStatus.textContent =
    cloudStatus ||
    (dirty ? "Unsaved · keep this tab open" : "In this tab · not saved");
  for (const field of fields(draft)) {
    const node = document.getElementById(`field-${field.id}`);
    if (!node) continue;
    const error = fieldError(field);
    node.classList.toggle(
      "is-complete",
      !error && (field.required || !!draft.answers[field.id]),
    );
    node.classList.toggle(
      "is-invalid",
      !!error && (touched.has(field.id) || view === "review"),
    );
    const control = node.querySelector("[data-control]");
    control?.setAttribute(
      "aria-invalid",
      String(!!error && touched.has(field.id)),
    );
    const text = node.querySelector(".field-error");
    if (text) text.textContent = touched.has(field.id) ? error : "";
  }
  const recommendation = document.querySelector("[data-recommendation]");
  if (recommendation) {
    const key = recommendPackage(draft);
    recommendation.textContent =
      key === "single"
        ? "Single includes every required derivative on this principal entry."
        : `Recommended: ${PACKAGES[key].label} · ${price(key)}. ${key === "family" ? "Family can add household organization. Required children remain included on Single." : "Couple can organize two independently eligible principal worksheets."} Your selected price has not changed.`;
  }
}
function activate(id, { scroll = true, focus = true } = {}) {
  const moved = active !== id;
  active = id;
  const field = currentField();
  if (!field) return;
  document
    .querySelectorAll(".document-field.is-active")
    .forEach((n) => n.classList.remove("is-active"));
  const wrapper = document.getElementById(`field-${id}`);
  wrapper?.classList.add("is-active");
  if (moved && scroll) {
    wrapper?.classList.add("is-guided");
    setTimeout(() => wrapper?.classList.remove("is-guided"), 700);
  }
  document.querySelector("[data-guide-title]").textContent = field.label;
  document.querySelector("[data-guide-copy]").textContent =
    field.help ||
    "Use your document to check this answer, then continue to the next required field.";
  const section = sections(draft).find((s) => s.id === field.section);
  guideLabel.textContent = section?.title || "Your worksheet";
  if (scroll)
    wrapper?.scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  if (focus) {
    const control = wrapper?.querySelector("[data-control]");
    control?.focus({ preventScroll: true });
    setTimeout(() => viewport.ensureVisible(), 300);
  }
}
function nextField() {
  if (view !== "document") {
    navigate("document");
    return;
  }
  const all = fields(draft);
  const index = all.findIndex((f) => f.id === active);
  if (index >= 0) touched.add(active);
  const later = all.slice(index + 1).find((f) => f.required && fieldError(f));
  const next = later || all.find((f) => f.required && fieldError(f));
  updateProgress();
  if (next) activate(next.id);
  else {
    const pending = preparationProgress(
      draft,
      relatedDrafts.get(draft),
      countryNames,
    ).remaining[0];
    if (pending?.record && pending.record !== draft) {
      draft = pending.record;
      touched.clear();
      renderDocument();
      activate(pending.field.id);
    } else if (pending?.field.id === "secondEntry") openMissing();
    else navigate("review");
  }
}
function previousField() {
  if (view !== "document") {
    navigate("document");
    return;
  }
  const all = fields(draft);
  activate(all[Math.max(0, all.findIndex((f) => f.id === active) - 1)].id);
}
function makeField(field) {
  const wrap = el("div", {
    class: `document-field field-${field.type}`,
    id: `field-${field.id}`,
    "data-field": field.id,
  });
  const label = el(
    "label",
    { for: field.id },
    el("span", { class: "field-reference" }, field.reference),
    field.label,
    !field.required ? el("span", { class: "optional" }, "Optional") : null,
  );
  wrap.append(label);
  if (field.help) {
    const mandatory = field.id === "preparation.consent";
    wrap.append(
      el(
        "p",
        {
          class: `field-help ${mandatory ? "mandatory-help" : ""}`,
          id: `help-${field.id}`,
        },
        field.help,
      ),
    );
    if (!mandatory)
      wrap.append(
        button("?", () => openFieldHelp(field), {
          class: "field-help-toggle",
          "aria-label": `Help: ${field.label}`,
          "aria-haspopup": "dialog",
        }),
      );
  }
  if (["photo", "passportPhoto"].includes(field.type)) {
    wrap.append(mediaControl(field));
  } else {
    let input;
    if (["date", "futureDate"].includes(field.type)) {
      label.removeAttribute("for");
      label.id = `label-${field.id}`;
      wrap.append(
        dateControl(field, draft.answers[field.id], {
          change: (value) => {
            draft.answers[field.id] = value;
            changed();
          },
          focus: () => activate(field.id, { scroll: false, focus: false }),
          blur: () => {
            touched.add(field.id);
            updateProgress();
          },
        }),
        el("p", { class: "field-error", id: `error-${field.id}` }),
      );
      return wrap;
    }
    if (
      field.id.endsWith(".sex") ||
      ["entrant.marital", "entrant.education"].includes(field.id)
    ) {
      const group = el("div", {
        class: `radio-options ${field.id === "entrant.marital" ? "radio-stacked" : field.id === "entrant.education" ? "radio-education" : ""}`,
        role: "radiogroup",
        "aria-label": field.label,
        "aria-required": "true",
      });
      for (const option of field.options) {
        const radio = el("input", {
          type: "radio",
          name: field.id,
          id: `${field.id}-${option.value}`,
          value: option.value,
          checked: draft.answers[field.id] === option.value,
          "data-control": "",
          onfocus: () => activate(field.id, { scroll: false, focus: false }),
          onchange: () => {
            draft.answers[field.id] = option.value;
            changed();
            if (field.id === "entrant.marital") {
              renderDocument();
              document
                .getElementById(`${field.id}-${option.value}`)
                ?.focus({ preventScroll: true });
            }
          },
        });
        group.append(el("label", {}, radio, option.label));
      }
      label.removeAttribute("for");
      wrap.append(
        group,
        el("p", { class: "field-error", id: `error-${field.id}` }),
      );
      return wrap;
    }
    if (field.type === "select")
      input = el(
        "select",
        {},
        el("option", { value: "" }, "Choose an answer"),
        field.options.map((o) => el("option", { value: o.value }, o.label)),
      );
    else if (field.type === "textarea")
      input = el("textarea", { rows: 3, maxlength: field.maxLength });
    else
      input = el("input", {
        type:
          field.type === "checkbox"
            ? "checkbox"
            : field.type === "date" || field.type === "futureDate"
              ? "date"
              : field.type === "email"
                ? "email"
                : field.type === "tel"
                  ? "tel"
                  : "text",
        maxlength: field.maxLength,
        autocomplete: "off",
        spellcheck: "false",
      });
    input.id = field.id;
    input.name = field.id;
    input.dataset.control = "";
    input.setAttribute(
      "aria-describedby",
      `${field.help ? `help-${field.id} ` : ""}error-${field.id}`,
    );
    if (field.required) input.setAttribute("aria-required", "true");
    if (field.type === "country") {
      input.setAttribute("list", "countries");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("placeholder", "Type to find a country");
    }
    if (field.type === "date")
      input.max = new Date().toISOString().slice(0, 10);
    if (field.type === "futureDate")
      input.min = new Date().toISOString().slice(0, 10);
    if (field.type === "checkbox") input.checked = !!draft.answers[field.id];
    else input.value = draft.answers[field.id] || "";
    input.addEventListener("focus", () =>
      activate(field.id, { scroll: false, focus: false }),
    );
    input.addEventListener("input", () => {
      draft.answers[field.id] =
        field.type === "checkbox" ? input.checked : input.value;
      changed();
    });
    input.addEventListener("blur", () => {
      touched.add(field.id);
      updateProgress();
    });
    input.addEventListener("change", () => {
      if (
        [
          "entrant.marital",
          "passport.path",
          "passport.samePage",
          "eligibility.basis",
        ].includes(field.id)
      ) {
        renderDocument();
        activate(field.id, { scroll: false });
        announce(
          "Relevant questions updated. Your previous answers are retained in this tab.",
        );
      }
    });
    if (field.type === "checkbox") wrap.prepend(input);
    else wrap.append(field.type === "country" ? enhanceCountry(input) : input);
    if (field.exception) {
      const exception = el("input", {
        type: "checkbox",
        id: field.exception,
        checked: !!draft.answers[field.exception],
        onchange: () => {
          draft.answers[field.exception] = exception.checked;
          input.disabled = exception.checked;
          changed();
        },
      });
      input.disabled = !!draft.answers[field.exception];
      wrap.append(
        el(
          "label",
          { class: "exception", for: field.exception },
          exception,
          field.exceptionLabel,
        ),
      );
    }
  }
  wrap.append(el("p", { class: "field-error", id: `error-${field.id}` }));
  return wrap;
}
function mediaControl(field) {
  const area = el("div", { class: "media-control" });
  const asset = draft.assets[field.id];
  const upload = el("input", {
    type: "file",
    accept: "image/jpeg,image/png,image/webp,image/heic,image/heif",
    class: "sr-only",
    id: `file-${field.id}`,
    "aria-label": `Upload ${field.label}`,
    tabindex: "-1",
  });
  const camera = el("input", {
    type: "file",
    accept: "image/*",
    capture: field.type === "photo" ? "user" : "environment",
    class: "sr-only",
    id: `camera-${field.id}`,
    "aria-label": `Capture ${field.label}`,
    tabindex: "-1",
  });
  const info = el(
    "p",
    { class: "media-status", role: "status" },
    asset
      ? `${field.type === "photo" ? "Technical checks passed" : "JPEG prepared"} · ${asset.width} × ${asset.height} · ${Math.ceil(asset.blob.size / 1024)} KB`
      : "No image selected",
  );
  const choose = button(
    asset ? "Replace image" : "Upload image",
    () => upload.click(),
    {
      "data-control": "",
      id: field.id,
      class: "button",
      "aria-label": `Upload ${field.label.toLowerCase()}`,
    },
  );
  choose.addEventListener("focus", () =>
    activate(field.id, { scroll: false, focus: false }),
  );
  if (asset)
    area.append(
      el("img", {
        class: field.type === "photo" ? "document-photo" : "passport-preview",
        src: asset.url,
        alt: `Your ${field.label.toLowerCase()} preview`,
      }),
    );
  else
    area.append(
      el(
        "div",
        { class: "photo-placeholder", "aria-hidden": "true" },
        field.type === "photo" ? "＋" : "▤",
      ),
    );
  area.append(
    info,
    el(
      "div",
      { class: "media-actions" },
      choose,
      button("Take photo", () => camera.click(), {
        class: "button",
        "aria-label": `Take ${field.label.toLowerCase()}`,
      }),
    ),
    upload,
    camera,
  );
  for (const input of [upload, camera])
    input.addEventListener("change", async () => {
      const targetDraft = draft;
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      choose.disabled = true;
      info.textContent = "Preparing image on this device…";
      try {
        if (field.type === "photo") {
          const source = await readImage(file);
          if (draft !== targetDraft || view !== "document") return;
          openCrop(field, source);
        } else {
          const copy = await passportCopy(file);
          if (draft !== targetDraft || view !== "document") return;
          setAsset(field.id, copy);
          renderDocument();
          activate(field.id, { scroll: false });
        }
      } catch (error) {
        info.textContent = error.message;
        info.classList.add("error");
        announce(error.message);
      } finally {
        choose.disabled = false;
      }
    });
  if (asset) {
    area.append(
      button(
        "Remove image",
        () => {
          URL.revokeObjectURL(asset.url);
          delete draft.assets[field.id];
          changed();
          renderDocument();
          activate(field.id, { scroll: false });
        },
        { class: "text-button" },
      ),
    );
    if (field.type === "photo") {
      const confirm = el("input", {
        type: "checkbox",
        checked: !!asset.confirmed,
        onchange: () => {
          asset.confirmed = confirm.checked;
          changed();
        },
      });
      area.append(
        el(
          "label",
          { class: "photo-confirm" },
          confirm,
          "I confirm this photo is recent (within six months), shows my current appearance, has a plain light background, and meets the official visual rules.",
        ),
      );
    }
    if (field.id === "passport.bio")
      area.append(
        button("Scan and review passport details", () => openScan(asset), {
          class: "button",
        }),
      );
  }
  if (field.type === "photo")
    area.append(
      el(
        "details",
        { class: "photo-advice" },
        el("summary", {}, "Framing guidance & examples"),
        el(
          "div",
          { class: "photo-examples" },
          el(
            "div",
            {},
            el(
              "div",
              { class: "face-example correct", "aria-hidden": "true" },
              "◯",
            ),
            el("strong", {}, "Good framing"),
            el("p", {}, "Face forward; eyes visible; plain light background."),
          ),
          el(
            "div",
            {},
            el(
              "div",
              { class: "face-example incorrect", "aria-hidden": "true" },
              "◯",
            ),
            el("strong", {}, "Check again"),
            el(
              "p",
              {},
              "Avoid a tilted head, shadows, glasses, filters, or a busy background.",
            ),
          ),
        ),
        link(
          "View official photo examples ↗",
          "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/photo-examples.html",
          { target: "_blank", rel: "noopener noreferrer" },
        ),
        el(
          "p",
          {},
          "Cropping changes framing only. We do not retouch faces. Automated checks cannot confirm identity, age, background quality, or government acceptance.",
        ),
      ),
    );
  return area;
}
function setAsset(id, value) {
  if (draft.assets[id]) URL.revokeObjectURL(draft.assets[id].url);
  draft.assets[id] = { ...value, url: URL.createObjectURL(value.blob) };
  changed();
}
function openDialog(title, content, cleanup) {
  closeDialog();
  dialogTrigger = document.activeElement;
  dialogCleanup = cleanup;
  dialog = el(
    "dialog",
    { class: "workspace-dialog", "aria-labelledby": "dialog-title" },
    el(
      "div",
      { class: "dialog-heading" },
      el("h2", { id: "dialog-title" }, title),
      button("×", closeDialog, {
        "aria-label": "Close dialog",
        class: "dialog-close",
      }),
    ),
    content,
  );
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeDialog();
  });
  app.append(dialog);
  document.body.classList.add("dialog-open");
  dialog.showModal();
}
function closeDialog() {
  if (!dialog) return;
  dialogCleanup?.();
  dialogCleanup = null;
  dialog.close();
  dialog.remove();
  dialog = null;
  document.body.classList.remove("dialog-open");
  dialogTrigger?.focus?.({ preventScroll: true });
}
function openCrop(field, source) {
  const canvas = el("canvas", { "aria-label": "Square photo crop preview" });
  const sliders = {};
  const redraw = () => {
    const side = drawCrop(
      canvas,
      source,
      Number(sliders.zoom.value),
      Number(sliders.x.value),
      Number(sliders.y.value),
    );
    quality.textContent =
      side < 600
        ? "This crop has fewer than 600 source pixels. Choose a higher-resolution photo to avoid enlarging it."
        : "Move the frame to include your whole head and shoulders. Compare with the official examples.";
    use.disabled = side < 600;
  };
  const controls = el("div", { class: "crop-controls" });
  for (const [key, label, min, max, step, value] of [
    ["zoom", "Crop zoom", 1, 3, 0.05, 1],
    ["x", "Horizontal position", 0, 100, 1, 50],
    ["y", "Vertical position", 0, 100, 1, 50],
  ]) {
    const input = el("input", {
      type: "range",
      min,
      max,
      step,
      value,
      id: `crop-${key}`,
      oninput: redraw,
    });
    sliders[key] = input;
    controls.append(el("label", { for: `crop-${key}` }, label, input));
  }
  const quality = el("p", { class: "notice" });
  const use = button(
    "Use this photo",
    async () => {
      use.disabled = true;
      try {
        setAsset(field.id, await photoCopy(canvas));
        closeDialog();
        renderDocument();
        activate(field.id, { scroll: false });
      } catch (e) {
        quality.textContent = e.message;
        use.disabled = false;
      }
    },
    { class: "button primary" },
  );
  openDialog(
    "Frame your photograph",
    el(
      "div",
      {},
      el(
        "div",
        { class: "crop-preview" },
        canvas,
        el("span", { class: "face-outline", "aria-hidden": "true" }),
      ),
      controls,
      quality,
      el(
        "p",
        {},
        "The oval is a guide, not a face detector. Aim for the official head-size and eye-height proportions. No facial features are altered.",
      ),
      use,
    ),
  );
  redraw();
}
function scanEntry() {
  return el(
    "div",
    { class: "scan-entry" },
    button(
      el(
        "span",
        {},
        el("span", { "aria-hidden": "true" }, "▣ "),
        "Save time — Scan your passport",
      ),
      startPassportScan,
      { class: "scan-entry-button", "aria-haspopup": "dialog" },
    ),
    el("span", {}, "Optional · review before applying"),
  );
}
function startPassportScan() {
  const target = draft;
  const consent = el("input", { type: "checkbox", id: "scan-permission" });
  const upload = el("input", {
    type: "file",
    accept: "image/jpeg,image/png,image/webp,image/heic,image/heif",
    id: "scan-upload",
    class: "sr-only",
    tabindex: "-1",
    "aria-label": "Upload passport for scanning",
  });
  const camera = el("input", {
    type: "file",
    accept: "image/*",
    capture: "environment",
    id: "scan-camera",
    class: "sr-only",
    tabindex: "-1",
    "aria-label": "Take passport photo for scanning",
  });
  const take = button("Take Passport Photo", () => camera.click(), {
    disabled: true,
  });
  const choose = button("Upload Passport", () => upload.click(), {
    disabled: true,
  });
  consent.addEventListener("change", () => {
    take.disabled = choose.disabled = !consent.checked;
  });
  const info = el("p", { role: "status" });
  const abort = new AbortController();
  for (const input of [upload, camera])
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file || !consent.checked) return;
      take.disabled = choose.disabled = true;
      info.textContent = "Preparing a private image copy on this device…";
      try {
        const copy = await passportCopy(file);
        if (abort.signal.aborted || draft !== target) return;
        closeDialog();
        openScan(copy, { attach: true });
      } catch (e) {
        if (!abort.signal.aborted) {
          info.textContent = e.message;
          take.disabled = choose.disabled = false;
        }
      }
    });
  openDialog(
    "Scan your passport",
    el(
      "div",
      {},
      el(
        "p",
        {},
        "Automatically fill supported details. You'll review everything before continuing. Include the whole photo page and both lines at the bottom.",
      ),
      el(
        "p",
        { class: "notice" },
        "Reading happens on this device. Only after you confirm will the image join this worksheet. Paid saving uploads the copy to your private account. You can replace or remove it. No advertising or external AI receives this scan.",
      ),
      el(
        "label",
        { class: "photo-confirm", for: "scan-permission" },
        consent,
        "I have permission to process this passport and understand how the confirmed copy is saved.",
      ),
      el(
        "div",
        { class: "scan-choices" },
        take,
        choose,
        button("Enter Manually", closeDialog),
      ),
      upload,
      camera,
      info,
      link("Privacy and retention", "/policies/#privacy", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    ),
    () => abort.abort(),
  );
}
async function openScan(asset, { attach = false } = {}) {
  const target = draft,
    abort = new AbortController(),
    preview = URL.createObjectURL(asset.blob);
  const info = el("p", { role: "status" }, "Reading on your device…");
  const details = el("div", { class: "scan-values" });
  const body = el(
    "div",
    {},
    info,
    el(
      "div",
      { class: "scan-review" },
      el(
        "div",
        { class: "scan-image" },
        el("img", {
          src: preview,
          alt: "Passport image to compare with every suggested value",
        }),
      ),
      details,
    ),
  );
  openDialog("Please verify your passport information", body, () => {
    abort.abort();
    URL.revokeObjectURL(preview);
  });
  try {
    const values = await scanPassport(
      asset.blob,
      countryNames,
      (p) => {
        info.textContent = `Reading on your device… ${p}%`;
      },
      abort.signal,
    );
    if (abort.signal.aborted || draft !== target) return;
    info.textContent =
      values.mrzStatus === "checked"
        ? "MRZ checksums passed. This checks transcription only; verify every value against the image."
        : "Low confidence — the full MRZ could not be verified. Check the suggestions and enter missing details manually.";
    info.className = "notice";
    for (const issue of values.issues || [])
      details.append(el("p", { class: "scan-warning" }, issue));
    details.append(
      el(
        "p",
        {},
        "All given names may be together. Separate middle names only as your passport shows them. Scanning does not verify DV eligibility.",
      ),
    );
    const inputs = {};
    values.fullName = [values.firstName, values.middleName, values.lastName]
      .filter(Boolean)
      .join(" ");
    const mapping = [
      ["lastName", "Last / family name", "entrant.lastName", "text"],
      ["firstName", "First / given name", "entrant.firstName", "text"],
      ["middleName", "Middle name", "entrant.middleName", "text"],
      ["fullName", "Full name on passport", "passport.name", "text"],
      ["birthDate", "Date of birth", "entrant.birthDate", "date"],
      ["sex", "Sex", "entrant.sex", "select"],
      ["number", "Passport number", "passport.number", "text"],
      ["issuer", "Issuing country / authority", "passport.issuer", "text"],
      ["expiry", "Expiration date", "passport.expiry", "date"],
      [
        "country",
        "Country of birth — only if printed",
        "entrant.birthCountry",
        "country",
      ],
    ];
    for (const [key, label, id, type] of mapping) {
      const input =
        type === "select"
          ? el(
              "select",
              {},
              el("option", { value: "" }, "Confirm manually"),
              ...["Male", "Female"].map((v) => el("option", { value: v }, v)),
            )
          : el("input", {
              type: type === "date" ? "date" : "text",
              autocomplete: "off",
              spellcheck: "false",
            });
      input.id = `scan-${key}`;
      input.value = values[key] || "";
      inputs[key] = input;
      details.append(
        el(
          "div",
          { class: `scan-field ${input.value ? "" : "scan-missing"}` },
          el("label", { for: input.id }, label),
          type === "country" ? enhanceCountry(input) : input,
          el(
            "small",
            {},
            input.value
              ? "Review this suggestion"
              : "Not read reliably · enter manually or leave unchanged",
          ),
        ),
      );
    }
    if (values.nationalityCode)
      details.append(
        el(
          "p",
          {},
          `Nationality code on passport: ${values.nationalityCode}. Not copied to birth country or eligibility.`,
        ),
      );
    const error = el("p", { class: "error", role: "status" });
    const confirm = button(
      "I reviewed and confirm these details",
      () => {
        if (draft !== target) return;
        if (
          inputs.country.value &&
          !countryNames.includes(inputs.country.value)
        ) {
          error.textContent =
            "Choose a country from the list or leave country of birth blank.";
          return;
        }
        for (const [key, , id] of mapping)
          if (inputs[key].value.trim()) {
            draft.answers[id] = inputs[key].value.trim();
            if (["firstName", "middleName", "lastName"].includes(key))
              draft.answers[
                `entrant.no${key[0].toUpperCase()}${key.slice(1)}`
              ] = false;
          }
        if (attach) {
          draft.answers["passport.path"] = "passport";
          setAsset("passport.bio", asset);
        }
        changed();
        closeDialog();
        renderDocument();
        activate("entrant.lastName");
        announce(
          "Reviewed passport details applied. Confirm all remaining questions.",
        );
      },
      { class: "button primary" },
    );
    body.append(
      el(
        "p",
        {},
        "Blank suggestions leave your existing answers unchanged. Birth country, residence and eligibility remain separate. Confirming a new scan selects the passport path; signature-page and eligibility confirmations still need your review.",
      ),
      error,
      confirm,
      button("Discard scan", closeDialog),
    );
  } catch (e) {
    if (!abort.signal.aborted) {
      info.textContent =
        "We could not reliably read this passport. No answers or files were changed.";
      body.append(button("Enter Manually", closeDialog));
    }
  }
}
function familyControls() {
  const count = el(
    "strong",
    {},
    `${draft.childIds.length} ${draft.childIds.length === 1 ? "child" : "children"} listed`,
  );
  return el(
    "div",
    { class: "family-tools" },
    el(
      "div",
      {},
      el("h3", {}, "14. Number of children"),
      count,
      el(
        "p",
        {},
        "Add each required child below. There is no three-person package limit. Changing packages never removes family information.",
      ),
    ),
    button(
      "+ Add a child",
      () => {
        const id = crypto.randomUUID();
        draft.childIds.push(id);
        changed();
        renderDocument();
        activate(`child.${id}.lastName`);
      },
      { class: "button" },
    ),
    el(
      "p",
      {},
      "If no children must be listed, leave this count at zero and confirm the family checklist.",
    ),
    el(
      "label",
      { class: "second-entry" },
      el("input", {
        type: "checkbox",
        checked: draft.secondEntry,
        onchange: (e) => {
          draft.secondEntry = e.target.checked;
          changed();
          renderDocument();
        },
      }),
      "I also want to prepare a separate entry for an independently eligible spouse.",
    ),
    el("p", { "data-recommendation": "", class: "recommendation" }),
    button("Review packages", openPackages, { class: "text-button" }),
    draft.secondEntry && hasSpouse(draft)
      ? button("Prepare spouse’s separate worksheet", openSpouseWorksheet, {
          class: "button",
        })
      : null,
    draft.secondEntry && !hasSpouse(draft)
      ? el(
          "p",
          { class: "notice" },
          "Complete the applicable marital status and required spouse details first. A separate entry requires independent eligibility.",
        )
      : null,
  );
}
function openSpouseWorksheet() {
  const existing = relatedDrafts.get(draft);
  if (existing && sessionDrafts.includes(existing)) {
    draft = existing;
    touched.clear();
    active = "entrant.lastName";
    navigate("document");
    return;
  }
  const permission = el("input", { type: "checkbox", id: "spouse-permission" });
  const reuse = el("input", { type: "checkbox", id: "spouse-reuse" });
  const create = button(
    "Create separate worksheet",
    () => {
      if (!permission.checked) return;
      const source = draft;
      const next = spouseWorksheet(source, { reuse: reuse.checked });
      sessionDrafts.push(next);
      cloud.link(source, next);
      relatedDrafts.set(source, next);
      relatedDrafts.set(next, source);
      closeDialog();
      draft = next;
      touched.clear();
      active = "entrant.lastName";
      changed();
      navigate("document");
    },
    { class: "button primary", disabled: true },
  );
  permission.addEventListener("change", () => {
    create.disabled = !permission.checked;
  });
  openDialog(
    "A separate principal entry",
    el(
      "div",
      {},
      el(
        "p",
        {},
        "Each principal entrant must independently meet the official requirements. A second worksheet is not an official entry, and it must not duplicate an entry already submitted for that person.",
      ),
      el(
        "label",
        { class: "photo-confirm", for: "spouse-permission" },
        permission,
        "I have permission to prepare this person’s information and will verify their independent eligibility.",
      ),
      el(
        "label",
        { class: "photo-confirm", for: "spouse-reuse" },
        reuse,
        "Reuse the names, birth details, address, and child information already entered. I will review each copied answer.",
      ),
      el(
        "p",
        {},
        "Photographs, passports, email, and eligibility confirmations are not copied. Both worksheets stay in this tab only. No package change or payment occurs.",
      ),
      create,
    ),
  );
}
function renderDocument() {
  documentArea.replaceChildren();
  sidebar.replaceChildren();
  let page = null,
    pageNumber = null;
  for (const section of sections(draft)) {
    if (section.page !== pageNumber) {
      pageNumber = section.page;
      page = el(
        "article",
        {
          class: "document-page",
          "aria-label": `Worksheet page ${pageNumber}`,
        },
        el(
          "div",
          { class: "document-masthead" },
          el(
            "div",
            {},
            el("strong", {}, "GREEN CARD"),
            el("span", {}, "APPLICATION SERVICES"),
          ),
          el(
            "div",
            {},
            el("strong", {}, "UNOFFICIAL PREPARATION WORKSHEET"),
            el("span", {}, `DV-${draft.year} · Worksheet ${pageNumber}`),
          ),
        ),
        el("p", { class: "document-part" }, section.part),
      );
      documentArea.append(page);
    }
    const sec = el(
      "section",
      { class: "document-section", id: `section-${section.id}` },
      section.id === "identity" ? scanEntry() : null,
      ...questionGroups(section).map((group) =>
        el(
          "div",
          { class: "question-group" },
          el("h2", {}, group.title),
          el(
            "div",
            {
              class: `document-fields ${group.fields.length === 3 && group.fields.every((f) => f.type === "name") ? "name-fields" : ""}`,
            },
            group.fields.map(makeField),
          ),
        ),
      ),
    );
    if (section.id === "family") sec.append(familyControls());
    if (section.childId)
      sec.append(
        button(
          "Remove this child",
          () => {
            openDialog(
              "Remove this child from the worksheet?",
              el(
                "div",
                {},
                el(
                  "p",
                  {},
                  "Only remove a person who does not need to be listed. This deletes their answers and photo from this tab.",
                ),
                button("Keep child", closeDialog, { class: "button" }),
                button(
                  "Remove child",
                  () => {
                    const prefix = `child.${section.childId}.`;
                    draft.childIds = draft.childIds.filter(
                      (id) => id !== section.childId,
                    );
                    for (const key of Object.keys(draft.answers))
                      if (key.startsWith(prefix)) delete draft.answers[key];
                    for (const key of Object.keys(draft.assets))
                      if (key.startsWith(prefix)) {
                        URL.revokeObjectURL(draft.assets[key].url);
                        delete draft.assets[key];
                      }
                    closeDialog();
                    changed();
                    renderDocument();
                    activate("family.confirm");
                  },
                  { class: "button danger" },
                ),
              ),
            );
          },
          { class: "text-button" },
        ),
      );
    page.append(sec);
    sidebar.append(
      button(section.title, () => activate(section.fields[0].id), {
        "data-section-link": section.id,
      }),
    );
  }
  documentArea.append(
    el(
      "div",
      { class: "document-end" },
      el(
        "p",
        {},
        "Every answer is editable. Required family members are included on every plan.",
      ),
      button("Review my worksheet", () => navigate("review"), {
        class: "button primary",
      }),
    ),
  );
  display.replaceChildren(
    el(
      "div",
      { class: "workspace-intro" },
      el("h1", {}, "Guided DV Entry Preparation"),
      el(
        "div",
        { class: "document-options" },
        notice,
        button("Fit width", () => setDocumentZoom(false), {
          class: "zoom-control",
          "aria-label": "Fit document to width",
        }),
        button("Larger text", () => setDocumentZoom(true), {
          class: "zoom-control",
          "aria-label": "Enlarge document text",
        }),
      ),
    ),
    documentArea,
  );
  updateProgress();
  activate(active, { scroll: false, focus: false });
}
function setDocumentZoom(large) {
  document.body.classList.toggle("document-large", large);
  announce(
    large
      ? "Document text enlarged. Browser pinch zoom is also available."
      : "Document fits the available width.",
  );
}
function openActions() {
  const body = el(
    "div",
    { class: "actions-list" },
    button("Save Progress", () => {
      closeDialog();
      openSave();
    }),
    button("Review Document", () => navigate("review")),
    button("Missing Fields", () => {
      closeDialog();
      openMissing();
    }),
    button(
      `${PACKAGES[draft.package].label} · ${price(draft.package)} · Package`,
      () => {
        closeDialog();
        openPackages();
      },
    ),
    button("Requirements / Help", () => {
      closeDialog();
      openSources();
    }),
    button("Exit Preparation", () => {
      closeDialog();
      header.querySelector("a").click();
    }),
  );
  openDialog("Preparation actions", body);
  dialog.classList.add("actions-sheet");
}
function openFieldHelp(field) {
  openDialog(
    field.label,
    el(
      "div",
      {},
      el("p", {}, field.help),
      field.id.startsWith("eligibility.")
        ? link(
            "Official instructions and alternative chargeability",
            "https://travel.state.gov/content/travel/en/us-visas/immigrate/diversity-visa-program-entry/diversity-visa-instructions.html",
            { target: "_blank", rel: "noopener noreferrer" },
          )
        : null,
      button("Back to field", () => {
        closeDialog();
        activate(field.id);
      }),
    ),
  );
}

function openMissing() {
  const p = preparationProgress(draft, relatedDrafts.get(draft), countryNames);
  const list = el(
    "div",
    { class: "missing-list" },
    p.remaining.length
      ? p.remaining.map(({ field, error, record }) =>
          button(
            el(
              "span",
              {},
              el("strong", {}, field.label),
              el(
                "small",
                {},
                `${record && record !== draft ? "Related principal · " : ""}${error}`,
              ),
            ),
            () => {
              closeDialog();
              if (field.id === "secondEntry") {
                if (hasSpouse(draft)) openSpouseWorksheet();
                else {
                  navigate("document");
                  activate("entrant.marital");
                }
                return;
              }
              if (record && record !== draft) {
                draft = record;
                touched.clear();
                navigate("document");
              }
              touched.add(field.id);
              if (view !== "document") navigate("document");
              activate(field.id);
            },
            { class: "missing-item" },
          ),
        )
      : el(
          "p",
          {},
          "All required fields pass the available completeness checks. Review your answers and warnings before using them.",
        ),
  );
  openDialog(`${p.remaining.length} items remaining`, list);
}
function openSources() {
  openDialog(
    "Requirements & sources",
    el(
      "div",
      {},
      el(
        "p",
        {},
        "Independent DV preparation worksheet. Not an official government form, submission, confirmation or eligibility decision.",
      ),
      el("p", { class: "notice" }, FORM_VERSION.notice),
      el(
        "p",
        {},
        "Unsaved answers and images stay in this tab. After payment and your consent, Save Progress sends them to private account storage. Saved files expire after 365 days without a save. You can delete them earlier.",
      ),
      link("Privacy notice", "/policies/#privacy", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      el(
        "p",
        {},
        `Verified ${FORM_VERSION.verified} · schema ${FORM_VERSION.id}`,
      ),
      el(
        "ul",
        { class: "source-list" },
        FORM_VERSION.sources.map(([label, url]) =>
          el(
            "li",
            {},
            link(label + " ↗", url, {
              target: "_blank",
              rel: "noopener noreferrer",
            }),
          ),
        ),
      ),
      el(
        "p",
        {},
        "Final DV-2027 country eligibility, exact form wording, photo specifications, and passport exemption workflow must be reconciled before this becomes a final-year form. No automated eligibility decision is made.",
      ),
    ),
  );
}
function openPackages() {
  const cards = Object.entries(PACKAGES).map(([key, p]) =>
    el(
      "article",
      { class: `package-choice ${key === draft.package ? "selected" : ""}` },
      el("h3", {}, p.label, el("span", {}, price(key))),
      el("p", {}, p.description),
      button(
        p.disabled
          ? "Under review"
          : key === draft.package
            ? "Selected"
            : `Select ${p.label}`,
        () => {
          draft.package = key;
          changed();
          closeDialog();
          announce(`${p.label} selected. No payment was made.`);
          if (view === "review") renderReview();
        },
        {
          class: "button",
          disabled:
            !!p.disabled ||
            key === draft.package ||
            cloud.info(draft)?.state === "paid" ||
            !!cloud.info(draft)?.checkoutStarted,
        },
      ),
    ),
  );
  openDialog(
    "Review your package",
    el(
      "div",
      {},
      el(
        "p",
        {},
        "One-time USD prices. No subscription. All legally required spouse and child details belong on every principal worksheet, including Single.",
      ),
      el(
        "p",
        { class: "notice" },
        "Selecting a package does not charge you. The exact price is shown before Stripe checkout. Purchased bundles and open checkouts keep their original package; contact support for upgrades.",
      ),
      el("div", { class: "package-choices" }, cards),
    ),
  );
}
function openSave() {
  return cloud.save(draft);
}
function renderReview() {
  const p = preparationProgress(draft, relatedDrafts.get(draft), countryNames);
  const complete = p.remaining.length === 0;
  const hero = el(
    "div",
    { class: "review-heading" },
    el("p", { class: "eyebrow" }, "YOUR FINAL LOOK"),
    el(
      "h1",
      {},
      complete
        ? "Your preparation worksheet is ready."
        : "Let’s check your worksheet.",
    ),
    el(
      "p",
      {},
      complete
        ? "Your information has passed our available completeness and format checks. Please verify every answer before using it for an official DV entry."
        : `${p.remaining.length} required items still need attention. Every section below can be edited.`,
    ),
    el(
      "p",
      { class: "notice" },
      "DV-2027 requirements are provisional. “Ready” describes completeness only; final-year requirements and your eligibility still need verification.",
    ),
  );
  const cards = worksheetRows(draft).map((section) => {
    const missing = section.fields.filter((f) => f.required && fieldError(f));
    const rows = section.fields.map((f) => {
      const value = f.value;
      return el("div", {}, el("dt", {}, f.label), el("dd", {}, value));
    });
    return el(
      "article",
      { class: "review-card" },
      el(
        "div",
        { class: "review-card-heading" },
        el("h2", {}, section.title),
        el(
          "span",
          { class: missing.length ? "status-amber" : "status-green" },
          missing.length ? `${missing.length} remaining` : "Complete",
        ),
        button(
          "Edit",
          () => {
            navigate("document");
            activate(section.fields[0].id);
          },
          { class: "text-button", "aria-label": `Edit ${section.title}` },
        ),
      ),
      el("dl", {}, rows),
    );
  });
  display.replaceChildren(
    hero,
    el("div", { class: "review-content" }, cards),
    el(
      "aside",
      { class: "review-warnings" },
      el("h2", {}, "Before you use this worksheet"),
      el(
        "ul",
        {},
        warnings(draft).map((w) => el("li", {}, w)),
      ),
      el(
        "p",
        {},
        "Submit the official entry separately. Do not submit duplicate entries for the same person. A derivative is not automatically eligible for a separate principal entry.",
      ),
    ),
    el(
      "div",
      { class: "review-actions" },
      el(
        "p",
        {},
        `${PACKAGES[draft.package].label} · ${price(draft.package)} USD · ${cloud.info(draft)?.state === "paid" ? "Purchased" : "Not purchased"}`,
      ),
      button("Preview prepared worksheet", () => navigate("preview"), {
        class: "button",
      }),
      button("Save & receive PDF", openSave, { class: "button primary" }),
    ),
  );
}
function householdIndex() {
  return el(
    "section",
    { class: "dashboard-card household-index" },
    el("h2", {}, "Household document index"),
    el(
      "p",
      {},
      "Check required files for each principal worksheet. All required relatives remain included on every plan. This summary does not confirm eligibility or government acceptance.",
    ),
    sessionDrafts.map((record, i) => {
      const status = progress(record, countryNames);
      const media = worksheetRows(record).flatMap((section) =>
        section.fields
          .filter((field) => ["photo", "passportPhoto"].includes(field.type))
          .map((field) =>
            el("li", {}, `${section.title} · ${field.label}: ${field.value}`),
          ),
      );
      const name =
        [
          record.answers["entrant.firstName"],
          record.answers["entrant.lastName"],
        ]
          .filter(Boolean)
          .join(" ") || `Principal ${i + 1}`;
      return el(
        "section",
        {},
        el("h3", {}, name),
        el(
          "p",
          {},
          `${record.childIds.length} required children listed · ${hasSpouse(record) ? "Spouse details required" : "Review marital-status requirements"} · ${status.remaining.length} required items remaining`,
        ),
        el("ul", {}, media),
      );
    }),
  );
}
function renderDashboard() {
  const cards = sessionDrafts.map((record) =>
    el(
      "article",
      { class: "dashboard-card" },
      el(
        "span",
        { class: "edition-badge" },
        cloud.info(record)?.state === "paid"
          ? "Purchased preparation"
          : "Current session · unsaved",
      ),
      el(
        "h2",
        {},
        [
          record.answers["entrant.firstName"],
          record.answers["entrant.lastName"],
        ]
          .filter(Boolean)
          .join(" ") || "Untitled preparation",
      ),
      el(
        "p",
        {},
        `DV-${record.year} · ${PACKAGES[record.package].label} · ${progress(record, countryNames).percent}% complete`,
      ),
      el(
        "p",
        {},
        cloud.info(record)?.updated_at
          ? `Last cloud save: ${new Date(cloud.info(record).updated_at).toLocaleString()}`
          : "Last cloud save: never · No saved purchase",
      ),
      el(
        "div",
        { class: "dashboard-actions" },
        button(
          "Edit document",
          () => {
            draft = record;
            touched.clear();
            active = "entrant.lastName";
            navigate("document");
          },
          { class: "button primary" },
        ),
        button("Download PDF", () => cloud.download(record), {
          class: "button",
          disabled: !CAPABILITIES.pdfDownload,
        }),
        button("Email secure link", () => cloud.email(record), {
          class: "button",
          disabled: !CAPABILITIES.emailDelivery,
        }),
        button(
          "Review package",
          () => {
            draft = record;
            openPackages();
          },
          { class: "button" },
        ),
        button(
          "Delete this draft",
          () =>
            openDialog(
              cloud.info(record)?.state === "paid"
                ? "Delete this saved preparation?"
                : "Delete this unsaved draft?",
              el(
                "div",
                {},
                el(
                  "p",
                  {},
                  cloud.info(record)?.state === "paid"
                    ? "This permanently removes all worksheets and passport/photo copies in this purchased bundle. Financial references remain for payment records. This cannot be undone."
                    : "This removes this worksheet’s answers and images from this tab. There is no cloud copy to recover. Other worksheets remain.",
                ),
                button("Keep draft", closeDialog, { class: "button" }),
                button(
                  "Delete draft",
                  async () => {
                    if (cloud.info(record)?.state === "paid") {
                      try {
                        await cloud.remove(record);
                        closeDialog();
                      } catch (e) {
                        announce(e.message);
                      }
                      return;
                    }
                    for (const a of Object.values(record.assets))
                      URL.revokeObjectURL(a.url);
                    const related = relatedDrafts.get(record);
                    if (related) relatedDrafts.delete(related);
                    relatedDrafts.delete(record);
                    record.answers = {};
                    record.assets = {};
                    record.childIds = [];
                    sessionDrafts.splice(sessionDrafts.indexOf(record), 1);
                    if (!sessionDrafts.length)
                      sessionDrafts.push(initialDraft());
                    if (draft === record) draft = sessionDrafts[0];
                    dirty = sessionDrafts.some(
                      (d) =>
                        Object.keys(d.answers).length ||
                        Object.keys(d.assets).length,
                    );
                    touched.clear();
                    active = "entrant.lastName";
                    closeDialog();
                    navigate("dashboard");
                  },
                  { class: "button danger" },
                ),
              ),
            ),
          { class: "text-button" },
        ),
      ),
    ),
  );
  display.replaceChildren(
    el(
      "div",
      { class: "review-heading" },
      el("p", { class: "eyebrow" }, "YOUR DOCUMENTS, TOGETHER"),
      el("h1", {}, "My DV Preparations"),
      el(
        "p",
        {},
        "Each principal entrant has a separate worksheet. Your work remains available while this tab stays open.",
      ),
    ),
    el(
      "div",
      { class: "dashboard-notice" },
      el(
        "h2",
        {},
        CAPABILITIES.accounts
          ? "Your saved preparations"
          : "Cloud accounts are awaiting activation",
      ),
      el(
        "p",
        {},
        CAPABILITIES.accounts
          ? "Sign in with your verified email to open purchased preparations."
          : unavailable,
      ),
      button(
        CAPABILITIES.accounts
          ? "Sign in / open saved preparations"
          : "Email sign-in unavailable",
        cloud.dashboard,
        {
          class: "button",
          disabled: !CAPABILITIES.accounts,
        },
      ),
    ),
    ...cards,
    ...(sessionDrafts.some((record) => record.package === "family")
      ? [householdIndex()]
      : []),
  );
}
function renderPreview() {
  display.replaceChildren(
    el(
      "div",
      { class: "preview-toolbar" },
      button("← Back to review", () => navigate("review"), { class: "button" }),
      el(
        "p",
        {},
        CAPABILITIES.pdfDownload
          ? "Document preview · download your PDF after saving a completed, purchased preparation."
          : "Document preview · secure PDF download will be enabled with verified payment and backend delivery.",
      ),
      button(
        CAPABILITIES.pdfDownload ? "Download PDF" : "Download PDF unavailable",
        () => cloud.download(draft),
        {
          class: "button",
          disabled: !CAPABILITIES.pdfDownload,
        },
      ),
    ),
    worksheet(draft),
  );
}
function navigate(next) {
  if (dialog) closeDialog();
  if (!["document", "review", "dashboard", "preview"].includes(next))
    next = "document";
  view = next;
  if (location.hash !== `#${view}`) history.pushState(null, "", `#${view}`);
  document.body.dataset.view = view;
  if (view === "document") renderDocument();
  else if (view === "review") renderReview();
  else if (view === "preview") renderPreview();
  else renderDashboard();
  bottom.hidden = view === "preview";
  sidebar.closest("aside").hidden = view !== "document";
  updateProgress();
  if (view !== "document") {
    display.querySelector("h1")?.setAttribute("tabindex", "-1");
    display.querySelector("h1")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}
window.addEventListener("popstate", () => navigate(location.hash.slice(1)));
window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue =
      "Your progress has not been saved to your account. Keep this tab open or save before leaving.";
  }
});
// Keep navigation within the application in memory; show a specific warning on exits.
header.querySelector("a").addEventListener("click", (event) => {
  if (!dirty) return;
  event.preventDefault();
  openDialog(
    "Leave this unsaved preparation?",
    el(
      "div",
      {},
      el(
        "p",
        {},
        "Your progress has not been saved to your account. Keep this tab open or save before leaving.",
      ),
      el("p", {}, "Keep this tab open to retain unsaved answers and images."),
      button("Keep working", closeDialog, { class: "button primary" }),
      button(
        "Leave and discard",
        () => {
          dirty = false;
          location.href = "/";
        },
        { class: "button" },
      ),
    ),
  );
});
navigate(location.hash.slice(1) || "document");
activate(active, { scroll: false, focus: false });

capabilities().then(() => {
  if (view === "dashboard") renderDashboard();
});
