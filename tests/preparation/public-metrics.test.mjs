import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const packageData = {
  single: ["Single", 9.99],
  couple: ["Couple", 19.99],
  family: ["Family", 29.99],
  premium: ["Premium", 39.99],
};
const metricsSource = readFileSync(
  new URL("../../assets/site-metrics.js", import.meta.url),
  "utf8",
);

class Element {
  constructor(properties = {}) {
    Object.assign(
      this,
      {
        dataset: {},
        listeners: new Map(),
        children: [],
        value: "",
        hidden: false,
        textContent: "",
        disabled: false,
        required: false,
        rect: {
          top: 10,
          bottom: 110,
          left: 10,
          right: 310,
          width: 300,
          height: 100,
        },
      },
      properties,
    );
    this.classes = new Set();
    this.attributes = new Map();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      toggle: (name, active) =>
        active ? this.classes.add(name) : this.classes.delete(name),
    };
  }
  addEventListener(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
  }
  async emit(type, properties = {}) {
    const event = {
      target: this,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...properties,
    };
    for (const handler of this.listeners.get(type) || []) await handler(event);
    return event;
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
  append(...children) {
    this.children.push(...children);
  }
  contains(element) {
    return (
      this === element || this.children.some((child) => child.contains(element))
    );
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  getBoundingClientRect() {
    return this.rect;
  }
  getClientRects() {
    return this.hidden ? [] : [this.rect];
  }
  focus(options) {
    this.focusOptions = options;
  }
  scrollIntoView(options) {
    this.scrollOptions = options;
  }
  checkValidity() {
    return this.valid !== false;
  }
  reportValidity() {
    this.reported = true;
  }
}

const plain = (value) => JSON.parse(JSON.stringify(value));

function environment({
  saved = null,
  storageFails = false,
  pathname = "/",
  search = "?email=private@example.com",
  reducedMotion = false,
} = {}) {
  const document = new Element({
    readyState: "complete",
    visibilityState: "visible",
    body: new Element(),
  });
  const elements = new Map();
  document.createElement = () => new Element();
  document.createElementNS = () => new Element();
  document.querySelector = (selector) => elements.get(selector) || null;
  const history = [];
  const storageWrites = [];
  const timers = new Map();
  const intervals = new Map();
  let timerId = 0;
  let referenceId = 0;
  const clock = { now: Date.now() };
  class ClockDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [clock.now]));
    }
    static now() {
      return clock.now;
    }
  }
  const dataLayer = [];
  dataLayer.push = (...commands) => {
    history.push(...commands.map((command) => Array.from(command)));
    return Array.prototype.push.apply(dataLayer, commands);
  };
  const window = new Element({
    dataLayer,
    location: {
      origin: "https://example.test",
      pathname,
      search,
      hash: "#private-hash",
      hostname: "example.test",
      assign(url) {
        window.redirects.push(url);
      },
    },
    innerHeight: 800,
    innerWidth: 1200,
    scrollY: 0,
    redirects: [],
    matchMedia: () => ({ matches: reducedMotion, addEventListener() {} }),
    Image: class {
      complete = true;
      naturalWidth = 1200;
    },
    getComputedStyle: (element) => element.computedStyle,
    requestIdleCallback() {},
    clearInterval(id) {
      intervals.delete(id);
    },
    setInterval(callback, delay) {
      intervals.set(++timerId, { callback, delay });
      return timerId;
    },
    setTimeout(callback, delay) {
      timers.set(++timerId, { callback, delay });
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    crypto: { randomUUID: () => `test-reference-${++referenceId}` },
    localStorage: {
      getItem() {
        if (storageFails) throw new Error("Storage blocked");
        return saved;
      },
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
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe() {}
  }
  window.IntersectionObserver = IntersectionObserver;
  const context = vm.createContext({
    window,
    document,
    IntersectionObserver,
    URL,
    URLSearchParams,
    console,
    Date: ClockDate,
    fetch() {
      throw new Error("Unexpected network request");
    },
  });
  return {
    window,
    document,
    context,
    history,
    dataLayer,
    elements,
    observers,
    storageWrites,
    timers,
    intervals,
    clock,
  };
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
  assert.equal(
    gcasAnalytics.track("select_item", { package: "single" }),
    false,
  );
  assert.equal(env.events().length, 0);
  assert.equal(
    env.history.some(([command]) => command === "config"),
    false,
  );
  gcasConsent.save({ analytics: "true", advertising: 1 });
  assert.equal(gcasConsent.get().analytics, false);
  gcasConsent.save({ analytics: true });
  assert.equal(gcasConsent.get().analytics, true);
  gcasConsent.get().analytics = false;
  assert.equal(gcasConsent.get().analytics, true);
  assert.deepEqual(
    env.events().map(([, event]) => event),
    ["page_view", "view_item_list", "form_view"],
  );
  assert.equal(
    env.events().some(([, event]) => event === "select_item"),
    false,
  );
  assert.equal(env.window["ga-disable-G-9P726CYPGF"], false);
});

test("strict event and item allowlists discard arbitrary metadata and personal values", () => {
  const env = loadMetrics({ saved: JSON.stringify({ analytics: true }) });
  const { track } = env.window.gcasAnalytics;
  const sensitive = {
    email: "private@example.com",
    name: "Private Person",
    phone: "+123456789",
    country: "Private country",
    files: ["private.pdf"],
    submissionId: "private-id",
    page_location: "https://example.test/?email=private@example.com",
    page_referrer: "https://private.test/",
    items: [{ item_id: "unknown", price: 999 }],
    value: 999,
    currency: "SECRET",
  };
  for (const event of [
    "purchase",
    "generate_lead",
    "form_submit",
    "unknown",
    "__proto__",
  ]) {
    assert.equal(track(event, sensitive), false);
  }
  for (const item of [
    "unknown",
    "__proto__",
    "constructor",
    "",
    null,
    {},
    ["single"],
  ]) {
    assert.equal(track("select_item", { package: item }), false);
    assert.equal(track("begin_checkout", { package: item }), false);
  }
  assert.equal(track("form_start", { form: "private@example.com" }), false);
  assert.equal(
    track("validation_error", { form: "application", category: "private.pdf" }),
    false,
  );
  assert.equal(
    track("cta_click", { cta: "apply", location: "private@example.com" }),
    false,
  );
  assert.equal(track("select_item", null), false);
  for (const [key, [label, price]] of Object.entries(packageData)) {
    assert.equal(track("begin_checkout", { ...sensitive, package: key }), true);
    const parameters = env.events().at(-1)[2];
    assert.deepEqual(plain(parameters.items), [
      { item_id: key, item_name: label, price, quantity: 1 },
    ]);
    assert.equal(parameters.value, price);
    assert.equal(parameters.currency, "USD");
    assert.equal(parameters.page_location, "https://example.test/");
    assert.equal(parameters.page_referrer, "");
  }
  assert.doesNotMatch(JSON.stringify(env.history), /private|SECRET|999/);
  const config = env.history.find(
    ([command, id]) => command === "config" && id.startsWith("G-"),
  )[2];
  assert.equal(config.send_page_view, false);
  assert.equal(config.form_interactions, false);
  assert.equal(config.enhanced_measurement, false);
  assert.equal(
    env.history.find(([command]) => command === "set")[1].url_passthrough,
    false,
  );
});

test("support events use consent-gated fixed channels without URLs or contact details", () => {
  const env = loadMetrics();
  assert.equal(env.window.gcasAnalytics.track("support_open"), false);
  env.window.gcasConsent.save({ analytics: true });
  assert.equal(
    env.window.gcasAnalytics.track("support_action", {
      channel: "private@example.com",
    }),
    false,
  );
  for (const channel of ["email", "whatsapp", "faq", "instagram"]) {
    assert.equal(
      env.window.gcasAnalytics.track("support_action", {
        channel,
        url: "https://private.test",
        phone: "+12345678",
      }),
      true,
    );
    assert.equal(env.events().at(-1)[2].support_channel, channel);
  }
  assert.doesNotMatch(JSON.stringify(env.history), /private|12345678/);
  assert.equal(env.window.gcasAnalytics.track("application_start"), false);
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
      for (const name of [
        "dv-preparation",
        "photo-checklist",
        "family-guide",
      ]) {
        const env = loadMetrics({
          search: `?utm_source=${source}&utm_medium=${medium}&utm_campaign=${name}&utm_content=private@example.com&gclid=private-click-id`,
        });
        assert.equal(
          env.history.some(([command]) => command === "config"),
          false,
        );
        assert.doesNotMatch(JSON.stringify(env.history), /campaign_|private/);
        env.window.gcasConsent.save({ analytics: true, advertising: true });
        const config = env.history.find(
          ([command, id]) => command === "config" && id.startsWith("G-"),
        )[2];
        assert.equal(config.campaign_source, source);
        assert.equal(config.campaign_medium, medium);
        assert.equal(config.campaign_name, name);
        assert.doesNotMatch(JSON.stringify(env.history), /private|utm_|gclid/);
        assert.doesNotMatch(
          JSON.stringify(env.storageWrites),
          /campaign|newsletter|google|facebook|instagram|private/,
        );
        const adConfig = env.history.find(
          ([command, id]) => command === "config" && id.startsWith("AW-"),
        )[2];
        assert.equal(adConfig.conversion_linker, false);
        assert.equal(adConfig.url_passthrough, false);
        assert.equal(
          Object.keys(adConfig).some((key) => key.startsWith("campaign_")),
          false,
        );
        assert.equal(
          env.history.find(([command]) => command === "set")[1]
            .conversion_linker,
          false,
        );
        assert.equal(
          env
            .events()
            .some(([, , metadata]) =>
              Object.keys(metadata).some((key) => key.startsWith("campaign_")),
            ),
          false,
        );
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
    const env = loadMetrics({
      search,
      saved: JSON.stringify({ analytics: true }),
    });
    const config = env.history.find(
      ([command, id]) => command === "config" && id.startsWith("G-"),
    )[2];
    assert.equal(
      Object.keys(config).some((key) => key.startsWith("campaign_")),
      false,
    );
    assert.doesNotMatch(JSON.stringify(env.history), /private|utm_|campaign_/);
  }
});

test("checkout waits at most 600ms, resolves once on callback/fallback, and never accepts metadata callbacks", async () => {
  for (const first of ["callback", "timeout"]) {
    const env = loadMetrics({ saved: JSON.stringify({ analytics: true }) });
    let redirects = 0;
    const checkout = env.window.gcasAnalytics
      .beginCheckout("couple")
      .then(() => {
        redirects += 1;
      });
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
      package: "single",
      event_callback: () => assert.fail("Untrusted callback"),
      event_timeout: 90000,
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
  assert.deepEqual(
    env.events().map(([, name]) => name),
    ["page_view"],
  );
  assert.equal(gcasAnalytics.track("view_item_list"), false);
  assert.equal(
    gcasAnalytics.track("form_view", { form: "application" }),
    false,
  );
  env.pricing.rect.top = 10;
  env.pricing.rect.bottom = 100;
  env.observers[0].callback();
  env.observers[0].callback();
  assert.equal(
    env.events().filter(([, name]) => name === "view_item_list").length,
    1,
  );
  assert.equal(
    gcasAnalytics.track("form_start", { form: "application" }),
    true,
  );
  assert.equal(
    gcasAnalytics.track("form_start", { form: "application" }),
    false,
  );
  assert.equal(
    gcasAnalytics.track("validation_error", {
      form: "application",
      category: "required",
    }),
    true,
  );
  assert.equal(
    gcasAnalytics.track("validation_error", {
      form: "application",
      category: "required",
    }),
    false,
  );
  gcasConsent.save({ analytics: false });
  assert.equal(env.window["ga-disable-G-9P726CYPGF"], true);
  assert.equal(
    env.dataLayer.some((command) => command[0] === "event"),
    false,
  );
  assert.equal(
    gcasAnalytics.track("begin_checkout", { package: "premium" }),
    false,
  );
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
  const cta = new Element({
    dataset: { trackCta: "apply", ctaLocation: "hero" },
  });
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
