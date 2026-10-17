# Preparation progress, protected preview and PDF checkout

A pending optional spouse-principal worksheet previously counted even after changing to a marital status without a listed spouse. Its Missing Fields action sent the user back to marital status, where no answer could resolve that stale task. Pending creation now counts only for an applicable listed spouse. Existing related worksheets and dormant spouse answers/images are preserved. Completed applicable fields reach 100%; missing spouse details and photos still count and have a direct navigation link.

The unpaid preview contains only the name section and placeholder blocks. It does not fetch a PDF or place the other completed answers behind CSS blur. Screenshots cannot be prevented, and applicants can still review their own answers in the editor. The full export is protected by the server's verified account, ownership, payment and completeness checks.

Paid previews now render actual server-generated PDF bytes through a self-hosted PDF.js viewer, one page/canvas at a time for mobile memory use. Page navigation, accessible page text, an Open PDF link and download are provided. Leaving the preview destroys the renderer and revokes its private blob URL. Viewer code/fonts load only for a paid preview. No third-party viewer receives a document.

Save & receive PDF shows the selected package price (Single $9.99). It checks missing fields, asks for account sign-in when necessary, and opens Stripe directly for signed-in users. An explicit Continue button handles browsers that block a popup following OAuth. The original worksheet tab stays open, unsubmitted answers/images stay local until payment, cancellation remains recoverable, and server-confirmed payment triggers saving and PDF viewing. This is account viewing/downloading; automatic email delivery remains separately gated.

Only a validated contact email is passed to Stripe for prefill. The verified sign-in account retains ownership and delivery authorization. Amounts remain server-controlled, reused sessions remain idempotent, and Premium is disabled.

The export is an **unofficial preparation worksheet**, not a USCIS form or a ready-to-file government PDF. The [State Department's submission instructions](https://travel.state.gov/content/travel/en/us-visas/immigrate/diversity-visa-program-entry/diversity-visa-submit-entry1.html) require electronic DV entries and do not accept paper entries. Provisional DV-2027 requirements remain unchanged.

## Verification

- Static/schema, SEO, reference, privacy and whitespace checks passed.
- Full free workflow, touch country selection, all marital-status transitions, dormant-answer retention, missing-field navigation, and partial-preview redaction passed in Chromium, WebKit and Firefox.
- Isolated synthetic provider tests passed direct checkout, applicant/account email separation, cancellation recovery, and no prepayment uploads/PDF requests in all three engines; no real payment was made.
- Actual server-generated PDF pixels, accessible text, paging and cleanup passed under the production CSP in all three engines. Rendered PDF pages were visually inspected.
- Real local Supabase tests passed ownership/isolation, private images, unpaid/refunded PDF denial, completeness validation, PDF generation, and paid browser viewing/downloading.
- The shared local stack has old email-autoconfirm settings; the standalone Auth configuration test requires a clean stack. The full clean-stack test runs in CI. No shared stack was restarted.

Production Google OAuth and Stripe activation remain pending under the existing provider setup. Feature gates were not enabled by this release. See [social sign-in setup](social-sign-in.md).
