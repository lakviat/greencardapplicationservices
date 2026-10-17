// Simulated OAuth provider; real local Auth session/DB/API. Payment fixture is local-only.
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import jpeg from "jpeg-js";
import { readFileSync } from "node:fs";
import {
  initialDraft,
  fields,
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
  let challenge,
    authorizations = 0;
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
        authorizations++;
        assert.equal(url.searchParams.get("provider"), "google");
        assert.equal(url.searchParams.get("prompt"), "select_account");
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
    .getByRole("button", {
      name: /^(Sign in \/ open|Open) saved preparations$/,
    })
    .click();
  const d = {
    ...initialDraft(),
    id: randomUUID(),
    answers: {
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
    .locator(".draft-status")
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
  assert(
    !Object.hasOwn(saved.payload.documents[0].answers, "preparation.consent"),
  );
  assert.equal(await page.locator('[id="preparation.consent"]').count(), 0);
  for (const [field, expected] of Object.entries({
    "entrant.birthCountry": "Kyrgyzstan",
    "address.country": "United States",
    "contact.country": "United States",
    "contact.email": "julia@example.test",
  }))
    assert.equal(saved.payload.documents[0].answers[field], expected);
  await page.evaluate(() => document.activeElement.blur());
  await page.getByRole("button", { name: "More preparation actions" }).tap();
  assert.equal(await page.getByRole("button", { name: /^Buy / }).count(), 0);
  assert(
    await page.getByText("Purchased package", { exact: true }).isVisible(),
  );
  await page.getByRole("button", { name: "Save Progress", exact: true }).tap();
  await page
    .getByRole("heading", { name: "Progress saved", exact: true })
    .waitFor();
  assert.match(
    await page.getByRole("dialog").innerText(),
    /Your latest changes are saved to/,
  );
  await page.getByRole("button", { name: "Close dialog" }).tap();
  await page.reload();
  await page
    .getByRole("button", { name: `Account: ${email}`, exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "My preparations", exact: true })
    .tap();
  await page
    .getByRole("button", {
      name: /^(Sign in \/ open|Open) saved preparations$/,
    })
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
  assert.equal(
    authorizations,
    1,
    "Restored login reopens real saved data without another OAuth attempt",
  );
  // Complete a synthetic paid fixture through real local storage/API, then
  // verify that the preview receives a real PDF rather than the unpaid sample.
  const complete = structuredClone(saved.payload.documents[0]);
  complete.answers["passport.path"] = "stateless";
  complete.answers["entrant.marital"] = "married-us";
  complete.answers["eligibility.basis"] = "birth";
  complete.secondEntry = true; // Old stale optional request must not block 100%.
  for (let i = 0; i < 3; i++)
    for (const f of fields(complete)) {
      if (["photo", "passportPhoto"].includes(f.type)) continue;
      if (f.type === "checkbox") complete.answers[f.id] = true;
      else if (!complete.answers[f.id])
        complete.answers[f.id] =
          f.type === "country"
            ? "Kyrgyzstan"
            : f.type === "select"
              ? f.options[0].value
              : f.type === "date"
                ? "1990-01-01"
                : f.type === "futureDate"
                  ? "2090-01-01"
                  : f.type === "email"
                    ? "julia@example.test"
                    : "EXAMPLE";
    }
  const photo = jpeg.encode(
    { data: Buffer.alloc(600 * 600 * 4, 255), width: 600, height: 600 },
    80,
  ).data;
  const uploadedResponse = await fetch(
    `${config.API_URL}/functions/v1/gcas-api/upload?id=${id}&document=${d.id}&field=entrant.photo`,
    {
      method: "POST",
      headers: {
        apikey: config.ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "image/jpeg",
      },
      body: photo,
    },
  );
  assert.equal(uploadedResponse.status, 200);
  const uploaded = await uploadedResponse.json();
  complete.assets["entrant.photo"] = {
    id: uploaded.id,
    status: "valid",
    confirmed: true,
  };
  ok(
    await db
      .from("gcas_preparations")
      .update({ payload: { documents: [complete] } })
      .eq("id", id),
  );
  await page
    .getByRole("button", { name: "My preparations", exact: true })
    .tap();
  await page
    .getByRole("button", {
      name: /^(Sign in \/ open|Open) saved preparations$/,
    })
    .tap();
  await page
    .getByRole("button", { name: "Open preparation", exact: true })
    .tap();
  await page.waitForFunction(
    () =>
      document.querySelector("[data-progress-label]")?.textContent === "100%",
  );
  assert.equal(await page.locator("[data-progress-label]").innerText(), "100%");
  await page.evaluate(() => document.activeElement.blur());
  await page.getByRole("button", { name: "More preparation actions" }).tap();
  await page
    .getByRole("button", { name: "Review Document", exact: true })
    .tap();
  await page.getByRole("button", { name: "Preview prepared worksheet" }).tap();
  const viewer = page.locator('.pdf-page-surface canvas[data-rendered="1"]');
  await viewer.waitFor();
  const pdfUrl = await page
    .getByRole("link", { name: "Open PDF in a new tab" })
    .getAttribute("href");
  assert(pdfUrl.startsWith("blob:"));
  assert.equal(await page.locator(".limited-preview").count(), 0);
  assert(
    await viewer.evaluate((canvas) => {
      const bytes = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height).data;
      return bytes.some((value, i) => i % 4 !== 3 && value < 100);
    }),
    "Paid PDF page contains rendered text pixels",
  );
  await page.getByRole("button", { name: "Next page →", exact: true }).tap();
  await page.locator('.pdf-page-surface canvas[data-rendered="2"]').waitFor();
  await page
    .getByRole("button", { name: "← Previous page", exact: true })
    .tap();
  await viewer.waitFor();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).tap();
  const download = await downloaded;
  assert.equal(
    readFileSync(await download.path())
      .subarray(0, 4)
      .toString(),
    "%PDF",
  );
  await page.screenshot({ path: "/tmp/gcas-paid-pdf-mobile.png" });
  await page
    .getByRole("button", { name: "← Back to review", exact: true })
    .tap();
  assert.equal(
    await page.evaluate(async (url) => {
      try {
        await fetch(url);
        return false;
      } catch {
        return true;
      }
    }, pdfUrl),
    true,
    "Leaving preview revokes the private PDF URL",
  );
  assert.deepEqual(
    await page.evaluate(() => Object.keys(localStorage).sort()),
    ["gcas.auth.activity.v1", "gcas.auth.v1"],
  );
  assert.equal(
    await page.evaluate(() =>
      JSON.stringify(localStorage).includes("contact.email"),
    ),
    false,
  );
  assert.equal(await page.evaluate(() => sessionStorage.length), 0);
  await page.screenshot({ path: "/tmp/gcas-backend-account-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: simulated OAuth with a real local Auth session, mobile country taps, paid autosave, reopening persisted countries/contact, purchased menu, private browser storage, completed paid PDF viewing/downloading and blob cleanup.",
  );
} finally {
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await browser.close();
  if (customer) {
    ok(await db.from("gcas_preparations").delete().eq("id", id));
    ok(await db.auth.admin.deleteUser(customer.id));
  }
}
