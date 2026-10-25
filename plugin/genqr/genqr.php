<?php
/**
 * Plugin Name:       GenQR – QR Codes & Short Links
 * Plugin URI:        https://github.com/revul93/GenQR-WP
 * Description:       Branded QR codes with short links on your own domain. Administrators create, import and export codes in wp-admin; the public site only redirects the short links.
 * Version:           0.2.0
 * Requires at least: 6.5
 * Requires PHP:      8.1
 * Author:            GenQR
 * License:           GPL-2.0-or-later
 * Text Domain:       genqr
 */

defined( 'ABSPATH' ) || exit;

define( 'GENQR_VERSION', '0.2.0' );
define( 'GENQR_DB_VERSION', '4' );
define( 'GENQR_FILE', __FILE__ );
define( 'GENQR_DIR', plugin_dir_path( __FILE__ ) );
define( 'GENQR_URL', plugin_dir_url( __FILE__ ) );

require_once GENQR_DIR . 'includes/class-genqr-db.php';
require_once GENQR_DIR . 'includes/class-genqr-settings.php';
require_once GENQR_DIR . 'includes/class-genqr-links.php';
require_once GENQR_DIR . 'includes/class-genqr-redirect.php';
require_once GENQR_DIR . 'includes/class-genqr-rest.php';

if ( is_admin() ) {
	require_once GENQR_DIR . 'includes/class-genqr-links-table.php';
	require_once GENQR_DIR . 'includes/class-genqr-admin.php';
}

register_activation_hook( __FILE__, array( 'GenQR_DB', 'activate' ) );
register_deactivation_hook( __FILE__, 'flush_rewrite_rules' );

add_action( 'plugins_loaded', array( 'GenQR_DB', 'maybe_upgrade' ) );
GenQR_Redirect::init();
GenQR_Rest::init();
// Version 0.1 had a public generator on a [genqr] page; keep the shortcode silent on such pages.
add_shortcode( 'genqr', '__return_empty_string' );
if ( is_admin() ) {
	GenQR_Admin::init();
}
