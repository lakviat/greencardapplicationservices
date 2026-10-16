# MASTER IMPLEMENTATION REQUIREMENTS
## Green Card Application Services — Complete Business Model Rebuild v2.0

**Website:** https://greencardapplicationservices.com

**Project objective:** Transform the existing manual Diversity Visa application assistance website into a premium, self-service, interactive DV Lottery preparation platform.

This is a substantial product rebuild, not a simple styling update. First examine the existing repository, architecture, backend services, integrations, current pages, payment implementation, deployment configuration, and available reusable components. Preserve what works, but replace the old business workflow with the new requirements below.

**IMPORTANT: We want actual production-quality implementation, not just design suggestions, wireframes, placeholder buttons, or a written plan. Work in a feature branch, implement the functionality, test it, and prepare a pull request with a detailed change summary.**

---

# 1. NEW BUSINESS MODEL

The service is changing from manual DV Lottery preparation/submission assistance into a mostly automated, guided document-preparation platform.

Customers should be able to:

1. Visit the website.
2. Click **Start Preparation**.
3. Immediately open an interactive, PDF-style DV Lottery form.
4. Complete the form directly inside the familiar official-form-inspired document layout.
5. Receive animated, intelligent field-by-field guidance.
6. Upload photos and required passport documents.
7. View remaining requirements and their completion progress.
8. Edit their answers as often as needed.
9. Pay for permanent cloud saving, cross-device resumption, and preparation-packet export.
10. Download their prepared worksheet or receive a secure document download link by email.
11. Use their worksheet to complete the actual government entry separately.

This is **not an official government submission service**. No government entry is submitted or confirmed by purchasing our service.

Our core value proposition:

**"Prepare your DV Lottery entry using a familiar form, enhanced with intelligent guidance, automatic checks, progress tracking, and secure PDF delivery."**

Use simple, transparent language everywhere.

---

# 2. MOST IMPORTANT REQUIREMENT — INTERACTIVE DOCUMENT EXPERIENCE

This is the highest-priority feature of the entire project.

DO NOT replace the existing application with a typical multi-page form wizard featuring separate cards or isolated questions.

We want the actual **document-style form to be the main interface**, with interactive input controls built into it.

## Official visual reference

Use the archived six-page Electronic Diversity Visa Entry Form (DS-5501) from the U.S. Department of State:

https://travel.state.gov/content/dam/visas/Sample%20E-DV%202017%20Lottery.pdf

Study all six pages before implementation.

Match the reference document's recognizable visual structure:

- Page proportions and general document appearance.
- Form sections and question order.
- Yellow section headings.
- Input-field rows and grouping.
- Labels, selection areas, checkboxes, and dropdown positions.
- Part One — Entrant Information.
- Part Two — Derivatives.
- Natural document scrolling.
- Continuity between document sections.

**Critical distinction:** Replicate the functional document layout and familiar field structure, but use our own Green Card Application Services masthead. Do not reproduce the government seal or use branding that could make customers believe they are on the actual government website.

Show a persistent yet discreet label:

"Independent DV Preparation Worksheet — Not an Official Government Submission"

Use the archived version only as a baseline. Incorporate newer confirmed legal requirements and build the form so that future DV-year changes can be applied without rewriting the UI.

## Actual editing technology

The user should feel as if they are completing a PDF directly.

However, implement the editing interface using responsive HTML/CSS/React controls backed by structured application data, unless the existing stack offers an equally robust solution.

The experience must feel like a real editable PDF:

- Fields occupy the correct places within the document.
- Selecting a field activates the input.
- Changing information immediately updates the document.
- The complete document remains scrollable.
- Text entry is easy on mobile.
- The eventual PDF output matches the document preview.

Use PDF rendering for preview/export if appropriate, but do not require users to manipulate static PDF annotations or tiny native PDF input boxes.

The goal is document fidelity with modern mobile usability.

---

# 3. START PREPARATION USER FLOW

