<?php

define( 'ABSPATH', __DIR__ . '/' );

$commerce_query = array();
$assertions = 0;

final class Commerce_Test_Product {
	public function get_id() { return 42; }
	public function get_name() { return 'Variable Shirt'; }
	public function get_type() { return 'variable'; }
	public function get_price_html() { return '<span class="price">$20 &ndash; $30</span>'; }
	public function get_short_description() { return '<p>Soft <strong>cotton</strong>.</p>'; }
	public function get_image_id() { return 7; }
	public function is_type( $type ) { return 'variable' === $type; }
	public function get_children() { return array( 101, 102, 103, 104 ); }
	public function is_in_stock() { return true; }
}

function wc_get_products( $args ) {
	global $commerce_query;
	$commerce_query = $args;
	return array( new Commerce_Test_Product() );
}
function wc_get_stock_html() { return ''; }
function wp_get_attachment_image_url() { return 'https://example.test/shirt.jpg'; }
function wp_get_attachment_image_srcset() { return 'https://example.test/shirt.jpg 1200w'; }
function get_post_meta() { return 'Blue shirt'; }
function wp_kses_post( $value ) { return $value; }
function wp_strip_all_tags( $value ) { return strip_tags( $value ); }

function assert_commerce( $condition, $message ) {
	global $assertions;
	++$assertions;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

require_once dirname( __DIR__ ) . '/includes/class-code-to-block-commerce.php';

$products = Code_To_Block_Commerce::products( 500 );
assert_commerce( 100 === $commerce_query['limit'], 'Product preview queries must enforce the 100-product limit.' );
assert_commerce( 'publish' === $commerce_query['status'], 'Product previews must query published products.' );
assert_commerce( 42 === $products[0]['id'] && 'Variable Shirt' === $products[0]['name'], 'Product identity must normalize.' );
assert_commerce( 'variable' === $products[0]['type'] && 4 === $products[0]['variation_count'], 'Variable product metadata must normalize.' );
assert_commerce( '$20 – $30' === $products[0]['price_text'], 'Formatted variable price ranges must become readable canvas text.' );
assert_commerce( 'Soft cotton.' === $products[0]['short_description_text'], 'Product descriptions must become readable canvas text.' );
assert_commerce( 'In stock' === $products[0]['stock_text'], 'Stock status must normalize for the canvas.' );
assert_commerce( 'https://example.test/shirt.jpg' === $products[0]['image']['url'] && 'Blue shirt' === $products[0]['image']['alt'], 'Product image data must normalize.' );

fwrite( STDOUT, "PASS: {$assertions} commerce assertions.\n" );
