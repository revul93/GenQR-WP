# Deploying GenQR to GoDaddy

This guide takes you from a GoDaddy account to a working QR generator on your own domain. It covers both kinds of GoDaddy hosting that run WordPress:

| | **Managed Hosting for WordPress** | **Web Hosting (cPanel)** |
| --- | --- | --- |
| WordPress | GoDaddy installs and updates it for you | You install it, from the cPanel installer or by hand |
| Database | Created and connected automatically | You create it and connect it ([Part B](#part-b-web-hosting-cpanel)) |
| Staging site | Included on every plan except Basic | Not built in |
| Best for | This plugin. Recommended | You already have cPanel hosting |

Check which one you have under **GoDaddy → My Products**. Do [Part A](#part-a-managed-hosting-for-wordpress) or [Part B](#part-b-web-hosting-cpanel), then do [Part C](#part-c-install-and-configure-genqr) for both.

GoDaddy changes its menu names from time to time. If a label below doesn't match what you see, search the [GoDaddy Help Center](https://www.godaddy.com/help) for the step's title.

---

## Before you start

- **The plugin zip.** Download `genqr-<version>.zip` from the [GitHub releases page](https://github.com/revul93/GenQR-WP/releases). Don't unzip it: WordPress installs the zip as it is.
- **Your domain** in the same GoDaddy account, or access to its DNS.
- **Your logo** as a PNG with a transparent background, roughly square, at least 300 × 300 px.
- **The list of approved websites** visitors may create QR codes for, for example `jeddah-cables.com`.

Requirements: WordPress 6.5 or newer and PHP 8.1 or newer. Both are the default on new GoDaddy sites.

---

## Part A: Managed Hosting for WordPress

The database is created and connected for you. You never edit `wp-config.php`.

### A1. Create the WordPress site

1. Go to **GoDaddy → My Products → Managed Hosting for WordPress**, and click **Set up** (or **Manage** → **Add site**).
2. Choose **Start fresh** and pick your domain when asked. If the domain is in the same GoDaddy account, DNS is set up for you.
3. Choose the WordPress admin **username, password and email**. Store them in your password manager.
4. Wait for setup to finish (a few minutes). GoDaddy creates the site, the database and a free SSL certificate.

### A2. Check the PHP version

1. **My Products → Managed Hosting for WordPress → Settings** for the site.
2. Under **Production Site**, next to **PHP version**, it should say **8.1 or newer** (8.2 or 8.3 is fine). If it doesn't, click **Change**, choose 8.2 and save.

See [Change my PHP version](https://www.godaddy.com/help/change-my-php-version-32202).

### A3. (Recommended) Create a staging site

Staging is a private copy of the site where you can test before visitors see anything.

1. In the site's **Settings**, find **Staging site** and click **Create**. See [Set up a staging site](https://www.godaddy.com/help/set-up-a-staging-site-for-my-managed-hosting-for-wordpress-site-12292).
2. Do **Part C** on the staging site first.
3. When everything works, use **Push to production** to copy it to the live site.

### A4. Where the database is

You don't need it for normal use. If you ever do (for a manual backup, for example), open the site's **Settings**. Under **Production Site**, next to **Database details**, click **Open phpMyAdmin**. See [Open phpMyAdmin](https://www.godaddy.com/help/open-phpmyadmin-24573).

Continue with [Part C](#part-c-install-and-configure-genqr).

---

## Part B: Web Hosting (cPanel)

On cPanel hosting, WordPress needs a MySQL database that you create and connect yourself.

### B1. Point the domain to the hosting

If the domain and hosting are in the same GoDaddy account, choose the domain when setting up the hosting, and GoDaddy connects them. Otherwise, set the domain's **A record** to the IP address shown in cPanel (**General Information → Shared IP Address**). DNS changes can take a few hours.

### B2. Turn on SSL

In cPanel, open **SSL/TLS Status** and run **AutoSSL** for the domain, or use the SSL certificate included with your plan. The site must work at `https://` before you print any QR code, because printed codes contain the address.

### B3. Set the PHP version

In cPanel, open **Select PHP Version** (or **MultiPHP Manager**). Choose **8.2** for the domain and save.

### B4. Install WordPress

**Easiest option:** in cPanel, open the **WordPress** installer (Installatron, or **WordPress Manager**). Click **Install**, choose your domain, leave the directory **empty** (so WordPress sits at the domain root), and set the admin user. The installer creates and connects the database for you. Then skip to [Part C](#part-c-install-and-configure-genqr).

**By hand** (only if you can't use the installer):

1. **Create the database.** In cPanel, go to **Databases → MySQL Databases**. Under **Create New Database**, enter a name such as `genqr`, and click **Create Database**. cPanel adds a prefix, giving something like `cpuser_genqr`. Write down the full name.
2. **Create the database user.** On the same page, under **MySQL Users → Add New User**, enter a username and a strong generated password, and click **Create User**. Write down the full username (also prefixed) and the password.
3. **Give the user access.** Under **Add User To Database**, choose the user and the database, and click **Add**. Tick **All Privileges**, then click **Make Changes**.
4. **Upload WordPress.** Download WordPress from [wordpress.org/download](https://wordpress.org/download/). In cPanel's **File Manager**, open `public_html`, upload the zip, and **Extract** it. Move the contents of the extracted `wordpress` folder up into `public_html`, then delete the empty folder and the zip.
5. **Connect WordPress to the database.** In **File Manager** (turn on *Show Hidden Files* in Settings), rename `wp-config-sample.php` to `wp-config.php` and **Edit** it:

   ```php
   define( 'DB_NAME', 'cpuser_genqr' );       // full database name from step 1
   define( 'DB_USER', 'cpuser_genqruser' );   // full username from step 2
   define( 'DB_PASSWORD', 'the-password' );   // password from step 2
   define( 'DB_HOST', 'localhost' );          // keep localhost on GoDaddy cPanel
   ```

   - Replace the block of `AUTH_KEY … NONCE_SALT` lines with fresh values from [api.wordpress.org/secret-key/1.1/salt](https://api.wordpress.org/secret-key/1.1/salt/). GenQR uses these keys to hash visitor addresses for the hourly limit.
   - You can change `$table_prefix = 'wp_';` to something like `jcq_` for a little extra safety. GenQR's tables follow whatever prefix you choose.
   - Check that there are no spaces before or after the names and password.
6. **Run the installer.** Open `https://your-domain/` in a browser, choose the language, and fill in the site title and admin account.

If you see *"Error establishing a database connection"*, one of the four values in step 5 is wrong. See [GoDaddy: fix database connection errors](https://www.godaddy.com/help/fix-error-establishing-a-database-connection-in-wordpress-26356).

### B5. Backups

cPanel hosting doesn't back WordPress up by itself on every plan. Add GoDaddy's backup service, or a backup plugin, and include **the database**, because that is where every short link lives.

Continue with [Part C](#part-c-install-and-configure-genqr).

---

## Part C: Install and configure GenQR

Everything from here happens in **WordPress admin** (`https://your-domain/wp-admin`).

### C1. Basic WordPress settings

1. **Settings → Permalinks**: choose **Post name** and click **Save Changes**. Short links don't work with "Plain".
2. **Settings → General**: check that both **WordPress Address** and **Site Address** start with `https://` and use your real domain. QR codes print this address, so it must be final before you print anything.
3. **Settings → General → Timezone**: choose **Riyadh** (or your city), so click times in the link list are local.

### C2. Install the plugin

1. **Plugins → Add New Plugin → Upload Plugin**.
2. Choose `genqr-<version>.zip`, click **Install Now**, then **Activate Plugin**.
3. A **QR Links** menu appears in the left sidebar.

### C3. Configure it (QR Links → Settings)

Settings has five tabs. One **Save settings** button saves all of them.

| Tab | What to set |
| --- | --- |
| **General** | Leave **Clean layout** on. **Name in the top bar** is "GenQR". **Title above the generator** is, for example, "Jeddah Cables QR Generator". |
| **Visitors** | **Approved domains**: one per line, e.g. `jeddah-cables.com`. Subdomains are included. **Limit per visitor**: 20 an hour is a sensible start. Choose whether to show the public **All QR codes** page. |
| **Logos** | Click **Add logos**, upload your logo to the Media Library and select it. Mark the one visitors start with as **Default**. |
| **Presets** | Edit or add designs. Mark the one the generator starts with as **Default**. |
| **Short links** | Keep the prefix `go` unless you have a reason. Links look like `https://your-domain/go/abc2345`. Never change it after codes are printed. |

Click **Save settings**.

### C4. Make the generator the homepage

1. In **QR Links → Settings → General**, click **Use the QR generator as the homepage**.
2. Open your domain in a private browser window. You should see the GenQR top bar and the generator.

To keep the generator off the homepage for now, add a page with the shortcode `[genqr]` instead, and only switch the homepage when you're ready.

### C5. Test before you print

Do all of these on a phone, on mobile data (not the office Wi-Fi):

1. **Create:** make a QR code for an approved address, download it, and scan it from the screen. It should open the address.
2. **Change:** in **QR Links**, edit that link's destination to another page and save. Scan the **same** code again: it must open the **new** page.
   - If it still opens the old page, GoDaddy's cache is serving an old redirect. Flush the cache: on Managed WordPress, use **Flush Cache** in the WordPress admin bar or the GoDaddy dashboard. If it keeps happening, ask GoDaddy support to exclude `/go/*` from caching. GenQR already marks these redirects "do not cache".
3. **Switch off:** turn the link **Off**. Scanning should show "Link not available". Turn it back on.
4. **Clicks:** the link's click count should have gone up.
5. **Print:** print a code at 3 × 3 cm on the real paper or material, and scan it from about 30 cm away.
6. **Blocked address:** try creating a code for an address that isn't approved, logged out (private window). It should be refused with a clear message.

---

## Day-to-day

- **Change where a printed code goes:** **QR Links → All links → Edit**, change **Destination**, save. The change is instant, and the history table records who changed it.
- **Stop a code:** switch it **Off** (scanning shows "Link not available"), or **Delete** it (scanning shows "Link not found"). Switching off is reversible; deleting isn't.
- **Export everything:** **QR Links → Export CSV** opens in Excel.

## Updating GenQR

1. Download the new `genqr-<version>.zip` from the releases page.
2. **Plugins → Add New Plugin → Upload Plugin**, choose the zip, then **Replace current with uploaded**.
3. Links, settings, logos and presets are kept. Database changes (if any) apply automatically on the first page load.

If you use a staging site, update staging first, check it, then update production.

## Where your data lives

| What | Where |
| --- | --- |
| Short links, titles, destinations, click counts | Table `wp_genqr_links` in the WordPress database |
| Change history (who changed what, when) | Table `wp_genqr_history` |
| Settings, presets, approved domains | WordPress option `genqr_settings` |
| Logos | Media Library (`wp-content/uploads`) |
| QR images and downloads | Not stored. They're made in the visitor's browser. |
| Visitor IP addresses | Not stored. Only a keyed hash is kept, for the hourly limit. |

(`wp_` is your table prefix; it may differ if you changed it.) Deactivating the plugin keeps all data. **Deleting** the plugin from the Plugins page removes the tables and settings for good, so back up first.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/go/…` shows a WordPress "Page not found" | **Settings → Permalinks**: choose **Post name** and click **Save Changes** (this also refreshes the link rules). |
| Visitors see "QR codes can only be made for these websites" | Add the website to **Settings → Visitors → Approved domains**. |
| "You have created many QR codes in the last hour" | That visitor reached the hourly limit. Raise it under **Settings → Visitors**, or wait an hour. |
| A changed destination doesn't take effect | The cache is serving an old redirect. See step 2 of [C5](#c5-test-before-you-print). |
| The generator page shows the theme's header and footer | Turn on **Clean layout** under **Settings → General**. It applies to the page created by "Use as homepage". |
| "There has been a critical error" after installing | Check the PHP version is 8.1 or newer ([A2](#a2-check-the-php-version) / [B3](#b3-set-the-php-version)). |