## Homepage entry point

Replace the old request-first workflow with a prominent primary action:

**Start Free Preparation**

Supporting description:

"Complete your DV Lottery preparation form with interactive guidance. Review your information for free and pay only when you're ready to save or receive your prepared packet."

When clicked:

- Immediately open the preparation workspace.
- Do not force account registration first.
- Do not require package selection first.
- Do not send the user to Stripe immediately.
- Do not open the old incomplete intake form.
- Avoid unnecessary loading screens.

Prefer a dedicated full-screen application workspace with its own URL so browser navigation, accessibility, and mobile layouts work reliably.

## Initial state

- Default package: Single.
- Progress: 0%.
- Document fields empty.
- First required field highlighted.
- Guidance activated.
- Sticky bottom progress/navigation bar visible.
- Main document immediately usable.

The first experience should feel polished and intuitive within seconds.

---

# 4. DOCUSIGN / ADOBE-INSPIRED FIELD NAVIGATION

Build the intelligent document-guidance layer discussed previously.

## Focused field highlighting

For the currently active required field:

- Smoothly scroll it into view.
- Add a tasteful blue or gold border.
- Show a small animated directional arrow.
- Apply one subtle pulse animation.
- Display concise instructions when necessary.
- Automatically position keyboard focus.

After the customer completes a field, offer an obvious next-field action. Automatically advance for simple controls where doing so is natural, without unexpectedly scrolling while they are still typing.

Example:

Customer completes First Name.

The interface highlights Last Name.

Customer completes Last Name.

The interface highlights the next required field.

For complicated questions, provide additional contextual guidance rather than guessing an answer.

## Bottom navigation

Implement a sticky navigation bar at the bottom of the workspace.

It should display:

- Overall completion percentage.
- Small animated progress bar.
- Current section.
- Previous field/section.
- Next required field.
- Remaining required items.
- Save Progress control.
- Review control when applicable.

Keep the bar compact, especially on mobile.

## Missing-information navigator

Implement a floating button:

**"5 items remaining"**

When tapped, open a polished bottom sheet on mobile or side panel on desktop.

Example:

- Birth city — Missing
- Country of eligibility — Needs review
- Entrant photo — Not uploaded
- Passport scan — Missing
- Child photo — Missing

Selecting an item should scroll the exact document field into view and highlight it.

## Validation visual language

- Blue: currently selected.
- Neutral: incomplete but not yet reviewed.
- Green: completed and structurally valid.
- Amber: warning, unclear answer, or manual verification recommended.
- Red: required information missing or invalid after attempted completion.

Never claim that an automated check guarantees government acceptance or eligibility.

Support keyboard navigation and screen readers. Respect reduced-motion accessibility settings.

---

# 5. FORM CONTENT AND QUESTIONS

The preparation form must represent the actual fields required for an electronic DV entry, not simply collect an applicant's first name and email.

Build a versioned form schema. Start with the archived DS-5501 question order, reconcile it with the latest official instructions, and update for DV-2027 when the final government form is confirmed.

## Principal entrant information

Cover:

- Family/last name.
- First/given name.
- Middle name and applicable "no middle name" selection.
- Sex as required by the active official form.
- Date of birth.
- City of birth.
- Country of birth.
- Country of DV eligibility/chargeability.
- Explanation or alternative eligibility where applicable.
- Entrant photograph.
- Full mailing address, including applicable in-care-of, street, city, province/state, postal code, and country.
- Country of current residence.
- Phone if applicable.
- Email and confirmation.
- Highest level of education.
- Current marital status.
- Number and details of children required by official rules.

## Passport requirements

The March 2026 DS-5501 rule adds passport information and a passport biographic/signature-page scan requirement for DV-2027, with limited exceptions.

Include fields for information actually required by the final official form, a secure scan-upload control, and any officially defined exemption paths.

Do not assume the archived 2017 form contains all current requirements.

## Derivative details

