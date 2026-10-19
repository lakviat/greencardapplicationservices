// Synthetic local account with a deliberately slow server. No real applicant
// data, credentials or payment requests are used in this regression.
const { chromium, webkit, firefox } = require("playwright");
const { randomUUID } = require("node:crypto");
const assert = require("node:assert/strict");
const base = process.env.PREP_BASE_URL || "https://127.0.0.1:8444";
const project = "https://wofazcvfvazfkvujwwcw.supabase.co";
assert.equal(new URL(base).hostname, "127.0.0.1");
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
(async () => {
  for (const engine of (
    process.env.PREP_ENGINES || "chromium,webkit,firefox"
  ).split(",")) {
    const browser = await { chromium, webkit, firefox }[engine].launch();
    try {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 390, height: 844 },
      });
      const user = {
        id: randomUUID(),
        email: "synthetic@example.test",
        email_confirmed_at: new Date().toISOString(),
        user_metadata: { full_name: "Synthetic Person" },
        app_metadata: { provider: "google" },
      };
      const now = Math.floor(Date.now() / 1000);
      const session = {
        user,
        access_token:
          "e30." +
          Buffer.from(
            JSON.stringify({ sub: user.id, exp: now + 3600 }),
          ).toString("base64url") +
          ".c2ln",
        refresh_token: "synthetic-only",
        expires_at: now + 3600,
        expires_in: 3600,
        token_type: "bearer",
      };
      const prepId = randomUUID();
      const { initialDraft } =
        await import("../../assets/preparation/schema.mjs");
      const { entryProgress } =
        await import("../../assets/preparation/entry-progress.mjs");
      const document = initialDraft();
      document.id = randomUUID();
      document.answers["entrant.firstName"] = "SYNTHETIC";
      let preparation = {
        id: prepId,
        package: "single",
        year: 2027,
        version: document.version,
        state: "unpaid",
        revision: 1,
        updated_at: "2026-10-19T10:00:00Z",
        expires_at: "2099-10-19T10:00:00Z",
        payload: { documents: [document] },
      };
      const summary = () => {
        const { payload, ...metadata } = preparation;
        return { ...metadata, entry: entryProgress(preparation) };
      };
      let listGate = deferred(),
        healthGate = deferred(),
        saveGate;
      let lists = 0,
        saves = 0,
        assets = 0,
        failList = false;
      const errors = [];
      await context.route(`${project}/**`, async (route) => {
        const url = new URL(route.request().url());
        const json = (value) => route.fulfill({ json: value });
        if (url.pathname.endsWith("/health")) {
          await healthGate.promise;
          return json({
            accounts: true,
            cloudSave: true,
            checkout: true,
            pdfDownload: true,
          });
        }
        if (url.pathname.endsWith("/settings"))
          return json({ external: { google: true } });
        if (url.pathname.endsWith("/user")) return json(user);
        if (url.pathname.endsWith("/logout")) return json({});
        if (url.pathname.endsWith("/list")) {
          lists++;
          const captured = summary();
          await listGate.promise;
          if (failList)
            return route.fulfill({
              status: 503,
              json: { error: "Synthetic offline response" },
            });
          return json({ preparations: [captured] });
        }
        if (url.pathname.endsWith("/get")) return json({ preparation });
        if (url.pathname.endsWith("/asset")) {
          assets++;
          throw Error("Account overview must not fetch images");
        }
        if (url.pathname.endsWith("/save")) {
          saves++;
          const body = route.request().postDataJSON();
          assert.equal(body.id, prepId, "autosave keeps the same preparation");
          assert.equal(body.revision, preparation.revision);
          if (saveGate) await saveGate.promise;
          preparation = {
            ...preparation,
            payload: body.payload,
            revision: preparation.revision + 1,
            updated_at: `2026-10-19T10:00:0${saves}Z`,
          };
          return json({ preparation });
        }
        throw Error("Unexpected request: " + url.pathname);
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/auth-callback.html`);
      await page.evaluate((session) => {
        localStorage.setItem("gcas.auth.v1", JSON.stringify(session));
        localStorage.setItem("gcas.auth.activity.v1", String(Date.now()));
      }, session);
      const started = Date.now();
      await page.goto(`${base}/prepare.html#account`);
      await page
        .locator(".account-page [role=status]")
        .filter({ hasText: "Loading your saved progress" })
        .waitFor();
      assert(
        Date.now() - started < 1500,
        "signed-in account shell must not wait for health/settings",
      );
      assert.equal(
        await page
          .getByText(
            "Sign in to see your saved preparations and account settings.",
            { exact: true },
          )
          .count(),
        0,
      );
      const heading = page.getByRole("heading", {
        name: "My account",
        exact: true,
      });
      assert.equal(
        await heading.evaluate((h) => getComputedStyle(h).outlineStyle),
        "none",
      );
      const settings = page.getByRole("button", {
        name: "Settings",
        exact: true,
      });
      await settings.focus();
      assert.notEqual(
        await settings.evaluate((b) => getComputedStyle(b).outlineStyle),
        "none",
        "keyboard users keep a visible focus indicator",
      );
      listGate.resolve();
      healthGate.resolve();
      await page.getByText("SYNTHETIC", { exact: true }).waitFor();
      assert.equal(
        lists,
        1,
        "prefetch and first visit share a single list request",
      );
      await settings.click();
      const repeatStarted = Date.now();
      await page.getByRole("button", { name: "My entry", exact: true }).click();
      await page.getByText("SYNTHETIC", { exact: true }).waitFor();
      const repeatMs = Date.now() - repeatStarted;
      assert(
        repeatMs < 1000,
        "repeat entry view renders without another server wait",
      );
      assert.equal(lists, 1);
      assert.equal(await page.locator(".account-loading").count(), 0);
      await page
        .getByRole("button", { name: "Continue preparation", exact: true })
        .click();
      await page.locator('[id="entrant.firstName"]').fill("UPDATED");
      saveGate = deferred();
      await page.waitForRequest((r) => r.url().endsWith("/save"));
      listGate = deferred();
      await page
        .getByRole("button", { name: "My preparations", exact: true })
        .click();
      await page.getByText("SYNTHETIC", { exact: true }).waitFor();
      assert.equal(await page.locator(".account-loading").count(), 0);
      saveGate.resolve();
      saveGate = undefined;
      await page.getByText("UPDATED", { exact: true }).waitFor();
      assert.match(
        await page.locator(".entry-save-time").innerText(),
        /Last saved/,
      );
      assert.equal(
        saves,
        1,
        "one debounced save; opening the account adds no write",
      );
      assert.equal(assets, 0);
      // No private summary/worksheet cache may be persisted alongside Auth.
      assert.deepEqual(
        await page.evaluate(() =>
          Object.keys(localStorage).filter(
            (k) =>
              ![
                "gcas.auth.v1",
                "gcas.auth.v1-user",
                "gcas.auth.activity.v1",
              ].includes(k),
          ),
        ),
        [],
      );
      // Force a slow, failed refresh after a confirmed save invalidated freshness.
      failList = true;
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("button", { name: "My entry", exact: true }).click();
      await page.getByText("UPDATED", { exact: true }).waitFor();
      assert.equal(await page.locator(".account-loading").count(), 0);
      listGate.resolve();
      await page.getByText(/Showing your last loaded progress/).waitFor();
      assert.equal(
        await page.locator(".entry-applicant").innerText(),
        "UPDATED",
      );
      failList = false;
      await page
        .getByRole("button", { name: "Try again", exact: true })
        .click();
      await page
        .getByText(/Showing your last loaded progress/)
        .waitFor({ state: "hidden" });
      // Logout clears the overview and a late reply cannot bring it back.
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page
        .getByRole("button", { name: "Sign out & clear this tab", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Sign in to your account", exact: true })
        .waitFor();
      assert.equal(await page.getByText("UPDATED", { exact: true }).count(), 0);
      assert.deepEqual(errors, []);
      console.log(
        `${engine}: immediate shell, shared prefetch, repeat entry ${repeatMs}ms, no blue heading box, one autosave updates visible summary, failed-refresh recovery, private-memory cache and logout passed.`,
      );
      await context.close();
    } finally {
      await browser.close();
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
