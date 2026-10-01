import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const metricsSource = readFileSync(new URL("../assets/site-metrics.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../assets/app.js", import.meta.url), "utf8");
const packageData = {
  single: ["Single", 39, 1, "https://buy.stripe.com/14A3cx3BAgBp4pF4uo0Ny01"],
  couple: ["Couple", 69, 2, "https://buy.stripe.com/eVq9AV2xw70PcWbgd60Ny02"],
  family: ["Family", 99, 3, "https://buy.stripe.com/cNi7sN4FE5WL7BR8KE0Ny03"],
  premium: ["Premium", 149, 1, "https://buy.stripe.com/cNieVf1tsbh509p2mg0Ny04"],
};

class Element {
  constructor(properties = {}) {
    Object.assign(this, {
      dataset: {}, listeners: new Map(), value: "", hidden: false,
      textContent: "", disabled: false, required: false,
      rect: { top: 10, bottom: 110, left: 10, right: 310, width: 300, height: 100 },
    }, properties);
    this.classes = new Set();
    this.attributes = new Map();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name),
    };
  }
  addEventListener(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
  }
  async emit(type, properties = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...properties };
    for (const handler of this.listeners.get(type) || []) await handler(event);
    return event;
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getBoundingClientRect() { return this.rect; }
  getClientRects() { return this.hidden ? [] : [this.rect]; }
  focus(options) { this.focusOptions = options; }
  scrollIntoView(options) { this.scrollOptions = options; }
  checkValidity() { return this.valid !== false; }
  reportValidity() { this.reported = true; }
}

const plain = (value) => JSON.parse(JSON.stringify(value));

function environment({ saved = null, storageFails = false, pathname = "/", search = "?email=private@example.com", reducedMotion = false } = {}) {
  const document = new Element({ readyState: "complete", visibilityState: "visible", body: new Element() });
  const elements = new Map();
  document.querySelector = (selector) => elements.get(selector) || null;
  const history = [];
  const storageWrites = [];
  const timers = new Map();
  let timerId = 0;
  let referenceId = 0;
  const clock = { now: Date.now() };
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  }
  const dataLayer = [];
  dataLayer.push = (...commands) => {
    history.push(...commands.map((command) => Array.from(command)));
    return Array.prototype.push.apply(dataLayer, commands);
  };
  const window = new Element({
    dataLayer,
    location: { origin: "https://example.test", pathname, search, hash: "#private-hash", hostname: "example.test", assign(url) { window.redirects.push(url); } },
    innerHeight: 800, innerWidth: 1200, scrollY: 0, redirects: [],
    matchMedia: () => ({ matches: reducedMotion, addEventListener() {} }),
    requestIdleCallback() {}, clearInterval() {}, setInterval() {},
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    crypto: { randomUUID: () => `test-reference-${++referenceId}` },
    localStorage: {
      getItem() { if (storageFails) throw new Error("Storage blocked"); return saved; },
      setItem(key, value) {
        if (storageFails) throw new Error("Storage blocked");
        storageWrites.push({ key, value });
        saved = value;
      },
    },
  });
  window.self = window.top = window;
  const observers = [];
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
  }
  window.IntersectionObserver = IntersectionObserver;
  const context = vm.createContext({
    window, document, IntersectionObserver, URL, URLSearchParams, console, Date: ClockDate,
    fetch() { throw new Error("Unexpected network request"); },
  });
  return { window, document, context, history, dataLayer, elements, observers, storageWrites, timers, clock };
}

function loadMetrics(options = {}) {
  const env = environment(options);
  env.pricing = new Element();
  env.application = new Element();
  env.elements.set("#pricing", env.pricing);
  env.elements.set("#intakeForm", env.application);
  if (options.offscreen) {
    env.pricing.rect.top = env.application.rect.top = 1000;
    env.pricing.rect.bottom = env.application.rect.bottom = 1100;
  }
  vm.runInContext(metricsSource, env.context);
  env.events = () => env.history.filter(([command]) => command === "event");
  return env;
}

