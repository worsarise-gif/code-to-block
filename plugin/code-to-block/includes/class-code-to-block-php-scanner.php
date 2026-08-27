<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Performs a deliberately narrow static review of one pasted PHP block.
 */
final class Code_To_Block_PHP_Scanner {
	const MAX_CODE_BYTES = 131072;

	/**
	 * Functions that must never reach the shortcode runtime.
	 *
	 * This is not a complete malware detector. It is a denylist in front of an
	 * administrator-only, explicit code-execution feature.
	 *
	 * @var array<string,string>
	 */
	private static $blocked_functions = array(
		'add_action'                 => 'changes global WordPress hook behavior',
		'add_filter'                 => 'changes global WordPress hook behavior',
		'add_shortcode'              => 'registers additional executable shortcode behavior',
		'assert'                     => 'can evaluate or terminate code',
		'call_user_func'              => 'can invoke a dynamically selected callback',
		'call_user_func_array'        => 'can invoke a dynamically selected callback',
		'create_function'             => 'creates executable code dynamically',
		'exec'                        => 'executes an operating-system command',
		'passthru'                    => 'executes an operating-system command',
		'pcntl_exec'                  => 'replaces the current process with another program',
		'popen'                       => 'opens a process pipe',
		'proc_open'                   => 'starts an external process',
		'shell_exec'                  => 'executes an operating-system command',
		'system'                      => 'executes an operating-system command',
		'curl_exec'                   => 'makes an outbound network request',
		'fsockopen'                   => 'opens a network connection',
		'pfsockopen'                  => 'opens a persistent network connection',
		'socket_create'               => 'opens a low-level network socket',
		'socket_connect'              => 'opens a low-level network connection',
		'socket_send'                 => 'writes to a low-level network socket',
		'stream_socket_client'        => 'opens a network connection',
		'wp_remote_get'               => 'makes an outbound network request',
		'wp_remote_post'              => 'makes an outbound network request',
		'wp_remote_request'           => 'makes an outbound network request',
		'error_log'                   => 'writes data to a server log or destination',
		'file'                        => 'reads arbitrary filesystem data',
		'file_get_contents'           => 'reads arbitrary filesystem or network data',
		'chmod'                       => 'changes filesystem permissions',
		'chown'                       => 'changes filesystem ownership',
		'copy'                        => 'writes a filesystem entry',
		'file_put_contents'           => 'writes to the filesystem',
		'fopen'                       => 'opens a filesystem or stream resource',
		'fwrite'                      => 'writes to a filesystem or stream resource',
		'glob'                        => 'lists arbitrary filesystem paths',
		'mkdir'                       => 'creates a filesystem directory',
		'move_uploaded_file'          => 'moves an uploaded file',
		'opendir'                     => 'opens an arbitrary filesystem directory',
		'parse_ini_file'              => 'reads arbitrary filesystem configuration',
		'phpinfo'                     => 'exposes server configuration',
		'readdir'                     => 'reads arbitrary filesystem directory entries',
		'readfile'                    => 'reads and prints arbitrary filesystem data',
		'rename'                      => 'moves a filesystem entry',
		'rmdir'                       => 'removes a filesystem directory',
		'touch'                       => 'creates or modifies a filesystem entry',
		'unlink'                      => 'deletes a filesystem entry',
		'define'                      => 'changes global PHP constants',
		'do_action'                   => 'invokes global WordPress hooks',
		'register_post_type'          => 'changes global WordPress content registration',
		'remove_action'               => 'changes global WordPress hook behavior',
		'remove_all_actions'          => 'changes global WordPress hook behavior',
		'remove_all_filters'          => 'changes global WordPress hook behavior',
		'remove_filter'               => 'changes global WordPress hook behavior',
		'add_option'                  => 'changes persistent WordPress options',
		'delete_option'               => 'changes persistent WordPress options',
		'update_option'               => 'changes persistent WordPress options',
		'delete_transient'            => 'changes persistent WordPress transient data',
		'set_site_transient'          => 'changes persistent WordPress transient data',
		'set_transient'               => 'changes persistent WordPress transient data',
		'delete_post_meta'            => 'changes persistent WordPress content metadata',
		'delete_user_meta'            => 'changes persistent WordPress user metadata',
		'update_post_meta'            => 'changes persistent WordPress content metadata',
		'update_user_meta'            => 'changes persistent WordPress user metadata',
		'wp_delete_post'              => 'deletes WordPress content',
		'wp_insert_post'              => 'changes WordPress content',
		'wp_update_post'              => 'changes WordPress content',
		'wp_create_user'              => 'creates a WordPress user',
		'wp_delete_user'              => 'deletes a WordPress user',
		'wp_insert_user'              => 'changes a WordPress user',
		'wp_update_user'              => 'changes a WordPress user',
		'wp_set_password'             => 'changes a WordPress user password',
		'mail'                        => 'sends email from the server',
		'mysqli_query'                => 'executes a database query',
		'pg_query'                    => 'executes a database query',
		'wp_mail'                     => 'sends email from the server',
		'header'                      => 'changes HTTP response headers',
		'ini_set'                     => 'changes PHP runtime configuration',
		'putenv'                      => 'changes process environment variables',
		'register_shutdown_function'  => 'registers a callback outside shortcode execution',
		'set_error_handler'           => 'changes global PHP error handling',
		'set_exception_handler'       => 'changes global PHP exception handling',
		'set_time_limit'              => 'changes the request execution limit',
		'setcookie'                   => 'changes HTTP response cookies',
		'setrawcookie'                => 'changes HTTP response cookies',
		'session_start'               => 'changes request session state',
		'sleep'                       => 'intentionally delays the request',
		'usleep'                      => 'intentionally delays the request',
		'wp_redirect'                 => 'redirects the HTTP response',
		'wp_safe_redirect'            => 'redirects the HTTP response',
		'wp_schedule_event'           => 'registers persistent scheduled execution',
		'ob_clean'                    => 'changes the shortcode output buffer',
		'ob_end_clean'                => 'changes the shortcode output buffer',
		'ob_end_flush'                => 'changes the shortcode output buffer',
		'ob_flush'                    => 'changes the shortcode output buffer',
		'ob_get_clean'                => 'changes the shortcode output buffer',
		'ob_get_flush'                => 'changes the shortcode output buffer',
		'ob_implicit_flush'           => 'changes the shortcode output buffer',
		'ob_start'                    => 'changes the shortcode output buffer',
		'flush'                       => 'flushes buffered output outside the shortcode',
		'unserialize'                 => 'constructs values from serialized input',
	);

