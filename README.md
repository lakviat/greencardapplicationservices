# Green Card Application Services

We help people around the world prepare and submit Diversity Visa applications with care, accuracy, and reliable follow-up.

For many families, the U.S. Diversity Visa program is a once-a-year chance to pursue permanent residence in the United States. The application looks simple, but the details matter: eligible country rules, photo specifications, family information, deadlines, confirmation numbers, and official instructions all have to be handled correctly.

Our service is built for people who want professional help avoiding preventable mistakes. We review information, check documents, verify photos, prepare the application, submit during the official registration window, and send the official confirmation details back to the customer.

## What We Do

We provide application preparation and submission support for the U.S. Diversity Visa program.

Our support includes:

- Eligibility review based on the active Diversity Visa year
- Country-of-birth / chargeability guidance based on official instructions
- DV photo requirement review
- Document collection and organization
- Application preparation
- Customer review before submission
- Official submission during the registration period
- Confirmation number and receipt delivery
- Follow-up reminders and status support

The U.S. government makes up to approximately 55,000 diversity visas available annually for people from countries with historically low rates of immigration to the United States. Selection is random, but careful preparation helps protect applicants from avoidable errors.

## Why People Use Our Service

A Diversity Visa entry must be accurate, complete, and submitted on time. Even small mistakes can create serious problems later, especially with names, dates, eligible country selection, spouse or child information, and photo requirements.

We help customers stay organized from the beginning. Our goal is simple: make the application process clearer, calmer, and more carefully handled.

## Photo and Document Requirements

The website includes a dedicated requirements page at `requirements.html`.

Key DV photo requirements from the U.S. Department of State:

- JPEG image
- Exactly 600 x 600 pixels for DV entry
- Square aspect ratio
- 240 KB or less
- Color photo
- Taken within the last 6 months
- Plain white or off-white background
- Full-face view directly facing the camera
- Neutral facial expression with both eyes open
- No copied/scanned driver license or official document photos
- No digital enhancement or alteration that changes appearance

Future selfie feature direction:

- Let applicants take or upload a photo from the web app.
- Guide them to use a real white or off-white background.
- Crop, resize, and compress to the technical DV format.
- Do not rely on automatic background replacement as the default path.
- Send questionable photos to staff review before submission.

Current selfie prototype:

- Opens the device camera when permission is granted.
- Shows a square preview with a face alignment guide.
- Captures a centered square image to `600 x 600` pixels.
- Exports a JPEG with a target under `200 KB` where possible.
- Includes a `Validate photo` button that returns a browser-side pass/fail result for dimensions, JPEG output, file size, and a basic plain-background estimate.
- Provides upload fallback when camera access is blocked.
- Pulses the capture button after the camera is ready.
- Shows official Department of State good photo examples plus a separate bad photo examples block for glasses, tilt/sideways pose, wrong background, expression, and bad lighting.
- Keeps official Department of State source links available without making the page feel crowded.
- Runs locally in the browser until secure backend upload is added.

Photo validation note:

The browser validator is helpful, but it is not a replacement for staff review. It can check technical output and estimate whether the background is light/plain. It cannot reliably prove that the applicant has no glasses, no hat, correct head size, neutral expression, perfect focus, or an acceptable background in every case.

## About Us

We are a Miami-based application support service with experience helping customers prepare important immigration-related submissions and records. We are not a law firm, we are not attorneys, and we do not provide legal advice.

Our role is practical support: reviewing information, organizing documents, checking requirements, submitting authorized entries, and keeping customers updated.

## Important Notice

We are not affiliated with USCIS, the U.S. Department of State, or any U.S. government agency.

Customers may submit their own Diversity Visa entry directly through the official U.S. government website at https://dvprogram.state.gov/.

Our service fee is for preparation, review, submission assistance, document organization, and follow-up support. We cannot guarantee selection, visa approval, green card issuance, entry into the United States, or future U.S. citizenship. The Diversity Visa program is a random lottery, and no private service can increase the chance of selection.

Official Diversity Visa information should always be verified at:

- https://dvprogram.state.gov/
- https://travel.state.gov/content/travel/en/us-visas/immigrate/diversity-visa-program-entry.html

## Development and Security

