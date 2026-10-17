# Google first; Apple later

The owner selected Google first on 2026-10-17. Google sign-in is now configured, publicly available, and verified with a real account; `GCAS_AUTH_READY=true`. Keep Apple and phone disabled. Production email registration is disabled in the remote configuration. Leave global new-user signup enabled, because Google needs it. Do not enable checkout until the separate Stripe verification is complete.

## Google configuration

The dedicated Google Cloud project is `gcas-signin-20261017` (Green Card Applications). The owner approved `lakviat@gmail.com` as the public support email and completed Google's policy/client-creation steps. The configured app name is Green Card Application Services, audience is External, and publishing status is In production. Only identity/email/profile access is used; no Gmail, contacts, Drive or other data access is needed.

Create a **Web application** OAuth client:

- JavaScript origin: `https://greencardapplicationservices.com`
- Authorized redirect URI: `https://wofazcvfvazfkvujwwcw.supabase.co/auth/v1/callback`

Put the client ID and secret directly into Supabase → Authentication → Sign In / Providers → Google, then enable Google. Do not commit the secret or put it in a browser bundle. Google's client secret goes in the provider settings, not Edge Function secrets. Google OAuth testing mode only allows configured test users; switch the consent app to production for public signup after verifying the flow and satisfying any Google verification requirements.

Supabase's post-login allowlist is versioned in `supabase/config.toml`:

```text
https://greencardapplicationservices.com/auth-callback.html\?attempt=*
```

The backslash makes the query `?` literal in Supabase's glob matching; the wildcard allows the random attempt UUID. Do not replace this with a whole-site wildcard. Google redirects to Supabase, then Supabase redirects to the dedicated website callback. Site URL remains the worksheet. Provider configuration belongs in the dashboard; no OAuth secrets are configured in the repository.

## Apple (deferred)

Requires an active Apple Developer membership, primary App ID with Sign in with Apple, a linked web Services ID, Team ID, signing key and generated OAuth client secret. Register the Supabase callback/domain. Set up Apple in Supabase when these are available; the existing button appears only after the provider is enabled and accounts are ready. Apple OAuth client secrets expire and must be rotated at least every six months. Register and verify the notification sender with Apple's private email relay before relying on email to Hide My Email addresses. Do not automatically fill legal names from either provider profile.

## Verification

`npm run test:browser` includes synthetic Google/Apple responses in Chromium, WebKit, and Firefox. It verifies actual SDK PKCE challenge/verifier pairing, provider errors, blocked popups, canceled in-flight exchanges, fresh retries, openerless callback communication, provider readiness gates, unsaved draft preservation, and no worksheet data in browser storage. It does not prove Google/Apple credentials work.

`tests/backend/browser.mjs` pairs the simulated OAuth response with a real local Auth session, then tests real authenticated paid record access, mobile country selection, autosave and reopening. The entitlement is a synthetic local fixture. The local email/OTP suite tests fixture authentication only and is no longer a production-login acceptance test.

For provider changes, test real Google signup and repeat login, verify that unfinished worksheet answers remain present, and confirm that account identity/ownership works. Check `/auth/v1/settings`: Google enabled, Apple/email/phone disabled. Maintain cross-browser/mobile, cancellation and cross-account isolation coverage. Payment and notification activation are separate.

