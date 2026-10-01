(() => {
  if (window.gcasAnalytics) return;

  const analyticsId = "G-9P726CYPGF";
  const advertisingId = "AW-17948229197";
  const consentStorageKey = "gcas_cookie_preferences_v1";
  const packages = Object.freeze({
    single: { item_id: "single", item_name: "Single", price: 24 },
    couple: { item_id: "couple", item_name: "Couple", price: 44 },
    family: { item_id: "family", item_name: "Family", price: 64 },
    premium: { item_id: "premium", item_name: "Premium", price: 94 },
  });
  const locations = new Set(["hero", "header", "article", "pricing", "footer", "process"]);
  const ctas = new Set(["navigation", "apply", "notify", "package", "compare-packages", "start-single"]);
  const forms = new Set(["application", "notification"]);
  const categories = new Set(["required", "format", "constraint", "upload", "contact_required"]);
  const seen = new Set();
  const exposures = [];
  let analyticsConfigured = false;
  let advertisingConfigured = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  const normalizeConsent = (preferences) => ({
    preferences: preferences?.preferences === true,
    analytics: preferences?.analytics === true,
    advertising: preferences?.advertising === true,
  });
  let consent = null;
  try {
    const saved = window.localStorage.getItem(consentStorageKey);
    if (saved) consent = normalizeConsent(JSON.parse(saved));
  } catch {
    // A denied or unavailable store must not prevent in-memory consent.
  }

  const pageContext = () => ({
    page_location: window.location.origin + (window.location.pathname || "/"),
    page_path: window.location.pathname || "/",
    page_referrer: "",
    page_title: "Green Card Application Services",
  });

  const campaignContext = () => {
    const query = new URLSearchParams(window.location.search);
    const fields = [
      ["utm_source", "campaign_source", ["newsletter", "google", "facebook", "instagram"]],
      ["utm_medium", "campaign_medium", ["email", "cpc", "social"]],
      ["utm_campaign", "campaign_name", ["dv-preparation", "photo-checklist", "family-guide"]],
    ];
    const campaign = {};
    for (const [queryKey, configKey, allowed] of fields) {
      const values = query.getAll(queryKey);
      if (values.length !== 1 || !allowed.includes(values[0])) return {};
      campaign[configKey] = values[0];
    }
    return campaign;
  };

  const sanitize = (event, metadata) => {
    if (!metadata || typeof metadata !== "object") return null;
    switch (event) {
      case "support_open":
        return {};
      case "support_action":
        return ["email", "whatsapp", "faq", "instagram"].includes(metadata.channel)
          ? { support_channel: metadata.channel }
          : null;
      case "page_view":
      case "view_item_list":
        return event === "view_item_list"
          ? { item_list_id: "packages", items: Object.values(packages).map((item) => ({ ...item })) }
          : {};
      case "select_item":
      case "begin_checkout": {
        if (typeof metadata.package !== "string" || !Object.hasOwn(packages, metadata.package)) return null;
        const item = packages[metadata.package];
        return {
          currency: "USD",
          ...(event === "begin_checkout" ? { value: item.price } : { item_list_id: "packages" }),
          items: [{ ...item, quantity: 1 }],
        };
      }
      case "form_view":
      case "form_start":
      case "request_dispatch":
        return forms.has(metadata.form) ? { form_id: metadata.form } : null;
      case "validation_error":
        return forms.has(metadata.form) && categories.has(metadata.category)
          ? { form_id: metadata.form, error_category: metadata.category }
          : null;
      case "cta_click":
        return ctas.has(metadata.cta) && locations.has(metadata.location)
          ? { cta_id: metadata.cta, cta_location: metadata.location }
          : null;
      default:
        return null;
    }
  };

  const isVisible = (element) => {
    if (!element || document.visibilityState === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return element.getClientRects().length > 0 &&
      rect.width > 0 && rect.height > 0 &&
      rect.top < window.innerHeight && rect.bottom > 0 &&
      rect.left < window.innerWidth && rect.right > 0;
  };

  const sendEvent = (event, metadata = {}, checkoutCallback) => {
    if (!consent?.analytics) return false;
    const parameters = sanitize(event, metadata);
    if (!parameters) return false;
    if (event === "view_item_list" || event === "form_view") {
      const exposure = exposures.find((entry) =>
        entry.event === event && entry.metadata.form === metadata.form);
      if (!isVisible(exposure?.element)) return false;
    }
    const onceKey =
      event === "page_view" || event === "view_item_list"
        ? event
        : ["form_view", "form_start", "validation_error"].includes(event)
          ? `${event}:${parameters.form_id}:${parameters.error_category || ""}`
          : null;
    if (onceKey && seen.has(onceKey)) return false;
    if (onceKey) seen.add(onceKey);
    window.gtag("event", event, {
      ...parameters,
      ...pageContext(),
      send_to: analyticsId,
      ...(event === "begin_checkout" && checkoutCallback
        ? { event_callback: checkoutCallback, event_timeout: 500 }
        : {}),
    });
    return true;
  };

  const track = (event, metadata = {}) => sendEvent(event, metadata);

  const beginCheckout = (packageKey) => {
    if (!consent?.analytics || !sanitize("begin_checkout", { package: packageKey })) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        resolve();
      };
      // Never let a missing/blocked Google tag hold up the payment handoff.
      const timer = window.setTimeout(finish, 600);
      sendEvent("begin_checkout", { package: packageKey }, finish);
    });
  };

  const checkExposures = () => {
    if (!consent?.analytics || document.visibilityState === "hidden") return;
    for (const { element, event, metadata } of exposures) {
      if (isVisible(element)) track(event, metadata);
    }
  };

  const applyConsent = () => {
    window[`ga-disable-${analyticsId}`] = !consent?.analytics;
    window[`ga-disable-${advertisingId}`] = !consent?.advertising;
    if (!consent?.analytics || !consent?.advertising) {
      // Remove pending events/configuration if the Google library has not loaded.
      for (let index = window.dataLayer.length - 1; index >= 0; index -= 1) {
        const command = window.dataLayer[index];
        if (
          (!consent?.analytics && command[0] === "event") ||
          (command[0] === "config" &&
            ((!consent?.analytics && command[1] === analyticsId) ||
              (!consent?.advertising && command[1] === advertisingId)))
        ) window.dataLayer.splice(index, 1);
      }
    }
    window.gtag("consent", "update", {
      functionality_storage: consent?.preferences ? "granted" : "denied",
      personalization_storage: consent?.preferences ? "granted" : "denied",
      analytics_storage: consent?.analytics ? "granted" : "denied",
      ad_storage: consent?.advertising ? "granted" : "denied",
      ad_user_data: consent?.advertising ? "granted" : "denied",
      ad_personalization: consent?.advertising ? "granted" : "denied",
    });
    if (consent?.analytics && !analyticsConfigured) {
      window.gtag("config", analyticsId, {
        ...pageContext(),
        ...campaignContext(),
        send_page_view: false,
        // Also disable form interactions and history page views in GA's web stream.
        enhanced_measurement: false,
        form_interactions: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        ignore_referrer: true,
      });
      analyticsConfigured = true;
    } else if (!consent?.analytics) {
      analyticsConfigured = false;
    }
    if (consent?.advertising && !advertisingConfigured) {
      window.gtag("config", advertisingId, {
        ...pageContext(),
        send_page_view: false,
        allow_enhanced_conversions: false,
        conversion_linker: false,
        url_passthrough: false,
      });
      advertisingConfigured = true;
    } else if (!consent?.advertising) {
      advertisingConfigured = false;
    }
    track("page_view");
    checkExposures();
  };

  window.gtag("consent", "default", {
    functionality_storage: "denied",
    personalization_storage: "denied",
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    security_storage: "granted",
  });
  window.gtag("set", {
    ...pageContext(),
    url_passthrough: false,
    conversion_linker: false,
    ads_data_redaction: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  window.gtag("js", new Date());

  window.gcasAnalytics = Object.freeze({ track, beginCheckout });
  window.gcasConsent = Object.freeze({
    get: () => consent ? { ...consent } : null,
    save(preferences) {
      consent = normalizeConsent(preferences);
      applyConsent();
      try {
        window.localStorage.setItem(consentStorageKey, JSON.stringify(consent));
      } catch {
        // The choice remains effective immediately for this page.
      }
      return { ...consent };
    },
  });
  applyConsent();

  const initialize = () => {
    const pricing = document.querySelector("#pricing");
    const application = document.querySelector("#intakeForm");
    if (pricing) exposures.push({ element: pricing, event: "view_item_list", metadata: {} });
    if (application) exposures.push({ element: application, event: "form_view", metadata: { form: "application" } });
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(checkExposures, { threshold: 0 });
      exposures.forEach(({ element }) => observer.observe(element));
    }
    window.addEventListener("scroll", checkExposures, { passive: true });
    window.addEventListener("resize", checkExposures, { passive: true });
    document.addEventListener("visibilitychange", checkExposures);
    document.addEventListener("click", (event) => {
      const cta = event.target.closest?.("[data-track-cta]");
      if (cta) track("cta_click", {
        cta: cta.dataset.trackCta === "" ? "navigation" : cta.dataset.trackCta,
        location: cta.dataset.ctaLocation,
      });
    });
    checkExposures();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