The public website is a dependency-free static site. Run it locally with
`python3 -m http.server 8080`, then run the repository checks with
`bash scripts/check-static-site.sh` before deployment.

All public pages share `assets/styles.css`. Its root variables define the palette,
card radius, shadows, and maximum-width page gutters. When changing shared
styles, update the stylesheet query version in every HTML page and
`styles_version` in `scripts/check-static-site.sh`; script versions are separate.

Stripe checkout is hosted by Stripe; card data must never be added to the site,
Apps Script, Google Drive records, logs, or this repository. The secure Apps
Script templates in `scripts/` require `ROOT_FOLDER_ID` and `ALLOWED_WEBSITES`
to be configured in each Apps Script project's Script properties before a new
version is deployed. See `SECURITY.md` for architecture boundaries and private
vulnerability reporting.

## Mobile Browser Regression

The homepage places photos before the introduction at widths up to 860px and
keeps the desktop two-column layout. Package links select the requested package
and scroll directly to the form. The heading receives focus for assistive
technology, but only keyboard navigation shows its focus outline.

Run `bash scripts/check-static-site.sh` for deterministic checks. With the existing
Playwright installation and Chromium, WebKit, and Firefox available, run:

```sh
MOBILE_BASE_URL=https://127.0.0.1:8443 node scripts/check-mobile-layout.cjs
```

Serve the repository on local HTTPS for cross-browser checks. WebKit upgrades
HTTP subresources under the production `upgrade-insecure-requests` CSP; an HTTP-only
preview can therefore appear unstyled even when Chromium loads it. Do not disable
the production CSP to work around this. The runner permits a self-signed
certificate only for loopback previews, intercepts external requests, and never
sends real applications or payments. If Playwright is installed globally, set
`NODE_PATH` to that installation's `node_modules` directory.

Browser emulation covers responsive layout and interactions, not every physical
device behavior. Review the local version on a real phone before deployment,
especially browser toolbar changes, the software keyboard, camera permissions,
and file selection.

## Conversion Measurement and Campaigns

Pricing cards select the corresponding form package and Stripe Payment Link.
Links such as `/?package=couple#apply` preselect a package without submitting
anything. Production prices are $24, $44, $64, and $94 USD, respectively.

Checkout uses one required agreement covering private paid support, linked terms,
privacy and refunds, beginning service after payment, and necessary application
contact. The payload derives the legacy consent flags from this single checkbox
for compatibility with deployed intake scripts. It does not grant marketing
permission. Registration alerts have their own required permission and a separate,
optional, initially unchecked marketing opt-in.

Returning from Stripe restores editable details. An unchanged request can reopen
checkout without dispatching a duplicate; revised information gets a fresh intake
reference after a 125-second cooldown following the previous request's settlement.
This only protects retries in the same page session, not across tabs or reloads.
The page cannot establish payment status: check the Stripe receipt or contact
support before paying again.

With analytics consent, `assets/site-metrics.js` records the following GA4 funnel:

| Event | Meaning |
| --- | --- |
| `view_item_list` | The pricing section became visible. |
| `select_item` | A visitor selected a preparation package. |
| `form_view` / `form_start` | The request form was seen / interacted with. |
| `validation_error` | A required, format, constraint, or upload check failed; no field values are sent. |
| `request_dispatch` | An application or notification request was dispatched, not confirmed received. |
| `begin_checkout` | A validated application request resolved and Stripe navigation was initiated, not a payment. |
| `cta_click` | A tagged call to action was clicked, with an allowlisted location. |

No `purchase` or confirmed-lead event is emitted by this static site. Count actual
sales in Stripe, not by form submissions, redirects, or a browser return URL.
Before optimizing ads for purchases, connect a trusted backend to verified Stripe
payment events, deduplicate by transaction ID, and reconcile the existing
`client_reference_id` against the intake record. That backend and account setup
are not part of this static repository. Apps Script currently uses opaque
`no-cors` responses; a resolved request does not prove that intake was stored.
Verify intake delivery and payment matching operationally before buying traffic.

