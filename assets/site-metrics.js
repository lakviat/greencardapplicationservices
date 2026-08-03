window.dataLayer = window.dataLayer || [];

const consentStorageKey = "gcas_cookie_preferences_v1";

window.gtag = function gtag() {
  window.dataLayer.push(arguments);
};

const normalizeConsent = (preferences = {}) => ({
  preferences: Boolean(preferences.preferences),
  analytics: Boolean(preferences.analytics),
  advertising: Boolean(preferences.advertising),
});

const updateGoogleConsent = (preferences) => {
  const normalized = normalizeConsent(preferences);

  window.gtag("consent", "update", {
    functionality_storage: normalized.preferences ? "granted" : "denied",
    personalization_storage: normalized.preferences ? "granted" : "denied",
    analytics_storage: normalized.analytics ? "granted" : "denied",
    ad_storage: normalized.advertising ? "granted" : "denied",
    ad_user_data: normalized.advertising ? "granted" : "denied",
    ad_personalization: normalized.advertising ? "granted" : "denied",
  });

  return normalized;
};

const readSavedConsent = () => {
  try {
    const saved = window.localStorage.getItem(consentStorageKey);
    return saved ? normalizeConsent(JSON.parse(saved)) : null;
  } catch {
    return null;
  }
};

window.gtag("consent", "default", {
  functionality_storage: "denied",
  personalization_storage: "denied",
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  security_storage: "granted",
  wait_for_update: 500,
});

const savedConsent = readSavedConsent();
if (savedConsent) updateGoogleConsent(savedConsent);

window.gcasConsent = {
  get: readSavedConsent,
  save(preferences) {
    const normalized = updateGoogleConsent(preferences);

    try {
      window.localStorage.setItem(
        consentStorageKey,
        JSON.stringify(normalized),
      );
    } catch {
      // Consent still applies for this page view if storage is unavailable.
    }

    return normalized;
  },
};

window.gtag("js", new Date());
window.gtag("config", "G-9P726CYPGF");
window.gtag("config", "AW-17948229197");
