# Verification — October 16, 2026

All applicant data and document imagery in these tests are synthetic. Requests outside loopback are blocked. No payment, email, government entry, production upload or deployment was performed.

## Automated results

| Check | Result |
| --- | --- |
| `npm run check` | PASS: 20 schema/household/analytics tests; 7 passport parser regressions; JS/module syntax; 19-page local references/SEO/CSP/privacy/retired-flow guards; sitemap and diff whitespace |
| `npm run test:browser` | PASS: Chromium, WebKit and Firefox |
| Document viewports | 320, 390, 430 and 1440 pixels per engine; no horizontal overflow |
| Public pages | All 18 informational pages in each engine at 390 pixels; no legacy intake form or direct purchase links |
| Accessibility | No axe WCAG A/AA 2.0/2.1 violations in the editor, review and homepage in each engine; keyboard focus/jump behavior exercised |
| Image processing | Local JPEG crop, technical size/resolution checks, manual approval, passport/signature conditions, invalid file replacement preserving original |
| OCR | Actual self-hosted Tesseract worker reads synthetic MRZ in all three engines; cancellation before recognition; issuer never becomes birth country |
| Household | Single → Family → Single preserves child/spouse; Family document index; permission-gated separate spouse worksheet; independent records and explicit local deletion |
| Backend unavailable | Save opens a truthful unavailable state; checkout/PDF/email/sign-in remain disabled; no false ready/success/payment entitlement |
| Privacy | No workspace outbound requests, localStorage or sessionStorage writes; OCR loads only on demand |
| Existing public functions | Cookie preferences, optional unchecked marketing permission, support panel, notification network-failure feedback |
| Dependency audit | `npm audit --omit=optional --audit-level=high`: zero reported vulnerabilities |
| Local HTTP smoke | `node scripts/check-live-site.mjs https://127.0.0.1:8444 --attempts 1 --delay 1`: PASS |

Tests caught and corrected a revoked-image-URL OCR bug, Safari click cancellation during blur, unlabeled hidden upload controls, low-contrast public copy, and an overlapping mobile missing-item control. The print layout was rendered and every page inspected; navigation controls and internal field IDs are excluded from output, row labels/values remain together, and the concluding instructions do not split across pages.

The retired conversion/mobile/intake-specific runners were replaced with the new journey suite. Their useful public analytics consent/PII tests were retained in `tests/preparation/public-metrics.test.mjs`. The legacy passport parser regressions remain active.

## Visual evidence

- [Desktop editor](evidence/editor-1440.png)
- [Mobile editor](evidence/editor-390.png)
- [Desktop homepage](evidence/homepage-1440.png)
- [Mobile homepage](evidence/homepage-390.png)
- [Mobile review](evidence/review-mobile.png)
- [Four-page synthetic worksheet PDF](evidence/synthetic-worksheet.pdf)

The PDF intentionally contains an incomplete synthetic worksheet, so missing fields and unconfirmed checks are visible. It validates the print template, not saved/purchased backend generation. Customer download and email controls remain disabled.

## Limits of this evidence

Browser emulation does not prove real-phone camera permissions, HEIC variants, software-keyboard behavior or every assistive-technology combination. HEIC conversion reuses the existing self-hosted worker but physical-device HEIC QA remains required. No automated check determines identity, legal eligibility, image recency or government photo acceptance.

The official archived sample could not be downloaded for complete six-page visual comparison; see `dv-sources.md`. Final-year requirements, policies and the deferred backend need the launch review in `review.md`. There are no backend, Stripe-webhook, cross-account authorization, persistence, retention or email-delivery results to claim in this phase.