Dynamically create spouse and child sections as required.

Use official requirements to determine which people must be listed, including applicable biological, adopted, and stepchildren.

Each relevant person may require:

- Names.
- Date of birth.
- Sex.
- Birth city.
- Birth country.
- Required photograph.
- Other fields in the active official instructions.

Do not arbitrarily limit family membership to three people.

A family member appearing as a derivative is NOT automatically an independently eligible principal DV entrant.

## Smart inputs

Implement:

- Country dropdown search.
- Accurate country-name mappings.
- Safe date selectors.
- Context-sensitive help.
- Conditional field groups.
- Optional-field indicators.
- Required-field validation.
- Passport name autofill where supported.
- Clear explanations for country-of-eligibility questions.
- Duplicate-entry risk reminders.

Never use AI to fabricate personal information or automatically choose a complex eligibility answer without user confirmation.

---

# 6. AUTOMATIC PACKAGE SELECTION

**The four existing prices must remain unchanged.**

| Package | Price |
|---|---|
| Single | $9.99 |
| Couple | $19.99 |
| Family | $29.99 |
| Premium | $39.99 |

All prices are USD, one-time payments, with no recurring subscription.

## Default package

Every new preparation starts on:

**Single — $9.99**

No initial package selection required.

## Adaptive package recommendations

The interface should adjust the suggested package based on the customer's situation.

Examples:

- One principal entry: Single.
- Customer elects to prepare a second independently eligible spouse's entry: Couple.
- Household with children and additional family-preparation needs: recommend Family.
- Customer chooses the enhanced Premium service: Premium.

When the system detects relevant information, update the recommendation and explain why.

Example message:

"Your application now includes family details. The Family package may be a better fit for your household. Review your package before checkout."

**Important business rule:** Adding a spouse or child who is legally required on a Single principal entry must never make that required disclosure conditional on purchasing a more expensive plan.

Always collect all legally required family members, even for Single. Package differences must reflect actual deliverables, such as preparation of multiple independent entry worksheets, bundled organization, additional guidance, or genuine enhanced services.

Never silently increase an amount after a customer has agreed to pay.

## Price visibility

Keep a small unobtrusive package indicator within the bottom navigation or checkout summary.

Examples:

"Single · $9.99"

"Recommended: Couple · $19.99"

"Family · $29.99"

Allow package review before payment.

Couple should offer genuine bundled convenience or features, not falsely advertise a discount compared with two Single purchases.

Premium must have explicitly defined and deliverable additional benefits. If human reviews or Zoom calls are no longer provided, remove those promises and require owner approval of the replacement benefits before enabling Premium checkout.

---

# 7. PHOTO UPLOAD AND VALIDATION

Make photo preparation a prominent part of the document itself, not a disconnected tool.

When the user reaches the photo question, display an elegant photo upload block inside the form.

Features:

- Take photo using camera.
- Upload from device.
- Preview photo.
- Remove and replace.
- Crop using proper aspect ratio.
- Validate image format, dimensions, and size.
- Display framing assistance.
- Show likely problems as warnings where technically supportable.
- Show examples of acceptable and unacceptable photographs.
- Clearly distinguish automated technical checks from visual judgment.

Statuses:

- Photo missing.
- Photo uploaded.
- Format problem.
- Possible quality problem.
- Technical checks passed.

Implement this for every required entrant, spouse, and child photograph.

Reuse the existing website's photo-tool functionality where practical.

Do not digitally alter an applicant's facial appearance or promise that the government will accept the photograph.

The checklist and bottom progress indicator must update immediately after photo changes.

---

# 8. SAVE PROGRESS — PAID FEATURE

Saving progress is a paid benefit under the new business model.

## Free experience

Customers can start and fill out the document without paying.

During the active preparation session:

- Permit editing.
- Permit moving between sections.
- Permit correcting answers.
- Permit viewing progress.
- Permit reviewing entered information.
- Preserve working data sufficiently to survive ordinary navigation and checkout initiation without unexpectedly losing it.

