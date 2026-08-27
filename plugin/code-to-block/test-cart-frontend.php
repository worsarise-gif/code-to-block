<?php
require 'wp-load.php';

// Mock WP Query for post 61
$post = get_post( 61 );
global $wp_query;
$wp_query->is_singular = true;
$wp_query->is_main_query = true;
$wp_query->in_the_loop = true;
$wp_query->post = $post;
$wp_query->queried_object = $post;
$wp_query->queried_object_id = 61;
setup_postdata($post);

$document = code_to_block_get_saved_document( 61 );
$content = Code_To_Block_Renderer::render_document( $document, 61 );

echo "=== RAW CODE TO BLOCK OUTPUT ===\n";
echo $content . "\n\n";

echo "=== AFTER do_blocks (via code_to_block_render_frontend_content) ===\n";
echo code_to_block_render_frontend_content( '' ) . "\n";
