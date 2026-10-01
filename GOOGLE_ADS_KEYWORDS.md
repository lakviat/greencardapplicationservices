# Google Ads Search Keyword Plan

Last updated: 2026-09-30

This file is the campaign keyword map. Google Ads keywords must be configured in Google Ads; putting a long keyword list or a `meta keywords` tag in the website does not create campaign targeting or improve Google Search rankings.

## Final URLs and tracking

The site records campaign attribution only for these exact combinations (see `README.md`); anything else is dropped, so use them verbatim:

| Intent | Final URL |
| --- | --- |
| Application help | `https://greencardapplicationservices.com/?utm_source=google&utm_medium=cpc&utm_campaign=dv-preparation#pricing` |
| Photo and document review | `https://greencardapplicationservices.com/requirements.html?utm_source=google&utm_medium=cpc&utm_campaign=photo-checklist` |
| Spouse and family | `https://greencardapplicationservices.com/married-couples.html?utm_source=google&utm_medium=cpc&utm_campaign=family-guide` |

Package deep links (`/?package=single#apply`, also `couple`, `family`, `premium`) preselect a package. Use them only for ad groups where the searcher already named a household type, so people are not skipped past the price comparison.

## Offer and ad copy

Current one-time preparation prices are $24 Single, $44 Couple, $64 Family, and $94 Premium. Lead with the low entry price, but always state that government fees are separate. Government fees and the private service fee are different things.

Responsive search ad assets (headlines are at most 30 characters and descriptions at most 90; counts checked):

- Headlines: "DV Lottery Application Help", "From $24 - One-Time Fee", "Photo & Document Review", "Family Details Checked", "You Approve Before Submission", "Independent Paid Service", "Secure Checkout With Stripe", "Clear Refund Terms", "Prepare Before Registration"
- Descriptions: "Private DV Lottery application help. Photo, document and family-detail review." / "Choose Single, Couple, Family or Premium. Government fees are separate." / "Not a government site. Selection is random and never guaranteed." / "Review your prepared entry, then submit yourself or authorize us. Pay securely on Stripe."

Pin nothing except the "not a government site" description to a visible position if the platform asks for a disclaimer. Ad copy must match the landing page. Any pricing, refund, or timing claim must match the current site and policies.

## Campaign structure

Start with Search campaigns using exact and phrase match. Keep each ad group tightly aligned with one landing page. Review the Search Terms report frequently and add negatives before expanding to broad match.

### 1. Application service intent

Landing page: application-help URL above (`#pricing`).

- [dv lottery application services]
- "dv lottery application services"
- [green card lottery application service]
- "green card lottery application service"
- [dv lottery application help]
- "dv lottery application help"
- [green card lottery application help]
- "green card lottery application help"
- [diversity visa application support]
- "diversity visa application support"
- [help applying for dv lottery]
- "help applying for dv lottery"
- [dv lottery entry assistance]
- "dv lottery entry assistance"
- [guided dv lottery application]
- "guided dv lottery application"
- [dv lottery preparation service]
- "dv lottery preparation service"

Recommended ad wording: private DV entry preparation, guided application support, photo and document review, family-detail checks, and final review before submission.

Do not use: "official service," "government service," "guaranteed selection," "win a green card," "increase your odds," or "we check your result."

### 2. Photo and error-checking intent

Landing page: photo-and-document URL above.

- [dv lottery photo review]
- "dv lottery photo review"
- [dv lottery photo validation]
- "dv lottery photo validation"
- [green card lottery photo requirements]
- "green card lottery photo requirements"
- [dv lottery document review]
- "dv lottery document review"
- [dv lottery error checking]
- "dv lottery error checking"
- [dv lottery application mistakes]
- "dv lottery application mistakes"

### 2b. Spouse and family intent

Landing page: spouse-and-family URL above (or `/?package=couple#apply` / `/?package=family#apply` when the query names a couple or children).

- [dv lottery for married couples]
- "dv lottery spouse application"
- "dv lottery family application help"
- "dv lottery children included"
- "can both spouses enter dv lottery"

