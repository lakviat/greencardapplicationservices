# Google first; Apple later

The owner selected Google first on 2026-10-17. Keep Apple and phone disabled. Production email registration is disabled in the remote configuration. Leave global new-user signup enabled, because Google needs it. Do not enable `GCAS_AUTH_READY` until live Google sign-in has been tested. Do not enable checkout until the separate Stripe verification is complete.

## Google configuration

The dedicated Google Cloud project is `gcas-signin-20261017` (Green Card Applications). Its consent setup is pending the owner’s public support-email choice. In Google Auth Platform configure the app name, business support email, external audience, and only OpenID/email/profile scopes. No Gmail, contacts, Drive or other data access is needed.

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

`npm run test:browser` includes synthetic Google/Apple responses in Chromium, WebKit, and Firefox. It verifies actual SDK PKCE challenge/verifier pairing, provider errors, blocked popups, canceled in-flight exchanges, fresh retries, openerless callback communication, provider readiness gates, unsaved draft preservation, and no browser storage. It does not prove Google/Apple credentials work.

`tests/backend/browser.mjs` pairs the simulated OAuth response with a real local Auth session, then tests real authenticated paid record access, mobile country selection, autosave and reopening. The entitlement is a synthetic local fixture. The local email/OTP suite tests fixture authentication only and is no longer a production-login acceptance test.

Before activation, test real Google signup and repeat login on desktop and mobile, verify that unfinished worksheet answers remain present, and confirm that account identity/ownership works. Check `/auth/v1/settings`: Google enabled, Apple/email/phone disabled. Test cancellation and access with the wrong account. Enable accounts only after those checks pass. Payment and notification activation are separate.

References: [Supabase Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple), [Supabase redirect rules](https://supabase.com/docs/guides/auth/redirect-urls).

## Implementation verification — 2026-10-17

Static/schema/SEO/privacy checks passed. Free worksheet, accessibility, household, media, and form-interaction suites passed in Chromium, WebKit, and Firefox. The final social-login suite passed in all three engines, including Google-only and Apple-only availability. A separate mobile test passed with a real local Supabase Auth session, database, functions, paid fixture, and autosave/reopening. The isolated stack uses ports 55321–55328 and does not restart the shared UI stack. No real OAuth credential, external email, or charge was used by these tests.

Google Cloud project `gcas-signin-20261017` was created; consent screen/client credentials are not yet complete. Live login remains disabled. The owner must choose the public support email before consent setup continues.