test("consent gates events, survives blocked storage, and returns defensive copies", () => {
  const env = loadMetrics({ storageFails: true });
  const { gcasConsent, gcasAnalytics } = env.window;
  assert.equal(gcasConsent.get(), null);
  assert.equal(gcasAnalytics.track("select_item", { package: "single" }), false);
  assert.equal(env.events().length, 0);
  assert.equal(env.history.some(([command]) => command === "config"), false);
  gcasConsent.save({ analytics: "true", advertising: 1 });
  assert.equal(gcasConsent.get().analytics, false);
  gcasConsent.save({ analytics: true });
  assert.equal(gcasConsent.get().analytics, true);
  gcasConsent.get().analytics = false;
  assert.equal(gcasConsent.get().analytics, true);
  assert.deepEqual(env.events().map(([, event]) => event), ["page_view", "view_item_list", "form_view"]);
  assert.equal(env.events().some(([, event]) => event === "select_item"), false);
  assert.equal(env.window["ga-disable-G-9P726CYPGF"], false);
});

test("strict event and item allowlists discard arbitrary metadata and personal values", () => {
  const env = loadMetrics({ saved: JSON.stringify({ analytics: true }) });
  const { track } = env.window.gcasAnalytics;
  const sensitive = {
    email: "private@example.com", name: "Private Person", phone: "+123456789",
    country: "Private country", files: ["private.pdf"], submissionId: "private-id",
    page_location: "https://example.test/?email=private@example.com",
    page_referrer: "https://private.test/", items: [{ item_id: "unknown", price: 999 }],
    value: 999, currency: "SECRET",
  };
  for (const event of ["purchase", "generate_lead", "form_submit", "unknown", "__proto__"]) {
    assert.equal(track(event, sensitive), false);
  }
  for (const item of ["unknown", "__proto__", "constructor", "", null, {}, ["single"]]) {
    assert.equal(track("select_item", { package: item }), false);
    assert.equal(track("begin_checkout", { package: item }), false);
  }
  assert.equal(track("form_start", { form: "private@example.com" }), false);
  assert.equal(track("validation_error", { form: "application", category: "private.pdf" }), false);
  assert.equal(track("cta_click", { cta: "apply", location: "private@example.com" }), false);
  assert.equal(track("select_item", null), false);
  for (const [key, [label, price]] of Object.entries(packageData)) {
    assert.equal(track("begin_checkout", { ...sensitive, package: key }), true);
    const parameters = env.events().at(-1)[2];
    assert.deepEqual(plain(parameters.items), [{ item_id: key, item_name: label, price, quantity: 1 }]);
    assert.equal(parameters.value, price);
    assert.equal(parameters.currency, "USD");
    assert.equal(parameters.page_location, "https://example.test/");
    assert.equal(parameters.page_referrer, "");
  }
  assert.doesNotMatch(JSON.stringify(env.history), /private|SECRET|999/);
  const config = env.history.find(([command, id]) => command === "config" && id.startsWith("G-"))[2];
  assert.equal(config.send_page_view, false);
  assert.equal(config.form_interactions, false);
  assert.equal(config.enhanced_measurement, false);
  assert.equal(env.history.find(([command]) => command === "set")[1].url_passthrough, false);
});

test("page locations are absolute origin/path only, with no query, fragment or referrer", () => {
  const env = loadMetrics({
    pathname: "/guide.html",
    search: "?email=private@example.com&gclid=private-click&utm_source=private",
    saved: JSON.stringify({ analytics: true, advertising: true }),
  });
  for (const [command, name, metadata] of env.history) {
    const params = command === "set" ? name : metadata;
    if (params && Object.hasOwn(params, "page_location")) {
      assert.equal(params.page_location, "https://example.test/guide.html");
      assert.equal(params.page_path, "/guide.html");
      assert.equal(params.page_referrer, "");
    }
  }
  assert.doesNotMatch(JSON.stringify(env.history), /private|gclid|utm_source/);
});

