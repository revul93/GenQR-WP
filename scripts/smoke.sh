#!/usr/bin/env bash
# End-to-end smoke test against a fresh WordPress Playground (npm run playground).
# Usage: scripts/smoke.sh [base-url]
set -euo pipefail
B="${1:-http://127.0.0.1:9400}"
fail() { echo "FAIL: $*" >&2; exit 1; }
post() { curl -s -X POST -H 'Content-Type: application/json' -d "$1" "$B/wp-json/genqr/v1/links"; }

# The first requests after start-up go through Playground's auto-login redirect.
for _ in 1 2 3; do curl -sL -o /dev/null "$B/" || true; done

config=$(curl -sf "$B/wp-json/genqr/v1/config") || fail "config endpoint"
grep -qE '"domains":\[[^]]*"127\.0\.0\.1"' <<<"$config" || fail "site domain should be approved by default: $config"

created=$(post '{"url":"127.0.0.1/sample-page","title":"Smoke <b>test</b>"}')
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

curl -s "$B/wp-json/genqr/v1/links/$code" | grep -q '"title":"Smoke test"' || fail "title not stored (or not stripped of HTML)"

# Design is stored with the link; later tweaks need the creator's edit key.
designed=$(post '{"url":"127.0.0.1/designed","style":{"foreground":"#e11d48","moduleShape":"dots"},"logoId":0}')
dcode=$(grep -oE '"code":"[a-z0-9]{7}"' <<<"$designed" | cut -d'"' -f4)
key=$(grep -oE '"editKey":"[A-Za-z0-9]+"' <<<"$designed" | cut -d'"' -f4)
curl -s "$B/wp-json/genqr/v1/links/$dcode" | grep -q '"moduleShape":"dots"' || fail "design not stored"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"key":"wrong","style":{}}' "$B/wp-json/genqr/v1/links/$dcode/design")" = 403 ] || fail "design changed without the edit key"
curl -s -X POST -H 'Content-Type: application/json' -d "{\"key\":\"$key\",\"style\":{\"foreground\":\"#000000\",\"moduleShape\":\"square\"}}" "$B/wp-json/genqr/v1/links/$dcode/design" | grep -q '"moduleShape":"square"' || fail "design update with the edit key"
curl -s "$B/wp-json/genqr/v1/links/$dcode" | grep -q '"design_token"' && fail "edit key hash exposed"
curl -s "$B/wp-json/genqr/v1/links?search=smoke" | grep -q "\"code\":\"$code\"" || fail "public list"

curl -s "$B/" >/dev/null
echo "smoke test passed"
