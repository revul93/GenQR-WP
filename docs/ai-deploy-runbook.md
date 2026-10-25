# GenQR deployment runbook (for an AI agent)

You are deploying the **GenQR** WordPress plugin to a GoDaddy-hosted WordPress site and configuring it. GenQR lets administrators create, import and export QR codes in wp-admin; the public site only redirects short links (`/go/<code>`). Follow this document in order. Each step says what to do, how to verify it, and when to stop and ask the human.

The human-oriented version of these steps, with more background, is [deploy-godaddy.md](deploy-godaddy.md).

---

## 0. Rules (read first)

1. **Credentials.** The human gives you credentials in the conversation. Use them only to sign in to the services named in section 1. Never write them into files, commits, logs, screenshots you share, page content or URLs, and never repeat them back in your messages.
2. **Two-factor and CAPTCHAs.** If GoDaddy or WordPress asks for a verification code, an authenticator prompt or a CAPTCHA, stop and ask the human to complete it. Do not try to bypass it.
3. **No purchases.** Do not buy, upgrade, renew or add any product, plan, domain, SSL certificate or add-on. If a step needs something that isn't already in the account, stop and report what's missing.
4. **Ask before anything hard to undo.** Get the human's explicit "yes" in the conversation before you:
   - change DNS records or nameservers
   - delete anything: files, databases, pages, posts, plugins, sites
   - change the WordPress or site URL of a site that is already live
   - push a staging site to production
   - set "Send other visitors to" on a site that already has public content (it redirects every public page)
   - deactivate or delete any plugin other than GenQR
