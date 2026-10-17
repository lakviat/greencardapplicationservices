import { beginSignIn } from "./oauth.mjs?v=20261017-workspace-v29";
import {
  api,
  acceptAuth,
  signOut,
  observeSession,
  PROVIDERS,
  CAPABILITIES,
  unavailable,
} from "./backend.mjs?v=20261017-workspace-v29";
import { el, button, link } from "./dom.mjs?v=20261017-workspace-v29";
import { price, PACKAGES } from "./schema.mjs?v=20261017-workspace-v29";
const groups = new WeakMap();
let account = null;
const pendingSaves = new Set();
function scheduleSave(g, action, delay) {
  clearTimeout(g.timer);
  pendingSaves.delete(g.timer);
  g.timer = setTimeout(() => {
    pendingSaves.delete(g.timer);
    action();
  }, delay);
  pendingSaves.add(g.timer);
}
export function cloudWorkspace(ui) {
  const updateAccount = (session) => {
    const next = session?.user || null;
    const changed = JSON.stringify(account) !== JSON.stringify(next);
    account = next;
    if (!account) {
      for (const timer of pendingSaves) clearTimeout(timer);
      pendingSaves.clear();
    }
    if (changed) ui.accountChanged?.(account);
  };
  const ready = observeSession(updateAccount).then((client) => {
    ui.accountReady?.(account);
    return client;
  });
  // Preserve the free worksheet even when browser account storage is blocked.
  ready.catch(() => ui.accountReady?.(null));
  const message = (title, text) =>
    ui.dialog(title, el("p", { role: "status" }, text));
  const error = (e) => {
    ui.status(`Not saved: ${e.message}`);
    message("Please check this step", e.message);
  };
  const group = (d) => {
    let g = groups.get(d);
    if (!g) {
      const records =
        d.package === "single" ? [d] : [d, ui.related(d)].filter(Boolean);
      g = {
        id: crypto.randomUUID(),
        revision: 0,
        state: "unpaid",
        package: d.package,
        documents: records,
      };
      for (const r of records) {
        r.id ||= crypto.randomUUID();
        groups.set(r, g);
      }
    }
    return g;
  };
  async function signIn(next) {
    const client = await ready;
    const { data, error: sessionError } = await client.getSession();
    if (sessionError)
      throw new Error(
        "Your account is still here, but we could not reconnect. Check your connection and try again.",
      );
    updateAccount(data.session);
    if (account) return next();
    if (!CAPABILITIES.accounts) {
      message("Account setup in progress", unavailable);
      return;
    }
    const output = el("p", { role: "status", "aria-live": "polite" });
    let attempt;
    let closed = false;
    let adopting = false;
    const choices = Object.entries({ google: "Google", apple: "Apple" })
      .filter(([provider]) => PROVIDERS[provider])
      .map(([provider, label]) =>
        button(
          `Continue with ${label}`,
          async () => {
            choices.forEach((choice) => {
              choice.disabled = true;
            });
            output.textContent = `Finish signing in with ${label} in the new tab. Keep this worksheet open.`;
            try {
              // beginSignIn opens the tab immediately, before any asynchronous work.
              attempt = beginSignIn(provider);
              const { candidate } = await attempt.result;
              if (closed) return;
              adopting = true;
              ui.close();
              await acceptAuth(candidate);
              updateAccount((await client.getSession()).data.session);
              await next();
            } catch (e) {
              if (account) error(e);
              else if (!closed) output.textContent = e.message;
              else if (adopting) message("Sign-in could not finish", e.message);
            } finally {
              choices.forEach((choice) => {
                choice.disabled = false;
              });
            }
          },
          { class: "button", disabled: !PROVIDERS[provider] },
        ),
      );
    ui.dialog(
      "Sign in to your preparations",
      el(
        "div",
        {},
        el(
          "p",
          {},
          "Create an account or sign in securely. Use the same account each time to find your saved preparations.",
        ),
        el("div", { class: "social-sign-in" }, choices),
        el(
          "p",
          {},
          "Your answers and images are uploaded only when you save after payment. Sign-in opens in a separate tab.",
        ),
        output,
      ),
      () => {
        closed = true;
        attempt?.cancel();
      },
    );
  }

  async function save(d) {
    const g = group(d);
    if (g.state !== "paid") return checkout(d);
    if (g.saving) {
      await g.saving;
      return save(d);
    }
    clearTimeout(g.timer);
    pendingSaves.delete(g.timer);
    const started = g.changeNumber || 0;
    ui.status("Saving…");
    g.saving = (async () => {
      // Snapshot answers before asynchronous uploads. Further edits trigger another save.
      const documents = g.documents.map((r) => ({
        ...r,
        answers: { ...r.answers },
        childIds: [...r.childIds],
        assets: Object.fromEntries(
          Object.entries(r.assets).map(([k, a]) => [k, { ...a }]),
        ),
      }));
      for (const r of documents) {
        for (const [field, a] of Object.entries(r.assets)) {
          if (!a.id) {
            const uploaded = await api(
              "upload",
              a.blob,
              `?id=${g.id}&document=${r.id}&field=${encodeURIComponent(field)}`,
            );
            a.id = uploaded.id;
            const original = g.documents.find((x) => x.id === r.id)?.assets[
              field
            ];
            if (original?.blob === a.blob) original.id = a.id;
          }
          r.assets[field] = { id: a.id, confirmed: !!a.confirmed };
        }
      }
      const { preparation: p } = await api("save", {
        id: g.id,
        revision: g.revision,
        payload: { documents },
      });
      g.revision = p.revision;
      g.updated_at = p.updated_at;
      if (started === (g.changeNumber || 0)) {
        ui.saved(g.documents);
        ui.status("Saved to your account");
        return true;
      } else {
        ui.status("Saving latest changes…");
        scheduleSave(g, () => save(d).catch(error), 800);
        return false;
      }
    })().finally(() => {
      g.saving = null;
    });
    return g.saving;
  }
  async function saveProgress(d) {
    let saved;
    do {
      saved = await save(d);
    } while (saved === false);
    if (saved) {
      message(
        "Progress saved",
        `Your latest changes are saved to ${account.email}. Last saved ${new Date(group(d).updated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
      );
    }
  }
  async function checkout(d, { receivePdf = false, direct = false } = {}) {
    const g = group(d);
    if (g.package !== d.package && g.state === "unpaid") {
      g.package = d.package;
      g.id = crypto.randomUUID();
      g.documents =
        d.package === "single" ? [d] : [d, ui.related(d)].filter(Boolean);
      g.documents.forEach((r) => {
        r.id ||= crypto.randomUUID();
        groups.set(r, g);
      });
    }
    if (g.state === "paid") {
      await save(d);
      if (receivePdf) ui.pdfReady(d);
      return;
    }
    if (!CAPABILITIES.checkout) {
      ui.status("Not saved — checkout is not available yet");
      return message(
        "Signed in — saving is not available yet",
        `You are signed in as ${account.email}. Online saving requires a purchased preparation, and checkout is not available yet. Your changes have not been saved online. Keep this worksheet tab open to retain them.`,
      );
    }
    const output = el("p", { role: "status" });
    let paymentWatch;
    const confirm = button(
      `Continue to Stripe · ${price(g.package)}`,
      async () => {
        // Open synchronously so mobile browsers allow it; never discard this draft tab.
        const popup = window.open("about:blank", "gcas-checkout");
        if (!popup) {
          output.textContent =
            "Allow a new checkout tab, then try again. Keep this worksheet open.";
          return;
        }
        confirm.disabled = true;
        try {
          const result = await api("checkout", {
            id: g.id,
            package: g.package,
            contactEmail: d.answers["contact.email"],
          });
          if (result.paid) {
            popup.close();
            g.state = "paid";
            await save(d);
            ui.close();
            if (receivePdf) ui.pdfReady(d);
            return;
          }
          const url = new URL(result.url);
          if (url.origin !== "https://checkout.stripe.com")
            throw new Error("Unexpected checkout destination.");
          g.checkoutStarted = true;
          popup.opener = null;
          popup.location.href = url.href;
          output.textContent =
            "Complete payment in the Stripe tab, then return here. Keep this worksheet tab open. We will check payment automatically and save when it is confirmed.";
          clearInterval(paymentWatch);
          paymentWatch = setInterval(() => {
            if (!check.disabled) check.click();
          }, 5000);
        } catch (e) {
          popup.close();
          output.textContent = e.message;
        } finally {
          confirm.disabled = false;
        }
      },
      { class: "button primary" },
    );
    const check = button(
      "Check payment & save",
      async () => {
        check.disabled = true;
        try {
          const { preparation: p } = await api("get", { id: g.id });
          if (p.state !== "paid") {
            output.textContent =
              "Payment has not been confirmed yet. Please check again shortly.";
            return;
          }
          if (g.state !== "paid") {
            g.state = "paid";
            g.revision = p.revision;
          }
          clearInterval(paymentWatch);
          await save(d);
          ui.close();
          if (receivePdf) {
            ui.pdfReady(d);
            return;
          }
          message(
            "Saved to your account",
            "Your preparation and uploaded images are saved. You can sign in from another device to resume.",
          );
        } catch (e) {
          output.textContent = e.message;
        } finally {
          check.disabled = false;
        }
      },
      { class: "button" },
    );
    ui.dialog(
      receivePdf
        ? "Secure checkout for your PDF"
        : "Save your DV preparation and continue anytime",
      el(
        "div",
        {},
        el(
          "p",
          { class: "save-price" },
          `${PACKAGES[g.package].label} · ${price(g.package)} USD · one time`,
        ),
        el(
          "p",
          {},
          "Includes cloud saving, corrections, and PDF downloads for this preparation. Required relatives are included on every plan. Premium is unavailable.",
        ),
        el(
          "p",
          { class: "notice" },
          "After payment, saving uploads your answers, photos, and passport copies to private storage. Saved files expire after 365 days without a save. You can delete them earlier in My Preparations. Read the privacy notice for details.",
        ),
        link("Privacy notice", "/policies/#privacy", {
          target: "_blank",
          rel: "noopener noreferrer",
        }),
        el(
          "p",
          {},
          "Keep this worksheet tab open while paying. Unpaid work is not saved online.",
        ),
        el(
          "p",
          {},
          `Receipt email: ${d.answers["contact.email"] || account.email}. Your saved preparation stays in your signed-in account (${account.email}).`,
        ),
        output,
        confirm,
        check,
        button("Return to worksheet", ui.close, { class: "button" }),
      ),
      () => clearInterval(paymentWatch),
    );
    // A signed-in user goes straight to Stripe from the PDF button. After an
    // OAuth round-trip, browsers may require the visible Continue button again.
    if (direct) confirm.click();
  }
  async function load(id) {
    const { preparation: p } = await api("get", { id });
    const records = p.payload.documents;
    if (!records.length) {
      message(
        "Payment confirmed",
        "Return to your original worksheet tab to save its answers and images.",
      );
      return;
    }
    for (const r of records) {
      for (const a of Object.values(r.assets)) {
        a.blob = await api("asset", { id: p.id, asset: a.id });
        a.url = URL.createObjectURL(a.blob);
      }
    }
    const g = { ...p, documents: records };
    delete g.payload;
    records.forEach((r) => groups.set(r, g));
    ui.load(records);
    ui.status("Saved preparation opened");
  }
  async function download(d) {
    const blob = await pdf(d);
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: `DV-${d.year}-preparation.pdf` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    ui.status("PDF downloaded");
  }
  async function pdf(d) {
    const g = group(d);
    if (g.state !== "paid")
      throw new Error("Purchase this preparation to unlock the complete PDF.");
    if (!CAPABILITIES.pdfDownload) throw new Error(unavailable);
    clearTimeout(g.timer);
    pendingSaves.delete(g.timer);
    await save(d);
    ui.status("Preparing PDF…");
    return api("pdf", { id: g.id });
  }
  return {
    account: () => account,
    info: (d) => groups.get(d),
    link(source, next) {
      const g = groups.get(source);
      if (g && g.package !== "single" && g.documents.length < 2) {
        next.id ||= crypto.randomUUID();
        next.package = g.package;
        g.documents.push(next);
        groups.set(next, g);
      }
    },
    changed(d) {
      const g = groups.get(d);
      if (g) g.changeNumber = (g.changeNumber || 0) + 1;
      if (account && g?.state === "paid") {
        scheduleSave(g, () => save(d).catch(error), 1800);
      }
    },
    save: (d) => signIn(() => saveProgress(d)).catch(error),
    receivePdf: (d) =>
      signIn(() => checkout(d, { receivePdf: true, direct: true })).catch(
        error,
      ),
    pdf,
    download: (d) => signIn(() => download(d)).catch(error),
    email: (d) =>
      signIn(async () => {
        await save(d);
        const g = group(d);
        if (g.state !== "paid") return;
        await api("email", { id: g.id });
        message(
          "Email accepted",
          "The provider accepted your secure account link for delivery to your verified email.",
        );
      }).catch(error),
    async remove(d) {
      const g = groups.get(d);
      if (!g) return;
      const result = await api("delete", { id: g.id });
      clearTimeout(g.timer);
      pendingSaves.delete(g.timer);
      g.state = "deleted";
      for (const r of g.documents) groups.delete(r);
      ui.remove(g.documents);
      ui.status(
        result.filesPending
          ? "Preparation deleted; private file removal is queued for retry."
          : "Preparation and private files deleted.",
      );
    },
    dashboard: () =>
      signIn(async () => {
        const result = await api("list");
        ui.dialog(
          "Saved preparations",
          el(
            "div",
            {},
            el("p", {}, `Signed in as ${account.email}`),
            result.preparations.length
              ? result.preparations.map((p) =>
                  el(
                    "section",
                    {},
                    el(
                      "p",
                      {},
                      `DV-${p.year} · ${PACKAGES[p.package].label} · Last saved ${new Date(p.updated_at).toLocaleDateString()}`,
                    ),
                    button(
                      "Open preparation",
                      () => load(p.id).then(ui.close).catch(error),
                      { class: "button primary" },
                    ),
                  ),
                )
              : el("p", {}, "No paid preparations have been saved yet."),
            el(
              "p",
              {},
              "Signing out clears all answers and images from this tab. Save any changes first.",
            ),
            button(
              "Sign out & clear this tab",
              async () => {
                for (const timer of pendingSaves) clearTimeout(timer);
                pendingSaves.clear();
                await signOut();
                updateAccount(null);
                ui.close();
                ui.signOut();
              },
              { class: "button" },
            ),
          ),
        );
      }).catch(error),
  };
}
