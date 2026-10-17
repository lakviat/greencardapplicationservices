#!/usr/bin/env bash
set -euo pipefail
node --check assets/app.js
node --check assets/requirements.js
node --check assets/passport-autofill.js
node --check assets/site-metrics.js
node --check assets/site-account.mjs
for file in assets/preparation/*.mjs; do node --check "$file"; done
node --test tests/preparation/*.test.mjs
node scripts/check-passport-autofill.mjs
node scripts/check-local-references.mjs
node scripts/check-seo.mjs
node scripts/check-platform.mjs
if command -v xmllint >/dev/null 2>&1; then xmllint --noout sitemap.xml; fi
# Report filenames only; never echo credential contents into logs.
if git grep -lE '(sk|rk)_(live|test)_[A-Za-z0-9]{16,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' -- ':!scripts/check-static-site.sh'; then
  printf '%s\n' 'Potential credential detected; remove it before publishing.' >&2
  exit 1
fi
git diff --check
printf '%s\n' 'Static, schema, SEO, and privacy checks passed.'
