# Deferred backend contract

This document is a proposed implementation boundary, not implemented endpoints or migrations. No backend service was provisioned and no credentials were requested again after the owner deferred backend work.

The existing static site can remain the public frontend. A small authenticated service with Supabase Auth/Postgres/private Storage, Stripe Checkout and a transactional provider is compatible, subject to owner choice. Google Apps Script notification intake is not an identity-document store or payment-entitlement service for the new platform.

## Data model to implement

| Record | Purpose and ownership |
| --- | --- |
| users | Verified email identity; immutable server principal |
| form_versions | DV year, source verification, schema version, supported/review status |
| preparations | Owner ID, DV year, schema version, revision, selected package and status |
| household_links | Explicitly authorized related preparations; no automatic eligibility inference |
| field_responses | Stable schema IDs and structured values, owner-bound through preparation |
| document_assets | Private object keys, role, validation state, safe metadata and retention expiry |
| purchases | Stripe session/payment references and server-calculated amount/currency |
| entitlements | Purchased preparation/bundle, correction and export rights; uniqueness constraints |
| pdf_versions | Preparation revision, template version, private generated object and status |
| delivery_jobs | Recipient verified ownership, secure-link delivery attempts and retry state |
| audit_events | Actor/action/resource IDs only; no answers, passport numbers or raw bodies |

Use transactions, row-level security and server ownership checks together. All child and asset paths inherit preparation ownership. Avoid public buckets. Decide and implement deletion cascades, retained financial-record exceptions and a concrete retention schedule before accepting production information.

## Endpoint behavior to implement

- Authentication: passwordless email with verified ownership, CSRF/origin checks where relevant, secure sessions, rate limits and abuse controls.
- Create/save preparation: authenticated user, approved schema version, validated answers, revision conflict handling and verified entitlement. Saving is never unlocked by a return URL.
- Upload: owner-scoped short-lived upload authorization, byte/content and pixel checks on the server, image re-encoding, private storage and malware checks where supported. Frontend MIME detection is insufficient authorization or security.
- Checkout: server selects the exact plan amount and binds order/preparation/year/customer; do not accept client prices or document bodies as Stripe metadata. Check existing entitlements to prevent repeat charges. Disclose upgrade differences before confirmation.
- Webhook: verify raw-body signature, persist unique event IDs, process idempotently in transactions, handle replay/out-of-order events and reconcile against Stripe. Pending/canceled/failed payments never unlock capabilities.
- Export: revalidate ownership, entitlement, saved revision and version support; render the shared-schema worksheet; store it privately. Unsupported/new-year requirements must trigger review, not silently reinterpret purchased data.
- Download/email: authenticated or short-lived token access with appropriate verification; safe filenames and no PII in query strings. Send secure links rather than passport or full-record attachments. Handle expiry, revocation and delivery retries.
- Delete: confirm user intent, authorize ownership, revoke links, remove answers and assets, queue storage cleanup, and disclose any mandatory financial retention. Verify deletion and scheduled expiry in integration tests.

Current browser state is intentionally not serialized into localStorage or a fake backend. A future adapter must obtain server capabilities and records; merely setting `CAPABILITIES` to true is not an implementation.

## Configuration for the future service

There are **no required frontend environment variables** for this phase. The following names are a proposed server configuration inventory, not existing deployment settings:

| Setting | Location / use |
| --- | --- |
| `PUBLIC_APP_ORIGIN` | Server origin/redirect allowlist |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Project configuration; anon key must be constrained by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret; never bundled in browser code |
| `DATABASE_URL` | Migration/backend secret store only |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Server-only; isolated test and live values |
| Stripe plan/price mapping | Server-owned validated configuration, one-time amounts only |
| `TRANSACTIONAL_EMAIL_API_KEY`, `EMAIL_FROM` | Server secret plus verified sender/domain |
| `DOCUMENT_BUCKET`, `DOCUMENT_RETENTION_DAYS` | Private storage and owner-approved lifecycle |
| `DOWNLOAD_LINK_TTL_SECONDS` | Short approved lifetime; revocable server authorization |
| `ALLOWED_ORIGINS` | Explicit frontend origins, no wildcard credentialed CORS |

No real values belong in the repository or chat. Use the selected host’s secret manager. Document the actual provider and variable names when implementing; create migrations and test data only then.

## Backend acceptance evidence required

Use isolated accounts and synthetic identity data. Test cross-user guessed IDs; upload abuse; expired/revoked links; successful, failed and canceled payments; repeat checkout; duplicate/reordered webhooks; signed raw-body handling; cloud resume; concurrent saves; export fidelity; email failures/retries; correction/regeneration without repeat charging; deletion/retention; safe logs and rate limiting. A browser mock cannot substitute for these checks.