### 3. Dates and status information

Landing page: `https://greencardapplicationservices.com/dv-lottery-dates-status.html`

- [when does dv lottery open]
- "when does dv lottery open"
- [dv lottery registration dates]
- "dv lottery registration dates"
- [dv lottery opening date]
- "dv lottery opening date"
- [dv lottery status check]
- "dv lottery status check"
- [dv lottery results check]
- "dv lottery results check"
- [diversity visa status check]
- "diversity visa status check"

This page must remain informational. Ad copy should promise official links and guidance, not that this private website determines or retrieves selection results.

### 4. Country-specific intent

Use separate ad groups and map each group to its matching page.

- Uzbekistan: [green card lottery uzbekistan], "dv lottery uzbekistan", "green card application help uzbekistan"
- Kazakhstan: [green card lottery kazakhstan], "dv lottery kazakhstan", "green card application help kazakhstan"
- Kyrgyzstan: [green card lottery kyrgyzstan], "dv lottery kyrgyzstan", "green card application help kyrgyzstan"
- Tajikistan: [green card lottery tajikistan], "dv lottery tajikistan", "green card application help tajikistan"

## Negative keyword starter list

Apply negatives carefully at campaign level and review real search terms before expanding the list.

- jobs
- employment
- citizenship test
- passport renewal
- asylum
- student visa
- work visa
- visa bulletin
- adjustment of status
- USCIS login
- lottery numbers
- Powerball
- Mega Millions
- casino
- betting
- guaranteed win
- hack
- generator

Consider "free" only after reviewing search-term quality. The official DV entry process and this private paid support service are different, so an overly broad negative can remove useful research traffic.

## Program-year keywords

Registration for a new Diversity Visa program year is expected to open soon, and searchers add the program year to queries. Confirm the active program name from the Department of State announcement before adding year-specific terms (for example "dv lottery 20XX registration"), and keep them on the dates-and-status page unless the page text names the same year. Do not state an opening date in ads; point to the official source.

## Weekly tuning routine

1. Search terms report: add irrelevant queries as negatives; promote converting queries to exact match.
2. Compare click-through rate and checkout starts by ad group, not only clicks. A checkout start is intent, not revenue; confirm purchases in Stripe.
3. Pause keywords that spend without reaching the form after a meaningful sample. Do not judge on a handful of clicks.
4. Split-test the lead headline between price ("From $24") and trust ("You approve before submission") one at a time.
5. Check mobile and desktop separately; most of this audience is on phones, so review the mobile landing experience with every change.

## Multilingual campaigns

Do not place Russian, Kazakh, Kyrgyz, Uzbek, or Tajik keyword lists in English page metadata. Launch a language campaign only after a real, human-reviewed landing page exists in that language. Each translated route should include translated visible content, title, description, canonical URL, and reciprocal `hreflang` annotations.

Russian starter themes for native review before campaign launch:

- "лотерея грин кард"
- "помощь с заявкой dv lottery"
- "проверка фото dv lottery"
- "даты регистрации dv lottery"
- "проверка статуса dv lottery"

Kazakh, Kyrgyz, Uzbek, and Tajik terms require native-speaker review before they are used in paid ads. Direct translation without review is risky for payment, government-affiliation, and service claims.

## Conversion setup

Track these as separate events:

1. Application intake successfully dispatched.
2. Stripe checkout opened.
3. Payment confirmed by Stripe webhook.

Only the server-verified payment event should be treated as a purchase. A checkout click is an intent event, not confirmed revenue.

## Launch checklist

1. Verify each ad group's final URL and message match.
2. Keep "Not a government website" visible on every landing page.
3. Do not claim guaranteed selection, improved odds, or official status-check access.
4. Submit `https://greencardapplicationservices.com/sitemap.xml` in Google Search Console.
5. Confirm Google Ads and Analytics tags in Tag Assistant.
6. Start with phrase and exact match, a small budget, and location/language targeting aligned to the landing page.
7. Review search terms, conversions, and negatives daily during the first week.
