#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "8443", 10);
const root = path.resolve(__dirname, "..");
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

let certDirectory = null;
let shuttingDown = false;

function cleanupCertDirectory() {
  if (!certDirectory) return;
  try {
    fs.rmSync(certDirectory, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup only.
  }
  certDirectory = null;
}

function createCertificateFiles() {
  certDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gcas-https-"));
  fs.chmodSync(certDirectory, 0o700);
  const configPath = path.join(certDirectory, "openssl.cnf");
  const keyPath = path.join(certDirectory, "localhost.key");
  const certPath = path.join(certDirectory, "localhost.crt");
  const config = [
    "[req]",
    "distinguished_name = req_distinguished_name",
    "prompt = no",
    "x509_extensions = req_ext",
    "[req_distinguished_name]",
    "CN = localhost",
    "[req_ext]",
    "subjectAltName = @alt_names",
    "[alt_names]",
    "DNS.1 = localhost",
    "IP.1 = 127.0.0.1",
    "",
  ].join("\n");
  fs.writeFileSync(configPath, config, { mode: 0o600 });

  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-keyout",
        keyPath,
        "-out",
        certPath,
        "-config",
        configPath,
        "-extensions",
        "req_ext",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
  } catch (error) {
    cleanupCertDirectory();
    if (error && error.code === "ENOENT") {
      throw new Error("openssl is required to start the local HTTPS server. Install openssl and retry.");
    }
    const detail = String(error.stderr || error.message || "openssl failed").trim();
    throw new Error(`openssl could not generate a localhost certificate: ${detail}`);
  }

  fs.chmodSync(keyPath, 0o600);
  fs.chmodSync(certPath, 0o600);
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

function send(response, statusCode, body = "", headers = {}, omitBody = false) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(omitBody ? undefined : body);
}

function resolveRequestPath(requestUrl) {
  const pathname = String(requestUrl || "/").split("?", 1)[0].split("#", 1)[0] || "/";
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { error: 400, message: "Malformed URI." };
  }
  if (decoded.includes("\u0000")) {
    return { error: 400, message: "Null bytes are not allowed." };
  }
  // Never expose repository internals such as .git, .env or editor folders.
  if (decoded.split("/").some((segment) => segment.startsWith(".") && segment !== "")) {
    return { error: 404, message: "Not found." };
  }
  if (decoded.split("/").includes("..")) {
    return { error: 403, message: "Path traversal is not allowed." };
  }

  const normalizedPath = path.posix.normalize(decoded.startsWith("/") ? decoded : `/${decoded}`);
  const absolutePath = path.resolve(root, `.${normalizedPath}`);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    return { error: 403, message: "Path traversal is not allowed." };
  }
  return { normalizedPath, absolutePath };
}

function serveFile(response, filePath, method) {
  const extension = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Content-Length": stat.size,
    "Content-Type": types[extension] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  if (method === "HEAD") {
    response.end();
    return;
  }
  fs.createReadStream(filePath)
    .on("error", () => send(response, 500, "Internal Server Error\n"))
    .pipe(response);
}

const tlsOptions = createCertificateFiles();
const server = https.createServer(tlsOptions, (request, response) => {
  const method = request.method || "GET";
  if (!["GET", "HEAD"].includes(method)) {
    send(response, 405, "Method Not Allowed\n", { Allow: "GET, HEAD" }, method === "HEAD");
    return;
  }

  const target = resolveRequestPath(request.url);
  if (target.error) {
    send(response, target.error, `${target.message}\n`, {}, method === "HEAD");
    return;
  }

  let filePath = target.absolutePath;
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    send(response, 404, "Not Found\n", {}, method === "HEAD");
    return;
  }

  if (stat.isDirectory()) {
    if (!target.normalizedPath.endsWith("/")) {
      send(response, 301, "", { Location: `${target.normalizedPath}/` }, true);
      return;
    }
    filePath = path.join(filePath, "index.html");
    try {
      stat = fs.statSync(filePath);
    } catch {
      send(response, 404, "Not Found\n", {}, method === "HEAD");
      return;
    }
  }

  if (!stat.isFile()) {
    send(response, 404, "Not Found\n", {}, method === "HEAD");
    return;
  }

  serveFile(response, filePath, method);
});

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(() => {
    cleanupCertDirectory();
    process.exit(exitCode);
  });
  setTimeout(() => {
    cleanupCertDirectory();
    process.exit(exitCode);
  }, 500).unref();
}

process.on("exit", cleanupCertDirectory);
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("SIGHUP", () => shutdown(0));
process.on("uncaughtException", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
});
process.on("unhandledRejection", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
});

server.listen(port, host, () => {
  console.log(`https://${host}:${port}/`);
});
