<?php

define( 'ABSPATH', __DIR__ . '/' );
define( 'CODE_TO_BLOCK_PATH', dirname( __DIR__ ) . '/' );
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

	public function get_error_message() {
		return $this->message;
	}

	public function get_error_data() {
		return $this->data;
	}
}

final class Code_To_Block_Forms {
	public static function create_submission_token( $post_id, $form_id, $timestamp ) {
		unset( $post_id, $form_id, $timestamp );
		return 'a1-deterministic-token';
	}
}

final class Code_To_Block_Shortcodes {
	public static function register_for_post( $post_id ) {
		unset( $post_id );
	}

	public static function unregister_for_post( $post_id ) {
		unset( $post_id );
	}

	public static function render_text( $value, $post_id ) {
		unset( $post_id );
		return esc_html( $value );
	}
}

final class Code_To_Block_Commerce {
	public static function variation_selector( $product ) {
		unset( $product );
		return '';
	}
}

final class Code_To_Block_Components {
	const FAILURE_MESSAGE = 'Component unavailable.';
}

function is_wp_error( $value ) {
	return $value instanceof WP_Error;
}

function wp_json_encode( $value, $flags = 0 ) {
	return json_encode( $value, $flags );
}

function sanitize_text_field( $value ) {
	return trim( strip_tags( $value ) );
}

