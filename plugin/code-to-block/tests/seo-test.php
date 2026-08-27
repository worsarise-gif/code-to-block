<?php

define( 'ABSPATH', __DIR__ . '/' );

function get_the_title() {
	return 'Fallback title';
}

function get_permalink( $post_id ) {
	return 'https://example.test/built-page/' . (int) $post_id;
}

function trailingslashit( $value ) {
	return rtrim( $value, '/\\' ) . '/';
}

function wp_json_encode( $value, $flags = 0 ) {
	return json_encode( $value, $flags );
}

function esc_attr( $value ) {
	return htmlspecialchars( $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
}

function esc_url( $value ) {
	return htmlspecialchars( $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
}

function home_url() {
	return 'https://example.test';
}

require_once dirname( __DIR__ ) . '/includes/class-code-to-block-seo.php';

$document = array(
	'name' => 'Audit </script><script id="breakout">bad</script>',
	'root' => array(
		'id' => 'root',
		'type' => 'container',
		'tag' => 'main',
		'attributes' => array(),
		'children' => array(),
		'styles' => array( 'mapped' => array(), 'custom_css_fallback' => '' ),
		'meta' => array( 'source' => 'test' ),
	),
);

ob_start();
Code_To_Block_SEO::output_head( 42, $document );
$output = ob_get_clean();

if ( false !== strpos( $output, '</script><script' ) ) {
	fwrite( STDERR, "FAIL: JSON-LD allowed a script-element breakout.\n" );
	exit( 1 );
}
if ( false === strpos( $output, '\\u003C/script\\u003E' ) ) {
	fwrite( STDERR, "FAIL: JSON-LD did not hex-escape tag delimiters.\n" );
	exit( 1 );
}

echo "PASS: 2 SEO output assertions.\n";
