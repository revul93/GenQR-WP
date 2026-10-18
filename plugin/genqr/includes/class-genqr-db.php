<?php
/**
 * Database tables and activation.
 */

defined( 'ABSPATH' ) || exit;

class GenQR_DB {

	public static function links_table() {
		global $wpdb;
		return $wpdb->prefix . 'genqr_links';
	}

	public static function history_table() {
		global $wpdb;
		return $wpdb->prefix . 'genqr_history';
	}

	/** Creates or upgrades the tables (dbDelta is idempotent). */
	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset = $wpdb->get_charset_collate();
		$links   = self::links_table();
		$history = self::history_table();

		dbDelta(
			"CREATE TABLE {$links} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				code varchar(32) NOT NULL,
				title varchar(120) NOT NULL DEFAULT '',
				destination text NOT NULL,
				is_active tinyint(1) NOT NULL DEFAULT 1,
				clicks bigint(20) unsigned NOT NULL DEFAULT 0,
				last_click_at datetime NULL DEFAULT NULL,
				created_at datetime NOT NULL,
				created_by bigint(20) unsigned NULL DEFAULT NULL,
				created_ip_hash char(64) NULL DEFAULT NULL,
				updated_at datetime NOT NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY code (code),
				KEY created_ip_hash (created_ip_hash)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$history} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				link_id bigint(20) unsigned NOT NULL,
				field varchar(20) NOT NULL,
				old_value text NULL,
				new_value text NULL,
				changed_by bigint(20) unsigned NULL DEFAULT NULL,
				changed_at datetime NOT NULL,
				PRIMARY KEY  (id),
				KEY link_id (link_id)
			) {$charset};"
		);

		update_option( 'genqr_db_version', GENQR_DB_VERSION );
	}

	public static function activate() {
		self::install();
		GenQR_Settings::ensure_defaults();
		GenQR_Redirect::add_rewrite_rule();
		flush_rewrite_rules();
	}

	/** Runs install() after a plugin update that changed the schema. */
	public static function maybe_upgrade() {
		if ( get_option( 'genqr_db_version' ) !== GENQR_DB_VERSION ) {
			self::install();
		}
	}
}
