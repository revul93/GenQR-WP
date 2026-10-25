# GenQR for WordPress

A WordPress plugin for branded QR codes that point to short links you control. Administrators make the codes in wp-admin; the public site only redirects the short links.

- **Add QR code** (wp-admin → QR codes): title, destination, optional **short link text** (`https://your-site.com/go/expo-2026`, or a random `…/go/k7m2xq9`), a preset or your own colours, shapes and logo, live preview with scan check, then download (PNG, JPG, SVG, PDF, Word) or print.
- **Import**: upload a CSV or Excel (.xlsx) file with link, title and short link text per row. Every row is checked first; one preset and logo apply to the whole import.
- **Export**: tick codes in the list (or export all) and get a **ZIP of image files** (PNG, SVG, JPG or PDF, plus an index.csv) or a **printable A4 sheet** with the title and short link under each code. Each code keeps its own design.
- Change a code's destination at any time and printed codes follow it. Each code counts its scans and keeps a history of changes. Switch codes off or delete them; export the list as CSV.
- **Public site**: `/go/<code>` redirects (never cached). Every other page of the site can redirect to your main website (Settings → General).
- Presets and logos are managed in Settings. It ships with Black, Indigo, Lagoon, Coral and Emerald (rounded pattern, circular corners).

Design notes and decisions are in [PLAN.md](PLAN.md).

## Requirements

- WordPress 6.5 or later, PHP 8.1 or later
- "Pretty" permalinks: anything except **Plain** under Settings → Permalinks

## Install

Step-by-step for GoDaddy, including the database and WordPress settings: **[docs/deploy-godaddy.md](docs/deploy-godaddy.md)**.
To have an AI agent do the deployment, give it **[docs/ai-deploy-runbook.md](docs/ai-deploy-runbook.md)** together with the credentials.

1. Download `genqr-<version>.zip` from [Releases](https://github.com/revul93/GenQR-WP/releases), or from the latest CI run's artifacts.
2. In wp-admin, go to **Plugins → Add New → Upload Plugin**, choose the zip and click **Activate**.
3. Open **QR codes → Settings**: set where other visitors go (General), add logos, check the presets.
4. **QR codes → Add QR code** or **Import** to create codes.

### GoDaddy (and other hosts with page caching)

The plugin marks `/go/…` redirects as uncacheable (`Cache-Control: no-store` and `DONOTCACHEPAGE`). After installing, run this check:

1. Create a link and scan it.
2. Change its destination in **QR codes**.
3. Scan it again: it should go to the new address straight away.

If it still goes to the old address, exclude `/go/*` from caching in the host's caching settings, or flush the cache.

## Import file format

One row per QR code. A header row is optional; with one, columns can be in any order and are recognised by name (`url`/`link`/`destination`, `title`/`name`, `short_link`/`code`/`slug`). Without one, the order is link, title, short link text.

```
url,title,short_link
https://www.example.com/brochure,Product brochure,brochure-2026
https://www.example.com/contact,Contact us,
```

Short link text: 2–32 letters, numbers, dashes or underscores (spaces become dashes); empty gives a random code. Download a template from the Import screen. CSV files may use commas or semicolons and should be UTF-8 (Excel: "CSV UTF-8").

## Development

You need Node 24. PHP is not required locally, because WordPress Playground runs PHP in WebAssembly.

```bash
npm install
npm run build        # browser code → plugin/genqr/assets/build/
npm run playground   # WordPress at http://127.0.0.1:9400 with the plugin active
```

```bash
npm run watch        # rebuild on change (reload the page)
npm test             # unit tests (engine, import parsing)
npm run typecheck
bash scripts/smoke.sh   # end-to-end checks against the running Playground
```

Playground's admin login is `admin` / `password`. Its data is reset when you stop it.

### Sharing a test site with colleagues

```bash
bash scripts/share.sh
```

This starts a free Cloudflare quick tunnel and a Playground site behind it, and prints the public `https://…trycloudflare.com` address. It needs `cloudflared` in your PATH or in `.playground/bin/`.

- **Admin login is `admin` / `password`**, or set `GENQR_ADMIN_PASS` for another password. Anyone with the address can try it, so installing or editing plugins and themes from wp-admin is switched off.
- **Codes survive restarts.** If the previous test site is still running, the script saves its codes and asks you to stop it. The next start brings the codes back with the same short codes, titles, scan counts and designs.
- **Optional site data** goes in the git-ignored `.playground/restore/` folder: `settings.json` (GenQR settings, plus `logo_files` to add as logos) and the logo images. See `playground/share-setup.php`.
- **The site lives in memory.** Stopping it resets everything, and each start gets a new address. Quick tunnels also stop working when the PC sleeps.

CI runs a PHP syntax check (8.1 and 8.4), the type check, the tests, the build and the Playground smoke test, and then packages the zip. Pushing a tag `v*` publishes a GitHub release with the zip attached.

## Layout

| Path | What |
| --- | --- |
| `plugin/genqr/` | The plugin as installed. `assets/build/` is generated. |
| `plugin/genqr/includes/` | PHP: tables, redirects, admin-only REST API, admin screens |
| `src/engine/` | QR renderer, scan check, exports, bulk ZIP/PDF sheet (browser) |
| `src/*.tsx` | wp-admin app (Preact, Shadow DOM): designer, import, bulk export |
| `playground/blueprint.json` | Local test site setup |

## License

GPL-2.0-or-later
