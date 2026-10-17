/* All applicant data is synthetic. Network requests leave neither localhost nor
 * this test. There is deliberately no payment-success or cloud-save mock. */
const { chromium, webkit, firefox } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.PREP_BASE_URL || "https://127.0.0.1:8444";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const output = path.resolve(
  process.env.PREP_ARTIFACTS || "/tmp/gcas-rebuild/verification",
);
fs.mkdirSync(output, { recursive: true });
const selected = (process.env.PREP_ENGINES || "chromium,webkit,firefox").split(
  ",",
);
const engines = { chromium, webkit, firefox };
const input = (page, id) => page.locator(`[data-field="${id}"] [data-control]`);
async function action(page, name) {
  await page.evaluate(() => document.activeElement.blur());
  await page.locator(".workspace-bottom").waitFor({ state: "visible" });
  if (
    await page
      .getByRole("button", { name: "More preparation actions", exact: true })
      .isVisible()
  ) {
    await page
      .getByRole("button", { name: "More preparation actions", exact: true })
      .click();
    const match = {
      save: "Save Progress",
      review: "Review Document",
      missing: "Missing Fields",
    }[name];
    await page
      .getByRole("dialog")
      .getByRole("button", { name: match || "Change package", exact: true })
      .click();
  } else {
    const selector = {
      save: ".workspace-actions .primary",
      review: ".workspace-actions .button:not(.primary)",
      missing: ".remaining-button",
      package: ".package-indicator",
    }[name];
    await page.locator(selector).click();
  }
}
const noOverflow = async (page) =>
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "No horizontal overflow",
  );
