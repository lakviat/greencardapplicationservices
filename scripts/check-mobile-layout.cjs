#!/usr/bin/env node
"use strict";

// Start the local HTTPS server first, then: node scripts/check-mobile-layout.cjs
// For a globally installed Playwright, if needed: NODE_PATH=$(npm root -g) node scripts/check-mobile-layout.cjs
// Optional: MOBILE_BASE_URL, MOBILE_ENGINES=webkit, MOBILE_SCREENSHOT_DIR=artifacts/mobile
// For CSP parity, use MOBILE_BASE_URL=https://127.0.0.1:8443 with a local HTTPS server.
// Pass --focus-only or --checkout-only for targeted regression runs.
// Screenshots are real browser viewport captures; device profiles are emulations, not device-OS tests.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { chromium, webkit, firefox, devices } = require("playwright");

const root = path.resolve(__dirname, "..");
const base = new URL(process.env.MOBILE_BASE_URL || "https://127.0.0.1:8443");
assert(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Use a local static server only.");
assert(["http:", "https:"].includes(base.protocol), "Use an HTTP or HTTPS local static server.");
const engines = { chromium, webkit, firefox };
const selectedEngines = (process.env.MOBILE_ENGINES || "chromium,webkit,firefox").split(",");
const focusOnly = process.argv.includes("--focus-only");
const checkoutOnly = process.argv.includes("--checkout-only");
assert(!(focusOnly && checkoutOnly), "Choose only one targeted check mode.");
selectedEngines.forEach((name) => assert(engines[name], `Unknown browser engine: ${name}`));
assert(base.protocol === "https:" || !selectedEngines.includes("webkit"),
  "WebKit needs local HTTPS to preserve upgrade-insecure-requests CSP. Use MOBILE_BASE_URL=https://127.0.0.1:8443.");
const screenshotDir = process.env.MOBILE_SCREENSHOT_DIR
  ? path.resolve(process.env.MOBILE_SCREENSHOT_DIR) : null;
if (screenshotDir) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}
const pages = [
  ...fs.readdirSync(root).filter((name) => name.endsWith(".html")).sort(),
  "policies/index.html",
];
assert.equal(pages.length, 18, "Update the page matrix when published HTML pages change.");
const packages = {
  single: { label: "Single", price: 24, count: 1, link: "9B614p5JI4SH6xNd0U0Ny05" },
  couple: { label: "Couple", price: 44, count: 2, link: "28E28t5JI4SH1dt1ic0Ny06" },
  family: { label: "Family", price: 64, count: 3, link: "eVqbJ34FE98X6xN6Cw0Ny07" },
  premium: { label: "Premium", price: 94, count: 3, link: "cNiaEZ2xw1Gv4pFd0U0Ny08" },
};
const profiles = [
  { name: "iphone-15-pro-max", width: 430, height: 932, device: "iPhone 15 Pro Max" },
  { name: "iphone-15-pro-max-browser-chrome", width: 430, height: 739, screenHeight: 932, device: "iPhone 15 Pro Max" },
  { name: "iphone-390", width: 390, height: 844, device: "iPhone 13" },
  { name: "iphone-se", width: 375, height: 667, device: "iPhone SE" },
  { name: "narrow-phone", width: 320, height: 568, device: "iPhone SE" },
  { name: "android-412", width: 412, height: 915, device: "Pixel 7" },
  { name: "android-360", width: 360, height: 800, device: "Pixel 7" },
  { name: "tablet", width: 768, height: 1024, device: "iPad Mini" },
  { name: "desktop", width: 1440, height: 1000 },
  { name: "landscape", width: 932, height: 430, device: "iPhone 15 Pro Max" },
];
let assertionContext = "";
let layoutCount = 0;
let checkoutCount = 0;

function contextOptions(engine, profile) {
  if (profile.device) assert(devices[profile.device], `Playwright device profile not found: ${profile.device}`);
  const options = profile.device ? { ...devices[profile.device] } : {};
  delete options.defaultBrowserType;
  Object.assign(options, {
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.screenHeight || profile.height },
    reducedMotion: "no-preference",
    serviceWorkers: "block",
    // Local HTTPS preserves production CSP (including upgrade-insecure-requests).
    // The base URL is restricted to loopback above; never disable CSP for the test.
    ignoreHTTPSErrors: base.protocol === "https:",
  });
  if (profile.name === "iphone-15-pro-max") options.deviceScaleFactor = 3;
  // Firefox supports touch events, but not Playwright's isMobile viewport emulation.
  if (engine === "firefox") delete options.isMobile;
  return options;
}

