# Green Card Application Services

Independent DV Lottery document preparation, built on the existing static site. The v2 feature branch replaces the limited request form with a responsive, editable worksheet at `/prepare.html`.

**Review preview — not the production paid service.** On October 16, 2026, the owner deferred backend implementation and asked that Premium remain disabled. This branch implements the frontend and public content. Do not merge it into `main` until launch requirements are approved: GitHub Pages publishes `main` automatically.

## What works now

- Versioned document schema, Part One and Part Two, yellow section headers, field guidance, keyboard navigation, missing-item navigation and live completeness checks.
- Principal, spouse and unrestricted required-child records. Package changes preserve answers. Creating a spouse’s independent worksheet requires permission and explicit approval to reuse household facts.
- Local photo capture/upload, square cropping, JPEG size and resolution checks, manual visual confirmation, separate passport bio/signature pages, and optional local OCR with review before applying names.
- Review, printable worksheet preview, and an in-memory dashboard with edit and delete. No government submission or confirmation is created.
- Revised homepage, pricing, FAQ, guides, registration status, and owner-review policy drafts. All existing informational page URLs are retained; old `#apply` links route to the new workspace.

Single is $9.99, Couple $19.99, Family $29.99 and Premium $39.99 USD. These are planned one-time prices. Premium selection is disabled. Required spouse and child details are included on every principal worksheet, regardless of package.

## What is deliberately unavailable

Accounts, cloud saving, cross-device resume, Stripe checkout, payment entitlements, customer PDF downloads and transactional delivery require the deferred backend. They are visibly unavailable; no payment or success state is simulated. Answers and images remain only in tab memory and disappear on reload or close. Changing a frontend flag cannot establish a payment entitlement.

A developer-only synthetic PDF verifies the real worksheet print layout. It is not a customer download implementation. Family bundle delivery and retention periods also require the backend phase and owner approval.

## Run and check

Use Node.js 20+ and OpenSSL. Frontend runtime assets are already checked in; npm installs test tools only.

```sh
npm ci
npx playwright install
PORT=8444 npm run serve
```

In a second terminal:

```sh
npm run check
npm run test:browser
```

The local server is `https://127.0.0.1:8444`. Its temporary self-signed certificate is accepted only by tests targeting loopback. The strict production CSP stays enabled. `PREP_ENGINES=webkit npm run test:browser` narrows a run; `PREP_ARTIFACTS=/absolute/path` changes the synthetic screenshot/PDF output directory. Default artifacts are in `/tmp/gcas-rebuild/verification`.

Tests cover schema and household behavior, existing consent-gated analytics, parser regressions, three browser engines, four editor viewports (320/390/430/1440), real local OCR, image errors, the review/dashboard, accessibility, and every public page. External requests are blocked during browser tests. No real passport, payment, email or customer record is used.

`Security and quality` runs on PRs. The read-only post-deployment smoke check remains for a future approved release; it must compare the deployed revision, not this preview against the old production site.

## Code map

| Area | Files |
| --- | --- |
| Version, conditional fields, validation, pricing, export mapping | `assets/preparation/schema.mjs` |
| Interactive document and session dashboard | `assets/preparation/workspace.mjs`, `workspace.css` |
| Photo processing and local OCR | `assets/preparation/media.mjs`, `assets/passport-autofill.js`, `vendor/` |
| Explicit household reuse | `assets/preparation/household.mjs` |
| Worksheet print template | `assets/preparation/worksheet.mjs` |
| Deferred backend boundary | `assets/preparation/backend.mjs` |
| Public site | Root HTML files, `policies/`, `assets/platform.css`, existing `styles.css` |
| Public notification/support/cookies | `assets/app.js`, `assets/site-metrics.js` |

There is no backend environment configuration in this phase. The [backend contract and future configuration](docs/rebuild/backend-plan.md) describes the next stage without claiming that migrations or services exist.

## Existing integrations

Public notification signup retains its separate, explicit consent and Google Apps Script endpoint. Optional marketing permission remains separate. The browser can report dispatch, not verified delivery, because the existing integration uses `no-cors`. This endpoint never receives new worksheet answers or documents.

The old intake Apps Script template remains in `scripts/intake-apps-script.gs` for existing operations and migration reference. It is not called by the new worksheet. Old external Stripe Payment Links have been removed from active site paths but have not been archived in Stripe; archive them only after the replacement is verified and existing-customer handling is resolved.

Public pages retain optional cookie-controlled analytics and support links. `prepare.html` loads neither the public app nor analytics; its CSP permits only same-origin requests. Do not include identity data in URLs, analytics, logs, Stripe metadata or ordinary email attachments.

## Review documentation

- [Implementation status, before/after audit and launch requirements](docs/rebuild/review.md)
- [Backend plan and environment settings](docs/rebuild/backend-plan.md)
- [DV-year sources and unresolved requirements](docs/rebuild/dv-sources.md)
- [Verification and visual evidence](docs/rebuild/verification.md)
- [Original requirements and owner’s scope amendment](docs/rebuild/requirements.md)
- [Security policy](SECURITY.md)

No changes to existing marketing drafts are included in this branch. Campaigns must be aligned with the finished service before publication; the preview cannot generate sales through a disabled checkout.
