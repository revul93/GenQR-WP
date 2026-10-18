# GenQR for WordPress

A WordPress plugin for branded QR codes that point to short links you control.

- Visitors open the generator page, paste a web address and get a styled QR code. No login is needed.
- Each QR code contains a short link such as `https://your-site.com/go/k7m2xq9`. You can change where it goes at any time in wp-admin, and printed codes follow the change.
- Visitors can only create links to **approved domains**, which you set in the settings. Administrators can link anywhere.
- Each link counts its clicks. Admins can see the history of changes, switch links off and export them as CSV.
- Downloads are PNG, JPG, SVG, PDF or Word, at any size, and you can print directly. They are all made in the visitor's browser.
- Logos are uploaded by the admin, and visitors choose from them.
- **All QR codes** page: anyone can browse and search every active code (title, short link, destination, scans) and open one to download it again. You can switch this off in Settings.
- The generator page has its own clean layout: a top bar with your name ("GenQR") and no theme header, menu or footer. You can switch this off to use the theme's layout instead.
- Presets (managed in Settings) give one-click designs; it ships with Black, Indigo, Lagoon, Coral and Emerald, all with a rounded pattern and circular corners.

Design notes and decisions are in [PLAN.md](PLAN.md).

## Requirements

- WordPress 6.5 or later, PHP 8.1 or later
- "Pretty" permalinks: anything except **Plain** under Settings → Permalinks

## Install

Step-by-step for GoDaddy, including the database and WordPress settings: **[docs/deploy-godaddy.md](docs/deploy-godaddy.md)**.

1. Download `genqr-<version>.zip` from [Releases](https://github.com/revul93/GenQR-WP/releases), or from the latest CI run's artifacts.
2. In wp-admin, go to **Plugins → Add New → Upload Plugin**, choose the zip and click **Activate**.
3. Open **QR Links → Settings**:
   - Check **Approved domains**. Your own site is added on activation.
   - Add logos, set the default design and the title.
   - Click **Use the QR generator as the homepage**, or put the shortcode `[genqr]` on any page.

### GoDaddy (and other hosts with page caching)

The plugin marks `/go/…` redirects as uncacheable (`Cache-Control: no-store` and `DONOTCACHEPAGE`). After installing, run this check:

1. Create a link and scan it.
2. Change its destination in **QR Links**.
3. Scan it again: it should go to the new address straight away.

If it still goes to the old address, exclude `/go/*` from caching in the host's caching settings, or flush the cache.

## Shortcode

```
[genqr]                      generator with the title from Settings
[genqr title="Make a QR"]    a different title on this page
```

To change the button colour from the theme, set `--genqr-accent` on the page, for example `.genqr-root { --genqr-accent: #c00; }`.

## Development

You need Node 24. PHP is not required locally, because WordPress Playground runs PHP in WebAssembly.

```bash
npm install
npm run build        # browser code → plugin/genqr/assets/build/
npm run playground   # WordPress at http://127.0.0.1:9400 with the plugin active
```

```bash
npm run watch        # rebuild on change (reload the page)
npm test             # unit tests (engine)
npm run typecheck
bash scripts/smoke.sh   # end-to-end checks against the running Playground
```

Playground's admin login is `admin` / `password`. Its data is reset when you stop it.

### Sharing a test site with colleagues

`playground/share.json` sets up a clean test site without auto-login. One way to expose it on the internet is a free Cloudflare quick tunnel:

1. Start the tunnel and note the `https://…trycloudflare.com` address it prints: `cloudflared tunnel --url http://localhost:9400`
2. Start Playground with that address: `npx wp-playground-cli server --port=9400 --site-url=<tunnel address> --mount=./plugin/genqr:/wordpress/wp-content/plugins/genqr --blueprint=./playground/share.json`
3. Log in once with `admin` / `password`, configure it, and change the admin password straight away: the site is public.

The site lives in memory, so stopping Playground (or the PC sleeping) resets it, and each new quick tunnel gets a new address.

CI runs a PHP syntax check (8.1 and 8.4), the type check, the tests, the build and the Playground smoke test, and then packages the zip. Pushing a tag `v*` publishes a GitHub release with the zip attached.

## Layout

| Path | What |
| --- | --- |
| `plugin/genqr/` | The plugin as installed. `assets/build/` is generated. |
| `plugin/genqr/includes/` | PHP: tables, redirects, REST API, shortcode, admin screens |
| `src/engine/` | QR renderer, scan check, exports (browser) |
| `src/*.tsx` | Generator UI (Preact, Shadow DOM) and admin preview |
| `playground/blueprint.json` | Local test site setup |

## License

GPL-2.0-or-later
