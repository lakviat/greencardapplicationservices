# Workspace UX v2.1 — review evidence

Implemented on `codex/workspace-ux-v21` from main `708a316`. This is a feature-branch review, with no production deployment, provider activation, purchase, customer email or production applicant upload. All screenshots and test records below use synthetic data.

## Changes

- A 60px mobile navigation bar with previous/next required field, compact progress and a six-action sheet. It uses visual viewport geometry, measured toolbar height and safe areas. While a keyboard obscures the viewport it contracts; dialogs hide the toolbar. Desktop retains compact save/review controls.
- The existing company statue asset replaces the GC placeholder. The compact heading brings the first form field into a normal phone viewport. The independent-service label and source/privacy information remain accessible.
- Shared question grouping for the editor, full document preview and server PDF: yellow numbered headings, last/first/middle name rows, date parts, radio choices, Part One/Part Two and continuous page numbers. Country selectors support keyboard search. Field help moves into accessible contextual dialogs and the desktop guide.
- Local passport OCR with deterministic TD3 checksums, country-code mapping, numeric OCR correction notices and conservative century handling. A consent step precedes image selection. Editable results and an image preview require explicit confirmation before applying any value or attaching the new image. Nationality never becomes birthplace or eligibility. Missing/unsupported values stay manual; raw OCR is not persisted.
- Progress includes applicable spouse/child/photo/passport requirements and a deliberately requested second principal. Eligibility starts blank. Backend saves preserve known dormant answers and owned assets without including them in completeness or export while inapplicable.
- PDFs wrap long answers across continuation pages, keep data within margins, include preparation date and DV year, and reference private attachments. Browser preview and server PDF share field order and grouping; responsive layouts and long answers can produce different physical page breaks.

Prices, entitlement checks, Stripe/Supabase interfaces, database structures and existing purchases are unchanged. Premium remains unavailable. Required spouse/child disclosures are available on Single.

## Verification

| Check | Evidence |
| --- | --- |
| `npm run check` | 27 schema/UX/household/privacy tests, 7 existing passport parser cases, syntax, 20 HTML pages, local references, SEO, platform privacy/capability guards and whitespace passed. |
| `npm run test:browser` | Chromium, WebKit and Firefox: existing 320/390/430/1440px journeys plus new passport review, keyboard country search, date parts, compact toolbar, contextual help, viewport resizing and 320×568 / 200% text checks. |
| Accessibility | axe WCAG 2.0/2.1 A/AA editor/review/public-page checks passed. Keyboard country selection, next-field focus and reduced-motion mode exercised. |
| OCR/privacy | Actual self-hosted Tesseract reads names, a checked date and a checked document number from a synthetic MRZ in all three engines. No insertion/attachment before confirmation; changes apply after review; deletion works. External requests are blocked except an empty health response; no applicant data or browser persistence. Invalid checksums, digit substitutions, name-row padding noise, unsupported MRZ and ambiguous centuries have unit coverage. |
| `npm run test:backend` | Seven unit tests plus real local Supabase Auth/Postgres/Storage/API integration: cross-account isolation, paid-only writes, webhook signature and idempotency, refund ordering, revision conflict, malformed uploads, dormant asset ownership, PDF and deletion passed. |
| `node tests/backend/browser.mjs` | Real local Mailpit OTP, authenticated purchased-preparation reopen, edit and autosave passed in a mobile Chromium viewport. Payment entitlement is a synthetic local fixture; no real charge. |
| PDF | Server-generated single (5 pages) and family/long-answer (10 pages) PDFs rendered and visually inspected. Text bounds and continuous page numbering checked on every page. Regression test reads PDF content streams to verify long-answer start/end, applicant/spouse/child data, date/year, numbering and exclusion of inapplicable spouse data. |
| Build | Generated Edge Function bundle refreshed from source. No migration or new production configuration. |

## Visual evidence

- [Mobile editor](evidence/editor-mobile.png)
- [Desktop editor](evidence/editor-desktop.png)
- [Mobile actions](evidence/mobile-actions.png)
- [Mandatory passport review](evidence/passport-review.png)
- [All single-applicant PDF pages](evidence/single-pdf-pages.png)
- [All family/long-answer PDF pages](evidence/family-pdf-pages.png)

## Release checks still required

- Physical iPhone Safari/Chrome and Android Chrome camera handoffs, keyboard/browser-chrome changes, pinch zoom and representative HEIC variants. Playwright WebKit is not a claim of physical Safari testing; visualViewport keyboard geometry in this suite is simulated.
- Representative real-world passport layouts, glare, rotation and low-quality images. The checksum reader supports standard TD3 passports with a complete 44-character data row (minor name-row padding noise is flagged); other formats and ambiguous values require manual entry. Checksums detect transcription errors, not identity or eligibility.
- Existing production provider activation: Gmail SMTP credentials and restricted Stripe checkout credentials still require completion/verification. Local authenticated-save and payment-state tests do not prove live email delivery or live checkout. This PR does not activate the production capability gates or re-enable Premium.
- Final DV-2027 requirements and eligible-country list remain subject to official publication/review. The controlled country vocabulary is not an eligibility determination. No government entry is submitted by this workspace.

## References

The archived [DS-5501 sample](https://travel.state.gov/content/dam/visas/Sample%20E-DV%202017%20Lottery.pdf) rendered successfully in Chrome; pages 2 and 4 were inspected for name/date/radio/section presentation. Current-field sources remain in [the source record](../dv-sources.md). The worksheet is an accessible responsive interpretation, not an official replica.

MRZ check digits and TD3 field positions use [ICAO Doc 9303 Part 3](https://www.icao.int/sites/default/files/publications/DocSeries/9303_p3_cons_en.pdf) and [Part 4](https://www.icao.int/sites/default/files/publications/DocSeries/9303_p4_cons_en.pdf). Alpha-3 issuer mappings derive from Unicode CLDR 48; the Unicode v3 license is included in `vendor/UNICODE-LICENSE.txt`. Unknown issuing-authority codes stay editable rather than being guessed.
