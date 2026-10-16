# Backend implementation and activation

Updated 2026-10-16. The owner authorized Supabase backend work and deployment to `main`. Premium remains disabled. This supersedes the earlier backend deferral.

## Implemented

The static website uses a bundled Supabase browser SDK with in-memory passwordless sessions. No applicant answers, photos, tokens, or passports are persisted in browser storage. Supabase Edge Functions verify each private request using Auth `getUser`. Clients cannot write tables directly or assign payment entitlements. The public health response advertises capabilities only when the corresponding server configuration is activated.

Versioned SQL migrations create preparations, orders, private assets, webhook receipts, rate limits, delivery attempts and a storage cleanup queue. RLS restricts authenticated direct reads to the owner's active paid preparation. Anonymous clients cannot read preparation data; all client mutation grants are revoked. The private bucket has no browser access policies. The API streams images and PDFs only after checking owner and active payment.

Stripe Checkout prices are calculated on the server: Single 999 cents, Couple 1999, Family 2999. Premium is rejected. Single includes every required derivative; Couple and Family allow two principal worksheets. A unique pending order and Stripe idempotency key prevent concurrent creation from charging twice. Only a signed webhook plus a server retrieval of the matching paid Stripe session can activate access. Duplicate events and refunds/disputes are handled transactionally; a late success cannot re-enable a revoked order. Card payments only; checkout expires 23 hours after its order was created. No application answers or passport images enter Stripe metadata.

Paid saves validate the schema, explicit processing permission, document limits and image ownership. Revision checks prevent one device overwriting a newer save. Image uploads are byte/size checked, decoded with memory/pixel limits, and JPEG re-encoded server-side to strip metadata. PDF generation revalidates completeness and uses the same ordered schema as the editor. PDFs are streamed, not published at public URLs. Email is sent only to the verified account address with an authenticated dashboard link, never applicant/passport attachments. Provider rejection is recorded as failed; the user may retry. The UI does not describe provider acceptance as inbox delivery.

Free work stays in the open worksheet tab. Checkout opens a separate Stripe tab so the original draft remains in memory; the user returns to Check payment & save. No sensitive pre-payment staging is implemented. Closing/reloading the original tab before saving loses that draft; browser eviction also remains a limitation. Paid records can be reopened with email verification on another device.

## Retention and deletion

Saved data expires 365 days after its last successful save. Unpaid order metadata (no applicant data) expires after seven days. Delete clears all worksheets in the purchased bundle, queues private files, and immediately attempts storage deletion. If storage is unavailable, queued deletion is retried by maintenance. Minimal order/payment references are retained separately for reconciliation and disputes. Files uploaded but not successfully saved are cleaned after one day; the daily script also removes orphaned storage objects after a crash.

`npm run backend:cleanup` uses the project data API secret. `.github/workflows/backend-maintenance.yml` schedules it daily in the `backend` GitHub environment. Configure `SUPABASE_SECRET_KEY` there before activation. A failed job is a maintenance failure requiring action, not evidence of completed deletion.

## Deployment

1. `npm ci && npm run build:backend` generates the pinned browser SDK and self-contained `supabase/functions/gcas-api/serve.ts`. The function authenticates private routes internally, so `verify_jwt=false` is required for publishable API keys and the Stripe webhook. This does **not** disable its user-token or webhook-signature checks.
2. The existing Supabase GitHub integration is connected to `lakviat/greencardapplicationservices`, with production deployment from `main` enabled. A push applies migrations and deploys functions; inspect its deployment logs. No new deployment token is needed for this route. A project `sb_secret_…` API key is for data access, not manual schema/function deployment.
3. Configure custom SMTP in Supabase Auth, verified sender, site URL and sign-in template (`supabase/templates/magic-link.html`). Keep email verification enabled. Supabase's default SMTP is not a production customer email service.
4. Configure the Edge Function secrets listed in `.env.example`. Use separate Stripe sandbox/live values. Configure webhook URL `https://wofazcvfvazfkvujwwcw.supabase.co/functions/v1/gcas-api/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and `charge.dispute.created`. Use the endpoint's signing secret, not a Supabase key.
5. Configure daily storage maintenance and run it successfully. Rotate the project secret that was pasted in chat before production use.
6. Verify real sign-in delivery, successful/canceled/failed sandbox checkout, webhook delivery and replay, save/resume, download, email acceptance and deletion. Set `GCAS_AUTH_READY=true` after email verification works. Set `GCAS_CHECKOUT_ENABLED=true` only after payment validation and maintenance are configured. Premium has no enable flag.
7. Push the reviewed site to main and inspect the deployed site and API capability response. Do not claim live activation from a successful local test or Git push.

## Local verification

`npx supabase start`, `npm run build:backend`, `npm run test:backend`. Integration tests use a real local Auth/Postgres/Storage/Edge Functions stack with synthetic users. They cover anonymous and cross-user access, direct entitlement mutation denial, paid-only saves, duplicate events, refund ordering, conflicting revisions, malformed images, private image retrieval, PDF bytes, missing email configuration and complete deletion. Tests do not make live charges or send external emails.

`npm run test:browser` exercises the free/offline path on Chromium, WebKit and Firefox at 320/390/430/1440 pixels. The backend browser test exercises real local account/record access separately. Stripe API connectivity and real email delivery require provider configuration and are not proven by these local tests.

## Remaining production constraints

- This version keeps the existing DV-2027 provisional requirements notice; final government requirements still need source review when released.
- Package upgrades require support; there is no automatic incremental-price upgrade flow.
- PDF output currently uses WinAnsi fonts. Unsupported non-Roman address characters produce an explicit export error instead of silent data loss. Expand font coverage before advertising arbitrary-script PDF output.
- Email failures can be retried by the customer; there is no unattended provider retry worker.
- Provider dashboards and production credentials must be configured and verified before paid capabilities are advertised as live.

Official references: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Edge Function deployment](https://supabase.com/docs/guides/functions/deploy), [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment).
