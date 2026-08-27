<?php
require 'wp-load.php';
echo "wc_get_product exists: " . (function_exists('wc_get_product') ? 'yes' : 'no') . "\n";
$prod = wc_get_product(63);
if ($prod) {
    echo "Product title: " . $prod->get_name() . "\n";
    echo "Product price: " . $prod->get_price_html() . "\n";
} else {
    echo "Product 63 not found\n";
}

$document = code_to_block_get_saved_document( 61 );
echo Code_To_Block_Renderer::render_document( $document, 61 );
