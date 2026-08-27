<?php require 'wp-load.php'; $json = get_post_meta(45, '_code_to_block_document', true); echo strpos($json, '"animation_type":"js_library"') !== false ? 'YES' : 'NO';
