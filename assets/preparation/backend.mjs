// Public project configuration only. Secret keys belong in server secret stores.
export const SUPABASE_URL = "https://wofazcvfvazfkvujwwcw.supabase.co";
const PUBLIC_KEY = "sb_publishable_qPtFiEot3EAVlP3HftCm1g_4odarxBw";
export const CAPABILITIES = {
  cloudSave: false,
  checkout: false,
  accounts: false,
  pdfDownload: false,
  emailDelivery: false,
  premium: false,
};
export const unavailable =
  "Account saving and checkout are awaiting activation. No payment is collected until checkout is available. Keep this tab open to retain unsaved work.";
export const PROVIDERS = { google: false, apple: false };
let activeAuth;
export async function createAuth() {
  const { createClient } = await import("../vendor/supabase.mjs");
  return createClient(SUPABASE_URL, PUBLIC_KEY, {
    auth: {
      flowType: "pkce",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }).auth;
}
export async function auth() {
  activeAuth ||= await createAuth();
  return activeAuth;
}
// Adopt only after a completed, verified OAuth attempt. Canceled attempts keep
// their verifier/session in their own short-lived client and cannot log us in.
export function acceptAuth(candidate) {
  activeAuth?.stopAutoRefresh();
  activeAuth = candidate;
  activeAuth.startAutoRefresh();
}
export async function capabilities() {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/gcas-api/health`, {
      headers: { apikey: PUBLIC_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return;
    const value = await res.json();
    for (const provider of Object.keys(PROVIDERS)) PROVIDERS[provider] = false;
    if (value.accounts === true) {
      const settings = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: PUBLIC_KEY },
        signal: AbortSignal.timeout(10000),
      });
      if (!settings.ok) return;
      const { external } = await settings.json();
      for (const provider of Object.keys(PROVIDERS))
        PROVIDERS[provider] = external?.[provider] === true;
    }
    value.accounts =
      value.accounts === true && Object.values(PROVIDERS).some(Boolean);
    for (const key of Object.keys(CAPABILITIES))
      CAPABILITIES[key] = key !== "premium" && value[key] === true;
  } catch {
    /* Fail closed; free preparation remains usable. */
  }
}
export async function user() {
  return (await (await auth()).getUser()).data.user;
}
export async function api(route, body = {}, query = "") {
  const { data } = await (await auth()).getSession();
  if (!data.session) throw new Error("Sign in to continue.");
  const isImage = body instanceof Blob;
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/gcas-api/${route}${query}`,
    {
      method: "POST",
      headers: {
        apikey: PUBLIC_KEY,
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": isImage ? "image/jpeg" : "application/json",
      },
      body: isImage ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!res.ok) {
    let error;
    try {
      error = (await res.json()).error;
    } catch {}
    throw new Error(
      error || "The service could not complete this request. Please retry.",
    );
  }
  return ["pdf", "asset"].includes(route) ? res.blob() : res.json();
}
