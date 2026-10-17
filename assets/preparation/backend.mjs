// Public project configuration only. Secret keys belong in server secret stores.
import {
  SESSION_KEY,
  accountStorage,
  beginSession,
  clearStoredSession,
  pruneExpiredSession,
  watchSessionActivity,
  storedSession,
} from "./auth-session.mjs?v=20261017-workspace-v27";
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
let activity;
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
  activeAuth ||= (async () => {
    pruneExpiredSession();
    const { createClient } = await import("../vendor/supabase.mjs");
    const client = createClient(SUPABASE_URL, PUBLIC_KEY, {
      auth: {
        flowType: "pkce",
        storageKey: SESSION_KEY,
        storage: accountStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }).auth;
    activity = watchSessionActivity(() => {
      // SDK listeners are synchronous: schedule SDK calls outside their lock.
      setTimeout(() => client.signOut({ scope: "local" }).catch(() => {}), 0);
    });
    activity.update(storedSession(), "INITIAL_STORAGE");
    client.onAuthStateChange((event) =>
      activity.update(storedSession(), event),
    );
    return client;
  })();
  return activeAuth;
}
// Browser history can restore an old page without re-running its modules or
// delivering BroadcastChannel messages sent while it was frozen. Re-read the
// shared session on every return, including the file picker/camera round-trip.
export async function observeSession(listener) {
  const client = await auth();
  let generation = 0;
  const sync = async () => {
    const current = ++generation;
    const saved = storedSession();
    activity.update(saved, "RESUME");
    listener(saved);
    const { data, error } = await client.getSession();
    if (current !== generation) return;
    // A transient refresh failure is not a logout. API requests still require
    // a usable token; the stored profile keeps the account display consistent.
    listener(error ? storedSession() : data.session);
  };
  const schedule = () => {
    generation++;
    // Do not call asynchronous SDK methods inside its synchronous callback.
    setTimeout(() => sync().catch(() => listener(storedSession())), 0);
  };
  client.onAuthStateChange(schedule);
  window.addEventListener("pageshow", schedule);
  window.addEventListener("popstate", schedule);
  window.addEventListener("focus", schedule);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") schedule();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_KEY || event.key === null) schedule();
  });
  await sync();
  return client;
}
// Adopt only after a completed, verified OAuth attempt. Canceled attempts keep
// their verifier/session in their own short-lived client and cannot log us in.
export async function acceptAuth(candidate) {
  const client = await auth();
  const { data } = await candidate.getSession();
  if (!data.session) throw new Error("Please try signing in again.");
  beginSession();
  try {
    const { error } = await client.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (error) throw error;
    // Finish only after the new durable session is available to callers.
    activity.update(storedSession(), "SIGNED_IN");
  } catch (error) {
    clearStoredSession();
    throw error;
  } finally {
    candidate.stopAutoRefresh();
  }
}
export async function signOut() {
  const client = await auth();
  try {
    await client.signOut({ scope: "local" });
  } finally {
    // Local logout still works if the revocation request fails offline.
    clearStoredSession();
    await client.signOut({ scope: "local" });
  }
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
  const client = await auth();
  if (!activity.check())
    throw new Error("Your session ended. Sign in to continue.");
  const { data } = await client.getSession();
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
