<?php

define( 'ABSPATH', __DIR__ . '/' );
define( 'CODE_TO_BLOCK_POST_TYPE', 'ctb_page' );

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

$shortcode_test_options = array();
$shortcode_tags         = array( 'core_tag' => 'core_callback' );
$shortcode_test_posts   = array(
	20 => (object) array( 'post_type' => CODE_TO_BLOCK_POST_TYPE, 'post_status' => 'publish' ),
	21 => (object) array( 'post_type' => CODE_TO_BLOCK_POST_TYPE, 'post_status' => 'trash' ),
	22 => (object) array( 'post_type' => CODE_TO_BLOCK_POST_TYPE, 'post_status' => 'publish' ),
	23 => (object) array( 'post_type' => CODE_TO_BLOCK_POST_TYPE, 'post_status' => 'draft' ),
);
$shortcode_test_capabilities = array(
	'manage_options'  => true,
	'unfiltered_html' => true,
	'edit_post'       => true,
);
$shortcode_test_queried_id = 20;
$shortcode_test_uuid       = 0;

function is_wp_error( $value ) {
	return $value instanceof WP_Error;
}

function rest_authorization_required_code() {
	return 403;
}

function current_user_can( $capability ) {
	global $shortcode_test_capabilities;
	return ! empty( $shortcode_test_capabilities[ $capability ] );
}

function is_multisite() {
	return false;
}

function is_super_admin() {
	return true;
}

function get_option( $key, $default = false ) {
	global $shortcode_test_options;
	return array_key_exists( $key, $shortcode_test_options ) ? $shortcode_test_options[ $key ] : $default;
}

function add_option( $key, $value, $deprecated = '', $autoload = true ) {
	global $shortcode_test_options;
	unset( $deprecated, $autoload );
	if ( array_key_exists( $key, $shortcode_test_options ) ) {
		return false;
	}
	$shortcode_test_options[ $key ] = $value;
	return true;
}

function update_option( $key, $value, $autoload = null ) {
	global $shortcode_test_options;
	unset( $autoload );
	$changed = ! array_key_exists( $key, $shortcode_test_options ) || $shortcode_test_options[ $key ] != $value;
	$shortcode_test_options[ $key ] = $value;
	return $changed;
}

function delete_option( $key ) {
	global $shortcode_test_options;
	if ( ! array_key_exists( $key, $shortcode_test_options ) ) {
		return false;
	}
	unset( $shortcode_test_options[ $key ] );
	return true;
}

function wp_generate_uuid4() {
	global $shortcode_test_uuid;
	return 'test-lock-' . ++$shortcode_test_uuid;
}

function get_current_user_id() {
	return 7;
}

function current_time() {
	return '2026-08-20 12:00:00';
}

function shortcode_exists( $tag ) {
	global $shortcode_tags;
	return isset( $shortcode_tags[ $tag ] );
}

function add_shortcode( $tag, $callback ) {
	global $shortcode_tags;
	$shortcode_tags[ $tag ] = $callback;
}

function remove_shortcode( $tag ) {
	global $shortcode_tags;
	unset( $shortcode_tags[ $tag ] );
}

function do_shortcode( $source ) {
	global $shortcode_tags;
	if ( ! preg_match( '/^\[([a-z0-9_-]+)\]$/', $source, $match ) || ! isset( $shortcode_tags[ $match[1] ] ) ) {
		return $source;
	}
	return call_user_func( $shortcode_tags[ $match[1] ], array(), null, $match[1] );
}

function get_post( $post_id ) {
	global $shortcode_test_posts;
	return isset( $shortcode_test_posts[ $post_id ] ) ? $shortcode_test_posts[ $post_id ] : null;
}

function is_post_publicly_viewable( $post ) {
	return $post && 'publish' === $post->post_status;
}

function is_singular( $post_type = '' ) {
	return '' === $post_type || CODE_TO_BLOCK_POST_TYPE === $post_type;
}

function get_queried_object_id() {
	global $shortcode_test_queried_id;
	return $shortcode_test_queried_id;
}

function shortcode_atts( $defaults, $atts ) {
	return array_merge( $defaults, array_intersect_key( $atts, $defaults ) );
}

function esc_html( $value ) {
	return htmlspecialchars( $value, ENT_QUOTES, 'UTF-8' );
}

function wp_upload_dir() {
	return array( 'basedir' => ABSPATH . 'uploads', 'error' => false );
}

function do_action() {
}

require_once dirname( __DIR__ ) . '/includes/class-code-to-block-php-scanner.php';
require_once dirname( __DIR__ ) . '/includes/class-code-to-block-shortcodes.php';

$assertions = 0;

