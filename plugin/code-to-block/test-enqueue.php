<?php require 'wp-load.php'; code_to_block_enqueue_frontend_styles(); global $wp_scripts; var_dump(in_array('code-to-block-gsap', $wp_scripts->queue));
