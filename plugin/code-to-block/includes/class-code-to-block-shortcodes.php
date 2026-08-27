<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Stores and executes PHP snippets that passed explicit administrator review.
 */
final class Code_To_Block_Shortcodes {
	const OPTION_KEY = 'code_to_block_php_shortcodes';
	const LOCK_KEY   = 'code_to_block_php_shortcodes_lock';

	/** @var array<string,callable|WP_Error> */
	private static $compiled_callbacks = array();

	/** @var array<string,int> */
	private static $active_tags = array();

	/**
	 * Returns the exact phrase required for a reviewed source hash.
	 *
	 * @param string $tag  Shortcode tag.
	 * @param string $hash Reviewed source hash.
	 * @return string
	 */
	public static function confirmation_phrase( $tag, $hash ) {
		return 'REGISTER ' . $tag . ' ' . substr( $hash, 0, 12 );
	}

	/**
	 * Central authorization policy for granting PHP execution privileges.
	 *
	 * @param int $post_id Owning page.
	 * @return bool
	 */
	public static function current_user_can_register( $post_id ) {
		if ( ( defined( 'DISALLOW_FILE_EDIT' ) && DISALLOW_FILE_EDIT ) || ( defined( 'DISALLOW_FILE_MODS' ) && DISALLOW_FILE_MODS ) ) {
			return false;
		}
		if ( ! current_user_can( 'manage_options' ) || ! current_user_can( 'unfiltered_html' ) || ! current_user_can( 'edit_post', (int) $post_id ) ) {
			return false;
		}
		if ( function_exists( 'is_multisite' ) && is_multisite() && ! is_super_admin() ) {
			return false;
		}

		return true;
	}

	/**
	 * Builds the non-executing review response shown before confirmation.
	 *
	 * @param mixed $tag  Proposed shortcode tag.
	 * @param mixed $code Full PHP source.
	 * @return array|WP_Error
	 */
	public static function review_source( $tag, $code ) {
		$tag = is_string( $tag ) ? trim( $tag ) : '';
		if ( ! self::is_valid_tag( $tag ) ) {
			return self::error( 'code_to_block_shortcode_tag', 'Shortcode tags must start with ctb_ and contain only 6 to 64 lowercase letters, numbers, underscores, or hyphens.' );
		}
		$review = Code_To_Block_PHP_Scanner::scan( $code );
		if ( is_wp_error( $review ) ) {
			return $review;
		}

		return array(
			'tag'                 => $tag,
			'shortcode'           => '[' . $tag . ']',
			'confirmation_phrase' => self::confirmation_phrase( $tag, $review['hash'] ),
			'registered'          => false,
			'review'              => self::public_review( $review ),
		);
	}

