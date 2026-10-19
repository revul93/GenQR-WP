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
			'brand'          => 'GenQR',     // name in the top bar of the generator page
			'public_list'    => true,        // "All QR codes" page for visitors
			'full_page'      => true,        // generator page uses the plugin's own clean layout
			'prefix'         => 'go',
			'domains'        => array(),
			'logos'          => array(),    // attachment ids
			'default_logo'   => 0,          // attachment id, 0 = none
			// Design used when there are no presets.
			'style'          => array(
				'foreground'    => '#0b5394',
				'background'    => '#ffffff',
				'moduleShape'   => 'rounded',
				'eyeFrameShape' => 'circle',
				'eyeBallShape'  => 'circle',
			),
			'presets'        => self::default_presets(),
			'default_preset' => 0,          // index into presets; the design the generator starts with
			'rate_limit'     => 20,         // links per visitor per hour
			'homepage_id'    => 0,          // page created by "Use as homepage"
		);
	}

	/** Ready-made designs from the logo's colours; each keeps at least 3:1 contrast on white. */
	public static function default_presets() {
		// Every preset: rounded pattern, circular corners.
		$preset = static function ( $name, $fg, $gradient = null ) {
			return array(
				'name'  => $name,
				'style' => array(
					'foreground'    => $fg,
					'background'    => '#ffffff',
					'gradient'      => $gradient,
					'eyeColor'      => null,
					'moduleShape'   => 'rounded',
					'eyeFrameShape' => 'circle',
					'eyeBallShape'  => 'circle',
				),
			);
		};
		$linear = static fn( $to ) => array( 'type' => 'linear', 'color' => $to, 'rotation' => 45 );
		return array(
			$preset( 'Black', '#000000' ),
			$preset( 'Indigo', '#4f46e5', $linear( '#9333ea' ) ),
			$preset( 'Lagoon', '#0d9488', $linear( '#2563eb' ) ),
			$preset( 'Coral', '#e11d48', $linear( '#ea580c' ) ),
			$preset( 'Emerald', '#059669', $linear( '#0891b2' ) ),
		);
	}

	/** Presets as the admin form posts them: drops unnamed rows, keeps at most 20. */
	public static function sanitize_presets( $rows ) {
		$out = array();
		foreach ( (array) $rows as $row ) {
			$name = isset( $row['name'] ) ? mb_substr( sanitize_text_field( $row['name'] ), 0, 40 ) : '';
			if ( '' === $name || count( $out ) >= 20 ) {
				continue;
			}
			$out[] = array(
				'name'  => $name,
				'style' => self::sanitize_style( is_array( $row['style'] ?? null ) ? $row['style'] : array() ),
			);
		}
		return $out;
	}

	/** The design the generator starts with: the default preset, or the fallback style. */
	public static function start_style() {
		$s       = self::get();
		$presets = $s['presets'];
		if ( $presets ) {
			$i = isset( $presets[ (int) $s['default_preset'] ] ) ? (int) $s['default_preset'] : 0;
			return self::sanitize_style( $presets[ $i ]['style'] );
		}
		return self::sanitize_style( $s['style'] );
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
			'eyeColor'      => preg_match( $hex, $style['eyeColor'] ?? '' ) ? strtolower( $style['eyeColor'] ) : null,
			'gradient'      => self::sanitize_gradient( $style['gradient'] ?? null ),
		);
	}

	/**
	 * A visitor's full design for one QR code: the preset fields plus the advanced ones
	 * (margin, error correction, logo size/spacing, transparency) and the chosen logo.
	 */
	public static function sanitize_design( $design ) {
		$design = is_array( $design ) ? $design : array();
		$style  = self::sanitize_style( $design );
		$style += array(
			'transparentBackground' => ! empty( $design['transparentBackground'] ),
			'margin'                => max( 0, min( 10, (int) ( $design['margin'] ?? 4 ) ) ),
			'errorCorrection'       => in_array( $design['errorCorrection'] ?? '', array( 'L', 'M', 'Q', 'H' ), true ) ? $design['errorCorrection'] : 'M',
			'logoSizePercent'       => max( 10, min( 30, (float) ( $design['logoSizePercent'] ?? 22 ) ) ),
			'logoBacking'           => ! isset( $design['logoBacking'] ) || (bool) $design['logoBacking'],
		);
		return $style;
	}

	private static function sanitize_gradient( $g ) {
		if ( ! is_array( $g ) || ! in_array( $g['type'] ?? '', array( 'linear', 'radial' ), true ) || ! preg_match( '/^#[0-9a-fA-F]{6}$/', $g['color'] ?? '' ) ) {
			return null;
		}
		return array(
			'type'     => $g['type'],
			'color'    => strtolower( $g['color'] ),
			'rotation' => max( 0, min( 360, (int) ( $g['rotation'] ?? 45 ) ) ),
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