test("campaign attribution accepts only complete approved triples after consent without persisting query data", () => {
  for (const source of ["newsletter", "google", "facebook", "instagram"]) {
    for (const medium of ["email", "cpc", "social"]) {
      for (const name of ["dv-preparation", "photo-checklist", "family-guide"]) {
        const env = loadMetrics({
          search: `?utm_source=${source}&utm_medium=${medium}&utm_campaign=${name}&utm_content=private@example.com&gclid=private-click-id`,
        });
        assert.equal(env.history.some(([command]) => command === "config"), false);
        assert.doesNotMatch(JSON.stringify(env.history), /campaign_|private/);
        env.window.gcasConsent.save({ analytics: true, advertising: true });
        const config = env.history.find(([command, id]) => command === "config" && id.startsWith("G-"))[2];
        assert.equal(config.campaign_source, source);
        assert.equal(config.campaign_medium, medium);
        assert.equal(config.campaign_name, name);
        assert.doesNotMatch(JSON.stringify(env.history), /private|utm_|gclid/);
        assert.doesNotMatch(JSON.stringify(env.storageWrites), /campaign|newsletter|google|facebook|instagram|private/);
        const adConfig = env.history.find(([command, id]) => command === "config" && id.startsWith("AW-"))[2];
        assert.equal(adConfig.conversion_linker, false);
        assert.equal(adConfig.url_passthrough, false);
        assert.equal(Object.keys(adConfig).some((key) => key.startsWith("campaign_")), false);
        assert.equal(env.history.find(([command]) => command === "set")[1].conversion_linker, false);
        assert.equal(env.events().some(([, , metadata]) => Object.keys(metadata).some((key) => key.startsWith("campaign_"))), false);
      }
    }
  }
});

test("unknown, incomplete and duplicate campaign values never enter analytics configuration", () => {
  for (const search of [
    "?utm_source=private@example.com&utm_medium=email&utm_campaign=dv-preparation",
    "?utm_source=newsletter&utm_medium=private&utm_campaign=dv-preparation",
    "?utm_source=newsletter&utm_medium=email&utm_campaign=private",
    "?utm_source=newsletter&utm_medium=email",
    "?utm_source=Google&utm_medium=cpc&utm_campaign=dv-preparation",
    "?utm_source=newsletter&utm_source=private&utm_medium=email&utm_campaign=dv-preparation",
    "?utm_source=newsletter&utm_medium=email&utm_campaign=",
  ]) {
    const env = loadMetrics({ search, saved: JSON.stringify({ analytics: true }) });
    const config = env.history.find(([command, id]) => command === "config" && id.startsWith("G-"))[2];
    assert.equal(Object.keys(config).some((key) => key.startsWith("campaign_")), false);
    assert.doesNotMatch(JSON.stringify(env.history), /private|utm_|campaign_/);
  }
});

test("checkout waits at most 600ms, resolves once on callback/fallback, and never accepts metadata callbacks", async () => {
  for (const first of ["callback", "timeout"]) {
    const env = loadMetrics({ saved: JSON.stringify({ analytics: true }) });
    let redirects = 0;
    const checkout = env.window.gcasAnalytics.beginCheckout("couple").then(() => { redirects += 1; });
    assert.equal(redirects, 0);
    const event = env.events().at(-1);
    assert.equal(event[1], "begin_checkout");
    assert.equal(event[2].event_timeout, 500);
    assert.equal(typeof event[2].event_callback, "function");
    const timer = [...env.timers.values()][0];
    assert.equal(timer.delay, 600);
    (first === "callback" ? event[2].event_callback : timer.callback)();
    await checkout;
    assert.equal(redirects, 1);
    event[2].event_callback();
    timer.callback();
    await Promise.resolve();
    assert.equal(redirects, 1);
    assert.equal(env.timers.size, 0);
    env.window.gcasAnalytics.track("begin_checkout", {
      package: "single", event_callback: () => assert.fail("Untrusted callback"), event_timeout: 90000,
    });
    assert.equal(env.events().at(-1)[2].event_callback, undefined);
    assert.equal(env.events().at(-1)[2].event_timeout, undefined);
  }
  const denied = loadMetrics();
  await denied.window.gcasAnalytics.beginCheckout("single");
  assert.equal(denied.timers.size, 0);
  assert.equal(denied.events().length, 0);
  const unknown = loadMetrics({ saved: JSON.stringify({ analytics: true }) });
  const count = unknown.events().length;
  await unknown.window.gcasAnalytics.beginCheckout("unknown");
  assert.equal(unknown.timers.size, 0);
  assert.equal(unknown.events().length, count);
});

