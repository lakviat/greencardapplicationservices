# Backend implementation and activation

Updated 2026-10-17. The owner authorized Supabase backend work and deployment to `main`. Google sign-in is active; checkout, email delivery and Premium remain disabled. This supersedes the earlier backend deferral.

## Implemented

The static website uses a bundled Supabase browser SDK with persistent Google sessions and automatic access-token refresh. The shared account observer restores identity on the workspace and all surrounding site pages, including browser history and focus returns. Only account credentials, basic profile, and the last activity timestamp enter browser storage. Five hours of inactivity or explicit logout clears the browser login. No applicant answers, photos, or passports are persisted in browser storage. Supabase Edge Functions verify each private request using Auth `getUser`. Clients cannot write tables directly or assign payment entitlements. The public health response advertises capabilities only when the corresponding server configuration is activated.

Versioned SQL migrations create preparations, orders, private assets, webhook receipts, rate limits, delivery attempts and a storage cleanup queue. RLS restricts authenticated direct reads to the owner's active preparation. Anonymous clients cannot read preparation data; all client mutation grants are revoked. The private bucket has no browser access policies. The API streams images and PDFs only after checking ownership; PDF/email additionally require active payment.

Stripe Checkout prices are calculated on the server: Single 999 cents, Couple 1999, Family 2999. Premium is rejected. Single includes every required derivative; Couple and Family allow two principal worksheets. A unique pending order and Stripe idempotency key prevent concurrent creation from charging twice. Only a signed webhook plus a server retrieval of the matching paid Stripe session can activate access. Duplicate events and refunds/disputes are handled transactionally; a late success cannot re-enable a revoked order. Card payments only; checkout expires 23 hours after its order was created. No application answers or passport images enter Stripe metadata.

All saves validate the schema, document limits and image ownership. Save Progress does not require a separate worksheet service-consent checkbox. Legacy consent answers are ignored and removed on the next save. Revision checks prevent one device overwriting a newer save. Image uploads are byte/size checked, decoded with memory/pixel limits, and JPEG re-encoded server-side to strip metadata. PDF generation revalidates completeness and uses the same ordered schema as the editor. PDFs are streamed, not published at public URLs. Email is sent only to the verified account address with an authenticated dashboard link, never applicant/passport attachments. Provider rejection is recorded as failed; the user may retry. The UI does not describe provider acceptance as inbox delivery.

Free work starts in the open tab. Save Progress registers an owner-only draft, uploads validated images, saves answers, then offers Pay now or Continue and pay later. The confirmation is shown only after the save succeeds. Further edits autosave, and unpaid/paid drafts can be reopened with the same account on another device. Checkout always saves first; canceling payment preserves the draft. PDF and email delivery still require verified payment. Package changes use the same draft ID and revision, and are locked by a pending checkout or purchase. A database lock limits accounts to 50 active preparations.

## Retention and deletion

Saved data expires 365 days after its last successful save. Registered drafts with no successful save expire after seven days. Delete clears all worksheets in the purchased bundle, queues private files, and immediately attempts storage deletion. If storage is unavailable, queued deletion is retried by maintenance. Minimal order/payment references are retained separately for reconciliation and disputes. Files uploaded but not successfully saved are cleaned after one day; the daily script also removes orphaned storage objects after a crash.

`npm run backend:cleanup` uses the project data API secret. `.github/workflows/backend-maintenance.yml` schedules it daily in the `backend` GitHub environment. Configure `SUPABASE_SECRET_KEY` there before activation. A failed job is a maintenance failure requiring action, not evidence of completed deletion.

## Deployment

