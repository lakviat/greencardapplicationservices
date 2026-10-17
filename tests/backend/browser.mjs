// Simulated OAuth provider; real local Auth session/DB/API. Payment fixture is local-only.
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import {
  initialDraft,
  FORM_VERSION,
} from "../../assets/preparation/schema.mjs";
import { localConfig } from "./local-config.mjs";
const config = localConfig();
const base = process.env.PREP_BASE_URL || "https://127.0.0.1:8444";
assert.equal(new URL(base).hostname, "127.0.0.1");
const db = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  }),
  email = `browser-${randomUUID()}@example.test`,
  id = randomUUID();
const ok = (r) => {
  assert.equal(r.error, null, r.error?.message);
  return r.data;
};
const browser = await chromium.launch();
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});
const errors = [];
let customer;
try {
  customer = ok(
    await db.auth.admin.createUser({
      email,
      password: randomUUID(),
      email_confirm: true,
    }),
  ).user;
  const generated = ok(
    await db.auth.admin.generateLink({ type: "magiclink", email }),
  );
  const fixtureAuth = createClient(config.API_URL, config.ANON_KEY, {
    auth: { persistSession: false },
  });
  const session = ok(
    await fixtureAuth.auth.verifyOtp({
      token_hash: generated.properties.hashed_token,
      type: "magiclink",
    }),
  ).session;
  const authCode = randomUUID();
  let challenge;
  await context.route(
    "https://wofazcvfvazfkvujwwcw.supabase.co/**",
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/settings"))
        return route.fulfill({
          json: { external: { google: true, apple: true } },
        });
      if (url.pathname.endsWith("/authorize")) {
        assert.equal(url.searchParams.get("provider"), "google");
        assert.equal(url.searchParams.get("code_challenge_method"), "s256");
        challenge = url.searchParams.get("code_challenge");
        const redirect = new URL(url.searchParams.get("redirect_to"));
        assert.equal(redirect.origin, base);
        redirect.searchParams.set("code", authCode);
        return route.fulfill({
          status: 302,
          headers: { location: redirect.href },
        });
      }
      if (
        url.pathname.endsWith("/token") &&
        url.searchParams.get("grant_type") === "pkce"
      ) {
        const body = request.postDataJSON();
        assert.equal(body.auth_code, authCode);
        assert.equal(
          createHash("sha256").update(body.code_verifier).digest("base64url"),
          challenge,
        );
        return route.fulfill({ json: session });
      }
      const response = await route.fetch({
        url: config.API_URL + url.pathname + url.search,
        headers: { ...request.headers(), apikey: config.ANON_KEY },
      });
      await route.fulfill({ response });
    },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/prepare.html#dashboard`);
  await page
    .getByRole("button", { name: "Sign in / open saved preparations" })
    .click();
  const d = {
    ...initialDraft(),
    id: randomUUID(),
    answers: {
      "preparation.consent": true,
      "entrant.lastName": "SYNTHETIC",
      "entrant.firstName": "JANE",
    },
  };
  ok(
    await db.from("gcas_preparations").insert({
      id,
      owner_id: customer.id,
      package: "single",
      version: FORM_VERSION.id,
      year: 2027,
      state: "paid",
      payload: { documents: [d] },
    }),
  );
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page
    .getByRole("button", { name: "Open preparation", exact: true })
    .click();
  const first = page.locator('[data-field="entrant.firstName"] [data-control]');
  assert.equal(await first.inputValue(), "JANE");
  await first.fill("JULIA");
  for (const [field, query, country] of [
    ["entrant.birthCountry", "Kyr", "Kyrgyzstan"],
    ["address.country", "United", "United States"],
    ["contact.country", "United", "United States"],
  ]) {
    await page.locator(`[id="${field}"]`).fill(query);
    await page.getByRole("option", { name: country, exact: true }).tap();
    assert.equal(await page.locator(`[id="${field}"]`).inputValue(), country);
  }
  await page.locator('[id="contact.email"]').fill("julia@example.test");
  await page
    .getByText("Saved to your account", { exact: true })
    .waitFor({ timeout: 15000 });
  const saved = ok(
    await db.from("gcas_preparations").select("*").eq("id", id).single(),
  );
  assert.equal(
    saved.payload.documents[0].answers["entrant.firstName"],
    "JULIA",
  );
  assert(saved.revision > 0);
  for (const [field, expected] of Object.entries({
    "entrant.birthCountry": "Kyrgyzstan",
    "address.country": "United States",
    "contact.country": "United States",
    "contact.email": "julia@example.test",
  }))
    assert.equal(saved.payload.documents[0].answers[field], expected);
  await page.getByRole("button", { name: "More preparation actions" }).tap();
  assert.equal(await page.getByRole("button", { name: /^Buy / }).count(), 0);
  assert(
    await page.getByText("Purchased package", { exact: true }).isVisible(),
  );
  await page.getByRole("button", { name: "Close dialog" }).tap();
  await page
    .getByRole("button", { name: "My preparations", exact: true })
    .tap();
  await page
    .getByRole("button", { name: "Sign in / open saved preparations" })
    .tap();
  await page
    .getByRole("button", { name: "Open preparation", exact: true })
    .tap();
  assert.equal(
    await page.locator('[id="entrant.birthCountry"]').inputValue(),
    "Kyrgyzstan",
  );
  assert.equal(
    await page.locator('[id="address.country"]').inputValue(),
    "United States",
  );
  assert.equal(
    await page.locator('[id="contact.email"]').inputValue(),
    "julia@example.test",
  );
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  await page.screenshot({ path: "/tmp/gcas-backend-account-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: simulated OAuth with a real local Auth session, mobile country taps, paid autosave, reopening persisted countries/contact, purchased menu, private browser storage.",
  );
} finally {
  await browser.close();
  if (customer) {
    ok(await db.from("gcas_preparations").delete().eq("id", id));
    ok(await db.auth.admin.deleteUser(customer.id));
  }
}
