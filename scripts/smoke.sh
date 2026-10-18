#!/usr/bin/env bash
# End-to-end smoke test against a fresh WordPress Playground (npm run playground).
# Usage: scripts/smoke.sh [base-url]
set -euo pipefail
B="${1:-http://127.0.0.1:9400}"
fail() { echo "FAIL: $*" >&2; exit 1; }
post() { curl -s -X POST -H 'Content-Type: application/json' -d "$1" "$B/wp-json/genqr/v1/links"; }

config=$(curl -sf "$B/wp-json/genqr/v1/config") || fail "config endpoint"
grep -qE '"domains":\[[^]]*"127\.0\.0\.1"' <<<"$config" || fail "site domain should be approved by default: $config"

created=$(post '{"url":"127.0.0.1/sample-page"}')
code=$(grep -oE '"code":"[a-z0-9]{7}"' <<<"$created" | cut -d'"' -f4) || fail "create: $created"
echo "created $code"

post '{"url":"https://not-approved.example/"}' | grep -q genqr_domain || fail "unapproved domain accepted"
post '{"url":"127.0.0.1/x","website":"bot"}' | grep -q genqr_rejected || fail "honeypot ignored"
post '{"url":"javascript:alert(1)"}' | grep -qE 'genqr_(invalid|domain)' || fail "javascript: URL accepted"
post "{\"url\":\"127.0.0.1/go/$code\"}" | grep -q genqr_loop || fail "redirect loop accepted"

loc=$(curl -s -o /dev/null -A Mozilla -w '%{http_code} %{redirect_url}' "$B/go/$code")
[ "$loc" = "302 https://127.0.0.1/sample-page" ] || fail "redirect: $loc"
curl -sI -A Mozilla "$B/go/$code" | grep -qi 'cache-control: no-store' || fail "redirect is cacheable"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/go/zzzzzzz")" = 404 ] || fail "unknown code should 404"

curl -s "$B/" >/dev/null
echo "smoke test passed"
