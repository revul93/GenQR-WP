<?php
/**
 * Plugin settings, stored in one option.
 */

defined( 'ABSPATH' ) || exit;

class GenQR_Settings {

	const OPTION = 'genqr_settings';

	/** Path segments the link prefix must not take over. */
	const RESERVED_PREFIXES = array( 'wp-admin', 'wp-content', 'wp-includes', 'wp-json', 'wp-login.php', 'feed', 'page', 'category', 'tag', 'author', 'search', 'comments', 'embed' );

	public static function defaults() {
		return array(
			'title'          => 'Jeddah Cables QR Generator',
			'prefix'         => 'go',
			'domains'        => array(),
			'logos'          => array(),    // attachment ids
			'default_logo'   => 0,          // attachment id, 0 = none
			'style'          => array(
				'foreground'    => '#0b5394',
				'background'    => '#ffffff',
				'moduleShape'   => 'rounded',
				'eyeFrameShape' => 'rounded',
				'eyeBallShape'  => 'rounded',
			),
			'rate_limit'     => 20,         // links per visitor per hour
			'homepage_id'    => 0,          // page created by "Use as homepage"
		);
	}

	public static function get() {
		$saved = get_option( self::OPTION, array() );
		return array_merge( self::defaults(), is_array( $saved ) ? $saved : array() );
	}

	public static function update( array $values ) {
		update_option( self::OPTION, array_merge( self::get(), $values ) );
	}

	/** On first activation, allow the site's own domain. */
	public static function ensure_defaults() {
		if ( false !== get_option( self::OPTION ) ) {
			return;
		}
		$settings = self::defaults();
		$host     = wp_parse_url( home_url(), PHP_URL_HOST );
		if ( $host ) {
			$settings['domains'] = array( preg_replace( '/^www\./', '', strtolower( $host ) ) );
		}
		add_option( self::OPTION, $settings );
	}

	public static function prefix() {
		return self::get()['prefix'];
	}

	/** Public short URL for a code. */
	public static function short_url( $code ) {
		return home_url( '/' . self::prefix() . '/' . $code );
	}

	/** Normalises a list of domains typed by the admin; drops invalid entries. */
	public static function sanitize_domains( $text ) {
		$out = array();
		foreach ( preg_split( '/[\s,]+/', strtolower( (string) $text ) ) as $d ) {
			$d = preg_replace( '#^https?://#', '', trim( $d ) );
			$d = preg_replace( '#[/:].*$#', '', $d );
			$d = preg_replace( '/^www\./', '', $d );
			if ( preg_match( '/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/', $d ) ) {
				$out[] = $d;
			}
		}
		return array_values( array_unique( $out ) );
	}

	public static function sanitize_prefix( $prefix ) {
		$prefix = strtolower( trim( (string) $prefix, " /\t\n" ) );
		if ( ! preg_match( '/^[a-z0-9][a-z0-9-]{0,19}$/', $prefix ) || in_array( $prefix, self::RESERVED_PREFIXES, true ) ) {
			return null;
		}
		return $prefix;
	}

	public static function sanitize_style( $style ) {
		$d   = self::defaults()['style'];
		$hex = '/^#[0-9a-fA-F]{6}$/';
		return array(
			'foreground'    => preg_match( $hex, $style['foreground'] ?? '' ) ? strtolower( $style['foreground'] ) : $d['foreground'],
			'background'    => preg_match( $hex, $style['background'] ?? '' ) ? strtolower( $style['background'] ) : $d['background'],
			'moduleShape'   => in_array( $style['moduleShape'] ?? '', array( 'square', 'rounded', 'dots' ), true ) ? $style['moduleShape'] : $d['moduleShape'],
			'eyeFrameShape' => in_array( $style['eyeFrameShape'] ?? '', array( 'square', 'rounded', 'circle' ), true ) ? $style['eyeFrameShape'] : $d['eyeFrameShape'],
			'eyeBallShape'  => in_array( $style['eyeBallShape'] ?? '', array( 'square', 'rounded', 'circle' ), true ) ? $style['eyeBallShape'] : $d['eyeBallShape'],
		);
	}

	/** Logos as {id, name, url} for the generator; drops deleted attachments. */
	public static function logos() {
		$out = array();
		foreach ( self::get()['logos'] as $id ) {
			$url = wp_get_attachment_image_url( (int) $id, 'medium' );
			if ( $url ) {
				$out[] = array(
					'id'   => (int) $id,
					'name' => get_the_title( (int) $id ),
					'url'  => $url,
				);
			}
		}
		return $out;
	}
}
