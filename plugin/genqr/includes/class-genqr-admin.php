<?php
/**
 * wp-admin screens: QR codes list (bulk actions, ZIP/PDF export), Add / Edit QR code (designer
 * and history), Import, Settings, CSV export. Everything requires manage_options; changes
 * need a nonce. The designer, import and export run in the browser (assets/build/genqr-admin.js)
 * and talk to the REST API in class-genqr-rest.php.
 */

defined( 'ABSPATH' ) || exit;

class GenQR_Admin {

	const CAP = 'manage_options';

	private static $list_hook = '';

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_head', array( __CLASS__, 'hide_edit_menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_action( 'admin_notices', array( __CLASS__, 'notices' ) );
		add_action( 'admin_post_genqr_link_action', array( __CLASS__, 'handle_link_action' ) );
		add_action( 'admin_post_genqr_save_settings', array( __CLASS__, 'handle_save_settings' ) );
		add_action( 'admin_post_genqr_export', array( __CLASS__, 'handle_export' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( GENQR_FILE ), array( __CLASS__, 'plugin_links' ) );
	}

	// --- Menus and helpers ----------------------------------------------------------------------

	public static function menu() {
		self::$list_hook = add_menu_page( __( 'QR codes', 'genqr' ), __( 'QR codes', 'genqr' ), self::CAP, 'genqr', array( __CLASS__, 'page_list' ), 'dashicons-screenoptions', 26 );
		add_submenu_page( 'genqr', __( 'All QR codes', 'genqr' ), __( 'All QR codes', 'genqr' ), self::CAP, 'genqr', array( __CLASS__, 'page_list' ) );
		add_submenu_page( 'genqr', __( 'Add QR code', 'genqr' ), __( 'Add QR code', 'genqr' ), self::CAP, 'genqr-add', array( __CLASS__, 'page_add' ) );
		add_submenu_page( 'genqr', __( 'Import QR codes', 'genqr' ), __( 'Import', 'genqr' ), self::CAP, 'genqr-import', array( __CLASS__, 'page_import' ) );
		add_submenu_page( 'genqr', __( 'Edit QR code', 'genqr' ), __( 'Edit QR code', 'genqr' ), self::CAP, 'genqr-edit', array( __CLASS__, 'page_edit' ) );
		add_submenu_page( 'genqr', __( 'QR settings', 'genqr' ), __( 'Settings', 'genqr' ), self::CAP, 'genqr-settings', array( __CLASS__, 'page_settings' ) );
		add_action( 'load-' . self::$list_hook, array( __CLASS__, 'handle_bulk' ) );
	}

	/** "Edit QR code" is reached from the list, not the menu. */
	public static function hide_edit_menu() {
		remove_submenu_page( 'genqr', 'genqr-edit' );
	}

