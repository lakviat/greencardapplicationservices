// Synthetic local-only browser checks. Keyboard geometry is simulated; physical
// Safari/Chrome keyboard and native camera handoffs remain device QA.
const { chromium, webkit, firefox } = require("playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const AxeBuilder = require("@axe-core/playwright").default;
const base = process.env.PREP_BASE_URL || "https://127.0.0.1:8444";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const output = process.env.PREP_ARTIFACTS || "/tmp/gcas-ux-v21/screenshots";
fs.mkdirSync(output, { recursive: true });
const engines = { chromium, webkit, firefox };
(async () => {
  for (const name of (
    process.env.PREP_ENGINES || "chromium,webkit,firefox"
  ).split(",")) {
    const browser = await engines[name].launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      ignoreHTTPSErrors: true,
      reducedMotion: "reduce",
    });
    let leaks = 0;
    await context.route("**/*", (r) => {
      if (new URL(r.request().url()).origin === base) return r.continue();
      if (r.request().url().endsWith("/health"))
        return r.fulfill({ contentType: "application/json", body: "{}" });
      leaks++;
      return r.abort();
    });
    const page = await context.newPage();
    let errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/prepare.html");
    const input = (id) => page.locator(`[id="${id}"]`);
    const more = () =>
      page.getByRole("button", { name: "More preparation actions" }).click();
    assert(
      (await page.locator(".workspace-bottom").boundingBox()).height <= 72,
    );
    assert((await input("entrant.lastName").boundingBox()).y < 470);
    assert.equal(
      await page.evaluate(() => document.activeElement.tagName),
      "BODY",
    );
    assert(
      await page
        .locator(".workspace-home img")
        .evaluate((i) => i.complete && i.naturalWidth >= 256),
    );
    assert.equal(await input("eligibility.basis").inputValue(), "");
    await input("entrant.lastName").fill("EXAMPLE");
    await page.getByRole("button", { name: "Next required field" }).click();
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "entrant.firstName",
    );
    const before = await page.evaluate(() => scrollY);
    await input("entrant.firstName").pressSequentially("JANE", { delay: 50 });
    assert.equal(await page.evaluate(() => scrollY), before);
    assert.equal(await page.locator(".document-field.is-active").count(), 1);
    await page
      .getByRole("button", {
        name: "Help: City where you were born",
        exact: true,
      })
      .click();
    assert(await page.getByRole("dialog").isVisible());
    await page.getByRole("button", { name: "Close dialog" }).click();
    await input("entrant.birthCountry").fill("Kyrg");
    await input("entrant.birthCountry").press("ArrowDown");
    await input("entrant.birthCountry").press("Enter");
    assert.equal(
      await input("entrant.birthCountry").inputValue(),
      "Kyrgyzstan",
    );
    assert.equal(await input("eligibility.basis").inputValue(), "");
    await input("entrant.birthDate-day").fill("29");
    await input("entrant.birthDate-month").selectOption("02");
    await input("entrant.birthDate-year").fill("2000");
    await input("entrant.birthCity").focus();
    assert.equal(
      await page.locator('[id="error-entrant.birthDate"]').innerText(),
      "",
    );
    await more();
    assert.equal(
      await page.getByRole("dialog").locator(".actions-list button").count(),
      6,
    );
    assert.equal(await page.locator(".workspace-bottom").isVisible(), false);
    await page.screenshot({ path: path.join(output, `actions-${name}.png`) });
    await page
      .getByRole("button", { name: "Missing Fields", exact: true })
      .click();
    assert(await page.getByRole("dialog").getByRole("heading").isVisible());
    await page.getByRole("button", { name: "Close dialog" }).click();
    // Consent precedes selection; no fields or attached copies change before review.
    await page
      .getByRole("button", { name: "Save time — Scan your passport" })
      .click();
    assert(
      await page
        .getByRole("button", { name: "Upload Passport", exact: true })
        .isDisabled(),
    );
    assert.equal(
      await input("scan-camera").getAttribute("capture"),
      "environment",
    );
    await input("scan-permission").check();
    // Keep the OCR pixels identical across OS font rasterizers. This fixture
    // contains only fictional names/data and still goes through real OCR.
    const data = fs.readFileSync(
      path.join(__dirname, "fixtures/synthetic-td3.png"),
    );
    await input("scan-upload").setInputFiles({
      name: "synthetic-passport.png",
      mimeType: "image/png",
      buffer: data,
    });
    await page
      .getByRole("button", { name: "I reviewed and confirm these details" })
      .waitFor({ timeout: 60000 });
    assert.equal(await input("entrant.lastName").inputValue(), "EXAMPLE");
    assert.equal(await input("passport.path").inputValue(), "");
    assert.equal(await page.locator('[data-field="passport.bio"]').count(), 0);
    assert.match(await input("scan-lastName").inputValue(), /ERIKSSON/);
    // Browser image decoding/JPEG conversion can affect OCR. Never accept an
    // incorrect suggestion: a checked exact value or an explicit blank fallback.
    for (const [key, expected] of [
      ["number", "L898902C3"],
      ["birthDate", "1974-08-12"],
    ]) {
      const value = await input(`scan-${key}`).inputValue();
      assert(
        value === expected || value === "",
        `OCR must not insert an incorrect ${key}`,
      );
      if (!value) {
        assert(
          await input(`scan-${key}`)
            .locator("..")
            .locator("small")
            .innerText()
            .then((t) => t.includes("Not read reliably")),
        );
        assert.match(
          await page.getByRole("dialog").innerText(),
          /Low confidence|checksums failed|ambiguous/,
        );
      }
    }
    assert.equal(await input("scan-country").inputValue(), "");
    await input("scan-firstName").fill("ANNA");
    await input("scan-middleName").fill("MARIA");
    await input("scan-expiry").fill("2030-04-15");
    await page.getByRole("dialog").evaluate((d) => {
      d.scrollTop = 0;
    });
    await page.screenshot({
      path: path.join(output, `passport-review-${name}.png`),
    });
    await page
      .getByRole("button", { name: "I reviewed and confirm these details" })
      .click();
    assert.equal(await input("entrant.lastName").inputValue(), "ERIKSSON");
    assert.equal(await input("entrant.firstName").inputValue(), "ANNA");
    assert.equal(await input("entrant.middleName").inputValue(), "MARIA");
    assert.equal(
      await input("entrant.birthCountry").inputValue(),
      "Kyrgyzstan",
    );
    assert.equal(await input("eligibility.basis").inputValue(), "");
    assert.equal(await input("eligibility.country").inputValue(), "");
    assert.equal(
      await page.locator('[data-field="passport.bio"] img').count(),
      1,
    );
    await page
      .locator('[data-field="passport.bio"]')
      .getByRole("button", { name: "Remove image" })
      .click();
    assert.equal(
      await page.locator('[data-field="passport.bio"] img').count(),
      0,
    );
    const ax = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      ax.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
    );
    // Simulated visual viewport events exercise the same resize handler used on devices.
    await page.evaluate(() => {
      const vv = new EventTarget();
      Object.assign(vv, { height: 844, offsetTop: 0, scale: 1 });
      Object.defineProperty(window, "visualViewport", {
        value: vv,
        configurable: true,
      });
    });
    // A separate page installs geometry before the module attaches listeners.
    const keyboard = await context.newPage();
    await keyboard.addInitScript(() => {
      const vv = new EventTarget();
      Object.assign(vv, { height: 844, offsetTop: 0, scale: 1 });
      Object.defineProperty(window, "visualViewport", {
        value: vv,
        configurable: true,
      });
    });
    await keyboard.goto(base + "/prepare.html");
    await keyboard.locator('[id="contact.email"]').focus();
    await keyboard.evaluate(() => {
      Object.assign(visualViewport, { height: 390, offsetTop: 30 });
      visualViewport.dispatchEvent(new Event("resize"));
    });
    await keyboard.waitForFunction(() =>
      document.body.classList.contains("keyboard-open"),
    );
    await keyboard.waitForTimeout(350);
    const geometry = await keyboard.evaluate(() => ({
      field: document.activeElement.getBoundingClientRect().toJSON(),
      bar: document
        .querySelector(".workspace-bottom")
        .getBoundingClientRect()
        .toJSON(),
      bottom: getComputedStyle(document.documentElement).getPropertyValue(
        "--viewport-bottom",
      ),
    }));
    assert.equal(geometry.bottom, "424px");
    assert(
      geometry.field.bottom <= geometry.bar.top + 1,
      "Keyboard bar keeps focused input visible",
    );
    await keyboard.screenshot({
      path: path.join(output, `keyboard-simulation-${name}.png`),
    });
    await keyboard.close();
    const small = await context.newPage();
    await small.setViewportSize({ width: 320, height: 568 });
    await small.goto(base + "/prepare.html");
    await small.getByRole("button", { name: "Enlarge document text" }).click();
    await small.evaluate(() => {
      document.documentElement.style.fontSize = "32px";
    });
    assert(
      await small.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "200% text reflows on a small screen",
    );
    await small.locator('[id="entrant.firstName"]').focus();
    await small.waitForTimeout(200);
    const visible = await small.evaluate(() => ({
      field: document.activeElement.getBoundingClientRect().toJSON(),
      bar: document
        .querySelector(".workspace-bottom")
        .getBoundingClientRect()
        .toJSON(),
    }));
    assert(
      visible.field.bottom <= visible.bar.top + 1,
      "Enlarged input remains above the toolbar",
    );
    await small
      .getByRole("button", { name: "More preparation actions" })
      .click();
    assert(
      await small
        .getByRole("dialog")
        .getByRole("button", { name: "Exit Preparation", exact: true })
        .isVisible(),
    );
    await small.screenshot({
      path: path.join(output, `small-large-text-${name}.png`),
    });
    await small.close();
    assert.equal(leaks, 0);
    assert.deepEqual(errors, []);
    assert.equal(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
      0,
    );
    await context.close();
    await browser.close();
    console.log(
      `${name}: compact toolbar, focus, country keyboard search, dates, passport consent/review, privacy and simulated keyboard passed`,
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
