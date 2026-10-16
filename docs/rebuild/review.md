> Backend implementation was authorized on 2026-10-16 after this frontend review. Current deployment details and test scope are in [backend-plan.md](backend-plan.md). The older deferred-backend statements below describe that earlier milestone.

# Frontend rebuild review — October 16, 2026

This is the frontend phase of the master implementation request. The owner explicitly said “we will build backend later once we done with other part” and “Keep Premium disabled pending my review.” The implementation follows that scope. It is reviewable code, not an operational paid platform; do not merge/deploy it as one.

## Before and after

| Before | This branch |
| --- | --- |
| Small request form and direct Stripe Payment Links | Dedicated, immediately editable `/prepare.html` document workspace |
| Staff review/submission workflow | User-guided, unofficial preparation and separate official entry |
| Package controls before basic intake | Single starts automatically; optional package review preserves all required derivatives |
| Fixed family applicant count | Arbitrary required-child records; separate spouse principal created only with permission |
| Speculative October 18 countdown | Source-linked awaiting-official-confirmation status |
| Passport image sent with legacy intake | Local image preparation and reviewed OCR only; no sensitive upload before backend |
| No document review or worksheet output | Shared-schema review, printable preview, session dashboard, edit and local deletion |
| Claimed paid services | Planned prices and clearly disabled save/account/payment/delivery capabilities |

The existing HTML/CSS/JavaScript stack was retained. Browser modules separate data/schema, UI, media, household reuse and output. A framework migration would not create the missing backend or improve this bounded frontend enough to justify replacing the working public site.

## Public content audit

Homepage, How It Works, FAQ, costs, married-couple guidance, eligibility/status and the four country pages now describe the preparation model. Useful requirements, photo tools, country guides, resources and informational URLs are retained. Active purchase links no longer reach static Stripe Payment Links. Legacy `#apply` URLs route to the editor. The complete public sitemap, SEO metadata, local links and strict inline-script restrictions are checked automatically.

Terms, privacy and refund content are **owner-review drafts**. They distinguish current local processing from proposed paid cloud services, correction rights and future retention. Actual legal entity details, access duration, retention, processors/regions, international transfers, supported markets, cancellation rules and child-data obligations need approval before publication. Do not interpret draft wording as legal clearance.

Existing notification and WhatsApp/email support remain separate public-page functions. A notification submission is not a verified lead or sale. No outreach messages, campaigns, purchases or customer uploads were performed.

Pre-existing uncommitted marketing material was preserved, excluded from this PR, and not published. Some old campaign collateral may describe the previous offering. Review those drafts alongside the final live service before reuse.

## Delivered and deferred

| Deliverable | Status |
| --- | --- |
| Feature branch, document editor, guided fields, validation, household handling | Implemented |
| Local image tools, reviewed OCR, photo/passport completeness | Implemented; technical checks do not establish official acceptance |
| Session dashboard, review, print template | Implemented; work disappears on close/reload |
| Public content and policy drafts | Implemented for review |
| Automated tests and synthetic visual evidence | Included; see verification report |
| Accounts, save/resume, database migrations and private storage | Explicitly deferred by owner |
| Stripe Checkout, signed webhooks, entitlements and paid upgrades | Explicitly deferred by owner |
| Authenticated PDF generation/download, email delivery, retries | Explicitly deferred by owner |
| Cross-user isolation, production deletion, retention automation | Must be built and tested in backend phase |
| Premium | Disabled pending owner-approved benefits |

## Requirements before production launch

1. Finish and verify the backend described in `backend-plan.md`; all capability flags remain false until real server authorization exists.
2. Resolve final DV-2027 instructions, countries, date announcements, passport fields/exemptions and official upload semantics against primary sources. The current schema is explicitly provisional.
3. Complete page-by-page visual comparison with the six-page archived form. The official PDF was indexed, but direct retrieval returned HTTP 403 and the research tool supplied no usable page pixels. Exact six-page visual fidelity is **not claimed**. The frontend uses its documented question structure, own masthead and yellow part/section headings.
4. Approve policy drafts, business identity, prices, deliverables, access/retention duration and supported markets. Premium stays disabled separately.
5. Test physical iOS and Android camera/file-picker/HEIC behavior and software-keyboard positioning. Browser-engine emulation does not certify physical device behavior.
6. Use Stripe test mode to verify failure/cancellation/pending/duplicate/reordered webhooks, correction rights and upgrade disclosures; prove account A cannot access account B.
7. Verify secure export fidelity, email retries, deletion, incident operations and restore procedures. Do not send passport attachments in ordinary email.
8. Only then merge/deploy, navigate the live website, and run revision-matched smoke checks. Archive old Stripe links only after migration and existing-order reconciliation.

There is no production deployment in this PR.
