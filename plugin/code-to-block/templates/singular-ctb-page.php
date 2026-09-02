<?php
/**
 * Full-canvas template for Code to Block pages.
 *
 * @package Code_To_Block
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$ctb_document = code_to_block_get_saved_document( get_queried_object_id() );
$ctb_document = is_array( $ctb_document ) ? $ctb_document : array();
$ctb_html_attributes = Code_To_Block_Renderer::render_imported_page_root_attributes(
	$ctb_document,
	'html',
	array(
		'lang' => get_bloginfo( 'language' ),
		'dir'  => is_rtl() ? 'rtl' : 'ltr',
	)
);
$ctb_body_attributes = Code_To_Block_Renderer::render_imported_page_root_attributes(
	$ctb_document,
	'body',
	array( 'class' => implode( ' ', get_body_class( 'code-to-block-page-template' ) ) )
);
?>
<!doctype html>
<html<?php echo $ctb_html_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by renderer. ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body<?php echo $ctb_body_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by renderer. ?>>
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