const rejectCookies = async (page) => {
  const b = page.getByRole("button", {
    name: "Reject nonessential",
    exact: true,
  });
  if (await b.isVisible()) await b.click();
};
async function screenshot(page, name) {
  await page.screenshot({
    path: path.join(output, name + ".png"),
    fullPage: false,
  });
}
(async () => {
  for (const name of selected) {
    const browser = await engines[name].launch();
    const errors = [];
    let outbound = 0;
    for (const width of [320, 390, 430, 1440]) {
      const height = width === 1440 ? 1000 : 844;
      const context = await browser.newContext({
        viewport: { width, height },
        ignoreHTTPSErrors: true,
        reducedMotion: "reduce",
      });
      await context.route("**/*", (route) => {
        if (new URL(route.request().url()).origin === base)
          return route.continue();
        if (
          route.request().url() ===
          "https://wofazcvfvazfkvujwwcw.supabase.co/functions/v1/gcas-api/health"
        )
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              accounts: false,
              cloudSave: false,
              checkout: false,
              pdfDownload: false,
              emailDelivery: false,
              premium: false,
            }),
          });
        outbound++;
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/prepare.html");
      await input(page, "entrant.lastName").waitFor();
      await noOverflow(page);
      assert.equal(
        await page.evaluate(
          () =>
            performance
              .getEntriesByType("resource")
              .filter((r) => r.name.includes("/vendor/passport-ocr/")).length,
        ),
        0,
        "OCR assets load only when requested",
      );
      assert.equal(
        await page.locator("[data-progress-label]").innerText(),
        "0%",
      );
      assert.match(
        await page.locator(".package-indicator").innerText(),
        /Single.*9.99/,
      );
      assert.equal(await page.evaluate(() => localStorage.length), 0);
      assert.equal(await page.evaluate(() => sessionStorage.length), 0);
      if (name === "chromium" && [390, 1440].includes(width))
        await screenshot(page, "editor-" + width);
      await input(page, "entrant.lastName").fill("EXAMPLE");
      await page.locator(".workspace-bottom").waitFor({ state: "hidden" });
      await page.evaluate(() => document.activeElement.blur());
      await page
        .getByRole("button", { name: "Next required field", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "entrant.firstName",
      );
      await input(page, "entrant.firstName").fill("JANE");
      await action(page, "missing");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /City where you were born/ })
        .click();
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "entrant.birthCity",
      );
      await input(page, "entrant.birthCity").fill("Tokyo");
      await page.locator('[id="entrant.marital-married"]').check();
      assert.equal(await input(page, "spouse.firstName").count(), 1);
      await input(page, "spouse.firstName").fill("ALEX");
      await page.getByRole("button", { name: "+ Add a child" }).click();
      const child = page.locator(
        '[data-field^="child."][data-field$=".firstName"] [data-control]',
      );
      await child.fill("SAM");
      await action(page, "package");
      await page
        .getByRole("button", { name: "Select Family", exact: true })
        .click();
      await page
        .getByRole("button", { name: "My preparations", exact: true })
        .click();
      assert.match(
        await page.locator(".household-index").innerText(),
        /1 required children listed/,
      );
      assert.match(
        await page.locator(".household-index").innerText(),
        /Not uploaded/,
      );
      await page
        .getByRole("button", { name: "Edit document", exact: true })
        .click();
      await action(page, "package");
      await page
        .getByRole("button", { name: "Select Single", exact: true })
        .click();
      assert.equal(await child.inputValue(), "SAM");
      assert.equal(await input(page, "spouse.firstName").inputValue(), "ALEX");
      await action(page, "save");
      await page
        .getByRole("heading", { name: "Account setup in progress" })
        .waitFor();
      await page.getByRole("button", { name: "Close dialog" }).click();
      await action(page, "review");
      assert.match(
        await page.locator("h1").innerText(),
        /check your worksheet/,
      );
      assert(
        !(await page
          .getByText("Your preparation worksheet is ready.", { exact: true })
          .count()),
      );
      await page
        .getByRole("button", {
          name: "Edit 1–5. Name, sex & birth information",
          exact: true,
        })
        .click();
      assert.equal(
        await input(page, "entrant.lastName").inputValue(),
        "EXAMPLE",
      );
      await page
        .getByRole("button", { name: "My preparations", exact: true })
        .click();
      assert(
        await page
          .getByRole("button", { name: "Download PDF", exact: true })
          .isDisabled(),
      );
      await page.getByRole("button", { name: "Edit document" }).click();
      if (width === 390) {
        await page
          .getByLabel(
            "I also want to prepare a separate entry for an independently eligible spouse.",
          )
          .check();
        await page
          .getByRole("button", {
            name: "Prepare spouse’s separate worksheet",
            exact: true,
          })
          .click();
        assert(
          await page
            .getByRole("button", {
              name: "Create separate worksheet",
              exact: true,
            })
            .isDisabled(),
        );
        await page.locator("#spouse-permission").check();
        await page.locator("#spouse-reuse").check();
        await page
          .getByRole("button", {
            name: "Create separate worksheet",
            exact: true,
          })
          .click();
        assert.equal(
          await input(page, "entrant.firstName").inputValue(),
          "ALEX",
        );
        assert.equal(
          await input(page, "spouse.firstName").inputValue(),
          "JANE",
        );
        assert.equal(await child.inputValue(), "SAM");
        assert.equal(await input(page, "contact.email").inputValue(), "");
        assert.match(
          await page.locator(".package-indicator").innerText(),
          /Single/,
        );
        await page
          .getByRole("button", { name: "My preparations", exact: true })
          .click();
        assert.equal(await page.locator(".dashboard-card").count(), 2);
        await page
          .locator(".dashboard-card")
          .nth(1)
          .getByRole("button", { name: "Delete this draft" })
          .click();
        await page
          .getByRole("button", { name: "Keep draft", exact: true })
          .click();
        assert.equal(await page.locator(".dashboard-card").count(), 2);
        await page
          .locator(".dashboard-card")
          .nth(1)
          .getByRole("button", { name: "Delete this draft" })
          .click();
        await page
          .getByRole("button", { name: "Delete draft", exact: true })
          .click();
        assert.equal(await page.locator(".dashboard-card").count(), 1);
        await page
          .getByRole("button", { name: "Edit document", exact: true })
          .click();
        assert.equal(
          await input(page, "entrant.firstName").inputValue(),
          "JANE",
        );
      }
      await noOverflow(page);
      await context.close();
    }
    // Image pipeline, screenshot and export layout on a representative phone.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      ignoreHTTPSErrors: true,
      reducedMotion: "reduce",
    });
    await context.route("**/*", (r) =>
      new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/prepare.html");
    const data = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1000;
      c.height = 1000;
      const x = c.getContext("2d");
      x.fillStyle = "#f6eee2";
      x.fillRect(0, 0, 1000, 1000);
      x.fillStyle = "#b8c8d6";
      x.beginPath();
      x.ellipse(500, 390, 165, 220, 0, 0, Math.PI * 2);
      x.fill();
      x.fillRect(300, 650, 400, 350);
      x.fillStyle = "#18364d";
      x.font = "22px sans-serif";
      x.fillText("SYNTHETIC IMAGE — NOT A PERSON", 300, 950);
      return c.toDataURL("image/jpeg").split(",")[1];
    });
    const file = {
      name: "synthetic.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(data, "base64"),
    };
    await page.locator('[id="file-entrant.photo"]').setInputFiles(file);
    await page
      .getByRole("button", { name: "Use this photo", exact: true })
      .click();
    await page
      .locator('[data-field="entrant.photo"] .document-photo')
      .waitFor();
    assert.match(
      await page
        .locator('[data-field="entrant.photo"] .media-status')
        .innerText(),
      /Technical checks passed/,
    );
    const confirm = page.locator(
      '[data-field="entrant.photo"] .photo-confirm input',
    );
    assert(!(await confirm.isChecked()));
    await confirm.check();
    await input(page, "passport.path").selectOption("passport");
    await page.locator('[id="file-passport.bio"]').setInputFiles(file);
    await page.locator('[data-field="passport.bio"] img').waitFor();
    await input(page, "passport.samePage").check();
    assert.equal(await input(page, "passport.signature").count(), 0);
    await page.locator('[id="file-passport.bio"]').setInputFiles({
      name: "fake.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("not an image"),
    });
    await page
      .locator('[data-field="passport.bio"] .media-status.error')
      .waitFor();
    assert.equal(
      await page.locator('[data-field="passport.bio"] img').count(),
      1,
      "failed replacement preserves original",
    );
    // Run the actual local OCR worker against a synthetic MRZ image, not a stub.
    const scan = await page.evaluate(async () => {
      const { scanPassport } = await import("/assets/preparation/media.mjs");
      const c = document.createElement("canvas");
      c.width = 1800;
      c.height = 600;
      const x = c.getContext("2d");
      x.fillStyle = "white";
      x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = "black";
      x.font = "56px monospace";
      x.fillText("SYNTHETIC TEST DOCUMENT", 70, 130);
      x.font = "50px monospace";
      x.fillText("P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<", 50, 430);
      x.fillText("L898902C36UTO7408122F1204159ZE184226B<<<<<10", 50, 510);
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95));
      const result = await scanPassport(
        blob,
        [],
        () => {},
        new AbortController().signal,
      );
      const aborted = new AbortController();
      aborted.abort();
      let cancelled = false;
      try {
        await scanPassport(blob, [], () => {}, aborted.signal);
      } catch (e) {
        cancelled = /cancelled/i.test(e.message);
      }
      return { result, cancelled };
    });
    assert.match(scan.result.lastName, /ERIKSSON/);
    assert.match(scan.result.firstName, /ANNA/);
    assert(
      !scan.result.country,
      "Issuing country is never copied to birth country",
    );
    assert(scan.cancelled);
    await input(page, "entrant.lastName").fill("EXAMPLE");
    await input(page, "entrant.firstName").fill("JANE");
    await action(page, "review");
    if (name === "chromium") await screenshot(page, "review-mobile");
    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      a11y.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
      name + " review accessibility",
    );
    await page
      .getByRole("button", { name: "Preview prepared worksheet" })
      .click();
    assert.match(
      await page.locator(".worksheet-output").innerText(),
      /EXAMPLE/,
    );
    assert.match(await page.locator(".worksheet-output").innerText(), /JANE/);
    assert.match(
      await page.locator(".worksheet-output").innerText(),
      /Unofficial/,
    );
    if (name === "chromium") {
      await page.pdf({
        path: path.join(output, "synthetic-worksheet.pdf"),
        format: "A4",
        printBackground: true,
      });
      await screenshot(page, "pdf-preview-mobile");
    }
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    assert.equal(await page.evaluate(() => sessionStorage.length), 0);
    await context.close();
    // Public pages remain readable and start links never lead to legacy payment links.
    const publicContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      ignoreHTTPSErrors: true,
    });
    await publicContext.route("**/*", (r) =>
      new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
    );
    const publicPage = await publicContext.newPage();
    publicPage.on("pageerror", (e) => errors.push(e.message));
    for (const file of [
      ...fs
        .readdirSync(".")
        .filter((f) => f.endsWith(".html") && f !== "prepare.html"),
      "policies/index.html",
    ]) {
      await publicPage.goto(base + "/" + file);
      await rejectCookies(publicPage);
      await noOverflow(publicPage);
      assert.equal(
        await publicPage.locator('a[href*="buy.stripe.com"]').count(),
        0,
      );
      assert.equal(await publicPage.locator("#intakeForm").count(), 0);
    }
    await publicPage.goto(base + "/");
    if (name === "chromium") {
      await screenshot(publicPage, "homepage-390");
      await publicPage.setViewportSize({ width: 1440, height: 1000 });
      await screenshot(publicPage, "homepage-1440");
      await publicPage.setViewportSize({ width: 390, height: 844 });
    }
    await publicPage
      .getByRole("button", { name: "Cookie Preferences", exact: true })
      .click();
    assert(await publicPage.locator('input[name="analytics"]').isVisible());
    assert(!(await publicPage.locator('input[name="analytics"]').isChecked()));
    await publicPage.keyboard.press("Escape");
    await publicPage
      .getByRole("button", { name: "Open support", exact: true })
      .click();
    assert(
      await publicPage.getByRole("link", { name: /Email support/ }).isVisible(),
    );
    await publicPage.keyboard.press("Escape");
    await publicPage.locator("[data-notify-open]").first().click();
    assert(
      !(await publicPage
        .locator('[name="notifyMarketingConsent"]')
        .isChecked()),
    );
    await publicPage
      .locator('[name="notifyEmail"]')
      .fill("synthetic@example.test");
    await publicPage.locator('[name="notificationConsent"]').check();
    await publicPage.locator("#notifySubmit").click();
    await publicPage.locator("#notifyMessage.is-error").waitFor();
    await publicPage.keyboard.press("Escape");
    const homeA11y = await new AxeBuilder({ page: publicPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      homeA11y.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
      name + " homepage accessibility",
    );
    await publicPage
      .getByRole("link", { name: "Start Free Preparation →", exact: true })
      .first()
      .click();
    await input(publicPage, "entrant.lastName").waitFor();
    const editorA11y = await new AxeBuilder({ page: publicPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      editorA11y.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
      name + " editor accessibility",
    );
    await publicContext.close();
    await browser.close();
    assert.deepEqual(errors, [], "No browser errors");
    assert.equal(
      outbound,
      0,
      "Workspace never loads external tracking or transmits data",
    );
    console.log(
      `${name}: 4 viewports, document/family/package/review journeys, image validation, accessible editor/review, and 18 public pages passed`,
    );
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
