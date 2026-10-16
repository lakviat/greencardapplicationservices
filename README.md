# Green Card Application Services

Independent DV Lottery preparation: a responsive document workspace on GitHub Pages with a Supabase backend. No government entry is submitted or confirmed by this service.

The owner authorized backend integration and deployment to main on 2026-10-16. **Live paid capabilities remain disabled until Stripe, customer email, and retention maintenance are configured and verified.** Premium remains disabled pending owner review. Local tests are not evidence of production activation.

## Features

- Versioned principal, spouse and child fields, document guidance, completeness checks, explicit household reuse and mobile photo/passport tools.
- Private Supabase account storage, verified email sign-in, paid save/resume, revision conflict protection, server-validated JPEGs and deletion.
- Server-priced Stripe Checkout and signature-verified, idempotent payment handling. Required derivatives remain included on every plan.
- Server-generated preparation PDFs and email with authenticated account links. No passport or applicant-record email attachments.
- In-memory free preparation, with no sensitive browser persistence or workspace analytics. Keep the original worksheet tab open during checkout; it is not saved until payment is verified and Save completes.

Single $9.99, Couple $19.99, Family $29.99, Premium $39.99 USD, one time. The server rejects Premium. Purchased preparations include corrections and repeated exports without another charge.

## Run and test

Node.js 20+, Docker and OpenSSL are required for the complete local test stack.

```sh
npm ci
npm run build:backend
npx supabase start
npx playwright install
PORT=8444 npm run serve
```

In another terminal:

```sh
npm run check
npm run test:browser
npm run test:backend
```

The free workflow is checked in Chromium, WebKit and Firefox at 320/390/430/1440 pixels. Backend integration tests use real local Auth, PostgreSQL, private Storage and Edge Functions with synthetic users; no live charge or external email is sent. `tests/backend/browser.mjs` additionally tests OTP delivery through local Mailpit and automatic paid saving. Its setup is in the CI workflow.

## Deployment and secrets

The existing Supabase GitHub integration watches `main` for database/function deployment. GitHub Pages publishes the frontend. Supabase project: `wofazcvfvazfkvujwwcw`. Browser configuration contains only the publishable API key. Never commit project secret keys, Stripe keys, email keys, real passports, or applicant records.

See [backend deployment and verification](docs/rebuild/backend-plan.md) and [.env.example](.env.example) for the actual configuration names, activation gates, retention behavior and remaining limitations. Credentials pasted in chat must be rotated before production use. The server's public health response at `/functions/v1/gcas-api/health` indicates which services are activated; frontend flags never grant a payment entitlement.

## Code map

| Area | Location |
| --- | --- |
| Shared form, validation, prices and export mapping | `assets/preparation/schema.mjs` |
| Document, account controls and cloud adapter | `assets/preparation/workspace.mjs`, `cloud.mjs`, `backend.mjs` |
| Local image tools and OCR | `assets/preparation/media.mjs`, `assets/passport-autofill.js` |
| Server API and PDF generation | `supabase/functions/gcas-api/` |
| RLS, transactions and retention | `supabase/migrations/` |
| Daily private-storage cleanup | `scripts/backend-cleanup.mjs` |
| Build and tests | `scripts/build-backend.mjs`, `tests/`, `.github/workflows/security.yml` |

Public notification signup retains its separate Google Apps Script integration and consent choices. It never receives new worksheet answers or documents. Legacy Stripe Payment Links are no longer used by the new workspace; they have not been archived in Stripe. Existing marketing drafts are outside this change.

[Requirements and owner amendments](docs/rebuild/requirements.md) · [DV sources](docs/rebuild/dv-sources.md) · [Security](SECURITY.md)