1. `npm ci && npm run build:backend` generates the pinned browser SDK and self-contained `supabase/functions/gcas-api/serve.ts`. The function authenticates private routes internally, so `verify_jwt=false` is required for publishable API keys and the Stripe webhook. This does **not** disable its user-token or webhook-signature checks.
2. The existing Supabase GitHub integration is connected to `lakviat/greencardapplicationservices`, with production deployment from `main` enabled. A push applies migrations and deploys functions; inspect its deployment logs. No new deployment token is needed for this route. A project `sb_secret_…` API key is for data access, not manual schema/function deployment.
3. Configure Google OAuth first using [social sign-in setup](social-sign-in.md). Apple remains disabled pending an active Apple Developer membership. Production email and phone registration are disabled. Gmail SMTP is now only needed for worksheet-ready notifications: set the matching `SMTP_*` Edge secrets, verify delivery, and register an allowed sender for Apple private relay before enabling Apple notification delivery. OAuth sign-in does not depend on SMTP. Never ask for a customer's Google/Apple password on this site.
4. Configure the Edge Function secrets listed in `.env.example`. Use separate Stripe sandbox/live values. Configure webhook URL `https://wofazcvfvazfkvujwwcw.supabase.co/functions/v1/gcas-api/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and `charge.dispute.created`. Use the endpoint's signing secret, not a Supabase key.
5. Configure daily storage maintenance and run it successfully. Rotate the project secret that was pasted in chat before production use.
6. Verify real Google sign-in, successful/canceled/failed sandbox checkout, webhook delivery and replay, save/resume, download, email acceptance and deletion. Set `GCAS_AUTH_READY=true` after the real Google OAuth callback, verified session, and reopening preparations work. Set `GCAS_CHECKOUT_ENABLED=true` only after payment validation and maintenance are configured. Premium has no enable flag.
7. Push the reviewed site to main and inspect the deployed site and API capability response. Do not claim live activation from a successful local test or Git push.

## Local verification

`npx supabase start`, `npm run build:backend`, `npm run test:backend`. Restart an existing local stack after changing `supabase/config.toml`. Local email authentication remains enabled only for synthetic integration fixtures; production uses social sign-in. Integration tests use a real local Auth/Postgres/Storage/Edge Functions stack with synthetic users. They cover first-time and returning numeric OTP delivery through Mailpit, wrong-code and replay rejection, anonymous and cross-user access, direct entitlement mutation denial, free saves and paid-only PDF/email, duplicate events, refund ordering, conflicting revisions, malformed images, private image retrieval, PDF bytes, missing email configuration and complete deletion. Tests do not make live charges or send external emails.

For concurrent development, `GCAS_TEST_WORKDIR` may point to a separate Supabase CLI workspace with its own project ID and ports. All backend tests resolve credentials through that workspace and reject non-loopback Auth/Mailpit URLs. `PREP_BASE_URL` selects a separate loopback HTTPS frontend for `tests/backend/browser.mjs`; allow that origin in the isolated function's `GCAS_EXTRA_ORIGINS`. This avoids restarting the stack used by another UI task.

`npm run test:browser` exercises the free/offline path on Chromium, WebKit and Firefox at 320/390/430/1440 pixels. The backend browser test exercises real local account/record access separately. Stripe API connectivity and real email delivery require provider configuration and are not proven by these local tests.

## Remaining production constraints

- This version keeps the existing DV-2027 provisional requirements notice; final government requirements still need source review when released.
- Package upgrades require support; there is no automatic incremental-price upgrade flow.
- PDF output currently uses WinAnsi fonts. Unsupported non-Roman address characters produce an explicit export error instead of silent data loss. Expand font coverage before advertising arbitrary-script PDF output.
- Email failures can be retried by the customer; there is no unattended provider retry worker.
- Provider dashboards and production credentials must be configured and verified before paid capabilities are advertised as live.

Official references: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Edge Function deployment](https://supabase.com/docs/guides/functions/deploy), [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment).

## Production verification — 2026-10-16

Code commit `ca02ddf` was pushed directly to main with owner authorization. GitHub Pages and the Supabase GitHub integration both completed. The deployed preparation HTML and three backend-connected browser modules matched the committed bytes. The production API health endpoint returned HTTP 200 with every paid/account capability disabled and Premium false. The preparations schema exists; the storage bucket is private with JPEG-only uploads and a 5 MiB file limit. An unauthenticated private API request returned 401.

GitHub run `38925751109` passed static checks, Chromium, Firefox, WebKit, and real local backend integration. Production cleanup run `38925964510` and deployed-site smoke run `38925968615` passed. The daily cleanup environment secret is configured.

Stripe live destination `we_1URDGTPPnLl3qhjKQ1MXMQz7` is configured for the four documented events with API version `2026-02-25.clover`. Its signing secret is saved in Supabase Edge Function secrets. A harmless signed configuration probe returned 200; altering that exact body returned 400. This verifies endpoint signing, not a completed payment. No payment or applicant records were created by this probe.

Outstanding activation: Stripe's restricted-key creation is waiting at account verification. Gmail SMTP fields are prepared for the owner-selected address but the Google App Password/account verification is pending. SMTP credentials must also be installed in the Edge Function secret store for worksheet notifications. Keep all capability flags off until real sign-in delivery and Stripe sandbox/payment verification are complete. Premium stays disabled.

## Backend follow-up — 2026-10-17

The production health endpoint responds, with all account/paid capability flags still false. Scheduled private-storage retention run `39021226852` completed successfully today. The Stripe live webhook destination remains active. The current Edge secret inventory contains `STRIPE_WEBHOOK_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `EMAIL_FROM`; `SMTP_PASSWORD` and `STRIPE_SECRET_KEY` are absent. Supabase Auth shows custom Gmail SMTP enabled, but successful delivery has not been demonstrated by this follow-up. Saving Auth SMTP settings does not populate the Edge Function secret store.

