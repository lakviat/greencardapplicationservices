#!/usr/bin/env bash
set -euo pipefail

cache_version="20260804-consent-alignment-v1"

html_files=()
while IFS= read -r html_file; do
  html_files+=("$html_file")
done < <(
  find . -type f -name '*.html' \
    -not -path './.git/*' \
    -not -path './node_modules/*' \
    | sort
)

node --check assets/app.js
node --check assets/requirements.js
node --check assets/site-metrics.js
node scripts/check-local-references.mjs

if command -v xmllint >/dev/null 2>&1; then
  xmllint --noout sitemap.xml
fi

if grep -nE '[[:space:]]style=|[[:space:]]on[a-z]+=' -- "${html_files[@]}"; then
  echo "Inline styles or event handlers are not allowed by the CSP." >&2
  exit 1
fi

if grep -n "unsafe-inline" -- "${html_files[@]}"; then
  echo "The Content Security Policy must not allow inline code." >&2
  exit 1
fi

html_count="${#html_files[@]}"
csp_count="$(grep -l 'Content-Security-Policy' -- "${html_files[@]}" | wc -l | tr -d ' ')"
if [[ "$html_count" != "$csp_count" ]]; then
  echo "Every HTML page must include the Content Security Policy." >&2
  exit 1
fi

if grep -R -nE --include='*.js' 'eval\(|document\.write\(|\.innerHTML[[:space:]]*=' assets; then
  echo "Unsafe JavaScript DOM or evaluation API detected." >&2
  exit 1
fi

if git grep -nE '(sk|rk)_(live|test)_[A-Za-z0-9]{16,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' -- ':!scripts/check-static-site.sh'; then
  echo "Potential credential detected." >&2
  exit 1
fi

if git grep -nE '\[INSERT|pending confirmation|pending final business approval' -- '*.html' '*.js' '*.css'; then
  echo "Unfinished public policy content detected." >&2
  exit 1
fi

if ! grep -q 'name="checkoutConsent" type="checkbox" required' index.html; then
  echo "The single required checkout agreement is missing." >&2
  exit 1
fi

if grep -qE 'name="(serviceDisclaimer|contactAuthorization|policyConsent)"' index.html; then
  echo "Legacy checkout consent checkboxes must not be rendered." >&2
  exit 1
fi

if ! grep -q 'name="notifyMarketingConsent" type="checkbox"' index.html ||
  grep -q 'name="notifyMarketingConsent" type="checkbox" required' index.html; then
  echo "Marketing consent must be separate from checkout, optional, and unchecked." >&2
  exit 1
fi

styles_count="$(grep -l "assets/styles\.css?v=${cache_version}" -- "${html_files[@]}" | wc -l | tr -d ' ')"
if [[ "$html_count" != "$styles_count" ]]; then
  echo "Every HTML page must use the current stylesheet cache version." >&2
  exit 1
fi

app_count="$(grep -l "assets/app\.js?v=${cache_version}" -- "${html_files[@]}" | wc -l | tr -d ' ')"
if [[ "$html_count" != "$app_count" ]]; then
  echo "Every HTML page must use the current application cache version." >&2
  exit 1
fi

metrics_count="$(grep -l "assets/site-metrics\.js?v=${cache_version}" -- "${html_files[@]}" | wc -l | tr -d ' ')"
if [[ "$html_count" != "$metrics_count" ]]; then
  echo "Every HTML page must use the current analytics cache version." >&2
  exit 1
fi

if ! grep -q "assets/requirements\.js?v=${cache_version}" requirements.html; then
  echo "The requirements page must use the current requirements-script cache version." >&2
  exit 1
fi

git diff --check
echo "Static security checks passed."