	/**
	 * Registers source only when it still matches the server-reviewed hash.
	 *
	 * @param int    $post_id      Owning Code to Block page.
	 * @param mixed  $tag          Requested shortcode tag.
	 * @param mixed  $code         Full PHP source.
	 * @param mixed  $reviewed_hash Hash returned by the review request.
	 * @param mixed  $confirmation Typed confirmation phrase.
	 * @return array|WP_Error
	 */
	public static function register_reviewed( $post_id, $tag, $code, $reviewed_hash, $confirmation ) {
		$post_id = (int) $post_id;
		if ( ! self::current_user_can_register( $post_id ) ) {
			return self::error( 'code_to_block_php_forbidden', 'You are not allowed to grant PHP execution privileges for this page.', rest_authorization_required_code() );
		}
		$tag = is_string( $tag ) ? trim( $tag ) : '';
		if ( ! self::is_valid_tag( $tag ) ) {
			return self::error( 'code_to_block_shortcode_tag', 'Shortcode tags must start with ctb_ and contain only 6 to 64 lowercase letters, numbers, underscores, or hyphens.' );
		}

		$review = Code_To_Block_PHP_Scanner::scan( $code );
		if ( is_wp_error( $review ) ) {
			return $review;
		}
		if ( ! is_string( $reviewed_hash ) || ! hash_equals( $review['hash'], $reviewed_hash ) ) {
			return self::error( 'code_to_block_php_review_changed', 'The PHP source changed after review. Run the server review again.', 409 );
		}
		$expected = self::confirmation_phrase( $tag, $review['hash'] );
		if ( ! is_string( $confirmation ) || ! hash_equals( $expected, $confirmation ) ) {
			return self::error( 'code_to_block_shortcode_confirmation', 'Type the exact source-bound confirmation phrase before registration.' );
		}
		if ( 'safe' !== $review['status'] ) {
			return new WP_Error(
				'blocked' === $review['status'] ? 'code_to_block_php_blocked' : 'code_to_block_php_unreviewed_calls',
				'blocked' === $review['status'] ? 'This PHP contains blocked signatures and cannot be registered.' : 'This PHP contains warning or unknown calls and cannot be registered.',
				array(
					'status' => 422,
					'review' => self::public_review( $review ),
				)
			);
		}

		$lock = self::acquire_registry_lock();
		if ( is_wp_error( $lock ) ) {
			return $lock;
		}
		$result = null;
		try {
			$registry = self::get_registry();
			if ( isset( $registry[ $tag ] ) && $post_id !== (int) $registry[ $tag ]['post_id'] ) {
				$result = self::error( 'code_to_block_shortcode_owned', 'That Code to Block shortcode tag belongs to another page.', 409 );
			} elseif ( shortcode_exists( $tag ) && ! isset( self::$active_tags[ $tag ] ) ) {
				$result = self::error( 'code_to_block_shortcode_collision', 'That shortcode tag is already registered by WordPress, a theme, or another plugin.', 409 );
			} else {
				$registry[ $tag ] = array(
					'post_id'       => $post_id,
					'code'          => $review['code'],
					'hash'          => $review['hash'],
					'status'        => $review['status'],
					'description'   => $review['description'],
					'warnings'      => $review['warnings'],
					'registered_by' => (int) get_current_user_id(),
					'registered_at' => current_time( 'mysql', true ),
				);
				$updated = update_option( self::OPTION_KEY, $registry, false );
				$stored  = self::get_registry();
				if ( ( ! $updated && ! isset( $stored[ $tag ] ) ) || ! isset( $stored[ $tag ] ) || ! hash_equals( $review['hash'], $stored[ $tag ]['hash'] ) ) {
					$result = self::error( 'code_to_block_shortcode_save_failed', 'The reviewed shortcode could not be stored.', 500 );
				}
			}
		} finally {
			self::release_registry_lock( $lock );
		}
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		unset( self::$compiled_callbacks[ $tag ] );
		return array(
			'tag'                 => $tag,
			'shortcode'           => '[' . $tag . ']',
			'confirmation_phrase' => $expected,
			'registered'          => true,
			'review'              => self::public_review( $review ),
		);
	}

	/**
	 * Registers only the current public Code to Block page's confirmed tags.
	 */
	public static function register_runtime() {
		if ( is_singular( CODE_TO_BLOCK_POST_TYPE ) ) {
			self::register_for_post( (int) get_queried_object_id() );
		}
	}

	/**
	 * @param int $post_id Owning page.
	 */
	public static function register_for_post( $post_id ) {
		foreach ( self::get_registry() as $tag => $entry ) {
			if ( (int) $entry['post_id'] !== (int) $post_id || ! self::entry_is_eligible( $tag, $entry ) || shortcode_exists( $tag ) ) {
				continue;
			}
			$review = Code_To_Block_PHP_Scanner::scan( $entry['code'] );
			if ( is_wp_error( $review ) || 'safe' !== $review['status'] || ! hash_equals( $entry['hash'], $review['hash'] ) ) {
				continue;
			}
			add_shortcode( $tag, array( __CLASS__, 'render' ) );
			self::$active_tags[ $tag ] = (int) $post_id;
		}
	}

