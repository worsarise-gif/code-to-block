<?php
require '/var/www/html/wp-load.php';
function generateDeepTree( $depth, $breadth, &$counter ) {
	if ( 0 === $depth ) {
		return array(
			'id' => 'perf-leaf-' . $counter++,
			'type' => 'text',
			'tag' => 'p',
			'attributes' => new stdClass(),
			'children' => array( array( 'kind' => 'text', 'value' => 'Leaf ' . $counter ) ),
			'styles' => array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
			'meta' => array( 'source' => 'perf-test' ),
		);
	}
	$children = array();
	for ( $i = 0; $i < $breadth; $i++ ) {
		$children[] = generateDeepTree( $depth - 1, $breadth, $counter );
	}
	return array(
		'id' => 'perf-container-' . $depth . '-' . $counter++,
		'type' => 'container',
		'tag' => 'div',
		'attributes' => new stdClass(),
		'children' => $children,
		'styles' => array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
		'meta' => array( 'source' => 'perf-test' ),
	);
}
function countBlocks( $block ) {
	$count = 1;
	foreach ( $block['children'] as $child ) {
		if ( isset( $child['kind'] ) ) continue;
		$count += countBlocks( $child );
	}
	return $count;
}
function trimToCount( &$block, $target ) {
	$count = countBlocks( $block );
	if ( $count <= $target ) return;
	foreach ( $block['children'] as $k => $child ) {
		if ( isset( $child['kind'] ) ) continue;
		if ( $count <= $target ) break;
		$childCount = countBlocks( $child );
		if ( $count - $childCount >= $target ) {
			unset( $block['children'][ $k ] );
			$count -= $childCount;
		} else {
			trimToCount( $block['children'][ $k ], $target - ( $count - $childCount ) );
			$count = countBlocks( $block );
		}
	}
	$block['children'] = array_values( $block['children'] );
}
$counter = 0;
$root = generateDeepTree( 8, 2, $counter );
trimToCount( $root, 160, $counter );
$doc = array( 'schema_version' => 1, 'name' => 'Perf stress test', 'root' => $root );
$existing = get_page_by_path( 'perf-stress-test', OBJECT, 'ctb_page' );
if ( $existing ) {
	$post_id = $existing->ID;
	wp_delete_post( $post_id, true );
}
$post_id = wp_insert_post( array( 'post_type' => 'ctb_page', 'post_status' => 'publish', 'post_title' => 'Perf Stress Test', 'post_name' => 'perf-stress-test', 'post_author' => 1 ) );
$san = Code_To_Block_Schema::sanitize_document( json_decode( wp_json_encode( $doc ) ) );
if ( is_wp_error( $san ) ) {
	echo 'sanitize error: ' . $san->get_error_message() . "\n";
	exit( 1 );
}
$json = wp_json_encode( $san, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
update_post_meta( $post_id, '_ctb_block_tree', $json );
echo "post_id:$post_id blocks:" . countBlocks( $san['root'] ) . " depth:8\n";