	public static function plugin_links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=genqr-settings' ) ) . '">' . esc_html__( 'Settings', 'genqr' ) . '</a>' );
		return $links;
	}

	public static function assets( $hook ) {
		if ( false === strpos( (string) $hook, 'genqr' ) ) {
			return;
		}
		if ( false !== strpos( $hook, 'genqr-settings' ) ) {
			wp_enqueue_media();
			return;
		}
		// Designer, import and export: one script module that mounts on the page's element.
		$bundle = GENQR_DIR . 'assets/build/genqr-admin.js';
		if ( file_exists( $bundle ) ) {
			wp_enqueue_script_module( 'genqr-admin', GENQR_URL . 'assets/build/genqr-admin.js', array(), filemtime( $bundle ) );
		}
	}

	/** Everything the admin app needs; written into the mount element's data-config. */
	public static function client_config() {
		$s = GenQR_Settings::get();
		return array(
			'logos'       => GenQR_Settings::logos(),
			'defaultLogo' => (int) $s['default_logo'],
			'style'       => GenQR_Settings::start_style(),
			'presets'     => array_map(
				static fn( $p ) => array(
					'name'  => $p['name'],
					'style' => GenQR_Settings::sanitize_style( $p['style'] ),
				),
				$s['presets']
			),
			'api'         => esc_url_raw( rest_url( GenQR_Rest::NS . '/' ) ),
			'nonce'       => wp_create_nonce( 'wp_rest' ),
			'shortBase'   => trailingslashit( home_url( '/' . GenQR_Settings::prefix() ) ),
			'editUrl'     => admin_url( 'admin.php?page=genqr-edit&id=' ),
			'listUrl'     => admin_url( 'admin.php?page=genqr' ),
		);
	}

	/** The mount point for one admin app view. */
	private static function mount( $view, array $extra = array() ) {
		$attrs = '';
		foreach ( $extra as $k => $v ) {
			$attrs .= sprintf( ' data-%s="%s"', esc_attr( $k ), esc_attr( is_string( $v ) ? $v : wp_json_encode( $v ) ) );
		}
		printf(
			'<div class="genqr-app" data-view="%s" data-config="%s"%s><p>%s</p></div>',
			esc_attr( $view ),
			esc_attr( wp_json_encode( self::client_config() ) ),
			$attrs, // phpcs:ignore WordPress.Security.EscapeOutput -- escaped above
			file_exists( GENQR_DIR . 'assets/build/genqr-admin.js' )
				? esc_html__( 'Loading…', 'genqr' )
				: esc_html__( 'The GenQR script is missing. Install the plugin from a release zip, or run "npm run build".', 'genqr' )
		);
	}

	public static function action_url( $do, array $ids ) {
		return wp_nonce_url(
			add_query_arg(
				array(
					'action' => 'genqr_link_action',
					'do'     => $do,
					'ids'    => implode( ',', array_map( 'intval', $ids ) ),
				),
				admin_url( 'admin-post.php' )
			),
			'genqr_link_action'
		);
	}

	public static function format_date( $utc ) {
		return get_date_from_gmt( $utc, get_option( 'date_format' ) . ' ' . get_option( 'time_format' ) );
	}

	private static function require_cap() {
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( esc_html__( 'You are not allowed to do this.', 'genqr' ), 403 );
		}
	}

	private static function back( $url, $message ) {
		wp_safe_redirect( add_query_arg( 'genqr_msg', $message, $url ) );
		exit;
	}

	public static function notices() {
		// phpcs:ignore WordPress.Security.NonceVerification -- display only
		$key      = isset( $_GET['genqr_msg'] ) ? sanitize_key( $_GET['genqr_msg'] ) : '';
		$messages = array(
			'enabled'   => array( 'success', __( 'QR codes switched on.', 'genqr' ) ),
			'disabled'  => array( 'success', __( 'QR codes switched off. Scanning them now shows a "link not available" page.', 'genqr' ) ),
			'deleted'   => array( 'success', __( 'QR codes deleted.', 'genqr' ) ),
			'settings'  => array( 'success', __( 'Settings saved.', 'genqr' ) ),
			'badprefix' => array( 'error', __( 'The link prefix must be 1–20 lower-case letters, digits or dashes, and not a WordPress path such as wp-admin.', 'genqr' ) ),
		);
		if ( isset( $messages[ $key ] ) ) {
			printf( '<div class="notice notice-%s is-dismissible"><p>%s</p></div>', esc_attr( $messages[ $key ][0] ), esc_html( $messages[ $key ][1] ) );
		}
		if ( ! get_option( 'permalink_structure' ) && isset( $_GET['page'] ) && 0 === strpos( sanitize_key( $_GET['page'] ), 'genqr' ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			printf(
				'<div class="notice notice-warning"><p>%s <a href="%s">%s</a></p></div>',
				esc_html__( 'Short links need "pretty" permalinks. Choose any setting other than "Plain" in', 'genqr' ),
				esc_url( admin_url( 'options-permalink.php' ) ),
				esc_html__( 'Settings → Permalinks', 'genqr' )
			);
		}
	}

	// --- List ------------------------------------------------------------------------------------------

	/** Bulk actions submitted from the list table (runs before any output). */
	public static function handle_bulk() {
		$table  = new GenQR_Links_Table();
		$action = $table->current_action();
		if ( ! $action || 'export_qr' === $action || empty( $_REQUEST['ids'] ) ) {
			return; // export_qr is handled in the browser
		}
		check_admin_referer( 'bulk-links' );
		self::require_cap();
		$ids = array_map( 'intval', (array) wp_unslash( $_REQUEST['ids'] ) );
		self::apply( $action, $ids );
	}

	/** Row actions (switch on/off, delete). */
	public static function handle_link_action() {
		check_admin_referer( 'genqr_link_action' );
		self::require_cap();
		$do  = isset( $_GET['do'] ) ? sanitize_key( $_GET['do'] ) : '';
		$ids = array_filter( array_map( 'intval', explode( ',', isset( $_GET['ids'] ) ? sanitize_text_field( wp_unslash( $_GET['ids'] ) ) : '' ) ) );
		self::apply( $do, $ids );
	}

	private static function apply( $do, array $ids ) {
		foreach ( $ids as $id ) {
			if ( 'delete' === $do ) {
				GenQR_Links::delete( $id );
			} elseif ( 'enable' === $do || 'disable' === $do ) {
				GenQR_Links::update( $id, array( 'is_active' => 'enable' === $do ? 1 : 0 ) );
			}
		}
		$messages = array( 'delete' => 'deleted', 'enable' => 'enabled', 'disable' => 'disabled' );
		self::back( admin_url( 'admin.php?page=genqr' ), $messages[ $do ] ?? 'enabled' );
	}

	public static function page_list() {
		self::require_cap();
		$table = new GenQR_Links_Table();
		$table->prepare_items();
		?>
		<div class="wrap">
			<h1 class="wp-heading-inline"><?php esc_html_e( 'QR codes', 'genqr' ); ?></h1>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=genqr-add' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Add QR code', 'genqr' ); ?></a>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=genqr-import' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Import', 'genqr' ); ?></a>
			<button type="button" class="page-title-action" id="genqr-export-all"><?php esc_html_e( 'Export all QR codes', 'genqr' ); ?></button>
			<a href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=genqr_export' ), 'genqr_export' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Export list (CSV)', 'genqr' ); ?></a>
			<hr class="wp-header-end">
			<p><?php esc_html_e( 'Every QR code contains one of these short links. Change a destination and printed codes follow it immediately. To export some codes as images or a printable sheet, tick them and choose "Export QR codes" under Bulk actions.', 'genqr' ); ?></p>
			<?php self::mount( 'export' ); ?>
			<?php $table->views(); ?>
			<form method="get" id="genqr-list-form">
				<input type="hidden" name="page" value="genqr">
				<?php
				// phpcs:ignore WordPress.Security.NonceVerification
				if ( ! empty( $_GET['status'] ) ) {
					printf( '<input type="hidden" name="status" value="%s">', esc_attr( sanitize_key( $_GET['status'] ) ) ); // phpcs:ignore WordPress.Security.NonceVerification
				}
				$table->search_box( __( 'Search QR codes', 'genqr' ), 'genqr-search' );
				$table->display();
				?>
			</form>
		</div>
		<?php
	}

	// --- Add / edit / import ---------------------------------------------------------------------------

	public static function page_add() {
		self::require_cap();
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Add QR code', 'genqr' ); ?></h1>
			<?php self::mount( 'designer' ); ?>
		</div>
		<?php
	}

	public static function page_import() {
		self::require_cap();
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Import QR codes', 'genqr' ); ?></h1>
			<?php self::mount( 'import' ); ?>
		</div>
		<?php
	}

	public static function page_edit() {
		self::require_cap();
		$id   = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0; // phpcs:ignore WordPress.Security.NonceVerification
		$link = $id ? GenQR_Links::get( $id ) : null;
		if ( ! $link ) {
			wp_die( esc_html__( 'QR code not found.', 'genqr' ) );
		}
		?>
		<div class="wrap">
			<h1 class="wp-heading-inline"><?php esc_html_e( 'Edit QR code', 'genqr' ); ?></h1>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=genqr-add' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Add QR code', 'genqr' ); ?></a>
			<hr class="wp-header-end">
			<?php self::mount( 'designer', array( 'link' => GenQR_Links::to_api( $link ) ) ); ?>

			<h2><?php esc_html_e( 'Scans', 'genqr' ); ?></h2>
			<p>
				<?php
				echo esc_html(
					sprintf(
						/* translators: 1: number of scans, 2: date */
						_n( '%1$s scan since %2$s.', '%1$s scans since %2$s.', (int) $link->clicks, 'genqr' ),
						number_format_i18n( (int) $link->clicks ),
						self::format_date( $link->created_at )
					)
				);
				if ( $link->last_click_at ) {
					echo ' ' . esc_html( sprintf( /* translators: %s: date */ __( 'Last scan: %s.', 'genqr' ), self::format_date( $link->last_click_at ) ) );
				}
				?>
			</p>

			<h2><?php esc_html_e( 'History', 'genqr' ); ?></h2>
			<?php $history = GenQR_Links::history( $link->id ); ?>
			<table class="widefat striped" style="max-width:1000px">
				<thead><tr><th><?php esc_html_e( 'When', 'genqr' ); ?></th><th><?php esc_html_e( 'Change', 'genqr' ); ?></th><th><?php esc_html_e( 'By', 'genqr' ); ?></th></tr></thead>
				<tbody>
				<?php if ( ! $history ) : ?>
					<tr><td colspan="3"><?php echo esc_html( sprintf( /* translators: %s: date */ __( 'No changes since it was created on %s.', 'genqr' ), self::format_date( $link->created_at ) ) ); ?></td></tr>
				<?php endif; ?>
				<?php foreach ( $history as $h ) : ?>
					<?php $user = $h->changed_by ? get_userdata( (int) $h->changed_by ) : null; ?>
					<tr>
						<td><?php echo esc_html( self::format_date( $h->changed_at ) ); ?></td>
						<td style="word-break:break-all">
							<?php
							if ( 'title' === $h->field ) {
								echo esc_html( sprintf( /* translators: 1: old title 2: new title */ __( 'Title: "%1$s" → "%2$s"', 'genqr' ), $h->old_value, $h->new_value ) );
							} elseif ( 'code' === $h->field ) {
								echo esc_html( sprintf( /* translators: 1: old short link 2: new short link */ __( 'Short link: /%1$s → /%2$s (codes printed with the old link stopped working)', 'genqr' ), $h->old_value, $h->new_value ) );
							} elseif ( 'destination' === $h->field ) {
								echo esc_html( sprintf( /* translators: 1: old URL 2: new URL */ __( 'Destination: %1$s → %2$s', 'genqr' ), $h->old_value, $h->new_value ) );
							} else {
								echo 'on' === $h->new_value ? esc_html__( 'Switched on', 'genqr' ) : esc_html__( 'Switched off', 'genqr' );
							}
							?>
						</td>
						<td><?php echo esc_html( $user ? $user->display_name : '—' ); ?></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		</div>
		<?php
	}

	// --- Settings ---------------------------------------------------------------------------------------

	public static function page_settings() {
		self::require_cap();
		$s       = GenQR_Settings::get();
		$logos   = GenQR_Settings::logos();
		$tabs    = array(
			'general'  => __( 'General', 'genqr' ),
			'logos'    => __( 'Logos', 'genqr' ),
			'presets'  => __( 'Presets', 'genqr' ),
			'links'    => __( 'Short links', 'genqr' ),
		);
		?>
		<div class="wrap genqr-settings">
			<h1 class="wp-heading-inline"><?php esc_html_e( 'QR settings', 'genqr' ); ?></h1>
			<hr class="wp-header-end">

			<nav class="nav-tab-wrapper genqr-tabs" aria-label="<?php esc_attr_e( 'Settings sections', 'genqr' ); ?>">
				<?php foreach ( $tabs as $id => $label ) : ?>
					<a href="#<?php echo esc_attr( $id ); ?>" class="nav-tab" data-tab="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $label ); ?></a>
				<?php endforeach; ?>
			</nav>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="genqr-settings-form">
				<input type="hidden" name="action" value="genqr_save_settings">
				<?php wp_nonce_field( 'genqr_save_settings' ); ?>

				<section class="genqr-panel" data-panel="general">
					<div class="genqr-card">
						<h2><?php esc_html_e( 'Public site', 'genqr' ); ?></h2>
						<p class="description"><?php esc_html_e( 'QR codes are created by administrators here in wp-admin. On the public site, short links redirect to their destinations; every other page of this site can send visitors to your main website.', 'genqr' ); ?></p>
						<div class="genqr-field">
							<label for="genqr-home-redirect"><?php esc_html_e( 'Send other visitors to', 'genqr' ); ?></label>
							<input type="text" inputmode="url" id="genqr-home-redirect" name="home_redirect" class="regular-text" placeholder="https://www.jeddah-cables.com" value="<?php echo esc_attr( $s['home_redirect'] ); ?>">
							<p class="description"><?php esc_html_e( 'Anyone who opens this site\'s address (or any page other than a short link) is redirected here. Leave empty to show the site as WordPress normally does. wp-admin is not affected.', 'genqr' ); ?></p>
						</div>
					</div>
				</section>

				<section class="genqr-panel" data-panel="logos">
					<div class="genqr-card">
						<h2><?php esc_html_e( 'Logos', 'genqr' ); ?></h2>
						<p class="description"><?php esc_html_e( 'Logos you can put in the centre of a QR code. Square images with a transparent background work best.', 'genqr' ); ?></p>
						<input type="hidden" id="genqr-logos" name="logos" value="<?php echo esc_attr( implode( ',', wp_list_pluck( $logos, 'id' ) ) ); ?>">
						<div id="genqr-logo-list" class="genqr-grid genqr-logo-grid">
							<label class="genqr-tile genqr-logo-none">
								<span class="genqr-tile-img"><span class="dashicons dashicons-dismiss"></span></span>
								<span><input type="radio" name="default_logo" value="0" <?php checked( (int) $s['default_logo'], 0 ); ?>> <?php esc_html_e( 'No logo by default', 'genqr' ); ?></span>
							</label>
							<?php foreach ( $logos as $logo ) : ?>
								<label class="genqr-tile genqr-logo" data-id="<?php echo (int) $logo['id']; ?>">
									<span class="genqr-tile-img"><img src="<?php echo esc_url( $logo['url'] ); ?>" alt=""></span>
									<span class="genqr-tile-name"><?php echo esc_html( $logo['name'] ); ?></span>
									<span><input type="radio" name="default_logo" value="<?php echo (int) $logo['id']; ?>" <?php checked( (int) $s['default_logo'], (int) $logo['id'] ); ?>> <?php esc_html_e( 'Default', 'genqr' ); ?></span>
									<button type="button" class="button-link button-link-delete genqr-remove-logo"><?php esc_html_e( 'Remove', 'genqr' ); ?></button>
								</label>
							<?php endforeach; ?>
						</div>
						<p><button type="button" class="button" id="genqr-add-logos"><span class="dashicons dashicons-plus-alt2"></span> <?php esc_html_e( 'Add logos', 'genqr' ); ?></button></p>
					</div>
				</section>

				<section class="genqr-panel" data-panel="presets">
					<div class="genqr-card">
						<h2><?php esc_html_e( 'Presets', 'genqr' ); ?></h2>
						<p class="description"><?php esc_html_e( 'Ready-made designs to pick with one click when adding or importing QR codes. New codes start with the default one; colours and shapes stay editable under "Advanced".', 'genqr' ); ?></p>
						<div id="genqr-preset-rows" class="genqr-grid genqr-preset-grid">
							<?php foreach ( $s['presets'] as $i => $preset ) : ?>
								<?php self::preset_card( (string) $i, $preset, (int) $s['default_preset'] === (int) $i ); ?>
							<?php endforeach; ?>
						</div>
						<template id="genqr-preset-template"><?php self::preset_card( '__i__', array( 'name' => '', 'style' => GenQR_Settings::default_presets()[0]['style'] ), false ); ?></template>
						<p><button type="button" class="button" id="genqr-add-preset"><span class="dashicons dashicons-plus-alt2"></span> <?php esc_html_e( 'Add preset', 'genqr' ); ?></button></p>
					</div>
				</section>

				<section class="genqr-panel" data-panel="links">
					<div class="genqr-card">
						<h2><?php esc_html_e( 'Short link address', 'genqr' ); ?></h2>
						<div class="genqr-field">
							<label for="genqr-prefix"><?php esc_html_e( 'Link prefix', 'genqr' ); ?></label>
							<span class="genqr-prefix"><code><?php echo esc_html( home_url( '/' ) ); ?></code><input type="text" id="genqr-prefix" name="prefix" value="<?php echo esc_attr( $s['prefix'] ); ?>" class="small-text"><code>/abc2345</code></span>
						</div>
						<div class="notice notice-warning inline"><p><?php esc_html_e( 'Printed QR codes contain this prefix. Changing it breaks every QR code already printed.', 'genqr' ); ?></p></div>
						<p class="description">
							<?php
							echo get_option( 'permalink_structure' )
								? esc_html__( 'Permalinks: OK (short links need anything except "Plain").', 'genqr' )
								: esc_html__( 'Permalinks are set to "Plain": short links will not work until you change Settings → Permalinks.', 'genqr' );
							?>
						</p>
					</div>
				</section>

				<div class="genqr-savebar">
					<?php submit_button( __( 'Save settings', 'genqr' ), 'primary', 'submit', false ); ?>
					<span class="description"><?php esc_html_e( 'Saves every tab.', 'genqr' ); ?></span>
				</div>
			</form>
		</div>
		<style>
		.genqr-settings .genqr-tabs{margin-bottom:16px}
		.genqr-settings .genqr-panel{display:none;max-width:1100px}
		.genqr-settings .genqr-panel.active{display:block}
		.genqr-card{background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:16px 20px;margin-bottom:16px;box-shadow:0 1px 1px rgba(0,0,0,.04)}
		.genqr-card h2{margin:0 0 12px;font-size:15px}
		.genqr-card>.description{margin:-4px 0 14px}
		.genqr-field{display:flex;flex-direction:column;gap:6px;margin:0 0 16px}
		.genqr-field:last-child{margin-bottom:0}
		.genqr-field>label:not(.genqr-check){font-weight:600}
		.genqr-field .description{margin:0}
		.genqr-check{font-weight:600}
		.genqr-status.ok{color:#00a32a;font-weight:600;display:flex;align-items:center;gap:6px}
		.genqr-grid{display:grid;gap:12px;margin-bottom:12px}
		.genqr-logo-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
		.genqr-tile{border:1px solid #dcdcde;border-radius:8px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;background:#fff}
		.genqr-tile-img{height:72px;display:grid;place-items:center}
		.genqr-tile-img img{max-width:110px;max-height:72px}
		.genqr-tile-img .dashicons{font-size:40px;width:40px;height:40px;color:#c3c4c7}
		.genqr-tile-name{font-size:12px;color:#646970;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
		.genqr-preset-grid{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
		.genqr-preset{border:1px solid #dcdcde;border-radius:8px;background:#fff;display:flex;flex-direction:column}
		.genqr-preset.is-default{border-color:#2271b1;box-shadow:0 0 0 1px #2271b1}
		.genqr-preset-head{display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #f0f0f1}
		.genqr-swatch{width:36px;height:36px;border-radius:50%;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
		.genqr-preset-head input[type=text]{flex:1;min-width:0;font-weight:600}
		.genqr-preset-body{padding:12px;display:grid;grid-template-columns:110px 1fr;gap:8px 10px;align-items:center}
		.genqr-preset-body>span{color:#50575e}
		.genqr-preset-body .genqr-inline{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
		.genqr-preset-body select{min-width:0;max-width:100%}
		.genqr-preset-body input[type=number]{width:64px}
		.genqr-preset-foot{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-top:1px solid #f0f0f1;background:#f6f7f7;border-radius:0 0 8px 8px}
		.genqr-prefix{display:flex;align-items:center;gap:2px;flex-wrap:wrap}
		.genqr-prefix input{width:90px}
		.genqr-savebar{position:sticky;bottom:0;z-index:5;background:#f0f0f1;border-top:1px solid #dcdcde;padding:12px 0;display:flex;align-items:center;gap:12px;max-width:1100px}
		#genqr-add-logos .dashicons,#genqr-add-preset .dashicons{vertical-align:middle;margin-top:-2px}
		</style>
		<script>
		( function () {
			// Tabs: one form, panels shown one at a time; the open tab survives saving.
			const tabs = document.querySelectorAll( '.genqr-tabs .nav-tab' );
			const show = ( id ) => {
				if ( ! document.querySelector( '[data-panel="' + id + '"]' ) ) id = 'general';
				tabs.forEach( ( t ) => t.classList.toggle( 'nav-tab-active', t.dataset.tab === id ) );
				document.querySelectorAll( '.genqr-panel' ).forEach( ( p ) => p.classList.toggle( 'active', p.dataset.panel === id ) );
				try { sessionStorage.setItem( 'genqr-tab', id ); } catch ( e ) {}
			};
			tabs.forEach( ( t ) => t.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				history.replaceState( null, '', '#' + t.dataset.tab );
				show( t.dataset.tab );
			} ) );
			let start = location.hash.slice( 1 );
			try { start = start || sessionStorage.getItem( 'genqr-tab' ) || ''; } catch ( e ) {}
			show( start );

			// Logos.
			const input = document.getElementById( 'genqr-logos' );
			const list = document.getElementById( 'genqr-logo-list' );
			const ids = () => input.value.split( ',' ).filter( Boolean );
			list.addEventListener( 'click', ( e ) => {
				if ( ! e.target.classList.contains( 'genqr-remove-logo' ) ) return;
				e.preventDefault();
				const box = e.target.closest( '.genqr-logo' );
				const wasDefault = box.querySelector( 'input[type=radio]' ).checked;
				input.value = ids().filter( ( id ) => id !== box.dataset.id ).join( ',' );
				box.remove();
				if ( wasDefault ) list.querySelector( 'input[value="0"]' ).checked = true;
			} );
			let frame;
			document.getElementById( 'genqr-add-logos' ).addEventListener( 'click', () => {
				frame = frame || wp.media( { title: <?php echo wp_json_encode( __( 'Choose logos', 'genqr' ) ); ?>, library: { type: 'image' }, multiple: true, button: { text: <?php echo wp_json_encode( __( 'Use these logos', 'genqr' ) ); ?> } } );
				frame.off( 'select' ).on( 'select', () => {
					const current = ids();
					frame.state().get( 'selection' ).toJSON().forEach( ( a ) => {
						if ( current.includes( String( a.id ) ) ) return;
						current.push( String( a.id ) );
						const box = document.createElement( 'label' );
						box.className = 'genqr-tile genqr-logo';
						box.dataset.id = a.id;
						box.innerHTML = '<span class="genqr-tile-img"><img alt=""></span><span class="genqr-tile-name"></span><span><input type="radio" name="default_logo"> <?php echo esc_js( __( 'Default', 'genqr' ) ); ?></span><button type="button" class="button-link button-link-delete genqr-remove-logo"><?php echo esc_js( __( 'Remove', 'genqr' ) ); ?></button>';
						box.querySelector( 'img' ).src = ( a.sizes && a.sizes.medium ? a.sizes.medium.url : a.url );
						box.querySelector( '.genqr-tile-name' ).textContent = a.title || '';
						box.querySelector( 'input' ).value = a.id;
						list.appendChild( box );
					} );
					input.value = current.join( ',' );
				} );
				frame.open();
			} );

			// Presets: live swatch, gradient fields only when a gradient is chosen, add/remove.
			const rows = document.getElementById( 'genqr-preset-rows' );
			let next = rows.children.length;
			const field = ( card, name ) => card.querySelector( '[name$="' + name + '"]' );
			const paint = ( card ) => {
				const fg = field( card, '[style][foreground]' ).value;
				const type = field( card, '[gradient][type]' ).value;
				const to = field( card, '[gradient][color]' ).value;
				const angle = field( card, '[gradient][rotation]' ).value;
				card.querySelector( '.genqr-swatch' ).style.background = ! type ? fg : type === 'linear' ? 'linear-gradient(' + angle + 'deg,' + fg + ',' + to + ')' : 'radial-gradient(' + fg + ',' + to + ')';
				card.querySelectorAll( '.genqr-if-gradient' ).forEach( ( el ) => ( el.hidden = ! type ) );
				card.querySelectorAll( '.genqr-if-linear' ).forEach( ( el ) => ( el.hidden = type !== 'linear' ) );
				field( card, '[style][eyeColor]' ).hidden = ! field( card, '[eye_on]' ).checked;
			};
			const markDefault = () => rows.querySelectorAll( '.genqr-preset' ).forEach( ( c ) => c.classList.toggle( 'is-default', c.querySelector( 'input[name="default_preset"]' ).checked ) );
			[ ...rows.children ].forEach( paint );
			markDefault();
			rows.addEventListener( 'input', ( e ) => paint( e.target.closest( '.genqr-preset' ) ) );
			rows.addEventListener( 'change', ( e ) => {
				paint( e.target.closest( '.genqr-preset' ) );
				markDefault();
			} );
			rows.addEventListener( 'click', ( e ) => {
				if ( ! e.target.classList.contains( 'genqr-remove-preset' ) ) return;
				e.target.closest( '.genqr-preset' ).remove();
				if ( ! rows.querySelector( 'input[name="default_preset"]:checked' ) && rows.firstElementChild ) rows.firstElementChild.querySelector( 'input[name="default_preset"]' ).checked = true;
				markDefault();
			} );
			document.getElementById( 'genqr-add-preset' ).addEventListener( 'click', () => {
				const html = document.getElementById( 'genqr-preset-template' ).innerHTML.replaceAll( '__i__', 'n' + ( next++ ) );
				rows.insertAdjacentHTML( 'beforeend', html );
				paint( rows.lastElementChild );
				rows.lastElementChild.querySelector( 'input[type=text]' ).focus();
			} );
		} )();
		</script>
		<?php
	}

	/** One editable preset card; $key is the form index ('__i__' in the template). */
	private static function preset_card( $key, array $preset, $is_default ) {
		$st     = GenQR_Settings::sanitize_style( $preset['style'] ?? array() );
		$n      = 'presets[' . $key . ']';
		$g      = $st['gradient'];
		$shapes = array(
			'moduleShape'   => array( __( 'Pattern', 'genqr' ), array( 'square' => __( 'Square', 'genqr' ), 'rounded' => __( 'Rounded', 'genqr' ), 'dots' => __( 'Dots', 'genqr' ) ) ),
			'eyeFrameShape' => array( __( 'Corner frame', 'genqr' ), array( 'square' => __( 'Square', 'genqr' ), 'rounded' => __( 'Rounded', 'genqr' ), 'circle' => __( 'Circle', 'genqr' ) ) ),
			'eyeBallShape'  => array( __( 'Corner centre', 'genqr' ), array( 'square' => __( 'Square', 'genqr' ), 'rounded' => __( 'Rounded', 'genqr' ), 'circle' => __( 'Circle', 'genqr' ) ) ),
		);
		?>
		<div class="genqr-preset">
			<div class="genqr-preset-head">
				<span class="genqr-swatch"></span>
				<input type="text" name="<?php echo esc_attr( $n ); ?>[name]" value="<?php echo esc_attr( $preset['name'] ); ?>" maxlength="40" placeholder="<?php esc_attr_e( 'Preset name', 'genqr' ); ?>" aria-label="<?php esc_attr_e( 'Preset name', 'genqr' ); ?>">
			</div>
			<div class="genqr-preset-body">
				<span><?php esc_html_e( 'Code colour', 'genqr' ); ?></span>
				<input type="color" name="<?php echo esc_attr( $n ); ?>[style][foreground]" value="<?php echo esc_attr( $st['foreground'] ); ?>">
				<span><?php esc_html_e( 'Background', 'genqr' ); ?></span>
				<input type="color" name="<?php echo esc_attr( $n ); ?>[style][background]" value="<?php echo esc_attr( $st['background'] ); ?>">
				<span><?php esc_html_e( 'Gradient', 'genqr' ); ?></span>
				<span class="genqr-inline">
					<select name="<?php echo esc_attr( $n ); ?>[style][gradient][type]">
						<option value="" <?php selected( ! $g ); ?>><?php esc_html_e( 'None', 'genqr' ); ?></option>
						<option value="linear" <?php selected( $g['type'] ?? '', 'linear' ); ?>><?php esc_html_e( 'Linear', 'genqr' ); ?></option>
						<option value="radial" <?php selected( $g['type'] ?? '', 'radial' ); ?>><?php esc_html_e( 'Radial', 'genqr' ); ?></option>
					</select>
					<span class="genqr-if-gradient"><?php esc_html_e( 'to', 'genqr' ); ?> <input type="color" name="<?php echo esc_attr( $n ); ?>[style][gradient][color]" value="<?php echo esc_attr( $g['color'] ?? '#2563eb' ); ?>"></span>
					<span class="genqr-if-linear"><input type="number" name="<?php echo esc_attr( $n ); ?>[style][gradient][rotation]" min="0" max="360" step="15" value="<?php echo (int) ( $g['rotation'] ?? 45 ); ?>" aria-label="<?php esc_attr_e( 'Angle', 'genqr' ); ?>">°</span>
				</span>
				<span><?php esc_html_e( 'Corners', 'genqr' ); ?></span>
				<span class="genqr-inline">
					<label><input type="checkbox" name="<?php echo esc_attr( $n ); ?>[eye_on]" value="1" <?php checked( null !== $st['eyeColor'] ); ?>> <?php esc_html_e( 'Own colour', 'genqr' ); ?></label>
					<input type="color" name="<?php echo esc_attr( $n ); ?>[style][eyeColor]" value="<?php echo esc_attr( $st['eyeColor'] ?? $st['foreground'] ); ?>" aria-label="<?php esc_attr_e( 'Corner colour', 'genqr' ); ?>">
				</span>
				<?php foreach ( $shapes as $k => list( $label, $options ) ) : ?>
					<span><?php echo esc_html( $label ); ?></span>
					<select name="<?php echo esc_attr( $n ); ?>[style][<?php echo esc_attr( $k ); ?>]">
						<?php foreach ( $options as $value => $name ) : ?>
							<option value="<?php echo esc_attr( $value ); ?>" <?php selected( $st[ $k ], $value ); ?>><?php echo esc_html( $name ); ?></option>
						<?php endforeach; ?>
					</select>
				<?php endforeach; ?>
			</div>
			<div class="genqr-preset-foot">
				<label><input type="radio" name="default_preset" value="<?php echo esc_attr( $key ); ?>" <?php checked( $is_default ); ?>> <?php esc_html_e( 'Default', 'genqr' ); ?></label>
				<button type="button" class="button-link button-link-delete genqr-remove-preset"><?php esc_html_e( 'Remove', 'genqr' ); ?></button>
			</div>
		</div>
		<?php
	}

	public static function handle_save_settings() {
		check_admin_referer( 'genqr_save_settings' );
		self::require_cap();
		// phpcs:disable WordPress.Security.ValidatedSanitizedInput -- each value is sanitised below
		$old    = GenQR_Settings::get();
		$prefix = GenQR_Settings::sanitize_prefix( isset( $_POST['prefix'] ) ? wp_unslash( $_POST['prefix'] ) : '' );
		$return = admin_url( 'admin.php?page=genqr-settings' );
		if ( null === $prefix ) {
			self::back( $return, 'badprefix' );
		}
		$logos = array_values( array_filter( array_map( 'intval', explode( ',', isset( $_POST['logos'] ) ? sanitize_text_field( wp_unslash( $_POST['logos'] ) ) : '' ) ), 'wp_attachment_is_image' ) );
		$default_logo = isset( $_POST['default_logo'] ) ? (int) $_POST['default_logo'] : 0;
		$values = array(
			'home_redirect' => GenQR_Settings::sanitize_home_redirect( wp_unslash( $_POST['home_redirect'] ?? '' ) ),
			'logos'         => $logos,
			'default_logo'  => in_array( $default_logo, $logos, true ) ? $default_logo : 0,
			'prefix'        => $prefix,
		);
		// Presets: keep the posted order; unnamed rows are dropped, so map the default to its new index.
		$posted      = is_array( $_POST['presets'] ?? null ) ? wp_unslash( $_POST['presets'] ) : array();
		$default_key = isset( $_POST['default_preset'] ) ? sanitize_key( wp_unslash( $_POST['default_preset'] ) ) : '';
		$rows        = array();
		$default     = 0;
		foreach ( $posted as $key => $row ) {
			if ( ! is_array( $row ) || '' === trim( (string) ( $row['name'] ?? '' ) ) ) {
				continue;
			}
			if ( empty( $row['eye_on'] ) ) {
				unset( $row['style']['eyeColor'] );
			}
			if ( (string) $key === $default_key ) {
				$default = count( $rows );
			}
			$rows[] = $row;
		}
		$values['presets']        = GenQR_Settings::sanitize_presets( $rows );
		$values['default_preset'] = $default;
		// phpcs:enable
		GenQR_Settings::update( $values );
		if ( $prefix !== $old['prefix'] ) {
			// Rules are registered on init with the prefix of that request; flush on the next one.
			update_option( 'genqr_flush_rewrite', 1 );
		}
		self::back( $return, 'settings' );
	}

	// --- Export -------------------------------------------------------------------------------------------

	public static function handle_export() {
		check_admin_referer( 'genqr_export' );
		self::require_cap();
		$rows = GenQR_Links::query( array( 'per_page' => 100000 ) )['items'];
		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename=qr-links-' . gmdate( 'Y-m-d' ) . '.csv' );
		$out = fopen( 'php://output', 'w' );
		fwrite( $out, "\xEF\xBB\xBF" ); // BOM so Excel reads UTF-8
		fputcsv( $out, array( 'title', 'short_link_text', 'short_url', 'destination', 'status', 'clicks', 'last_click_utc', 'created_utc' ) );
		// Spreadsheets would run cells starting with = + - @ as formulas.
		$cell = static fn( $v ) => preg_match( '/^[=+\-@\t\r]/', (string) $v ) ? "'" . $v : (string) $v;
		foreach ( $rows as $r ) {
			fputcsv(
				$out,
				array_map(
					$cell,
					array( $r->title, $r->code, GenQR_Settings::short_url( $r->code ), $r->destination, $r->is_active ? 'on' : 'off', $r->clicks, $r->last_click_at, $r->created_at )
				)
			);
		}
		fclose( $out );
		exit;
	}
}