test("visible exposures and form starts are once per page; revoke clears queued tracking without replay", () => {
  const env = loadMetrics({ offscreen: true });
  const { gcasConsent, gcasAnalytics } = env.window;
  gcasAnalytics.track("form_start", { form: "application" });
  gcasConsent.save({ analytics: true });
  assert.deepEqual(env.events().map(([, name]) => name), ["page_view"]);
  assert.equal(gcasAnalytics.track("view_item_list"), false);
  assert.equal(gcasAnalytics.track("form_view", { form: "application" }), false);
  env.pricing.rect.top = 10;
  env.pricing.rect.bottom = 100;
  env.observers[0].callback();
  env.observers[0].callback();
  assert.equal(env.events().filter(([, name]) => name === "view_item_list").length, 1);
  assert.equal(gcasAnalytics.track("form_start", { form: "application" }), true);
  assert.equal(gcasAnalytics.track("form_start", { form: "application" }), false);
  assert.equal(gcasAnalytics.track("validation_error", { form: "application", category: "required" }), true);
  assert.equal(gcasAnalytics.track("validation_error", { form: "application", category: "required" }), false);
  gcasConsent.save({ analytics: false });
  assert.equal(env.window["ga-disable-G-9P726CYPGF"], true);
  assert.equal(env.dataLayer.some((command) => command[0] === "event"), false);
  assert.equal(gcasAnalytics.track("begin_checkout", { package: "premium" }), false);
  env.application.rect.top = 10;
  env.application.rect.bottom = 100;
  env.observers[0].callback();
  env.application.rect.top = 1000;
  env.application.rect.bottom = 1100;
  const previousCount = env.events().length;
  gcasConsent.save({ analytics: true });
  assert.equal(env.events().length, previousCount);
  vm.runInContext(metricsSource, env.context);
  assert.equal(env.events().length, previousCount);
});

test("hidden documents never count exposures, CTA hooks accept only known values", async () => {
  const env = loadMetrics();
  env.document.visibilityState = "hidden";
  env.window.gcasConsent.save({ analytics: true });
  assert.equal(env.events().length, 1);
  env.document.visibilityState = "visible";
  await env.document.emit("visibilitychange");
  assert.equal(env.events().length, 3);
  const cta = new Element({ dataset: { trackCta: "apply", ctaLocation: "hero" } });
  await env.document.emit("click", { target: { closest: () => cta } });
  assert.equal(env.events().at(-1)[1], "cta_click");
  for (const value of ["", "compare-packages", "start-single"]) {
    cta.dataset.trackCta = value;
    await env.document.emit("click", { target: { closest: () => cta } });
    assert.equal(env.events().at(-1)[2].cta_id, value || "navigation");
  }
  cta.dataset.trackCta = "private@example.com";
  const count = env.events().length;
  await env.document.emit("click", { target: { closest: () => cta } });
  assert.equal(env.events().length, count);
});

