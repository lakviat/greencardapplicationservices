import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const origin = "https://greencardapplicationservices.com";
const ignoredDirectories = new Set([".git", "node_modules"]);
const stalePricePattern = /\$(39|69|99|149)\b/g;
const expectedStripeUrls = [
  "https://buy.stripe.com/9B614p5JI4SH6xNd0U0Ny05",
  "https://buy.stripe.com/28E28t5JI4SH1dt1ic0Ny06",
  "https://buy.stripe.com/eVqbJ34FE98X6xN6Cw0Ny07",
  "https://buy.stripe.com/cNiaEZ2xw1Gv4pFd0U0Ny08",
];
// Public path => phrase that should remain visible in page metadata or early main copy.
const PAGE_KEYWORDS = {
  "/": "dv lottery",
  "/common-mistakes.html": "mistakes",
  "/dv-lottery-costs.html": "costs",
  "/dv-lottery-dates-status.html": "status check",
  "/eligible-countries.html": "eligible",
  "/faq.html": "questions",
  "/green-card-lottery-kazakhstan.html": "kazakhstan",
  "/green-card-lottery-kyrgyzstan.html": "kyrgyzstan",
  "/green-card-lottery-tajikistan.html": "tajikistan",
  "/green-card-lottery-uzbekistan.html": "uzbekistan",
  "/guide.html": "guide",
  "/how-it-works.html": "how it works",
  "/language-country-support.html": "language",
  "/living-in-usa.html": "living in the u.s.",
  "/married-couples.html": "married couples",
  "/policies": "policies",
  "/requirements.html": "photo",
  "/resources.html": "guides",
};

const htmlFiles = [];
const failures = [];
const seenTitles = new Map();
const seenDescriptions = new Map();
const entityMap = new Map([
  ["amp", "&"],
  ["apos", "'"],
  ["gt", ">"],
  ["lt", "<"],
  ["nbsp", " "],
  ["quot", '"'],
]);

function collectHtmlFiles(directory, relativeDirectory = "") {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectHtmlFiles(absolutePath, relativePath);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      htmlFiles.push(relativePath.replace(/\\/g, "/"));
    }
  }
}

function decodeEntities(value) {
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, token) => {
    const lower = token.toLowerCase();
    if (entityMap.has(lower)) return entityMap.get(lower);
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return `&${token};`;
  });
}

function stripMarkup(value) {
  return decodeEntities(String(value).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function blocks(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "gi"))].map((match) => match[1]);
}