	/**
	 * Obfuscation helpers are conspicuous but can have legitimate uses.
	 *
	 * @var array<string,string>
	 */
	private static $warning_functions = array(
		'base64_decode' => 'decodes Base64 data and is commonly used to conceal executable payloads',
		'gzinflate'     => 'decompresses data and is commonly used to conceal executable payloads',
		'gzuncompress'  => 'decompresses data and is commonly used to conceal executable payloads',
		'str_rot13'     => 'transforms text and can be used to conceal executable payloads',
	);

	/**
	 * Calls understood well enough to avoid an unknown-function warning.
	 *
	 * @var string[]
	 */
	private static $reviewed_functions = array(
		'abs',
		'esc_attr',
		'esc_html',
		'esc_textarea',
		'esc_url',
		'htmlspecialchars',
		'implode',
		'is_array',
		'is_bool',
		'is_numeric',
		'is_scalar',
		'is_string',
		'max',
		'min',
		'number_format',
		'shortcode_atts',
		'sprintf',
		'str_replace',
		'strlen',
		'strtolower',
		'strtoupper',
		'substr',
		'trim',
		'ucfirst',
		'ucwords',
		'wp_kses',
		'wp_kses_post',
	);

	/**
	 * Reviews one complete <?php ... ?> block without executing it.
	 *
	 * @param mixed $code Source submitted by the editor.
	 * @return array|WP_Error
	 */
	public static function scan( $code ) {
		if ( ! is_string( $code ) || '' === trim( $code ) ) {
			return self::error( 'code_to_block_php_missing', 'A complete PHP block is required.' );
		}
		if ( strlen( $code ) > self::MAX_CODE_BYTES ) {
			return self::error( 'code_to_block_php_too_large', 'PHP blocks cannot exceed 128 KiB.', 413 );
		}
		if ( ! preg_match( '/^\s*<\?php\b/i', $code ) || ! preg_match( '/\?>\s*$/', $code ) ) {
			return self::error( 'code_to_block_php_incomplete', 'The review requires one complete <?php ... ?> block.' );
		}

		try {
			$tokens = token_get_all( $code, TOKEN_PARSE );
		} catch ( Throwable $error ) {
			return self::error( 'code_to_block_php_syntax', 'PHP syntax check failed: ' . $error->getMessage() );
		}

		$open_tags   = 0;
		$close_tags  = 0;
		$body        = '';
		$inside_body = false;
		foreach ( $tokens as $token ) {
			if ( is_array( $token ) && T_OPEN_TAG === $token[0] ) {
				++$open_tags;
				$inside_body = true;
				continue;
			}
			if ( is_array( $token ) && T_CLOSE_TAG === $token[0] ) {
				++$close_tags;
				$inside_body = false;
				continue;
			}
			if ( is_array( $token ) && T_INLINE_HTML === $token[0] && '' !== trim( $token[1] ) ) {
				return self::error( 'code_to_block_php_mixed_source', 'PHP review blocks cannot contain surrounding HTML.' );
			}
			if ( $inside_body ) {
				$body .= is_array( $token ) ? $token[1] : $token;
			}
		}
		if ( 1 !== $open_tags || 1 !== $close_tags ) {
			return self::error( 'code_to_block_php_multiple', 'Review one complete PHP block at a time.' );
		}

		$blocked       = array();
		$warnings      = array();
		$functions     = array();
		$uses_atts     = false;
		$uses_content  = false;
		$uses_tag      = false;
		$prints_output = false;
		$returns_value = false;
		$significant   = self::significant_tokens( $tokens );

		foreach ( $significant as $index => $token ) {
			$id   = is_array( $token ) ? $token[0] : null;
			$text = is_array( $token ) ? $token[1] : $token;

			if ( is_array( $token ) ) {
				if ( T_VARIABLE === $id ) {
					$variable = strtolower( $text );
					$uses_atts = $uses_atts || '$atts' === $variable;
					$uses_content = $uses_content || '$content' === $variable;
					$uses_tag = $uses_tag || '$tag' === $variable;
					if ( in_array( $variable, array( '$globals', '$_cookie', '$_env', '$_files', '$_get', '$_post', '$_request', '$_server', '$_session', '$wpdb' ), true ) ) {
						$blocked[] = 'Access to ' . $text . ' is not allowed in registered snippets.';
					}
				}
				if ( T_ECHO === $id || T_PRINT === $id ) {
					$prints_output = true;
				}
				if ( T_RETURN === $id ) {
					$returns_value = true;
				}

				$construct_reason = self::blocked_construct_reason( $id );
				if ( $construct_reason ) {
					$blocked[] = $construct_reason;
				}

				$name = self::function_name( $token );
				if ( $name && isset( $significant[ $index + 1 ] ) && '(' === $significant[ $index + 1 ] ) {
					$previous_id = $index > 0 && is_array( $significant[ $index - 1 ] ) ? $significant[ $index - 1 ][0] : null;
					if ( ! in_array( $previous_id, self::member_operator_tokens(), true ) ) {
						$functions[] = $name;
						if ( isset( self::$blocked_functions[ $name ] ) ) {
							$blocked[] = $name . '() ' . self::$blocked_functions[ $name ] . '.';
						} elseif ( isset( self::$warning_functions[ $name ] ) ) {
							$warnings[] = $name . '() ' . self::$warning_functions[ $name ] . '.';
						} elseif ( ! in_array( $name, self::$reviewed_functions, true ) ) {
							$warnings[] = $name . '() is not on the scanner\'s narrow reviewed-function list.';
						}
					}
				}
			}

			if ( '`' === $text ) {
				$blocked[] = 'Backtick shell execution is not allowed.';
			}
			if ( '(' === $text && $index > 0 ) {
				$previous = $significant[ $index - 1 ];
				$previous_id = is_array( $previous ) ? $previous[0] : null;
				$previous_text = is_array( $previous ) ? $previous[1] : $previous;
				if ( T_VARIABLE === $previous_id || in_array( $previous_text, array( ')', ']', '}' ), true ) || self::is_string_token( $previous_id ) ) {
					$blocked[] = 'Dynamic callable invocation is not allowed.';
				}
			}
		}

		$blocked   = array_values( array_unique( $blocked ) );
		$warnings  = array_values( array_unique( $warnings ) );
		$functions = array_values( array_unique( $functions ) );
		$description = self::describe( $prints_output, $returns_value, $uses_atts, $uses_content, $uses_tag, $functions );

		return array(
			'status'          => $blocked ? 'blocked' : ( $warnings ? 'warning' : 'safe' ),
			'description'     => $description,
			'blocked_reasons' => $blocked,
			'warnings'        => $warnings,
			'functions'       => $functions,
			'code'            => $code,
			'body'            => $body,
			'hash'            => hash( 'sha256', $code ),
		);
	}

