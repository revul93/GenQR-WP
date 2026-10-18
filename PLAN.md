# GenQR for WordPress — Plan

Status: **v0.2: agreed** · 2026-10-18 · Phase 1 in progress.

A lightweight sibling of [GenQR](https://github.com/revul93/GenQR): a WordPress plugin for a GoDaddy WordPress site on the company domain. Visitors make branded QR codes for **URLs only**, without logging in. Each code points to a short link on the company domain, and **only the admin** changes where links go.

---

## 1. Decisions

| # | Topic | Decision |
|---|---|---|
| W1 | Hosting | Existing **GoDaddy WordPress hosting** on the company domain, delivered as a **custom WordPress plugin** |
| W2 | Users | **No visitor accounts or logins.** The only admin is the WordPress administrator (existing wp-admin login). |
| W3 | Content | **URLs only**: no plain text, vCard, etc. |
| W4 | Short links | Every QR code points to `https://<domain>/go/<code>`, which redirects to the destination |
| W5 | Who creates links | Visitors create them as part of making a QR code, **only for destinations on admin-approved domains** (option B). Only the admin can change or disable them. |
| W6 | Logos | **Set by the admin** (company logos); visitors pick one or none and can't upload their own |
| W7 | Analytics | A **click count** per link (plus last-clicked time) |
| W8 | Project | **New repository** (`GenQR-WP`). The QR engine and designer are ported from GenQR; nothing else is carried over. |
| W9 | Approved domains | **Admin setting**, editable at any time; pre-filled with the site's own domain on activation |
| W10 | Homepage | A settings button **creates the generator page and makes it the site's homepage**, so visitors land straight on the generator. It can also go on any other page. |
| W11 | Branding | Title shown to visitors, default **"Jeddah Cables QR Generator"**, editable in settings |
| W12 | Local testing | **WordPress Playground CLI**: real WordPress in Node, no Docker or hosting needed |
| W13 | Repository | **github.com/revul93/GenQR-WP** (public) |

## 2. How it works

```
Visitor → page with [genqr] shortcode → designer runs in the browser
   │  enters https://shop.jeddah-cables.com/expo  (must be on an approved domain)
   │  clicks "Create QR code"
   ▼
WordPress REST API  POST /wp-json/genqr/v1/links   (nonce, rate limit, domain check)
   │  stores {code, destination} → returns https://<domain>/go/AbC123
   ▼
Browser renders the QR for /go/AbC123 → download PNG/JPG/SVG/PDF/Word or print

Anyone scanning → https://<domain>/go/AbC123 → WordPress → 302 to destination (+1 click)

Admin → wp-admin → QR Links → change destination / disable / delete / see clicks
```

The server work is small: storing links, redirecting, the admin screens and settings. All QR drawing and file exports happen in the visitor's browser, so the hosting does almost nothing per QR code.

## 3. Features

### 3.1 Public generator: `[genqr]` shortcode
- Place it on any page or post.
- **Input:** the destination URL, which must be http/https on an approved domain. A clear message appears when it isn't allowed.
- **Design:**
  - code colour, background colour (or transparent) and gradient
  - pattern and corner shapes
  - a logo chosen from the admin's logos, or none
  - logo size and margin
- **Live preview and scan check:** the code is decoded in the browser before download, with warnings for colours that are hard to scan.
- **Create QR code:** creates the short link, then enables the downloads:
  - **PNG / JPG** (512 to 4096 px), **SVG**
  - **PDF / Word**, sized in cm
  - **Print** at a chosen size
- The designer runs inside a **Shadow DOM**, so the WordPress theme's styles can't break it and its styles can't leak into the theme.
- Works on phones (single column) and desktops (side-by-side).

### 3.2 Short-link redirects
- `GET /go/<code>` returns **302** to the destination, sent with `Cache-Control: no-store`, so the admin's changes take effect at once.
- Each redirect adds 1 to the click count, skipping obvious bots and `HEAD` link previews.
- Unknown or disabled codes get a simple branded "link not available" page (404/410).
- Codes are 7 characters, avoiding confusable characters (`0/O/1/l/I`).
- The prefix `go` can be changed in settings. Printed codes depend on it, so the setting warns about that.

### 3.3 Admin (wp-admin → **QR Links**)
- A table of all links: code, short URL, destination, clicks, last click, created date, and status.
- Search, sort and pagination.
- **Edit destination:** the admin may use any http/https URL; the approved-domains rule applies to visitors only.
- **Disable/enable** and **delete** (bulk actions too), plus **Export CSV**.
- Every admin change is recorded as a history entry on the link (old value → new value, by, when).

### 3.4 Settings (wp-admin → QR Links → Settings)
- **Approved destination domains**, one per line; subdomains are included.
- **Logos:** pick from the WordPress Media Library and mark one as the default.
- **Default design:** colours and shapes the designer starts with.
- **Link prefix** (default `go`).
- **Title** shown above the generator (default "Jeddah Cables QR Generator").
- **"Use as homepage":** creates a page containing `[genqr]` and sets it as the static front page (Settings → Reading).
- **Limits:** maximum links per visitor per hour (default 20).

## 4. Security and abuse protection

- Visitors can only create links to approved domains, which is checked **on the server**. They can't edit, list or delete links.
- The REST endpoint requires a WordPress nonce from the page, a hidden honeypot field and a **per-IP rate limit** (IP stored only as a hash, for the limit window). Destinations are validated: http/https only, no credentials in the URL, no loops back to `/go/`.
- Admin screens need the `manage_options` capability, and every form checks a nonce and escapes its output, following WordPress conventions.
- The only database data is one table of links plus a history table. No personal data beyond the click counts.

## 5. Data model (custom tables, created on activation)

```
wp_genqr_links     id, code (unique), destination, is_active, clicks, last_click_at,
                   created_at, created_ip_hash, updated_at
wp_genqr_history   id, link_id, field, old_value, new_value, changed_by (user id), changed_at
```

Settings live in one WordPress option (`genqr_settings`).

## 6. Technology

| Part | Choice |
|---|---|
| Plugin | PHP 8.1+ (WordPress 6.5+, for script modules), WordPress REST API, rewrite rules, `dbDelta`, `WP_List_Table` |
| Designer | TypeScript + Preact (small) rendered in a Shadow DOM; built with Vite into one JS file |
| QR engine | GenQR's SVG renderer, ported to the browser: `qrcode` + the same styling code; `jsQR` for the scan check |
| Exports | Canvas (PNG/JPG), SVG as is, `jsPDF` (PDF), `docx` (Word), all in the browser |
| Tests | PHPUnit with `wp-env` (WordPress in Docker) for the plugin; Vitest for the QR engine; Playwright end-to-end (create a code, scan it, follow the redirect) in GitHub Actions |
| Release | GitHub Actions builds `genqr.zip`, which you upload in wp-admin → Plugins → Add New → Upload |

## 7. Hosting notes for GoDaddy

- **Page caching:** GoDaddy Managed WordPress caches pages. If it caches the `/go/` redirects, changes and click counts would be delayed. The plugin sends no-cache headers, but this must be **tested on the real site**; if needed, `/go/*` gets excluded from the cache (GoDaddy support or a setting).
- **Permalinks** must be "pretty" (anything except "Plain") for `/go/<code>` to work. The plugin checks this and warns.
- Plugin uploads must be allowed on the plan. WordPress hosting allows them.

## 8. What carries over from GenQR

**Reused (ported to the browser):** the QR SVG renderer (styles, logo, structural patterns kept square), the scan check, colour-contrast warnings, export sizing, and the designer's layout and wording.

**Not needed:** the Node server, accounts and roles, Active Directory, SMTP/email, multi-database support, dashboards, installers, Docker, the update system.

## 9. Delivery phases

| Phase | Scope | Result |
|---|---|---|
| **1. Plugin core** | Skeleton, tables, `/go/` redirect with click count, admin QR Links page, settings, history | Admin can create and edit links by hand and they redirect |
| **2. QR engine in the browser** | Port the renderer, scan check, exports (PNG/JPG/SVG/PDF/Word), print | Engine tested on its own |
| **3. Public generator** | `[genqr]` shortcode, Shadow DOM designer, REST link creation with approved domains, nonce, honeypot and rate limit | Visitors can make codes end to end |
| **4. Hardening and release** | PHP + Playwright tests in CI, zip release, readme, GoDaddy caching check on a staging page | Installable plugin |

## 10. Testing

**Locally,** with no hosting: `npm run playground` starts WordPress Playground with the plugin mounted and you signed in as admin. Pretty permalinks are on, so `/go/<code>` works.

**On the real site:**
1. Upload the zip and activate the plugin.
2. Settings → "Use as homepage".
3. Create a code, scan it with a phone, change its destination in wp-admin, and scan again: it should go to the new destination immediately.
4. If the redirect doesn't change at once, exclude `/go/*` from GoDaddy's cache (see §7).

## 11. Open questions

None at the moment. They will be added here as they come up.