async function isolatedContext(browser, engine, profile) {
  const context = await browser.newContext(contextOptions(engine, profile));
  const traffic = { posts: [], stripe: [], blocked: [], errors: [] };
  // Only this origin can reach the network. Apps Script and Stripe are fulfilled locally.
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === base.origin) {
      await route.continue();
    } else if (url.hostname === "script.google.com" && request.method() === "POST") {
      traffic.posts.push(JSON.parse(request.postData()));
      await route.fulfill({
        status: 200, contentType: "application/json",
        headers: { "access-control-allow-origin": "*" }, body: '{"ok":true,"mock":true}',
      });
    } else if (url.hostname === "buy.stripe.com" && request.isNavigationRequest()) {
      traffic.stripe.push(url.href);
      await route.fulfill({
        status: 200, contentType: "text/html",
        body: "<!doctype html><title>Local checkout mock</title><h1>Checkout intercepted; no payment made.</h1>",
      });
    } else {
      traffic.blocked.push(url.origin);
      await route.abort("blockedbyclient");
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => traffic.errors.push(error.message));
  return { context, page, traffic, touch: Boolean(contextOptions(engine, profile).hasTouch) };
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    let last = window.scrollY;
    let stable = 0;
    const start = performance.now();
    const frame = () => {
      stable = Math.abs(window.scrollY - last) < 0.5 ? stable + 1 : 0;
      last = window.scrollY;
      if (stable >= 8 && performance.now() - start >= 250) return resolve();
      if (performance.now() - start > 5000) return reject(new Error("Scrolling did not settle"));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }));
}

async function load(page, filename = "index.html") {
  const response = await page.goto(new URL(filename, base).href, { waitUntil: "load" });
  assert(response?.ok(), `Cannot load ${filename}: HTTP ${response?.status()}`);
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
}

async function activate(locator, touch) {
  await locator.scrollIntoViewIfNeeded();
  await settle(locator.page());
  if (touch) await locator.tap();
  else await locator.click();
}

async function dismissCookies(page, touch) {
  const button = page.getByRole("button", { name: "Reject nonessential", exact: true });
  if (await button.isVisible()) await activate(button, touch);
}

async function layout(page) {
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const headings = [...document.querySelectorAll("main h1, main h2")]
      .filter((element) => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
    return {
      width,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      h1: [...document.querySelectorAll("h1")].filter((element) => element.getClientRects().length).length,
      badHeadings: headings.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width <= 0 || rect.height <= 0 || rect.left < -1 || rect.right > width + 1;
      }).map((element) => element.textContent.trim()),
    };
  });
  assert(result.scrollWidth <= result.width + 1, `Horizontal overflow: ${JSON.stringify(result)}`);
  assert(result.h1 > 0, "A visible page heading is required");
  assert.deepEqual(result.badHeadings, [], "Headings must fit the viewport");
}

