<?php

define( 'ABSPATH', __DIR__ . '/' );

final class WP_Error {
	private $code;
	private $message;
	private $data;

	public function __construct( $code, $message, $data = null ) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = $data;
	}

	public function get_error_code() {
		return $this->code;
	}

	public function get_error_message() {
		return $this->message;
	}

	public function get_error_data() {
		return $this->data;
	}
}

function is_wp_error( $value ) {
	return $value instanceof WP_Error;
}

require_once dirname( __DIR__ ) . '/includes/class-code-to-block-php-scanner.php';

$assertions = 0;

function assert_php_scan( $condition, $message ) {
	global $assertions;
	++$assertions;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

$safe_source = <<<'PHP'
<?php
$values = shortcode_atts( array( 'message' => 'Safe PHP confirmed.' ), $atts, $tag );
return '<strong class="safe-php">' . esc_html( $values['message'] ) . '</strong>';
?>
PHP;
$safe = Code_To_Block_PHP_Scanner::scan( $safe_source );
assert_php_scan( ! is_wp_error( $safe ), 'The safe walkthrough fixture must parse.' );
assert_php_scan( 'safe' === $safe['status'], 'Reviewed escaping and shortcode helpers must pass as safe.' );
assert_php_scan( array( 'shortcode_atts', 'esc_html' ) === $safe['functions'], 'The scanner must list calls in source order.' );
assert_php_scan( false !== strpos( $safe['description'], 'Returns a value' ), 'The description must explain returned output.' );
assert_php_scan( false !== strpos( $safe['description'], 'attributes' ), 'The description must explain shortcode inputs.' );
assert_php_scan( hash( 'sha256', $safe_source ) === $safe['hash'], 'The review hash must bind to the full source.' );
assert_php_scan( false === strpos( $safe['body'], '<?php' ) && false === strpos( $safe['body'], '?>' ), 'The extracted body must omit PHP tags.' );

$echo = Code_To_Block_PHP_Scanner::scan( '<?php echo esc_html( $content ); ?>' );
assert_php_scan( 'safe' === $echo['status'], 'Escaped direct output must pass.' );
assert_php_scan( false !== strpos( $echo['description'], 'Prints output directly' ), 'The description must identify direct output.' );
assert_php_scan( false !== strpos( $echo['description'], 'enclosed content' ), 'The description must identify enclosed content.' );

$unknown = Code_To_Block_PHP_Scanner::scan( '<?php return site_specific_helper( $atts ); ?>' );
assert_php_scan( 'warning' === $unknown['status'], 'Unknown calls must receive a strong warning.' );
assert_php_scan( 1 === count( $unknown['warnings'] ), 'Unknown calls must produce a visible reason.' );

$encoded = Code_To_Block_PHP_Scanner::scan( '<?php return base64_decode( "U2FmZQ==" ); ?>' );
assert_php_scan( 'warning' === $encoded['status'], 'Standalone obfuscation helpers must be strongly warned.' );
assert_php_scan( false !== strpos( $encoded['warnings'][0], 'conceal' ), 'Obfuscation warnings must explain the concern.' );

$blocked_sources = array(
	'<?php eval( base64_decode( $atts["payload"] ) ); ?>'           => 'eval',
	'<?php SyStEm ( "whoami" ); ?>'                               => 'system',
	'<?php \\exec( "whoami" ); ?>'                               => 'exec',
	'<?php shell_exec( "whoami" ); ?>'                            => 'shell execution',
	'<?php include "/tmp/payload.php"; ?>'                        => 'file inclusion',
	'<?php $callback = "esc_html"; return $callback( "x" ); ?>'  => 'variable functions',
	'<?php return ( "esc_" . "html" )( "x" ); ?>'               => 'constructed dynamic callables',
	'<?php for ( $i = 0; $i < 2; ++$i ) { echo $i; } ?>'           => 'loops',
	'<?php return $_GET["message"]; ?>'                            => 'request superglobals',
	'<?php return $wpdb->get_var( "SELECT 1" ); ?>'                => 'database globals and object calls',
	'<?php file_put_contents( "/tmp/output", "x" ); ?>'          => 'filesystem writes',
	'<?php wp_remote_get( "https://example.com" ); ?>'            => 'outbound requests',
	'<?php update_option( "siteurl", "https://bad.test" ); ?>'    => 'persistent option changes',
	'<?php wp_set_password( "new-password", 1 ); ?>'              => 'password changes',
	'<?php ob_get_clean(); ?>'                                     => 'output-buffer control',
	'<?php `whoami`; ?>'                                            => 'backtick shell execution',
);

foreach ( $blocked_sources as $source => $label ) {
	$result = Code_To_Block_PHP_Scanner::scan( $source );
	assert_php_scan( ! is_wp_error( $result ), $label . ' fixture must be syntactically reviewable.' );
	assert_php_scan( 'blocked' === $result['status'], $label . ' must be blocked.' );
	assert_php_scan( ! empty( $result['blocked_reasons'] ), $label . ' must have a visible reason.' );
}

$invalid = Code_To_Block_PHP_Scanner::scan( '<?php if ( ?>' );
assert_php_scan( is_wp_error( $invalid ) && 'code_to_block_php_syntax' === $invalid->get_error_code(), 'Invalid syntax must fail before review.' );
$incomplete = Code_To_Block_PHP_Scanner::scan( '<?php return "x";' );
assert_php_scan( is_wp_error( $incomplete ) && 'code_to_block_php_incomplete' === $incomplete->get_error_code(), 'An unclosed PHP block must be rejected.' );
$mixed = Code_To_Block_PHP_Scanner::scan( '<p>before</p><?php return "x"; ?>' );
assert_php_scan( is_wp_error( $mixed ), 'Surrounding HTML must not be reviewed as PHP.' );
$multiple = Code_To_Block_PHP_Scanner::scan( '<?php echo "one"; ?><?php echo "two"; ?>' );
assert_php_scan( is_wp_error( $multiple ), 'Multiple PHP blocks must be reviewed separately.' );
$oversized = Code_To_Block_PHP_Scanner::scan( '<?php /*' . str_repeat( 'x', Code_To_Block_PHP_Scanner::MAX_CODE_BYTES ) . '*/ ?>' );
assert_php_scan( is_wp_error( $oversized ) && 413 === $oversized->get_error_data()['status'], 'Oversized PHP must be rejected before tokenization.' );

fwrite( STDOUT, "PASS: {$assertions} PHP scanner assertions.\n" );