In GA4, create a funnel exploration using the events above. **Disable Enhanced
Measurement form interactions and automatic history-based page views in the web
stream**, and review other automatic measurement for unexpected fields. Client
flags alone do not replace these account settings. Verify events in DebugView or
Realtime after deploying; configure custom dimensions for `cta_location`,
`cta_id`, and `error_category` if needed. Rejection or withdrawal of analytics
consent stops this site's custom events. No names, emails, phone numbers, country
selections, file details, raw referrers, or query strings are added to them.

Campaign attribution accepts only complete, exact triples:

| Parameter | Allowed values |
| --- | --- |
| `utm_source` | `newsletter`, `google`, `facebook`, `instagram` |
| `utm_medium` | `email`, `cpc`, `social` |
| `utm_campaign` | `dv-preparation`, `photo-checklist`, `family-guide` |

Example opt-in email campaign link:
`https://greencardapplicationservices.com/?utm_source=newsletter&utm_medium=email&utm_campaign=dv-preparation#pricing`.
Unknown or partial campaign values are dropped. Campaign values are not persisted
across pages, and click IDs are not forwarded; this is privacy-limited attribution,
not complete Google Ads conversion attribution. Adjust account-side attribution
only with the appropriate consent and purchase-verification infrastructure.

The costs article, photo requirements, and family guide provide useful landing
pages for educational campaigns. Send only to contacts with appropriate marketing
permission, include sender identification and a working unsubscribe mechanism,
and use the government dates rather than manufactured urgency. This change does
not send email or launch paid campaigns. Check advertising-platform restrictions
for government-document/immigration assistance before launching ads.

After deployment, submit the updated sitemap in Search Console and monitor
indexing, landing-page engagement, package selection, checkout starts, and
Stripe-confirmed purchases separately. Search rankings and sales improvements
are not guaranteed by metadata or visual changes.

## Official Fees and Dates

The State Department's [September 16, 2025 final rule](https://www.federalregister.gov/documents/2025/09/16/2025-17851/schedule-of-fees-for-consular-services-department-of-state-and-overseas-embassies-and)
established a $1 electronic DV registration fee, effective that day. Do not
describe current official entry as universally free. Government fees are separate
from the site's preparation prices; consult the active-year instructions.
The homepage countdown targets **October 7, 2026 at noon Eastern**, explicitly
labeled a planning estimate, not an official opening or payment deadline.
Expired or invalid targets show a source-checking message rather than claiming
registration has opened. Change the target only after reviewing official sources;
never silently roll the estimate forward.

## DV-2026 Eligible Countries

This historical list is based on the U.S. Department of State DV-2026 instructions
and matches the country dropdown used on the website. It is not confirmation of
current-year eligibility. Refresh the dropdown and this list against the active
DV instructions before using them for current-year targeting.

Historical country reference, one country per line:

```text
Afghanistan
Albania
Algeria
Andorra
Angola
Antigua and Barbuda
Argentina
Armenia
Australia
Austria
Azerbaijan
Bahamas
Bahrain
Barbados
Belarus
Belgium
Belize
Benin
Bhutan
Bolivia
Bosnia and Herzegovina
Botswana
Brunei
Bulgaria
Burkina Faso
Burundi
Cabo Verde
Cambodia
Cameroon
Central African Republic
Chad
Chile
Comoros
Congo, Democratic Republic of the
Congo, Republic of the
Costa Rica
Cote d'Ivoire
Croatia
Cyprus
Czech Republic
Denmark
Djibouti
Dominica
Ecuador
Egypt
Equatorial Guinea
Eritrea
Estonia
Eswatini
Ethiopia
Fiji
Finland
France
Gabon
Gambia
Georgia
Germany
Ghana
Greece
Grenada
Guatemala
Guinea
Guinea-Bissau
Guyana
Iceland
Indonesia
Iran
Iraq
Ireland
Israel
Italy
Japan
Jordan
Kazakhstan
Kenya
Kiribati
Kosovo
Kuwait
Kyrgyzstan
Laos
Latvia
Lebanon
Lesotho
Liberia
Libya
Liechtenstein
Lithuania
Luxembourg
Madagascar
Malawi
Malaysia
Maldives
Mali
Malta
Marshall Islands
Mauritania
Mauritius
Micronesia
Moldova
Monaco
Mongolia
Montenegro
Morocco
Mozambique
Myanmar
Namibia
Nauru
Nepal
Netherlands
New Zealand
Nicaragua
Niger
North Korea
North Macedonia
Norway
Oman
Palau
Panama
Papua New Guinea
Paraguay
Peru
Poland
Portugal
Qatar
Romania
Russia
Rwanda
Saint Kitts and Nevis
Saint Lucia
Saint Vincent and the Grenadines
Samoa
San Marino
Sao Tome and Principe
Saudi Arabia
Senegal
Serbia
Seychelles
Sierra Leone
Singapore
Slovakia
Slovenia
Solomon Islands
Somalia
South Africa
South Sudan
Spain
Sri Lanka
Sudan
Suriname
Sweden
Switzerland
Syria
Taiwan
Tajikistan
Tanzania
Thailand
Timor-Leste
Togo
Tonga
Trinidad and Tobago
Tunisia
Turkey
Turkmenistan
Tuvalu
Uganda
Ukraine
United Arab Emirates
United Kingdom
Uruguay
Uzbekistan
Vanuatu
Vatican City
Yemen
Zambia
Zimbabwe
```