Do not promise permanent cloud storage for unpaid customers.

Before leaving an unpaid, unsaved draft, warn clearly:

"Your progress has not been saved to your account. Unlock Save Progress to return later."

Avoid retaining sensitive passport scans or children's information in unsecured browser storage. If temporary server-side drafts are needed for safe checkout, protect them and automatically expire them according to a published policy.

## Save action

When clicking Save Progress before purchase:

Open an elegant, clearly priced modal:

**Save your DV preparation and continue anytime**

Benefits:

- Secure cloud saving.
- Resume from any supported device.
- Unlimited corrections within the purchased preparation.
- Persistent document progress.
- PDF preparation and delivery once completed.

Display the applicable package price.

The customer may complete checkout immediately or return to the unsaved working form.

## After payment

- Enable persistent saving automatically.
- Create or connect the customer's secure account.
- Support email verification or passwordless login.
- Allow authenticated return to drafts.
- Restore field values and uploaded documents.
- Preserve the selected DV year and form schema version.
- Save changes automatically.
- Show saved/saving/error statuses honestly.

**A paid customer must not be charged again for exporting or emailing the same purchased preparation packet.**

If payment happens at the end instead of during Save Progress, the same purchase must unlock both functions.

For package upgrades, present any incremental price explicitly and require consent.

---

# 9. REVIEW AND COMPLETION

Implement a beautiful final review screen within the document workspace.

Show:

- Entrant information status.
- Eligibility questions requiring confirmation.
- Address and contact status.
- Passport status.
- Entrant photo status.
- Spouse details where applicable.
- Children details where applicable.
- Remaining fields.
- Warnings.
- Current package and price.

When the document is complete, show a clear confirmation state:

**"Your preparation worksheet is ready."**

Subtitle:

"Your information has passed our available completeness and format checks. Please verify every answer before using it for an official DV entry."

Do not describe automated checks as a legal eligibility determination or guarantee that the entry will be accepted.

A document with incomplete required information should not receive a misleading "100% ready" status.

Provide an **Edit** action next to every review section.

---

# 10. PDF GENERATION AND EMAIL DELIVERY

## Core requirement

After successful payment and completion, programmatically generate the customer's personalized preparation PDF.

The PDF should closely reflect the document layout used during editing, including section ordering and all applicable fields.

Clearly label it:

**DV Lottery Entry Preparation Worksheet — Unofficial**

Include:

- Relevant DV year.
- Prepared entrant details.
- Applicable spouse and child information.
- Verified user-entered answers.
- Photo/document checklist.
- Clear field references.
- Date prepared.
- Version of the form requirements used.
- Official submission instructions.
- Disclaimer.

Do not imitate a completed government filing or invent government confirmation numbers.

## Export features

Paid customers should have:

- Download PDF.
- Email secure download link.
- Reopen document.
- Make corrections.
- Regenerate PDF.
- Redownload purchased preparation.
- Review purchased package.

Do not charge repeatedly for corrections to the same purchased preparation.

## Email delivery

Use a transactional email provider such as Resend or SendGrid, depending on existing infrastructure.

Example subject:

"Your DV Lottery Preparation Worksheet Is Ready"

Email contents:

- Customer greeting.
- Confirmation that their preparation packet is available.
- Clear secure download action.
- Instructions for completing the official government entry.
- Support information.
- Independent-service disclaimer.

Do not attach sensitive passport scans or full applicant records to ordinary outbound emails by default.

Use authenticated or short-lived secure download links, with appropriate access verification.

---

# 11. STRIPE PAYMENT SYSTEM REBUILD

The current website uses an old request-first model with independent Stripe payment links.

Replace that with a secure transaction workflow tied to the exact saved preparation session.

## Payment rules

