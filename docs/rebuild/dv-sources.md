# DV source record — October 16, 2026

The implementation is a **provisional DV-2027 preparation schema**, not the government entry system or an eligibility decision.

| Source | How it is used |
| --- | --- |
| [Archived six-page DS-5501 sample](https://travel.state.gov/content/dam/visas/Sample%20E-DV%202017%20Lottery.pdf) | Principal questions 1–14, last/first/middle name grouping, Part One and derivative structure. Archived reference only; not current legal instructions. |
| [DV-2026 instructions](https://travel.state.gov/content/dam/visas/Diversity-Visa/DV-Instructions-Translations/DV-2026-Instructions-Translations/DV%202026%20Plain%20Language%20Instructions%20and%20FAQs.pdf) | Baseline field, family and photo guidance, subject to final-year review. |
| [March 11, 2026 final passport rule](https://www.govinfo.gov/content/pkg/FR-2026-03-11/html/2026-04737.htm) | Principal passport details, bio/signature JPEG documents and narrowly described exceptions; effective April 10, 2026, with DV-2027 implementation. |
| [Department of State DV-2027 registration announcement](https://travel.state.gov/content/travel/en/News/visas-news/changes-to-2027-dv-program-entry-period.html) | Registration timing awaits announcement; do not reinstate an October 18 estimate. |
| [Current instructions landing page](https://travel.state.gov/content/travel/en/us-visas/immigrate/diversity-visa-program-entry/diversity-visa-instructions.html) | Required release-time source check. |
| [Official photo examples](https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/photo-examples.html) | User visual comparison; technical image checks are not acceptance guarantees. |

The new rule includes the principal’s full passport name, number, issuing country/authority, expiry, and biographic/signature pages. The implementation prepares JPEG copies up to 5 MB, keeps pages separate unless the user confirms they coincide, and records exemption facts without approving them. Verify the final form’s exact combined/separate upload semantics and exception process before release.

Country of birth, nationality, issuing country, residence and chargeability are distinct. OCR suggests names, individually checksum-checked dates and document numbers, and a birth country only when explicitly detected. All suggestions require user review; issuer/nationality never substitutes for birth country. The country selector is not an official eligibility list. Final DV-2027 eligible-country decisions, special cases and list changes are unresolved.

Required family information is never package-gated. Spouse/child requirements and U.S. citizen/LPR or court-ordered separation exceptions need final-year verification. A second principal worksheet requires independent eligibility; copied household facts do not establish it.

## Remaining verification

- Official registration opening/closing and result-check dates.
- Final DV-2027 instructions, form labels, country list and any changed definitions.
- Passport exemption evidence, final page-upload behavior and consular-office field semantics.
- Current official fees, separate from the four private preparation prices.
- Final photo validation rules and practical device compatibility.
- The v2.1 pass rendered the six-page archived sample successfully in Chrome and visually inspected pages 2 and 4 for form structure, name/date placement and radio groups. A complete six-page fidelity audit remains open; the current layout is structurally inspired, not certified as an exact reproduction. See [v2.1 evidence](ux-v21/verification.md).

Update `FORM_VERSION`, field conditions, validation, guidance and tests together. Existing paid documents must retain their historical schema version and be offered an explicit review/migration when requirements change; that persistence and migration behavior belongs to the deferred backend.
