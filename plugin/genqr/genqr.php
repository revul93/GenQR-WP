<?php
/**
 * Plugin Name:       GenQR – QR Codes & Short Links
 * Plugin URI:        https://github.com/revul93/GenQR-WP
 * Description:       Branded QR code generator for visitors (no login) with short links on your domain that only administrators can change. Add the [genqr] shortcode to a page.
 * Version:           0.1.0
 * Requires at least: 6.5
 * Requires PHP:      8.1
 * Author:            GenQR
 * License:           GPL-2.0-or-later
 * Text Domain:       genqr
 */

defined( 'ABSPATH' ) || exit;

define( 'GENQR_VERSION', '0.1.0' );
define( 'GENQR_DB_VERSION', '2' );
define( 'GENQR_FILE', __FILE__ );
define( 'GENQR_DIR', plugin_dir_path( __FILE__ ) );
define( 'GENQR_URL', plugin_dir_url( __FILE__ ) );

require_once GENQR_DIR . 'includes/class-genqr-db.php';
require_once GENQR_DIR . 'includes/class-genqr-settings.php';
require_once GENQR_DIR . 'includes/class-genqr-links.php';
require_once GENQR_DIR . 'includes/class-genqr-redirect.php';
require_once GENQR_DIR . 'includes/class-genqr-rest.php';
require_once GENQR_DIR . 'includes/class-genqr-shortcode.php';
require_once GENQR_DIR . 'includes/class-genqr-page.php';

if ( is_admin() ) {
	require_once GENQR_DIR . 'includes/class-genqr-links-table.php';
	require_once GENQR_DIR . 'includes/class-genqr-admin.php';
}

register_activation_hook( __FILE__, array( 'GenQR_DB', 'activate' ) );
register_deactivation_hook( __FILE__, 'flush_rewrite_rules' );

add_action( 'plugins_loaded', array( 'GenQR_DB', 'maybe_upgrade' ) );
GenQR_Redirect::init();
GenQR_Rest::init();
GenQR_Shortcode::init();
GenQR_Page::init();
if ( is_admin() ) {
	GenQR_Admin::init();
}
