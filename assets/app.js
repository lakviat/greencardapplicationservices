/* Public pages only. The sensitive preparation workspace does not load this file. */
const notifyForm = document.querySelector("#notifyForm");
const notifyMessage = document.querySelector("#notifyMessage");
const notifySubmitButton = document.querySelector("#notifySubmit");
const notifyModal = document.querySelector("#notifyModal");
const notifyOpenButtons = document.querySelectorAll("[data-notify-open]");
const notifyCloseButtons = document.querySelectorAll("[data-notify-close]");
const mobileMenus = document.querySelectorAll(".mobile-menu");
const siteFooter = document.querySelector(".site-footer");
const notifyHoneypotField = document.querySelector("#notifyCompanyWebsite");
const googleScriptNotifyUrl =
  "https://script.google.com/macros/s/AKfycbzfG-PHP8OR4qR6YGP1dcJ9eXQ8Crrg9ag1jG_WonTdGpwRVcsL5TMDfQADyqnyMg60/exec";
// Kept only for compatibility with the currently deployed Apps Scripts. This
// value is public browser code and must never be treated as authentication.
const appsScriptCompatibilityToken = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET";
const trackConversion = (event, metadata = {}) => {
  try {
    return window.gcasAnalytics?.track(event, metadata);
  } catch {
    // Optional measurement must never interrupt a form or support action.
    return false;
  }
};

const trackFormInteraction = (targetForm, formId) => {
  if (!targetForm) return;
  const start = () => trackConversion("form_start", { form: formId });
  targetForm.addEventListener("input", start);
  targetForm.addEventListener("change", start);
  targetForm.addEventListener("submit", start);
  targetForm.addEventListener("invalid", (event) => {
    const validity = event.target.validity;
    trackConversion("validation_error", {
      form: formId,
      category: validity?.valueMissing
        ? "required"
        : validity?.typeMismatch || validity?.patternMismatch
          ? "format"
          : "constraint",
    });
  }, true);
};


trackFormInteraction(notifyForm, "notification");

const cleanText = (value, maxLength = 200) =>
  String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const openNotifyModal = () => {
  if (!notifyModal) return;

  notifyModal.hidden = false;
  document.body.classList.add("modal-open");
  notifyModal.querySelector("input")?.focus();
};

const closeNotifyModal = () => {
  if (!notifyModal) return;

  notifyModal.hidden = true;
  document.body.classList.remove("modal-open");
};

notifyOpenButtons.forEach((button) => {
  button.addEventListener("click", openNotifyModal);
});

notifyCloseButtons.forEach((button) => {
  button.addEventListener("click", closeNotifyModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && notifyModal && !notifyModal.hidden) {
    closeNotifyModal();
  }
});

