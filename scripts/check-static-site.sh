#!/usr/bin/env bash
set -euo pipefail

cache_version="20260731-security-v1"

node --check assets/app.js
node --check assets/requirements.js
node --check assets/site-metrics.js
node scripts/check-local-references.mjs

if rg -n --glob '*.html' '\sstyle=|\son[a-z]+='; then
  echo "Inline styles or event handlers are not allowed by the CSP." >&2
  exit 1
fi

if rg -n --glob '*.html' "unsafe-inline"; then
  echo "The Content Security Policy must not allow inline code." >&2
  exit 1
fi

html_count="$(find . -maxdepth 1 -name '*.html' | wc -l | tr -d ' ')"
csp_count="$(rg -l --glob '*.html' 'Content-Security-Policy' | wc -l | tr -d ' ')"
if [[ "$html_count" != "$csp_count" ]]; then
  echo "Every HTML page must include the Content Security Policy." >&2
  exit 1
fi

if rg -n 'eval\(|document\.write\(|\.innerHTML\s*=' assets --glob '*.js'; then
  echo "Unsafe JavaScript DOM or evaluation API detected." >&2
  exit 1
fi

if git grep -nE '(sk|rk)_(live|test)_[A-Za-z0-9]{16,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' -- ':!scripts/check-static-site.sh'; then
  echo "Potential credential detected." >&2
  exit 1
fi

styles_count="$(rg -l --glob '*.html' "assets/styles\.css\?v=${cache_version}" | wc -l | tr -d ' ')"
if [[ "$html_count" != "$styles_count" ]]; then
  echo "Every HTML page must use the current stylesheet cache version." >&2
  exit 1
fi

app_count="$(rg -l --glob '*.html' "assets/app\.js\?v=${cache_version}" | wc -l | tr -d ' ')"
if [[ "$html_count" != "$app_count" ]]; then
  echo "Every HTML page must use the current application cache version." >&2
  exit 1
fi

git diff --check
echo "Static security checks passed."
