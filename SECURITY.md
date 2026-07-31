# Security Policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or exposed customer
data. Use the repository's **Security** tab to submit a private vulnerability
report through GitHub Security Advisories.

Include the affected URL, the observed behavior, reproduction steps, and the
potential impact. Do not include real identity documents, card details, or
customer personal information in the report.

## Architecture boundaries

- This is a static GitHub Pages site. Browser JavaScript and all values shipped
  with it are public.
- Payments use Stripe-hosted Payment Links. This repository must never collect,
  log, or store card numbers, CVCs, Stripe secret keys, or Apple Pay credentials.
- Google Apps Script endpoints are public internet endpoints. They must validate
  and rate-limit every request server-side. A value stored in frontend
  JavaScript is not a secret and cannot authenticate a request.
- Current browser submissions use `no-cors`. The UI can confirm that a request
  was dispatched, but it cannot prove that Apps Script accepted or stored it.
  Authoritative delivery confirmation requires a CORS-capable backend or a
  trusted status endpoint.
- A browser `paymentStatus` field is informational only. Production payment
  confirmation must come from a verified Stripe webhook on a trusted backend.
- Identity documents currently pass through Apps Script and Google Drive. Drive
  access must be private, limited to required staff, protected by multi-factor
  authentication, and governed by a retention/deletion policy.

## Repository rules

- Never commit `.env` files, private keys, service-account JSON, API secret
  keys, customer documents, or exported customer records.
- Public Stripe Payment Links, Google Analytics measurement IDs, and Apps Script
  deployment URLs are identifiers, not credentials.
- Keep GitHub secret scanning and push protection enabled.
- Run `bash scripts/check-static-site.sh` before deployment.

## Deployment limitations

GitHub Pages does not let this repository configure arbitrary HTTP response
headers. The site therefore uses a meta Content Security Policy and a
JavaScript clickjacking guard. If the project moves to Cloud Run or another
configurable host, enforce CSP, `frame-ancestors`, HSTS,
`X-Content-Type-Options`, and `Permissions-Policy` as HTTP response headers.