	/**
	 * Renders only exact bare placeholders from text nodes, never attributes.
	 *
	 * @param string $text    Text-node source.
	 * @param int    $post_id Owning page.
	 * @return string
	 */
	public static function render_text( $text, $post_id ) {
		$parts = preg_split( '/(\[ctb_[a-z0-9_-]{2,60}\])/', (string) $text, -1, PREG_SPLIT_DELIM_CAPTURE );
		$output = '';
		foreach ( is_array( $parts ) ? $parts : array( $text ) as $part ) {
			if ( preg_match( '/^\[(ctb_[a-z0-9_-]{2,60})\]$/', $part, $match ) && isset( self::$active_tags[ $match[1] ] ) && (int) $post_id === self::$active_tags[ $match[1] ] ) {
				$output .= do_shortcode( $part );
			} else {
				$output .= esc_html( $part );
			}
		}
		return $output;
	}

	/**
	 * Removes page-owned tags before WordPress's later global shortcode filter.
	 *
	 * @param int $post_id Owning page.
	 */
	public static function unregister_for_post( $post_id ) {
		foreach ( self::$active_tags as $tag => $owner_id ) {
			if ( (int) $post_id === $owner_id ) {
				remove_shortcode( $tag );
				unset( self::$active_tags[ $tag ] );
			}
		}
	}

	/**
	 * Executes one confirmed callback after rechecking owner, source, and scan.
	 *
	 * @param array       $atts    Shortcode attributes.
	 * @param string|null $content Enclosed content.
	 * @param string      $tag     Shortcode tag.
	 * @return string
	 */
	public static function render( $atts, $content = null, $tag = '' ) {
		$registry = self::get_registry();
		if ( ! isset( $registry[ $tag ] ) || ! self::entry_is_eligible( $tag, $registry[ $tag ] ) || ! self::is_current_owner( $registry[ $tag ]['post_id'] ) ) {
			return '';
		}
		$entry  = $registry[ $tag ];
		$review = Code_To_Block_PHP_Scanner::scan( $entry['code'] );
		if ( is_wp_error( $review ) || 'safe' !== $review['status'] || ! hash_equals( $entry['hash'], $review['hash'] ) ) {
			return '';
		}

		if ( ! isset( self::$compiled_callbacks[ $tag ] ) ) {
			self::$compiled_callbacks[ $tag ] = self::compile_callback( $review );
		}
		$callback = self::$compiled_callbacks[ $tag ];
		if ( is_wp_error( $callback ) || ! is_callable( $callback ) ) {
			return '';
		}

		return (string) call_user_func( $callback, is_array( $atts ) ? $atts : array(), $content, $tag );
	}

	/**
	 * Retires page-owned registrations no longer referenced by saved text nodes.
	 *
	 * @param int   $post_id Owning page.
	 * @param array $document Saved canonical document.
	 */
	public static function retain_for_document( $post_id, $document ) {
		$referenced = array();
		if ( isset( $document['root'] ) ) {
			self::collect_referenced_tags( $document['root'], $referenced );
		}
		self::remove_for_post_except( (int) $post_id, $referenced );
	}

	/**
	 * Removes registrations owned by a permanently deleted page.
	 *
	 * @param int $post_id Deleted post ID.
	 */
	public static function delete_for_post( $post_id ) {
		self::remove_for_post_except( (int) $post_id, array() );
	}

	/**
	 * @param int      $post_id Owning page.
	 * @param string[] $keep_tags Referenced tags to preserve.
	 */
	private static function remove_for_post_except( $post_id, $keep_tags ) {
		$lock = self::acquire_registry_lock();
		if ( is_wp_error( $lock ) ) {
			return;
		}
		try {
			$registry = self::get_registry();
			$changed  = false;
			foreach ( $registry as $tag => $entry ) {
				if ( $post_id === (int) $entry['post_id'] && ! in_array( $tag, $keep_tags, true ) ) {
					unset( $registry[ $tag ], self::$compiled_callbacks[ $tag ] );
					$changed = true;
				}
			}
			if ( $changed ) {
				update_option( self::OPTION_KEY, $registry, false );
			}
		} finally {
			self::release_registry_lock( $lock );
		}
	}

