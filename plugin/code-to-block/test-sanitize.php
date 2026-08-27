<?php require 'wp-load.php'; $doc = json_decode(get_post_meta(48, '_code_to_block_document', true), true); var_dump(Code_To_Block_Schema::sanitize_document($doc));