function loadApp(options = {}) {
  const env = environment({ search: "", ...options });
  const { elements, context, window, document } = env;
  const appForm = new Element();
  const notificationForm = new Element();
  const heading = new Element();
  const summaryName = new Element();
  const summaryPrice = new Element();
  const premiumCount = new Element({ value: "1" });
  const premiumField = new Element();
  const cards = Object.keys(packageData).map((packageSelect) =>
    new Element({ dataset: { packageSelect } }));
  const hero = new Element();
  const heroPause = new Element({ textContent: "Pause photos" });
  const sections = [2, 3].map((number) => {
    const section = new Element({ dataset: { applicantSection: String(number) } });
    section.fields = [new Element(), new Element()];
    section.querySelectorAll = () => section.fields;
    return section;
  });
  const radios = Object.entries(packageData).map(([value, [label, , count]]) => {
    const radio = new Element({ value, dataset: { applicantCount: String(count) } });
    radio.closest = () => ({ querySelector: () => ({ textContent: label }) });
    Object.defineProperty(radio, "checked", {
      get() { return this.isChecked; },
      set(checked) {
        if (checked) radios.forEach((other) => { other.isChecked = false; });
        this.isChecked = checked;
      },
    });
    return radio;
  });
  radios[0].checked = true;
  const fields = new Map([
    ["#intakeForm", appForm], ["#formMessage", new Element()],
    ["#applicationSubmit", new Element()], ["#paymentStatus", new Element({ value: "pending" })],
    ["#premiumCountField", premiumField], ["#premiumApplicantCount", premiumCount],
    ["#identityDocuments", new Element({ files: [] })], ["#fileUploadSelection", new Element()],
    ["#apply", new Element()], ["#applicationFormTitle", heading],
    ["#notifyForm", notificationForm], ["#notifyMessage", new Element()],
    ["#notifySubmit", new Element()],
    [".hero-dashboard", hero], ["[data-hero-pause]", heroPause],
  ]);
  fields.forEach((value, key) => elements.set(key, value));
  const queryOne = document.querySelector;
  document.querySelector = (selector) =>
    selector === 'input[name="package"]:checked' ? radios.find((radio) => radio.checked) : queryOne(selector);
  document.querySelectorAll = (selector) => ({
    'input[name="package"]': radios,
    "[data-applicant-section]": sections,
    "[data-package-name]": [summaryName],
    "[data-package-price]": [summaryPrice],
    "[data-package-select]": cards,
  }[selector] || []);
  const events = [];
  window.gcasAnalytics = {
    track: (event, metadata) => events.push({ event, ...plain(metadata) }),
    beginCheckout: (packageKey) => { events.push({ event: "begin_checkout", package: packageKey }); },
  };
  class File {
    constructor(content, name = "identity.pdf") {
      Object.assign(this, { content, name, size: content.length, type: "application/pdf" });
    }
  }
  context.File = File;
  context.FileReader = class {
    constructor() { this.handlers = {}; }
    addEventListener(name, handler) { this.handlers[name] = handler; }
    readAsDataURL(file) {
      this.result = `data:application/pdf;base64,${Buffer.from(file.content).toString("base64")}`;
      this.handlers.load();
    }
  };
  const values = {
    email: "private@example.com", firstName: "Private", lastName: "Person",
    serviceDisclaimer: "on", policyConsent: "on", contactAuthorization: "on",
    notifyEmail: "private@example.com",
  };
  const snapshots = [];
  context.FormData = class {
    constructor(targetForm) {
      this.values = { ...values };
      if (targetForm === appForm) snapshots.push(radios.map((radio) => radio.disabled));
    }
    get(name) { return this.values[name] || ""; }
    getAll() { return this.values.identityDocument || []; }
  };
  const requests = [];
  context.fetch = (url, options) => {
    const request = { url, options };
    requests.push(request);
    return new Promise((resolve, reject) => Object.assign(request, { resolve, reject }));
  };
  vm.runInContext(appSource, context);
  return { ...env, appForm, notificationForm, heading, summaryName, summaryPrice, premiumCount,
    premiumField, sections, radios, cards, hero, heroPause, events, requests, values, snapshots };
}

test("pricing clicks select all packages, preserve applicant rules, focus and respect reduced motion", async () => {
  const env = loadApp({ reducedMotion: true });
  for (const [key, [label, price, count]] of Object.entries(packageData)) {
    const link = new Element({ dataset: { packageSelect: key } });
    const click = await env.document.emit("click", { target: { closest: () => link } });
    assert.equal(click.defaultPrevented, true);
    assert.equal(env.radios.find((radio) => radio.checked).value, key);
    assert.equal(env.summaryName.textContent, label);
    assert.equal(env.summaryPrice.textContent, `$${price}`);
    env.cards.forEach((card) => {
      const selected = card.dataset.packageSelect === key;
      assert.equal(card.classes.has("is-selected"), selected);
      assert.equal(card.attributes.get("aria-current"), String(selected));
    });
    assert.deepEqual(plain(env.heading.focusOptions), { preventScroll: true });
    assert.equal(env.elements.get("#apply").scrollOptions.behavior, "instant");
    assert.equal(env.premiumField.hidden, key !== "premium");
    env.sections.forEach((section, index) => {
      assert.equal(section.hidden, index + 2 > count);
      assert.equal(section.fields[0].required, index + 2 <= count);
    });
  }
  env.premiumCount.value = "3";
  await env.premiumCount.emit("change");
  assert.equal(env.sections.every((section) => !section.hidden && section.fields[0].required), true);
  const unknown = new Element({ dataset: { packageSelect: "__proto__" } });
  await env.document.emit("click", { target: { closest: () => unknown } });
  assert.equal(env.summaryName.textContent, "Premium");
  assert.equal(env.window.redirects.length, 0);
  assert.equal(env.requests.length, 0);
});

test("hero photos can pause and resume with an accessible toggle state", async () => {
  const env = loadApp();
  assert.equal(env.heroPause.attributes.get("aria-pressed"), "false");
  await env.heroPause.emit("click");
  assert.equal(env.heroPause.textContent, "Resume photos");
  assert.equal(env.heroPause.attributes.get("aria-pressed"), "true");
  assert.equal(env.hero.classes.has("is-paused"), true);
  await env.heroPause.emit("click");
  assert.equal(env.heroPause.textContent, "Pause photos");
  assert.equal(env.heroPause.attributes.get("aria-pressed"), "false");
  assert.equal(env.hero.classes.has("is-paused"), false);
});

