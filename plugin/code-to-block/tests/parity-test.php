<?php

define( 'ABSPATH', __DIR__ . '/' );
define( 'CODE_TO_BLOCK_META_KEY', '_ctb_block_tree' );
define( 'CODE_TO_BLOCK_POST_TYPE', 'ctb_page' );
define( 'CODE_TO_BLOCK_COMPONENT_POST_TYPE', 'ctb_component' );
define( 'CODE_TO_BLOCK_COMPONENT_META_KEY', '_ctb_component_tree' );

final class WP_Error {
	private $code; private $message; private $data;
	public function __construct( $code, $message, $data = null ) { $this->code = $code; $this->message = $message; $this->data = $data; }
	public function get_error_code() { return $this->code; }
	public function get_error_message() { return $this->message; }
	public function get_error_data() { return $this->data; }
}
function is_wp_error( $v ) { return $v instanceof WP_Error; }
function wp_json_encode( $v, $f = 0 ) { return json_encode( $v, $f ); }
function current_user_can() { return true; }
function get_post_type( $id ) { return 42 === (int) $id ? CODE_TO_BLOCK_POST_TYPE : 'post'; }
function home_url( $p = '' ) { return 'http://example.test' . $p; }
function trailingslashit( $s ) { return rtrim( $s, '/' ) . '/'; }
function wp_upload_dir() { return array( 'basedir' => sys_get_temp_dir(), 'baseurl' => 'http://example.test/uploads', 'error' => '' ); }
function wp_mkdir_p( $d ) { return true; }
function apply_filters( $tag, $value ) { return $value; }

require_once dirname( __DIR__ ) . '/includes/class-code-to-block-schema.php';
require_once dirname( __DIR__ ) . '/includes/class-code-to-block-components.php';
require_once dirname( __DIR__ ) . '/includes/class-code-to-block-renderer.php';
require_once dirname( __DIR__ ) . '/includes/class-code-to-block-parity.php';

$assertions = 0;
function assert_true( $c, $m ) { global $assertions; ++$assertions; if ( ! $c ) { fwrite( STDERR, "FAIL: $m\n" ); exit( 1 ); } }

function block( $id, $styles = null ) {
	$styles = $styles ?: (object) array( 'mapped' => (object) array( 'color' => 'red' ), 'custom_css_fallback' => '' );
	return (object) array(
		'id' => $id,
		'type' => 'container',
		'tag' => 'div',
		'attributes' => new stdClass(),
		'children' => array(),
		'styles' => $styles,
		'meta' => (object) array( 'source' => 'test' ),
	);
}

$doc = (object) array(
	'schema_version' => 1,
	'name' => 'Parity doc',
	'root' => block( 'root', (object) array( 'mapped' => (object) array( 'color' => 'blue', 'padding' => '12px' ), 'custom_css_fallback' => '' ) ),
);
$doc->root->children = array( block( 'child-1' ), block( 'child-2' ) );

// This snapshot is serialized by the real canvas path, independently of PHP rendering.
$editor_snapshot = array(
	'root' => array( 'base' => 'color:blue !important;padding:12px !important;' ),
	'child-1' => array( 'base' => 'color:red !important;' ),
	'child-2' => array( 'base' => 'color:red !important;' ),
);

// Normal parity should be empty when the editor snapshot and frontend renderer agree.
$warnings = Code_To_Block_Parity::check( json_decode( json_encode( $doc ), true ), 42, $editor_snapshot );
assert_true( 0 === count( $warnings ), 'Parity check passes when editor and frontend agree.' );

// Deliberately break only the editor render path.
$broken_snapshot = $editor_snapshot;
$broken_snapshot['child-1']['base'] = 'color:magenta !important;';
$warnings_broken = Code_To_Block_Parity::check( json_decode( json_encode( $doc ), true ), 42, $broken_snapshot );
assert_true( count( $warnings_broken ) > 0, 'Deliberately mismatched render paths must produce a parity warning.' );
assert_true( 'this block may render differently on the live site' === $warnings_broken[0]['message'], 'Warning message must be the required text.' );
assert_true( 'child-1' === $warnings_broken[0]['block_id'], 'Parity warning identifies the divergent block.' );

// Restoring the canvas snapshot clears the warning.
$warnings_clean = Code_To_Block_Parity::check( json_decode( json_encode( $doc ), true ), 42, $editor_snapshot );
assert_true( 0 === count( $warnings_clean ), 'Parity warning must clear when mismatch is removed.' );

fwrite( STDOUT, "PASS: {$assertions} parity assertions.\n" );