Readable list:

- Afghanistan
- Albania
- Algeria
- Andorra
- Angola
- Antigua and Barbuda
- Argentina
- Armenia
- Australia
- Austria
- Azerbaijan
- Bahamas
- Bahrain
- Barbados
- Belarus
- Belgium
- Belize
- Benin
- Bhutan
- Bolivia
- Bosnia and Herzegovina
- Botswana
- Brunei
- Bulgaria
- Burkina Faso
- Burundi
- Cabo Verde
- Cambodia
- Cameroon
- Central African Republic
- Chad
- Chile
- Comoros
- Congo, Democratic Republic of the
- Congo, Republic of the
- Costa Rica
- Cote d'Ivoire
- Croatia
- Cyprus
- Czech Republic
- Denmark
- Djibouti
- Dominica
- Ecuador
- Egypt
- Equatorial Guinea
- Eritrea
- Estonia
- Eswatini
- Ethiopia
- Fiji
- Finland
- France
- Gabon
- Gambia
- Georgia
- Germany
- Ghana
- Greece
- Grenada
- Guatemala
- Guinea
- Guinea-Bissau
- Guyana
- Iceland
- Indonesia
- Iran
- Iraq
- Ireland
- Israel
- Italy
- Japan
- Jordan
- Kazakhstan
- Kenya
- Kiribati
- Kosovo
- Kuwait
- Kyrgyzstan
- Laos
- Latvia
- Lebanon
- Lesotho
- Liberia
- Libya
- Liechtenstein
- Lithuania
- Luxembourg
- Madagascar
- Malawi
- Malaysia
- Maldives
- Mali
- Malta
- Marshall Islands
- Mauritania
- Mauritius
- Micronesia
- Moldova
- Monaco
- Mongolia
- Montenegro
- Morocco
- Mozambique
- Myanmar
- Namibia
- Nauru
- Nepal
- Netherlands
- New Zealand
- Nicaragua
- Niger
- North Korea
- North Macedonia
- Norway
- Oman
- Palau
- Panama
- Papua New Guinea
- Paraguay
- Peru
- Poland
- Portugal
- Qatar
- Romania
- Russia
- Rwanda
- Saint Kitts and Nevis
- Saint Lucia
- Saint Vincent and the Grenadines
- Samoa
- San Marino
- Sao Tome and Principe
- Saudi Arabia
- Senegal
- Serbia
- Seychelles
- Sierra Leone
- Singapore
- Slovakia
- Slovenia
- Solomon Islands
- Somalia
- South Africa
- South Sudan
- Spain
- Sri Lanka
- Sudan
- Suriname
- Sweden
- Switzerland
- Syria
- Taiwan
- Tajikistan
- Tanzania
- Thailand
- Timor-Leste
- Togo
- Tonga
- Trinidad and Tobago
- Tunisia
- Turkey
- Turkmenistan
- Tuvalu
- Uganda
- Ukraine
- United Arab Emirates
- United Kingdom
- Uruguay
- Uzbekistan
- Vanuatu
- Vatican City
- Yemen
- Zambia
- Zimbabwe
