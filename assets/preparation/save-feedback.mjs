import { el } from "./dom.mjs?v=20261017-workspace-v33";

// Server-confirmed instants, displayed in the browser's local timezone.
export function savedAt(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function savingBar() {
  return el("div", {
    class: "scan-progress save-progress",
    role: "progressbar",
    "aria-label": "Saving progress",
    "aria-valuetext": "Saving is in progress",
  });
}

export function saveIndicator() {
  const label = el("span", { class: "save-state-label" });
  const time = el("time", { class: "save-time", title: "Your local time" });
  const bar = savingBar();
  const node = el(
    "div",
    { class: "save-feedback", "aria-live": "polite", "aria-atomic": "true" },
    el("div", { class: "save-feedback-line" }, label, time),
    bar,
  );
  function update({ phase = "idle", text, timestamp } = {}, dirty = false) {
    const when = savedAt(timestamp);
    const busy = phase === "saving";
    bar.hidden = !busy;
    node.dataset.state = phase;
    label.textContent = busy
      ? text || "Saving progress…"
      : phase === "pending"
        ? "Answers saved · images pending"
        : phase === "error"
          ? "Not saved · try again"
          : dirty
            ? "Unsaved changes"
            : when
              ? "Saved"
              : "Not saved yet";
    time.hidden = !when || busy;
    time.textContent = when
      ? `${dirty || phase === "error" ? "Last saved " : ""}${when}`
      : "";
    time.setAttribute("aria-label", `Last saved ${when}, your local time`);
    if (when) time.dateTime = new Date(timestamp).toISOString();
    else time.removeAttribute("datetime");
  }
  update();
  return { node, update };
}
