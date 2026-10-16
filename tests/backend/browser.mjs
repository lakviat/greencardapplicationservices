// Real local OTP delivery through Mailpit; real Auth/DB/API. Payment fixture is local-only.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import {
  initialDraft,
  FORM_VERSION,
} from "../../assets/preparation/schema.mjs";
const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
  encoding: "utf8",
});
const config = JSON.parse(raw.slice(raw.indexOf("{")));
assert.equal(new URL(config.API_URL).hostname, "127.0.0.1");
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
});
const errors = [];
let customer;
try {
  await context.route(
    "https://wofazcvfvazfkvujwwcw.supabase.co/**",
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const response = await route.fetch({
        url: config.API_URL + url.pathname + url.search,
        headers: { ...request.headers(), apikey: config.ANON_KEY },
      });
      await route.fulfill({ response });
    },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("https://127.0.0.1:8444/prepare.html#dashboard");
  await page
    .getByRole("button", { name: "Sign in / open saved preparations" })
    .click();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send sign-in code" }).click();
  await page.getByLabel("Sign-in code", { exact: true }).waitFor();
  let message;
  for (let attempt = 0; attempt < 20; attempt++) {
    const data = await (
      await fetch(config.MAILPIT_URL + "/api/v1/messages")
    ).json();
    message = data.messages?.find((m) => m.To.some((t) => t.Address === email));
    if (message) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  assert(message, "OTP email reached local Mailpit");
  const mail = await (
    await fetch(config.MAILPIT_URL + "/api/v1/message/" + message.ID)
  ).json();
  const code = mail.HTML.match(/<strong>(\d+)<\/strong>/)?.[1];
  assert(code, "OTP template contains the code");
  customer = ok(await db.auth.admin.listUsers()).users.find(
    (u) => u.email === email,
  );
  assert(customer);
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
    await db
      .from("gcas_preparations")
      .insert({
        id,
        owner_id: customer.id,
        package: "single",
        version: FORM_VERSION.id,
        year: 2027,
        state: "paid",
        payload: { documents: [d] },
      }),
  );
  await page.getByLabel("Sign-in code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await page
    .getByRole("button", { name: "Open preparation", exact: true })
    .click();
  const first = page.locator('[data-field="entrant.firstName"] [data-control]');
  assert.equal(await first.inputValue(), "JANE");
  await first.fill("JULIA");
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
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  await page.screenshot({ path: "/tmp/gcas-backend-account-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: actual OTP delivery and verification, opening a paid fixture, automatic save, private browser storage on mobile.",
  );
} finally {
  await browser.close();
  if (customer) {
    ok(await db.from("gcas_preparations").delete().eq("id", id));
    ok(await db.auth.admin.deleteUser(customer.id));
  }
}