	/**
	 * @param array $tokens PHP tokens.
	 * @return array
	 */
	private static function significant_tokens( $tokens ) {
		return array_values(
			array_filter(
				$tokens,
				static function ( $token ) {
					return ! is_array( $token ) || ! in_array( $token[0], array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT, T_OPEN_TAG, T_CLOSE_TAG, T_INLINE_HTML ), true );
				}
			)
		);
	}

	/**
	 * @param int $token_id Token identifier.
	 * @return string
	 */
	private static function blocked_construct_reason( $token_id ) {
		$reasons = array(
			T_EVAL         => 'eval is not allowed.',
			T_EXIT         => 'exit and die are not allowed.',
			T_INCLUDE      => 'File inclusion is not allowed.',
			T_INCLUDE_ONCE => 'File inclusion is not allowed.',
			T_REQUIRE      => 'File inclusion is not allowed.',
			T_REQUIRE_ONCE => 'File inclusion is not allowed.',
			T_NEW          => 'Object construction is not allowed.',
			T_FUNCTION     => 'Function and closure declarations are not allowed.',
			T_CLASS        => 'Class declarations are not allowed.',
			T_INTERFACE    => 'Interface declarations are not allowed.',
			T_TRAIT        => 'Trait declarations are not allowed.',
			T_NAMESPACE    => 'Namespace declarations are not allowed.',
			T_USE          => 'Namespace imports and closure captures are not allowed.',
			T_GLOBAL       => 'Global-variable access is not allowed.',
			T_FOR          => 'Loops are not allowed in registered snippets.',
			T_FOREACH      => 'Loops are not allowed in registered snippets.',
			T_WHILE        => 'Loops are not allowed in registered snippets.',
			T_DO           => 'Loops are not allowed in registered snippets.',
			T_GOTO         => 'goto is not allowed.',
			T_DECLARE      => 'declare is not allowed.',
			T_HALT_COMPILER => '__halt_compiler is not allowed.',
		);
		if ( defined( 'T_FN' ) ) {
			$reasons[ constant( 'T_FN' ) ] = 'Arrow-function declarations are not allowed.';
		}
		if ( defined( 'T_OBJECT_OPERATOR' ) ) {
			$reasons[ constant( 'T_OBJECT_OPERATOR' ) ] = 'Object method and property access is not allowed.';
		}
		if ( defined( 'T_NULLSAFE_OBJECT_OPERATOR' ) ) {
			$reasons[ constant( 'T_NULLSAFE_OBJECT_OPERATOR' ) ] = 'Object method and property access is not allowed.';
		}
		if ( defined( 'T_DOUBLE_COLON' ) ) {
			$reasons[ constant( 'T_DOUBLE_COLON' ) ] = 'Static method and property access is not allowed.';
		}

		return isset( $reasons[ $token_id ] ) ? $reasons[ $token_id ] : '';
	}

	/**
	 * @return int[]
	 */
	private static function member_operator_tokens() {
		$tokens = array();
		foreach ( array( 'T_OBJECT_OPERATOR', 'T_NULLSAFE_OBJECT_OPERATOR', 'T_DOUBLE_COLON' ) as $name ) {
			if ( defined( $name ) ) {
				$tokens[] = constant( $name );
			}
		}
		return $tokens;
	}

	/**
	 * @param array $token Token array.
	 * @return string
	 */
	private static function function_name( $token ) {
		$name_tokens = array( T_STRING );
		foreach ( array( 'T_NAME_FULLY_QUALIFIED', 'T_NAME_QUALIFIED', 'T_NAME_RELATIVE' ) as $name ) {
			if ( defined( $name ) ) {
				$name_tokens[] = constant( $name );
			}
		}
		if ( ! in_array( $token[0], $name_tokens, true ) ) {
			return '';
		}

		$parts = preg_split( '/\\\\/', strtolower( $token[1] ) );
		return (string) end( $parts );
	}

	/**
	 * @param int|null $token_id Token identifier.
	 * @return bool
	 */
	private static function is_string_token( $token_id ) {
		return in_array( $token_id, array( T_CONSTANT_ENCAPSED_STRING, T_ENCAPSED_AND_WHITESPACE ), true );
	}

	/**
	 * @return string
	 */
	private static function describe( $prints, $returns, $uses_atts, $uses_content, $uses_tag, $functions ) {
		$sentences = array();
		if ( $prints && $returns ) {
			$sentences[] = 'Prints output directly and may also return a value as shortcode output.';
		} elseif ( $prints ) {
			$sentences[] = 'Prints output directly for the shortcode.';
		} elseif ( $returns ) {
			$sentences[] = 'Returns a value as shortcode output.';
		} else {
			$sentences[] = 'Does not contain an obvious echo, print, or return statement.';
		}

		$inputs = array();
		if ( $uses_atts ) {
			$inputs[] = 'attributes';
		}
		if ( $uses_content ) {
			$inputs[] = 'enclosed content';
		}
		if ( $uses_tag ) {
			$inputs[] = 'the shortcode tag';
		}
		if ( $inputs ) {
			$sentences[] = 'Reads ' . self::human_list( $inputs ) . '.';
		}
		if ( $functions ) {
			$formatted = array_map(
				static function ( $function ) {
					return $function . '()';
				},
				$functions
			);
			$sentences[] = 'Calls ' . self::human_list( $formatted ) . '.';
		}

		return implode( ' ', $sentences );
	}

	/**
	 * @param string[] $values Values to join.
	 * @return string
	 */
	private static function human_list( $values ) {
		if ( 1 === count( $values ) ) {
			return $values[0];
		}
		$last = array_pop( $values );
		return implode( ', ', $values ) . ' and ' . $last;
	}

	/**
	 * @return WP_Error
	 */
	private static function error( $code, $message, $status = 400 ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}
}
