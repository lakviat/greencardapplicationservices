# Mobile form interaction fixes — October 17, 2026

Starting point: latest `main`, `f280f19`. Workspace asset release: `20261017-workspace-v23`. The provisional form schema and prices are unchanged.

## Findings and changes

- Mobile WebKit reproduced both reported country failures: tapping Kyrgyzstan after typing `Kyr`, and United States after typing `United`, left the partial query in the input. Cancelling `pointerdown` suppressed the touch-generated click. Suggestions now use buttons with `role="option"`; only mouse-down default focus is prevented. Touch selection and keyboard selection both commit the canonical country name.
- Address and contact inputs have explicit autocomplete sections/tokens to reduce incorrect browser autofill. Both input and change events persist answers. Birth country and eligibility remain independently entered.
- A square crop at zoom 1 has no space to pan. Position sliders now disable only on axes with no available space, explain when zoom is needed, and enable as soon as movement is possible. Reset framing restores the original centered crop. Tests compare rendered pixels at both ends of each enabled axis.
- The actions sheet highlights the selected package, one-time price, and purchase entry point, with separate Save, Review, Missing Fields, and Exit actions. Requirements / Help is removed from this menu. Purchased preparations show package details without another purchase button. Existing account, consent, payment verification, and Premium gates remain enforced.

## Verification

- `npm run check`: static/site/privacy checks, 27 schema/UX tests and seven legacy OCR parser tests passed.
- `npm run test:browser`: Chromium, WebKit, Firefox; existing journeys at 320, 390, 430 and 1440 pixels; keyboard search, OCR review, accessibility, focus and viewport regressions passed.
- New `tests/preparation/form-browser.cjs`: touch selection in birth, eligibility, mailing, residence, spouse and child countries; invalid-country/date/email correction; optional-name/ZIP controls; full fictional household with photographs and both passport pages; crop zoom/axis/reset controls; 100% completeness, review and preview; actions-sheet accessibility and disabled-provider behavior passed in all three engines.
- `node tests/backend/browser.mjs`: real local numeric OTP, paid fixture, country taps, autosave, database checks and reopening saved contact/country values passed. Paid menu does not offer repurchase. Fixtures are synthetic and removed afterward.
- Visual inspection: mobile WebKit actions sheet and crop preview. No real applicant data or payments were used.

## Production boundary

The production health endpoint was checked during this work. Accounts, cloud saving, checkout, PDF download and email delivery still report disabled. These local tests do not establish Gmail delivery or live Stripe readiness. See [backend activation prerequisites](backend-plan.md). Physical iOS keyboard/contact autofill and camera handoffs remain device QA.
