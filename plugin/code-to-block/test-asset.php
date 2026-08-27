<?php require 'wp-load.php'; $doc = code_to_block_get_saved_document(45); $asset = Code_To_Block_Renderer::write_stylesheet(45, $doc); var_dump($asset);
