<?php
/**
 * Public REST API used by the generator:
 *   GET  /wp-json/genqr/v1/config  – title, logos, default design, approved domains
 *   POST /wp-json/genqr/v1/links   – { url, title, website } → { code, title, shortUrl, destination }
 *   GET  /wp-json/genqr/v1/links   – public list of active links (when enabled in Settings)
 *   GET  /wp-json/genqr/v1/links/<code> – one active link
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
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'list_links' ),
				'permission_callback' => array( __CLASS__, 'list_allowed' ),
				'args'                => array(
					'search' => array( 'type' => 'string' ),
					'page'   => array(
						'type'    => 'integer',
						'default' => 1,
						'minimum' => 1,
					),
				),
			)
		);
		register_rest_route(
			self::NS,
			'/links/(?P<code>[A-Za-z0-9]{3,32})',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_link' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			self::NS,
			'/links/(?P<code>[A-Za-z0-9]{3,32})/design',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'save_design' ),
				'permission_callback' => '__return_true', // checked against the link's edit key
				'args'                => array(
					'key'    => array(
						'type'     => 'string',
						'required' => true,
					),
					'style'  => array(
						'type'     => 'object',
						'required' => true,
					),
					'logoId' => array( 'type' => 'integer' ),
				),
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
					'title'   => array( 'type' => 'string' ),
					'style'   => array( 'type' => 'object' ),
					'logoId'  => array( 'type' => 'integer' ),
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

		$link = GenQR_Links::create( $destination, $is_admin ? get_current_user_id() : null, $ip_hash, (string) $request->get_param( 'title' ) );
		if ( is_wp_error( $link ) ) {
			$link->add_data( array( 'status' => 500 ) );
			return $link;
		}
		// The creator's browser gets a private key to save later design tweaks to this link.
		$token = wp_generate_password( 32, false );
		GenQR_Links::set_design( $link->id, (array) $request->get_param( 'style' ), (int) $request->get_param( 'logoId' ), GenQR_Links::token_hash( $token ) );
		$link = GenQR_Links::get( $link->id );

		$response = rest_ensure_response(
			array(
				'code'        => $link->code,
				'title'       => $link->title,
				'shortUrl'    => GenQR_Settings::short_url( $link->code ),
				'destination' => $link->destination,
				'style'       => GenQR_Links::to_public( $link )['style'],
				'logoId'      => GenQR_Links::to_public( $link )['logoId'],
				'editKey'     => $token,
			)
		);
		$response->set_status( 201 );
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}

	const PAGE_SIZE = 24;

	public static function list_allowed() {
		return GenQR_Settings::get()['public_list'] || current_user_can( 'manage_options' );
	}

	public static function list_links( WP_REST_Request $request ) {
		$page   = max( 1, (int) $request->get_param( 'page' ) );
		$result = GenQR_Links::query(
			array(
				'search'   => mb_substr( sanitize_text_field( (string) $request->get_param( 'search' ) ), 0, 100 ),
				'status'   => 'active',
				'per_page' => self::PAGE_SIZE,
				'offset'   => ( $page - 1 ) * self::PAGE_SIZE,
			)
		);
		$response = rest_ensure_response(
			array(
				'items' => array_map( array( 'GenQR_Links', 'to_public' ), $result['items'] ),
				'total' => $result['total'],
				'pages' => (int) ceil( $result['total'] / self::PAGE_SIZE ),
			)
		);
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}

	public static function get_link( WP_REST_Request $request ) {
		$link = GenQR_Links::get_by_code( (string) $request['code'] );
		if ( ! $link || ! $link->is_active ) {
			return new WP_Error( 'genqr_missing', __( 'This QR code does not exist or has been switched off.', 'genqr' ), array( 'status' => 404 ) );
		}
		$response = rest_ensure_response( GenQR_Links::to_public( $link ) );
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}

	/** Saves design changes made after creating a link; only the creator's edit key may do it. */
	public static function save_design( WP_REST_Request $request ) {
		$link = GenQR_Links::get_by_code( (string) $request['code'] );
		$key  = (string) $request->get_param( 'key' );
		if ( ! $link || empty( $link->design_token ) || '' === $key || ! hash_equals( $link->design_token, GenQR_Links::token_hash( $key ) ) ) {
			return new WP_Error( 'genqr_forbidden', __( 'This design can no longer be changed.', 'genqr' ), array( 'status' => 403 ) );
		}
		GenQR_Links::set_design( $link->id, (array) $request->get_param( 'style' ), (int) $request->get_param( 'logoId' ) );
		$response = rest_ensure_response( GenQR_Links::to_public( GenQR_Links::get( $link->id ) ) );
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}
}
