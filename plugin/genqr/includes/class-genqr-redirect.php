<?php
/**
 * Public side of the plugin:
 *   https://<site>/<prefix>/<code>  →  302 to the code's destination
 *   any other public page            →  302 to the "homepage redirect" address (if set)
 */

defined( 'ABSPATH' ) || exit;

class GenQR_Redirect {

	const QUERY_VAR = 'genqr_code';

	public static function init() {
		add_action( 'init', array( __CLASS__, 'add_rewrite_rule' ) );
		add_filter( 'query_vars', array( __CLASS__, 'query_vars' ) );
		// Early, before themes or other plugins render anything.
		add_action( 'template_redirect', array( __CLASS__, 'handle' ), 0 );
		add_action( 'template_redirect', array( __CLASS__, 'redirect_site' ), 1 );
	}

	/** The site has no public pages of its own: send visitors to the company website. */
	public static function redirect_site() {
		$target = GenQR_Settings::get()['home_redirect'];
		if ( '' === $target || is_admin() || wp_doing_ajax() || is_robots() ) {
			return;
		}
		nocache_headers();
		wp_redirect( $target, 302, 'GenQR' ); // phpcs:ignore WordPress.Security.SafeRedirect -- admin-set address
		exit;
	}

	public static function add_rewrite_rule() {
		// Set when the admin changes the prefix: the new rule exists from this request on.
		if ( get_option( 'genqr_flush_rewrite' ) ) {
			delete_option( 'genqr_flush_rewrite' );
			add_action( 'wp_loaded', 'flush_rewrite_rules' );
		}
		add_rewrite_rule( '^' . preg_quote( GenQR_Settings::prefix(), '/' ) . '/([A-Za-z0-9_-]{2,32})/?$', 'index.php?' . self::QUERY_VAR . '=$matches[1]', 'top' );
	}

	public static function query_vars( $vars ) {
		$vars[] = self::QUERY_VAR;
		return $vars;
	}

	/** Link previews and crawlers don't count as clicks. */
	private static function is_bot() {
		$ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? strtolower( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) ) : '';
		return '' === $ua || (bool) preg_match( '/bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|curl|wget|python-requests|headless/', $ua );
	}

	public static function handle() {
		$code = get_query_var( self::QUERY_VAR );
		if ( ! $code ) {
			return;
		}

		// Redirects must never be cached: the admin can change the destination at any time.
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true ); // honoured by most WordPress caching layers
		}
		nocache_headers();
		header( 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0', true );
		header( 'X-Robots-Tag: noindex, nofollow', true );

		$link = GenQR_Links::get_by_code( (string) $code );
		if ( ! $link || ! $link->is_active ) {
			self::unavailable( $link ? 410 : 404 );
		}

		$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) ) : 'GET';
		if ( 'GET' === $method && ! self::is_bot() ) {
			GenQR_Links::record_click( (int) $link->id );
		}

		wp_redirect( $link->destination, 302, 'GenQR' ); // phpcs:ignore WordPress.Security.SafeRedirect -- destination is validated on save
		exit;
	}

	private static function unavailable( $status ) {
		status_header( $status );
		$title   = 404 === $status ? __( 'Link not found', 'genqr' ) : __( 'Link not available', 'genqr' );
		$message = 404 === $status ? __( 'This link does not exist. Check that it was typed correctly.', 'genqr' ) : __( 'This link has been switched off.', 'genqr' );
		$site    = get_bloginfo( 'name' );
		header( 'Content-Type: text/html; charset=utf-8' );
		?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title><?php echo esc_html( $title . ' – ' . $site ); ?></title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f4f6f8;color:#1f2933}
main{background:#fff;padding:2.5rem 2rem;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);max-width:420px;margin:1rem;text-align:center}
h1{font-size:1.4rem;margin:.25rem 0 .5rem}p{color:#52606d;line-height:1.5}a{color:#0b5394}
</style>
</head>
<body><main>
<h1><?php echo esc_html( $title ); ?></h1>
<p><?php echo esc_html( $message ); ?></p>
<p><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php echo esc_html( $site ); ?></a></p>
</main></body>
</html>
		<?php
		exit;
	}
}
