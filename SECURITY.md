# Security Policy

Report vulnerabilities privately through GitHub Security Advisories. Use synthetic examples; do not submit passports, payment details or applicant records in public issues.

## Backend boundary

The browser and every public configuration file are public. Only the Supabase publishable key belongs there. Supabase service credentials, Stripe secrets, webhook signing secrets and mail keys must stay in server secret stores. Rotate any secret disclosed in chat before live collection.

Every private Edge Function operation verifies the current user with Supabase Auth, checks ownership and enforces payment requirements independently. Client table mutations and RPC execution are revoked; RLS limits reads to owned, active preparations. Private storage has no anonymous or authenticated object policies. Image/PDF requests require a current verified account token and are streamed with `Cache-Control: no-store`. A return URL or client flag never confirms payment.

Stripe events are raw-body signature verified, checked against the current Stripe session, and applied with transaction-level deduplication. Prices are server-owned. Refunds/disputes revoke paid PDF/email access and cannot be undone by a late success event. Application data never enters Stripe metadata.

Images are size/pixel bounded, decoded and JPEG re-encoded server-side. This strips source metadata and excludes arbitrary document formats; it is not an antivirus product or a government photo-acceptance guarantee. Schema checks reject invalid record structure and foreign asset references. PDF generation rechecks completeness. Logs and error messages must not contain answers, passport numbers, tokens or request bodies.

## Browser and retention

Unsaved work remains in tab memory. Verified owners can save private drafts and images before payment. Account credentials and activity timestamps persist in browser storage; applicant answers and images do not. The workspace has no marketing scripts, no-referrer and noindex policies, and a CSP permitting only the site and its named Supabase project for connections. Close/reload loses unsaved work; checkout uses another tab to preserve the original session. Applicant data is never written to browser localStorage or sessionStorage.

Saved preparation data expires 365 days after the last save; unsaved draft placeholders expire after seven days. Deletion clears record contents and queues private-file removal. Daily maintenance retries storage cleanup and removes stale orphan uploads. Monitor the retention workflow for failures. Order/payment references are retained separately for reconciliation and disputes. Email contains an authenticated dashboard link, not sensitive attachments.

## Release checks

- Run the schema, browser and real local backend integration tests.
- Verify production SMTP delivery and Stripe sandbox outcomes before activating checkout.
- Configure and run daily private-storage cleanup before collecting customer documents.
- Keep Premium disabled until the owner approves its deliverables.
- Keep secrets and applicant fixtures out of Git; fixtures must be synthetic.
- GitHub Pages cannot set arbitrary security response headers. A future backend-capable frontend host should add frame-ancestors, HSTS and restrictive Permissions-Policy headers. API responses already use no-store and nosniff.

See [backend activation and limits](docs/rebuild/backend-plan.md). Public Apps Script notifications are a separate consented feature, not an identity-document store or entitlement service.
