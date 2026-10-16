import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:tls";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { emailReady } from "../../supabase/functions/gcas-api/email.mjs";

test("SMTP sends only a secure dashboard link; TLS and provider failures fail closed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gcas-smtp-test-"));
  const config = join(dir, "openssl.cnf"),
    key = join(dir, "server.key"),
    cert = join(dir, "server.crt");
  writeFileSync(
    config,
    "[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ext\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n",
    { mode: 0o600 },
  );
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
      key,
      "-out",
      cert,
      "-config",
      config,
    ],
    { stdio: "ignore" },
  );
  let reject = false;
  const messages = [],
    recipients = [],
    sockets = new Set();
  const server = createServer(
    { key: readFileSync(key), cert: readFileSync(cert) },
    (socket) => {
      sockets.add(socket);
      socket.on("error", () => {});
      socket.on("close", () => sockets.delete(socket));
      socket.setEncoding("utf8");
      socket.write("220 localhost synthetic SMTP\r\n");
      let pending = "",
        content = null,
        authenticated = false;
      socket.on("data", (chunk) => {
        pending += chunk;
        while (pending.includes("\r\n")) {
          const boundary = pending.indexOf("\r\n"),
            line = pending.slice(0, boundary);
          pending = pending.slice(boundary + 2);
          if (content !== null) {
            if (line === ".") {
              messages.push(content);
              content = null;
              socket.write("250 Accepted synthetic message\r\n");
            } else content += line + "\n";
          } else if (line.startsWith("EHLO"))
            socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
          else if (line.startsWith("AUTH PLAIN ")) {
            authenticated =
              Buffer.from(line.slice(11), "base64").toString() ===
              "\u0000sender@example.test\u0000synthetic-app-password";
            socket.write(
              authenticated
                ? "235 Authenticated\r\n"
                : "535 Invalid credentials\r\n",
            );
          } else if (line.startsWith("MAIL FROM"))
            socket.write(
              authenticated ? "250 OK\r\n" : "530 Authentication required\r\n",
            );
          else if (line.startsWith("RCPT TO")) {
            recipients.push(line);
            socket.write(
              reject ? "550 Synthetic recipient rejection\r\n" : "250 OK\r\n",
            );
          } else if (line === "DATA") {
            content = "";
            socket.write("354 End with dot\r\n");
          } else if (line === "QUIT") socket.end("221 Bye\r\n");
          else socket.write("250 OK\r\n");
        }
      });
    },
  );
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const env = {
      ...process.env,
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(server.address().port),
      SMTP_USER: "sender@example.test",
      SMTP_PASSWORD: "synthetic-app-password",
      EMAIL_FROM: "sender@example.test",
      NODE_EXTRA_CA_CERTS: cert,
    };
    assert.equal(
      emailReady((name) => env[name] || ""),
      true,
    );
    assert.equal(
      emailReady(() => ""),
      false,
    );
    const script = `import {sendReadyEmail} from ${JSON.stringify(new URL("../../supabase/functions/gcas-api/email.mjs", import.meta.url).href)};
      try { console.log(await sendReadyEmail(n=>process.env[n]||'', 'verified@example.test', 'https://example.test')); }
      catch { process.exitCode=2; }`;
    const run = (variables) =>
      promisify(execFile)(
        process.execPath,
        ["--input-type=module", "-e", script],
        { env: variables, timeout: 10000 },
      );
    const result = await run(env);
    assert.equal(result.stdout.trim(), "true");
    assert.equal(messages.length, 1);
    assert.match(recipients[0], /<verified@example\.test>/);
    assert.match(
      messages[0],
      /https:\/\/example\.test\/prepare\.html#dashboard/,
    );
    assert.doesNotMatch(
      messages[0],
      /Content-Disposition: attachment|passport|synthetic-app-password/i,
    );
    reject = true;
    await assert.rejects(run(env), (error) => error.code === 2);
    assert.equal(
      messages.length,
      1,
      "Rejected messages never reported as accepted",
    );
    await assert.rejects(
      run({ ...env, NODE_EXTRA_CA_CERTS: "" }),
      (error) => error.code === 2,
    );
    assert.equal(messages.length, 1, "Untrusted TLS certificate rejected");
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
