<?php
/**
 * wp-admin screens: QR Links (list, add/edit with history), Settings, CSV export.
 * Everything requires the manage_options capability and a nonce for changes.
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
		add_action( 'admin_post_genqr_save_link', array( __CLASS__, 'handle_save_link' ) );
		add_action( 'admin_post_genqr_save_settings', array( __CLASS__, 'handle_save_settings' ) );
		add_action( 'admin_post_genqr_homepage', array( __CLASS__, 'handle_homepage' ) );
		add_action( 'admin_post_genqr_export', array( __CLASS__, 'handle_export' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( GENQR_FILE ), array( __CLASS__, 'plugin_links' ) );
	}

	// --- Menus and helpers ----------------------------------------------------------------------

	public static function menu() {
		self::$list_hook = add_menu_page( __( 'QR Links', 'genqr' ), __( 'QR Links', 'genqr' ), self::CAP, 'genqr', array( __CLASS__, 'page_list' ), 'dashicons-screenoptions', 26 );
		add_submenu_page( 'genqr', __( 'All links', 'genqr' ), __( 'All links', 'genqr' ), self::CAP, 'genqr', array( __CLASS__, 'page_list' ) );
		add_submenu_page( 'genqr', __( 'Add link', 'genqr' ), __( 'Add link', 'genqr' ), self::CAP, 'genqr-add', array( __CLASS__, 'page_edit' ) );
		add_submenu_page( 'genqr', __( 'Edit link', 'genqr' ), __( 'Edit link', 'genqr' ), self::CAP, 'genqr-edit', array( __CLASS__, 'page_edit' ) );
		add_submenu_page( 'genqr', __( 'QR settings', 'genqr' ), __( 'Settings', 'genqr' ), self::CAP, 'genqr-settings', array( __CLASS__, 'page_settings' ) );
		add_action( 'load-' . self::$list_hook, array( __CLASS__, 'handle_bulk' ) );
	}

	/** "Edit link" is reached from the list, not the menu. */
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
		}
		// The QR preview on the edit screen uses the same browser engine as the public generator.
		$bundle = GENQR_DIR . 'assets/build/genqr-admin.js';
		if ( file_exists( $bundle ) && false !== strpos( $hook, 'genqr-edit' ) ) {
			wp_enqueue_script_module( 'genqr-admin', GENQR_URL . 'assets/build/genqr-admin.js', array(), filemtime( $bundle ) );
		}
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
			'saved'      => array( 'success', __( 'Link saved.', 'genqr' ) ),
			'created'    => array( 'success', __( 'Link created.', 'genqr' ) ),
			'enabled'    => array( 'success', __( 'Links switched on.', 'genqr' ) ),
			'disabled'   => array( 'success', __( 'Links switched off. Their QR codes now show a "link not available" page.', 'genqr' ) ),
			'deleted'    => array( 'success', __( 'Links deleted.', 'genqr' ) ),
			'settings'   => array( 'success', __( 'Settings saved.', 'genqr' ) ),
			'homepage'   => array( 'success', __( 'The QR generator page is now the site\'s homepage.', 'genqr' ) ),
			'badprefix'  => array( 'error', __( 'The link prefix must be 1–20 lower-case letters, digits or dashes, and not a WordPress path such as wp-admin.', 'genqr' ) ),
			'nodomains'  => array( 'warning', __( 'No approved domains: visitors cannot create QR codes until you add at least one.', 'genqr' ) ),
		);
		if ( isset( $messages[ $key ] ) ) {
			printf( '<div class="notice notice-%s is-dismissible"><p>%s</p></div>', esc_attr( $messages[ $key ][0] ), esc_html( $messages[ $key ][1] ) );
		} elseif ( 0 === strpos( $key, 'error-' ) ) {
			// Validation errors are passed as a transient keyed by user.
			$error = get_transient( 'genqr_error_' . get_current_user_id() );
			if ( $error ) {
				delete_transient( 'genqr_error_' . get_current_user_id() );
				printf( '<div class="notice notice-error is-dismissible"><p>%s</p></div>', esc_html( $error ) );
			}
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
		if ( ! $action || empty( $_REQUEST['ids'] ) ) {
			return;
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
		self::back( admin_url( 'admin.php?page=genqr' ), $messages[ $do ] ?? 'saved' );
	}

	public static function page_list() {
		self::require_cap();
		$table = new GenQR_Links_Table();
		$table->prepare_items();
		?>
		<div class="wrap">
			<h1 class="wp-heading-inline"><?php esc_html_e( 'QR Links', 'genqr' ); ?></h1>
			<a href="<?php echo esc_url( admin_url( 'admin.php?page=genqr-add' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Add link', 'genqr' ); ?></a>
			<a href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=genqr_export' ), 'genqr_export' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Export CSV', 'genqr' ); ?></a>
			<hr class="wp-header-end">
			<p><?php esc_html_e( 'Every QR code points to one of these short links. Change a destination here and printed codes follow it immediately.', 'genqr' ); ?></p>
			<?php $table->views(); ?>
			<form method="get">
				<input type="hidden" name="page" value="genqr">
				<?php
				// phpcs:ignore WordPress.Security.NonceVerification
				if ( ! empty( $_GET['status'] ) ) {
					printf( '<input type="hidden" name="status" value="%s">', esc_attr( sanitize_key( $_GET['status'] ) ) ); // phpcs:ignore WordPress.Security.NonceVerification
				}
				$table->search_box( __( 'Search links', 'genqr' ), 'genqr-search' );
				$table->display();
				?>
			</form>
		</div>
		<?php
	}

	// --- Add / edit --------------------------------------------------------------------------------------

	public static function page_edit() {
		self::require_cap();
		$id   = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0; // phpcs:ignore WordPress.Security.NonceVerification
		$link = $id ? GenQR_Links::get( $id ) : null;
		if ( $id && ! $link ) {
			wp_die( esc_html__( 'Link not found.', 'genqr' ) );
		}
		?>
		<div class="wrap">
			<h1><?php echo $link ? esc_html__( 'Edit link', 'genqr' ) : esc_html__( 'Add link', 'genqr' ); ?></h1>
			<div style="display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="flex:1;min-width:320px;max-width:720px">
					<input type="hidden" name="action" value="genqr_save_link">
					<input type="hidden" name="id" value="<?php echo (int) $id; ?>">
					<?php wp_nonce_field( 'genqr_save_link' ); ?>
					<table class="form-table" role="presentation">
						<?php if ( $link ) : ?>
						<tr>
							<th scope="row"><?php esc_html_e( 'Short link', 'genqr' ); ?></th>
							<td><code id="genqr-short-url"><?php echo esc_html( GenQR_Settings::short_url( $link->code ) ); ?></code>
								<p class="description"><?php esc_html_e( 'This is what printed QR codes contain. It never changes.', 'genqr' ); ?></p></td>
						</tr>
						<?php endif; ?>
						<tr>
							<th scope="row"><label for="genqr-link-title"><?php esc_html_e( 'Title', 'genqr' ); ?></label></th>
							<td><input type="text" id="genqr-link-title" name="link_title" class="regular-text" maxlength="120" value="<?php echo esc_attr( $link ? $link->title : '' ); ?>">
								<p class="description"><?php esc_html_e( 'Optional. Shown on the public "All QR codes" page.', 'genqr' ); ?></p></td>
						</tr>
						<tr>
							<th scope="row"><label for="genqr-destination"><?php esc_html_e( 'Destination', 'genqr' ); ?></label></th>
							<td><input type="url" id="genqr-destination" name="destination" class="large-text" required value="<?php echo esc_attr( $link ? $link->destination : '' ); ?>" placeholder="https://www.example.com/page">
								<p class="description"><?php esc_html_e( 'Any web address. (Visitors can only use the approved domains; administrators can use any.)', 'genqr' ); ?></p></td>
						</tr>
						<?php if ( $link ) : ?>
						<tr>
							<th scope="row"><?php esc_html_e( 'Status', 'genqr' ); ?></th>
							<td><label><input type="checkbox" name="is_active" value="1" <?php checked( (int) $link->is_active, 1 ); ?>> <?php esc_html_e( 'Link is on', 'genqr' ); ?></label>
								<p class="description"><?php esc_html_e( 'When off, scanning shows a "link not available" page.', 'genqr' ); ?></p></td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Clicks', 'genqr' ); ?></th>
							<td><?php echo esc_html( number_format_i18n( (int) $link->clicks ) ); ?><?php echo $link->last_click_at ? ' · ' . esc_html( sprintf( /* translators: %s: date */ __( 'last on %s', 'genqr' ), self::format_date( $link->last_click_at ) ) ) : ''; ?></td>
						</tr>
						<?php endif; ?>
					</table>
					<?php submit_button( $link ? __( 'Save changes', 'genqr' ) : __( 'Create link', 'genqr' ) ); ?>
				</form>
				<?php if ( $link ) : ?>
				<div style="width:260px">
					<div id="genqr-admin-preview" data-short-url="<?php echo esc_attr( GenQR_Settings::short_url( $link->code ) ); ?>" data-title="<?php echo esc_attr( $link->title ? $link->title : 'qr-' . $link->code ); ?>" data-config="<?php echo esc_attr( wp_json_encode( GenQR_Shortcode::client_config() ) ); ?>" style="background:#fff;border:1px solid #dcdcde;border-radius:4px;padding:12px;text-align:center"></div>
				</div>
				<?php endif; ?>
			</div>

			<?php if ( $link ) : ?>
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
			<?php endif; ?>
		</div>
		<?php
	}

	public static function handle_save_link() {
		check_admin_referer( 'genqr_save_link' );
		self::require_cap();
		$id          = isset( $_POST['id'] ) ? (int) $_POST['id'] : 0;
		$destination = GenQR_Links::validate_destination( isset( $_POST['destination'] ) ? sanitize_text_field( wp_unslash( $_POST['destination'] ) ) : '', false );
		$return      = $id ? admin_url( 'admin.php?page=genqr-edit&id=' . $id ) : admin_url( 'admin.php?page=genqr-add' );
		if ( is_wp_error( $destination ) ) {
			set_transient( 'genqr_error_' . get_current_user_id(), $destination->get_error_message(), 60 );
			self::back( $return, 'error-destination' );
		}
		if ( $id ) {
			$result = GenQR_Links::update(
				$id,
				array(
					'title'       => isset( $_POST['link_title'] ) ? wp_unslash( $_POST['link_title'] ) : '', // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- clean_title()
					'destination' => $destination,
					'is_active'   => empty( $_POST['is_active'] ) ? 0 : 1,
				)
			);
			self::back( $return, is_wp_error( $result ) ? 'error-save' : 'saved' );
		}
		$link = GenQR_Links::create( $destination, get_current_user_id(), null, isset( $_POST['link_title'] ) ? wp_unslash( $_POST['link_title'] ) : '' ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- clean_title()
		if ( is_wp_error( $link ) ) {
			set_transient( 'genqr_error_' . get_current_user_id(), $link->get_error_message(), 60 );
			self::back( $return, 'error-create' );
		}
		self::back( admin_url( 'admin.php?page=genqr-edit&id=' . (int) $link->id ), 'created' );
	}

	// --- Settings ---------------------------------------------------------------------------------------

	public static function page_settings() {
		self::require_cap();
		$s       = GenQR_Settings::get();
		$logos   = GenQR_Settings::logos();
		$home    = (int) get_option( 'page_on_front' );
		$is_home = $s['homepage_id'] && $home === (int) $s['homepage_id'] && 'page' === get_option( 'show_on_front' );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'QR settings', 'genqr' ); ?></h1>

			<h2><?php esc_html_e( 'Generator page', 'genqr' ); ?></h2>
			<p>
				<?php esc_html_e( 'Add the shortcode [genqr] to any page, or let the plugin create the page and make it the homepage.', 'genqr' ); ?>
				<?php if ( $s['homepage_id'] && get_post( (int) $s['homepage_id'] ) ) : ?>
					<a href="<?php echo esc_url( get_permalink( (int) $s['homepage_id'] ) ); ?>" target="_blank"><?php esc_html_e( 'View the generator page', 'genqr' ); ?></a>
				<?php endif; ?>
			</p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="genqr_homepage">
				<?php wp_nonce_field( 'genqr_homepage' ); ?>
				<?php if ( $is_home ) : ?>
					<p><strong><?php esc_html_e( 'The generator is the site\'s homepage.', 'genqr' ); ?></strong></p>
				<?php else : ?>
					<?php submit_button( __( 'Use the QR generator as the homepage', 'genqr' ), 'secondary', 'submit', false ); ?>
				<?php endif; ?>
			</form>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="genqr_save_settings">
				<?php wp_nonce_field( 'genqr_save_settings' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="genqr-brand"><?php esc_html_e( 'Name in the top bar', 'genqr' ); ?></label></th>
						<td><input type="text" id="genqr-brand" name="brand" class="regular-text" value="<?php echo esc_attr( $s['brand'] ); ?>">
							<p class="description"><?php esc_html_e( 'Shown in the top bar of the generator page and in the browser tab.', 'genqr' ); ?></p></td>
					</tr>
					<tr>
						<th scope="row"><label for="genqr-title"><?php esc_html_e( 'Title', 'genqr' ); ?></label></th>
						<td><input type="text" id="genqr-title" name="title" class="regular-text" value="<?php echo esc_attr( $s['title'] ); ?>">
							<p class="description"><?php esc_html_e( 'Shown above the generator.', 'genqr' ); ?></p></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Pages', 'genqr' ); ?></th>
						<td>
							<p><label><input type="checkbox" name="full_page" value="1" <?php checked( $s['full_page'] ); ?>> <?php esc_html_e( 'Clean layout for the generator page: the top bar only, without the theme\'s header, menu and footer', 'genqr' ); ?></label></p>
							<p><label><input type="checkbox" name="public_list" value="1" <?php checked( $s['public_list'] ); ?>> <?php esc_html_e( 'Show an "All QR codes" page that lists every active QR code, its title, destination and short link, to everyone', 'genqr' ); ?></label></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="genqr-domains"><?php esc_html_e( 'Approved domains', 'genqr' ); ?></label></th>
						<td><textarea id="genqr-domains" name="domains" rows="4" class="large-text code" placeholder="jeddah-cables.com"><?php echo esc_textarea( implode( "\n", $s['domains'] ) ); ?></textarea>
							<p class="description"><?php esc_html_e( 'One per line. Visitors can only make QR codes for these websites (subdomains included). You can change this any time.', 'genqr' ); ?></p></td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Logos', 'genqr' ); ?></th>
						<td>
							<input type="hidden" id="genqr-logos" name="logos" value="<?php echo esc_attr( implode( ',', wp_list_pluck( $logos, 'id' ) ) ); ?>">
							<div id="genqr-logo-list" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
								<?php foreach ( $logos as $logo ) : ?>
								<label class="genqr-logo" data-id="<?php echo (int) $logo['id']; ?>" style="border:1px solid #dcdcde;border-radius:4px;padding:8px;text-align:center;width:110px;background:#fff">
									<img src="<?php echo esc_url( $logo['url'] ); ?>" alt="" style="max-width:90px;max-height:60px;display:block;margin:0 auto 6px">
									<input type="radio" name="default_logo" value="<?php echo (int) $logo['id']; ?>" <?php checked( (int) $s['default_logo'], (int) $logo['id'] ); ?>> <?php esc_html_e( 'Default', 'genqr' ); ?>
									<br><a href="#" class="genqr-remove-logo"><?php esc_html_e( 'Remove', 'genqr' ); ?></a>
								</label>
								<?php endforeach; ?>
							</div>
							<label><input type="radio" name="default_logo" value="0" <?php checked( (int) $s['default_logo'], 0 ); ?>> <?php esc_html_e( 'No logo by default', 'genqr' ); ?></label>
							<p><button type="button" class="button" id="genqr-add-logos"><?php esc_html_e( 'Add logos', 'genqr' ); ?></button></p>
							<p class="description"><?php esc_html_e( 'Visitors can choose one of these logos (or none). Square images with a transparent background work best.', 'genqr' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Presets', 'genqr' ); ?></th>
						<td>
							<p class="description" style="margin-bottom:8px"><?php esc_html_e( 'Ready-made designs visitors pick with one click. The default one is what the generator starts with. Colours, gradient and shapes stay editable under "Advanced" in the generator.', 'genqr' ); ?></p>
							<table class="widefat striped genqr-presets" style="max-width:1100px">
								<thead><tr>
									<th style="width:70px"><?php esc_html_e( 'Default', 'genqr' ); ?></th>
									<th><?php esc_html_e( 'Name', 'genqr' ); ?></th>
									<th><?php esc_html_e( 'Colours', 'genqr' ); ?></th>
									<th><?php esc_html_e( 'Shapes', 'genqr' ); ?></th>
									<th></th>
								</tr></thead>
								<tbody id="genqr-preset-rows">
									<?php foreach ( $s['presets'] as $i => $preset ) : ?>
										<?php self::preset_row( (string) $i, $preset, (int) $s['default_preset'] === (int) $i ); ?>
									<?php endforeach; ?>
								</tbody>
							</table>
							<template id="genqr-preset-template"><?php self::preset_row( '__i__', array( 'name' => '', 'style' => GenQR_Settings::default_presets()[4]['style'] ), false ); ?></template>
							<p><button type="button" class="button" id="genqr-add-preset"><?php esc_html_e( 'Add preset', 'genqr' ); ?></button></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="genqr-prefix"><?php esc_html_e( 'Link prefix', 'genqr' ); ?></label></th>
						<td><code><?php echo esc_html( home_url( '/' ) ); ?></code><input type="text" id="genqr-prefix" name="prefix" value="<?php echo esc_attr( $s['prefix'] ); ?>" style="width:120px"><code>/abc2345</code>
							<p class="description"><strong><?php esc_html_e( 'Printed QR codes contain this prefix. Changing it breaks every code already printed.', 'genqr' ); ?></strong></p></td>
					</tr>
					<tr>
						<th scope="row"><label for="genqr-rate"><?php esc_html_e( 'Limit per visitor', 'genqr' ); ?></label></th>
						<td><input type="number" id="genqr-rate" name="rate_limit" min="1" max="1000" value="<?php echo (int) $s['rate_limit']; ?>" style="width:90px"> <?php esc_html_e( 'new QR codes per hour', 'genqr' ); ?></td>
					</tr>
				</table>
				<?php submit_button( __( 'Save settings', 'genqr' ) ); ?>
			</form>
		</div>
		<script>
		( function () {
			const input = document.getElementById( 'genqr-logos' );
			const list = document.getElementById( 'genqr-logo-list' );
			const ids = () => input.value.split( ',' ).filter( Boolean );
			list.addEventListener( 'click', ( e ) => {
				if ( ! e.target.classList.contains( 'genqr-remove-logo' ) ) return;
				e.preventDefault();
				const box = e.target.closest( '.genqr-logo' );
				input.value = ids().filter( ( id ) => id !== box.dataset.id ).join( ',' );
				box.remove();
			} );
			const rows = document.getElementById( 'genqr-preset-rows' );
			let next = rows.children.length;
			const paint = ( tr ) => {
				const v = ( name ) => tr.querySelector( '[name$="' + name + '"]' );
				const fg = v( '[style][foreground]' ).value;
				const type = v( '[gradient][type]' ).value;
				const to = v( '[gradient][color]' ).value;
				tr.querySelector( '.genqr-swatch' ).style.background = ! type ? fg : type === 'linear' ? 'linear-gradient(' + v( '[gradient][rotation]' ).value + 'deg,' + fg + ',' + to + ')' : 'radial-gradient(' + fg + ',' + to + ')';
			};
			[ ...rows.children ].forEach( paint );
			rows.addEventListener( 'input', ( e ) => paint( e.target.closest( 'tr' ) ) );
			rows.addEventListener( 'click', ( e ) => {
				if ( ! e.target.classList.contains( 'genqr-remove-preset' ) ) return;
				e.target.closest( 'tr' ).remove();
				if ( ! rows.querySelector( 'input[name="default_preset"]:checked' ) && rows.firstElementChild ) rows.firstElementChild.querySelector( 'input[name="default_preset"]' ).checked = true;
			} );
			document.getElementById( 'genqr-add-preset' ).addEventListener( 'click', () => {
				const html = document.getElementById( 'genqr-preset-template' ).innerHTML.replaceAll( '__i__', 'n' + ( next++ ) );
				rows.insertAdjacentHTML( 'beforeend', html );
				paint( rows.lastElementChild );
				rows.lastElementChild.querySelector( 'input[type=text]' ).focus();
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
						box.className = 'genqr-logo';
						box.dataset.id = a.id;
						box.style.cssText = 'border:1px solid #dcdcde;border-radius:4px;padding:8px;text-align:center;width:110px;background:#fff';
						const src = ( a.sizes && a.sizes.medium ? a.sizes.medium.url : a.url );
						box.innerHTML = '<img alt="" style="max-width:90px;max-height:60px;display:block;margin:0 auto 6px"><input type="radio" name="default_logo"> <?php echo esc_js( __( 'Default', 'genqr' ) ); ?><br><a href="#" class="genqr-remove-logo"><?php echo esc_js( __( 'Remove', 'genqr' ) ); ?></a>';
						box.querySelector( 'img' ).src = src;
						box.querySelector( 'input' ).value = a.id;
						list.appendChild( box );
					} );
					input.value = current.join( ',' );
				} );
				frame.open();
			} );
		} )();
		</script>
		<?php
	}

	/** One editable preset row; $key is the form index ('__i__' in the template). */
	private static function preset_row( $key, array $preset, $is_default ) {
		$st     = GenQR_Settings::sanitize_style( $preset['style'] ?? array() );
		$n      = 'presets[' . $key . ']';
		$shapes = array(
			'moduleShape'   => array( __( 'Pattern', 'genqr' ), array( 'square' => __( 'Square', 'genqr' ), 'rounded' => __( 'Rounded', 'genqr' ), 'dots' => __( 'Dots', 'genqr' ) ) ),
			'eyeFrameShape' => array( __( 'Corner frame', 'genqr' ), array( 'square' => __( 'Square', 'genqr' ), 'rounded' => __( 'Rounded', 'genqr' ), 'circle' => __( 'Circle', 'genqr' ) ) ),
			'eyeBallShape'  => array( __( 'Corner centre', 'genqr' ), array( 'square' => __( 'Square', 'genqr' ), 'rounded' => __( 'Rounded', 'genqr' ), 'circle' => __( 'Circle', 'genqr' ) ) ),
		);
		$g = $st['gradient'];
		?>
		<tr class="genqr-preset">
			<td><input type="radio" name="default_preset" value="<?php echo esc_attr( $key ); ?>" <?php checked( $is_default ); ?> aria-label="<?php esc_attr_e( 'Default preset', 'genqr' ); ?>"></td>
			<td><span class="genqr-swatch" style="display:inline-block;width:18px;height:18px;border-radius:50%;vertical-align:middle;margin-right:6px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)"></span>
				<input type="text" name="<?php echo esc_attr( $n ); ?>[name]" value="<?php echo esc_attr( $preset['name'] ); ?>" maxlength="40" style="width:140px" placeholder="<?php esc_attr_e( 'Preset name', 'genqr' ); ?>"></td>
			<td>
				<label><?php esc_html_e( 'Code', 'genqr' ); ?> <input type="color" name="<?php echo esc_attr( $n ); ?>[style][foreground]" value="<?php echo esc_attr( $st['foreground'] ); ?>"></label>
				<label><?php esc_html_e( 'Background', 'genqr' ); ?> <input type="color" name="<?php echo esc_attr( $n ); ?>[style][background]" value="<?php echo esc_attr( $st['background'] ); ?>"></label><br>
				<label><?php esc_html_e( 'Gradient', 'genqr' ); ?>
					<select name="<?php echo esc_attr( $n ); ?>[style][gradient][type]">
						<option value="" <?php selected( ! $g ); ?>><?php esc_html_e( 'None', 'genqr' ); ?></option>
						<option value="linear" <?php selected( $g['type'] ?? '', 'linear' ); ?>><?php esc_html_e( 'Linear', 'genqr' ); ?></option>
						<option value="radial" <?php selected( $g['type'] ?? '', 'radial' ); ?>><?php esc_html_e( 'Radial', 'genqr' ); ?></option>
					</select></label>
				<label><?php esc_html_e( 'to', 'genqr' ); ?> <input type="color" name="<?php echo esc_attr( $n ); ?>[style][gradient][color]" value="<?php echo esc_attr( $g['color'] ?? '#1565c0' ); ?>"></label>
				<label><input type="number" name="<?php echo esc_attr( $n ); ?>[style][gradient][rotation]" min="0" max="360" step="15" style="width:64px" value="<?php echo (int) ( $g['rotation'] ?? 45 ); ?>">°</label><br>
				<label><input type="checkbox" name="<?php echo esc_attr( $n ); ?>[eye_on]" value="1" <?php checked( null !== $st['eyeColor'] ); ?>> <?php esc_html_e( 'Corner colour', 'genqr' ); ?></label>
				<input type="color" name="<?php echo esc_attr( $n ); ?>[style][eyeColor]" value="<?php echo esc_attr( $st['eyeColor'] ?? $st['foreground'] ); ?>">
			</td>
			<td>
				<?php foreach ( $shapes as $k => list( $label, $options ) ) : ?>
					<label style="display:block;margin-bottom:2px"><?php echo esc_html( $label ); ?>
						<select name="<?php echo esc_attr( $n ); ?>[style][<?php echo esc_attr( $k ); ?>]">
							<?php foreach ( $options as $value => $name ) : ?>
								<option value="<?php echo esc_attr( $value ); ?>" <?php selected( $st[ $k ], $value ); ?>><?php echo esc_html( $name ); ?></option>
							<?php endforeach; ?>
						</select></label>
				<?php endforeach; ?>
			</td>
			<td><button type="button" class="button-link button-link-delete genqr-remove-preset"><?php esc_html_e( 'Remove', 'genqr' ); ?></button></td>
		</tr>
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
			'title'        => sanitize_text_field( wp_unslash( $_POST['title'] ?? '' ) ),
			'brand'        => sanitize_text_field( wp_unslash( $_POST['brand'] ?? '' ) ),
			'full_page'    => ! empty( $_POST['full_page'] ),
			'public_list'  => ! empty( $_POST['public_list'] ),
			'domains'      => GenQR_Settings::sanitize_domains( wp_unslash( $_POST['domains'] ?? '' ) ),
			'logos'        => $logos,
			'default_logo' => in_array( $default_logo, $logos, true ) ? $default_logo : 0,
			'prefix'       => $prefix,
			'rate_limit'   => max( 1, min( 1000, (int) ( $_POST['rate_limit'] ?? 20 ) ) ),
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
		self::back( $return, $values['domains'] ? 'settings' : 'nodomains' );
	}

	/** Creates the generator page (if needed) and sets it as the static front page. */
	public static function handle_homepage() {
		check_admin_referer( 'genqr_homepage' );
		self::require_cap();
		$s    = GenQR_Settings::get();
		$page = $s['homepage_id'] ? get_post( (int) $s['homepage_id'] ) : null;
		if ( ! $page || 'trash' === $page->post_status ) {
			$id = wp_insert_post(
				array(
					'post_type'    => 'page',
					'post_status'  => 'publish',
					'post_title'   => $s['brand'],
					'post_content' => '<!-- wp:shortcode -->[genqr]<!-- /wp:shortcode -->',
				)
			);
			GenQR_Settings::update( array( 'homepage_id' => (int) $id ) );
		} else {
			$id = $page->ID;
			if ( 'publish' !== $page->post_status ) {
				wp_update_post( array( 'ID' => $id, 'post_status' => 'publish' ) );
			}
		}
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', (int) $id );
		self::back( admin_url( 'admin.php?page=genqr-settings' ), 'homepage' );
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
		fputcsv( $out, array( 'short_url', 'destination', 'status', 'clicks', 'last_click_utc', 'created_utc', 'created_by' ) );
		// Spreadsheets would run cells starting with = + - @ as formulas.
		$cell = static fn( $v ) => preg_match( '/^[=+\-@\t\r]/', (string) $v ) ? "'" . $v : (string) $v;
		foreach ( $rows as $r ) {
			fputcsv(
				$out,
				array_map(
					$cell,
					array( GenQR_Settings::short_url( $r->code ), $r->destination, $r->is_active ? 'on' : 'off', $r->clicks, $r->last_click_at, $r->created_at, $r->created_by ? 'admin' : 'visitor' )
				)
			);
		}
		fclose( $out );
		exit;
	}
}
