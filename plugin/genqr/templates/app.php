<?php
/**
 * Full-page layout for the generator page. The top bar and both views (create, all QR codes)
 * are drawn by the app itself; this only provides a bare document.
 */

defined( 'ABSPATH' ) || exit;

?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
<style>
html,body{margin:0;padding:0;background:#fff}
.genqr-app{min-height:100vh}
.genqr-app .genqr-root{max-width:none;margin:0}
</style>
</head>
<body <?php body_class( 'genqr-app-page' ); ?>>
<?php wp_body_open(); ?>
<main class="genqr-app">
	<?php echo GenQR_Shortcode::render(); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside ?>
</main>
<?php wp_footer(); ?>
</body>
</html>
