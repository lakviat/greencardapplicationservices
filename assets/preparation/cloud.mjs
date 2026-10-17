import { beginSignIn } from "./oauth.mjs?v=20261017-workspace-v36";
import {
  api,
  acceptAuth,
  signOut,
  observeSession,
  PROVIDERS,
  CAPABILITIES,
  capabilities,
  unavailable,
} from "./backend.mjs?v=20261017-workspace-v36";
import { el, button, link } from "./dom.mjs?v=20261017-workspace-v36";
import {
  price,
  PACKAGES,
  preparationProgress,
  checkoutEmail,
} from "./schema.mjs?v=20261017-workspace-v36";
import { COUNTRIES } from "./countries.mjs?v=20261017-workspace-v36";
import { passportUploadCopy } from "./media.mjs?v=20261017-workspace-v36";
import { accountPage } from "./account-page.mjs?v=20261017-workspace-v36";
import { checkoutDestination } from "./payment-links.mjs?v=20261017-workspace-v36";
import {
  savedAt,
  savingBar,
} from "./save-feedback.mjs?v=20261017-workspace-v36";
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
    if (!CAPABILITIES.accounts) await capabilities();
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
          "Save your answers and images privately for free, then pay now or when your worksheet is complete. Sign-in opens in a separate tab.",
        ),
        output,
      ),
      () => {
        closed = true;
        attempt?.cancel();
      },
    );
  }

  function saveState(g, phase, text) {
    g.savePhase = text;
    g.saveStatePhase = phase;
    ui.saveState?.(g.documents, { phase, text, timestamp: g.updated_at });
    if (g.feedback) g.feedback.status.textContent = text;
  }
  function showSaving(g, text = g.savePhase || "Saving progress…") {
    if (g.feedback) {
      g.feedback.status.textContent = text;
      return;
    }
    const feedback = { status: el("p", { role: "status" }, text) };
    ui.dialog(
      "Saving progress",
      el(
        "div",
        { class: "saving-dialog" },
        feedback.status,
        savingBar(),
        el(
          "p",
          {},
          "Keep this tab open while we save. You can continue editing.",
        ),
        g.updated_at
          ? el(
              "p",
              { class: "hint" },
              `Last saved ${savedAt(g.updated_at)} (your local time).`,
            )
          : null,
        button("Continue editing", ui.close, { class: "button" }),
      ),
      () => {
        if (g.feedback === feedback) g.feedback = null;
      },
    );
    g.feedback = feedback;
  }
  function startSave(d) {
    const g = group(d);
    if (g.manualSave || g.saveRequest) {
      showSaving(g);
      return g.manualSave || g.saveRequest;
    }
    const activeSave = g.saving;
    if (!activeSave) saveState(g, "saving", "Connecting to your account…");
    showSaving(g);
    g.saveRequest = signIn(() => saveProgress(d, activeSave))
      .catch((e) => {
        saveState(g, "error", e.message);
        ui.status(`Not saved: ${e.message}`, g.documents);
        if (g.feedback)
          ui.dialog(
            "Progress not saved",
            el(
              "div",
              {},
              el("p", { role: "alert" }, e.message),
              el(
                "p",
                {},
                "Your changes are still in this tab. Retry saving before closing it.",
              ),
              g.updated_at
                ? el(
                    "p",
                    {},
                    `Last saved ${savedAt(g.updated_at)} (your local time).`,
                  )
                : null,
              button("Retry saving", () => startSave(d), {
                class: "button primary",
              }),
              button("Continue editing", ui.close, { class: "button" }),
            ),
          );
      })
      .finally(() => {
        g.saveRequest = null;
        // Closing or deferring sign-in must not leave a running save indicator.
        if (!g.manualSave && !g.saving && g.saveStatePhase === "saving")
          ui.saveState?.(g.documents, {
            phase: "idle",
            timestamp: g.updated_at,
          });
      });
    return g.saveRequest;
  }

  async function save(d) {
    const g = group(d);
    if (!CAPABILITIES.cloudSave)
      throw new Error(
        "Account saving is temporarily unavailable. Your changes remain in this tab.",
      );
    // Manual saves join an active autosave. Edits during that request are
    // detected below and saved before the final acknowledgement.
    if (g.saving) return g.saving;
    clearTimeout(g.timer);
    pendingSaves.delete(g.timer);
    const started = g.changeNumber || 0;
    const selectedPackage = g.state === "paid" ? g.package : d.package;
    const related = ui.related(d);
    if (
      selectedPackage !== "single" &&
      related &&
      !g.documents.includes(related)
    ) {
      related.id ||= crypto.randomUUID();
      g.documents.push(related);
      groups.set(related, g);
    }
    ui.status("Saving…", g.documents);
    saveState(g, "saving", "Saving progress…");
    g.saving = (async () => {
      // Snapshot answers before asynchronous uploads. Further edits trigger another save.
      const documents = g.documents.map((r) => ({
        ...r,
        package: selectedPackage,
        answers: { ...r.answers },
        childIds: [...r.childIds],
        assets: Object.fromEntries(
          Object.entries(r.assets).map(([k, a]) => [k, { ...a }]),
        ),
      }));
      if (!g.registered) {
        const { preparation: p } = await api("draft", {
          id: g.id,
          package: selectedPackage,
        });
        g.registered = true;
        g.revision = p.revision;
        g.state = p.state;
      }
      const pendingImages = [];
      const totalImages = documents.reduce(
        (count, r) =>
          count + Object.values(r.assets).filter((a) => !a.id).length,
        0,
      );
      let imageNumber = 0;
      for (const r of documents) {
        for (const [field, a] of Object.entries(r.assets)) {
          if (!a.id) {
            try {
              imageNumber++;
              saveState(
                g,
                "saving",
                `Preparing image ${imageNumber} of ${totalImages}…`,
              );
              const blob = field.startsWith("passport.")
                ? await passportUploadCopy(a.blob)
                : a.blob;
              saveState(
                g,
                "saving",
                `Uploading image ${imageNumber} of ${totalImages}…`,
              );
              const uploaded = await api(
                "upload",
                blob,
                `?id=${g.id}&document=${r.id}&field=${encodeURIComponent(field)}`,
              );
              a.id = uploaded.id;
              const original = g.documents.find((x) => x.id === r.id)?.assets[
                field
              ];
              if (original?.blob === a.blob) original.id = a.id;
            } catch {
              pendingImages.push({ document: r.id, field });
              // Keep a previously saved copy when a replacement fails. A new
              // failed image is omitted; its local blob remains available to retry.
              if (a.previous) r.assets[field] = a.previous;
              else delete r.assets[field];
              continue;
            }
          }
          r.assets[field] = { id: a.id, confirmed: !!a.confirmed };
        }
      }
      saveState(g, "saving", "Saving your answers…");
      const { preparation: p } = await api("save", {
        id: g.id,
        revision: g.revision,
        package: selectedPackage,
        payload: { documents },
      });
      g.revision = p.revision;
      g.updated_at = p.updated_at;
      g.state = p.state;
      g.package = p.package;
      g.expires_at = p.expires_at;
      g.pendingImages = pendingImages;
      g.savedChangeNumber = started;
      if (started === (g.changeNumber || 0)) {
        if (!pendingImages.length) ui.saved(g.documents);
        saveState(
          g,
          pendingImages.length ? "pending" : "saved",
          pendingImages.length
            ? "Answers saved · images pending"
            : "Saved to your account",
        );
        ui.status(
          pendingImages.length
            ? "Answers saved · some images still need saving. Keep this tab open and retry Save progress."
            : `Saved to your account · ${savedAt(g.updated_at)}`,
          g.documents,
        );
        return true;
      } else {
        ui.status("Saving latest changes…", g.documents);
        saveState(g, "saving", "Saving your latest changes…");
        scheduleSave(
          g,
          () =>
            save(d).catch((e) =>
              ui.status(`Not saved: ${e.message}`, g.documents),
            ),
          800,
        );
        return false;
      }
    })()
      .catch((e) => {
        saveState(g, "error", e.message);
        throw e;
      })
      .finally(() => {
        g.saving = null;
      });
    return g.saving;
  }
  async function saveLatest(d, activeSave) {
    if (
      activeSave &&
      (await activeSave) === true &&
      group(d).savedChangeNumber === (group(d).changeNumber || 0)
    )
      return;
    while ((await save(d)) === false) {
      /* Wait for edits made during the save. */
    }
  }
  function saveProgress(d, activeSave) {
    const g = group(d);
    showSaving(g, g.saving ? g.savePhase : "Saving progress…");
    if (g.manualSave) return g.manualSave;
    g.manualSave = finishSaveProgress(d, activeSave).finally(() => {
      g.manualSave = null;
    });
    return g.manualSave;
  }
  async function finishSaveProgress(d, activeSave) {
    await saveLatest(d, activeSave);
    const g = group(d);
    // Dismissing the progress dialog means continue in the background. The
    // header still acknowledges completion without interrupting another task.
    if (!g.feedback) return;
    if (g.pendingImages?.length) {
      ui.dialog(
        "Answers saved — images need attention",
        el(
          "div",
          {},
          el(
            "p",
            { role: "status" },
            `Your answers are saved to your account as of ${savedAt(g.updated_at)} (your local time). Some images could not be saved yet. Any previously saved copies are still there.`,
          ),
          el(
            "p",
            {},
            "Keep this tab open to retain the pending images. Retry saving, or replace the affected image with a clear JPEG and save again.",
          ),
          el(
            "ul",
            {},
            g.pendingImages.map(({ field }) =>
              el(
                "li",
                {},
                field === "passport.bio"
                  ? "Passport information page"
                  : field === "passport.signature"
                    ? "Passport signature page"
                    : "Applicant or family photograph",
              ),
            ),
          ),
          button("Retry saving images", () => startSave(d), {
            class: "button primary",
          }),
          g.state !== "paid" && CAPABILITIES.checkout
            ? button(
                `Pay now · ${price(g.package)}`,
                () => checkout(d).catch(error),
                {
                  class: "button",
                },
              )
            : null,
          button("Continue editing", ui.close, { class: "button" }),
        ),
      );
      return;
    }
    const unpaid = g.state !== "paid";
    ui.dialog(
      "Progress saved",
      el(
        "div",
        {},
        el(
          "p",
          { role: "status" },
          `Your latest changes are saved to ${account.email}. Last saved ${savedAt(g.updated_at)} (your local time).`,
        ),
        el(
          "p",
          {},
          "You can close this tab and come back later. Sign in with the same Google account and open My Preparations to continue.",
        ),
        unpaid
          ? el(
              "p",
              {},
              "Saving is free. Pay now or when your worksheet is complete to unlock your preparation PDF.",
            )
          : null,
        unpaid
          ? button(
              `Pay now · ${price(g.package)}`,
              () => checkout(d).catch(error),
              { class: "button primary", disabled: !CAPABILITIES.checkout },
            )
          : null,
        unpaid && !CAPABILITIES.checkout
          ? el(
              "p",
              {},
              "Checkout is not available yet. Your progress is saved, and you can pay later.",
            )
          : null,
        button(
          unpaid ? "Continue and pay later" : "Continue editing",
          ui.close,
          {
            class:
              unpaid && CAPABILITIES.checkout ? "button" : "button primary",
          },
        ),
        el(
          "p",
          { class: "hint" },
          "Saved drafts are kept for 365 days after your last save. You can delete them in My Preparations.",
        ),
      ),
    );
  }
  async function checkout(d, { receivePdf = false, direct = false } = {}) {
    const g = group(d);
    showSaving(g, "Saving before checkout…");
    await saveLatest(d);
    if (g.state === "paid") {
      ui.close();
      if (receivePdf) ui.pdfReady(d);
      else
        message(
          "Already purchased",
          "You can keep editing this preparation and download your completed PDF again without paying again.",
        );
      return;
    }
    const remaining = preparationProgress(
      d,
      g.documents.find((record) => record !== d),
      COUNTRIES.map((country) => country.name),
    ).remaining.length;
    const receiptEmail = checkoutEmail(
      d.answers["contact.email"],
      account.email,
    );
    if (!CAPABILITIES.checkout) {
      return ui.dialog(
        "Your progress is saved",
        el(
          "div",
          {},
          el(
            "p",
            {},
            "Checkout is not available yet. Your preparation is saved in your account. You can keep editing and pay later to unlock the PDF.",
          ),
          button("Continue and pay later", ui.close, {
            class: "button primary",
          }),
        ),
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
            contactEmail: receiptEmail,
          });
          if (result.paid) {
            popup.close();
            g.state = "paid";
            await saveLatest(d);
            ui.close();
            if (receivePdf) ui.pdfReady(d);
            else
              message(
                "Payment confirmed",
                "Your PDF is unlocked. Finish and review your worksheet, then download it whenever you are ready.",
              );
            return;
          }
          const url = checkoutDestination(result.url);
          g.checkoutStarted = true;
          popup.opener = null;
          popup.location.href = url.href;
          check.hidden = false;
          output.textContent =
            "Complete payment in the Stripe tab, then return here. Your progress is already saved. We will check payment automatically to unlock your PDF.";
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
      "Check payment",
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
          }
          clearInterval(paymentWatch);
          await saveLatest(d);
          ui.close();
          if (receivePdf) {
            ui.pdfReady(d);
            return;
          }
          message(
            "Payment confirmed",
            "Your PDF is unlocked. Your preparation is saved, and you can finish and download it whenever you are ready.",
          );
        } catch (e) {
          output.textContent = e.message;
        } finally {
          check.disabled = false;
        }
      },
      { class: "button" },
    );
    check.hidden = true;
    ui.dialog(
      receivePdf ? "Secure checkout for your PDF" : "Pay now or continue later",
      el(
        "div",
        {},
        el(
          "p",
          { class: "save-price" },
          `${PACKAGES[g.package].label} · ${price(g.package)} USD · one time, plus applicable tax shown by Stripe`,
        ),
        el(
          "p",
          {},
          "Pay once for this preparation. Keep editing and download your completed PDF as often as you need.",
        ),
        remaining
          ? el(
              "p",
              { class: "notice checkout-incomplete" },
              `${remaining} required ${remaining === 1 ? "item still needs" : "items still need"} finishing. You can pay now and complete them later.`,
            )
          : null,
        g.pendingImages?.length
          ? el(
              "p",
              { class: "notice" },
              "Some photos still need saving. Your answers are saved; you can pay now and retry the photos later.",
            )
          : null,
        link("Privacy & storage", "/policies/#privacy", {
          target: "_blank",
          rel: "noopener noreferrer",
        }),
        el(
          "p",
          {},
          "Your progress is already saved. You can close checkout and return to My Preparations anytime to continue or pay later.",
        ),
        el("p", {}, `Receipt email: ${receiptEmail}.`),
        output,
        confirm,
        check,
        button("Continue and pay later", ui.close, { class: "button" }),
      ),
      () => clearInterval(paymentWatch),
    );
    // A signed-in user goes straight to Stripe from the PDF button. After an
    // OAuth round-trip, browsers may require the visible Continue button again.
    // An unfinished worksheet always gets the short, non-blocking notice and
    // an explicit Continue button. That tap also works with mobile popup rules.
    if (direct && !remaining && !g.pendingImages?.length) confirm.click();
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
    const g = { ...p, registered: true, documents: records };
    delete g.payload;
    records.forEach((r) => groups.set(r, g));
    ui.load(records);
    saveState(g, "saved", "Saved to your account");
    ui.status(`Last saved ${savedAt(g.updated_at)} (your local time)`);
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
    await saveLatest(d);
    if (g.pendingImages?.length)
      throw new Error(
        "Your answers are saved, but some images still need saving. Return to the worksheet and retry Save progress.",
      );
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
      if (g) {
        g.changeNumber = (g.changeNumber || 0) + 1;
        if (g.state === "unpaid" && !g.checkoutStarted)
          g.documents.forEach((record) => {
            record.package = d.package;
          });
      }
      if (account && g?.updated_at && g.state !== "deleted") {
        scheduleSave(
          g,
          () =>
            save(d).catch((e) =>
              ui.status(`Not saved: ${e.message}`, g.documents),
            ),
          1800,
        );
      }
    },
    save: startSave,
    login: () => signIn(ui.signedIn).catch(error),
    checkout: (d) => signIn(() => checkout(d, { direct: true })).catch(error),
    receivePdf: (d) =>
      signIn(() => checkout(d, { receivePdf: true, direct: true })).catch(
        error,
      ),
    pdf,
    download: (d) => signIn(() => download(d)).catch(error),
    email: (d) =>
      signIn(async () => {
        await saveLatest(d);
        const g = group(d);
        if (g.pendingImages?.length) return saveProgress(d);
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
      clearTimeout(g.timer);
      pendingSaves.delete(g.timer);
      if (g.saving) await g.saving.catch(() => {});
      clearTimeout(g.timer);
      pendingSaves.delete(g.timer);
      const result = await api("delete", { id: g.id });
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
      signIn(() => {
        const page = accountPage({
          account,
          list: () => api("list"),
          open: load,
          preparations: ui.preparations,
          checkoutAvailable: CAPABILITIES.checkout,
          signOut: async () => {
            for (const timer of pendingSaves) clearTimeout(timer);
            pendingSaves.clear();
            // Finish any write already in flight before clearing its session.
            await Promise.allSettled(
              [...ui.records()]
                .map((d) => groups.get(d)?.saving)
                .filter(Boolean),
            );
            for (const timer of pendingSaves) clearTimeout(timer);
            pendingSaves.clear();
            await signOut();
            updateAccount(null);
            ui.close();
            ui.signOut();
          },
        });
        ui.accountPage(page);
      }).catch(error),
  };
}
