<?php require 'wp-load.php'; $res = update_post_meta(45, '_code_to_block_needs_gsap', 'yes'); var_dump($res); echo get_post_meta(45, '_code_to_block_needs_gsap', true);
