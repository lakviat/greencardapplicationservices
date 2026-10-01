# Sales backlog

Primary goal: confirmed paid purchases and sustainable acquisition cost.

Read this file before scheduled work. Do not repeat finished tasks, send duplicate
outreach, or publish duplicate articles. A 300-minute schedule is a review cadence,
not a requirement to publish or change the website every run. Report meaningful
changes only. Keep unfinished user edits intact.

## Priorities

1. Deploy and validate the prepared funnel events in GA4 with analytics consent.
   Local implementation complete; deployment and live collection unverified.
2. Establish a baseline using GA4, Search Console, and Stripe account access or
   aggregate reports. Traffic and sales totals are currently unavailable here.
3. Confirm successful payments through Stripe reporting or a verified backend
   webhook. Never count checkout starts as purchases.
4. Connect an email sending platform with unsubscribe support and suppression.
   Existing notification endpoint stores requests; it does not send campaigns.
   Registration-alert permission alone does not authorize promotional sequences.
5. Choose target countries, languages, and budget with the owner. Existing country
   pages suggest Central Asia as a research starting point, not a confirmed target.
6. Research a small batch of relevant referral partners and draft tailored pitches.
   Outreach needs explicit sending authorization and account access.
7. Improve existing search pages before producing overlapping new content. Verify
   time-sensitive DV facts using official government sources.

## Measurement

- `form_start`: first form interaction after analytics consent.
- `request_dispatch`: application or notification request dispatched; acceptance
  and storage remain unknown.
- `begin_checkout`: Stripe redirect attempted, with listed package value; not revenue.
- `view_item_list`, `select_item`, `form_view`, `validation_error`, and `cta_click`:
  supporting discovery and friction signals, with allowlisted metadata only.
- No frontend `purchase` or `generate_lead` event is emitted.

The shared `assets/site-metrics.js` owns these events; do not add a parallel app
tracker that double-counts checkout. Events are sent only with analytics consent,
to GA4 only. Added event
parameters contain no contact information, form values, documents, or payment URLs.
Existing GA4 automatic collection remains separate; audit enhanced measurement
settings for automatic form events before interpreting a funnel.

## Live validation

Use GA4 DebugView/Realtime with consent enabled; verify events once per intended
action. Use a controlled test request only if authorized to create a test record.
Check that denied consent produces none of the added events. Confirm checkout
value equals the listed package price and does not appear as purchase revenue.
Do not make a charge solely to test analytics.
