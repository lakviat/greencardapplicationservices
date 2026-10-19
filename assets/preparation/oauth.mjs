import {
  createAuth,
  SUPABASE_URL,
} from "./backend.mjs?v=20261019-workspace-v37";

// The worksheet never navigates away. Only a single-use authorization code
// crosses tabs; each attempt keeps its PKCE verifier and candidate in memory.
// Only a completed, verified attempt is adopted into the persistent account.
export function beginSignIn(provider) {
  if (!["google", "apple"].includes(provider))
    throw new Error("Choose Google or Apple to continue.");
  const attempt = crypto.randomUUID();
  const popup = window.open("about:blank", "_blank");
  if (!popup)
    throw new Error(
      "Allow a new sign-in tab, then try again. Your worksheet is still here.",
    );
  let channel,
    timer,
    settled = false,
    processing = false,
    candidate;
  let resolve, reject;
  const result = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    candidate?.stopAutoRefresh();
    clearTimeout(timer);
    window.removeEventListener("message", onMessage);
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("pageshow", resume);
    channel?.close();
    // COOP may sever the WindowProxy; BroadcastChannel still works on return.
    try {
      if (!popup.closed && popup.opener === window) popup.close();
    } catch {}
    if (error) reject(error);
    else resolve(value);
  };
  const receive = async (message, reply) => {
    if (
      settled ||
      processing ||
      !candidate ||
      message?.type !== "gcas-oauth" ||
      message.attempt !== attempt
    )
      return;
    if (typeof message.code !== "string" && message.error !== true) return;
    processing = true;
    reply({ type: "gcas-oauth-received", attempt });
    if (message.error)
      return finish(
        new Error(
          "Sign-in was not completed. Please try again with Google or Apple.",
        ),
      );
    try {
      const { data, error } = await candidate.exchangeCodeForSession(
        message.code,
      );
      if (error || !data.session) throw new Error();
      const verified = await candidate.getUser();
      if (verified.error || !verified.data.user?.email_confirmed_at)
        throw new Error();
      if (settled) return;
      finish(null, { candidate, user: verified.data.user });
    } catch {
      finish(
        new Error(
          "We could not complete sign-in. Please close the sign-in tab and try again.",
        ),
      );
    }
  };
  const onMessage = (event) => {
    if (event.origin === location.origin && event.source === popup)
      receive(event.data, (reply) =>
        event.source.postMessage(reply, location.origin),
      );
  };
  window.addEventListener("message", onMessage);
  const resume = () => {
    if (!settled && document.visibilityState === "visible")
      channel?.postMessage({ type: "gcas-oauth-ready", attempt });
  };
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("pageshow", resume);
  timer = setTimeout(
    () =>
      finish(
        new Error(
          "Sign-in timed out. Your worksheet is still here; please try again.",
        ),
      ),
    5 * 60 * 1000,
  );
  (async () => {
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(`gcas-auth-${attempt}`);
        channel.onmessage = (event) =>
          receive(event.data, (reply) => channel.postMessage(reply));
      }
      candidate = await createAuth();
      if (settled) {
        candidate.stopAutoRefresh();
        return;
      }
      const redirectTo = new URL("/auth-callback.html", location.origin);
      redirectTo.searchParams.set("attempt", attempt);
      const { data, error } = await candidate.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo.href,
          skipBrowserRedirect: true,
          queryParams:
            provider === "google" ? { prompt: "select_account" } : {},
        },
      });
      if (settled) return;
      if (error || !data.url) throw new Error();
      const target = new URL(data.url);
      if (
        target.origin !== SUPABASE_URL ||
        target.pathname !== "/auth/v1/authorize" ||
        target.searchParams.get("provider") !== provider
      )
        throw new Error();
      // Detach the provider from the worksheet. The callback returns through
      // its same-origin channel and closes itself (including on Safari).
      if (channel) popup.opener = null;
      popup.location.replace(target.href);
    } catch {
      finish(new Error("Sign-in could not start. Please try again."));
    }
  })();
  return { result, cancel: () => finish(new Error("Sign-in canceled.")) };
}