The production **Confirm sign up** template was still the default confirmation-link email, incompatible with the workspace's numeric-code flow. A separate local Supabase stack with confirmations enabled reproduced that failure. Both confirmation and magic-link templates now use the same numeric-code email in versioned configuration. The regression test passed for first-time and returning accounts, verified sessions, invalid codes and replayed codes. The full local backend suite, mobile OTP/open/autosave journey, generated-bundle consistency check, and static/schema/privacy checks passed. Test accounts and documents were synthetic, using local Mailpit; these results do not verify Gmail or Stripe payment processing.

Provider activation still requires the Gmail App Password in `SMTP_PASSWORD`, a restricted Stripe server key in `STRIPE_SECRET_KEY`, real sign-in delivery, and Stripe sandbox checkout/webhook verification. Based on the server's API calls, the restricted key needs Checkout Sessions write, Payment Intents read, and Charges and Refunds read; validate those scopes in the sandbox before installing the live key. Keep test keys/webhook secrets out of the live project. The restricted-key form is prepared but no key has been created by this follow-up. Capability flags and Premium remain off.


## Social sign-in amendment — 2026-10-17

The owner chose Google first, with Apple deferred until the Apple Developer membership is ready. The account UI no longer accepts arbitrary email addresses, passwords, or phone numbers. Supabase still stores the provider-verified email for account identity and requested preparation notifications. Different Google and Apple identities (particularly Apple Hide My Email) can be different accounts; customers are prompted to use the same provider/account each time. There were no production customer accounts or paid preparations when the change began.

The OAuth client uses PKCE with an isolated in-memory verifier and candidate session. A verified completed attempt is transferred into the persistent account client. An isolated sign-in tab returns only its one-use code through a per-attempt same-origin channel; the original worksheet never navigates. Canceled or timed-out attempts cannot adopt a session. The callback strips its URL and loads no analytics. Public provider settings and the backend readiness gate must both allow a provider before sign-in is offered. See [setup and verification](social-sign-in.md).

## Google activation — 2026-10-17

The owner completed Google policy acceptance/client creation and explicitly requested installation of the downloaded credentials in Supabase. Google is enabled in Supabase and the Google consent app is **In production**. The existing OAuth secret remains only in the owner's local file and provider configuration. Apple, email and phone registration remain disabled.

`GCAS_AUTH_READY=true` is saved in Edge Function secrets. Real first-time and returning Google sign-in passed on the public site in Chrome, including verified account identity, loading the authenticated preparations list, and preserving a synthetic unfinished worksheet. The API now advertises accounts/cloud-save/PDF capabilities; paid entitlement checks still protect document saves. No live purchase or applicant document save was performed.

This supersedes the earlier all-flags-off and email-sign-in requirements above. OAuth login does not require SMTP. Remaining paid-service activation requires the restricted Stripe server key and sandbox payment/webhook verification. Email notifications separately require the matching `SMTP_PASSWORD` and a delivery test. Checkout, email delivery and Premium remain disabled. Physical-device Google login remains an additional manual check; automated mobile/backend and three-engine OAuth coverage passed before activation.

## Mobile images and account area — 2026-10-17, workspace v31

Free draft saves are active. The reported image-decoding failure was reproduced with a 3024 × 4032 JPEG: its compressed size was small, but its decoded working memory exceeded the server's 128 MiB limit. Passport uploads now use a separate JPEG copy capped at four million pixels and a 2400-pixel longest edge. The detailed local copy used for OCR remains unchanged. The server continues to validate, decode and strip image metadata with its existing limits.

An attachment failure no longer aborts the answer save. The UI explicitly reports saved answers and pending images, preserves an existing saved image if its replacement fails, retains the pending local blob, and offers a retry. It does not claim that unsaved images are safe to close. Full-save confirmation and clearing the unsaved-change guard require all images to save successfully.

The scan dialog constrains mobile grid tracks and controls, prevents horizontal overscroll, and locks background scrolling until close. Dialog replacement preserves the lock; closing restores the previous document position. Vertical scrolling, input controls and pinch zoom remain available.

The blue-ringed avatar opens `prepare.html#account`. Orders lists the authenticated user's saved drafts and purchased preparations with last-save times and working reopen actions. Settings shows the provider profile, payment availability, privacy/terms links and sign-out. The avatar no longer shows the redundant signed-in caption. No raw card collection or unverified billing information is presented; Stripe activation remains a separate outstanding requirement.