async function heroLayout(page, profile) {
  await layout(page);
  const rects = await page.evaluate(() => {
    const rect = (selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    return {
      header: rect(".site-header"), visual: rect(".hero-visual"),
      image: rect(".hero-photo-carousel"), content: rect(".hero-content"), title: rect("h1"),
      dotsInside: Boolean(document.querySelector(".hero-visual .hero-carousel-dots")),
    };
  });
  assert(rects.dotsInside, "Carousel indicators belong inside the visual");
  assert(rects.image.height > 100, "Hero image must remain visible");
  if (profile.width <= 860) {
    assert(rects.visual.bottom <= rects.content.top + 1, "Mobile hero image must precede the text");
    assert(rects.visual.top >= rects.header.bottom - 1, "Header must not overlap the hero image");
    assert(rects.visual.top - rects.header.bottom <= 64, "Hero image should start just below the header");
    const imageLimit = profile.width <= 620 ? Math.min(440, profile.height * 0.6) : profile.height * 0.6;
    assert(rects.image.height <= imageLimit,
      `Mobile hero image is too tall: ${JSON.stringify(rects)}`);
    if ([390, 412, 430].includes(profile.width)) {
      assert(rects.title.bottom <= profile.height, `Headline must fit in initial viewport: ${JSON.stringify(rects)}`);
    }
  } else {
    assert(rects.content.right <= rects.visual.left + 1, "Desktop hero must have text left, image right");
    assert(Math.max(rects.content.top, rects.visual.top) < Math.min(rects.content.bottom, rects.visual.bottom),
      "Desktop hero columns must share a row");
  }
}

// A phone visitor must always see a way to start on the first screen: the hero button
// itself, or the sticky bar. A hidden bar must also be unreachable by keyboard and AT.
async function firstScreenCta(page, profile) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await settle(page);
  await page.locator("body.sticky-cta-ready").waitFor({ state: "attached" });
  const state = await page.evaluate(() => {
    const hero = document.querySelector(".hero-actions .button-large").getBoundingClientRect();
    const bar = document.querySelector(".mobile-cta-bar");
    const style = getComputedStyle(bar);
    const rect = bar.getBoundingClientRect();
    const present = style.display !== "none";
    return {
      present,
      height: innerHeight,
      heroVisible: hero.top >= 0 && hero.bottom <= innerHeight - (present ? rect.height : 0),
      barVisible: style.visibility === "visible" && Number(style.opacity) === 1 && rect.top < innerHeight,
      barHidden: style.visibility === "hidden",
      barBackground: style.backgroundColor,
    };
  });
  assert(state.heroVisible || state.barVisible,
    `${profile.name}: no call to action on the first screen: ${JSON.stringify(state)}`);
  if (!state.present) return; // Tablet widths use the hero button; the bar is a phone pattern.
  assert(!(state.heroVisible && state.barVisible), `${profile.name}: duplicate calls to action on the first screen`);
  assert(state.barBackground.startsWith("rgba(255, 255, 255"),
    "The fixed bar must be neutral so mobile browser toolbars are not tinted red");
  if (state.barHidden) {
    assert.equal(await page.locator(".mobile-cta").evaluate((link) => getComputedStyle(link).visibility), "hidden",
      "A hidden sticky CTA must not be focusable");
  }
}

async function touchTargets(page, profile) {
  const small = await page.evaluate(() => [...document.querySelectorAll(
    ".footer-links a, .footer-links button, .content-hero nav[aria-label='Breadcrumb'] a, .policy-back-top, .countdown-source",
  )].filter((element) => element.getClientRects().length && element.getBoundingClientRect().height < 43.5)
    .map((element) => `${element.textContent.trim()} ${Math.round(element.getBoundingClientRect().height)}px`));
  assert.deepEqual(small, [], `${profile.name}: touch targets under 44px`);
}

async function landing(page, pointer, radiosVisible = true) {
  await settle(page);
  const result = await page.evaluate(() => {
    const title = document.querySelector("#applicationFormTitle");
    const rect = title.getBoundingClientRect();
    const header = document.querySelector(".site-header").getBoundingClientRect();
    const style = getComputedStyle(title);
    return {
      active: document.activeElement.id, pointer: title.classList.contains("is-pointer-focus"),
      outline: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth),
      top: rect.top, bottom: rect.bottom, headerBottom: header.bottom,
      radios: [...document.querySelectorAll('.package-selector label')].map((element) => {
        const r = element.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      }),
      height: innerHeight,
    };
  });
  assert.equal(result.active, "applicationFormTitle", "Orient screen readers without focusing a text input");
  assert.equal(result.pointer, pointer);
  if (pointer) assert.equal(result.outline, "none", "Pointer/deep-link landing must not draw a heading outline");
  else assert(result.outline !== "none" && result.outlineWidth > 0,
    `Keyboard landing must retain its focus outline: ${JSON.stringify(result)}`);
  assert(result.top >= result.headerBottom - 1, `Sticky header covers the form title: ${JSON.stringify(result)}`);
  assert(result.top - result.headerBottom < 200, `Large blank gap above the form: ${JSON.stringify(result)}`);
  assert(result.bottom < result.height, "Application title must be in view after selecting a package");
  if (radiosVisible) {
    assert(result.radios.every((r) => r.top >= result.headerBottom && r.bottom <= result.height),
      `Package choices must be visible on the iPhone 15 Pro Max landing: ${JSON.stringify(result)}`);
  }
}

