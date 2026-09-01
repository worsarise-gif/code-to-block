<?php

define( 'ABSPATH', __DIR__ . '/' );
define( 'CODE_TO_BLOCK_PATH', dirname( __DIR__ ) . '/' );
define( 'CODE_TO_BLOCK_META_KEY', '_ctb_block_tree' );
define( 'CODE_TO_BLOCK_POST_TYPE', 'ctb_page' );
define( 'CODE_TO_BLOCK_COMPONENT_POST_TYPE', 'ctb_component' );
define( 'CODE_TO_BLOCK_COMPONENT_META_KEY', '_ctb_component_tree' );

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

function current_user_can() {
	return true;
}

function get_post_type() {
	return CODE_TO_BLOCK_POST_TYPE;
}

require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-registry.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-schema.php';

$assertions = 0;

function check_v3( $condition, $message ) {
	global $assertions;
	++$assertions;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

function clone_v3( $value ) {
	return json_decode( json_encode( $value ) );
}

$document = (object) array(
	'schema_version'   => 3,
	'registry_version' => 1,
	'name'             => 'Server registry fixture',
	'breakpoints'      => (object) array(
		'desktop' => (object) array( 'id' => 'desktop' ),
		'tablet'  => (object) array( 'id' => 'tablet', 'maxWidth' => 768, 'inherits' => 'desktop' ),
		'mobile'  => (object) array( 'id' => 'mobile', 'maxWidth' => 390, 'inherits' => 'tablet' ),
	),
	'root'             => (object) array(
		'id'                 => 'button-server-fixture',
		'element'            => 'core/button',
		'definition_version' => 1,
		'type'               => 'button',
		'tag'                => 'a',
		'props'              => (object) array( 'mode' => 'link', 'iconPosition' => 'after' ),
		'attributes'         => new stdClass(),
		'children'           => array( (object) array( 'kind' => 'text', 'value' => 'Continue' ) ),
		'style'              => (object) array(
			'targets' => (object) array(
				'root' => (object) array(
					'contexts' => (object) array(
						'base'                    => (object) array( 'declarations' => (object) array( 'color' => '#112233' ) ),
						'bp:tablet|state:hover' => (object) array( 'declarations' => (object) array( 'transform' => 'translateY(-2px)' ) ),
					),
				),
			),
		),
		'advanced'           => (object) array(
			'visibility' => (object) array( 'desktop' => true, 'tablet' => true, 'mobile' => false ),
		),
		'meta'               => (object) array( 'source' => 'schema-v3-test' ),
	),
);

$sanitized = Code_To_Block_Schema::sanitize_document( $document );
check_v3( ! is_wp_error( $sanitized ), 'valid schema v3 document must pass server validation' );
check_v3( 3 === $sanitized['schema_version'], 'schema version is preserved' );
check_v3( 1 === $sanitized['registry_version'], 'registry version is preserved' );
check_v3( 'core/button' === $sanitized['root']['element'], 'element identity is preserved' );
check_v3( '#112233' === $sanitized['root']['style']['targets']['root']['contexts']['base']['declarations']->color, 'target declaration is preserved' );
check_v3( false === $sanitized['root']['advanced']['visibility']['mobile'], 'advanced visibility is preserved' );

$unknown_element = clone_v3( $document );
$unknown_element->root->element = 'core/missing';
check_v3( is_wp_error( Code_To_Block_Schema::sanitize_document( $unknown_element ) ), 'unknown element is rejected' );

$unknown_prop = clone_v3( $document );
$unknown_prop->root->props->notRegistered = 'value';
check_v3( is_wp_error( Code_To_Block_Schema::sanitize_document( $unknown_prop ) ), 'unknown semantic prop is rejected' );

$unknown_target = clone_v3( $document );
$unknown_target->root->style->targets->notRegistered = (object) array( 'contexts' => new stdClass() );
check_v3( is_wp_error( Code_To_Block_Schema::sanitize_document( $unknown_target ) ), 'unknown style target is rejected' );

$wrong_tag = clone_v3( $document );
$wrong_tag->root->tag = 'video';
check_v3( is_wp_error( Code_To_Block_Schema::sanitize_document( $wrong_tag ) ), 'tag outside the element contract is rejected' );

$unsafe_css = clone_v3( $document );
$unsafe_css->root->style->targets->root->contexts->base->declarations->background = 'url(javascript:alert(1))';
check_v3( is_wp_error( Code_To_Block_Schema::sanitize_document( $unsafe_css ) ), 'unsafe v3 declaration is rejected' );

$wrong_registry = clone_v3( $document );
$wrong_registry->registry_version = 2;
check_v3( is_wp_error( Code_To_Block_Schema::sanitize_document( $wrong_registry ) ), 'stale registry version is rejected' );

fwrite( STDOUT, "PASS: {$assertions} server schema v3 assertions.\n" );
