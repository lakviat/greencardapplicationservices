import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const htmlFiles = fs
  .readdirSync(root)
  .filter((name) => name.endsWith(".html"));
const failures = [];

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
  for (const match of content.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    verifyReference(htmlFile, match[1]);
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
