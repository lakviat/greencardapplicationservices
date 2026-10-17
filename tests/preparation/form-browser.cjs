// Touch regressions and a complete fictional household through the public UI.
// No applicant data, account creation, payment or uploads leave localhost.
const { chromium, webkit, firefox } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const AxeBuilder = require("@axe-core/playwright").default;
const base = process.env.PREP_BASE_URL || "https://127.0.0.1:8444";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const output = process.env.PREP_ARTIFACTS || "/tmp/gcas-form-fixes";
fs.mkdirSync(output, { recursive: true });

(async () => {
  for (const name of (
    process.env.PREP_ENGINES || "chromium,webkit,firefox"
  ).split(",")) {
    const browser = await { chromium, webkit, firefox }[name].launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        ...(name !== "firefox" ? { isMobile: true } : {}),
        ignoreHTTPSErrors: true,
        reducedMotion: "reduce",
      });
      let outbound = 0;
      await context.route("**/*", (r) => {
        if (new URL(r.request().url()).origin === base) return r.continue();
        if (r.request().url().endsWith("/health"))
          return r.fulfill({ contentType: "application/json", body: "{}" });
        outbound++;
        return r.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/prepare.html");
      const input = (id) => page.locator(`[id="${id}"]`);
      const field = (id) => page.locator(`[data-field="${id}"]`);
      const more = async () => {
        await page.evaluate(() => document.activeElement.blur());
        await page
          .getByRole("button", { name: "More preparation actions" })
          .tap();
      };
      const close = () =>
        page.getByRole("button", { name: "Close dialog" }).tap();
      async function country(id, query, expected) {
        await input(id).fill(query);
        await page.getByRole("option", { name: expected, exact: true }).tap();
        assert.equal(
          await input(id).inputValue(),
          expected,
          `${name}: touch selection of ${id}`,
        );
        assert.equal(await input(id).getAttribute("aria-expanded"), "false");
        await input("entrant.lastName").focus();
        assert.equal(await input(`error-${id}`).innerText(), "");
      }
      async function date(id, value) {
        const [year, month, day] = value.split("-");
        await input(`${id}-day`).fill(day);
        await input(`${id}-month`).selectOption(month);
        await input(`${id}-year`).fill(year);
      }
      // These exact taps failed on mobile WebKit before the pointerdown fix.
      await country("entrant.birthCountry", "Kyr", "Kyrgyzstan");
      await country("address.country", "United", "United States");
      await country("contact.country", "United", "United States");
      await input("eligibility.basis").selectOption("birth");
      await country("eligibility.country", "Kyr", "Kyrgyzstan");
      // Invalid free text must still be caught, and tapping a correction clears it.
      await input("address.country").fill("Not a country");
      await input("address.city").focus();
      assert.match(
        await input("error-address.country").innerText(),
        /exact country/,
      );
      await country("address.country", "United", "United States");
      await input("contact.email").fill("123 Example Street");
      await input("contact.emailConfirm").focus();
      assert.match(
        await input("error-contact.email").innerText(),
        /valid email/,
      );
      await input("contact.email").fill("jane@example.test");
      await input("contact.emailConfirm").fill("wrong@example.test");
      await input("contact.phone").focus();
      assert.match(
        await input("error-contact.emailConfirm").innerText(),
        /must match/,
      );
      await input("contact.emailConfirm").fill("jane@example.test");
      await input("contact.phone").focus();
      assert.equal(await input("error-contact.emailConfirm").innerText(), "");
      assert.equal(
        await input("contact.email").getAttribute("autocomplete"),
        "section-contact email",
      );

      await input("entrant.lastName").fill("EXAMPLE");
      await input("entrant.firstName").fill("JANE");
      await input("entrant.noMiddleName").check();
      assert(await input("entrant.middleName").isDisabled());
      await input("entrant.sex-Female").check();
      await date("entrant.birthDate", "2000-02-30");
      await input("entrant.birthCity").focus();
      assert.match(
        await input("error-entrant.birthDate").innerText(),
        /real calendar date/,
      );
      await date("entrant.birthDate", "2000-02-29");
      await input("entrant.birthCity").fill("Bishkek");
      await input("eligibility.confirm").check();
      for (const [id, value] of Object.entries({
        "address.careOf": "Example household",
        "address.line1": "123 Example Street",
        "address.line2": "Unit 4",
        "address.city": "Example City",
        "address.region": "Example Region",
        "address.postal": "12345",
        "contact.phone": "+1 202 555 0100",
      }))
        await input(id).fill(value);
      await input("address.noPostal").check();
      assert(await input("address.postal").isDisabled());
      await input("address.noPostal").uncheck();
      assert.equal(await input("address.postal").inputValue(), "12345");
      await input("entrant.education-University degree").check();
      await input("education.confirm").check();
      await input("entrant.marital-married").check();
      await page.getByRole("button", { name: "+ Add a child" }).tap();
      const childId = await page
        .locator('[data-field^="child."][data-field$=".firstName"]')
        .getAttribute("data-field");
      const child = childId.replace(/\.firstName$/, "");
      for (const [prefix, given, birth] of [
        ["spouse", "ALEX", "1999-01-15"],
        [child, "SAM", "2020-04-10"],
      ]) {
        await input(`${prefix}.lastName`).fill("EXAMPLE");
        await input(`${prefix}.firstName`).fill(given);
        await input(`${prefix}.noMiddleName`).check();
        await input(`${prefix}.sex-Male`).check();
        await date(`${prefix}.birthDate`, birth);
        await input(`${prefix}.birthCity`).fill("Bishkek");
        await country(`${prefix}.birthCountry`, "Kyr", "Kyrgyzstan");
      }
      await input("family.confirm").check();
      await input("passport.path").selectOption("passport");
      await input("passport.name").fill("JANE EXAMPLE");
      await input("passport.number").fill("TEST12345");
      await input("passport.issuer").fill("Kyrgyzstan");
      await date("passport.expiry", "2090-01-15");
      await input("passport.confirm").check();
      await input("contact.consulate").fill(
        "Example consular office — test only",
      );
      const pixels = await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = c.height = 1600;
        const x = c.getContext("2d");
        const g = x.createLinearGradient(0, 0, 1600, 1600);
        g.addColorStop(0, "#1b3552");
        g.addColorStop(1, "#f3ce76");
        x.fillStyle = g;
        x.fillRect(0, 0, 1600, 1600);
        x.fillStyle = "#fff";
        x.fillRect(100, 200, 200, 300);
        x.font = "50px sans-serif";
        x.fillText("SYNTHETIC TEST IMAGE", 350, 800);
        return c.toDataURL("image/png").split(",")[1];
      });
      const photo = {
        name: "synthetic.png",
        mimeType: "image/png",
        buffer: Buffer.from(pixels, "base64"),
      };
      await input("file-entrant.photo").setInputFiles(photo);
      await page.getByRole("dialog").waitFor();
      assert(await input("crop-x").isDisabled());
      assert(await input("crop-y").isDisabled());
      assert.match(await input("crop-position-help").innerText(), /Zoom in/);
      // Operate the actual slider using touch, then the keyboard endpoints.
      await input("crop-zoom").tap();
      assert(await input("crop-x").isEnabled());
      assert(await input("crop-y").isEnabled());
      const crop = page.locator(".crop-preview canvas");
      for (const axis of ["x", "y"]) {
        await input(`crop-${axis}`).focus();
        await input(`crop-${axis}`).press("Home");
        const start = await crop.evaluate((c) => c.toDataURL());
        await input(`crop-${axis}`).press("End");
        const end = await crop.evaluate((c) => c.toDataURL());
        assert.notEqual(start, end, `${axis} changes preview pixels`);
      }
      await page.screenshot({ path: path.join(output, `crop-${name}.png`) });
      await page.getByRole("button", { name: "Reset framing" }).tap();
      assert(await input("crop-x").isDisabled());
      assert.equal(await input("crop-zoom").inputValue(), "1");
      await input("crop-zoom").tap();
      const use = () =>
        page.getByRole("button", { name: "Use this photo", exact: true }).tap();
      await use();
      await field("entrant.photo").locator(".document-photo").waitFor();
      await field("entrant.photo").locator(".photo-confirm input").check();
      for (const prefix of ["spouse", child]) {
        await input(`file-${prefix}.photo`).setInputFiles(photo);
        await use();
        await field(`${prefix}.photo`).locator(".photo-confirm input").check();
      }
      for (const id of ["passport.bio", "passport.signature"]) {
        await input(`file-${id}`).setInputFiles(photo);
        await field(id).locator("img").waitFor();
      }
      await input("passport.samePage").check();
      assert.equal(await field("passport.signature").count(), 0);
      await input("passport.samePage").uncheck();
      assert.equal(await field("passport.signature").locator("img").count(), 1);
      assert.equal(
        await page.locator("[data-progress-label]").innerText(),
        "100%",
      );
      assert.equal(
        await page.locator(".compact-remaining").innerText(),
        "0 left",
      );
      // A pending separate principal must not strand non-applicable marital states at 96%.
      await page
        .getByRole("checkbox", {
          name: "I also want to prepare a separate entry for an independently eligible spouse.",
        })
        .check();
      assert.equal(
        await page.locator(".compact-remaining").innerText(),
        "1 left",
      );
      await more();
      await page
        .getByRole("button", { name: "Missing Fields", exact: true })
        .tap();
      assert.match(
        await page.locator(".missing-list").innerText(),
        /Prepare the separate principal worksheet/,
      );
      assert.doesNotMatch(
        await page.locator(".missing-list").innerText(),
        /Current marital status/,
      );
      await close();
      for (const marital of [
        "married-us",
        "unmarried",
        "divorced",
        "widowed",
        "separated",
      ]) {
        await input(`entrant.marital-${marital}`).check();
        assert.equal(
          await page.locator("[data-progress-label]").innerText(),
          "100%",
          marital,
        );
        assert.equal(
          await page.locator(".compact-remaining").innerText(),
          "0 left",
          marital,
        );
      }
      await input("entrant.marital-married").check();
      assert.equal(await input("spouse.firstName").inputValue(), "ALEX");
      await page
        .getByRole("checkbox", {
          name: "I also want to prepare a separate entry for an independently eligible spouse.",
        })
        .uncheck();
      assert.equal(
        await page.locator("[data-progress-label]").innerText(),
        "100%",
      );
      // Missing spouse data is a real task and links to the exact field.
      await input("spouse.firstName").fill("");
      await more();
      await page
        .getByRole("button", { name: "Missing Fields", exact: true })
        .tap();
      await page
        .locator(".missing-item")
        .filter({ hasText: "First / given name" })
        .tap();
      assert.equal(
        await input("spouse.firstName").evaluate(
          (e) => e === document.activeElement,
        ),
        true,
      );
      await input("spouse.firstName").fill("ALEX");
      await more();
      assert.equal(
        await page
          .getByRole("button", { name: "Requirements / Help", exact: true })
          .count(),
        0,
      );
      await page.screenshot({ path: path.join(output, `actions-${name}.png`) });
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        audit.violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
        [],
      );
      await page
        .getByRole("button", { name: "Pay now · $9.99", exact: true })
        .tap();
      assert(
        await page
          .getByRole("heading", {
            name: "Account setup in progress",
            exact: true,
          })
          .isVisible(),
      );
      await close();
      await more();
      await page
        .getByRole("button", { name: "Change package", exact: true })
        .tap();
      assert(
        await page
          .getByRole("button", { name: "Under review", exact: true })
          .isDisabled(),
      );
      await close();
      await more();
      await page
        .getByRole("button", { name: "Review Document", exact: true })
        .tap();
      assert(
        await page
          .getByRole("heading", {
            name: "Your preparation worksheet is ready.",
            exact: true,
          })
          .isVisible(),
      );
      const review = await page.locator(".review-content").innerText();
      for (const value of [
        "Kyrgyzstan",
        "United States",
        "123 Example Street",
        "jane@example.test",
        "JANE",
        "ALEX",
        "SAM",
        "TEST12345",
      ])
        assert(review.includes(value), value);
      await page
        .getByRole("button", { name: "Preview prepared worksheet" })
        .tap();
      assert.equal(await page.locator("[data-control]").count(), 0);
      const preview = await page.locator(".worksheet-output").innerText();
      assert(preview.includes("JANE"));
      for (const value of [
        "jane@example.test",
        "123 Example Street",
        "TEST12345",
        "Bishkek",
        "ALEX",
        "SAM",
      ])
        assert(
          !new RegExp(`\\b${value}\\b`).test(preview),
          `Unpaid preview must omit ${value}`,
        );
      assert.equal(await page.locator("iframe").count(), 0);
      await page.screenshot({
        path: path.join(output, `limited-preview-${name}.png`),
        fullPage: true,
      });
      assert.equal(outbound, 0);
      assert.deepEqual(errors, []);
      console.log(
        `${name}: touch countries, validation corrections, full household, photo position pixels, passport pages, 100% review and action accessibility passed.`,
      );
    } finally {
      await browser.close();
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
