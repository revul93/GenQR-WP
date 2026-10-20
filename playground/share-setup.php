<?php
/**
 * Prepares a shared test site (run by playground/share.json through scripts/share.sh).
 * Reads optional files from /restore (the git-ignored .playground/restore folder):
 *   admin-pass     new password for the "admin" user
 *   settings.json  GenQR settings to apply; "logo_files" lists images in /restore to add as logos
 * and makes the generator the homepage.
 */

require '/wordpress/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

foreach ( array( 1, 2 ) as $id ) { // "Hello world!" and "Sample Page"
	if ( get_post( $id ) ) {
		wp_delete_post( $id, true );
	}
}

if ( is_readable( '/restore/admin-pass' ) ) {
	wp_set_password( trim( file_get_contents( '/restore/admin-pass' ) ), 1 );
}

$settings = is_readable( '/restore/settings.json' ) ? json_decode( file_get_contents( '/restore/settings.json' ), true ) : array();
if ( is_array( $settings ) && $settings ) {
	$logo_ids = array();
	foreach ( (array) ( $settings['logo_files'] ?? array() ) as $name ) {
		$src = '/restore/' . basename( $name );
		if ( ! is_readable( $src ) ) {
			continue;
		}
		$upload = wp_upload_bits( basename( $src ), null, file_get_contents( $src ) );
		if ( ! empty( $upload['error'] ) ) {
			continue;
		}
		$id = wp_insert_attachment(
			array(
				'post_title'     => preg_replace( '/\.[^.]+$/', '', str_replace( '-', ' ', basename( $src ) ) ),
				'post_mime_type' => wp_check_filetype( $upload['file'] )['type'],
				'post_status'    => 'inherit',
			),
			$upload['file']
		);
		wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $upload['file'] ) );
		$logo_ids[] = (int) $id;
	}
	unset( $settings['logo_files'] );
	if ( $logo_ids ) {
		$settings['logos']        = $logo_ids;
		$settings['default_logo'] = $logo_ids[0];
	}
	GenQR_Settings::update( $settings );
}

// Links from a previous run (exported from the public list), with the same short codes so
// QR codes already shared keep working. Logos get new ids on every run: a link that had a
// logo gets the first logo of this run.
if ( is_readable( '/restore/links.json' ) ) {
	global $wpdb;
	$first_logo = (int) ( GenQR_Settings::get()['logos'][0] ?? 0 );
	foreach ( (array) json_decode( file_get_contents( '/restore/links.json' ), true ) as $l ) {
		if ( empty( $l['code'] ) || empty( $l['destination'] ) || GenQR_Links::get_by_code( $l['code'] ) ) {
			continue;
		}
		$created = ! empty( $l['createdAt'] ) ? gmdate( 'Y-m-d H:i:s', strtotime( $l['createdAt'] ) ) : GenQR_Links::now();
		$wpdb->insert(
			GenQR_DB::links_table(),
			array(
				'code'        => strtolower( $l['code'] ),
				'title'       => GenQR_Links::clean_title( $l['title'] ?? '' ),
				'destination' => esc_url_raw( $l['destination'], array( 'http', 'https' ) ),
				'is_active'   => 1,
				'clicks'      => (int) ( $l['clicks'] ?? 0 ),
				'created_at'  => $created,
				'updated_at'  => $created,
			)
		);
		if ( is_array( $l['style'] ?? null ) ) {
			GenQR_Links::set_design( $wpdb->insert_id, $l['style'], ! empty( $l['logoId'] ) ? $first_logo : 0 );
		}
	}
}

// Generator as the homepage (same as the "Use as homepage" button).
$s    = GenQR_Settings::get();
$page = wp_insert_post(
	array(
		'post_type'    => 'page',
		'post_status'  => 'publish',
		'post_title'   => $s['brand'],
		'post_content' => '<!-- wp:shortcode -->[genqr]<!-- /wp:shortcode -->',
	)
);
GenQR_Settings::update( array( 'homepage_id' => (int) $page ) );
update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', (int) $page );
