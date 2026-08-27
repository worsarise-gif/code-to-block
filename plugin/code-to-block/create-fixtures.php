<?php
require_once 'wp-load.php';

function create_fixture( $title, $actions ) {
	$post_id = wp_insert_post( array(
		'post_title' => $title,
		'post_type'  => 'ctb_page',
		'post_status'=> 'publish',
	) );
	
	$schema = array(
		'schema_version' => 1,
		'name'           => 'Test',
		'root'           => array(
			'id'         => 'root',
			'type'       => 'container',
			'tag'        => 'div',
			'attributes' => array(),
			'children'   => array(),
			'styles'     => array(
				'mapped'              => array(),
				'custom_css_fallback' => ''
			),
			'meta'       => array(
				'source' => 'parser'
			),
			'actions'    => $actions,
		)
	);
	
	$json = wp_slash( wp_json_encode( $schema ) );
	update_post_meta( $post_id, '_ctb_block_tree', $json );
	
	echo "Created: $title -> ID: $post_id\n";
}

create_fixture( 'No Animation Page', array() );

create_fixture( 'CSS Native Page', array(
	array(
		'trigger'        => 'click',
		'behavior'       => 'toggle_class',
		'animation_type' => 'css_native',
		'params'         => array( 'target_block_id' => 'root', 'class_name' => 'active' )
	)
) );

create_fixture( 'JS Library Page', array(
	array(
		'trigger'        => 'scroll',
		'behavior'       => 'animate',
		'animation_type' => 'js_library',
		'params'         => array( 'target_block_id' => 'root' )
	)
) );
