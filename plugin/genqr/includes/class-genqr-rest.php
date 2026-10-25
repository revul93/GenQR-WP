<?php
/**
 * REST API for the wp-admin app. Every route needs an administrator (manage_options) and
 * WordPress's REST nonce; the public side of the plugin is only the /go/ redirect.
 *
 *   POST /genqr/v1/links              create   { url, title?, code?, style?, logoId? }
 *   POST /genqr/v1/links/<id>         update   { url?, title?, code?, active?, style?, logoId? }
 *   GET  /genqr/v1/links              list     ?ids=1,2,3 | ?search=… &page=
 *   POST /genqr/v1/links/import       bulk     { rows: [{ url, title?, code? }], style?, logoId? }
 *   GET  /genqr/v1/code-check         short link text check  ?code=…&id=
 */

defined( 'ABSPATH' ) || exit;

class GenQR_Rest {

	const NS        = 'genqr/v1';
	const PAGE_SIZE = 200;
	const MAX_BATCH = 200;

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function can_manage() {
		return current_user_can( 'manage_options' );
	}

	public static function routes() {
		$admin = array( __CLASS__, 'can_manage' );
		register_rest_route(
			self::NS,
			'/links',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'list_links' ),
					'permission_callback' => $admin,
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( __CLASS__, 'create_link' ),
					'permission_callback' => $admin,
				),
			)
		);
		register_rest_route(
			self::NS,
			'/links/import',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'import_links' ),
				'permission_callback' => $admin,
			)
		);
		register_rest_route(
			self::NS,
			'/links/(?P<id>\d+)',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'update_link' ),
				'permission_callback' => $admin,
			)
		);
		register_rest_route(
			self::NS,
			'/code-check',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'code_check' ),
				'permission_callback' => $admin,
			)
		);
	}

	private static function error( WP_Error $e, $status = 400 ) {
		$e->add_data( array( 'status' => $status ) );
		return $e;
	}

	private static function respond( $data, $status = 200 ) {
		$response = rest_ensure_response( $data );
		$response->set_status( $status );
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}

	/** Creates one link from { url, title, code, style, logoId }; shared by create and import. */
	private static function create_one( $url, $title, $code, $style, $logo_id ) {
		$destination = GenQR_Links::validate_destination( $url );
		if ( is_wp_error( $destination ) ) {
			return $destination;
		}
		if ( '' !== trim( (string) $code ) ) {
			$code = GenQR_Links::validate_code( $code );
			if ( is_wp_error( $code ) ) {
				return $code;
			}
		} else {
			$code = '';
		}
		$link = GenQR_Links::create( $destination, $title, $code );
		if ( is_wp_error( $link ) ) {
			return $link;
		}
		GenQR_Links::set_design( $link->id, is_array( $style ) ? $style : GenQR_Settings::start_style(), null === $logo_id ? (int) GenQR_Settings::get()['default_logo'] : (int) $logo_id );
		return GenQR_Links::get( $link->id );
	}

	public static function create_link( WP_REST_Request $request ) {
		$link = self::create_one(
			$request->get_param( 'url' ),
			(string) $request->get_param( 'title' ),
			(string) $request->get_param( 'code' ),
			$request->get_param( 'style' ),
			$request->get_param( 'logoId' )
		);
		if ( is_wp_error( $link ) ) {
			return self::error( $link, 'genqr_db' === $link->get_error_code() ? 500 : 400 );
		}
		return self::respond( GenQR_Links::to_api( $link ), 201 );
	}

	public static function update_link( WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$link = GenQR_Links::get( $id );
		if ( ! $link ) {
			return self::error( new WP_Error( 'genqr_missing', __( 'Link not found.', 'genqr' ) ), 404 );
		}
		$changes = array();
		if ( null !== $request->get_param( 'url' ) ) {
			$destination = GenQR_Links::validate_destination( $request->get_param( 'url' ) );
			if ( is_wp_error( $destination ) ) {
				return self::error( $destination );
			}
			$changes['destination'] = $destination;
		}
		if ( null !== $request->get_param( 'code' ) ) {
			$code = GenQR_Links::validate_code( $request->get_param( 'code' ), $id );
			if ( is_wp_error( $code ) ) {
				return self::error( $code );
			}
			$changes['code'] = $code;
		}
		if ( null !== $request->get_param( 'title' ) ) {
			$changes['title'] = (string) $request->get_param( 'title' );
		}
		if ( null !== $request->get_param( 'active' ) ) {
			$changes['is_active'] = rest_sanitize_boolean( $request->get_param( 'active' ) ) ? 1 : 0;
		}
		$link = GenQR_Links::update( $id, $changes );
		if ( is_wp_error( $link ) ) {
			return self::error( $link );
		}
		if ( is_array( $request->get_param( 'style' ) ) ) {
			GenQR_Links::set_design( $id, $request->get_param( 'style' ), (int) $request->get_param( 'logoId' ) );
		}
		return self::respond( GenQR_Links::to_api( GenQR_Links::get( $id ) ) );
	}

	/** Creates up to MAX_BATCH links; returns one result per row, in order. */
	public static function import_links( WP_REST_Request $request ) {
		$rows = $request->get_param( 'rows' );
		if ( ! is_array( $rows ) || ! $rows ) {
			return self::error( new WP_Error( 'genqr_empty', __( 'No rows to import.', 'genqr' ) ) );
		}
		if ( count( $rows ) > self::MAX_BATCH ) {
			/* translators: %d: maximum rows */
			return self::error( new WP_Error( 'genqr_too_many', sprintf( __( 'Send at most %d rows at a time.', 'genqr' ), self::MAX_BATCH ) ) );
		}
		$style   = $request->get_param( 'style' );
		$logo_id = $request->get_param( 'logoId' );
		$results = array();
		foreach ( array_values( $rows ) as $row ) {
			$row       = is_array( $row ) ? $row : array();
			$link      = self::create_one( $row['url'] ?? '', (string) ( $row['title'] ?? '' ), (string) ( $row['code'] ?? '' ), $style, $logo_id );
			$results[] = is_wp_error( $link )
				? array(
					'ok'    => false,
					'error' => $link->get_error_message(),
				)
				: array(
					'ok'   => true,
					'link' => GenQR_Links::to_api( $link ),
				);
		}
		return self::respond( array( 'results' => $results ) );
	}

	public static function list_links( WP_REST_Request $request ) {
		$page   = max( 1, (int) $request->get_param( 'page' ) );
		$ids    = array_filter( array_map( 'intval', explode( ',', (string) $request->get_param( 'ids' ) ) ) );
		$result = GenQR_Links::query(
			array(
				'ids'      => $ids,
				'search'   => mb_substr( sanitize_text_field( (string) $request->get_param( 'search' ) ), 0, 100 ),
				'status'   => sanitize_key( (string) $request->get_param( 'status' ) ),
				'per_page' => self::PAGE_SIZE,
				'offset'   => ( $page - 1 ) * self::PAGE_SIZE,
			)
		);
		return self::respond(
			array(
				'items' => array_map( array( 'GenQR_Links', 'to_api' ), $result['items'] ),
				'total' => $result['total'],
				'pages' => max( 1, (int) ceil( $result['total'] / self::PAGE_SIZE ) ),
			)
		);
	}

	public static function code_check( WP_REST_Request $request ) {
		$code = GenQR_Links::validate_code( (string) $request->get_param( 'code' ), (int) $request->get_param( 'id' ) );
		return self::respond(
			is_wp_error( $code )
				? array(
					'ok'      => false,
					'message' => $code->get_error_message(),
				)
				: array(
					'ok'       => true,
					'code'     => $code,
					'shortUrl' => GenQR_Settings::short_url( $code ),
				)
		);
	}
}