References: [Supabase Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple), [Supabase redirect rules](https://supabase.com/docs/guides/auth/redirect-urls).

## Header sign-in and business branding — workspace v34

The shared signed-out header uses a compact blue Sign in button. Signed-in accounts retain the Google photo or initials with a softer ring. Public-page clicks wait for the shared session observer, then open either the existing account or the dedicated `/prepare.html#signin` entry. A completed regular sign-in returns to `/` with the same persistent session. Explicit saved-preparation actions still open the requested account content. Sign-ins begun while the worksheet has unsaved in-memory answers preserve that worksheet, as do Save Progress and checkout sign-ins.

Google's displayed consent-screen identity is configured externally. The app already had the business name, support email, homepage, privacy/terms links and authorized domains, but Verification Center reported that branding was not being shown. On 2026-10-17 the owner signed into the connected Google Cloud tab and the existing branding was submitted with Verify branding. Google verified it, then Publish branding completed. The final visible status was **Your branding has been verified and is being shown to users.** Only non-sensitive identity/profile/email scopes are requested; Google reports no data-access verification requirement. No Supabase URL, OAuth credential, scopes or session storage key was changed, and no paid custom domain was purchased. The published identity is **Green Card Application Services**. The underlying callback still uses the existing Supabase hostname; an actual custom callback hostname is a separate domain change and is unnecessary to publish the verified business name.

## Implementation verification — 2026-10-17

Static/schema/SEO/privacy checks passed. Free worksheet, accessibility, household, media, and form-interaction suites passed in Chromium, WebKit, and Firefox. The final social-login suite passed in all three engines, including Google-only and Apple-only availability. A separate mobile test passed with a real local Supabase Auth session, database, functions, paid fixture, and autosave/reopening. The isolated stack uses ports 55321–55328 and does not restart the shared UI stack. No real OAuth credential, external email, or charge was used by these tests.

## Live activation — 2026-10-17

The owner's downloaded Web application OAuth JSON was checked against the expected project, website origin and Supabase callback. Its existing client ID and secret were installed directly in Supabase's Google provider. The secret was not committed or included in frontend code. Nonce checking remains enabled and accounts without email are not allowed.

Google branding links point to the existing site homepage, `/policies#privacy`, and `/policies#terms`. After a successful owner test, Google Auth Platform was published and visibly reported **In production**. The Google account chooser currently identifies the Supabase callback hostname; custom app branding has not been separately verified.

Real first-time signup and returning login with the owner's approved Google account both completed in Chrome on the public site. The callback established the verified Supabase session and the authenticated API loaded the saved-preparations list. During repeat login, a synthetic unsaved worksheet answer remained intact in the original tab. No payment, cloud-saved applicant document, or external notification was created. Real Google login on physical mobile devices has not been checked; mobile and other-engine coverage above uses synthetic OAuth responses.

Production Auth settings report Google enabled and Apple/email/phone disabled. The API reports accounts, cloud-save and PDF capabilities enabled, with checkout, email delivery and Premium disabled. Paid entitlement checks still apply to saves; enabling Google alone does not enable purchases or notification delivery.

## Account visibility and mobile return follow-up — 2026-10-17

Workspace v25 adds an account control beside My Preparations. A verified Google session displays the provider photo and a Signed in label; the dashboard and account dialog identify the account email. Missing or failed photos use initials. Avatar URLs are restricted to Google's `lh3`–`lh6.googleusercontent.com` image hosts and requested without a referrer; no worksheet fields are sent. Signed-out/session-expired events clear the account indicator. This release initially kept sessions in memory; v26 below supersedes that behavior.

The bottom progress/actions toolbar hides while a text field, country search, date input, textarea or select is focused. It reappears after editing ends. The viewport visibility calculation no longer reserves room for a hidden toolbar above the keyboard. The OAuth callback retries for the full five-minute sign-in window and answers a readiness message when the original worksheet resumes, replacing the previous 15-second callback timeout. This addresses a possible background-tab suspension failure; the owner's physical iPhone behavior has not been directly reproduced.

Manual Save Progress waits for active saves and any newer edits, then confirms Progress saved with the account and save time only after server acknowledgement. Failed requests never show that confirmation. Save Progress has no worksheet service-consent checkbox or permission detour. Saving is free and independent of checkout. The saved confirmation offers optional payment or continuing later; disabled checkout does not prevent saving.

Static/schema/privacy checks and browser, accessibility, form, OAuth, checkout/save-result and PDF suites passed in Chromium, WebKit and Firefox. Coverage includes toolbar focus/blur and simulated keyboard geometry, delayed callback recovery after 20 seconds, canceled attempt isolation, avatar loading, sign-out, consent navigation, no repeated OAuth on save, in-flight edits and failed-save feedback. The isolated local Supabase browser test passed with a real Auth session, paid fixture, manual save acknowledgement, autosave, database reopening and private PDF access. Google/Stripe responses in automated browser tests are synthetic; no live payment or applicant upload was made.

## Persistent sessions and Google account selection (workspace v26)

Google sign-in explicitly requests `prompt=select_account`. The authorization tab preserves the original unsaved worksheet; canceled attempts still cannot persist credentials. A completed verified attempt transfers only Supabase access/refresh tokens to the durable SDK client, not Google provider tokens. The client restores the basic account profile on startup and refreshes access tokens automatically. Browser storage is restricted to the account session/profile and last-activity timestamp.

Reloads, leaving/discarding a worksheet, and another tab keep the same login. Explicit logout clears this browser's login across open tabs. Five hours without user activity expires it; background token refresh does not extend activity. This is a browser idle policy, not a five-hour JWT or server-side revocation guarantee. Unsaved worksheet answers/images remain in memory; paid server records still require authenticated ownership checks.

Validation: static/schema/privacy checks and the full browser suite passed in Chromium, WebKit and Firefox. OAuth coverage includes account-chooser parameters, canceled attempts, leaving/reloading, new tabs, cross-tab logout (including failed remote revocation), and exclusion of worksheet data/provider tokens from storage. Session tests cover expired-token refresh, active use beyond five hours, idle expiry, stale return and revoked refresh tokens. The isolated real local Supabase test reloads the page and reopens a saved paid preparation without a second authorization. Provider responses in automation remain synthetic; physical iPhone verification is still manual.


## Worksheet exit and passport scanning follow-up (workspace v27)

The shared account observer now runs on the 18 public information pages, payment return, and preparation workspace. It restores the stored profile immediately and reconciles Auth on pageshow, history navigation, focus, visibility return, and cross-tab storage changes. This covers pages restored from the browser back/forward cache and returning from a camera/file picker. A stale Auth broadcast is reconciled against current browser storage; a temporary token-refresh connection error does not masquerade as an explicit logout. Activity on public pages also extends the existing five-hour idle policy. Discarding a worksheet still discards only that draft.

All site headers show the same account photo/initials and signed-in status. The public account control opens saved preparations with the existing login, or offers Google when signed out. Google still requests account selection; an established session does not prompt again.

The scan entry retains its size and gains a small click pointer, soft highlight, and a brief motion cue that respects reduced-motion settings. OCR now parses printed document number, expiry, birth date, issuing country, sex, and explicit birthplace, alongside MRZ fields. Label geometry separates adjacent columns. Missing MRZ fields no longer erase printed suggestions; independently checked MRZ fields survive incomplete rows and retries. Original-resolution recognition precedes enlarged, rotated, contrast-enhanced MRZ and sparse-text retries. Every suggested value remains editable and requires confirmation. Nationality and issuing country do not determine birth country or eligibility.

The new passport/session browser regression signs in once, runs real local OCR on fictional printed passport images, reviews/applies the suggestions, exits/discards the worksheet, then uses back/forward/reload twice. It verifies the same account on all 19 surrounding pages and explicit logout. OCR variants cover 90° and 180° rotation and reduced contrast. No real passport, provider credential, or document upload is used. The existing MRZ image regression remains in place.

Validation: static/schema/SEO/privacy checks and all eight browser suites passed in Chromium, WebKit, and Firefox. The new OCR/session route passed twice per engine, including rotated and lower-contrast images. The real local Supabase Auth/database/functions test passed for session restoration, paid-fixture save acknowledgement, autosave, reopening, and private PDF retrieval. Header layout was inspected from 320 to 1440 pixels. Physical iPhone camera/browser behavior and a fresh live Google login still require an owner check; automated Google responses are synthetic.


## Passport name accuracy and reading feedback (workspace v28)

Name extraction now accumulates evidence across OCR passes instead of keeping the first nonempty result. It reads printed first/surname labels separately, including adjacent columns and local-script/Latin rows. Clear printed spelling takes precedence over an inconsistent MRZ suggestion; conflicting printed readings require MRZ corroboration or remain blank for manual entry. Short mixed trailing K/L filler groups are excluded without stripping legitimate name endings or a lone initial. Sparse-text retries supply printed fields only, so their weaker MRZ recognition cannot contaminate an already readable name line. Review and confirmation still precede applying any suggestions.

The scan dialog shows a three-pixel green-to-white reading indicator continuously from startup through all recognition passes. It displays no per-pass percentages and stops on completion, failure, or cancellation. Reduced-motion settings disable the animation. The new scan-feedback browser regression controls individual recognition passes to verify later name correction, continuous feedback, manual name/full-name edits, cancellation, failure, and reduced motion. Real OCR image coverage remains in the existing browser, UX, and passport/session suites. Fixtures are fictional; the owner's supplied passport screenshots are not copied into the repository or uploaded by tests.

Validation: static/schema/SEO/privacy checks, 13 name-parser regressions, and the scan-feedback, real OCR, UX, and full document/public-page browser suites passed in Chromium, WebKit and Firefox. Automated OCR uses fictional fixtures, including the mixed filler pattern reported in the owner screenshots.
