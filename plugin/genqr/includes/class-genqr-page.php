<?php
/**
 * The generator page created by "Use as homepage" gets the plugin's own clean layout:
 * the GenQR top bar and the app, without the theme's header, menu or footer.
 * Can be switched off in Settings to use the theme's layout instead.
 */

defined( 'ABSPATH' ) || exit;

class GenQR_Page {

	public static function init() {
		add_filter( 'template_include', array( __CLASS__, 'template' ), 99 );
	}

	public static function is_app_page() {
		$s = GenQR_Settings::get();
		return $s['full_page'] && $s['homepage_id'] && is_page( (int) $s['homepage_id'] );
	}

	public static function template( $template ) {
		if ( ! self::is_app_page() ) {
			return $template;
		}
		GenQR_Shortcode::$app_mode = true;
		// The tab shows the brand ("GenQR"), not the page's title.
		add_filter(
			'pre_get_document_title',
			static function () {
				$s = GenQR_Settings::get();
				return $s['brand'] . ( $s['title'] ? ' – ' . $s['title'] : '' );
			}
		);
		return GENQR_DIR . 'templates/app.php';
	}
}
