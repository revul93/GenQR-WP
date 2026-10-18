<?php
/**
 * Short links: creation, validation, changes (with history), clicks.
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

	/**
	 * Checks a destination URL. Visitors may only use approved domains; admins may use any
	 * http(s) URL. Returns the normalised URL or a WP_Error.
	 */
	public static function validate_destination( $url, $for_visitor ) {
		$url = trim( (string) $url );
		if ( '' === $url ) {
			return new WP_Error( 'genqr_empty', __( 'Enter a website address.', 'genqr' ) );
		}
		if ( ! preg_match( '#^https?://#i', $url ) ) {
			$url = 'https://' . $url; // people often type example.com/page
		}
		$parts = wp_parse_url( $url );
		if ( ! $parts || empty( $parts['host'] ) || ! in_array( strtolower( $parts['scheme'] ?? '' ), array( 'http', 'https' ), true ) ) {
			return new WP_Error( 'genqr_invalid', __( 'That is not a valid web address.', 'genqr' ) );
		}
		if ( isset( $parts['user'] ) || isset( $parts['pass'] ) ) {
			return new WP_Error( 'genqr_invalid', __( 'Web addresses with a username or password are not allowed.', 'genqr' ) );
		}
		if ( strlen( $url ) > 2000 ) {
			return new WP_Error( 'genqr_invalid', __( 'That web address is too long.', 'genqr' ) );
		}
		$host = strtolower( $parts['host'] );

		// No links pointing back at our own short links.
		$own = strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
		$own_prefix = '/' . GenQR_Settings::prefix() . '/';
		if ( ( $host === $own || 'www.' . $host === $own || $host === 'www.' . $own ) && 0 === strpos( $parts['path'] ?? '', $own_prefix ) ) {
			return new WP_Error( 'genqr_loop', __( 'A short link cannot point to another short link.', 'genqr' ) );
		}

		if ( $for_visitor && ! self::domain_allowed( $host ) ) {
			$domains = GenQR_Settings::get()['domains'];
			return new WP_Error(
				'genqr_domain',
				$domains
					? sprintf( /* translators: %s: list of domains */ __( 'QR codes can only be made for these websites: %s', 'genqr' ), implode( ', ', $domains ) )
					: __( 'QR codes cannot be created yet: no websites have been approved.', 'genqr' )
			);
		}
		return esc_url_raw( $url, array( 'http', 'https' ) );
	}

	public static function domain_allowed( $host ) {
		$host = preg_replace( '/^www\./', '', strtolower( $host ) );
		foreach ( GenQR_Settings::get()['domains'] as $domain ) {
			if ( $host === $domain || substr( $host, -strlen( '.' . $domain ) ) === '.' . $domain ) {
				return true;
			}
		}
		return false;
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
			$where   .= ' AND (code LIKE %s OR destination LIKE %s)';
			$params[] = $like;
			$params[] = $like;
		}
		if ( isset( $args['status'] ) && in_array( $args['status'], array( 'active', 'inactive' ), true ) ) {
			$where .= ' AND is_active = ' . ( 'active' === $args['status'] ? 1 : 0 );
		}
		$orderby = in_array( $args['orderby'] ?? '', array( 'code', 'destination', 'clicks', 'last_click_at', 'created_at' ), true ) ? $args['orderby'] : 'created_at';
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

	// --- Writes ----------------------------------------------------------------------------

	private static function random_code() {
		$code = '';
		$max  = strlen( self::ALPHABET ) - 1;
		for ( $i = 0; $i < self::CODE_LENGTH; $i++ ) {
			$code .= self::ALPHABET[ random_int( 0, $max ) ];
		}
		return $code;
	}

	/** Creates a link to an already validated destination. Returns the row or WP_Error. */
	public static function create( $destination, $created_by = null, $ip_hash = null ) {
		global $wpdb;
		for ( $attempt = 0; $attempt < 5; $attempt++ ) {
			$code = self::random_code();
			$now  = self::now();
			$ok   = $wpdb->insert(
				GenQR_DB::links_table(),
				array(
					'code'            => $code,
					'destination'     => $destination,
					'is_active'       => 1,
					'clicks'          => 0,
					'created_at'      => $now,
					'created_by'      => $created_by,
					'created_ip_hash' => $ip_hash,
					'updated_at'      => $now,
				)
			);
			if ( $ok ) {
				return self::get( $wpdb->insert_id );
			}
		}
		return new WP_Error( 'genqr_db', __( 'Could not create the short link. Please try again.', 'genqr' ) );
	}

	/** Applies admin changes and records each one in the history. */
	public static function update( $id, array $changes ) {
		global $wpdb;
		$link = self::get( $id );
		if ( ! $link ) {
			return new WP_Error( 'genqr_missing', __( 'Link not found.', 'genqr' ) );
		}
		$data    = array();
		$history = array();
		if ( isset( $changes['destination'] ) && $changes['destination'] !== $link->destination ) {
			$data['destination'] = $changes['destination'];
			$history[]           = array( 'destination', $link->destination, $changes['destination'] );
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

	public static function delete( $id ) {
		global $wpdb;
		$wpdb->delete( GenQR_DB::history_table(), array( 'link_id' => $id ) );
		return (bool) $wpdb->delete( GenQR_DB::links_table(), array( 'id' => $id ) );
	}

	public static function record_click( $id ) {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( 'UPDATE ' . GenQR_DB::links_table() . ' SET clicks = clicks + 1, last_click_at = %s WHERE id = %d', self::now(), $id ) );
	}

	// --- Visitor rate limit --------------------------------------------------------------------

	/** Keyed hash of the visitor's IP: enough to count requests, without storing the address. */
	public static function ip_hash() {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		return hash_hmac( 'sha256', $ip, wp_salt( 'auth' ) );
	}

	public static function created_last_hour( $ip_hash ) {
		global $wpdb;
		$since = gmdate( 'Y-m-d H:i:s', time() - HOUR_IN_SECONDS );
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . GenQR_DB::links_table() . ' WHERE created_ip_hash = %s AND created_at > %s', $ip_hash, $since ) );
	}
}