function esc_html( $value ) {
	return htmlspecialchars( $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
}

function esc_attr( $value ) {
	return htmlspecialchars( $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
}

function esc_url( $value ) {
	return preg_match( '/^javascript:/i', trim( $value ) ) ? '' : esc_attr( $value );
}

function home_url() {
	return 'https://example.test';
}

function rest_url( $path ) {
	return 'https://example.test/wp-json/' . ltrim( $path, '/' );
}

function trailingslashit( $value ) {
	return rtrim( $value, '/\\' ) . '/';
}

function get_option( $key, $default = false ) {
	return 'admin_email' === $key ? 'admin@example.test' : $default;
}

function get_post_type( $post_id ) {
	unset( $post_id );
	return CODE_TO_BLOCK_POST_TYPE;
}

function is_user_logged_in() {
	return false;
}

function wp_get_current_user() {
	return (object) array( 'roles' => array() );
}

require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-registry.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-schema.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-renderer.php';

$assertions = 0;
function assert_a1_fixture( $condition, $message ) {
	global $assertions;
	++$assertions;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

function a1_is_list( $value ) {
	return array_keys( $value ) === range( 0, count( $value ) - 1 );
}

function a1_canonicalize( $value ) {
	if ( is_object( $value ) ) {
		$value = get_object_vars( $value );
	}
	if ( ! is_array( $value ) ) {
		return $value;
	}
	if ( ! a1_is_list( $value ) ) {
		ksort( $value, SORT_STRING );
	}
	foreach ( $value as $key => $item ) {
		$value[ $key ] = a1_canonicalize( $item );
	}
	return $value;
}

function a1_canonical_json( $value ) {
	return json_encode( a1_canonicalize( $value ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
}

function a1_normalize_output( $value ) {
	$value = str_replace( "\r\n", "\n", $value );
	return preg_replace(
		'/name="_ctb_timestamp" value="\d+"/',
		'name="_ctb_timestamp" value="<TIMESTAMP>"',
		$value
	);
}

function a1_walk_blocks( $block, &$metadata, $parent_type = '' ) {
	++$metadata['block_count'];
	$type = isset( $block['type'] ) ? $block['type'] : '';
	if ( ! isset( $metadata['type_counts'][ $type ] ) ) {
		$metadata['type_counts'][ $type ] = 0;
	}
	++$metadata['type_counts'][ $type ];
	if ( 'form' === $parent_type && 'form' === $type ) {
		++$metadata['nested_form_pairs'];
	}
	foreach ( isset( $block['children'] ) ? $block['children'] : array() as $child ) {
		if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
			a1_walk_blocks( $child, $metadata, $type );
		}
	}
}

function a1_collect_editor_styles( $block, &$snapshot ) {
	$contexts = array( 'base' => isset( $block['styles'] ) ? $block['styles'] : array() );
	$states = isset( $block['states'] ) ? (array) $block['states'] : array();
	foreach ( array( 'hover', 'focus', 'active' ) as $state ) {
		if ( isset( $states[ $state ] ) ) {
			$contexts[ $state ] = $states[ $state ];
		}
	}
	$responsive = isset( $block['responsive_overrides'] ) ? (array) $block['responsive_overrides'] : array();
	foreach ( array( 'tablet', 'mobile' ) as $breakpoint ) {
		if ( isset( $responsive[ $breakpoint ] ) ) {
			$contexts[ $breakpoint ] = $responsive[ $breakpoint ];
		}
	}
	$snapshot[ $block['id'] ] = $contexts;
	foreach ( isset( $block['children'] ) ? $block['children'] : array() as $child ) {
		if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
			a1_collect_editor_styles( $child, $snapshot );
		}
	}
}

$fixture_directory = __DIR__ . '/fixtures/migrations';
$fixture_names     = array( 'compat-v2.fixture.json', 'legacy-v1.fixture.json' );
$snapshot_path     = $fixture_directory . '/migration-snapshots.json';
$results           = array();

foreach ( $fixture_names as $fixture_index => $fixture_name ) {
	$fixture_path = $fixture_directory . '/' . $fixture_name;
	$source       = file_get_contents( $fixture_path );
	$source_hash  = hash( 'sha256', $source );
	$decoded      = json_decode( $source, true );
	assert_a1_fixture( JSON_ERROR_NONE === json_last_error(), $fixture_name . ' must decode.' );

	// Sanitization operates on the decoded copy. The checked-in source remains evidence.
	$sanitized = Code_To_Block_Schema::sanitize_document( $decoded );
	assert_a1_fixture(
		! is_wp_error( $sanitized ),
		$fixture_name . ' must pass the current legacy schema: ' . ( is_wp_error( $sanitized ) ? $sanitized->get_error_message() : '' )
	);

	$metadata = array(
		'schema_version'   => $decoded['schema_version'],
		'block_count'      => 0,
		'type_counts'      => array(),
		'nested_form_pairs'=> 0,
	);
	a1_walk_blocks( $sanitized['root'], $metadata );
	ksort( $metadata['type_counts'], SORT_STRING );
	assert_a1_fixture(
		$metadata['nested_form_pairs'] > 0,
		$fixture_name . ' documents the known baseline discrepancy: current v1/v2 schema accepts nested forms while the v3 JS registry rejects them.'
	);
	$metadata['nested_form_discrepancy'] = 'legacy-schema-accepts-registry-rejects';
	$metadata['imported_stylesheets'] = isset( $sanitized['imported_assets']['stylesheets'] ) ? count( $sanitized['imported_assets']['stylesheets'] ) : 0;

	$post_id       = 7100 + $fixture_index;
	$html          = a1_normalize_output( Code_To_Block_Renderer::render_document( $sanitized, $post_id ) );
	$css           = a1_normalize_output( Code_To_Block_Renderer::generate_css( $sanitized, $post_id ) );
	$frontend_style_snapshot = Code_To_Block_Renderer::style_snapshot( $sanitized );
	$editor_style_snapshot   = array();
	a1_collect_editor_styles( $sanitized['root'], $editor_style_snapshot );
	assert_a1_fixture( substr_count( $html, '<form' ) >= 2, $fixture_name . ' renderer baseline exposes accepted nested form markup.' );
	if ( 2 === $decoded['schema_version'] ) {
		assert_a1_fixture( false !== strpos( $css, '.import-card::before' ), 'Imported pseudo CSS must survive frontend generation.' );
		assert_a1_fixture( false !== strpos( $css, '@media (max-width:700px)' ), 'Imported media CSS must survive frontend generation.' );
	}

	$results[ $fixture_name ] = array(
		'source_sha256'          => $source_hash,
		'sanitized_sha256'       => hash( 'sha256', a1_canonical_json( $sanitized ) ),
		'frontend_html_sha256'   => hash( 'sha256', $html ),
		'frontend_css_sha256'    => hash( 'sha256', $css ),
		'editor_style_snapshot_sha256'   => hash( 'sha256', a1_canonical_json( $editor_style_snapshot ) ),
		'frontend_style_snapshot_sha256' => hash( 'sha256', a1_canonical_json( $frontend_style_snapshot ) ),
		'metadata'               => $metadata,
	);
	assert_a1_fixture( $source_hash === hash_file( 'sha256', $fixture_path ), $fixture_name . ' source must remain byte-identical after sanitize/render.' );
}

$results = a1_canonicalize( $results );
if ( in_array( '--print', $argv, true ) ) {
	echo json_encode( $results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "\n";
} elseif ( in_array( '--hash', $argv, true ) ) {
	echo hash( 'sha256', a1_canonical_json( $results ) ) . "\n";
} else {
	$expected = json_decode( file_get_contents( $snapshot_path ), true );
	assert_a1_fixture( JSON_ERROR_NONE === json_last_error(), 'Migration snapshot manifest must decode.' );
	assert_a1_fixture( $expected === $results, 'Migration fixture snapshots changed; inspect --print output and update intentionally.' );
	fwrite( STDOUT, "PASS: {$assertions} migration fixture assertions. Legacy nested-form acceptance is recorded as a baseline gap.\n" );
}
