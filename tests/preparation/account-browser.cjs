const { chromium, webkit, firefox } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.PREP_BASE_URL || "https://127.0.0.1:8444";
assert.equal(new URL(base).hostname, "127.0.0.1");
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
      await context.route(`${base}/account-fixture`, (route) =>
        route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="en"><head><title>Account fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/preparation/workspace.css"><link rel="stylesheet" href="/assets/preparation/auth.css"></head><body><main id="account-fixture"></main></body></html>',
        }),
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/account-fixture`);
      await page.evaluate(async () => {
        const { accountPage } =
          await import("/assets/preparation/account-page.mjs");
        const complete = { complete: 10, total: 10, done: true };
        window.records = [
          {
            id: "blank",
            year: 2027,
            package: "single",
            state: "unpaid",
            updated_at: "2026-10-20T12:00:00Z",
            entry: {
              name: "Empty retry",
              hasInformation: false,
              personal: { complete: 0, total: 10 },
              family: { complete: 0, total: 2 },
              percent: 0,
              remaining: 12,
              pdfReady: false,
            },
          },
          {
            id: "current",
            year: 2027,
            package: "single",
            state: "paid",
            updated_at: "2026-10-19T12:00:00Z",
            entry: {
              name: "SYNTHETIC PERSON",
              hasInformation: true,
              personal: complete,
              family: complete,
              percent: 75,
              remaining: 0,
              pdfReady: true,
            },
          },
          {
            id: "older",
            year: 2027,
            package: "family",
            state: "unpaid",
            updated_at: "2026-10-18T12:00:00Z",
            entry: {
              name: "OTHER HOUSEHOLD",
              hasInformation: true,
              personal: { complete: 4, total: 10 },
              family: { complete: 1, total: 2 },
              percent: 22,
              remaining: 7,
              pdfReady: false,
            },
          },
        ];
        window.opened = [];
        window.submissions = [];
        window.mountAccount = () =>
          document.querySelector("main").replaceChildren(
            accountPage({
              account: {
                email: "synthetic@example.test",
                user_metadata: { full_name: "Synthetic Person" },
              },
              list: async () => ({ preparations: window.records }),
              open: async (id, stage) => window.opened.push({ id, stage }),
              preparations: () => {},
              signOut: async () => {},
              checkoutAvailable: true,
              submission: async (id, submitted) => {
                window.submissions.push({ id, submitted });
                const p = window.records.find((p) => p.id === id);
                p.entry = {
                  ...p.entry,
                  percent: submitted ? 100 : 75,
                  submissionReportedAt: submitted
                    ? "2026-10-19T12:00:00Z"
                    : null,
                };
                return { entry: p.entry };
              },
            }),
          );
        window.mountAccount();
      });
      await page
        .getByRole("heading", { name: "My DV Lottery Entry", exact: true })
        .waitFor();
      assert.equal(await page.locator(".entry-card").count(), 1);
      assert.equal(
        await page.locator(".entry-applicant").innerText(),
        "SYNTHETIC PERSON",
      );
      assert.equal(
        await page
          .getByRole("progressbar", { name: "Entry preparation progress" })
          .getAttribute("value"),
        "75",
      );
      assert.match(
        await page.locator(".entry-stages").innerText(),
        /Official submission\s+Not recorded/,
      );
      assert.equal(
        await page.getByLabel("Choose a saved preparation").isVisible(),
        false,
      );
      await page
        .getByRole("button", { name: "Continue preparation", exact: true })
        .click();
      assert.deepEqual(await page.evaluate(() => window.opened[0]), {
        id: "current",
        stage: null,
      });
      await page
        .getByRole("button", { name: "View preparation PDF", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => window.opened.at(-1).stage),
        "pdf",
      );
      const official = page.getByRole("link", {
        name: "Continue to official website",
      });
      assert.equal(
        await official.getAttribute("href"),
        "https://dvprogram.state.gov/",
      );
      assert.equal(await official.getAttribute("target"), "_blank");
      assert.equal(await page.evaluate(() => window.submissions.length), 0);
      await page
        .getByText("Already submitted? Record it here", { exact: true })
        .click();
      await page
        .getByRole("checkbox", {
          name: "I submitted this entry on the official DV website.",
        })
        .check();
      await page
        .getByRole("button", { name: "Save submission status", exact: true })
        .click();
      await page.getByText("Reported by you", { exact: true }).waitFor();
      assert.equal(
        await page.getByRole("progressbar").getAttribute("value"),
        "100",
      );
      assert.match(
        await page.locator(".account-page").innerText(),
        /not been verified/,
      );
      await page.evaluate(() => window.mountAccount());
      await page.getByText("Reported by you", { exact: true }).waitFor();
      await page
        .getByText("Other saved preparations (2)", { exact: true })
        .click();
      await page.getByLabel("Choose a saved preparation").selectOption("older");
      assert.equal(
        await page.locator(".entry-applicant").innerText(),
        "OTHER HOUSEHOLD",
      );
      await page
        .getByRole("button", { name: "Pay now · $29.99", exact: true })
        .click();
      assert.deepEqual(await page.evaluate(() => window.opened.at(-1)), {
        id: "older",
        stage: "payment",
      });
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `no account overflow at ${width}px`,
        );
      }
      const { default: AxeBuilder } = await import("@axe-core/playwright");
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        scan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
      );
      await page.setViewportSize({ width: 390, height: 1000 });
      await page.evaluate(() => {
        window.records = window.records.filter((p) => p.id !== "older");
        const current = window.records.find((p) => p.id === "current");
        current.entry.percent = 75;
        current.entry.submissionReportedAt = null;
        window.mountAccount();
      });
      await page.getByText("SYNTHETIC PERSON", { exact: true }).waitFor();
      await page.screenshot({
        path: `/tmp/gcas-v37-account-${engine}.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      console.log(
        `${engine}: current entry, four truthful stages, 75% PDF-ready state, explicit persistent submission record, older-entry recovery, early payment action, responsive layout and accessibility passed.`,
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
