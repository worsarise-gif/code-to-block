<?php
require 'wp-load.php';
$post = get_post(65);
echo do_blocks($post->post_content);
