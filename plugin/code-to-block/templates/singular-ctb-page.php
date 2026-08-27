<?php
/**
 * Full-canvas template for Code to Block pages.
 *
 * @package Code_To_Block
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'code-to-block-page-template' ); ?>>
<?php wp_body_open(); ?>
<a class="ctb-skip-link" href="#ctb-main-content">Skip to content</a>
<style>.ctb-skip-link{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;background:#171d35;color:#fff;padding:8px 16px;z-index:100000;text-decoration:none;font-weight:700}.ctb-skip-link:focus{left:12px;top:12px;width:auto;height:auto;}</style>
<div id="ctb-main-content" class="code-to-block-page-content" tabindex="-1">
	<?php
	while ( have_posts() ) {
		the_post();
		the_content();
	}
	?>
</div>
<?php wp_footer(); ?>
</body>
</html>