async function selection(page, key) {
  const expected = packages[key];
  assert(await page.locator(`input[name="package"][value="${key}"]`).isChecked());
  assert.equal((await page.locator("[data-package-name]").first().textContent()).trim(), expected.label);
  assert.equal((await page.locator("[data-package-price]").first().textContent()).trim(), `$${expected.price}`);
  if (key === "premium") await page.locator("#premiumApplicantCount").selectOption("3");
  assert.equal(await page.locator("[data-applicant-section]:visible").count(), expected.count - 1);
  // The checked-state class backs up :has(input:checked) for older browsers.
  assert.deepEqual(
    await page.locator(".package-selector label.is-checked input").evaluateAll((inputs) => inputs.map((input) => input.value)),
    [key],
  );
}

async function packageInteractions(page, touch, engine) {
  for (const key of Object.keys(packages)) {
    await activate(page.locator(`[data-package-select="${key}"]`).first(), touch);
    await landing(page, true);
    await selection(page, key);
    const card = page.locator(`[data-package-select="${key}"]`).first();
    await card.scrollIntoViewIfNeeded();
    await card.focus();
    await settle(page);
    await page.keyboard.press("Enter");
    await landing(page, false);
    // macOS WebKit's default Tab skips radios/links; Option-Tab enables all-controls navigation.
    // The explanatory eligibility link precedes the radio group in DOM order.
    let reachedRadio = false;
    for (let tabs = 0; tabs < 4; tabs++) {
      await page.keyboard.press(engine === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab");
      reachedRadio = await page.evaluate(() => document.activeElement.matches('input[name="package"]:checked'));
      if (reachedRadio) break;
    }
    assert(reachedRadio, "Tab from the heading must reach the selected package radio");
    await selection(page, key);
  }
  await load(page, "index.html?package=family");
  await landing(page, true);
  await selection(page, "family");
}

async function carousel(page, touch) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await settle(page);
  await page.locator(".hero-photo-slide.hero-photo-green-card-family").waitFor({ state: "attached" });
  const loaded = await page.evaluate(async () => Promise.all(
    [...document.querySelectorAll(".hero-photo-slide")].map((slide) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth > 0);
      image.onerror = () => resolve(false);
      image.src = getComputedStyle(slide).backgroundImage.match(/url\(["']?(.*?)["']?\)/)[1];
    })),
  ));
  assert.equal(loaded.length, 4);
  assert(loaded.every(Boolean), "All four real carousel images must load");
  const pause = page.locator("[data-hero-pause]");
  await activate(pause, touch);
  assert.equal(await pause.getAttribute("aria-pressed"), "true");
  const frozen = await page.locator(".hero-photo-slide").evaluateAll((slides) =>
    slides.map((slide) => ({ opacity: Number(getComputedStyle(slide).opacity), state: getComputedStyle(slide).animationPlayState })));
  assert.equal(frozen.filter((slide) => slide.opacity === 1).length, 1, "Pause must show exactly one opaque photo");
  assert(frozen.every((slide) => slide.state === "paused"));
  await activate(pause, touch);
  assert.equal(await pause.getAttribute("aria-pressed"), "false");
  const animationSupport = await page.locator(".hero-photo-slide").first().evaluate((slide) => typeof slide.getAnimations === "function");
  if (animationSupport) {
    for (let index = 0; index < 4; index++) {
      const opacity = await page.evaluate(async (index) => {
        const slides = [...document.querySelectorAll(".hero-photo-slide")];
        const animation = slides[index].getAnimations()[0];
        if (!animation) throw new Error("Carousel animation is missing");
        const timing = animation.effect.getTiming();
        const time = timing.delay + Number(timing.duration) + 1000;
        slides.forEach((slide) => slide.getAnimations().forEach((item) => { item.currentTime = time; }));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return Number(getComputedStyle(slides[index]).opacity);
      }, index);
      assert(opacity > 0.95, `Carousel photo ${index + 1} must have an opaque hold`);
    }
    const fades = await page.evaluate(async () => {
      const slides = [...document.querySelectorAll(".hero-photo-slide")];
      slides.forEach((slide) => slide.getAnimations().forEach((item) => { item.currentTime = 24500; }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return slides.map((slide) => Number(getComputedStyle(slide).opacity));
    });
    assert(fades.some((opacity) => opacity > 0 && opacity < 1), "Carousel should crossfade, not cut");
  }
}

async function controls(page, touch, traffic) {
  await activate(page.locator(".mobile-menu > summary"), touch);
  assert(await page.locator(".mobile-menu").evaluate((element) => element.open));
  assert.equal(await page.locator(".mobile-language-list a").count(), 4);
  await activate(page.locator('.mobile-menu a[href="#pricing"]'), touch);
  assert.equal(await page.locator(".mobile-menu").evaluate((element) => element.open), false);
  await activate(page.locator(".mobile-menu > summary"), touch);
  await activate(page.locator(".mobile-menu > summary"), touch);
  assert.equal(await page.locator(".mobile-menu").evaluate((element) => element.open), false);

  const faq = page.locator(".faq-toggle").first();
  await activate(faq, touch);
  assert.equal(await faq.getAttribute("aria-expanded"), "true");
  assert(await page.locator(`#${await faq.getAttribute("aria-controls")}`).isVisible());
  await activate(faq, touch);
  assert.equal(await faq.getAttribute("aria-expanded"), "false");

  await activate(page.locator("[data-notify-open]").first(), touch);
  assert(await page.locator("#notifyModal").isVisible());
  await page.locator('[name="notifyEmail"]').fill("mobile-regression@example.test");
  assert(await page.locator('[name="notificationConsent"]').evaluate((element) => element.required));
  assert.equal(await page.locator('[name="notifyMarketingConsent"]').evaluate((element) => element.required), false);
  await activate(page.locator("#notifySubmit"), touch);
  assert.equal(await page.locator("#notifyForm").evaluate((element) => element.checkValidity()), false);
  assert.equal(traffic.posts.length, 0, "Notification must require requested-alert consent");
  await page.locator('[name="notificationConsent"]').check();
  await activate(page.locator("#notifySubmit"), touch);
  await page.getByRole("button", { name: "Request sent", exact: true }).waitFor({ state: "visible" });
  assert.equal(traffic.posts.length, 1);
  assert.equal(traffic.posts[0].marketingConsent, false, "Marketing must remain opt-in");
  await activate(page.locator(".notify-close"), touch);
  assert.equal(await page.locator("#notifyModal").isVisible(), false);
  await activate(page.locator("[data-notify-open]").first(), touch);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#notifyModal").isVisible(), false);

  await activate(page.locator("[data-cookie-preferences]").first(), touch);
  assert(await page.locator(".cookie-dialog").isVisible());
  assert.equal(await page.locator('.cookie-dialog [name="analytics"]').isChecked(), false);
  await page.locator('.cookie-dialog [name="preferences"]').check();
  await activate(page.getByRole("button", { name: "Save preferences", exact: true }), touch);
  assert.equal(await page.locator(".cookie-dialog").isVisible(), false);
  const consent = await page.evaluate(() => window.gcasConsent.get());
  assert.equal(consent.preferences, true);
  assert.equal(consent.analytics, false);
  assert.equal(consent.advertising, false);
  await activate(page.locator("[data-cookie-preferences]").first(), touch);
  assert(await page.locator('.cookie-dialog [name="preferences"]').isChecked());
  await activate(page.getByRole("button", { name: "Close cookie preferences", exact: true }), touch);

  await activate(page.locator(".support-trigger"), touch);
  assert(await page.locator("#supportPanel").isVisible());
  assert.equal(await page.locator("#supportPanel .support-action").count(), 3);
  for (const href of ["mailto:", "https://wa.me/", "/faq.html"]) {
    assert.equal(await page.locator(`#supportPanel a[href^="${href}"]`).count(), 1);
  }
  await activate(page.locator(".support-close"), touch);
  assert.equal(await page.locator("#supportPanel").isVisible(), false);

  await page.locator("#identityDocuments").setInputFiles({
    name: "regression-dummy.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nDummy test document\n"),
  });
  assert.equal((await page.locator("#fileUploadSelection").textContent()).trim(), "regression-dummy.pdf");
  // The native file control supports clearing; no nonexistent custom clear button is assumed.
  await page.locator("#identityDocuments").setInputFiles([]);
  assert.equal((await page.locator("#fileUploadSelection").textContent()).trim(), "No files selected");
  await layout(page);
}

async function checkout(browser, engine, key) {
  const session = await isolatedContext(browser, engine, profiles[0]);
  const { context, page, traffic, touch } = session;
  try {
    await load(page);
    await dismissCookies(page, touch);
    await activate(page.locator(`[data-package-select="${key}"]`).first(), touch);
    await landing(page, true);
    await selection(page, key);
    const fields = { firstName: "Test", lastName: "Applicant", email: "mobile-regression@example.test", phone: "+12025550123" };
    for (const [name, value] of Object.entries(fields)) await page.locator(`#intakeForm [name="${name}"]`).fill(value);
    const country = page.locator("#countrySearch");
    await country.fill("Uzbek");
    await country.press("ArrowDown");
    await country.press("Enter");
    assert.equal(await page.locator('select[name="country"]').inputValue(), "Uzbekistan");
    for (let applicant = 2; applicant <= packages[key].count; applicant++) {
      await page.locator(`[name="applicant${applicant}FirstName"]`).fill(`Test${applicant}`);
      await page.locator(`[name="applicant${applicant}LastName"]`).fill("Applicant");
      await page.locator(`[name="applicant${applicant}Relation"]`).selectOption(applicant === 2 ? "Spouse" : "Child");
    }
    const submit = page.locator("#applicationSubmit");
    // Exercise native keyboard validation as well as the final touch checkout.
    await submit.press("Enter");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#intakeForm").evaluate((element) => element.checkValidity()), false);
    assert.equal(traffic.posts.length, 0, "Unchecked checkout consent must block dispatch");
    assert.equal(traffic.stripe.length, 0);
    await activate(page.locator('[name="checkoutConsent"]'), touch);
    assert(await page.locator('[name="checkoutConsent"]').isChecked());
    for (const [name, value] of Object.entries(fields)) {
      const field = page.locator(`#intakeForm [name="${name}"]`);
      assert(await field.evaluate((element) => element.required), `${name} must be required`);
      await field.fill("");
      await submit.press("Enter");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#intakeForm").evaluate((element) => element.checkValidity()), false);
      assert.equal(traffic.posts.length, 0, `Missing ${name} must block dispatch`);
      assert.equal(traffic.stripe.length, 0);
      await field.fill(value);
    }
    assert(await page.locator("#intakeForm").evaluate((element) => element.checkValidity()));
    // A neutral touch dismisses native validation UI before tapping the checkout button.
    await activate(page.locator("#applicationFormTitle"), touch);
    await activate(submit, touch);
    await page.waitForURL("https://buy.stripe.com/**");
    assert.equal(traffic.posts.length, 1, "Exactly one mocked request should be dispatched");
    assert.equal(traffic.stripe.length, 1);
    const payload = traffic.posts[0];
    assert.equal(payload.package, key);
    assert.equal(payload.applicantCount, packages[key].count);
    assert.equal(payload.applicants.length, packages[key].count);
    assert.equal(payload.checkoutConsent, true);
    assert.equal(payload.marketingConsent, false);
    assert.equal(payload.countryOfBirth, "Uzbekistan");
    const target = new URL(traffic.stripe[0]);
    assert.equal(target.pathname, `/${packages[key].link}`);
    assert.equal(target.searchParams.get("prefilled_email"), fields.email);
    assert.equal(target.searchParams.get("client_reference_id"), payload.submissionId);
    assert.deepEqual(traffic.errors, []);
    checkoutCount++;
  } catch (error) {
    const state = await page.evaluate(() => ({
      url: location.href,
      message: document.querySelector("#formMessage")?.textContent,
      valid: document.querySelector("#intakeForm")?.checkValidity(),
    }));
    const details = `\nCheckout state: ${JSON.stringify({
      ...state, mockedPosts: traffic.posts.length, mockedStripe: traffic.stripe.length, pageErrors: traffic.errors,
    })}`;
    throw new Error(error.message + details, { cause: error });
  } finally {
    await context.close();
  }
}

async function screenshots(page, engine, profile) {
  if (!screenshotDir) return;
  for (const [name, selector] of [
    ["hero", ".hero-dashboard"], ["pricing", "#pricing"], ["apply", "#intakeForm"],
    ["faq", "[data-faq-accordion]"], ["countdown", "#timeline"],
  ]) {
    await page.locator(selector).first().evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
    await settle(page);
    await page.screenshot({
      path: path.relative(process.cwd(), path.join(screenshotDir, `${engine}-${profile.name}-${name}.png`)),
      fullPage: false, scale: "css",
    });
  }
}

async function main() {
  try {
    if (base.protocol === "https:") {
      await new Promise((resolve, reject) => {
        const request = https.get(base, { rejectUnauthorized: false }, (response) => {
          response.resume();
          if (response.statusCode >= 200 && response.statusCode < 300) resolve();
          else reject(new Error(`HTTP ${response.statusCode}`));
        });
        request.setTimeout(5000, () => request.destroy(new Error("Local HTTPS server timed out")));
        request.on("error", reject);
      });
    } else {
      const response = await fetch(base, { signal: AbortSignal.timeout(5000) });
      assert(response.ok, `HTTP ${response.status}`);
    }
  } catch (error) {
    throw new Error(`Start the local static server at ${base.href} before running this script. ${error.message}`);
  }
  console.log("Browser regression: emulated devices (not physical iOS/Android). All external requests mocked or blocked.");
  for (const engine of selectedEngines) {
    const browser = await engines[engine].launch({ headless: true });
    try {
      if (engine === "webkit") console.log("  WebKit: Option-Tab checks native all-controls keyboard navigation.");
      if (focusOnly) {
        assertionContext = `${engine} targeted package focus and landing`;
        const { context, page, traffic, touch } = await isolatedContext(browser, engine, profiles[0]);
        try {
          await load(page);
          await dismissCookies(page, touch);
          await packageInteractions(page, touch, engine);
          assert.deepEqual(traffic.errors, []);
          console.log(`${engine}: four pointer/keyboard package transitions and deep-link landing PASS.`);
        } finally {
          await context.close();
        }
        continue;
      }
      if (checkoutOnly) {
        for (const key of Object.keys(packages)) {
          assertionContext = `${engine} ${key} mocked checkout`;
          await checkout(browser, engine, key);
        }
        console.log(`${engine}: all four mocked checkouts PASS.`);
        continue;
      }
      console.log(`${engine}: 18 pages × 4 widths; ${profiles.length} hero viewports; touch/keyboard controls; 4 mocked checkouts.`);
      if (engine === "firefox") console.log("  Firefox: viewport + touch emulation; isMobile is unsupported.");
      for (const width of [320, 430, 768, 1440]) {
        const profile = profiles.find((item) => item.width === width);
        const { context, page, traffic, touch } = await isolatedContext(browser, engine, profile);
        try {
          for (const filename of pages) {
            assertionContext = `${engine} ${width}px ${filename}`;
            await load(page, filename);
            await dismissCookies(page, touch);
            await layout(page);
            assert.deepEqual(traffic.errors, [], "No uncaught page exceptions");
            layoutCount++;
          }
        } finally {
          await context.close();
        }
      }
      for (const profile of profiles) {
        assertionContext = `${engine} ${profile.name} hero`;
        const { context, page, traffic, touch } = await isolatedContext(browser, engine, profile);
        try {
          await load(page);
          await dismissCookies(page, touch);
          await heroLayout(page, profile);
          if (profile.width <= 860) {
            await firstScreenCta(page, profile);
            await touchTargets(page, profile);
          }
          if (profile.name.startsWith("iphone-15-pro-max")) await screenshots(page, engine, profile);
          if (profile.name === "iphone-15-pro-max") {
            assertionContext = `${engine} package focus and landing`;
            await packageInteractions(page, touch, engine);
            assertionContext = `${engine} mobile controls`;
            await controls(page, touch, traffic);
            assertionContext = `${engine} carousel`;
            await carousel(page, touch);
          }
          assert.deepEqual(traffic.errors, [], "No uncaught page exceptions");
        } finally {
          await context.close();
        }
      }
      for (const key of Object.keys(packages)) {
        assertionContext = `${engine} ${key} mocked checkout`;
        await checkout(browser, engine, key);
      }
    } finally {
      await browser.close();
    }
  }
  if (focusOnly) {
    console.log(`PASS: ${selectedEngines.length} engines, targeted focus checks only (not the full layout/checkout matrix).`);
    return;
  }
  if (checkoutOnly) {
    console.log(`PASS: ${checkoutCount} mocked checkouts only (not the full layout/interaction matrix).`);
    return;
  }
  console.log(`PASS: ${layoutCount} page/viewport checks, ${selectedEngines.length * profiles.length} hero profiles, ${checkoutCount} mocked checkouts.`);
  console.log("No application/notification records or payments were sent to external services.");
  if (screenshotDir) console.log(`Viewport screenshots: ${screenshotDir}`);
}

main().catch((error) => {
  console.error(`FAIL ${assertionContext}: ${error.stack || error}`);
  process.exitCode = 1;
});
