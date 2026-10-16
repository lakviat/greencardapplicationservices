import nodemailer from "nodemailer";

export function emailReady(env) {
  return (
    !!env("EMAIL_FROM") &&
    (env("SMTP_HOST")
      ? !!(env("SMTP_USER") && env("SMTP_PASSWORD"))
      : !!env("SENDGRID_API_KEY"))
  );
}

// The caller supplies only the verified account address, never an arbitrary recipient.
export async function sendReadyEmail(env, recipient, origin) {
  const subject = "Your DV Lottery Preparation Worksheet Is Ready";
  const text = `Your preparation worksheet is available. Sign in with this email address to download it securely:\n\n${origin}/prepare.html#dashboard\n\nYou can correct and download your purchased preparation again without another charge. Submit the government entry separately at https://dvprogram.state.gov. We are an independent preparation service, not a government agency. Support: info@greencardapplicationservices.com`;
  const from = {
    address: env("EMAIL_FROM"),
    name: "Green Card Application Services",
  };
  if (env("SMTP_HOST")) {
    const transport = nodemailer.createTransport({
      host: env("SMTP_HOST"),
      port: Number(env("SMTP_PORT") || 465),
      secure: true,
      auth: { user: env("SMTP_USER"), pass: env("SMTP_PASSWORD") },
      tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false,
      debug: false,
    });
    try {
      const result = await transport.sendMail({
        from,
        to: { address: recipient },
        subject,
        text,
      });
      return (
        result.accepted?.some(
          (address) =>
            String(address).toLowerCase() === recipient.toLowerCase(),
        ) === true
      );
    } finally {
      transport.close();
    }
  }
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${env("SENDGRID_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: recipient }] }],
      from: { email: from.address, name: from.name },
      subject,
      content: [{ type: "text/plain", value: text }],
      tracking_settings: {
        click_tracking: { enable: false, enable_text: false },
        open_tracking: { enable: false },
      },
    }),
  });
  return response.ok;
}
