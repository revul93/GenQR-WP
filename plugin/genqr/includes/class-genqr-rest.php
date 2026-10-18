<?php
/**
 * Public REST API used by the generator:
 *   GET  /wp-json/genqr/v1/config  – title, logos, default design, approved domains
 *   POST /wp-json/genqr/v1/links   – { url, website } → { code, shortUrl, destination }
 *
 * No login. Abuse is limited by the approved-domain list, a per-visitor hourly limit
 * and a honeypot field. No nonce: generator pages are usually cached, so a nonce in the
 * page would expire while the cached copy is still served.
 */

defined( 'ABSPATH' ) || exit;

class GenQR_Rest {

	const NS = 'genqr/v1';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function routes() {
		register_rest_route(
			self::NS,
			'/config',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'config' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			self::NS,
			'/links',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'create_link' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'url'     => array(
						'type'     => 'string',
						'required' => true,
					),
					'website' => array( 'type' => 'string' ), // honeypot: real visitors never fill it
				),
			)
		);
	}

	public static function config() {
		$response = rest_ensure_response( GenQR_Shortcode::client_config() );
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}

	public static function create_link( WP_REST_Request $request ) {
		if ( '' !== trim( (string) $request->get_param( 'website' ) ) ) {
			return new WP_Error( 'genqr_rejected', __( 'Request rejected.', 'genqr' ), array( 'status' => 400 ) );
		}

		// Logged-in administrators are not limited to the approved domains.
		$is_admin    = current_user_can( 'manage_options' );
		$destination = GenQR_Links::validate_destination( $request->get_param( 'url' ), ! $is_admin );
		if ( is_wp_error( $destination ) ) {
			$destination->add_data( array( 'status' => 400 ) );
			return $destination;
		}

		$ip_hash = GenQR_Links::ip_hash();
		if ( ! $is_admin && GenQR_Links::created_last_hour( $ip_hash ) >= (int) GenQR_Settings::get()['rate_limit'] ) {
			return new WP_Error( 'genqr_rate_limited', __( 'You have created many QR codes in the last hour. Please try again later.', 'genqr' ), array( 'status' => 429 ) );
		}

		$link = GenQR_Links::create( $destination, $is_admin ? get_current_user_id() : null, $ip_hash );
		if ( is_wp_error( $link ) ) {
			$link->add_data( array( 'status' => 500 ) );
			return $link;
		}

		$response = rest_ensure_response(
			array(
				'code'        => $link->code,
				'shortUrl'    => GenQR_Settings::short_url( $link->code ),
				'destination' => $link->destination,
			)
		);
		$response->set_status( 201 );
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}
}