test("package deep links are allowlisted, initialize summary, and never produce interaction events", async () => {
  for (const path of ["/", "/index", "/index.html"]) {
    const env = loadApp({ pathname: path, search: "?package=couple&email=private@example.com" });
    assert.equal(env.summaryName.textContent, "Couple");
    assert.equal(env.events.length, 0);
    assert.equal(env.elements.get("#apply").scrollOptions.behavior, "smooth");
    env.radios[2].checked = true;
    await env.radios[2].emit("change");
    assert.equal(env.summaryPrice.textContent, "$99");
    assert.deepEqual(env.events.at(-1), { event: "select_item", package: "family" });
  }
  for (const packageKey of ["__proto__", "constructor", "unknown"]) {
    assert.equal(loadApp({ search: `?package=${packageKey}` }).summaryName.textContent, "Single");
  }
  assert.equal(loadApp({ pathname: "/guide", search: "?package=couple" }).summaryName.textContent, "Single");
});

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("dispatch is not a confirmed lead; checkout waits for fetch, uses unchanged prices/links and blocks duplicates", async () => {
  for (const [packageKey, [, , , paymentLink]] of Object.entries(packageData)) {
    const env = loadApp({ search: `?package=${packageKey}` });
    const submission = env.appForm.emit("submit");
    await tick();
    assert.equal(env.requests.length, 1);
    assert.equal(env.requests[0].options.mode, "no-cors");
    assert.equal(env.snapshots.every((snapshot) => snapshot.every((disabled) => !disabled)), true);
    assert.equal(env.radios.every((radio) => radio.disabled), true);
    assert.equal(env.elements.get("#applicationSubmit").textContent, "Sending your preparation request...");
    const payload = JSON.parse(env.requests[0].options.body);
    assert.equal(payload.package, packageKey);
    assert.equal(payload.policyVersion, "2026-09-30");
    assert.equal(payload.email, "private@example.com");
    assert.equal(payload.applicants[0].firstName, "Private");
    assert.equal(payload.stripeClientReferenceId, payload.submissionId);
    assert.equal(env.events.some(({ event }) => event === "request_dispatch"), true);
    assert.equal(env.events.some(({ event }) => event === "begin_checkout"), false);
    assert.equal(env.window.redirects.length, 0);
    await env.appForm.emit("submit");
    assert.equal(env.requests.length, 1);
    env.requests[0].resolve({ type: "opaque" });
    await submission;
    assert.deepEqual(env.events.at(-1), { event: "begin_checkout", package: packageKey });
    const checkout = new URL(env.window.redirects[0]);
    assert.equal(`${checkout.origin}${checkout.pathname}`, paymentLink);
    assert.equal(checkout.searchParams.get("prefilled_email"), "private@example.com");
    assert.equal(checkout.searchParams.get("client_reference_id"), payload.submissionId);
    assert.doesNotMatch(JSON.stringify(env.events), /private|gcas-test|purchase|generate_lead/);
  }
});

test("pending checkout locks cards/radios/count and holds redirect for callback or blocked-tag fallback", async () => {
  for (const completeBy of ["callback", "fallback"]) {
    const env = loadApp({ search: "?package=premium" });
    delete env.window.gcasAnalytics;
    vm.runInContext(metricsSource, env.context);
    env.window.gcasConsent.save({ analytics: true });
    const submission = env.appForm.emit("submit");
    await tick();
    await env.document.emit("click", { target: { closest: (selector) => selector === "[data-package-select]" ? env.cards[0] : null } });
    env.radios[1].checked = true;
    await env.radios[1].emit("change");
    env.premiumCount.value = "3";
    await env.premiumCount.emit("change");
    await env.appForm.emit("input");
    assert.equal(env.radios.find((radio) => radio.checked).value, "premium");
    assert.equal(env.summaryName.textContent, "Premium");
    assert.equal(env.premiumCount.value, "1");
    assert.equal(env.premiumCount.disabled, true);
    assert.equal(env.elements.get("#applicationSubmit").textContent, "Sending your preparation request...");
    assert.equal(JSON.parse(env.requests[0].options.body).package, "premium");
    env.requests[0].resolve({ type: "opaque" });
    await tick();
    assert.equal(env.window.redirects.length, 0);
    assert.equal(env.elements.get("#applicationSubmit").textContent, "Opening secure checkout...");
    await env.appForm.emit("submit");
    assert.equal(env.requests.length, 1);
    const event = env.history.find(([command, name]) => command === "event" && name === "begin_checkout");
    const timer = [...env.timers.values()][0];
    (completeBy === "callback" ? event[2].event_callback : timer.callback)();
    await submission;
    assert.equal(env.window.redirects.length, 1);
    event[2].event_callback();
    timer.callback();
    await tick();
    assert.equal(env.window.redirects.length, 1);
    assert.equal(new URL(env.window.redirects[0]).pathname, new URL(packageData.premium[3]).pathname);
  }
});

