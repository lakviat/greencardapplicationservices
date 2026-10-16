// Backend explicitly deferred by the owner on 2026-10-16. Fail closed.
// Do not replace these flags with client-side “paid” values. Entitlements must
// come from an authenticated server that verifies Stripe webhook events.
export const CAPABILITIES = Object.freeze({
  cloudSave: false,
  checkout: false,
  accounts: false,
  pdfDownload: false,
  emailDelivery: false,
  premium: false,
});
export const unavailable =
  "Cloud saving, accounts, checkout, and delivery are not connected in this preview. No payment is collected. Keep this tab open to retain your draft.";
