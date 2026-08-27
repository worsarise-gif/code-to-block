<?php
require 'wp-load.php';
$doc = [
    'schema_version' => 1,
    'name' => 'Cart Test',
    'root' => [
        'id' => 'root',
        'type' => 'container',
        'tag' => 'div',
        'attributes' => new stdClass(),
        'meta' => ['source' => 'test'],
        'styles' => ['base' => [], 'mapped' => new stdClass(), 'css' => '', 'custom_css_fallback' => ''],
        'children' => [
            [
                'id' => 'cart',
                'type' => 'woocommerce_cart',
                'tag' => 'div',
                'attributes' => new stdClass(),
                'meta' => ['source' => 'test'],
                'styles' => ['base' => [], 'mapped' => new stdClass(), 'css' => '', 'custom_css_fallback' => ''],
                'children' => []
            ]
        ]
    ]
];

$sanitized = Code_To_Block_Schema::sanitize_document($doc);
if (is_wp_error($sanitized)) {
    print_r($sanitized);
} else {
    update_post_meta(61, CODE_TO_BLOCK_META_KEY, wp_json_encode($sanitized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    echo "Updated successfully!\n";
}
