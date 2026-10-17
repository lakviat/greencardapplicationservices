import { el, button } from "./dom.mjs?v=20261017-workspace-v28";

// Only Google's profile-image CDN may receive an avatar request. Metadata is
// untrusted; arbitrary remote URLs, credentials and application answers stay out.
function googlePhoto(account) {
  if (account?.app_metadata?.provider !== "google") return null;
  try {
    const url = new URL(
      account.user_metadata?.avatar_url || account.user_metadata?.picture,
    );
    if (
      url.protocol === "https:" &&
      /^lh[3-6]\.googleusercontent\.com$/.test(url.hostname) &&
      !url.port &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {}
  return null;
}

export function accountControl(open) {
  const face = el("span", { class: "account-avatar", "aria-hidden": "true" });
  const label = el("span", { class: "account-label" });
  const node = button([face, label], open, {
    class: "account-control",
    "aria-haspopup": "dialog",
  });
  const update = (account) => {
    label.textContent = account ? "Signed in" : "Sign in";
    const description = account
      ? `Account: ${account.email}`
      : "Sign in to your account";
    node.setAttribute("aria-label", description);
    node.title = description;
    node.classList.toggle("is-signed-in", !!account);
    const fullName = account?.user_metadata?.full_name;
    const name =
      (typeof fullName === "string" && fullName.trim()) || account?.email || "";
    const initials = name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join("")
      .toUpperCase();
    face.replaceChildren(
      account
        ? el("span", {}, initials || "✓")
        : el("span", { class: "account-person" }),
    );
    const photo = googlePhoto(account);
    if (photo) {
      const image = el("img", {
        alt: "",
        referrerpolicy: "no-referrer",
        width: 32,
        height: 32,
      });
      image.addEventListener("error", () => image.remove(), { once: true });
      image.src = photo;
      face.append(image);
    }
  };
  update(null);
  label.textContent = "Checking account…";
  node.setAttribute("aria-label", "Checking account");
  return { node, update };
}
