import { el, button, link } from "./dom.mjs?v=20261017-workspace-v32";
import { PACKAGES } from "./schema.mjs?v=20261017-workspace-v32";

import { savedAt } from "./save-feedback.mjs?v=20261017-workspace-v32";

export function accountPage({
  account,
  list,
  open,
  signOut,
  preparations,
  checkoutAvailable,
}) {
  const content = el("section", {
    class: "account-content",
    "aria-live": "polite",
  });
  const output = el("p", { role: "status" });
  let selection = "orders";
  let request = 0;
  const tabs = {};
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
    content.replaceChildren(
      el("h2", {}, "Saved preparations"),
      el("p", {}, "Loading your preparations…"),
    );
    try {
      const result = await list();
      if (selection !== "orders" || current !== request) return;
      content.replaceChildren(
        el("h2", {}, "Saved preparations"),
        el(
          "p",
          {},
          "Your drafts and purchased preparations are together here. Continue anytime, and pay when you are ready for your PDF.",
        ),
        ...(result.preparations.length
          ? result.preparations.map((p) =>
              el(
                "article",
                { class: "dashboard-card" },
                el(
                  "span",
                  { class: "edition-badge" },
                  p.state === "paid" ? "Purchased" : "Saved draft · pay later",
                ),
                el("h3", {}, `DV-${p.year} · ${PACKAGES[p.package].label}`),
                el(
                  "p",
                  {},
                  `Last saved ${savedAt(p.updated_at)} (your local time)`,
                ),
                button(
                  "Open preparation",
                  async (event) => {
                    const control = event.currentTarget;
                    control.disabled = true;
                    output.textContent = "Opening preparation…";
                    try {
                      await open(p.id);
                    } catch (error) {
                      output.textContent = error.message;
                    } finally {
                      control.disabled = false;
                    }
                  },
                  { class: "button primary" },
                ),
              ),
            )
          : [
              el(
                "p",
                {},
                "No preparations have been saved yet. Open a worksheet and choose Save progress to keep it here.",
              ),
            ]),
        el(
          "p",
          { class: "hint" },
          "Saved files are kept for 365 days after your last save. You can delete a preparation from My preparations after opening it.",
        ),
      );
    } catch {
      if (selection !== "orders" || current !== request) return;
      content.replaceChildren(
        el("h2", {}, "Saved preparations"),
        el(
          "p",
          {},
          "We could not load your preparations. Check your connection and try again.",
        ),
        button("Try again", orders, { class: "button" }),
      );
    }
  };
  const settings = () => {
    select("settings");
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
        !checkoutAvailable
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
  tabs.orders = button("Orders", orders, {
    class: "button",
    "aria-pressed": "true",
  });
  tabs.settings = button("Settings", settings, {
    class: "button",
    "aria-pressed": "false",
  });
  const page = el(
    "div",
    { class: "account-page" },
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
    button("Back to my preparations", preparations, { class: "button" }),
  );
  orders();
  return page;
}
