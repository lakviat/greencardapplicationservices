// Only account credentials/profile and an activity timestamp are persisted.
// Worksheet answers, uploads and OAuth attempt verifiers never enter this store.
export const SESSION_KEY = "gcas.auth.v1";
const ACTIVITY_KEY = "gcas.auth.activity.v1";
export const IDLE_TIMEOUT = 5 * 60 * 60 * 1000;
const keys = [SESSION_KEY, `${SESSION_KEY}-user`, ACTIVITY_KEY];

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lastActivity() {
  return Number(read(ACTIVITY_KEY)) || 0;
}
function isCurrent() {
  const last = lastActivity();
  return last > 0 && last <= Date.now() && Date.now() - last < IDLE_TIMEOUT;
}
export function clearStoredSession() {
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}
export function pruneExpiredSession() {
  if (!isCurrent()) clearStoredSession();
}
export function storedSession() {
  if (!isCurrent()) return null;
  try {
    const session = JSON.parse(read(SESSION_KEY));
    return session?.access_token && session?.refresh_token && session?.user?.id
      ? session
      : null;
  } catch {
    return null;
  }
}
export function beginSession() {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {
    throw new Error(
      "Allow this website to store your login in browser settings, then try signing in again.",
    );
  }
}
export const accountStorage = {
  getItem(key) {
    return keys.includes(key) && isCurrent() ? read(key) : null;
  },
  setItem(key, value) {
    // A late refresh must not restore credentials after logout or idle expiry.
    if (!keys.includes(key) || !isCurrent()) return;
    localStorage.setItem(key, value);
  },
  removeItem(key) {
    if (keys.includes(key)) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
  },
};

export function watchSessionActivity(expire) {
  let signedIn = false;
  let timer;
  const check = () => {
    if (!signedIn) return false;
    if (isCurrent() && read(SESSION_KEY)) return true;
    signedIn = false;
    clearTimeout(timer);
    clearStoredSession();
    expire();
    return false;
  };
  const schedule = () => {
    clearTimeout(timer);
    if (check())
      timer = setTimeout(
        schedule,
        Math.max(1, lastActivity() + IDLE_TIMEOUT - Date.now()),
      );
  };
  const activity = () => {
    // Check BEFORE touching the timestamp: returning after five hours cannot
    // revive an expired session. Background token refresh is not user activity.
    if (!check()) return;
    if (Date.now() - lastActivity() >= 30000) beginSession();
    schedule();
  };
  document.addEventListener("pointerdown", activity, { passive: true });
  document.addEventListener("keydown", activity);
  document.addEventListener("input", activity);
  document.addEventListener("change", activity);
  window.addEventListener("pageshow", activity);
  window.addEventListener("focus", activity);
  document.addEventListener("visibilitychange", activity);
  window.addEventListener("storage", (event) => {
    if (keys.includes(event.key)) schedule();
  });
  return {
    check,
    update(session, event) {
      const wasSignedIn = signedIn;
      signedIn = !!session;
      if (!signedIn) {
        clearTimeout(timer);
        // A temporary network failure during INITIAL_SESSION must not erase
        // the refresh credentials the SDK retained for a later retry.
        if (event === "SIGNED_OUT" && !read(SESSION_KEY)) clearStoredSession();
      } else if (!wasSignedIn && document.visibilityState === "visible")
        activity();
      else schedule();
    },
  };
}