test("checkout without analytics redirects immediately after dispatch resolves", async () => {
  for (const metricsPresent of [false, true]) {
    const env = loadApp();
    delete env.window.gcasAnalytics;
    if (metricsPresent) vm.runInContext(metricsSource, env.context);
    const submission = env.appForm.emit("submit");
    await tick();
    assert.equal(env.window.redirects.length, 0);
    env.requests[0].resolve({ type: "opaque" });
    await submission;
    assert.equal(env.window.redirects.length, 1);
    assert.equal(env.timers.size, 0);
  }
});

test("bfcache revisions honor cooldown and dispatch a fresh reference while preserving entered details", async () => {
  const env = loadApp({ search: "?package=couple" });
  const submission = env.appForm.emit("submit");
  await tick();
  env.requests[0].resolve({ type: "opaque" });
  await submission;
  assert.equal(env.elements.get("#applicationSubmit").disabled, true);
  const reference = env.appForm.dataset.submissionId;
  const previousEvents = env.events.length;
  await env.window.emit("pageshow", { persisted: false });
  assert.equal(env.elements.get("#applicationSubmit").disabled, true);
  await env.window.emit("pageshow", { persisted: true });
  assert.equal(env.elements.get("#applicationSubmit").disabled, false);
  assert.equal(env.elements.get("#applicationSubmit").textContent, "Send request & continue to Stripe");
  assert.equal(env.elements.get("#paymentStatus").value, "pending");
  assert.equal(env.radios.every((radio) => !radio.disabled), true);
  assert.equal(env.premiumCount.disabled, false);
  assert.equal(env.cards.every((card) => card.attributes.get("aria-disabled") === "false"), true);
  assert.equal(env.appForm.dataset.submissionId, reference);
  assert.equal(env.values.email, "private@example.com");
  assert.equal(env.events.length, previousEvents);
  assert.match(env.elements.get("#formMessage").textContent, /not confirmed/);
  await env.document.emit("click", { target: { closest: () => env.cards[2] } });
  assert.equal(env.summaryName.textContent, "Family");
  await env.appForm.emit("submit");
  assert.equal(env.requests.length, 1);
  assert.equal(env.window.redirects.length, 1);
  assert.equal(env.appForm.dataset.submissionId, reference);
  assert.match(env.elements.get("#formMessage").textContent, /wait 125 seconds/);
  assert.equal(env.elements.get("#applicationSubmit").disabled, false);
  env.clock.now += 125000;
  const retry = env.appForm.emit("submit");
  await tick();
  assert.equal(env.requests.length, 2);
  const payload = JSON.parse(env.requests[1].options.body);
  assert.equal(payload.package, "family");
  assert.notEqual(payload.submissionId, reference);
  assert.equal(payload.paymentReference, payload.submissionId);
  assert.equal(payload.stripeClientReferenceId, payload.submissionId);
  env.requests[1].resolve({ type: "opaque" });
  await retry;
  assert.equal(env.window.redirects.length, 2);
  assert.equal(new URL(env.window.redirects[1]).pathname, new URL(packageData.family[3]).pathname);
  assert.equal(new URL(env.window.redirects[1]).searchParams.get("client_reference_id"), payload.submissionId);
  assert.equal(env.events.some(({ event }) => event === "purchase"), false);
});

