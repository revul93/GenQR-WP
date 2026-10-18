<?php
/**
 * Runs when the plugin is deleted (not just deactivated): removes its tables and options.
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}genqr_history" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}genqr_links" );   // phpcs:ignore WordPress.DB.DirectDatabaseQuery
delete_option( 'genqr_settings' );
delete_option( 'genqr_db_version' );
delete_option( 'genqr_flush_rewrite' );