if (notifyForm && notifyMessage) {
  notifyForm.dataset.startedAt = new Date().toISOString();

  const setNotifyMessage = (text, state = "info") => {
    notifyMessage.textContent = text;
    notifyMessage.classList.remove("is-info", "is-error", "is-success");
    if (text) notifyMessage.classList.add(`is-${state}`);
  };

  const setNotifyState = (state) => {
    if (!notifySubmitButton) return;

    notifySubmitButton.classList.toggle(
      "is-submitting",
      state === "submitting",
    );
    notifySubmitButton.classList.toggle("is-submitted", state === "submitted");
    notifySubmitButton.disabled =
      state === "submitting" || state === "submitted";

    if (state === "submitting") {
      notifySubmitButton.textContent = "Submitting...";
    } else if (state === "submitted") {
      notifySubmitButton.textContent = "Request sent";
    } else {
      notifySubmitButton.textContent = "Notify Me";
    }
  };

  const createNotificationId = () => {
    const random =
      window.crypto && "randomUUID" in window.crypto
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `gcas-notify-${random}`;
  };

  const sendNotificationToDrive = async ({ email, phone, marketingConsent }) => {
    if (!googleScriptNotifyUrl) {
      throw new Error(
        "Notification collection is not connected yet. Please contact support or try again later.",
      );
    }

    const request = fetch(googleScriptNotifyUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        secret: appsScriptCompatibilityToken,
        notificationId: createNotificationId(),
        submittedAt: new Date().toISOString(),
        formStartedAt: notifyForm.dataset.startedAt || "",
        website: window.location.hostname,
        sourcePage: window.location.pathname || "/",
        email,
        phone,
        notifyCompanyWebsite: cleanText(notifyHoneypotField?.value, 100),
        consent:
          "I agree to receive the requested DV registration opening notification by email or WhatsApp.",
        marketingConsent,
      }),
    });
    trackConversion("request_dispatch", { form: "notification" });
    await request;
  };

  let notificationPending = false;
  notifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (notificationPending) return;

    const formData = new FormData(notifyForm);
    const email = cleanText(formData.get("notifyEmail"), 254);
    const phone = cleanText(formData.get("notifyPhone"), 32);

    if (notifyHoneypotField?.value) {
      setNotifyMessage("Notification request could not be completed.", "error");
      return;
    }

    if (!email && !phone) {
      trackConversion("validation_error", { form: "notification", category: "contact_required" });
      setNotifyMessage(
        "Enter an email or WhatsApp number so we can notify you.",
        "error",
      );
      return;
    }

    if (!notifyForm.checkValidity()) {
      notifyForm.reportValidity();
      return;
    }

    setNotifyState("submitting");
    notificationPending = true;
    setNotifyMessage(
      "Submitting your notification request. Please keep this window open.",
      "info",
    );

    try {
      await sendNotificationToDrive({
        email,
        phone,
        marketingConsent:
          formData.get("notifyMarketingConsent") === "on",
      });

      setNotifyState("submitted");
      setNotifyMessage(
        "Your notification request was sent. Delivery cannot be confirmed here; contact support if you need help.",
        "success",
      );
    } catch (error) {
      notificationPending = false;
      setNotifyState("idle");
      setNotifyMessage(
        error.message ||
          "We could not submit the notification request. Please try again.",
        "error",
      );
    }
  });
}

const initializeSupportWidget = () => {
  if (document.querySelector(".support-widget")) return;

  const createIcon = (name) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const iconPaths = {
      message: [
        ["path", { d: "M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" }],
        ["path", { d: "M8 10h.01M12 10h.01M16 10h.01" }],
      ],
      mail: [
        ["rect", { x: "3", y: "5", width: "18", height: "14", rx: "2" }],
        ["path", { d: "m3 7 9 6 9-6" }],
      ],
      whatsapp: [
        ["path", { d: "M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.7Z" }],
        ["path", { d: "M8.2 7.7c.2-.5.4-.5.8-.5h.4c.2 0 .4.1.5.4l.9 2.1c.1.3.1.5-.1.7l-.7.9c-.2.2-.1.4 0 .6.7 1.2 1.7 2.2 3 2.8.2.1.4.1.6-.1l.9-1.1c.2-.2.4-.3.7-.2l2.1 1c.3.1.4.3.4.6 0 .4-.2 1.4-1 2-.7.6-1.7.8-2.7.5-1.2-.3-3.2-1.1-5-2.8-1.5-1.4-2.5-3.2-2.8-4.4-.3-1.1 0-1.9.3-2.5Z" }],
      ],
      help: [
        ["circle", { cx: "12", cy: "12", r: "9" }],
        ["path", { d: "M9.7 9a2.4 2.4 0 1 1 3.5 2.1c-.8.4-1.2.9-1.2 1.9" }],
        ["path", { d: "M12 17h.01" }],
      ],
      close: [
        ["path", { d: "m7 7 10 10M17 7 7 17" }],
      ],
    };

    iconPaths[name].forEach(([tagName, attributes]) => {
      const element = document.createElementNS(
        "http://www.w3.org/2000/svg",
        tagName,
      );
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
      svg.append(element);
    });

    return svg;
  };

  const widget = document.createElement("div");
  widget.className = "support-widget";

  const panel = document.createElement("section");
  panel.className = "support-panel";
  panel.id = "supportPanel";
  panel.hidden = true;
  panel.setAttribute("aria-labelledby", "supportPanelTitle");

  const panelHeader = document.createElement("div");
  panelHeader.className = "support-panel-header";
  const brandMark = document.createElement("span");
  brandMark.className = "support-brand-mark";
  brandMark.setAttribute("aria-hidden", "true");
  const panelTitle = document.createElement("strong");
  panelTitle.id = "supportPanelTitle";
  panelTitle.textContent = "Support";
  const closeButton = document.createElement("button");
  closeButton.className = "support-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close support panel");
  closeButton.append(createIcon("close"));
  panelHeader.append(brandMark, panelTitle, closeButton);

  const actions = document.createElement("div");
  actions.className = "support-actions";

  const createAction = ({ label, icon, href, channel, disabled = false }) => {
    const action = disabled
      ? document.createElement("button")
      : document.createElement("a");
    action.className = "support-action";
    if (disabled) {
      action.type = "button";
      action.disabled = true;
      action.setAttribute("aria-label", `${label}, coming soon`);
    } else {
      action.href = href;
      action.addEventListener("click", () =>
        trackConversion("support_action", { channel }));
    }

    const iconWrap = document.createElement("span");
    iconWrap.className = "support-action-icon";
    iconWrap.append(createIcon(icon));
    const labelWrap = document.createElement("span");
    labelWrap.className = "support-action-label";
    labelWrap.textContent = label;
    action.append(iconWrap, labelWrap);

    if (disabled) {
      const status = document.createElement("small");
      status.textContent = "Coming soon";
      action.append(status);
    }

    return action;
  };

  actions.append(
    createAction({
      label: "Email support",
      icon: "mail",
      channel: "email",
      href: "mailto:greencardapplicationservices@gmail.com?subject=Website%20support%20request",
    }),
    createAction({
      label: "WhatsApp",
      icon: "whatsapp",
      channel: "whatsapp",
      href: "https://wa.me/17547037991?text=Hello%20Green%20Card%20Application%20Services%2C%20I%20need%20support.",
    }),
    createAction({ label: "View FAQ", icon: "help", href: "/faq.html", channel: "faq" }),
  );
  panel.append(panelHeader, actions);

  const trigger = document.createElement("button");
  trigger.className = "support-trigger";
  trigger.type = "button";
  trigger.setAttribute("aria-label", "Open support");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", panel.id);
  trigger.append(createIcon("message"));
  widget.append(panel, trigger);
  document.body.append(widget);

  const setOpen = (isOpen) => {
    panel.hidden = !isOpen;
    trigger.setAttribute("aria-expanded", String(isOpen));
    trigger.setAttribute("aria-label", isOpen ? "Hide support" : "Open support");
    widget.classList.toggle("is-open", isOpen);
    if (isOpen) closeButton.focus();
  };

  trigger.addEventListener("click", () => {
    if (panel.hidden) trackConversion("support_open");
    setOpen(panel.hidden);
  });
  closeButton.addEventListener("click", () => {
    setOpen(false);
    trigger.focus();
  });
  document.addEventListener("click", (event) => {
    if (!panel.hidden && !widget.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
      trigger.focus();
    }
  });
};

