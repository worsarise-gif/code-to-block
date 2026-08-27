<?php

define( 'ABSPATH', __DIR__ . '/' );
define( 'CODE_TO_BLOCK_META_KEY', '_ctb_block_tree' );
define( 'CODE_TO_BLOCK_POST_TYPE', 'ctb_page' );
define( 'CODE_TO_BLOCK_COMPONENT_POST_TYPE', 'ctb_component' );
define( 'CODE_TO_BLOCK_COMPONENT_META_KEY', '_ctb_component_tree' );

final class WP_Error {
	private $code;
	private $message;
	private $data;
	public function __construct( $code, $message, $data = null ) { $this->code = $code; $this->message = $message; $this->data = $data; }
	public function get_error_code() { return $this->code; }
	public function get_error_message() { return $this->message; }
	public function get_error_data() { return $this->data; }
}
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function wp_json_encode( $value, $flags = 0 ) { return json_encode( $value, $flags ); }
function current_user_can() { return true; }
function get_post_type( $post_id ) { return 42 === (int) $post_id ? CODE_TO_BLOCK_POST_TYPE : 'post'; }

require_once dirname( __DIR__ ) . '/includes/class-code-to-block-schema.php';

$assertions = 0;
function assert_true( $condition, $message ) {
	global $assertions;
	++$assertions;
	if ( ! $condition ) { fwrite( STDERR, "FAIL: {$message}\n" ); exit( 1 ); }
}

function starter_block( $id, $tag = 'div', $children = array() ) {
	return (object) array(
		'id' => $id,
		'type' => 'container',
		'tag' => $tag,
		'attributes' => new stdClass(),
		'children' => $children,
		'styles' => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
		'meta' => (object) array( 'source' => 'starter-template' ),
	);
}

// Mirror the JS starter shape minimally: each starter must validate as a document.
$hero = (object) array(
	'schema_version' => 1,
	'name' => 'Hero landing',
	'root' => (object) array(
		'id' => 'starter-hero-root',
		'type' => 'container',
		'tag' => 'section',
		'attributes' => (object) array( 'class' => 'starter-hero' ),
		'children' => array(
			(object) array(
				'id' => 'starter-hero-content',
				'type' => 'container',
				'tag' => 'div',
				'attributes' => new stdClass(),
				'children' => array(
					(object) array(
						'id' => 'starter-hero-heading',
						'type' => 'text',
						'tag' => 'h1',
						'attributes' => new stdClass(),
						'children' => array( (object) array( 'kind' => 'text', 'value' => 'Launch your next idea' ) ),
						'styles' => (object) array( 'mapped' => (object) array( 'color' => 'white' ), 'custom_css_fallback' => '' ),
						'meta' => (object) array( 'source' => 'starter-template' ),
					),
				),
				'styles' => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
				'meta' => (object) array( 'source' => 'starter-template' ),
			),
		),
		'styles' => (object) array( 'mapped' => (object) array( 'padding' => '48px 24px' ), 'custom_css_fallback' => '' ),
		'meta' => (object) array( 'source' => 'starter-template' ),
	),
);

$pricing = (object) array(
	'schema_version' => 1,
	'name' => 'Pricing starter',
	'root' => starter_block( 'starter-pricing-root', 'article', array(
		(object) array(
			'id' => 'starter-pricing-plan',
			'type' => 'text',
			'tag' => 'h2',
			'attributes' => new stdClass(),
			'children' => array( (object) array( 'kind' => 'text', 'value' => 'Professional' ) ),
			'styles' => (object) array( 'mapped' => (object) array( 'color' => '#253047' ), 'custom_css_fallback' => '' ),
			'meta' => (object) array( 'source' => 'starter-template' ),
		),
	) ),
);

$testimonial = (object) array(
	'schema_version' => 1,
	'name' => 'Testimonial starter',
	'root' => starter_block( 'starter-testimonial-root', 'figure', array(
		(object) array(
			'id' => 'starter-testimonial-quote',
			'type' => 'text',
			'tag' => 'blockquote',
			'attributes' => new stdClass(),
			'children' => array( (object) array( 'kind' => 'text', 'value' => '“The team shipped in days.”' ) ),
			'styles' => (object) array( 'mapped' => (object) array( 'color' => '#18181b' ), 'custom_css_fallback' => '' ),
			'meta' => (object) array( 'source' => 'starter-template' ),
		),
	) ),
);

$footer = (object) array(
	'schema_version' => 1,
	'name' => 'Footer starter',
	'root' => starter_block( 'starter-footer-root', 'footer', array(
		starter_block( 'starter-footer-col-1' ),
		starter_block( 'starter-footer-col-2' ),
		starter_block( 'starter-footer-col-3' ),
	) ),
);

$starters = array( $hero, $pricing, $testimonial, $footer );
assert_true( count( $starters ) >= 3 && count( $starters ) <= 5, 'Starter library has 3 to 5 templates.' );

foreach ( $starters as $starter ) {
	$sanitized = Code_To_Block_Schema::sanitize_document( $starter );
	assert_true( ! is_wp_error( $sanitized ), $starter->name . ' must validate.' );
	assert_true( 'starter-template' === $sanitized['root']['meta']['source'], $starter->name . ' must retain starter source.' );
}

fwrite( STDOUT, "PASS: {$assertions} starter-template assertions.\n" );