- Retain four one-time package prices.
- No recurring monthly billing.
- Preserve Stripe as payment processor.
- Calculate payable amounts server-side.
- Never trust client-supplied prices.
- Associate checkout with application ID, selected package, customer ID/email, and DV year.
- Use secure Stripe Checkout sessions where appropriate.
- Verify Stripe webhook signatures.
- Only unlock purchased capabilities after confirmed successful payment.
- Handle pending, failed, canceled, and successful payments separately.
- Make webhook processing idempotent.
- Prevent duplicate charges for the same purchased entitlement.

Do not send application documents through Stripe metadata.

Do not unlock saving/export merely because the customer visits a success URL.

If old static Stripe Payment Links cannot reliably associate a payment with the document being purchased, replace them and update every website reference.

Archive obsolete links only after successful migration and verification.

Keep transaction references and entitlements in the backend, without retaining full payment-card numbers.

## Upgrade behavior

- No charge for ordinary editing of purchased packets.
- Upgrades must be disclosed before payment.
- Never charge automatically because a user adds a child or changes marital status.
- Show any difference in price and obtain confirmation.

---

# 12. CUSTOMER DASHBOARD

After successful purchase, customers need a simple, attractive dashboard.

Primary screen:

**My DV Preparations**

Each entry shows:

- Entrant name.
- DV year.
- Package.
- Completion percentage.
- Last saved date.
- Preparation status.
- Edit document.
- Download PDF when ready.
- Email document.
- Delete preparation.

If supporting multiple independently eligible applicants, show each preparation separately while allowing related household details to be reused safely with confirmation.

Use passwordless email authentication or an existing secure account system, depending on the repository.

Prevent one customer from accessing another customer's data, even when document IDs are guessed.

---

# 13. HOMEPAGE AND WEBSITE REDESIGN

The entire website must reflect the new service.

Maintain the existing professional branding where possible, but make the new offering immediately understandable.

## Homepage hero

Suggested headline:

**Prepare Your DV Lottery Entry With Confidence**

Suggested description:

"Complete a familiar DV entry form with intelligent guidance, instant completeness checks, and easy document navigation. Review for free, then pay once to save your progress and receive your prepared PDF worksheet."

Primary CTA:

**Start Free Preparation**

Secondary CTA:

**See How It Works**

Trust copy:

"Independent preparation service. Not affiliated with the U.S. government. Official entry must be submitted separately."

Do not describe the service as government-authorized or imply that software can improve the chances of being selected.

## How It Works

Replace the old manual process with:

1. Start preparation for free.
2. Complete the guided DV form.
3. Review required information and photo/document status.
4. Pay once to save or export.
5. Receive your prepared worksheet and complete government registration separately.

## Pricing section

Keep the existing four prices but revise package descriptions to match actual automated features.

Package selection should not interrupt the start of preparation.

Emphasize:

- Free to start.
- One-time payment.
- No subscription.
- Secure saving.
- Guided completion.
- PDF preparation.
- Official submission separate.

Do not market a preparation packet as an actual visa application submitted to the government.

---

# 14. REQUIRED WEBSITE DISCREPANCY CLEANUP

Audit and rewrite every page, component, modal, FAQ, legal reference and embedded message describing the old service.

Specific issues already identified:

### Homepage
Remove or rewrite:
- "Human review" promises for automated plans.
- "Manual review included" claims.
- "Submission assistance during the official window."
- "You approve before we submit."
- "Confirmation after official submission."
- "Our team prepares your entry after payment."
- Any suggestion that paying results in government filing.

Replace them with accurate automated preparation, user review, saving, PDF delivery, and independently completed official submission.

### Existing application
Remove the old limited applicant-request form as the primary customer flow.

Replace it with the interactive document workspace.

Do not make users choose and pay for a package before completing the preparation document.

### How It Works page
Completely rewrite the current request → pay → staff review → government submission workflow.

Remove outdated staff-review and manual-submission sections.

