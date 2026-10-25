#!/usr/bin/env bash
# End-to-end smoke test against a fresh WordPress Playground (npm run playground).
# Usage: scripts/smoke.sh [base-url] [admin-password]
set -euo pipefail
B="${1:-http://127.0.0.1:9400}"
PASS="${2:-password}"
J=$(mktemp)
trap 'rm -f "$J"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

# The first requests after start-up go through Playground's auto-login redirect.
for _ in 1 2 3; do curl -sL -o /dev/null "$B/" || true; done

# Visitors cannot use the API.
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"url":"https://example.com"}' "$B/wp-json/genqr/v1/links")" = 401 ] || fail "API open to visitors"

# Log in as the admin and get WordPress's REST nonce.
curl -s -c "$J" -b "$J" "$B/wp-login.php" >/dev/null
curl -s -c "$J" -b "$J" -o /dev/null --data-urlencode log=admin --data-urlencode "pwd=$PASS" -d testcookie=1 "$B/wp-login.php"
N=$(curl -s -b "$J" "$B/wp-admin/admin.php?page=genqr-add" | grep -oE '&quot;nonce&quot;:&quot;[a-f0-9]+' | grep -oE '[a-f0-9]{10}$' || true)
[ -n "$N" ] || fail "admin login / REST nonce"
post() { curl -s -b "$J" -H "X-WP-Nonce: $N" -H 'Content-Type: application/json' -X POST -d "$2" "$B/wp-json/genqr/v1/$1"; }
get() { curl -s -b "$J" -H "X-WP-Nonce: $N" "$B/wp-json/genqr/v1/$1"; }

# Create with custom short link text and a design.
created=$(post links '{"url":"example.com/brochure","title":"Smoke <b>test</b>","code":"Smoke Test","style":{"foreground":"#e11d48","moduleShape":"dots"}}')
grep -q '"code":"smoke-test"' <<<"$created" || fail "create with custom code: $created"
grep -q '"title":"Smoke test"' <<<"$created" || fail "title not stripped of HTML"
grep -q '"moduleShape":"dots"' <<<"$created" || fail "design not stored"
id=$(grep -oE '"id":[0-9]+' <<<"$created" | head -1 | cut -d: -f2)

post links '{"url":"https://example.com/other","code":"smoke-test"}' | grep -q genqr_code_taken || fail "duplicate short link accepted"
post links '{"url":"https://example.com/x","code":"a"}' | grep -q genqr_code_invalid || fail "invalid short link accepted"
post links '{"url":"javascript:alert(1)"}' | grep -qE 'genqr_invalid' || fail "javascript: URL accepted"
post links '{"url":"127.0.0.1/go/smoke-test"}' | grep -qE 'genqr_(loop|invalid)' || fail "redirect loop accepted"
get "code-check?code=smoke-test" | grep -q '"ok":false' || fail "code-check: taken"
get "code-check?code=smoke-test&id=$id" | grep -q '"ok":true' || fail "code-check: own code"

# Redirect, not cached; unknown code 404.
loc=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$B/go/smoke-test")
[ "$loc" = "302 https://example.com/brochure" ] || fail "redirect: $loc"
curl -sI "$B/go/smoke-test" | grep -qi 'cache-control: no-store' || fail "redirect is cacheable"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/go/zzzzzzz")" = 404 ] || fail "unknown code should 404"

# Change the short link text: the old one stops, the new one works.
post "links/$id" '{"code":"smoke-renamed"}' | grep -q '"code":"smoke-renamed"' || fail "rename short link"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/go/smoke-test")" = 404 ] || fail "old short link still works"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/go/smoke-renamed")" = 302 ] || fail "renamed short link"

# Bulk import: one bad row, one duplicate, two good.
imp=$(post links/import '{"rows":[{"url":"https://example.com/1","title":"One","code":"imp-one"},{"url":"nope"},{"url":"https://example.com/2","code":"imp-one"},{"url":"https://example.com/3","title":"Three"}],"style":{"foreground":"#000000"},"logoId":0}')
[ "$(grep -o '"ok":true' <<<"$imp" | wc -l)" -eq 2 ] || fail "import: expected 2 created: $imp"
[ "$(grep -o '"ok":false' <<<"$imp" | wc -l)" -eq 2 ] || fail "import: expected 2 errors: $imp"

# List for export (all, and by id).
get "links" | grep -q '"code":"imp-one"' || fail "list all"
get "links?ids=$id" | grep -q '"code":"smoke-renamed"' || fail "list by id"

echo "smoke test passed"
