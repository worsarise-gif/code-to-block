<?php
require 'wp-load.php';
$json = '{"root":{"id":"root","type":"woocommerce_product","tag":"div","attributes":{"data-product-id":"63"},"meta":{"source":"test"},"styles":{"base":[],"mapped":{},"css":""},"children":[{"id":"title","type":"text","tag":"h1","attributes":{},"meta":{"source":"test"},"styles":{"base":[],"mapped":{},"css":""},"children":[{"kind":"text","value":"Title Placeholder"}],"is_dynamic":true,"dynamic_source":"wc_product_title"},{"id":"price","type":"text","tag":"p","attributes":{},"meta":{"source":"test"},"styles":{"base":[],"mapped":{},"css":""},"children":[{"kind":"text","value":"Price Placeholder"}],"is_dynamic":true,"dynamic_source":"wc_product_price"}]},"schema_version":1,"name":"Test","design_tokens":{}}';

$decoded = json_decode($json, true);
$sanitized = Code_To_Block_Schema::sanitize_document($decoded);

if (is_wp_error($sanitized)) {
    print_r($sanitized);
} else {
    echo "Success!\n";
}
