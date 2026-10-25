<?php
/**
 * Short links: creation, validation, changes (with history), designs, clicks.
 */

defined( 'ABSPATH' ) || exit;

class GenQR_Links {

	/** Lower-case only (MySQL compares case-insensitively) and no look-alikes: 0/o, 1/l/i. */
	const ALPHABET    = '23456789abcdefghjkmnpqrstuvwxyz';
	const CODE_LENGTH = 7;

	public static function now() {
		return current_time( 'mysql', true ); // UTC
	}

	// --- Validation -------------------------------------------------------------------

	/** Checks a destination URL (any http/https address). Returns the normalised URL or a WP_Error. */
	public static function validate_destination( $url ) {
		$url = trim( (string) $url );
		if ( '' === $url ) {
			return new WP_Error( 'genqr_empty', __( 'Enter a web address.', 'genqr' ) );
		}
		if ( ! preg_match( '#^https?://#i', $url ) ) {
			$url = 'https://' . $url; // people often type example.com/page
		}
		$parts = wp_parse_url( $url );
		if ( ! $parts || empty( $parts['host'] ) || ! in_array( strtolower( $parts['scheme'] ?? '' ), array( 'http', 'https' ), true ) || ! str_contains( $parts['host'], '.' ) ) {
			return new WP_Error( 'genqr_invalid', __( 'That is not a valid web address.', 'genqr' ) );
		}
		if ( isset( $parts['user'] ) || isset( $parts['pass'] ) ) {
			return new WP_Error( 'genqr_invalid', __( 'Web addresses with a username or password are not allowed.', 'genqr' ) );
		}
		if ( strlen( $url ) > 2000 ) {
			return new WP_Error( 'genqr_invalid', __( 'That web address is too long.', 'genqr' ) );
		}
		// No links pointing back at our own short links.
		$host       = strtolower( $parts['host'] );
		$own        = strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
		$own_prefix = '/' . GenQR_Settings::prefix() . '/';
		if ( ( $host === $own || 'www.' . $host === $own || $host === 'www.' . $own ) && 0 === strpos( $parts['path'] ?? '', $own_prefix ) ) {
			return new WP_Error( 'genqr_loop', __( 'A short link cannot point to another short link.', 'genqr' ) );
		}
		return esc_url_raw( $url, array( 'http', 'https' ) );
	}

	/**
	 * Checks custom short link text. Returns the normalised code or a WP_Error;
	 * $except_id lets a link keep its own code.
	 */
	public static function validate_code( $code, $except_id = 0 ) {
		$clean = GenQR_Settings::sanitize_code( $code );
		if ( null === $clean ) {
			return new WP_Error( 'genqr_code_invalid', __( 'Short link text must be 2–32 characters: letters, numbers, dashes or underscores, starting and ending with a letter or number.', 'genqr' ) );
		}
		$existing = self::get_by_code( $clean );
		if ( $existing && (int) $existing->id !== (int) $except_id ) {
			/* translators: %s: short link text */
			return new WP_Error( 'genqr_code_taken', sprintf( __( 'The short link "%s" is already used by another QR code.', 'genqr' ), $clean ) );
		}
		return $clean;
	}

	// --- Reads -----------------------------------------------------------------------------

