<?php require 'wp-load.php'; $json = get_post_meta(48, '_code_to_block_document', true); json_decode($json, true); var_dump(json_last_error_msg()); var_dump($json);
