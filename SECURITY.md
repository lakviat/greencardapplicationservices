# Security Policy

Report suspected vulnerabilities privately through this repository’s Security tab and GitHub Security Advisories. Include reproduction steps and impact, without real identity documents, card details or customer personal information. Do not open public issues containing sensitive records.

## Current preview boundary

This is a static GitHub Pages site. Browser JavaScript and its configuration are public. The owner deferred the backend; the preparation workspace has no authentication, upload endpoint, paid entitlement, cloud persistence or transactional delivery.

Answers, images and object URLs stay in tab memory. OCR and HEIC conversion use self-hosted workers. Images are decoded and re-encoded locally; file type, size and pixel bounds are checked. These are browser usability checks, not a replacement for future server upload validation or malware scanning. Removing a document or deleting a worksheet releases its object URL and local references. No sensitive values are written to browser storage, URLs or analytics.

`prepare.html` has a separate same-origin CSP, no-referrer policy and no analytics or advertising scripts. Public pages retain explicit optional cookie choices. A user who follows a support or notification action chooses that channel; do not send passport scans through those channels.

The existing public notification integration uses Google Apps Script with `no-cors`: successful dispatch is not confirmed server acceptance. Frontend identifiers and the legacy compatibility token are public and must never be treated as authentication. The old intake template remains for migration reference and existing operations, not the new application flow.

## Paid-launch requirements

Before receiving production identity documents, implement and test authenticated ownership checks on every endpoint, private object storage, row-level access control, verified email ownership, short-lived download authorization, safe logging, secure sessions, rate limits, server-side file validation, deletion and retention cleanup. Confirm provider encryption and contractual privacy obligations for supported markets.

Use server-priced Stripe Checkout and signature-verified idempotent webhooks. Do not trust browser prices, package flags, return URLs or a `paymentStatus` field. Never collect card numbers or CVCs in this app. Do not put applicant answers or scans in payment metadata. Backend authorization must independently gate saving and exports.

## Repository and hosting rules

- Do not commit secrets, `.env` files, private keys, customer documents or exported records.
- Keep GitHub secret scanning and push protection enabled.
- Run the static checks and all browser engines before release.
- Keep this rebuild on its feature branch until the documented launch requirements and policy review are complete.
- GitHub Pages cannot set arbitrary response headers. A backend-capable host must enforce CSP, `frame-ancestors`, HSTS, `X-Content-Type-Options`, restrictive `Permissions-Policy`, and private/no-store caching for authenticated documents as HTTP headers.

See `docs/rebuild/backend-plan.md` for the planned security boundary and `docs/rebuild/review.md` for the explicit deferred scope.
