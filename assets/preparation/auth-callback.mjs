const params = new URLSearchParams(location.search);
const fragment = new URLSearchParams(location.hash.slice(1));
// Remove codes/errors before any other work; this page loads no analytics.
history.replaceState(null, "", location.pathname);
const output = document.querySelector("[role=status]");
const attempt = params.get("attempt");
const code = params.get("code");
const error = params.has("error") || fragment.has("error");
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    attempt || "",
  ) ||
  (!code && !error) ||
  (code && code.length > 4096)
) {
  output.textContent =
    "This sign-in link is incomplete. Return to your original worksheet tab and start sign-in again.";
} else {
  const message = { type: "gcas-oauth", attempt, code, error };
  let channel, interval, timeout;
  const stop = () => {
    clearInterval(interval);
    clearTimeout(timeout);
    channel?.close();
    window.removeEventListener("message", onMessage);
  };
  const received = (reply) => {
    if (reply?.type !== "gcas-oauth-received" || reply.attempt !== attempt)
      return;
    stop();
    output.textContent =
      "Return to your original worksheet tab to finish. You can close this tab.";
    window.close();
  };
  const onMessage = (event) => {
    if (event.origin === location.origin && event.source === window.opener)
      received(event.data);
  };
  window.addEventListener("message", onMessage);
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(`gcas-auth-${attempt}`);
    channel.onmessage = (event) => received(event.data);
  }
  const send = () => {
    channel?.postMessage(message);
    window.opener?.postMessage(message, location.origin);
  };
  interval = setInterval(send, 500);
  timeout = setTimeout(() => {
    stop();
    output.textContent =
      "Your original worksheet tab could not be reached. Return to it and start sign-in again.";
  }, 15000);
  send();
}
