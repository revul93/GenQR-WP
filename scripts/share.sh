#!/usr/bin/env bash
# Starts a public test site: a Cloudflare quick tunnel plus WordPress Playground with GenQR.
#   bash scripts/share.sh
# Needs cloudflared (in PATH or .playground/bin/). Optional site data in .playground/restore/
# (see playground/share-setup.php). The admin login is admin / password unless GENQR_ADMIN_PASS
# is set; it is also written to .playground/admin-login.txt (git-ignored). Stop with Ctrl+C.
# Installing or editing plugin and theme files from wp-admin is switched off, because the
# public site's admin can be reached by anyone who knows the login.
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash on Windows: keep /vfs paths as they are
cd "$(dirname "$0")/.."
mkdir -p .playground/restore

# A test site from an earlier run still answering locally? Save its links first, so the
# new site gets them back with the same short codes (see playground/share-setup.php).
if curl -s -o /dev/null --max-time 5 http://127.0.0.1:9400/; then
  OLD=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' .playground/tunnel.log 2>/dev/null | head -1 | sed 's#https://##' || true)
  node -e '
    const host = process.argv[1];
    (async () => {
      let page = 1, items = [];
      for (;;) {
        const r = await fetch("http://127.0.0.1:9400/wp-json/genqr/v1/links?page=" + page, { headers: host ? { Host: host } : {} });
        const j = await r.json();
        items.push(...(j.items || []));
        if (page >= (j.pages || 1)) break;
        page++;
      }
      require("fs").writeFileSync(".playground/restore/links.json", JSON.stringify(items, null, 1));
      console.log("Saved " + items.length + " links from the running site.");
    })().catch((e) => console.log("Could not save links: " + e.message));
  ' "$OLD"
  echo "Port 9400 is still in use by the previous test site. Stop it, then run this script again." >&2
  exit 1
fi

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

PASS="${GENQR_ADMIN_PASS:-password}"
printf '%s' "$PASS" > .playground/restore/admin-pass
printf 'GenQR test site - admin login\r\n\r\nAddress:  %s/wp-admin\r\nUsername: admin\r\nPassword: %s\r\n\r\nWorks only while the test site runs. A restart resets it.\r\nKeep this file private.\r\n' "$URL" "$PASS" > .playground/admin-login.txt

echo "Public address: $URL"
echo "Admin login:    .playground/admin-login.txt"

npx wp-playground-cli server --port=9400 --site-url="$URL" \
  --define-bool DISALLOW_FILE_MODS true --define-bool DISALLOW_FILE_EDIT true \
  --mount=./plugin/genqr:/wordpress/wp-content/plugins/genqr \
  --mount=./playground:/genqr-playground \
  --mount=./.playground/restore:/restore \
  --blueprint=./playground/share.json
