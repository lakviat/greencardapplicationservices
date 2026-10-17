// Real Auth and Mailpit only. Never send mail to an external recipient.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { localConfig } from "./local-config.mjs";

const config = localConfig();
const client = (key = config.ANON_KEY) =>
  createClient(config.API_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const admin = client(config.SERVICE_ROLE_KEY);
const check = (result) => {
  assert.equal(result.error, null, result.error?.message);
  return result.data;
};
const settings = await (
  await fetch(`${config.API_URL}/auth/v1/settings`, {
    headers: { apikey: config.ANON_KEY },
  })
).json();
assert.equal(
  settings.mailer_autoconfirm,
  false,
  "Test email confirmation must match production; restart Supabase after config changes",
);

for (const returning of [false, true]) {
  const email = `otp-${randomUUID()}@example.test`;
  const auth = client();
  let userId;
  let messageId;
  try {
    if (returning)
      userId = check(
        await admin.auth.admin.createUser({ email, email_confirm: true }),
      ).user.id;
    const sent = check(
      await auth.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      }),
    );
    assert.equal(sent.session, null, "Sending a code never signs in a user");
    let mail;
    for (let attempt = 0; attempt < 30; attempt++) {
      const inbox = await (
        await fetch(`${config.MAILPIT_URL}/api/v1/messages`)
      ).json();
      const message = inbox.messages?.find((m) =>
        m.To.some((recipient) => recipient.Address === email),
      );
      if (message) {
        messageId = message.ID;
        mail = await (
          await fetch(`${config.MAILPIT_URL}/api/v1/message/${message.ID}`)
        ).json();
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(mail, "OTP email reached local Mailpit");
    const code = mail.HTML.match(/<strong>(\d{6,8})<\/strong>/)?.[1];
    assert(
      code,
      `${returning ? "Returning" : "First-time"} user receives the numeric code required by the app`,
    );
    assert.doesNotMatch(mail.HTML, /\/auth\/v1\/verify\?/);
    const invalid = await auth.auth.verifyOtp({
      email,
      token:
        "0".repeat(code.length) === code
          ? "1".repeat(code.length)
          : "0".repeat(code.length),
      type: "email",
    });
    assert(invalid.error, "A wrong code cannot authenticate");
    const verified = check(
      await auth.auth.verifyOtp({ email, token: code, type: "email" }),
    );
    userId = verified.user.id;
    assert(verified.user.email_confirmed_at);
    assert(verified.session.access_token);
    assert.equal(check(await auth.auth.getUser()).user.id, userId);
    await auth.auth.signOut();
    assert(
      (await client().auth.verifyOtp({ email, token: code, type: "email" }))
        .error,
      "A consumed code cannot be replayed",
    );
  } finally {
    // Find only this exact disposable synthetic address if failure preceded verification.
    if (!userId)
      userId = check(await admin.auth.admin.listUsers()).users.find(
        (user) => user.email === email,
      )?.id;
    if (userId) check(await admin.auth.admin.deleteUser(userId));
    if (messageId)
      await fetch(`${config.MAILPIT_URL}/api/v1/messages`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ IDs: [messageId] }),
      });
  }
}
console.log(
  "PASS: first-time and returning OTP delivery, verified sessions, wrong-code and replay rejection with email confirmation enabled.",
);