	/**
	 * @param array    $block Sanitized block.
	 * @param string[] $tags  Referenced tag accumulator.
	 */
	private static function collect_referenced_tags( $block, &$tags ) {
		foreach ( isset( $block['children'] ) ? $block['children'] : array() as $child ) {
			if ( is_array( $child ) && isset( $child['kind'], $child['value'] ) && 'text' === $child['kind'] ) {
				if ( preg_match_all( '/\[(ctb_[a-z0-9_-]{2,60})\]/', $child['value'], $matches ) ) {
					$tags = array_values( array_unique( array_merge( $tags, $matches[1] ) ) );
				}
			} elseif ( is_array( $child ) ) {
				self::collect_referenced_tags( $child, $tags );
			}
		}
	}

	/**
	 * @return array
	 */
	private static function get_registry() {
		$stored = get_option( self::OPTION_KEY, array() );
		if ( ! is_array( $stored ) ) {
			return array();
		}

		$registry = array();
		foreach ( $stored as $tag => $entry ) {
			if ( ! self::is_valid_tag( $tag ) || ! is_array( $entry ) ) {
				continue;
			}
			if ( ! isset( $entry['post_id'], $entry['code'], $entry['hash'] ) || ! is_string( $entry['code'] ) || ! is_string( $entry['hash'] ) ) {
				continue;
			}
			$registry[ $tag ] = $entry;
		}
		return $registry;
	}

	/**
	 * @param string $tag   Shortcode tag.
	 * @param array  $entry Registry entry.
	 * @return bool
	 */
	private static function entry_is_eligible( $tag, $entry ) {
		if ( ! self::is_valid_tag( $tag ) || ! is_array( $entry ) || empty( $entry['post_id'] ) ) {
			return false;
		}
		$post = get_post( (int) $entry['post_id'] );
		return $post && CODE_TO_BLOCK_POST_TYPE === $post->post_type && is_post_publicly_viewable( $post );
	}

	/**
	 * @param int $post_id Expected current page.
	 * @return bool
	 */
	private static function is_current_owner( $post_id ) {
		return is_singular( CODE_TO_BLOCK_POST_TYPE ) && (int) $post_id === (int) get_queried_object_id();
	}

	/**
	 * Compiles reviewed source from a short-lived non-web temporary file.
	 *
	 * @param array $review Scanner result.
	 * @return callable|WP_Error
	 */
	private static function compile_callback( $review ) {
		$temp_dir = realpath( sys_get_temp_dir() );
		$roots    = array( realpath( ABSPATH ) );
		if ( ! empty( $_SERVER['DOCUMENT_ROOT'] ) ) {
			$roots[] = realpath( $_SERVER['DOCUMENT_ROOT'] );
		}
		$uploads = wp_upload_dir();
		if ( empty( $uploads['error'] ) && ! empty( $uploads['basedir'] ) ) {
			$roots[] = realpath( $uploads['basedir'] );
		}
		if ( ! $temp_dir || ! is_writable( $temp_dir ) ) {
			return self::error( 'code_to_block_php_temp_unavailable', 'A non-web temporary directory is required to run the confirmed shortcode.', 500 );
		}
		foreach ( array_filter( $roots ) as $root ) {
			if ( self::path_is_within( $temp_dir, $root ) ) {
				return self::error( 'code_to_block_php_temp_unavailable', 'The PHP temporary directory must be outside every web-served root.', 500 );
			}
		}

		$path = tempnam( $temp_dir, 'ctb_php_' );
		if ( false === $path ) {
			return self::error( 'code_to_block_php_temp_failed', 'The confirmed shortcode could not be prepared.', 500 );
		}
		@chmod( $path, 0600 );
		$source  = self::callback_source( $review['body'] );
		$written = file_put_contents( $path, $source, LOCK_EX );
		if ( strlen( $source ) !== $written ) {
			@unlink( $path );
			return self::error( 'code_to_block_php_temp_write_failed', 'The confirmed shortcode could not be prepared.', 500 );
		}

		$callback = null;
		try {
			$callback = include $path;
		} catch ( Throwable $error ) {
			$callback = self::error( 'code_to_block_php_compile_failed', 'The confirmed shortcode could not be compiled.', 500 );
		} finally {
			if ( file_exists( $path ) ) {
				$cleared = file_put_contents( $path, '', LOCK_EX );
				$removed = @unlink( $path );
				if ( 0 !== $cleared || ! $removed ) {
					$callback = self::error( 'code_to_block_php_temp_cleanup_failed', 'The confirmed shortcode temporary file could not be securely removed.', 500 );
				}
			}
		}

		return is_callable( $callback ) ? $callback : ( is_wp_error( $callback ) ? $callback : self::error( 'code_to_block_php_callback_invalid', 'The confirmed shortcode did not compile to a callback.', 500 ) );
	}

