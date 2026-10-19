// Controlled OCR retries exercise the real parser, scan lifecycle and UI.
// Real OCR pixels remain covered by the UX and passport/session browser suites.
const { chromium, webkit, firefox } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const AxeBuilder = require("@axe-core/playwright").default;
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
      const openEntry = () =>
        page
          .getByRole("button", { name: "Save time — Scan your passport" })
          .click();
      await openEntry();
      const dialog = page.getByRole("dialog");
      assert.equal(
        await dialog.locator("button").count(),
        3,
        "Only close and the two photo choices",
      );
      const take = dialog.getByRole("button", {
        name: "Take photo",
        exact: true,
      });
      const choose = dialog.getByRole("button", {
        name: "Upload photo",
        exact: true,
      });
      assert(await take.isDisabled());
      assert(await choose.isDisabled());
      assert.equal(
        await page.locator("#scan-upload").getAttribute("accept"),
        "image/*",
      );
      assert.equal(
        await page.locator("#scan-upload").getAttribute("capture"),
        null,
      );
      assert.equal(
        await page.locator("#scan-camera").getAttribute("capture"),
        "environment",
      );
      await page.locator("#scan-permission").check();
      for (const width of [320, 390, 430, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        assert(
          await dialog.evaluate(
            (node) => node.scrollWidth <= node.clientWidth + 1,
          ),
        );
        for (const choice of [take, choose]) {
          const bounds = await choice.boundingBox();
          assert(
            bounds.height >= 44 &&
              bounds.x >= 0 &&
              bounds.x + bounds.width <= width,
          );
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      assert.deepEqual(
        (await new AxeBuilder({ page }).include(".workspace-dialog").analyze())
          .violations,
        [],
      );
      await page.screenshot({ path: `/tmp/gcas-v33-scan-entry-${engine}.png` });
      // Native picker activation must work directly from both buttons. A
      // capture-less desktop or older browser still has its file-picker path.
      for (const [choice, id] of [
        [take, "scan-camera"],
        [choose, "scan-upload"],
      ]) {
        const [picker] = await Promise.all([
          page.waitForEvent("filechooser"),
          choice.click(),
        ]);
        assert.equal(await picker.element().getAttribute("id"), id);
        await picker.setFiles([]);
        await page.locator(`#${id}`).dispatchEvent("cancel");
        assert(
          await choose.isEnabled(),
          "Cancellation does not lock selection",
        );
        assert.equal(
          await page
            .getByRole("progressbar", { name: "Preparing passport photo" })
            .count(),
          0,
        );
      }
      // Invalid selection and selecting the same file again are recoverable.
      for (let attempt = 0; attempt < 2; attempt++) {
        const [picker] = await Promise.all([
          page.waitForEvent("filechooser"),
          choose.click(),
        ]);
        await picker.setFiles({
          name: "not-an-image.jpg",
          mimeType: "image/jpeg",
          buffer: Buffer.from("%PDF-synthetic"),
        });
        await dialog
          .getByRole("status")
          .filter({ hasText: "Choose a JPEG" })
          .waitFor();
        assert(await choose.isEnabled());
        assert.equal(await page.locator("#scan-upload").inputValue(), "");
      }
      // Hold actual file reading to check immediate preparation feedback and
      // cancellation before conversion finishes, without running OCR early.
      await page.evaluate(() => {
        const read = Blob.prototype.arrayBuffer;
        Blob.prototype.arrayBuffer = function () {
          const data = read.call(this);
          return new Promise((resolve) => {
            window.releasePhoto = async () => {
              Blob.prototype.arrayBuffer = read;
              resolve(await data);
            };
          });
        };
      });
      await page.locator("#scan-upload").setInputFiles({
        name: "synthetic-td3.png",
        mimeType: "image/png",
        buffer: fs.readFileSync(
          path.join(__dirname, "fixtures/synthetic-td3.png"),
        ),
      });
      await page
        .getByRole("progressbar", { name: "Preparing passport photo" })
        .waitFor();
      assert(await choose.isDisabled());
      await dialog.getByRole("button", { name: "Close dialog" }).click();
      await page.evaluate(() => window.releasePhoto());
      assert.equal(await dialog.count(), 0);
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
      // The real mobile date/select controls and image must never widen the sheet.
      for (const width of [320, 390, 430, 768]) {
        await page.setViewportSize({ width, height: 844 });
        const geometry = await page.getByRole("dialog").evaluate((dialog) => {
          dialog.scrollLeft = 100;
          const bounds = dialog.getBoundingClientRect();
          return {
            left: bounds.left,
            right: bounds.right,
            clientWidth: dialog.clientWidth,
            scrollWidth: dialog.scrollWidth,
            scrollLeft: dialog.scrollLeft,
            locked: getComputedStyle(document.body).position,
            overflowingInputs: [
              ...dialog.querySelectorAll("input,select,img"),
            ].filter(
              (input) => input.getBoundingClientRect().right > bounds.right + 1,
            ).length,
          };
        });
        assert(
          geometry.left >= 0 && geometry.right <= width + 1,
          JSON.stringify(geometry),
        );
        assert(
          geometry.scrollWidth <= geometry.clientWidth + 1,
          JSON.stringify(geometry),
        );
        assert.equal(geometry.scrollLeft, 0);
        assert.equal(geometry.overflowingInputs, 0);
        assert.equal(geometry.locked, "fixed");
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: `/tmp/gcas-v31-scan-review-${engine}.png`,
      });
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
      assert.equal(
        await page.evaluate(() =>
          document.documentElement.classList.contains("modal-open"),
        ),
        false,
      );
      assert.notEqual(
        await page.evaluate(() => getComputedStyle(document.body).position),
        "fixed",
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
        .getByRole("button", { name: "Try another photo", exact: true })
        .waitFor();
      assert.equal(
        await progress.count(),
        0,
        "Failure stops the progress indicator",
      );
      await page
        .getByRole("button", { name: "Try another photo", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Scan your passport", exact: true })
        .waitFor();
      assert(
        await page
          .getByRole("button", { name: "Upload photo", exact: true })
          .isDisabled(),
      );
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      assert.equal(
        await page.locator('[id="entrant.firstName"]').inputValue(),
        "JANE",
      );
      // Keep 12 MP scan detail locally; the separately generated upload must fit
      // the same bounded decoder used by the backend, in every browser engine.
      const uploadCopy = await page.evaluate(async () => {
        const { passportCopy, passportUploadCopy } =
          await import("/assets/preparation/media.mjs?v=20261019-workspace-v37");
        const canvas = document.createElement("canvas");
        canvas.width = 3024;
        canvas.height = 4032;
        const context = canvas.getContext("2d");
        context.fillStyle = "#e8e8e8";
        context.fillRect(0, 0, canvas.width, canvas.height);
        const source = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.95),
        );
        const scan = await passportCopy(source);
        const upload = await passportUploadCopy(scan.blob);
        return {
          scanWidth: scan.width,
          scanHeight: scan.height,
          bytes: Array.from(new Uint8Array(await upload.arrayBuffer())),
        };
      });
      assert.equal(uploadCopy.scanWidth * uploadCopy.scanHeight, 3024 * 4032);
      const decoded = require("jpeg-js").decode(Buffer.from(uploadCopy.bytes), {
        useTArray: true,
        maxMemoryUsageInMB: 128,
      });
      assert(decoded.width * decoded.height <= 4000000);
      assert(Math.max(decoded.width, decoded.height) <= 2400);
      // This HEIC is a conversion of the same fictional PNG fixture. Exercise
      // both the native-first path and the local decoder fallback on real bytes.
      const heic = await page.evaluate(async () => {
        const { readImage, passportCopy } =
          await import("/assets/preparation/media.mjs?v=20261019-workspace-v37");
        const source = await (
          await fetch("/tests/preparation/fixtures/synthetic-td3.heic")
        ).blob();
        const OriginalWorker = window.Worker;
        let conversions = 0;
        window.Worker = class extends OriginalWorker {
          constructor(...args) {
            super(...args);
            conversions++;
          }
        };
        let native;
        try {
          const decoded = await readImage(source);
          native = {
            width: decoded.width,
            height: decoded.height,
            type: decoded.type,
            conversions,
          };
          const OriginalImage = window.Image;
          window.Image = function () {
            const image = new OriginalImage();
            Object.defineProperty(image, "src", {
              set() {
                queueMicrotask(() => image.onerror());
              },
            });
            return image;
          };
          try {
            const copy = await passportCopy(source);
            return {
              native,
              width: copy.width,
              height: copy.height,
              type: copy.blob.type,
              conversions,
            };
          } finally {
            window.Image = OriginalImage;
          }
        } finally {
          window.Worker = OriginalWorker;
        }
      });
      assert.equal(heic.native.type, "heic");
      assert.equal(heic.width, heic.native.width);
      assert.equal(heic.height, heic.native.height);
      assert.equal(heic.type, "image/jpeg");
      assert.equal(heic.conversions, heic.native.conversions + 1);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `PASS ${engine}: accessible photo choices, native picker activation/cancellation/reselection, preparation feedback, HEIC native-first and fallback decoding, continuous scan indicator, later printed name correction, review before apply, stable mobile dialog bounds, 12 MP normalization, failure and reduced motion.`,
      );
    } finally {
      await browser.close();
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