5. **Stay in scope.** Don't change themes, other plugins, users, email, billing or account settings, except where a step below says so.
6. **Verify, then report.** After each part, check the expected result. If a check fails twice, stop and report what you saw (error text, URL, the screen you were on). Don't guess or improvise around errors.
7. **GoDaddy's UI changes.** If a menu label below doesn't exist, look for the closest equivalent or search the [GoDaddy Help Center](https://www.godaddy.com/help). If you can't find it, stop and ask.

---

## 1. Inputs to collect from the human

Ask for anything missing before you start. Values marked *secret* follow rule 1.

| # | Input | Example | Notes |
| --- | --- | --- | --- |
| 1 | GoDaddy account login | email or customer number + password (*secret*) | Needed to reach My Products and hosting settings |
| 2 | Domain for the QR site | `qr.jeddah-cables.com` or `jeddah-cables.com` | Must already be in the GoDaddy account, or the human must control its DNS |
| 3 | Hosting product to use | "Managed Hosting for WordPress" or "Web Hosting (cPanel)" | If unsure, look in My Products (step 2.1) and confirm with the human |
| 4 | Existing WordPress? | "new site" or "use the existing site at …" | If existing: its WordPress admin login (*secret*) |
| 5 | WordPress admin for a new site | username + email | Generate a strong password yourself and give it to the human privately (see 4.4) |
| 6 | Main website to send other visitors to | `https://www.jeddah-cables.com` | Everything on the QR domain except `/go/` links redirects there; can be "none" |
| 7 | Logo file | a PNG, square, transparent background | Ask the human to provide it or point to it |
| 8 | List of links to import (optional) | an .xlsx or CSV file: link, title, short link text | The Import screen has a template |

**Release to install:** `genqr-0.2.1.zip` (or the newest release) from https://github.com/revul93/GenQR-WP/releases. Download it once and keep it as a zip; WordPress installs the zip as is.

---

## 2. Find the hosting

1. Sign in at https://sso.godaddy.com with input 1 (rule 2 applies).
2. Open **My Products**. Note which of these exist and which domain each serves:
   - **Managed Hosting for WordPress** (sometimes "WordPress Hosting"), then go to **Part A**.
   - **Web Hosting** with **cPanel**, then go to **Part B**.
3. If neither exists, or the domain isn't in the account: stop and report (rule 3).

**Verify:** you can name the product, its plan, and the domain it is (or will be) attached to. Confirm with the human before continuing if anything differs from input 3.

---

## Part A: Managed Hosting for WordPress

The database is created and connected automatically. Never edit `wp-config.php` here.

### A1. Site

- **New site:** in the product, choose **Set up** / **Add site** → **Start fresh**. Choose the domain (input 2). For the admin user use input 5 and a password you generate (at least 20 random characters). Wait until setup finishes.
- **Existing site:** open it with **Manage** → **WP Admin** (or sign in at `https://<domain>/wp-admin` with input 4).

**Verify:** `https://<domain>/wp-admin` loads the WordPress dashboard over https.

### A2. PHP version

1. Product → **Settings** for the site → **Production Site** → **PHP version**.
2. It must be **8.1, 8.2 or 8.3**. If it's lower, click **Change**, choose **8.2**, and save.

**Verify:** the settings page shows PHP ≥ 8.1.

### A3. Staging (only if the human asked for it, or if the site is already live with real content)

1. Product → **Settings** → **Staging site** → **Create**. Not available on the Basic plan; if missing, tell the human and continue on production only with their OK.
2. Do **Part C on the staging site**, verify it, then ask the human before **Push to production** (rule 4).

Continue with **Part C**.

---

## Part B: Web Hosting (cPanel)

### B1. Domain

The domain must point to this hosting. In cPanel, **General Information** shows the shared IP. In GoDaddy **DNS** for the domain, the `@` (or subdomain) **A record** should hold that IP.

- If it already does: continue.
- If not: stop and ask the human before changing DNS (rule 4). After a change, wait until `https://<domain>` reaches the hosting (it can take hours) before step B2.

### B2. SSL

cPanel → **SSL/TLS Status** → select the domain → **Run AutoSSL** (free). If AutoSSL isn't available, stop and report (rule 3).

**Verify:** `https://<domain>` opens without a certificate warning.

### B3. PHP version

cPanel → **Select PHP Version** (or **MultiPHP Manager**) → set the domain to **8.2** → save.

### B4. WordPress (skip if the human gave you an existing WordPress site)

**Preferred:** cPanel → **WordPress** installer (Installatron / WordPress Manager / "Softaculous" depending on the account) → **Install** → domain = input 2, directory **empty**, admin = input 5 with a generated password. The installer creates and connects the database.

**Only if no installer exists**, install by hand:

1. cPanel → **MySQL Databases** → **Create New Database** `genqr` (cPanel prefixes it, e.g. `abc123_genqr`). Record the full name.
2. Same page → **MySQL Users** → **Add New User**, with a generated password. Record the full username.
3. **Add User To Database** → choose both → **All Privileges** → **Make Changes**.
4. Download https://wordpress.org/latest.zip. In cPanel **File Manager** → `public_html` (or the domain's document root), **Upload** it, **Extract**, move the contents of `wordpress/` up one level, then delete the empty `wordpress/` folder and the zip.
   - If `public_html` already contains a site, stop and ask the human (rule 4).
5. Rename `wp-config-sample.php` to `wp-config.php` and edit:
   - `DB_NAME`, `DB_USER`, `DB_PASSWORD` = the values from steps 1–2, `DB_HOST` = `localhost`
   - replace the `AUTH_KEY` … `NONCE_SALT` block with fresh values from https://api.wordpress.org/secret-key/1.1/salt/
   - no spaces around the values
6. Open `https://<domain>/`, run the installer with input 5 and a generated password.

**Verify:** `https://<domain>/wp-admin` shows the dashboard. If you get "Error establishing a database connection", recheck step 5 values once, then stop and report.

### B5. Backups

Tell the human in your final report that cPanel hosting may not back up WordPress automatically, and that the database holds every short link. Don't buy a backup product (rule 3).

Continue with **Part C**.

---

## Part C: Install and configure GenQR (both hosting types)

All in WordPress admin: `https://<domain>/wp-admin`.

### C1. WordPress settings

1. **Settings → Permalinks** → select **Post name** → **Save Changes**.
2. **Settings → General**:
   - **WordPress Address (URL)** and **Site Address (URL)** both start with `https://` and use the final domain. If they're `http://` on a new site, change them to `https://` and save. On a live site, ask first (rule 4).
   - **Timezone**: `Riyadh` (or the human's city).
   - Save.

**Verify:** both addresses are `https://<domain>`, and permalinks are "Post name".

### C2. Install the plugin

1. **Plugins → Add New Plugin → Upload Plugin** → choose `genqr-<version>.zip` → **Install Now** → **Activate Plugin**.
2. If GenQR is already installed (an update), WordPress offers **Replace current with uploaded**: choose it. Data is kept.

**Verify:** a **QR codes** menu appears in the sidebar with **All QR codes, Add QR code, Import, Settings**.

### C3. Configure (QR codes → Settings)

The page has tabs: **General, Logos, Presets, Short links**. One **Save settings** button at the bottom saves all tabs. Fill everything, then save once.

| Tab | Field | Value |
| --- | --- | --- |
| General | Send other visitors to | input 6 (e.g. `https://www.jeddah-cables.com`); leave empty if the human said none |
| Logos | Add logos | upload input 7 through the media dialog, select it, **Use these logos**; then tick **Default** on it |
| Presets | (leave as shipped) | Black (default), Indigo, Lagoon, Coral, Emerald. Change only if the human asked |
| Short links | Link prefix | leave `go` |

Click **Save settings**.

**Verify:** the notice "Settings saved." appears. If input 6 was set, `https://<domain>/` in a private window redirects to it (rule 4 applies if the site already had public content).

### C4. Create the QR codes

- If the human gave a list (input 8): **QR codes → Import** → **Choose file…** → check the rows table (rows with problems are listed with the reason; report them) → pick the preset the human asked for (default Black) → **Import N QR codes**. When done, note how many were created and any failures.
- Otherwise create one code to test: **QR codes → Add QR code** → Title `Deployment check`, Link = input 6 or `https://www.example.com`, Short link text `deployment-check` → **Create QR code**.

### C5. Functional checks

Run these and record each result. `<domain>` is the final domain.

1. **Redirect works and is not cached**

   ```bash
   curl -sI https://<domain>/go/deployment-check
   ```

   Expect `HTTP/… 302`, a `Location:` with the code's link, and `Cache-Control: no-store…`.

2. **Unknown code**

   ```bash
   curl -s -o /dev/null -w '%{http_code}' https://<domain>/go/does-not-exist
   ```

   Expect `404`.

3. **API closed to the public**

   ```bash
   curl -s -o /dev/null -w '%{http_code}' https://<domain>/wp-json/genqr/v1/links
   ```

   Expect `401`.

4. **Destination change takes effect immediately.** In **QR codes**, edit "Deployment check", change **Link (URL)** to another page, **Save changes**, and rerun check 1. `Location` must show the new address.
   - If it still shows the old one: on Managed WordPress, flush the cache (admin bar **Flush Cache** or the GoDaddy dashboard) and retry once. If it's still old, report it: GoDaddy support must exclude `/go/*` from caching.
5. **Switched-off code.** Switch it **Off**, **Save changes**, rerun check 1: expect `410`. Switch it back **On** and save.
6. **Export.** In **QR codes**, tick the code(s), Bulk actions → **Export QR codes** → **Apply**: a ZIP downloads. Also try **Printable sheet**: a PDF downloads.
7. **Clean up.** Delete the "Deployment check" code (row action **Delete**). This test code is yours to delete; no confirmation is needed. Don't delete imported codes.

### C6. Common failures

| Symptom | Action |
| --- | --- |
| `/go/<code>` returns the WordPress 404 page | **Settings → Permalinks** → **Save Changes** (no change needed), then retry check 1 |
| Plugin activation fails, or "There has been a critical error" | Check PHP ≥ 8.1 (A2 / B3) and WordPress ≥ 6.5 (**Dashboard → Updates**). Report the exact error |
| The Add / Import screens say "The GenQR script is missing" | The zip was built wrongly: use the release zip, not GitHub's "Source code" zip |
| "Your session has expired" in Add / Import | Reload the page and retry |
| A security or firewall plugin blocks `wp-json` | Don't change it. Report it to the human with the plugin's name |

---

## Final report to the human

When everything passes, reply with this, filled in. Leave out passwords except as noted in point 4.

1. **Site:** `https://<domain>/wp-admin` (QR codes menu) and where `https://<domain>/` redirects
2. **Hosting:** product and plan, PHP version, staging used (yes/no)
3. **GenQR:** version installed, main website redirect, logo set, codes imported (count, failures)
4. **New WordPress admin** (only if you created one): username. Give the generated password once, in a private message, and tell the human to store it in a password manager and change it if this conversation is shared.
5. **Checks C5.1–C5.7:** pass/fail for each, with details for any failure
6. **Cache:** whether destination changes took effect immediately (C5.4)
7. **Backups:** what exists, and the B5 warning if cPanel
8. **Anything skipped or needing the human:** DNS, staging push, purchases, 2FA prompts, errors

## Appendix: what GenQR stores

| What | Where |
| --- | --- |
| Short links, titles, destinations, clicks | Database table `<prefix>genqr_links` |
| Change history | Table `<prefix>genqr_history` |
| Settings, presets, main website address | WordPress option `genqr_settings` |
| Each code's design | Table `<prefix>genqr_links`, column `design` |
| Logos | Media Library |
| QR images | Not stored (made in the admin's browser on download/export) |
| Visitor IP addresses | Not stored (scans are only counted) |

Deleting the plugin from the Plugins page removes its tables and settings permanently. Never delete it on a live site without the human's explicit yes (rule 4).
