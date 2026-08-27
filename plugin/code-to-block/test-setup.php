<?php
if ( 'cli' !== PHP_SAPI ) {
	http_response_code( 404 );
	exit;
}

// Find wp-load.php by going up the directory tree
$path = dirname(__FILE__);
while ( ! file_exists( $path . '/wp-load.php' ) ) {
	$path = dirname($path);
	if ($path === '/' || $path === '\\' || preg_match('/^[A-Z]:\\\\$/i', $path)) {
		die("Could not find wp-load.php");
	}
}
require_once $path . '/wp-load.php';

if ( ! function_exists( 'wc_get_products' ) ) {
	die( "WooCommerce is not active." );
}

$products = wc_get_products( array( 'limit' => -1 ) );
if ( count( $products ) >= 5 ) {
	die( "Products already exist." );
}

// Create a simple product
$simple = new WC_Product_Simple();
$simple->set_name( 'Test Simple Product' );
$simple->set_regular_price( '19.99' );
$simple->set_short_description( 'This is a simple test product.' );
$simple->set_manage_stock( true );
$simple->set_stock_quantity( 100 );
$simple->set_stock_status( 'instock' );
$simple_id = $simple->save();
echo "Created Simple Product ID: $simple_id<br>";

// Create a variable product
$variable = new WC_Product_Variable();
$variable->set_name( 'Test Variable Product' );
$variable->set_short_description( 'This is a variable test product.' );

// Add attributes
$attribute = new WC_Product_Attribute();
$attribute->set_id( 0 ); // Custom attribute
$attribute->set_name( 'Size' );
$attribute->set_options( array( 'Small', 'Large' ) );
$attribute->set_position( 0 );
$attribute->set_visible( true );
$attribute->set_variation( true );
$variable->set_attributes( array( $attribute ) );
$variable_id = $variable->save();
echo "Created Variable Product ID: $variable_id<br>";

// Create variations
$variations = array(
	array( 'Size' => 'Small', 'price' => '10.00' ),
	array( 'Size' => 'Large', 'price' => '20.00' )
);

foreach ( $variations as $var_data ) {
	$variation = new WC_Product_Variation();
	$variation->set_parent_id( $variable_id );
	$variation->set_attributes( array( 'size' => $var_data['Size'] ) );
	$variation->set_regular_price( $var_data['price'] );
	$variation->set_manage_stock( true );
	$variation->set_stock_quantity( 50 );
	$variation->set_stock_status( 'instock' );
	$var_id = $variation->save();
	echo "Created Variation ID: $var_id for {$var_data['Size']}<br>";
}

// Create more simple products to reach 5
for ( $i = 3; $i <= 5; $i++ ) {
	$p = new WC_Product_Simple();
	$p->set_name( "Test Product $i" );
	$p->set_regular_price( "5.99" );
	$p->save();
	echo "Created extra product $i<br>";
}

echo "Done.";
