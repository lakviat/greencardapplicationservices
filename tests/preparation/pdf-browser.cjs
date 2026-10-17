// Render actual server-generated synthetic PDF bytes with the production CSP.
const { chromium, webkit, firefox } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.PREP_BASE_URL || "https://127.0.0.1:8444";
assert.equal(new URL(base).hostname, "127.0.0.1");
(async () => {
  const { makePdf } = await import("../../supabase/functions/gcas-api/pdf.mjs");
  const { initialDraft } = await import("../../assets/preparation/schema.mjs");
  const d = initialDraft();
  d.answers["entrant.firstName"] = "SYNTHETIC";
  d.answers["entrant.lastName"] = "EXAMPLE";
  const bytes = Array.from(await makePdf([d], "single"));
  for (const engine of (
    process.env.PREP_ENGINES || "chromium,webkit,firefox"
  ).split(",")) {
    const browser = await { chromium, webkit, firefox }[engine].launch();
    try {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 390, height: 844 },
      });
      let external = 0;
      await context.route("**/*", (route) => {
        if (new URL(route.request().url()).origin === base)
          return route.continue();
        if (route.request().url().endsWith("/health"))
          return route.fulfill({ json: {} });
        external++;
        return route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/prepare.html");
      await page.evaluate(async (bytes) => {
        const { pdfViewer } =
          await import("/assets/preparation/pdf-viewer.mjs?v=20261017-workspace-v29");
        const root = document.createElement("main");
        document.body.replaceChildren(root);
        const dispose = pdfViewer(
          new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
          root,
        );
        const close = document.createElement("button");
        close.textContent = "Close PDF";
        close.onclick = () => {
          dispose();
          root.remove();
        };
        document.body.append(close);
      }, bytes);
      const first = page.locator('canvas[data-rendered="1"]');
      await first.waitFor();
      assert(
        await first.evaluate((canvas) =>
          canvas
            .getContext("2d")
            .getImageData(0, 0, canvas.width, canvas.height)
            .data.some((v, i) => i % 4 !== 3 && v < 100),
        ),
      );
      assert.match(await page.locator(".sr-only").innerText(), /SYNTHETIC/);
      await page
        .getByRole("button", { name: "Next page →", exact: true })
        .click();
      await page.locator('canvas[data-rendered="2"]').waitFor();
      await page
        .getByRole("button", { name: "← Previous page", exact: true })
        .click();
      await first.waitFor();
      await page.screenshot({
        path: `/tmp/gcas-form-fixes/pdf-renderer-${engine}.png`,
      });
      await page
        .getByRole("button", { name: "Close PDF", exact: true })
        .click();
      assert.equal(await page.locator("canvas").count(), 0);
      assert.equal(external, 0);
      assert.deepEqual(errors, []);
      console.log(
        engine +
          ": real PDF pixels, accessible text, page navigation and cleanup under production CSP passed.",
      );
    } finally {
      await browser.close();
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
