<?php
/**
 * wp-admin list of short links.
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WP_List_Table' ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class GenQR_Links_Table extends WP_List_Table {

	public function __construct() {
		parent::__construct(
			array(
				'singular' => 'link',
				'plural'   => 'links',
				'ajax'     => false,
			)
		);
	}

	public function get_columns() {
		return array(
			'cb'            => '<input type="checkbox" />',
			'code'          => __( 'QR code', 'genqr' ),
			'destination'   => __( 'Destination', 'genqr' ),
			'clicks'        => __( 'Clicks', 'genqr' ),
			'last_click_at' => __( 'Last click', 'genqr' ),
			'status'        => __( 'Status', 'genqr' ),
			'created_at'    => __( 'Created', 'genqr' ),
		);
	}

	protected function get_sortable_columns() {
		return array(
			'code'          => array( 'code', false ),
			'destination'   => array( 'destination', false ),
			'clicks'        => array( 'clicks', true ),
			'last_click_at' => array( 'last_click_at', true ),
			'created_at'    => array( 'created_at', true ),
		);
	}

	protected function get_bulk_actions() {
		return array(
			'export_qr' => __( 'Export QR codes', 'genqr' ),
			'enable'    => __( 'Switch on', 'genqr' ),
			'disable' => __( 'Switch off', 'genqr' ),
			'delete'  => __( 'Delete', 'genqr' ),
		);
	}

	protected function get_views() {
		$status = isset( $_GET['status'] ) ? sanitize_key( $_GET['status'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$base   = admin_url( 'admin.php?page=genqr' );
		$views  = array();
		foreach ( array( '' => __( 'All', 'genqr' ), 'active' => __( 'On', 'genqr' ), 'inactive' => __( 'Off', 'genqr' ) ) as $key => $label ) {
			$url           = $key ? add_query_arg( 'status', $key, $base ) : $base;
			$views[ $key ? $key : 'all' ] = sprintf( '<a href="%s"%s>%s</a>', esc_url( $url ), $status === $key ? ' class="current"' : '', esc_html( $label ) );
		}
		return $views;
	}

	public function prepare_items() {
		// phpcs:disable WordPress.Security.NonceVerification -- read-only list parameters
		$per_page = 20;
		$page     = $this->get_pagenum();
		$result   = GenQR_Links::query(
			array(
				'search'   => isset( $_REQUEST['s'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['s'] ) ) : '',
				'status'   => isset( $_REQUEST['status'] ) ? sanitize_key( $_REQUEST['status'] ) : '',
				'orderby'  => isset( $_REQUEST['orderby'] ) ? sanitize_key( $_REQUEST['orderby'] ) : '',
				'order'    => isset( $_REQUEST['order'] ) ? sanitize_key( $_REQUEST['order'] ) : '',
				'per_page' => $per_page,
				'offset'   => ( $page - 1 ) * $per_page,
			)
		);
		// phpcs:enable
		$this->items           = $result['items'];
		$this->_column_headers = array( $this->get_columns(), array(), $this->get_sortable_columns() );
		$this->set_pagination_args(
			array(
				'total_items' => $result['total'],
				'per_page'    => $per_page,
			)
		);
	}

	protected function column_cb( $item ) {
		return sprintf( '<input type="checkbox" name="ids[]" value="%d" />', (int) $item->id );
	}

	protected function column_code( $item ) {
		$edit    = admin_url( 'admin.php?page=genqr-edit&id=' . (int) $item->id );
		$actions = array(
			'edit' => sprintf( '<a href="%s">%s</a>', esc_url( $edit ), esc_html__( 'Edit', 'genqr' ) ),
		);
		$toggle             = $item->is_active ? 'disable' : 'enable';
		$actions[ $toggle ] = sprintf(
			'<a href="%s">%s</a>',
			esc_url( GenQR_Admin::action_url( $toggle, array( (int) $item->id ) ) ),
			$item->is_active ? esc_html__( 'Switch off', 'genqr' ) : esc_html__( 'Switch on', 'genqr' )
		);
		$actions['delete'] = sprintf(
			'<a href="%s" onclick="return confirm(\'%s\')">%s</a>',
			esc_url( GenQR_Admin::action_url( 'delete', array( (int) $item->id ) ) ),
			esc_js( __( 'Delete this QR code? Printed copies will stop working.', 'genqr' ) ),
			esc_html__( 'Delete', 'genqr' )
		);
		return sprintf(
			'<strong><a class="row-title" href="%s">/%s/%s</a></strong>%s%s',
			esc_url( $edit ),
			esc_html( GenQR_Settings::prefix() ),
			esc_html( $item->code ),
			$item->title ? '<br>' . esc_html( $item->title ) : '',
			$this->row_actions( $actions )
		);
	}

	protected function column_destination( $item ) {
		return sprintf( '<a href="%1$s" target="_blank" rel="noopener noreferrer" style="word-break:break-all">%2$s</a>', esc_url( $item->destination ), esc_html( $item->destination ) );
	}

	protected function column_clicks( $item ) {
		return number_format_i18n( (int) $item->clicks );
	}

	protected function column_last_click_at( $item ) {
		return $item->last_click_at ? esc_html( GenQR_Admin::format_date( $item->last_click_at ) ) : '—';
	}

	protected function column_status( $item ) {
		return $item->is_active
			? '<span style="color:#00a32a">' . esc_html__( 'On', 'genqr' ) . '</span>'
			: '<span style="color:#b32d2e">' . esc_html__( 'Off', 'genqr' ) . '</span>';
	}

	protected function column_created_at( $item ) {
		return esc_html( GenQR_Admin::format_date( $item->created_at ) );
	}

	public function no_items() {
		esc_html_e( 'No QR codes yet. Use "Add QR code", or "Import" to create many at once.', 'genqr' );
	}
}