	/**
	 * @param string $body Reviewed PHP body without tags.
	 * @return string
	 */
	private static function callback_source( $body ) {
		return "<?php\n"
			. "if ( ! defined( 'ABSPATH' ) ) { return null; }\n"
			. "return static function ( \$atts, \$content, \$tag ) {\n"
			. "\t\$ctb_buffer_level = ob_get_level();\n"
			. "\tob_start( null, 0, PHP_OUTPUT_HANDLER_CLEANABLE | PHP_OUTPUT_HANDLER_REMOVABLE );\n"
			. "\ttry {\n"
			. "\t\t\$ctb_result = ( static function ( \$atts, \$content, \$tag ) {\n"
			. $body . "\n"
			. "\t\t} )( \$atts, \$content, \$tag );\n"
			. "\t\tif ( ob_get_level() !== \$ctb_buffer_level + 1 ) { throw new \\RuntimeException( 'Shortcode output buffer changed.' ); }\n"
			. "\t\t\$ctb_output = ob_get_clean();\n"
			. "\t} catch ( \\Throwable \$ctb_error ) {\n"
			. "\t\twhile ( ob_get_level() > \$ctb_buffer_level ) { ob_end_clean(); }\n"
			. "\t\tdo_action( 'code_to_block_shortcode_error', \$ctb_error, \$tag );\n"
			. "\t\treturn '';\n"
			. "\t}\n"
			. "\treturn \$ctb_output . ( is_scalar( \$ctb_result ) ? (string) \$ctb_result : '' );\n"
			. "};\n";
	}

	/**
	 * @return string|WP_Error
	 */
	private static function acquire_registry_lock() {
		$token = wp_generate_uuid4();
		if ( add_option( self::LOCK_KEY, array( 'token' => $token, 'created' => time() ), '', false ) ) {
			return $token;
		}
		$existing = get_option( self::LOCK_KEY, array() );
		if ( is_array( $existing ) && isset( $existing['created'] ) && (int) $existing['created'] < time() - 30 ) {
			delete_option( self::LOCK_KEY );
			if ( add_option( self::LOCK_KEY, array( 'token' => $token, 'created' => time() ), '', false ) ) {
				return $token;
			}
		}
		return self::error( 'code_to_block_shortcode_busy', 'Another PHP registration is in progress. Try again.', 409 );
	}

	/**
	 * @param string $token Acquired lock token.
	 */
	private static function release_registry_lock( $token ) {
		$existing = get_option( self::LOCK_KEY, array() );
		if ( is_array( $existing ) && isset( $existing['token'] ) && is_string( $existing['token'] ) && hash_equals( $token, $existing['token'] ) ) {
			delete_option( self::LOCK_KEY );
		}
	}

	/**
	 * @param string       $path   Directory to test.
	 * @param string|false $parent Web root.
	 * @return bool
	 */
	private static function path_is_within( $path, $parent ) {
		if ( ! $parent ) {
			return false;
		}
		$normalize = static function ( $value ) {
			return strtolower( rtrim( str_replace( '\\', '/', $value ), '/' ) );
		};
		$path   = $normalize( $path );
		$parent = $normalize( $parent );
		return $path === $parent || 0 === strpos( $path, $parent . '/' );
	}

	/**
	 * @param string $tag Tag to validate.
	 * @return bool
	 */
	private static function is_valid_tag( $tag ) {
		return is_string( $tag ) && 1 === preg_match( '/^ctb_[a-z0-9_-]{2,60}$/', $tag );
	}

	/**
	 * @param array $review Scanner result.
	 * @return array
	 */
	private static function public_review( $review ) {
		unset( $review['body'] );
		return $review;
	}

	/**
	 * @return WP_Error
	 */
	private static function error( $code, $message, $status = 400 ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}
}
