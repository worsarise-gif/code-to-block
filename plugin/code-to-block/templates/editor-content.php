<?php
/**
 * Dedicated content-mode editor for Code to Block.
 *
 * @package Code_To_Block
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$post_id = isset( $_GET['post'] ) ? (int) $_GET['post'] : 0;
$post = get_post( $post_id );
if ( ! $post || CODE_TO_BLOCK_POST_TYPE !== $post->post_type ) {
	wp_die( esc_html__( 'Code to Block page not found.', 'code-to-block' ), '', array( 'response' => 404 ) );
}
if ( ! current_user_can( 'edit_post', $post_id ) ) {
	wp_die( esc_html__( 'You are not allowed to edit this page.', 'code-to-block' ), '', array( 'response' => 403 ) );
}
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?php echo esc_html( sprintf( __( 'Edit Content: %s — Code to Block', 'code-to-block' ), $post->post_title ) ); ?></title>
	<?php wp_head(); ?>
	<style>
		html, body { margin: 0; padding: 0; height: 100%; background: #f3f1eb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; }
		#wpadminbar, #adminmenumain, #adminmenuwrap, #adminmenuback { display: none !important; }
		html.wp-toolbar, body.admin-bar { padding-top: 0 !important; margin-top: 0 !important; }
		#wpcontent, #wpbody-content { margin-left: 0 !important; padding-left: 0 !important; }
		.code-to-block-dedicated-header { background: #171d35; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; font-family: Inter, sans-serif; }
		.code-to-block-dedicated-header a { color: #b7b0ff; text-decoration: none; font-size: 13px; }
		.code-to-block-dedicated-header strong { font-family: Georgia, serif; font-weight: 400; font-size: 16px; }
		#code-to-block-content-root { min-height: calc(100vh - 56px); display: flex; justify-content: center; padding: 40px; }
		
		/* Content Mode Styles */
		.ctb-content-mode-wrap { width: 100%; max-width: 800px; background: #fff; padding: 40px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
		.ctb-content-mode-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 30px; }
		.ctb-content-mode-header h1 { margin: 0; font-size: 24px; color: #1e1e1e; }
		.ctb-save-status { margin-left: 15px; font-size: 14px; color: #666; }
		.ctb-slot-field { margin-bottom: 24px; }
		.ctb-slot-field label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; }
		.ctb-slot-type { font-weight: 400; color: #666; font-size: 12px; }
		.ctb-slot-field input[type="text"], .ctb-slot-field input[type="url"], .ctb-slot-field input[type="file"], .ctb-slot-field textarea { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit; font-size: 14px; box-sizing: border-box; }
		.ctb-slot-field input[type="file"] { margin-top: 8px; background: #f8f7f3; }
		.ctb-slot-field input[type="text"]:focus, .ctb-slot-field input[type="url"]:focus, .ctb-slot-field input[type="file"]:focus, .ctb-slot-field textarea:focus { border-color: #2271b1; outline: none; box-shadow: 0 0 0 1px #2271b1; }
		.ctb-slot-image-preview { display: block; width: min(240px, 100%); max-height: 180px; object-fit: cover; margin-bottom: 8px; border-radius: 4px; }
		.ctb-rich-text-control { border: 1px solid #ccc; border-radius: 4px; overflow: hidden; }
		.ctb-rich-text-control:focus-within { border-color: #2271b1; box-shadow: 0 0 0 1px #2271b1; }
		.ctb-rich-text-toolbar { display: flex; gap: 2px; padding: 6px; border-bottom: 1px solid #ddd; background: #f8f7f3; }
		.ctb-rich-text-toolbar button { min-width: 32px; padding: 5px 8px; border: 1px solid transparent; background: transparent; border-radius: 3px; color: #262a32; cursor: pointer; }
		.ctb-rich-text-toolbar input[type="url"] { width: min(220px, 40%); margin-left: auto; padding: 5px 7px; border: 1px solid #aaa; border-radius: 3px; font-size: 12px; }
		.ctb-rich-text-toolbar button:hover, .ctb-rich-text-toolbar button:focus { border-color: #9d988c; background: #fff; outline: none; }
		.ctb-rich-text-toolbar button:disabled { cursor: not-allowed; opacity: .45; }
		.ctb-rich-text-editor { min-height: 92px; padding: 10px; font-size: 14px; line-height: 1.55; outline: none; }
		.ctb-rich-text-editor[contenteditable="false"] { background: #f6f7f7; }
	</style>
</head>
<body class="code-to-block-dedicated-editor ctb-content-mode">
<?php wp_body_open(); ?>
<div class="code-to-block-dedicated-header">
	<div>
		<strong><?php echo esc_html( $post->post_title ); ?></strong>
		<span style="opacity:.7; margin-left:10px; font-size:12px;">Content mode — no structure editing</span>
	</div>
	<div>
		<a href="<?php echo esc_url( get_edit_post_link( $post_id ) ); ?>"><?php esc_html_e( 'Back to WordPress editor', 'code-to-block' ); ?></a>
		<span style="margin:0 8px; opacity:.5;">|</span>
		<a href="<?php echo esc_url( get_permalink( $post_id ) ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'View live page', 'code-to-block' ); ?></a>
	</div>
</div>
<div id="code-to-block-content-root">
	<p style="padding:40px; text-align:center; opacity:.6;"><?php esc_html_e( 'Loading content fields…', 'code-to-block' ); ?></p>
</div>
<?php wp_footer(); ?>
</body>
</html>
