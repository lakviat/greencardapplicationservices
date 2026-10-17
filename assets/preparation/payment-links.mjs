// Existing owner-created live links. Checkout never creates products or links.
export const PAYMENT_LINKS = Object.freeze({
  single: Object.freeze({
    id: "plink_1U0mXFPPnLl3qhjKqmsP17oS",
    url: "https://buy.stripe.com/9B614p5JI4SH6xNd0U0Ny05",
  }),
  couple: Object.freeze({
    id: "plink_1U0mYfPPnLl3qhjKlSNenRts",
    url: "https://buy.stripe.com/28E28t5JI4SH1dt1ic0Ny06",
  }),
  family: Object.freeze({
    id: "plink_1U0mZOPPnLl3qhjKtlqZpD0T",
    url: "https://buy.stripe.com/eVqbJ34FE98X6xN6Cw0Ny07",
  }),
});

export function checkoutDestination(value) {
  const url = new URL(value);
  if (url.username || url.password)
    throw new Error("Unexpected checkout destination.");
  if (
    url.origin === "https://checkout.stripe.com" &&
    url.pathname.startsWith("/c/pay/")
  )
    return url;
  if (
    Object.values(PAYMENT_LINKS).some(
      (link) => url.origin + url.pathname === link.url,
    ) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      url.searchParams.get("client_reference_id") || "",
    )
  )
    return url;
  throw new Error("Unexpected checkout destination.");
}