test("unchanged bfcache retry preserves reference and reopens Stripe without duplicate dispatch", async () => {
  const env = loadApp();
  const first = env.appForm.emit("submit");
  await tick();
  env.requests[0].resolve({ type: "opaque" });
  await first;
  const reference = env.appForm.dataset.submissionId;
  await env.window.emit("pageshow", { persisted: true });
  assert.match(env.elements.get("#formMessage").textContent, /before paying again/);
  await env.appForm.emit("submit");
  assert.equal(env.requests.length, 1);
  assert.equal(env.window.redirects.length, 2);
  assert.equal(env.appForm.dataset.submissionId, reference);
  assert.equal(env.events.filter(({ event }) => event === "request_dispatch").length, 1);
  assert.match(env.elements.get("#formMessage").textContent, /without resending/);
});

test("applicant, consent and upload content revisions receive new references after cooldown", async () => {
  const changes = [
    (env) => { env.values.firstName = "Revised"; },
    (env) => { env.values.applicant2LastName = "Revised"; },
    (env) => { env.values.marketingConsent = "on"; },
    (env) => { env.values.identityDocument = [new env.context.File("other")]; },
  ];
  for (const revise of changes) {
    const env = loadApp({ search: "?package=couple" });
    env.values.identityDocument = [new env.context.File("first")];
    const first = env.appForm.emit("submit");
    await tick();
    env.requests[0].resolve({ type: "opaque" });
    await first;
    const original = JSON.parse(env.requests[0].options.body);
    await env.window.emit("pageshow", { persisted: true });
    revise(env);
    await env.appForm.emit("submit");
    assert.equal(env.requests.length, 1);
    assert.equal(env.window.redirects.length, 1);
    env.clock.now += 125000;
    const retry = env.appForm.emit("submit");
    await tick();
    assert.equal(env.requests.length, 2);
    const revised = JSON.parse(env.requests[1].options.body);
    assert.notEqual(revised.submissionId, original.submissionId);
    env.requests[1].resolve({ type: "opaque" });
    await retry;
    assert.equal(new URL(env.window.redirects[1]).searchParams.get("client_reference_id"), revised.submissionId);
    assert.equal(env.storageWrites.length, 0);
    assert.doesNotMatch(JSON.stringify(env.events), /Revised|identity.pdf|private/);
  }
});

test("validation and rejected requests retain failure UI and do not begin checkout", async () => {
  const env = loadApp();
  env.appForm.valid = false;
  await env.appForm.emit("invalid", { target: { validity: { valueMissing: true } } });
  await env.appForm.emit("submit");
  assert.equal(env.requests.length, 0);
  assert.equal(env.appForm.reported, true);
  assert.equal(env.events[0].category, "required");
  env.appForm.valid = true;
  const submission = env.appForm.emit("submit");
  await tick();
  env.requests[0].reject(new Error("Network unavailable"));
  await submission;
  assert.equal(env.elements.get("#formMessage").textContent, "Network unavailable");
  assert.equal(env.elements.get("#applicationSubmit").disabled, false);
  assert.equal(env.elements.get("#applicationSubmit").textContent, "Send request & continue to Stripe");
  assert.equal(env.radios.every((radio) => !radio.disabled), true);
  assert.equal(env.premiumCount.disabled, false);
  assert.equal(env.elements.get("#paymentStatus").value, "pending");
  assert.equal(env.events.some(({ event }) => event === "begin_checkout"), false);
  assert.equal(env.window.redirects.length, 0);
});

test("notification dispatch distinguishes missing contact and network failure without confirming lead", async () => {
  const env = loadApp();
  env.values.notifyEmail = "";
  await env.notificationForm.emit("submit");
  assert.equal(env.requests.length, 0);
  assert.deepEqual(env.events.at(-1), {
    event: "validation_error", form: "notification", category: "contact_required",
  });
  env.values.notifyEmail = "private@example.com";
  const submission = env.notificationForm.emit("submit");
  await tick();
  await env.notificationForm.emit("submit");
  assert.equal(env.requests.length, 1);
  assert.deepEqual(env.events.find(({ event }) => event === "request_dispatch"), {
    event: "request_dispatch", form: "notification",
  });
  env.requests[0].reject(new Error("Notification network unavailable"));
  await submission;
  assert.equal(env.elements.get("#notifyMessage").textContent, "Notification network unavailable");
  assert.equal(env.elements.get("#notifySubmit").disabled, false);
  const retry = env.notificationForm.emit("submit");
  await tick();
  env.requests[1].resolve({ type: "opaque" });
  await retry;
  assert.match(env.elements.get("#notifyMessage").textContent, /cannot be confirmed/);
  assert.doesNotMatch(JSON.stringify(env.events), /private|purchase|generate_lead/);
});
