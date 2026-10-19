// Synthetic OAuth, real browser SDK + local OCR. No real passport or upload.
const { chromium, webkit, firefox } = require("playwright");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const base = process.env.PREP_BASE_URL || "https://127.0.0.1:8444";
assert.equal(new URL(base).hostname, "127.0.0.1");
const project = "https://wofazcvfvazfkvujwwcw.supabase.co";
const publicPages = fs
  .readdirSync(".")
  .filter(
    (f) =>
      f.endsWith(".html") &&
      /class="site-header"|data-account-header/.test(
        fs.readFileSync(f, "utf8"),
      ),
  )
  .concat("policies/index.html");
(async () => {
  for (const engine of (
    process.env.PREP_ENGINES || "chromium,webkit,firefox"
  ).split(",")) {
    const browser = await { chromium, webkit, firefox }[engine].launch();
    try {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
      const user = {
        id: randomUUID(),
        email: "scan-session@example.test",
        email_confirmed_at: new Date().toISOString(),
        app_metadata: { provider: "google" },
        user_metadata: { full_name: "Session Test" },
      };
      const token = `e30.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.c2ln`;
      let authorizations = 0,
        uploads = 0;
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === base) return route.continue();
        if (url.origin !== project) return route.abort();
        const json = (value) => route.fulfill({ json: value });
        if (url.pathname.endsWith("/health"))
          return json({ accounts: true, cloudSave: true });
        if (url.pathname.endsWith("/settings"))
          return json({ external: { google: true } });
        if (url.pathname.endsWith("/authorize")) {
          authorizations++;
          assert.equal(url.searchParams.get("prompt"), "select_account");
          const callback = new URL(url.searchParams.get("redirect_to"));
          callback.searchParams.set("code", randomUUID());
          return route.fulfill({
            contentType: "text/html",
            headers: { "Cross-Origin-Opener-Policy": "same-origin" },
            body:
              "<script>window.opener=null;location.replace(" +
              JSON.stringify(callback.href) +
              ")</script>",
          });
        }
        if (url.pathname.endsWith("/token"))
          return json({
            access_token: token,
            refresh_token: "synthetic-refresh",
            expires_in: 3600,
            token_type: "bearer",
            user,
          });
        if (url.pathname.endsWith("/user")) return json(user);
        if (url.pathname.endsWith("/list")) return json({ preparations: [] });
        if (url.pathname.endsWith("/logout")) return json({});
        uploads++;
        throw new Error(`Unexpected request ${url.pathname}`);
      });
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (dialog) => dialog.accept());
      const account = () =>
        page.getByRole("button", {
          name: `Account: ${user.email}`,
          exact: true,
        });
      await page.goto(base + "/");
      await page
        .getByRole("button", { name: "Sign in to your account", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Continue with Google", exact: true })
        .click();
      await page.waitForURL(base + "/");
      await account().click();
      await page
        .getByRole("heading", { name: "My DV Lottery Entry", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Start preparation", exact: true })
        .click();

      const image = await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 1800;
        c.height = 1100;
        const x = c.getContext("2d");
        x.fillStyle = "#fff";
        x.fillRect(0, 0, c.width, c.height);
        x.fillStyle = "#111";
        x.font = "bold 38px Arial";
        x.fillText("SYNTHETIC OCR TEST - NOT A VALID DOCUMENT", 70, 75);
        x.font = "34px Arial";
        [
          "SURNAME: EXAMPLE",
          "GIVEN NAMES: JANE ANNA",
          "PASSPORT NO. AB1234567",
          "ISSUING COUNTRY: KGZ",
          "DATE OF BIRTH: 12 AUG 1974",
          "DATE OF EXPIRY: 15 APR 2030",
          "SEX: F",
          "PLACE OF BIRTH: ALMATY, KAZAKHSTAN",
          "NATIONALITY: KYRGYZSTAN",
        ].forEach((line, i) => x.fillText(line, 100, 180 + i * 90));
        return c.toDataURL("image/png").split(",")[1];
      });
      for (let round = 0; round < 2; round++) {
        await account().waitFor();
        await page
          .getByRole("button", { name: "Save time — Scan your passport" })
          .click();
        await page.locator("#scan-permission").check();
        await page.locator("#scan-upload").setInputFiles({
          name: "synthetic-printed-passport.png",
          mimeType: "image/png",
          buffer: Buffer.from(image, "base64"),
        });
        await page
          .getByRole("button", { name: "I reviewed and confirm these details" })
          .waitFor({ timeout: 90000 });
        for (const [key, value] of Object.entries({
          lastName: "EXAMPLE",
          firstName: "JANE ANNA",
          number: "AB1234567",
          issuer: "Kyrgyzstan",
          birthDate: "1974-08-12",
          expiry: "2030-04-15",
          sex: "Female",
          country: "Kazakhstan",
          birthCity: "ALMATY",
        }))
          assert.equal(
            await page.locator(`#scan-${key}`).inputValue(),
            value,
            `${engine} real OCR ${key}`,
          );
        assert.equal(
          await page.locator('[id="entrant.lastName"]').inputValue(),
          "",
          "Nothing applies before review",
        );
        await page.screenshot({
          path: `/tmp/gcas-v27-scan-review-${engine}.png`,
        });
        await page
          .getByRole("button", { name: "I reviewed and confirm these details" })
          .click();
        await account().waitFor();
        assert.equal(
          await page.locator('[id="passport.number"]').inputValue(),
          "AB1234567",
        );
        assert.equal(
          await page.locator('[id="entrant.birthCity"]').inputValue(),
          "ALMATY",
        );
        assert.equal(
          await page.locator('[id="eligibility.country"]').inputValue(),
          "",
        );
        assert.equal(
          await page.evaluate(() =>
            JSON.stringify(localStorage).includes("AB1234567"),
          ),
          false,
        );
        await page
          .getByRole("link", {
            name: "Green Card Application Services home",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Leave and discard", exact: true })
          .click();
        await page.waitForURL(base + "/");
        await account().waitFor();
        await page.goBack();
        await account().waitFor();
        await page.goForward();
        await account().waitFor();
        await page.reload();
        await account().waitFor();
        await page.goto(base + "/prepare.html");
        await account().waitFor();
      }
      // Exercise image processing with actual OCR, not pre-parsed text fixtures.
      for (const variant of ["rotated-90", "rotated-180", "low-contrast"]) {
        const values = await page.evaluate(
          async ({ image, variant }) => {
            const im = new Image();
            im.src = "data:image/png;base64," + image;
            await im.decode();
            const angle =
              variant === "rotated-90"
                ? 90
                : variant === "rotated-180"
                  ? 180
                  : 0;
            const c = document.createElement("canvas");
            c.width = angle === 90 ? im.height : im.width;
            c.height = angle === 90 ? im.width : im.height;
            const x = c.getContext("2d");
            x.translate(c.width / 2, c.height / 2);
            x.rotate((angle * Math.PI) / 180);
            x.drawImage(im, -im.width / 2, -im.height / 2);
            if (variant === "low-contrast") {
              x.resetTransform();
              x.fillStyle = "rgba(255,255,255,0.65)";
              x.fillRect(0, 0, c.width, c.height);
            }
            const blob = await new Promise((resolve) =>
              c.toBlob(resolve, "image/png"),
            );
            const { scanPassport } =
              await import("/assets/preparation/media.mjs?v=20261019-workspace-v38");
            const { COUNTRIES } =
              await import("/assets/preparation/countries.mjs?v=20261019-workspace-v38");
            return scanPassport(
              blob,
              COUNTRIES.map((c) => c.name),
              () => {},
            );
          },
          { image, variant },
        );
        for (const [key, value] of Object.entries({
          number: "AB1234567",
          issuer: "Kyrgyzstan",
          birthDate: "1974-08-12",
          expiry: "2030-04-15",
          country: "Kazakhstan",
        }))
          assert.equal(values[key], value, `${engine} ${variant} OCR ${key}`);
        await account().waitFor();
      }
      for (const path of publicPages) {
        await page.goto(base + "/" + path);
        await account().waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          `Public header fits ${path}`,
        );
      }
      await page.screenshot({
        path: `/tmp/gcas-v27-public-account-${engine}.png`,
      });
      await account().click();
      await page
        .getByRole("heading", { name: "My DV Lottery Entry", exact: true })
        .waitFor();
      assert.equal(
        authorizations,
        1,
        "All pages and back/forward use the original Google login",
      );
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page
        .getByRole("button", { name: "Sign out & clear this tab" })
        .click();
      await page.goto(base + "/");
      await page
        .getByRole("button", { name: "Sign in to your account", exact: true })
        .waitFor();
      assert.equal(uploads, 0);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `PASS ${engine}: Google → real printed-passport OCR → confirm → exit/discard → back/forward/reload twice; signed-in account on all ${publicPages.length} public pages; logout and no document uploads.`,
      );
    } finally {
      await browser.close();
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
