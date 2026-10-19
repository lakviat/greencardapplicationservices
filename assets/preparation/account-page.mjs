import { el, button, link } from "./dom.mjs?v=20261019-workspace-v39";
import { PACKAGES, price } from "./schema.mjs?v=20261019-workspace-v39";
import { currentEntries } from "./entry-progress.mjs?v=20261019-workspace-v39";

import { savedAt } from "./save-feedback.mjs?v=20261019-workspace-v39";

export function accountPage({
  account,
  list,
  snapshot,
  subscribe,
  open,
  signOut,
  preparations,
  backToWorksheet,
  checkoutAvailable,
  submission,
}) {
  const content = el("section", {
    class: "account-content",
    "aria-live": "polite",
  });
  const output = el("p", { role: "status" });
  let selection = "orders";
  let request = 0;
  const tabs = {};
  let selectedId;
  let opening = false;
  let rendered;
  const canCheckout = () =>
    typeof checkoutAvailable === "function"
      ? checkoutAvailable()
      : checkoutAvailable;
  const show = (result) => {
    if (selection !== "orders" || !result) return;
    const value = JSON.stringify(result.preparations);
    if (rendered === value) return;
    rendered = value;
    drawEntries(result.preparations);
  };
  const select = (next) => {
    selection = next;
    Object.entries(tabs).forEach(([key, tab]) =>
      tab.setAttribute("aria-pressed", String(key === next)),
    );
    output.textContent = "";
  };
  const orders = async () => {
    select("orders");
    const current = ++request;
    const known = snapshot?.();
    if (known) show(known);
    else {
      rendered = undefined;
      content.replaceChildren(
        el(
          "div",
          { class: "entry-card account-loading", role: "status" },
          el("h2", {}, "My DV Lottery Entry"),
          el("p", {}, "Loading your saved progress…"),
          el("div", { class: "account-loading-bar", "aria-hidden": "true" }),
        ),
      );
    }
    if (!known) content.setAttribute("aria-busy", "true");
    try {
      const result = await list();
      if (selection !== "orders" || current !== request) return;
      show(result);
    } catch {
      if (selection !== "orders" || current !== request) return;
      if (snapshot?.()) {
        output.replaceChildren(
          "Showing your last loaded progress. We could not check for updates. ",
          button("Try again", orders, { class: "text-button" }),
        );
        return;
      }
      content.replaceChildren(
        el("h2", {}, "My DV Lottery Entry"),
        el(
          "p",
          {},
          "We could not load your preparations. Check your connection and try again.",
        ),
        button("Try again", orders, { class: "button" }),
      );
    } finally {
      if (current === request) content.removeAttribute("aria-busy");
    }
  };
  function drawEntries(records) {
    const entries = currentEntries(records);
    const p = entries.find((entry) => entry.id === selectedId) || entries[0];
    if (!p) {
      content.replaceChildren(
        el(
          "section",
          { class: "entry-card entry-empty" },
          el("h2", {}, "My DV Lottery Entry"),
          el(
            "p",
            {},
            "Your progress will appear here as you save your worksheet.",
          ),
          button("Start preparation", preparations, {
            class: "button primary",
          }),
        ),
      );
      return;
    }
    selectedId = p.id;
    const entry = p.entry;
    const act = (label, stage, attrs = {}) =>
      button(
        label,
        async (event) => {
          if (opening) return;
          opening = true;
          const control = event.currentTarget;
          control.disabled = true;
          output.textContent = "Opening your preparation…";
          try {
            await open(p.id, stage);
          } catch (error) {
            output.textContent = error.message;
          } finally {
            opening = false;
            control.disabled = false;
          }
        },
        attrs,
      );
    const status = (group) =>
      group?.done
        ? "Completed"
        : group?.complete
          ? "In progress"
          : "Not started";
    const stage = (name, label, done, key) =>
      el(
        "li",
        { class: `entry-stage${done ? " is-complete" : ""}` },
        el(
          "span",
          { class: "entry-stage-icon", "aria-hidden": "true" },
          done ? "✓" : "",
        ),
        key
          ? act(
              [
                el("span", { class: "entry-stage-name" }, name),
                el("span", { class: "entry-stage-status" }, label),
              ],
              key,
              {
                class: "entry-stage-link",
                "aria-label": `Edit ${name.toLowerCase()}: ${label}`,
              },
            )
          : el(
              "div",
              { class: "entry-stage-content" },
              el("span", { class: "entry-stage-name" }, name),
              el("span", { class: "entry-stage-status" }, label),
            ),
      );
    const progressValue = entry?.percent;
    const tracking =
      entry && submission
        ? el(
            "details",
            { class: "entry-submission-note" },
            el(
              "summary",
              {},
              entry.submissionReportedAt
                ? "Update my submission record"
                : "Already submitted? Record it here",
            ),
            el(
              "p",
              { class: "hint" },
              "This is your own record. We cannot verify government submission or acceptance.",
            ),
          )
        : null;
    if (tracking) {
      const check = el("input", {
        type: "checkbox",
        checked: !!entry.submissionReportedAt,
      });
      tracking.append(
        el(
          "label",
          { class: "entry-confirmation" },
          check,
          "I submitted this entry on the official DV website.",
        ),
        button(
          "Save submission status",
          async (event) => {
            const generation = request;
            const control = event.currentTarget;
            control.disabled = true;
            output.textContent = "Saving submission record…";
            try {
              const result = await submission(p.id, check.checked);
              p.entry = result.entry;
              if (selection !== "orders" || generation !== request) return;
              drawEntries(records);
              output.textContent =
                "Your submission record is saved. It has not been verified by the government.";
            } catch (error) {
              output.textContent = error.message;
            } finally {
              control.disabled = false;
            }
          },
          { class: "button" },
        ),
      );
    }
    const otherEntries =
      entries.length > 1
        ? el(
            "details",
            { class: "entry-other" },
            el(
              "summary",
              {},
              `Other saved preparations (${entries.length - 1})`,
            ),
            el(
              "p",
              { class: "hint" },
              "Earlier worksheets remain available. Saving an opened preparation updates that same entry.",
            ),
          )
        : null;
    if (otherEntries) {
      const choose = el(
        "select",
        { id: "account-entry-choice" },
        entries.map((item) =>
          el(
            "option",
            { value: item.id, selected: item.id === p.id },
            `${item.entry?.name || "Your preparation"} · DV-${item.year} · ${PACKAGES[item.package].label} · ${savedAt(item.updated_at)}`,
          ),
        ),
      );
      choose.addEventListener("change", () => {
        selectedId = choose.value;
        drawEntries(records);
      });
      otherEntries.append(
        el(
          "label",
          { for: "account-entry-choice" },
          "Choose a saved preparation",
        ),
        choose,
      );
    }
    content.replaceChildren(
      el(
        "article",
        { class: "entry-card" },
        el(
          "div",
          { class: "entry-card-heading" },
          el(
            "div",
            {},
            el("h2", {}, "My DV Lottery Entry"),
            el(
              "p",
              { class: "entry-edition" },
              `DV-${p.year} · ${PACKAGES[p.package].label} preparation`,
            ),
          ),
          el(
            "span",
            { class: "entry-status-badge" },
            entry?.submissionReportedAt
              ? "Submission reported"
              : entry?.pdfReady
                ? "PDF ready"
                : "Preparing",
          ),
        ),
        el(
          "p",
          { class: "entry-applicant" },
          entry?.name || "Your preparation",
        ),
        el(
          "div",
          { class: "entry-progress" },
          el(
            "div",
            {},
            el("span", {}, "Preparation progress"),
            el(
              "strong",
              {},
              Number.isFinite(progressValue) ? `${progressValue}%` : "Loading…",
            ),
          ),
          el("progress", {
            max: 100,
            value: Number.isFinite(progressValue) ? progressValue : null,
            "aria-label": "Entry preparation progress",
          }),
        ),
        el(
          "ol",
          { class: "entry-stages" },
          stage(
            "Personal information",
            entry ? status(entry.personal) : "Open to review",
            entry?.personal.done,
            "personal",
          ),
          stage(
            "Family information",
            entry ? status(entry.family) : "Open to review",
            entry?.family.done,
            "family",
          ),
          stage(
            "Preparation PDF",
            entry?.pdfReady
              ? "Ready"
              : p.state === "paid"
                ? "Finish worksheet"
                : "Pay when ready",
            entry?.pdfReady,
            null,
          ),
          stage(
            "Official submission",
            entry?.submissionReportedAt ? "Reported by you" : "Not recorded",
            !!entry?.submissionReportedAt,
            null,
          ),
        ),
        el(
          "div",
          { class: "entry-primary-actions" },
          act("Continue preparation", null, { class: "button primary" }),
          p.state === "paid"
            ? act(
                entry?.pdfReady ? "View preparation PDF" : "Finish my PDF",
                "pdf",
                { class: "button" },
              )
            : act(`Pay now · ${price(p.package)}`, "payment", {
                class: "button",
                disabled: !canCheckout(),
                "data-account-checkout": "",
              }),
        ),
        el(
          "p",
          { class: "entry-save-time" },
          `Last saved ${savedAt(p.updated_at)} (your local time)`,
        ),
        el(
          "p",
          { class: "entry-save-note" },
          "Keep editing this entry. Saving is free and updates the same preparation.",
        ),
        link(
          [
            "Continue to official website",
            el("span", { "aria-hidden": "true" }, " ↗"),
          ],
          "https://dvprogram.state.gov/",
          {
            class: "button entry-official-link",
            target: "_blank",
            rel: "noopener noreferrer",
          },
        ),
        el(
          "p",
          { class: "entry-official-note" },
          "Submit on the government website. Saving or paying here does not submit an entry.",
        ),
        tracking,
      ),
      otherEntries,
    );
  }
  const settings = () => {
    select("settings");
    rendered = undefined;
    content.removeAttribute("aria-busy");
    content.replaceChildren(
      el("h2", {}, "Settings"),
      el(
        "section",
        { class: "dashboard-card" },
        el("h3", {}, "Profile"),
        el(
          "dl",
          { class: "account-details" },
          el("dt", {}, "Name"),
          el(
            "dd",
            {},
            account.user_metadata?.full_name ||
              account.user_metadata?.name ||
              "Not provided",
          ),
          el("dt", {}, "Email"),
          el("dd", {}, account.email),
        ),
        el(
          "p",
          {},
          "Your sign-in name, photo and email come from your account provider. Worksheet information can be edited separately in each preparation.",
        ),
      ),
      el(
        "section",
        { class: "dashboard-card" },
        el("h3", {}, "Payments"),
        el(
          "p",
          {},
          "Saving and editing are free. Payment details are entered securely in Stripe when you choose to pay for a preparation.",
        ),
        !canCheckout()
          ? el(
              "p",
              { class: "hint" },
              "Checkout is not available yet. You can continue saving and return to pay later.",
            )
          : null,
      ),
      el(
        "section",
        { class: "dashboard-card" },
        el("h3", {}, "Privacy & account"),
        el(
          "p",
          {},
          link("Privacy notice", "/policies/#privacy", {
            target: "_blank",
            rel: "noopener noreferrer",
          }),
          " · ",
          link("Terms of service", "/policies/#terms", {
            target: "_blank",
            rel: "noopener noreferrer",
          }),
        ),
        el(
          "p",
          {},
          "Signing out clears all answers and images from this tab. Save any changes first. Saved preparations stay in your account.",
        ),
        button(
          "Sign out & clear this tab",
          async (event) => {
            const control = event.currentTarget;
            control.disabled = true;
            try {
              await signOut();
            } catch (error) {
              output.textContent = error.message;
            } finally {
              control.disabled = false;
            }
          },
          { class: "button" },
        ),
      ),
    );
  };
  tabs.orders = button("My entry", orders, {
    class: "button",
    "aria-pressed": "true",
  });
  tabs.settings = button("Settings", settings, {
    class: "button",
    "aria-pressed": "false",
  });
  const page = el(
    "div",
    { class: "account-page", "data-account-owner": account.id },
    el("h1", {}, "My account"),
    el("p", { class: "account-email" }, `Signed in as ${account.email}`),
    el(
      "nav",
      { class: "account-navigation", "aria-label": "Account sections" },
      tabs.orders,
      tabs.settings,
    ),
    content,
    output,
    backToWorksheet
      ? button("Back to worksheet", backToWorksheet, { class: "button" })
      : null,
  );
  page.dispose = subscribe?.(show);
  page.updateAvailability = () => {
    content.querySelectorAll("[data-account-checkout]").forEach((button) => {
      button.disabled = !canCheckout();
    });
  };
  orders();
  return page;
}
