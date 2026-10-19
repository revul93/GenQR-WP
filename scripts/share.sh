#!/usr/bin/env bash
# Starts a public test site: a Cloudflare quick tunnel plus WordPress Playground with GenQR.
#   bash scripts/share.sh
# Needs cloudflared (in PATH or .playground/bin/). Optional site data in .playground/restore/
# (see playground/share-setup.php). A new admin password is generated on every start and
# written to .playground/admin-login.txt (git-ignored). Stop with Ctrl+C.
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash on Windows: keep /vfs paths as they are
cd "$(dirname "$0")/.."
mkdir -p .playground/restore

CF=$(command -v cloudflared || echo .playground/bin/cloudflared.exe)
[ -x "$CF" ] || { echo "cloudflared not found (put it in PATH or .playground/bin/)" >&2; exit 1; }

"$CF" tunnel --no-autoupdate --url http://localhost:9400 > .playground/tunnel.log 2>&1 &
TUNNEL=$!
trap 'kill $TUNNEL 2>/dev/null || true' EXIT

URL=""
for _ in $(seq 1 60); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' .playground/tunnel.log | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done
[ -n "$URL" ] || { echo "The tunnel did not start; see .playground/tunnel.log" >&2; exit 1; }

PASS=$(node -e "process.stdout.write(require('crypto').randomBytes(12).toString('base64url'))")
printf '%s' "$PASS" > .playground/restore/admin-pass
printf 'GenQR test site - admin login\r\n\r\nAddress:  %s/wp-admin\r\nUsername: admin\r\nPassword: %s\r\n\r\nWorks only while the test site runs. A restart resets it.\r\nKeep this file private.\r\n' "$URL" "$PASS" > .playground/admin-login.txt

echo "Public address: $URL"
echo "Admin login:    .playground/admin-login.txt"

npx wp-playground-cli server --port=9400 --site-url="$URL" \
  --mount=./plugin/genqr:/wordpress/wp-content/plugins/genqr \
  --mount=./playground:/genqr-playground \
  --mount=./.playground/restore:/restore \
  --blueprint=./playground/share.json