function getAttribute(tag, attribute) {
  return tag.match(new RegExp(`${attribute}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"))?.[2] ?? null;
}

function attrEquals(tag, attribute, expected) {
  return getAttribute(tag, attribute)?.toLowerCase() === expected.toLowerCase();
}

function getMetaContent(html, attribute, value) {
  return tags(html, "meta")
    .filter((tag) => attrEquals(tag, attribute, value))
    .map((tag) => getAttribute(tag, "content"))
    .filter(Boolean);
}

function getCanonicalLinks(html) {
  return tags(html, "link")
    .filter((tag) => (getAttribute(tag, "rel") || "").toLowerCase().split(/\s+/).includes("canonical"))
    .map((tag) => getAttribute(tag, "href"))
    .filter(Boolean);
}

function toPublicPath(file) {
  if (file === "index.html") return "/";
  if (file.endsWith("/index.html")) {
    return `/${file.slice(0, -"/index.html".length)}`;
  }
  return `/${file}`;
}

function allowedCanonicalPaths(file) {
  const publicPath = toPublicPath(file);
  if (publicPath === "/") return ["/"];
  return file.endsWith("/index.html") ? [publicPath, `${publicPath}/`] : [publicPath];
}

function sitemapPathToFile(urlValue) {
  const url = new URL(urlValue);
  const pathname = url.pathname;
  if (pathname === "/") return "index.html";
  if (pathname.endsWith("/")) return `${pathname.slice(1)}index.html`;
  return path.extname(pathname) ? pathname.slice(1) : `${pathname.slice(1)}/index.html`;
}

function recordUnique(map, label, value, file) {
  const key = value.toLowerCase();
  const previous = map.get(key);
  if (previous && previous !== file) {
    failures.push(`${file}: duplicate ${label} also used by ${previous}`);
    return;
  }
  map.set(key, file);
}

function validateSocialImages(file, imageEntries) {
  const groups = new Map();
  for (const [label, value] of imageEntries) {
    if (!value) {
      failures.push(`${file}: missing ${label}`);
      continue;
    }
    const key = value.trim();
    const existing = groups.get(key);
    if (existing) existing.labels.push(label);
    else groups.set(key, { labels: [label], value: key });
  }

  for (const { labels, value } of groups.values()) {
    let url;
    try {
      url = new URL(value, origin);
    } catch {
      failures.push(`${file}: ${labels.join("/")} is not a valid URL (${value})`);
      continue;
    }
    if (url.origin !== origin || !url.pathname.startsWith("/assets/")) {
      failures.push(`${file}: ${labels.join("/")} must point to a local ${origin}/assets/... file`);
      continue;
    }
    const localPath = path.join(root, url.pathname.slice(1));
    if (!fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) {
      failures.push(`${file}: ${labels.join("/")} file is missing (${url.pathname.slice(1)})`);
      continue;
    }
    const size = fs.statSync(localPath).size;
    if (size > 300000) {
      failures.push(`${file}: ${labels.join("/")} file is ${size} bytes (${url.pathname.slice(1)}), over 300000 bytes`);
    }
  }
}

function mainText(html) {
  const [main = ""] = blocks(html, "main");
  return stripMarkup(main).slice(0, 1500);
}

function hasPhrase(value, phrase) {
  return value.toLowerCase().includes(phrase.toLowerCase());
}

collectHtmlFiles(root);
htmlFiles.sort();

const sitemapFile = path.join(root, "sitemap.xml");
const sitemap = fs.existsSync(sitemapFile) ? fs.readFileSync(sitemapFile, "utf8") : "";
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
const sitemapSet = new Set(sitemapUrls);
if (!sitemapUrls.length) failures.push("sitemap.xml: missing <loc> entries");
for (const sitemapUrl of sitemapUrls) {
  let parsed;
  try {
    parsed = new URL(sitemapUrl);
  } catch {
    failures.push(`sitemap.xml: invalid <loc> URL (${sitemapUrl})`);
    continue;
  }
  if (parsed.origin !== origin) {
    failures.push(`sitemap.xml: <loc> must use ${origin} (${sitemapUrl})`);
    continue;
  }
  const mappedFile = sitemapPathToFile(sitemapUrl);
  if (!fs.existsSync(path.join(root, mappedFile))) {
    failures.push(`sitemap.xml: ${sitemapUrl} does not map to an existing file (${mappedFile})`);
  }
}

const appJs = fs.readFileSync(path.join(root, "assets/app.js"), "utf8");
for (const stripeUrl of expectedStripeUrls) {
  if (!appJs.includes(stripeUrl)) failures.push(`assets/app.js: missing Stripe payment link ${stripeUrl}`);
}

const heroDirectory = path.join(root, "assets/images/hero");
for (const entry of fs.readdirSync(heroDirectory, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const relativePath = `assets/images/hero/${entry.name}`;
  const size = fs.statSync(path.join(heroDirectory, entry.name)).size;
  if (size > 150000) failures.push(`${relativePath}: ${size} bytes exceeds 150000-byte budget`);
}
for (const [relativePath, limit] of [["assets/styles.css", 140000], ["assets/app.js", 90000]]) {
  const size = fs.statSync(path.join(root, relativePath)).size;
  if (size > limit) failures.push(`${relativePath}: ${size} bytes exceeds ${limit}-byte budget`);
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  const publicPath = toPublicPath(file);
  const titleBlocks = blocks(html, "title").map(stripMarkup).filter(Boolean);
  if (titleBlocks.length !== 1) {
    failures.push(`${file}: expected exactly one <title>, found ${titleBlocks.length}`);
  }
  const title = titleBlocks[0] || "";
  if (title && (title.length < 20 || title.length > 70)) {
    failures.push(`${file}: <title> length ${title.length} must be between 20 and 70 characters`);
  }
  if (title) recordUnique(seenTitles, "title", title, file);

  const descriptions = getMetaContent(html, "name", "description").map(stripMarkup);
  if (descriptions.length !== 1) {
    failures.push(`${file}: expected exactly one meta description, found ${descriptions.length}`);
  }
  const description = descriptions[0] || "";
  if (description && (description.length < 70 || description.length > 165)) {
    failures.push(`${file}: meta description length ${description.length} must be between 70 and 165 characters`);
  }
  if (description) recordUnique(seenDescriptions, "meta description", description, file);

  const h1Blocks = blocks(html, "h1").map(stripMarkup).filter(Boolean);
  if (h1Blocks.length !== 1) failures.push(`${file}: expected exactly one <h1>, found ${h1Blocks.length}`);
  const h1 = h1Blocks[0] || "";

  const canonicals = getCanonicalLinks(html);
  if (canonicals.length !== 1) {
    failures.push(`${file}: expected exactly one canonical link, found ${canonicals.length}`);
  } else {
    try {
      const canonical = new URL(canonicals[0]);
      if (canonical.protocol !== "https:" || canonical.origin !== origin) {
        failures.push(`${file}: canonical must use ${origin}`);
      }
      if (!allowedCanonicalPaths(file).includes(canonical.pathname)) {
        failures.push(`${file}: canonical path ${canonical.pathname} does not match ${publicPath}`);
      }
      if (!sitemapSet.has(canonical.href)) {
        failures.push(`${file}: canonical URL is missing from sitemap.xml`);
      }
    } catch {
      failures.push(`${file}: canonical must be an absolute URL`);
    }
  }

  for (const [attribute, value] of [["property", "og:title"], ["property", "og:description"], ["property", "og:image"], ["name", "twitter:card"], ["name", "twitter:image"]]) {
    if (!getMetaContent(html, attribute, value).length) failures.push(`${file}: missing ${value} metadata`);
  }
  validateSocialImages(file, [
    ["og:image", getMetaContent(html, "property", "og:image")[0]],
    ["twitter:image", getMetaContent(html, "name", "twitter:image")[0]],
  ]);
  for (const property of ["og:image:width", "og:image:height"]) {
    for (const value of getMetaContent(html, "property", property)) {
      if (!/^\d+$/.test(value.trim())) failures.push(`${file}: ${property} must be an integer (${value})`);
    }
  }

  const viewportTags = getMetaContent(html, "name", "viewport");
  if (!viewportTags.length || !viewportTags.some((value) => /(^|[\s,])width\s*=\s*device-width([\s,]|$)/i.test(value))) {
    failures.push(`${file}: missing viewport meta with width=device-width`);
  }
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || "";
  if (!getAttribute(htmlTag, "lang")) failures.push(`${file}: <html> must include a lang attribute`);

  for (const [index, rawJson] of blocks(html, "script").entries()) {
    const tag = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)][index]?.[0] || "";
    if (!attrEquals(tag, "type", "application/ld+json")) continue;
    try {
      const parsed = JSON.parse(rawJson.trim());
      const hasContext = Array.isArray(parsed)
        ? parsed.every((entry) => entry && typeof entry === "object" && "@context" in entry)
        : parsed && typeof parsed === "object" && "@context" in parsed;
      if (!hasContext) failures.push(`${file}: JSON-LD block is missing @context`);
    } catch {
      failures.push(`${file}: JSON-LD block contains invalid JSON`);
    }
  }

  for (const tag of tags(html, "img")) {
    if (getAttribute(tag, "alt") === null) {
      failures.push(`${file}: <img> is missing alt text (${getAttribute(tag, "src") || "unknown src"})`);
    }
  }

  for (const match of html.matchAll(stalePricePattern)) {
    failures.push(`${file}: stale price ${match[0]} found in HTML`);
  }

  const phrase = PAGE_KEYWORDS[publicPath];
  if (!phrase) {
    failures.push(`${file}: missing PAGE_KEYWORDS entry for ${publicPath}`);
    continue;
  }
  const earlyMain = mainText(html);
  const headingMatch = hasPhrase(title, phrase) || hasPhrase(h1, phrase);
  const contentMatch = hasPhrase(description, phrase) || hasPhrase(earlyMain, phrase);
  if (!headingMatch || !contentMatch) {
    failures.push(`${file}: keyword "${phrase}" must appear in the title or h1 and in the description or first 1500 chars of <main>`);
  }
}

if (failures.length) {
  console.error("SEO checks failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`SEO checks passed for ${htmlFiles.length} HTML files.`);
