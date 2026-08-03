import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith(".html"));
const failures = [];
const siteOrigin = "https://greencardapplicationservices.com";
const sitemapPath = path.join(root, "sitemap.xml");
const robotsPath = path.join(root, "robots.txt");

if (!fs.existsSync(sitemapPath)) {
  failures.push("Missing sitemap.xml");
}

if (!fs.existsSync(robotsPath)) {
  failures.push("Missing robots.txt");
}

const sitemap = fs.existsSync(sitemapPath)
  ? fs.readFileSync(sitemapPath, "utf8")
  : "";
const sitemapUrls = new Set(
  [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]),
);

function verifyReference(sourceFile, reference) {
  if (
    !reference ||
    reference.startsWith("#") ||
    /^(?:https?:|mailto:|tel:|data:|blob:)/i.test(reference)
  ) {
    return;
  }

  const cleanReference = reference.split(/[?#]/, 1)[0];
  if (!cleanReference) return;

  const target = cleanReference.startsWith("/")
    ? path.join(root, cleanReference.slice(1))
    : path.resolve(path.dirname(path.join(root, sourceFile)), cleanReference);

  if (!fs.existsSync(target)) {
    failures.push(`${sourceFile}: missing ${reference}`);
  }
}

for (const htmlFile of htmlFiles) {
  const content = fs.readFileSync(path.join(root, htmlFile), "utf8");

  const requiredMetadata = [
    [/<title>[^<]+<\/title>/, "title"],
    [/<meta\s+name="description"\s+content="[^"]+"\s*\/>/, "description"],
    [/<link\s+rel="canonical"\s+href="([^"]+)"\s*\/>/, "canonical"],
    [/<meta\s+property="og:title"\s+content="[^"]+"\s*\/>/, "og:title"],
    [
      /<meta\s+property="og:description"\s+content="[^"]+"\s*\/>/,
      "og:description",
    ],
    [/<meta\s+property="og:image"\s+content="[^"]+"\s*\/>/, "og:image"],
    [/<meta\s+name="twitter:card"\s+content="[^"]+"\s*\/>/, "twitter:card"],
    [/<meta\s+name="twitter:title"\s+content="[^"]+"\s*\/>/, "twitter:title"],
    [
      /<meta\s+name="twitter:description"\s+content="[^"]+"\s*\/>/,
      "twitter:description",
    ],
    [/<meta\s+name="twitter:image"\s+content="[^"]+"\s*\/>/, "twitter:image"],
  ];

  for (const [pattern, label] of requiredMetadata) {
    if (!pattern.test(content)) {
      failures.push(`${htmlFile}: missing ${label} metadata`);
    }
  }

  if (/<meta\s+name="keywords"/i.test(content)) {
    failures.push(`${htmlFile}: remove ignored meta keywords`);
  }

  const canonical = content.match(
    /<link\s+rel="canonical"\s+href="([^"]+)"\s*\/>/,
  )?.[1];
  if (canonical) {
    if (!canonical.startsWith(`${siteOrigin}/`)) {
      failures.push(`${htmlFile}: canonical must use ${siteOrigin}`);
    }
    if (!sitemapUrls.has(canonical)) {
      failures.push(`${htmlFile}: canonical URL is missing from sitemap.xml`);
    }
  }

  for (const match of content.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    verifyReference(htmlFile, match[1]);
  }
}

if (fs.existsSync(robotsPath)) {
  const robots = fs.readFileSync(robotsPath, "utf8");
  if (!robots.includes(`${siteOrigin}/sitemap.xml`)) {
    failures.push("robots.txt must reference the production sitemap");
  }
}

const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
const structuredData = home.match(
  /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
)?.[1];
if (!structuredData) {
  failures.push("index.html: missing JSON-LD structured data");
} else {
  try {
    JSON.parse(structuredData);
  } catch {
    failures.push("index.html: JSON-LD structured data is invalid JSON");
  }
}

const cssFile = "assets/styles.css";
const css = fs.readFileSync(path.join(root, cssFile), "utf8");
for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
  verifyReference(cssFile, match[1]);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Verified local references across ${htmlFiles.length} HTML pages.`);
