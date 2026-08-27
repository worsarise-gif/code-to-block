<?php
/**
 * Dedicated full-screen editor for Code to Block.
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
	<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
	<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet"/>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?php echo esc_html( sprintf( __( 'Edit %s — Code to Block', 'code-to-block' ), $post->post_title ) ); ?></title>
	<?php wp_head(); ?>
	<style>
		html, body { margin: 0; padding: 0; height: 100%; background: #f3f1eb; }
		#wpadminbar, #adminmenumain, #adminmenuwrap, #adminmenuback { display: none !important; }
		html.wp-toolbar, body.admin-bar { padding-top: 0 !important; margin-top: 0 !important; }
		#wpcontent, #wpbody-content { margin-left: 0 !important; padding-left: 0 !important; }
		.code-to-block-dedicated-header { background: #171d35; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; font-family: Inter, sans-serif; }
		.code-to-block-dedicated-header a { color: #b7b0ff; text-decoration: none; font-size: 13px; }
		.code-to-block-dedicated-header strong { font-family: Georgia, serif; font-weight: 400; font-size: 16px; }
		#code-to-block-editor-root { min-height: calc(100vh - 56px); }
	</style>
</head>
<body class="code-to-block-dedicated-editor">
<?php wp_body_open(); ?>
<div class="code-to-block-dedicated-header">
	<div>
		<strong><?php echo esc_html( $post->post_title ); ?></strong>
		<span style="opacity:.7; margin-left:10px; font-size:12px;">Dedicated editor — no admin chrome</span>
	</div>
	<div>
		<a href="<?php echo esc_url( get_edit_post_link( $post_id ) ); ?>"><?php esc_html_e( 'Back to WordPress editor', 'code-to-block' ); ?></a>
		<span style="margin:0 8px; opacity:.5;">|</span>
		<a href="<?php echo esc_url( get_permalink( $post_id ) ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'View live page', 'code-to-block' ); ?></a>
	</div>
</div>
<div id="code-to-block-editor-root">
	<p style="padding:40px; text-align:center; opacity:.6;"><?php esc_html_e( 'Loading the visual canvas…', 'code-to-block' ); ?></p>
</div>
<?php wp_footer(); ?>
</body>
</html>
