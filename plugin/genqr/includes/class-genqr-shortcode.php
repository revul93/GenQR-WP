<?php
/**
 * [genqr] shortcode: the public QR generator and the "All QR codes" list. Renders a mount
 * point; the app itself is a script module (assets/build/genqr.js) running in a Shadow DOM
 * so themes cannot restyle it.
 */

defined( 'ABSPATH' ) || exit;

class GenQR_Shortcode {

	/** True while rendering the plugin's own full-page layout (see GenQR_Page). */
	public static $app_mode = false;

	public static function init() {
		add_shortcode( 'genqr', array( __CLASS__, 'render' ) );
	}

	/** Everything the browser needs; also served by GET /genqr/v1/config. */
	public static function client_config() {
		$s = GenQR_Settings::get();
		return array(
			'title'       => $s['title'],
			'brand'       => $s['brand'],
			'domains'     => $s['domains'],
			'logos'       => GenQR_Settings::logos(),
			'defaultLogo' => (int) $s['default_logo'],
			'style'       => GenQR_Settings::sanitize_style( $s['style'] ),
			'publicList'  => (bool) $s['public_list'],
			'appMode'     => self::$app_mode,
			'api'         => esc_url_raw( rest_url( GenQR_Rest::NS . '/' ) ),
			'shortBase'   => trailingslashit( home_url( '/' . GenQR_Settings::prefix() ) ),
		);
	}

	public static function render( $atts = array() ) {
		$atts   = shortcode_atts( array( 'title' => '' ), $atts, 'genqr' );
		$config = self::client_config();
		if ( '' !== $atts['title'] ) {
			$config['title'] = sanitize_text_field( $atts['title'] );
		}

		$bundle = GENQR_DIR . 'assets/build/genqr.js';
		if ( ! file_exists( $bundle ) ) {
			return current_user_can( 'manage_options' )
				? '<p><strong>GenQR:</strong> ' . esc_html__( 'the generator script is missing. Install the plugin from a release zip, or run "npm run build".', 'genqr' ) . '</p>'
				: '';
		}
		// An ES module: the PDF/Word code is in chunks it imports only when needed.
		wp_enqueue_script_module( 'genqr', GENQR_URL . 'assets/build/genqr.js', array(), filemtime( $bundle ) );

		// outline:none: some themes outline whatever holds focus, which would frame the whole app.
		return sprintf(
			'<div class="genqr-root alignwide" style="outline:none" data-config="%s"><noscript>%s</noscript></div>',
			esc_attr( wp_json_encode( $config ) ),
			esc_html__( 'The QR code generator needs JavaScript.', 'genqr' )
		);
	}
}