Verification: static/schema/privacy checks, unit tests, the complete Chromium/WebKit/Firefox suite, and real isolated Supabase Auth/DB/storage/API tests passed. Added cases cover mobile dialog bounds at 320/390/430/768 pixels, 12 MP normalization in all three engines, real storage of the normalized image, forced first-upload and replacement failures, preserved answers/previous images, successful retry, account reopening without another OAuth attempt, and Orders/Settings accessibility. Synthetic data only; no live applicant upload, payment, or physical iPhone test was performed.

## Visible saves and local timestamps — workspace v32

Save Progress immediately opens a thin green indeterminate indicator before waiting for account readiness. One continuous bar covers connecting, preparing/uploading new images, and saving answers; no estimated percentage is presented as real progress. Continue editing dismisses the panel while a compact header indicator continues showing activity and the eventual result. Automatic saves use the same header indicator. A failed save leaves the prior server-confirmed time intact and offers an explicit retry for foreground saves.

The worksheet header, completion message, My Preparations and account Orders show the server's saved date and time in the browser's local timezone. Each save updates the existing preparation ID and timestamp; no dated copies or user-facing version history are created. Status belongs to the relevant preparation, so a background save cannot replace another worksheet's status. Pending-image results remain distinct from complete saves.

Manual saves join an existing autosave, repeated clicks share the same request and indicator, and edits made during a save are included before the final success message. Already uploaded images are reused by ID; failed upload retries reuse their normalized image copy in memory. The Google account avatar is not included in worksheet uploads. Concurrent readiness checks share one request, and clicking Save during initial readiness waits for the result instead of prematurely declaring accounts unavailable.

Verification includes delayed readiness/save responses, immediate progress feedback, local date/time conversion in three engines, unchanged timestamps on failed saves, same-ID updates, no repeat upload of unchanged passport images, repeated-click/autosave coalescing, changes during a save, continuing to edit without another popup, real Supabase persistence/reopen, and the full browser/session/PDF suite. These checks use synthetic data and simulated OAuth with real local Auth/storage where applicable. Physical-device network performance is not represented by those timings.

## Simpler passport photo selection — workspace v33

The scan entry now has two compact icon buttons, Take photo and Upload photo, with shorter autofill, on-device reading, review and private-save copy. The redundant Enter Manually action is removed; the close control returns to the existing worksheet. A failed scan offers Try another photo. Selection keeps the permission checkbox and privacy/storage link.

Both inputs use the native image picker directly inside the user tap, with no awaited work before opening. The camera input requests the rear camera where supported and falls back to a file picker elsewhere; the upload input uses the image wildcard without capture so mobile photo libraries remain available. Picker cancellation leaves both actions usable, and clearing the input allows selecting the same file again. The shared dialog handler ignores file-input cancel events bubbling from inside the dialog, so canceling the album no longer closes the scan popup. Conversion shows a thin preparation indicator, disables repeated selection until completion, and ignores results after closing. The native album's startup time remains controlled by the operating system.

HEIC images use native browser decoding when available, with the existing local conversion worker as fallback. The HEIC test fixture is a macOS sips conversion of the fictional synthetic-td3.png fixture. Browser checks cover picker activation/cancellation/reselection, bad-file recovery, closing during image preparation, native-first and forced-fallback HEIC decoding, accessibility, and dialog bounds from 320 to 1280 pixels. Automated engines cannot validate every physical device, camera, OS album or legacy browser.

## Business sign-in and homepage return — workspace v34

The signed-out placeholder avatar is replaced by a compact blue Sign in button on every shared header. Signed-in photos/initials keep a softer account ring and continue opening Orders/Settings. Header sign-in starts through `/prepare.html#signin` and returns to the homepage only after the verified session has been adopted. Existing worksheet actions and edited in-memory drafts retain their place. Public headers wait for session readiness before choosing the sign-in or account route. A prior Signed out status is cleared on successful sign-in.

The business branding for Google Cloud project `gcas-signin-20261017` was verified and published on 2026-10-17 after the owner signed into the connected browser. Google explicitly confirmed that the branding is being shown to users. No callback URL, OAuth credential, scope, provider or stored-session key changed. Details and limitations are recorded in `social-sign-in.md`.

OAuth regression checks cover the homepage return, persistence through homepage reload and account navigation, draft preservation during header sign-in, responsive header bounds, cancellation/retry and provider gates in all three browser engines. Automated provider responses remain synthetic; the external branding publication was verified directly in Google Cloud.