### FAQ
Update:
- What am I purchasing?
- When do I pay?
- Can I save progress?
- Can I edit after payment?
- Can I download the PDF?
- Will you submit the entry?
- Does this guarantee eligibility?
- How are couples and children handled?
- What happens if the DV form changes?
- How do I delete my data?
- How are passport documents protected?

Remove statements that the site has no customer accounts or saved drafts once those features are implemented.

### Requirements page
Remove outdated wording promising staff inspection or government filing.

Keep existing useful photo guidance, but clearly describe the actual automated checks and limitations.

Add the passport rule relevant to DV-2027.

### Pricing and costs pages
Update all descriptions to reflect the newly delivered digital service.

Eliminate the arbitrary "up to three applicants" restriction on legally required family disclosures.

### Couples and family guidance
Separate:
- Required derivatives on a principal entry.
- Additional independent principal entry preparation.

Do not treat every spouse or child as a separately eligible principal applicant.

### Policies
Rewrite Terms of Service, Privacy Policy, and Refund Policy to cover:
- Automated guided preparation.
- Paid cloud saving.
- Digital PDF creation and delivery.
- Secure accounts.
- Passport information.
- Sensitive data storage.
- Deletion and retention.
- Recurring access to purchased preparations.
- Digital non-delivery and failed exports.
- Correction and regeneration rights.
- Refunds consistent with applicable law.

Remove outdated legal text authorizing our staff to submit DV entries if submission is no longer offered.

Review final legal policy language before publication.

### Registration dates
Remove the October 18 speculative countdown and any other unconfirmed registration date.

Use official, verified Department of State announcements.

Until announced, show:

"DV-2027 registration dates are awaiting official confirmation."

Keep source links available.

### Entire site
Search the codebase and rendered pages for outdated language, including:

"submission assistance"
"manual review"
"human review"
"we submit"
"our staff"
"authorize us to submit"
"confirmation after submission"
"after payment we review"
"no saved drafts"
"start a request"
"send request"
"up to three applicants"

Review every match, including SEO metadata, structured data, country-specific pages, FAQs, email templates, and old marketing content.

Do not blindly remove legitimate educational explanations of the official government submission process.

---

# 15. PRIVACY, SECURITY AND DATA PROTECTION

This platform will process sensitive information including passport scans, birth dates, addresses, photographs, and children's information.

Security is a launch-blocking requirement.

Implement:

- HTTPS for all pages and APIs.
- Authenticated access to purchased drafts.
- Private document storage.
- Strict user-level database access controls.
- Server-side authorization on every document endpoint.
- Short-lived signed document download URLs.
- Secure session management.
- Verified email ownership.
- Secure file-upload validation.
- File size and format restrictions.
- Malware scanning where supported.
- Protection against unauthorized document access.
- Encryption in transit and at rest.
- Defined retention periods and automated cleanup.
- User-requested deletion.
- Safe logging with no passports or full personal information.
- Strict backend secrets management.
- Reasonable API rate limiting.
- Audit logs for sensitive operations.
- Clear consent for personal-information processing.

Do not put passport scans, application answers, or identity information into URLs, public analytics events, ad tracking, or Stripe metadata.

Keep optional advertising cookies separate from the application workflow.

Do not activate marketing analytics on sensitive preparation pages in a way that exposes personal information.

Review applicable international privacy and child-data obligations before accepting production customer information.

---

# 16. TECHNICAL ARCHITECTURE

First inspect the real repository. Do not unnecessarily replace a working stack.

Preferred architecture if compatible:

**Frontend**
- React/TypeScript or existing site framework.
- Responsive document-based editor.
- Reusable input components.
- Accessible navigation.
- Smooth animations.
- Shared form schema and validation.

**Backend**
- Secure authentication.
- Database-backed application records.
- Payment-entitlement verification.
- Secure uploads.
- PDF generation service.
- Email delivery.
- API authorization.
- Form version management.

**Database**
- Users.
- Preparations.
- Entrants.
- Spouses and children.
- Form versions.
- Field responses.
- Document assets.
- Purchases.
- Entitlements.
- PDF versions.
- Audit events.

