<?php
require '/var/www/html/wp-load.php';
function generateSmallTree( $count, &$counter ) {
	$children = array();
	for ( $i = 0; $i < $count; $i++ ) {
		$children[] = array(
			'id' => 'small-' . $counter++,
			'type' => 'text',
			'tag' => 'p',
			'attributes' => new stdClass(),
			'children' => array( array( 'kind' => 'text', 'value' => 'Small ' . $counter ) ),
			'styles' => array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
			'meta' => array( 'source' => 'perf-test' ),
		);
	}
	return array(
		'id' => 'small-root',
		'type' => 'container',
		'tag' => 'div',
		'attributes' => new stdClass(),
		'children' => $children,
		'styles' => array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
		'meta' => array( 'source' => 'perf-test' ),
	);
}
$counter = 0;
$root = generateSmallTree( 10, $counter );
$doc = array( 'schema_version' => 1, 'name' => 'Small perf', 'root' => $root );
$existing = get_page_by_path( 'small-perf', OBJECT, 'ctb_page' );
if ( $existing ) {
	$post_id = $existing->ID;
	wp_delete_post( $post_id, true );
}
$post_id = wp_insert_post( array( 'post_type' => 'ctb_page', 'post_status' => 'publish', 'post_title' => 'Small Perf', 'post_name' => 'small-perf', 'post_author' => 1 ) );
$san = Code_To_Block_Schema::sanitize_document( json_decode( wp_json_encode( $doc ) ) );
$json = wp_json_encode( $san, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
update_post_meta( $post_id, '_ctb_block_tree', $json );
echo "post_id:$post_id blocks:10\n";
