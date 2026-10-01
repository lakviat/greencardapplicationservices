import fs from "node:fs";
import path from "node:path";

const defaultBaseUrl = "https://greencardapplicationservices.com";
const productionOrigin = new URL(defaultBaseUrl).origin;
const expectedStripeUrls = [
  "https://buy.stripe.com/9B614p5JI4SH6xNd0U0Ny05",
  "https://buy.stripe.com/28E28t5JI4SH1dt1ic0Ny06",
  "https://buy.stripe.com/eVqbJ34FE98X6xN6Cw0Ny07",
  "https://buy.stripe.com/cNiaEZ2xw1Gv4pFd0U0Ny08",
];

function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeText(value) {
  return decodeEntities(String(value).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function parseArguments(argv) {
  const args = [...argv];
  let baseUrl = defaultBaseUrl;
  if (args[0] && !args[0].startsWith("--")) baseUrl = args.shift();
  let attempts = 12;
  let delaySeconds = 30;
  let allowStale = false;
  while (args.length) {
    const argument = args.shift();
    if (argument === "--allow-stale") {
      allowStale = true;
      continue;
    }
    if (!["--attempts", "--delay"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const rawValue = args.shift();
    if (!rawValue) throw new Error(`Missing value for ${argument}`);
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${argument} must be a positive integer`);
    if (argument === "--attempts") attempts = parsed;
    if (argument === "--delay") delaySeconds = parsed;
  }
  return { allowStale, attempts, baseUrl: new URL(baseUrl), delaySeconds };
}

function assetVersionsFrom(html) {
  const assets = ["assets/styles.css", "assets/site-metrics.js", "assets/app.js"];
  const versions = {};
  for (const asset of assets) {
    const match = html.match(new RegExp(`${asset.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\?v=([^"']+)`, "i"));
    versions[asset] = match?.[1] || null;
  }
  return versions;
}

function diffVersions(expected, actual) {
  return Object.keys(expected)
    .filter((asset) => expected[asset] !== actual[asset])
    .map((asset) => `${asset}: expected ${expected[asset] || "missing"}, got ${actual[asset] || "missing"}`);
}

function h1From(html) {
  return normalizeText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
}

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function request(url, { method = "GET", expectText = false } = {}) {
  const response = await fetch(url, {
    method,
    headers: { "Cache-Control": "no-cache" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  const text = expectText ? await response.text() : null;
  return { response, text };
}

function assertIncludes(haystack, needle, message, failures) {
  if (!haystack.includes(needle)) failures.push(message);
}

function rewriteToBase(urlValue, baseUrl) {
  const parsed = new URL(urlValue, baseUrl);
  if (parsed.origin === productionOrigin) {
    return new URL(`${parsed.pathname}${parsed.search}`, baseUrl);
  }
  return parsed;
}

async function mapLimit(items, limit, callback) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await callback(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function validateHome(baseUrl, localExpectations, attempts, delaySeconds, allowStale) {
  let lastFailures = [];
  let lastHtml = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const failures = [];
    const homeUrl = new URL(`/?smoke=${Date.now()}-${attempt}`, baseUrl);
    try {
      const { response, text } = await request(homeUrl, { expectText: true });
      lastHtml = text || "";
      if (response.status !== 200) failures.push(`home page returned HTTP ${response.status}`);
      if (!String(response.headers.get("content-type") || "").includes("text/html")) {
        failures.push(`home page content-type must include text/html (got ${response.headers.get("content-type") || "missing"})`);
      }
      const liveH1 = h1From(lastHtml);
      if (liveH1 !== localExpectations.h1) {
        failures.push(`home page h1 mismatch: expected "${localExpectations.h1}", got "${liveH1 || "missing"}"`);
      }
      for (const price of ["$24", "$44", "$64", "$94"]) {
        assertIncludes(lastHtml, price, `home page is missing ${price}`, failures);
      }
      if (!/<meta\s+http-equiv=["']Content-Security-Policy["']/i.test(lastHtml)) {
        failures.push("home page is missing the CSP meta tag");
      }
      const liveVersions = assetVersionsFrom(lastHtml);
      const versionDiffs = diffVersions(localExpectations.assetVersions, liveVersions);
      if (!allowStale && versionDiffs.length) failures.push(...versionDiffs.map((entry) => `asset version mismatch: ${entry}`));
      console.log(`Attempt ${attempt}/${attempts}: ${failures.length ? failures.join("; ") : allowStale ? "home page checks passed (stale assets allowed)" : "home page checks passed"}`);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
      console.log(`Attempt ${attempt}/${attempts}: ${failures.join("; ")}`);
    }
    if (!failures.length) return lastHtml;
    lastFailures = failures;
    if (attempt < attempts) await sleep(delaySeconds);
  }
  throw new Error(`Smoke test failed after ${attempts} attempts:\n- ${lastFailures.join("\n- ")}`);
}

async function main() {
  const { allowStale, attempts, baseUrl, delaySeconds } = parseArguments(process.argv.slice(2));
  if (["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname) && baseUrl.protocol === "https:") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const localIndex = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  const localExpectations = {
    assetVersions: assetVersionsFrom(localIndex),
    h1: h1From(localIndex),
  };
  if (!localExpectations.h1) throw new Error("Local index.html is missing an <h1>");

  const liveHtml = await validateHome(baseUrl, localExpectations, attempts, delaySeconds, allowStale);
  const failures = [];

  const { response: sitemapResponse, text: sitemapText } = await request(new URL("/sitemap.xml", baseUrl), { expectText: true });
  if (sitemapResponse.status !== 200) failures.push(`/sitemap.xml returned HTTP ${sitemapResponse.status}`);
  const sitemapUrls = [...(sitemapText || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  if (!sitemapUrls.length) failures.push("/sitemap.xml does not contain any <loc> entries");
  const sitemapChecks = await mapLimit(sitemapUrls, 4, async (entry) => {
    const targetUrl = rewriteToBase(entry, baseUrl);
    const { response } = await request(targetUrl, { method: "HEAD" });
    return response.status === 200 ? null : `${targetUrl.href} returned HTTP ${response.status}`;
  });
  failures.push(...sitemapChecks.filter(Boolean));

  const { response: robotsResponse, text: robotsText } = await request(new URL("/robots.txt", baseUrl), { expectText: true });
  if (robotsResponse.status !== 200) failures.push(`/robots.txt returned HTTP ${robotsResponse.status}`);
  const robots = robotsText || "";
  if (!robots.includes("sitemap.xml")) failures.push("/robots.txt does not reference sitemap.xml");

  const ogImageValue = liveHtml.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1];
  if (!ogImageValue) {
    failures.push("home page is missing og:image");
  } else {
    const ogImageUrl = rewriteToBase(ogImageValue, baseUrl);
    const { response, buffer } = await (async () => {
      const imageResponse = await fetch(ogImageUrl, {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      return { buffer: imageBuffer, response: imageResponse };
    })();
    if (response.status !== 200) failures.push(`og:image returned HTTP ${response.status}`);
    if (!String(response.headers.get("content-type") || "").startsWith("image/")) {
      failures.push(`og:image content-type must be image/* (got ${response.headers.get("content-type") || "missing"})`);
    }
    if (buffer.length > 300000) failures.push(`og:image is ${buffer.length} bytes, over 300000 bytes`);
  }

  const { response: cssResponse } = await request(new URL("/assets/styles.css", baseUrl));
  if (cssResponse.status !== 200) failures.push(`/assets/styles.css returned HTTP ${cssResponse.status}`);
  if (!String(cssResponse.headers.get("content-type") || "").includes("text/css")) {
    failures.push(`/assets/styles.css content-type must include text/css (got ${cssResponse.headers.get("content-type") || "missing"})`);
  }

  const { response: jsResponse, text: appJs } = await request(new URL("/assets/app.js", baseUrl), { expectText: true });
  if (jsResponse.status !== 200) failures.push(`/assets/app.js returned HTTP ${jsResponse.status}`);
  if (!String(jsResponse.headers.get("content-type") || "").toLowerCase().includes("javascript")) {
    failures.push(`/assets/app.js content-type must include javascript (got ${jsResponse.headers.get("content-type") || "missing"})`);
  }
  for (const stripeUrl of expectedStripeUrls) {
    assertIncludes(appJs || "", stripeUrl, `live /assets/app.js is missing Stripe URL ${stripeUrl}`, failures);
  }

  if (failures.length) {
    console.error("Smoke test failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
    process.exit(1);
  }

  console.log(`Smoke test passed for ${baseUrl.href}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
