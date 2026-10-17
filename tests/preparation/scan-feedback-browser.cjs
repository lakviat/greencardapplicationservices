// Controlled OCR retries exercise the real parser, scan lifecycle and UI.
// Real OCR pixels remain covered by the UX and passport/session browser suites.
const { chromium, webkit, firefox } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.PREP_BASE_URL || "https://127.0.0.1:8444";
assert.equal(new URL(base).hostname, "127.0.0.1");
const printed =
  "SURNAME: EXAMPLE\nGIVEN NAMES: JANE ANNA\nPASSPORT NO. AB1234567\nISSUING COUNTRY: KGZ\nDATE OF BIRTH: 12 AUG 1974\nDATE OF EXPIRY: 15 APR 2030\nSEX: F";
(async () => {
  for (const engine of (
    process.env.PREP_ENGINES || "chromium,webkit,firefox"
  ).split(",")) {
    const browser = await { chromium, webkit, firefox }[engine].launch();
    try {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 390, height: 844 },
        reducedMotion: "no-preference",
      });
      await context.route("**/*", (route) =>
        new URL(route.request().url()).origin === base
          ? route.continue()
          : route.abort(),
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/prepare.html");
      await page
        .getByRole("button", { name: "Save time — Scan your passport" })
        .waitFor();
      await page.evaluate(() => {
        window.scanCalls = 0;
        window.workerTerminations = 0;
        window.Tesseract = {
          createWorker: async (_lang, _version, options) => ({
            setParameters: async () => {},
            recognize: () => {
              window.scanCalls++;
              // Tesseract's individual recognition passes each report 0 → 100.
              for (const progress of [0, 0.5, 1])
                options.logger({ status: "recognizing text", progress });
              return new Promise((resolve, reject) => {
                window.finishScanPass = (text) =>
                  resolve({ data: { text, blocks: [] } });
                window.failScanPass = () =>
                  reject(new Error("Synthetic OCR failure"));
              });
            },
            terminate: async () => {
              window.workerTerminations++;
            },
          }),
        };
      });
      const upload = async () => {
        await page
          .getByRole("button", { name: "Save time — Scan your passport" })
          .click();
        await page.locator("#scan-permission").check();
        await page.locator("#scan-upload").setInputFiles({
          name: "synthetic-td3.png",
          mimeType: "image/png",
          buffer: fs.readFileSync(
            path.join(__dirname, "fixtures/synthetic-td3.png"),
          ),
        });
      };
      await upload();
      const progress = page.getByRole("progressbar", {
        name: "Reading passport",
        exact: true,
      });
      await progress.waitFor();
      await page.waitForFunction(() => window.scanCalls === 1);
      assert.equal(
        await progress.getAttribute("aria-valuenow"),
        null,
        "Unknown total must not claim 100 percent",
      );
      assert.equal(
        await progress.evaluate((el) => el.getBoundingClientRect().height),
        3,
      );
      assert.match(
        await progress.evaluate(
          (el) => getComputedStyle(el, "::before").backgroundImage,
        ),
        /gradient/,
      );
      assert.notEqual(
        await progress.evaluate(
          (el) => getComputedStyle(el, "::before").animationName,
        ),
        "none",
      );
      await progress.evaluate((el) => {
        window.originalProgress = el;
      });
      assert.doesNotMatch(await page.getByRole("dialog").innerText(), /\d+%/);
      await page.evaluate(() =>
        window.finishScanPass("P<UTOEXAMPLF<<JANE<K<LLL<<<<<<<<"),
      );
      await page.waitForFunction(() => window.scanCalls === 2);
      assert.equal(
        await progress.evaluate((el) => el === window.originalProgress),
        true,
        "Retry retains one continuous indicator",
      );
      assert.doesNotMatch(await page.getByRole("dialog").innerText(), /\d+%/);
      await page.screenshot({
        path: `/tmp/gcas-v28-scan-progress-${engine}.png`,
      });
      await page.evaluate((text) => window.finishScanPass(text), printed);
      await page
        .getByRole("button", { name: "I reviewed and confirm these details" })
        .waitFor();
      assert.equal(await progress.count(), 0);
      for (const [key, value] of Object.entries({
        firstName: "JANE ANNA",
        lastName: "EXAMPLE",
        fullName: "JANE ANNA EXAMPLE",
        birthDate: "1974-08-12",
        sex: "Female",
      }))
        assert.equal(await page.locator(`#scan-${key}`).inputValue(), value);
      assert.equal(
        await page.locator('[id="entrant.lastName"]').inputValue(),
        "",
      );
      await page.locator("#scan-firstName").fill("JANE");
      await page.locator("#scan-middleName").fill("ANNA");
      assert.equal(
        await page.locator("#scan-fullName").inputValue(),
        "JANE ANNA EXAMPLE",
      );
      await page
        .getByRole("button", { name: "I reviewed and confirm these details" })
        .click();
      assert.equal(
        await page.locator('[id="entrant.firstName"]').inputValue(),
        "JANE",
      );
      assert.equal(
        await page.locator('[id="entrant.lastName"]').inputValue(),
        "EXAMPLE",
      );
      assert.equal(
        await page.locator('[id="passport.name"]').inputValue(),
        "JANE ANNA EXAMPLE",
      );

      await upload();
      await page.waitForFunction(() => window.scanCalls === 3);
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await page.waitForFunction(() => window.workerTerminations === 2);
      await page.evaluate((text) => window.finishScanPass(text), printed);
      assert.equal(
        await page.getByRole("dialog").count(),
        0,
        "Canceled scan cannot reopen review",
      );
      assert.equal(await progress.count(), 0);

      await page.emulateMedia({ reducedMotion: "reduce" });
      await upload();
      await page.waitForFunction(() => window.scanCalls === 4);
      assert.equal(
        await progress.evaluate(
          (el) => getComputedStyle(el, "::before").animationName,
        ),
        "none",
      );
      await page.evaluate(() => window.failScanPass());
      await page
        .getByRole("button", { name: "Enter Manually", exact: true })
        .waitFor();
      assert.equal(
        await progress.count(),
        0,
        "Failure stops the progress indicator",
      );
      await page
        .getByRole("button", { name: "Enter Manually", exact: true })
        .click();
      assert.equal(
        await page.locator('[id="entrant.firstName"]').inputValue(),
        "JANE",
      );
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `PASS ${engine}: continuous thin green scan indicator across retries, later printed name correction, review before apply, cancellation, failure and reduced motion.`,
      );
    } finally {
      await browser.close();
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