Use Supabase if it fits the existing infrastructure; otherwise justify reusing the existing backend.

Build the form from a structured configuration rather than hardcoding each year's fields.

Each field definition should support:
- Stable ID.
- Official reference label.
- Display label.
- Section.
- Type.
- Required conditions.
- Validation rules.
- Help text.
- Field ordering.
- PDF output mapping.
- Effective DV year.

Keep content, logic, user data, and rendering cleanly separated.

---

# 17. MOBILE EXPERIENCE

Mobile must be treated as a first-class platform.

The reference government form is difficult to use on small screens. Our enhanced version should solve that without losing the document feeling.

Requirements:

- Responsive document pages.
- Readable labels.
- Large, comfortable tap targets.
- No horizontal page overflow.
- No tiny PDF text requiring constant zooming.
- Appropriate mobile keyboards.
- Smooth keyboard-aware scrolling.
- Sticky bottom guidance.
- Compact missing-field sheet.
- Photo capture from the phone camera.
- Easy dropdown and date selection.
- No accidental focus loss.
- Fast performance.
- Correct safe-area spacing for modern iPhones.
- Tested at common iPhone and Android viewport sizes.

On desktop, keep the full document visible with optional navigation on the side.

The form should look consistent across both environments.

---

# 18. EXISTING FEATURES TO PRESERVE

Do not unnecessarily delete useful components.

Evaluate and reuse:

- Existing country guides.
- DV requirements content.
- Current photo upload/validation tools.
- Passport autofill, if secure and accurate.
- Useful email and WhatsApp notification functions.
- Stripe integration.
- SEO content and internal links.
- Accessibility improvements.
- Cookie preferences.
- Existing site branding.
- Relevant government-source links.

If a component conflicts with the new business model, refactor or replace it.

Preserve working public URLs where practical and provide proper redirects when routes must change.

---

# 19. IMPLEMENTATION AND TESTING REQUIREMENTS

This must not end as a static mockup.

Build and verify actual behavior.

## Core functional tests

1. Start Preparation opens the interactive form.
2. Single is selected by default.
3. All expected baseline questions are present.
4. Entering information updates the document.
5. The next-field guide scrolls correctly.
6. Arrow and highlight animations behave correctly.
7. Missing fields are identified correctly.
8. Progress percentage updates accurately.
9. Conditional spouse questions appear correctly.
10. Child information does not disappear when changing packages.
11. Package recommendation responds to relevant household changes.
12. No automatic charge occurs from adding family information.
13. Photo uploads and corrections work.
14. Passport uploads follow security and format rules.
15. Save Progress opens the correct payment flow for unpaid users.
16. Successful payment unlocks the correct features.
17. Failed or canceled payment does not unlock features.
18. Existing paid users are not charged twice.
19. Cloud saving works after purchase.
20. Users can sign in and resume on another device.
21. Final review identifies incomplete or questionable items.
22. PDF generation faithfully includes the saved answers.
23. Email delivery works with secure links.
24. Corrections and PDF regeneration work after purchase.
25. User A cannot access User B's records.
26. Deletion requests remove appropriate data.
27. All website copy matches the new business model.
28. Obsolete Stripe payment links are no longer reachable through active purchase buttons.
29. Mobile display works without clipping or excessive zooming.
30. No page claims that a worksheet is an officially submitted DV entry.

## Additional quality checks

- Unit tests for schema, field validation, progress calculation, and pricing.
- Integration tests for backend endpoints and Stripe webhooks.
- End-to-end tests for full customer journeys.
- Keyboard and accessibility tests.
- Mobile screenshots.
- PDF rendering and content verification.
- Responsive testing.
- Error and loading states.
- Duplicate payment/webhook tests.
- Email delivery failure and retry tests.
- Privacy/security checks.
- Regression tests for existing public pages.
- Basic performance evaluation.