const initializeCookiePreferences = () => {
  const consentApi = window.gcasConsent;
  if (!consentApi) return;

  const preferenceButtons = document.querySelectorAll(
    "[data-cookie-preferences]",
  );
  const root = document.createElement("div");
  root.className = "cookie-consent";

  const banner = document.createElement("section");
  banner.className = "cookie-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Cookie preferences");

  const bannerCopy = document.createElement("div");
  const bannerTitle = document.createElement("strong");
  bannerTitle.textContent = "Your privacy choices";
  const bannerText = document.createElement("p");
  bannerText.append(
    "We use essential storage and, with your permission, analytics and advertising technologies. ",
  );
  const cookiePolicyLink = document.createElement("a");
  cookiePolicyLink.href = "/policies#cookies";
  cookiePolicyLink.textContent = "Cookie Policy";
  bannerText.append(cookiePolicyLink, ".");
  bannerCopy.append(bannerTitle, bannerText);

  const bannerActions = document.createElement("div");
  bannerActions.className = "cookie-actions";

  const makeButton = (label, className) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    return button;
  };

  const rejectButton = makeButton(
    "Reject nonessential",
    "button button-secondary",
  );
  const customizeButton = makeButton(
    "Customize",
    "button button-secondary",
  );
  const acceptButton = makeButton("Accept all", "button");
  bannerActions.append(rejectButton, customizeButton, acceptButton);
  banner.append(bannerCopy, bannerActions);

  const backdrop = document.createElement("div");
  backdrop.className = "cookie-dialog-backdrop";
  backdrop.hidden = true;

  const dialog = document.createElement("section");
  dialog.className = "cookie-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "cookieDialogTitle");

  const dialogHeader = document.createElement("div");
  dialogHeader.className = "cookie-dialog-header";
  const dialogHeading = document.createElement("div");
  const dialogTitle = document.createElement("h2");
  dialogTitle.id = "cookieDialogTitle";
  dialogTitle.textContent = "Cookie preferences";
  const dialogIntro = document.createElement("p");
  dialogIntro.textContent =
    "Choose which optional technologies may be used. Essential security and consent storage remain active.";
  dialogHeading.append(dialogTitle, dialogIntro);
  const closeButton = makeButton("Close", "cookie-dialog-close");
  closeButton.setAttribute("aria-label", "Close cookie preferences");
  dialogHeader.append(dialogHeading, closeButton);

  const options = document.createElement("div");
  options.className = "cookie-options";

  const createOption = ({ title, description, name, required = false }) => {
    const row = document.createElement("label");
    row.className = "cookie-option";
    const copy = document.createElement("span");
    const heading = document.createElement("strong");
    heading.textContent = title;
    const detail = document.createElement("small");
    detail.textContent = description;
    copy.append(heading, detail);

    if (required) {
      const status = document.createElement("span");
      status.className = "cookie-required";
      status.textContent = "Always active";
      row.append(copy, status);
      return { row, input: null };
    }

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    row.append(copy, input);
    return { row, input };
  };

  const essential = createOption({
    title: "Essential and security",
    description:
      "Needed for security, payments, form operation, and remembering your privacy choice.",
    required: true,
  });
  const preferences = createOption({
    title: "Preferences",
    description: "Allows optional settings that make the site more convenient.",
    name: "preferences",
  });
  const analytics = createOption({
    title: "Analytics",
    description: "Helps us understand site use and improve performance.",
    name: "analytics",
  });
  const advertising = createOption({
    title: "Advertising",
    description: "Helps measure campaigns and show more relevant advertising.",
    name: "advertising",
  });
  options.append(
    essential.row,
    preferences.row,
    analytics.row,
    advertising.row,
  );

  const dialogActions = document.createElement("div");
  dialogActions.className = "cookie-dialog-actions";
  const saveButton = makeButton("Save preferences", "button");
  dialogActions.append(saveButton);
  dialog.append(dialogHeader, options, dialogActions);
  backdrop.append(dialog);
  root.append(banner, backdrop);
  document.body.append(root);

  const hideBanner = () => {
    banner.hidden = true;
  };

  const closeDialog = () => {
    backdrop.hidden = true;
    document.body.classList.remove("cookie-dialog-open");
  };

  const openDialog = () => {
    const saved = consentApi.get() || {};
    preferences.input.checked = Boolean(saved.preferences);
    analytics.input.checked = Boolean(saved.analytics);
    advertising.input.checked = Boolean(saved.advertising);
    backdrop.hidden = false;
    document.body.classList.add("cookie-dialog-open");
    closeButton.focus();
  };

  const saveConsent = (value) => {
    consentApi.save(value);
    hideBanner();
    closeDialog();
  };

  acceptButton.addEventListener("click", () => {
    saveConsent({ preferences: true, analytics: true, advertising: true });
  });
  rejectButton.addEventListener("click", () => {
    saveConsent({ preferences: false, analytics: false, advertising: false });
  });
  customizeButton.addEventListener("click", openDialog);
  closeButton.addEventListener("click", closeDialog);
  saveButton.addEventListener("click", () => {
    saveConsent({
      preferences: preferences.input.checked,
      analytics: analytics.input.checked,
      advertising: advertising.input.checked,
    });
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.hidden) closeDialog();
  });
  preferenceButtons.forEach((button) => {
    button.addEventListener("click", openDialog);
  });

  if (consentApi.get()) hideBanner();
};

initializeSupportWidget();
initializeCookiePreferences();

// Close native mobile disclosures after navigation and keep FAQ controls accessible.
document.querySelectorAll('.mobile-menu a').forEach(link => link.addEventListener('click', () => link.closest('details')?.removeAttribute('open')));
document.querySelectorAll('[data-faq-accordion] button').forEach(button => button.addEventListener('click', () => {
 const expanded = button.getAttribute('aria-expanded') === 'true';
 button.setAttribute('aria-expanded', String(!expanded));
 const target = document.getElementById(button.getAttribute('aria-controls'));
 if (target) target.hidden = expanded;
}));
// Old #apply links remain useful without reopening the retired intake form.
if (location.hash === '#apply' && location.pathname === '/') location.replace('/prepare.html');
