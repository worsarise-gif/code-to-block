<?php
require 'wp-load.php';
$post_id = wp_insert_post([
    'post_title' => 'WC Cart Page',
    'post_content' => '<!-- wp:woocommerce/cart /-->',
    'post_status' => 'publish',
    'post_type' => 'page'
]);
echo "Created: $post_id\n";
