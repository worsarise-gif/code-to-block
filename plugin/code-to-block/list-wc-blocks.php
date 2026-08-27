<?php
require 'wp-load.php';
$blocks = WP_Block_Type_Registry::get_instance()->get_all_registered();
foreach ($blocks as $name => $block) {
    if (strpos($name, 'woocommerce') !== false) {
        echo $name . "\n";
    }
}
