// Real SDK restoration/refresh with synthetic Auth responses; never uses live accounts.
const { chromium, webkit, firefox } = require("playwright");
const { randomUUID } = require("node:crypto");
const assert = require("node:assert/strict");
const base = process.env.PREP_BASE_URL || "https://127.0.0.1:8444";
assert.equal(new URL(base).hostname, "127.0.0.1");
const project = "https://wofazcvfvazfkvujwwcw.supabase.co";
const hour = 3600000;
const key = "gcas.auth.v1",
  activityKey = "gcas.auth.activity.v1";
const user = {
  id: randomUUID(),
  email: "session@example.test",
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "google" },
  user_metadata: { full_name: "Session Test" },
};
function session(now, sequence = 0) {
  const expires_at = Math.floor((now + hour) / 1000);
  return {
    access_token: `e30.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires_at })).toString("base64url")}.c2ln`,
    refresh_token: `synthetic-refresh-${sequence}`,
    expires_at,
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
}
(async () => {
  for (const engine of (
    process.env.PREP_ENGINES || "chromium,webkit,firefox"
  ).split(",")) {
    const browser = await { chromium, webkit, firefox }[engine].launch();
    try {
      for (const scenario of [
        "refresh-and-idle",
        "expired-return",
        "revoked-session",
      ]) {
        const context = await browser.newContext({
          ignoreHTTPSErrors: true,
          viewport: { width: 390, height: 844 },
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.clock.install();
        let refreshes = 0;
        await context.route(`${project}/**`, async (route) => {
          const url = new URL(route.request().url());
          if (url.pathname.endsWith("/health"))
            return route.fulfill({ json: { accounts: true, cloudSave: true } });
          if (url.pathname.endsWith("/settings"))
            return route.fulfill({ json: { external: { google: true } } });
          if (url.pathname.endsWith("/token")) {
            assert.equal(url.searchParams.get("grant_type"), "refresh_token");
            assert.match(
              route.request().postDataJSON().refresh_token,
              /^synthetic-refresh-/,
            );
            refreshes++;
            if (scenario === "revoked-session")
              return route.fulfill({
                status: 400,
                json: {
                  code: "refresh_token_not_found",
                  msg: "Refresh token revoked",
                },
              });
            const now = await page.evaluate(() => Date.now());
            return route.fulfill({ json: session(now, refreshes) });
          }
          if (url.pathname.endsWith("/user"))
            return route.fulfill({ json: user });
          if (url.pathname.endsWith("/logout"))
            return route.fulfill({ json: {} });
          if (url.pathname.endsWith("/list"))
            return route.fulfill({ json: { preparations: [] } });
          throw new Error(`Unexpected request: ${url.pathname}`);
        });
        // Seed a previously completed login on a page that does not initialize Auth.
        await page.goto(`${base}/auth-callback.html`);
        const now = await page.evaluate(() => Date.now());
        await page.evaluate(
          ({ key, activityKey, stored, last }) => {
            localStorage.setItem(key, JSON.stringify(stored));
            localStorage.setItem(activityKey, String(last));
          },
          {
            key,
            activityKey,
            stored: session(now - 2 * hour),
            last: now - (scenario === "expired-return" ? 5 * hour + 1 : 1000),
          },
        );
        await page.goto(`${base}/prepare.html`);
        const signedIn = page.getByRole("button", {
          name: `Account: ${user.email}`,
          exact: true,
        });
        const signedOut = page.getByRole("button", {
          name: "Sign in to your account",
          exact: true,
        });
        if (scenario === "refresh-and-idle") {
          await signedIn.waitFor();
          assert.equal(
            refreshes,
            1,
            "Expired access token refreshes on return",
          );
          assert.equal(
            await page.locator('[id="entrant.firstName"]').inputValue(),
            "",
            "Login restoration does not create worksheet answers",
          );
          // Real activity keeps the session beyond five hours total. Refresh
          // timers alone must not reset the idle clock.
          for (let n = 0; n < 3; n++) {
            const before = refreshes;
            await page.clock.fastForward(2 * hour);
            await page.waitForFunction(
              ({ key, previous }) =>
                JSON.parse(localStorage.getItem(key))?.refresh_token !==
                previous,
              { key, previous: `synthetic-refresh-${before}` },
            );
            await page.locator('[id="entrant.firstName"]').click();
            await signedIn.waitFor();
          }
          assert(refreshes >= 4, "SDK refreshes without another Google login");
          await page.clock.fastForward(5 * hour + 1000);
          await signedOut.waitFor();
          assert.equal(
            await page.evaluate(() => localStorage.length),
            0,
            "Five idle hours clear the account",
          );
          await page.reload();
          await signedOut.waitFor();
        } else {
          await signedOut.waitFor();
          assert.equal(refreshes, scenario === "expired-return" ? 0 : 1);
          assert.equal(
            await page.evaluate(() => localStorage.length),
            0,
            "Expired/revoked accounts cannot reappear",
          );
        }
        assert.deepEqual(errors, []);
        await context.close();
      }
      console.log(
        `PASS ${engine}: restored account, expired-token refresh, active use beyond five hours, idle expiry, stale return and revoked refresh token.`,
      );
    } finally {
      await browser.close();
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