No hardcoded credentials, fake payment confirmations, mock production records, or placeholder export functionality.

---

# 20. DEVELOPMENT PROCESS

Follow these stages:

**Phase 1 — Repository audit and solution design**
- Inspect actual frontend/backend.
- Identify existing services and reusable components.
- Map old pages to replacements.
- Identify unknowns and required environment settings.
- Confirm current DV-form sources and version.
- Define database and validation architecture.

**Phase 2 — Interactive preparation workspace**
- Build the form-document UI.
- Add field guidance.
- Add dynamic questions.
- Add progress bar.
- Add completeness checks.
- Add document preview.

**Phase 3 — Payments and secure persistence**
- Build user authentication.
- Implement secure storage.
- Implement Save Progress paywall.
- Rework Stripe checkout and webhooks.
- Handle purchases and entitlement states.

**Phase 4 — PDF and delivery**
- Implement PDF template generation.
- Secure email delivery.
- Customer dashboard.
- Corrections and redownloads.

**Phase 5 — Whole-site cleanup**
- Update homepage.
- Rewrite How It Works.
- Update pricing and package features.
- Rewrite FAQ and requirements content.
- Align policies with actual service.
- Fix outdated claims and registration countdowns.

**Phase 6 — Testing and final review**
- Execute automated tests.
- Perform end-to-end checks.
- Produce screenshots of desktop and mobile UI.
- Verify payments in Stripe test mode.
- Verify PDF outputs.
- Verify security and data separation.
- Prepare pull request.

Do not deploy untested sensitive-data or live-payment changes directly to production.

---

# 21. REQUIRED DELIVERABLES

Upon completion, provide:

1. Working application code in a feature branch.
2. Functional document-editor experience.
3. Payment/save/resume backend.
4. PDF generation and secure email delivery.
5. Updated customer dashboard.
6. Updated public website and service descriptions.
7. Updated legal-policy drafts for owner review.
8. Database migrations.
9. Environment variable documentation.
10. Automated tests and their results.
11. Desktop and mobile screenshots.
12. Before/after change summary.
13. List of any unresolved DV-year requirements.
14. Final pull request ready for owner review.

If a required external credential or service is unavailable, implement and test what can be completed, document the blocker precisely, and do not misrepresent unfinished functionality as working.

---

# 22. FINAL PRODUCT VISION

Our product is not simply another DV Lottery information website.

It should feel like an interactive document-preparation application.

The customer sees a form that resembles the familiar government entry layout.

But unlike the old system:

- The interface helps the customer navigate.
- It highlights exactly where to type.
- It explains confusing questions.
- It checks completeness.
- It identifies missing photographs.
- It adjusts to household information.
- It shows a live progress bar.
- It supports editing and correction.
- It offers paid secure saving.
- It generates a preparation PDF.
- It provides secure digital delivery.

Customers should understand the product immediately, feel in control of their information, and know precisely what they are paying for.

**This must feel as polished as a modern document-signing application, while remaining clearly an independent DV Lottery preparation platform.**

Prioritize accuracy, usability, transparency, security, and working implementation over decorative animations.

**BEGIN BY INSPECTING THE EXISTING REPOSITORY AND IMPLEMENTING THIS REBUILD IN A FEATURE BRANCH.**

## Scope amendment — 2026-10-16
Owner explicitly deferred backend implementation until the other parts are complete. This PR implements the frontend and public content, with no active checkout, accounts, cloud persistence, or email delivery. Premium stays disabled pending owner review. Do not merge/deploy as the paid platform until the backend and launch gates are complete.

## Owner amendment — backend authorization, 2026-10-16

The owner supplied a new Supabase project (`wofazcvfvazfkvujwwcw`) and authorized completing backend integration and pushing directly to main. This replaces the earlier backend deferral and feature-branch-only restriction. Premium remains disabled pending owner review. Credentials are configuration inputs, never repository content. Live capabilities still require verified provider setup and working security controls.