	public static function get( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . GenQR_DB::links_table() . ' WHERE id = %d', $id ) );
	}

	public static function get_by_code( $code ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . GenQR_DB::links_table() . ' WHERE code = %s', strtolower( $code ) ) );
	}

	/** @return array{items: object[], total: int} */
	public static function query( $args ) {
		global $wpdb;
		$table  = GenQR_DB::links_table();
		$where  = '1=1';
		$params = array();
		if ( ! empty( $args['search'] ) ) {
			$like     = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$where   .= ' AND (code LIKE %s OR title LIKE %s OR destination LIKE %s)';
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
		}
		if ( isset( $args['status'] ) && in_array( $args['status'], array( 'active', 'inactive' ), true ) ) {
			$where .= ' AND is_active = ' . ( 'active' === $args['status'] ? 1 : 0 );
		}
		if ( ! empty( $args['ids'] ) ) {
			$where .= ' AND id IN (' . implode( ',', array_map( 'intval', (array) $args['ids'] ) ) . ')';
		}
		$orderby = in_array( $args['orderby'] ?? '', array( 'code', 'title', 'destination', 'clicks', 'last_click_at', 'created_at' ), true ) ? $args['orderby'] : 'created_at';
		$order   = 'asc' === strtolower( $args['order'] ?? '' ) ? 'ASC' : 'DESC';
		$limit   = max( 1, (int) ( $args['per_page'] ?? 20 ) );
		$offset  = max( 0, (int) ( $args['offset'] ?? 0 ) );

		$count_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where}";
		$rows_sql  = "SELECT * FROM {$table} WHERE {$where} ORDER BY {$orderby} {$order}, id DESC LIMIT {$limit} OFFSET {$offset}";
		$total     = (int) ( $params ? $wpdb->get_var( $wpdb->prepare( $count_sql, $params ) ) : $wpdb->get_var( $count_sql ) );
		$items     = $params ? $wpdb->get_results( $wpdb->prepare( $rows_sql, $params ) ) : $wpdb->get_results( $rows_sql );
		return array( 'items' => $items, 'total' => $total );
	}

	public static function history( $link_id ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . GenQR_DB::history_table() . ' WHERE link_id = %d ORDER BY changed_at DESC, id DESC', $link_id ) );
	}

	/** A link as the admin app sees it. */
	public static function to_api( $link ) {
		$design = ! empty( $link->design ) ? json_decode( $link->design, true ) : null;
		return array(
			'id'          => (int) $link->id,
			'code'        => $link->code,
			'title'       => $link->title,
			'shortUrl'    => GenQR_Settings::short_url( $link->code ),
			'destination' => $link->destination,
			'active'      => (bool) $link->is_active,
			'clicks'      => (int) $link->clicks,
			'createdAt'   => gmdate( 'c', strtotime( $link->created_at . ' UTC' ) ),
			'style'       => is_array( $design ) ? GenQR_Settings::sanitize_design( $design['style'] ?? array() ) : null,
			'logoId'      => is_array( $design ) ? (int) ( $design['logoId'] ?? 0 ) : null,
		);
	}

	// --- Writes ----------------------------------------------------------------------------

	private static function random_code() {
		$code = '';
		$max  = strlen( self::ALPHABET ) - 1;
		for ( $i = 0; $i < self::CODE_LENGTH; $i++ ) {
			$code .= self::ALPHABET[ random_int( 0, $max ) ];
		}
		return $code;
	}

	/**
	 * Creates a link to an already validated destination. $code is already validated custom
	 * text, or '' for a random one. Returns the row or WP_Error.
	 */
	public static function create( $destination, $title = '', $code = '' ) {
		global $wpdb;
		for ( $attempt = 0; $attempt < 5; $attempt++ ) {
			$now = self::now();
			$ok  = $wpdb->insert(
				GenQR_DB::links_table(),
				array(
					'code'        => '' !== $code ? $code : self::random_code(),
					'title'       => self::clean_title( $title ),
					'destination' => $destination,
					'is_active'   => 1,
					'clicks'      => 0,
					'created_at'  => $now,
					'created_by'  => get_current_user_id() ?: null,
					'updated_at'  => $now,
				)
			);
			if ( $ok ) {
				return self::get( $wpdb->insert_id );
			}
			if ( '' !== $code ) {
				break; // a custom code that clashes won't succeed on retry
			}
		}
		return new WP_Error( 'genqr_db', __( 'Could not create the short link. Please try again.', 'genqr' ) );
	}

	/** Applies admin changes (title, destination, code, is_active) and records each one in the history. */
	public static function update( $id, array $changes ) {
		global $wpdb;
		$link = self::get( $id );
		if ( ! $link ) {
			return new WP_Error( 'genqr_missing', __( 'Link not found.', 'genqr' ) );
		}
		$data    = array();
		$history = array();
		if ( isset( $changes['title'] ) && self::clean_title( $changes['title'] ) !== $link->title ) {
			$data['title'] = self::clean_title( $changes['title'] );
			$history[]     = array( 'title', $link->title, $data['title'] );
		}
		if ( isset( $changes['destination'] ) && $changes['destination'] !== $link->destination ) {
			$data['destination'] = $changes['destination'];
			$history[]           = array( 'destination', $link->destination, $changes['destination'] );
		}
		if ( isset( $changes['code'] ) && $changes['code'] !== $link->code ) {
			$data['code'] = $changes['code'];
			$history[]    = array( 'code', $link->code, $changes['code'] );
		}
		if ( isset( $changes['is_active'] ) && (int) $changes['is_active'] !== (int) $link->is_active ) {
			$data['is_active'] = (int) $changes['is_active'];
			$history[]         = array( 'active', $link->is_active ? 'on' : 'off', $changes['is_active'] ? 'on' : 'off' );
		}
		if ( ! $data ) {
			return $link;
		}
		$now                = self::now();
		$data['updated_at'] = $now;
		$wpdb->update( GenQR_DB::links_table(), $data, array( 'id' => $id ) );
		foreach ( $history as list( $field, $old, $new ) ) {
			$wpdb->insert(
				GenQR_DB::history_table(),
				array(
					'link_id'    => $id,
					'field'      => $field,
					'old_value'  => $old,
					'new_value'  => $new,
					'changed_by' => get_current_user_id() ?: null,
					'changed_at' => $now,
				)
			);
		}
		return self::get( $id );
	}

	public static function clean_title( $title ) {
		return mb_substr( sanitize_text_field( (string) $title ), 0, 120 );
	}

	/** Stores a link's design: { style, logoId }. Logo must be one of the admin's logos. */
	public static function set_design( $id, $style, $logo_id ) {
		global $wpdb;
		$logos = array_map( 'intval', GenQR_Settings::get()['logos'] );
		$wpdb->update(
			GenQR_DB::links_table(),
			array(
				'design' => wp_json_encode(
					array(
						'style'  => GenQR_Settings::sanitize_design( $style ),
						'logoId' => in_array( (int) $logo_id, $logos, true ) ? (int) $logo_id : 0,
					)
				),
			),
			array( 'id' => (int) $id )
		);
	}

	public static function delete( $id ) {
		global $wpdb;
		$wpdb->delete( GenQR_DB::history_table(), array( 'link_id' => $id ) );
		return (bool) $wpdb->delete( GenQR_DB::links_table(), array( 'id' => $id ) );
	}

	public static function record_click( $id ) {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( 'UPDATE ' . GenQR_DB::links_table() . ' SET clicks = clicks + 1, last_click_at = %s WHERE id = %d', self::now(), $id ) );
	}
}