function assert_shortcode( $condition, $message ) {
	global $assertions;
	++$assertions;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

function reviewed_registration( $post_id, $tag, $source ) {
	$review = Code_To_Block_Shortcodes::review_source( $tag, $source );
	if ( is_wp_error( $review ) ) {
		return $review;
	}
	return Code_To_Block_Shortcodes::register_reviewed(
		$post_id,
		$tag,
		$source,
		$review['review']['hash'],
		$review['confirmation_phrase']
	);
}

$safe_source = <<<'PHP'
<?php
$values = shortcode_atts( array( 'message' => 'Safe PHP confirmed.' ), $atts, $tag );
return '<strong class="safe-php">' . esc_html( $values['message'] ) . '</strong>';
?>
PHP;
$review = Code_To_Block_Shortcodes::review_source( 'ctb_php_20_safe', $safe_source );
assert_shortcode( ! is_wp_error( $review ) && 'safe' === $review['review']['status'], 'The safe fixture must receive a non-executing review.' );
assert_shortcode( false !== strpos( $review['confirmation_phrase'], substr( $review['review']['hash'], 0, 12 ) ), 'The typed phrase must bind to the reviewed source hash.' );

$shortcode_test_capabilities['unfiltered_html'] = false;
$unauthorized = Code_To_Block_Shortcodes::register_reviewed( 20, 'ctb_php_20_safe', $safe_source, $review['review']['hash'], $review['confirmation_phrase'] );
assert_shortcode( is_wp_error( $unauthorized ) && 403 === $unauthorized->get_error_data()['status'], 'Storage must repeat authorization outside the REST callback.' );
$shortcode_test_capabilities['unfiltered_html'] = true;

$bad_phrase = Code_To_Block_Shortcodes::register_reviewed( 20, 'ctb_php_20_safe', $safe_source, $review['review']['hash'], 'REGISTER ctb_php_20_safe' );
assert_shortcode( is_wp_error( $bad_phrase ) && 'code_to_block_shortcode_confirmation' === $bad_phrase->get_error_code(), 'Registration must require the exact source-bound phrase.' );
assert_shortcode( array() === get_option( Code_To_Block_Shortcodes::OPTION_KEY, array() ), 'A failed confirmation must not persist source.' );

$changed = Code_To_Block_Shortcodes::register_reviewed( 20, 'ctb_php_20_safe', '<?php return "changed"; ?>', $review['review']['hash'], $review['confirmation_phrase'] );
assert_shortcode( is_wp_error( $changed ) && 409 === $changed->get_error_data()['status'], 'Changed source must require a fresh server review.' );

$blocked_source = '<?php system( "whoami" ); ?>';
$blocked_review = Code_To_Block_Shortcodes::review_source( 'ctb_php_20_blocked', $blocked_source );
$blocked = Code_To_Block_Shortcodes::register_reviewed( 20, 'ctb_php_20_blocked', $blocked_source, $blocked_review['review']['hash'], $blocked_review['confirmation_phrase'] );
assert_shortcode( is_wp_error( $blocked ) && 'code_to_block_php_blocked' === $blocked->get_error_code(), 'Blocked source must fail even after source-bound confirmation.' );

$callback_bypass = '<?php return array_map( "system", array( "id" ) ); ?>';
$warning_review = Code_To_Block_Shortcodes::review_source( 'ctb_php_20_warning', $callback_bypass );
assert_shortcode( 'warning' === $warning_review['review']['status'], 'Unknown callback-taking functions must receive a strong warning.' );
$warning = Code_To_Block_Shortcodes::register_reviewed( 20, 'ctb_php_20_warning', $callback_bypass, $warning_review['review']['hash'], $warning_review['confirmation_phrase'] );
assert_shortcode( is_wp_error( $warning ) && 422 === $warning->get_error_data()['status'], 'Warning and unknown calls must not be registrable.' );

$shortcode_tags['ctb_php_foreign'] = 'other_plugin_callback';
$collision = reviewed_registration( 20, 'ctb_php_foreign', $safe_source );
assert_shortcode( is_wp_error( $collision ) && 409 === $collision->get_error_data()['status'], 'Existing foreign shortcode tags must not be overwritten.' );

$registered = reviewed_registration( 20, 'ctb_php_20_safe', $safe_source );
assert_shortcode( ! is_wp_error( $registered ) && true === $registered['registered'], 'Safe reviewed source must register after exact confirmation.' );
$stored = get_option( Code_To_Block_Shortcodes::OPTION_KEY );
assert_shortcode( $safe_source === $stored['ctb_php_20_safe']['code'], 'Private storage must preserve the exact reviewed source.' );
assert_shortcode( hash( 'sha256', $safe_source ) === $stored['ctb_php_20_safe']['hash'], 'Private storage must bind source to its review hash.' );
assert_shortcode( ! isset( $shortcode_test_options[ Code_To_Block_Shortcodes::LOCK_KEY ] ), 'The registry lock must be released after storage.' );

$other = reviewed_registration( 22, 'ctb_php_22_safe', '<?php return "Other page"; ?>' );
assert_shortcode( ! is_wp_error( $other ), 'A separate page may own its own unique reviewed tag.' );
$draft = reviewed_registration( 23, 'ctb_php_23_safe', '<?php return "Draft"; ?>' );
assert_shortcode( ! is_wp_error( $draft ), 'A draft may store reviewed source without executing it publicly.' );

Code_To_Block_Shortcodes::register_runtime();
assert_shortcode( isset( $shortcode_tags['ctb_php_20_safe'] ), 'The current published page tag must join the temporary WordPress registry.' );
assert_shortcode( ! isset( $shortcode_tags['ctb_php_22_safe'] ), 'Another page tag must not be globally callable.' );
assert_shortcode( ! isset( $shortcode_tags['ctb_php_23_safe'] ), 'A draft-page tag must not be callable.' );
$rendered = Code_To_Block_Shortcodes::render_text( 'Before [ctb_php_20_safe] after', 20 );
assert_shortcode( 'Before <strong class="safe-php">Safe PHP confirmed.</strong> after' === $rendered, 'Only an exact text-node placeholder must execute at its location.' );
assert_shortcode( '' === Code_To_Block_Shortcodes::render( array(), null, 'ctb_php_22_safe' ), 'A callback must fail closed outside its owning page.' );
Code_To_Block_Shortcodes::unregister_for_post( 20 );
assert_shortcode( ! isset( $shortcode_tags['ctb_php_20_safe'] ), 'Page tags must be removed before WordPress global shortcode filtering continues.' );

$buffer_source = '<?php echo "before"; return " after"; ?>';
$buffer_registered = reviewed_registration( 20, 'ctb_php_20_buffer', $buffer_source );
assert_shortcode( ! is_wp_error( $buffer_registered ), 'Reviewed direct output may register.' );
Code_To_Block_Shortcodes::register_for_post( 20 );
ob_start();
echo 'outer:';
$buffer_output = Code_To_Block_Shortcodes::render_text( '[ctb_php_20_buffer]', 20 );
echo ':stable';
$outer_output = ob_get_clean();
assert_shortcode( 'before after' === $buffer_output, 'The runtime must capture direct output at the shortcode location.' );
assert_shortcode( 'outer::stable' === $outer_output, 'The shortcode must not close or flush an outer WordPress buffer.' );

$stored = get_option( Code_To_Block_Shortcodes::OPTION_KEY );
$stored['ctb_php_20_safe']['code'] = '<?php return "tampered"; ?>';
update_option( Code_To_Block_Shortcodes::OPTION_KEY, $stored, false );
assert_shortcode( '' === Code_To_Block_Shortcodes::render( array(), null, 'ctb_php_20_safe' ), 'A source/hash mismatch must fail closed at runtime.' );

$document = array(
	'root' => array(
		'children' => array(
			array( 'kind' => 'text', 'value' => '[ctb_php_20_safe]' ),
		),
	),
);
Code_To_Block_Shortcodes::retain_for_document( 20, $document );
$remaining = get_option( Code_To_Block_Shortcodes::OPTION_KEY );
assert_shortcode( isset( $remaining['ctb_php_20_safe'] ) && ! isset( $remaining['ctb_php_20_buffer'] ), 'Saving must retire page-owned registrations no longer referenced by text nodes.' );

$shortcode_test_options[ Code_To_Block_Shortcodes::LOCK_KEY ] = array( 'token' => 'active', 'created' => time() );
$busy = reviewed_registration( 20, 'ctb_php_20_busy', '<?php return "busy"; ?>' );
assert_shortcode( is_wp_error( $busy ) && 409 === $busy->get_error_data()['status'], 'Concurrent registry mutations must not silently lose writes.' );
unset( $shortcode_test_options[ Code_To_Block_Shortcodes::LOCK_KEY ] );

Code_To_Block_Shortcodes::delete_for_post( 20 );
$remaining = get_option( Code_To_Block_Shortcodes::OPTION_KEY );
assert_shortcode( ! isset( $remaining['ctb_php_20_safe'] ) && isset( $remaining['ctb_php_22_safe'] ), 'Permanent deletion must remove only the owning page registrations.' );

fwrite( STDOUT, "PASS: {$assertions} shortcode registration assertions.\n" );
