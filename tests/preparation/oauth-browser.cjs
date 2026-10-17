// OAuth-provider responses are simulated. Real SDK PKCE, callback, UI and
// tab isolation run in each browser; this does not verify provider credentials.
const { chromium, firefox, webkit } = require("playwright");
const { createHash, randomUUID } = require("node:crypto");
const assert = require("node:assert/strict");
const base = process.env.PREP_BASE_URL || "https://127.0.0.1:8444";
assert.equal(new URL(base).hostname, "127.0.0.1");
const project = "https://wofazcvfvazfkvujwwcw.supabase.co";
(async () => {
  for (const engine of (
    process.env.PREP_ENGINES || "chromium,webkit,firefox"
  ).split(",")) {
    const browser = await { chromium, firefox, webkit }[engine].launch();
    try {
      for (const provider of ["google", "apple"]) {
        const context = await browser.newContext({
          ignoreHTTPSErrors: true,
          viewport: { width: 390, height: 844 },
        });
        let mode = "success",
          enabled = true,
          tokenCalls = 0,
          authorizeCalls = 0;
        let lastRedirect, releaseToken;
        const attempts = new Map();
        const verified = {
          id: randomUUID(),
          email:
            provider === "apple"
              ? "synthetic@privaterelay.appleid.com"
              : "synthetic@example.test",
          email_confirmed_at: new Date().toISOString(),
          app_metadata: { provider },
          user_metadata: {
            full_name: "Synthetic User",
            avatar_url: "https://lh3.googleusercontent.com/a/synthetic-avatar",
          },
        };
        const token = [
          "e30",
          Buffer.from(
            JSON.stringify({
              sub: verified.id,
              exp: Math.floor(Date.now() / 1000) + 3600,
            }),
          ).toString("base64url"),
          "c2ln",
        ].join(".");
        let avatarRequests = 0;
        await context.route("https://lh3.googleusercontent.com/**", (route) => {
          avatarRequests++;
          assert.equal(route.request().headers().referer, undefined);
          return route.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#2156a0"/></svg>',
          });
        });
        await context.route(`${project}/**`, async (route) => {
          const url = new URL(route.request().url());
          const json = (value) => route.fulfill({ json: value });
          if (url.pathname.endsWith("/health"))
            return json({ accounts: true, cloudSave: true });
          if (url.pathname.endsWith("/settings"))
            return json({
              external: {
                google: enabled && provider === "google",
                apple: enabled && provider === "apple",
                email: true,
              },
            });
          if (url.pathname.endsWith("/authorize")) {
            authorizeCalls++;
            assert.equal(url.searchParams.get("provider"), provider);
            if (provider === "google")
              assert.equal(url.searchParams.get("prompt"), "select_account");
            assert.equal(url.searchParams.get("code_challenge_method"), "s256");
            const redirect = new URL(url.searchParams.get("redirect_to"));
            assert.equal(redirect.origin, base);
            assert.equal(redirect.pathname, "/auth-callback.html");
            lastRedirect = redirect.href;
            if (mode === "hold")
              return route.fulfill({
                contentType: "text/html",
                headers: { "Cross-Origin-Opener-Policy": "same-origin" },
                body: "<title>Synthetic provider</title><script>window.opener=null;</script>Waiting for test approval",
              });
            if (mode === "denied")
              redirect.searchParams.set("error", "access_denied");
            else {
              const code = randomUUID();
              attempts.set(code, url.searchParams.get("code_challenge"));
              redirect.searchParams.set("code", code);
            }
            return route.fulfill({
              contentType: "text/html",
              headers: { "Cross-Origin-Opener-Policy": "same-origin" },
              body:
                "<script>window.opener=null;location.replace(" +
                JSON.stringify(redirect.href) +
                ")</script>",
            });
          }
          if (url.pathname.endsWith("/token")) {
            tokenCalls++;
            assert.equal(url.searchParams.get("grant_type"), "pkce");
            const body = route.request().postDataJSON();
            assert.equal(
              createHash("sha256")
                .update(body.code_verifier)
                .digest("base64url"),
              attempts.get(body.auth_code),
            );
            attempts.delete(body.auth_code);
            if (mode === "delayed")
              await new Promise((resolve) => {
                releaseToken = resolve;
              });
            return json({
              access_token: token,
              refresh_token: "synthetic-refresh",
              provider_token: "synthetic-google-provider-token",
              expires_in: 3600,
              token_type: "bearer",
              user: verified,
            });
          }
          if (url.pathname.endsWith("/user")) return json(verified);
          if (url.pathname.endsWith("/list")) return json({ preparations: [] });
          if (url.pathname.endsWith("/draft"))
            return json({
              preparation: { revision: 0, state: "unpaid", package: "single" },
            });
          if (url.pathname.endsWith("/save"))
            return json({
              preparation: {
                revision: 1,
                state: "unpaid",
                package: "single",
                updated_at: new Date().toISOString(),
              },
            });
          if (url.pathname.endsWith("/logout"))
            return provider === "apple"
              ? route.fulfill({
                  status: 503,
                  json: { message: "Synthetic offline logout" },
                })
              : json({});
          throw new Error(`Unexpected auth request: ${url.pathname}`);
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(`${base}/prepare.html`);
        await page
          .getByRole("button", { name: "Sign in to your account", exact: true })
          .waitFor();
        await page.locator('[id="entrant.firstName"]').fill("UNSAVED");
        await page
          .getByRole("button", { name: "My preparations", exact: true })
          .click();
        const open = async () => {
          await page
            .getByRole("button", {
              name: /^(Sign in \/ open|Open) saved preparations$/,
            })
            .click();
          await page
            .getByRole("button", {
              name: `Continue with ${provider === "apple" ? "Apple" : "Google"}`,
            })
            .waitFor();
          assert.equal(
            await page.getByRole("textbox").count(),
            0,
            "No email/password registration",
          );
        };
        const begin = async () => {
          const popup = page.waitForEvent("popup");
          await page
            .getByRole("button", {
              name: `Continue with ${provider === "apple" ? "Apple" : "Google"}`,
            })
            .click();
          return popup;
        };
        await open();
        // Blocked popup is recoverable and does not navigate the worksheet.
        await page.evaluate(() => {
          window.originalOpen = window.open;
          window.open = () => null;
        });
        await page
          .getByRole("button", {
            name: `Continue with ${provider === "apple" ? "Apple" : "Google"}`,
          })
          .click();
        await page.getByText(/Allow a new sign-in tab/).waitFor();
        await page.evaluate(() => {
          window.open = window.originalOpen;
          delete window.originalOpen;
        });
        mode = "denied";
        await begin();
        await page.getByText(/Sign-in was not completed/).waitFor();
        assert.equal(tokenCalls, 0);
        // An unrelated attempt cannot trigger a token exchange.
        mode = "hold";
        const held = await begin();
        await held.waitForURL(`${project}/auth/v1/authorize**`);
        assert.equal(
          await held.evaluate(() => window.opener),
          null,
          "Provider cannot navigate original worksheet",
        );
        await page.evaluate(() => {
          const c = new BroadcastChannel(`gcas-auth-${crypto.randomUUID()}`);
          c.postMessage({
            type: "gcas-oauth",
            attempt: crypto.randomUUID(),
            code: "wrong",
          });
          c.close();
        });
        await page.getByRole("button", { name: "Close dialog" }).click();
        const stale = await context.newPage();
        await stale.clock.install();
        await stale.goto(lastRedirect + "&code=stale");
        assert.equal(
          await stale.evaluate(() => location.search + location.hash),
          "",
          "Callback removes sensitive URL",
        );
        assert.equal(tokenCalls, 0);
        // Mobile browsers may suspend the original worksheet while Google is
        // foreground. The callback must still answer when that tab resumes.
        await stale.clock.fastForward(20000);
        await stale
          .getByText(
            /Keep this sign-in tab open until your account appears there/,
          )
          .waitFor();
        await page.evaluate((attempt) => {
          const channel = new BroadcastChannel(`gcas-auth-${attempt}`);
          channel.onmessage = (event) => {
            window.callbackResumed = event.data.code === "stale";
            channel.close();
          };
          channel.postMessage({ type: "gcas-oauth-ready", attempt });
        }, new URL(lastRedirect).searchParams.get("attempt"));
        await page.waitForFunction(() => window.callbackResumed === true);
        assert.equal(
          tokenCalls,
          0,
          "Canceled attempt remains unable to exchange a code",
        );
        await stale.close();
        // Cancel during exchange must never sign the worksheet in afterwards.
        await open();
        mode = "delayed";
        await begin();
        for (let n = 0; !releaseToken && n < 200; n++)
          await new Promise((r) => setTimeout(r, 20));
        assert(releaseToken, "OAuth exchange reached the delayed fixture");
        await page.getByRole("button", { name: "Close dialog" }).click();
        releaseToken();
        await open();
        assert.equal(
          await page.evaluate(() => localStorage.length),
          0,
          "Canceled sign-in cannot persist credentials",
        );
        // Retry with a new verifier and receive through BroadcastChannel, no opener.
        mode = "success";
        await begin();
        await page
          .getByRole("heading", { name: "Saved preparations", exact: true })
          .waitFor();
        assert.equal(tokenCalls, 2);
        await page
          .locator("#main")
          .getByText(`Signed in as ${verified.email}`, { exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Back to my preparations" })
          .click();
        const profile = page.getByRole("button", {
          name: `Account: ${verified.email}`,
          exact: true,
        });
        await profile.waitFor();
        assert.equal(await profile.innerText(), "SU");
        assert.equal(avatarRequests, provider === "google" ? 1 : 0);
        assert.equal(
          await page
            .getByRole("button", {
              name: "Open saved preparations",
              exact: true,
            })
            .count(),
          1,
        );
        await page.screenshot({
          path: `/tmp/gcas-account-${provider}-${engine}.png`,
        });
        await page
          .getByRole("heading", { name: "UNSAVED", exact: true })
          .waitFor();
        const stored = await page.evaluate(() => ({ ...localStorage }));
        assert.deepEqual(Object.keys(stored).sort(), [
          "gcas.auth.activity.v1",
          "gcas.auth.v1",
        ]);
        assert(
          !JSON.stringify(stored).includes("UNSAVED"),
          "Worksheet is not stored with login",
        );
        assert(
          !JSON.stringify(stored).includes("synthetic-google-provider-token"),
          "Google provider tokens are not persisted",
        );
        assert.equal(await page.evaluate(() => sessionStorage.length), 0);
        assert.deepEqual(errors, []);
        if (provider === "google") {
          // Save goes directly to the account/payment state without a consent detour.
          await page
            .getByRole("button", { name: "Edit document", exact: true })
            .click();
          await page
            .getByRole("button", { name: "More preparation actions" })
            .click();
          await page
            .getByRole("button", { name: "Save Progress", exact: true })
            .click();
          await page
            .getByRole("heading", {
              name: "Progress saved",
              exact: true,
            })
            .waitFor();
          assert.equal(
            await page.locator('[id="preparation.consent"]').count(),
            0,
          );
          assert.equal(
            await page
              .getByText("Permission & personal information", { exact: true })
              .count(),
            0,
          );
          await page.getByRole("button", { name: "Close dialog" }).click();
          assert.equal(
            authorizeCalls,
            4,
            "Saving again does not repeat Google sign-in",
          );
        }
        // Leaving/discarding a worksheet must not discard the account session.
        page.on("dialog", (dialog) => dialog.accept());
        await page.goto(`${base}/`);
        await page.goto(`${base}/prepare.html`);
        await profile.waitFor();
        await page.reload();
        await profile.waitFor();
        await page.screenshot({
          path: `/tmp/gcas-session-restored-${provider}-${engine}.png`,
        });
        const secondTab = await context.newPage();
        await secondTab.goto(`${base}/prepare.html`);
        await secondTab
          .getByRole("button", {
            name: `Account: ${verified.email}`,
            exact: true,
          })
          .waitFor();
        assert.equal(
          authorizeCalls,
          4,
          "Returning and opening tabs requires no new OAuth",
        );
        await profile.click();
        await page
          .getByRole("button", { name: "Settings", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Sign out & clear this tab" })
          .click();
        await page
          .getByRole("button", {
            name: "Sign in to your account",
            exact: true,
          })
          .waitFor();
        await secondTab
          .getByRole("button", { name: "Sign in to your account", exact: true })
          .waitFor();
        assert.equal(
          await page.evaluate(() => localStorage.length),
          0,
          "Logout clears credentials and activity",
        );
        await secondTab.close();
        await page
          .getByRole("button", { name: "My preparations", exact: true })
          .click();
        await open();
        await page.screenshot({
          path: `/tmp/gcas-social-sign-in-${engine}.png`,
        });
        enabled = false;
        await page.reload();
        const unavailable = page.getByRole("button", {
          name: "Account sign-in unavailable",
        });
        await unavailable.waitFor();
        assert.equal(await unavailable.isEnabled(), false);
        assert.equal(authorizeCalls, 4);
        await context.close();
      }
      console.log(
        `PASS ${engine}: Google/Apple PKCE, openerless callback, canceled exchange, retry, popup blocking, errors, private storage, preserved draft, provider gates.`,
      );
    } finally {
      await browser.close();
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
