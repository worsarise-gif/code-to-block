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
						'base'                    => (object) array(
							'declarations'        => (object) array( 'color' => '#112233' ),
							'custom_declarations' => 'letter-spacing: .1em;',
							'origin_notes'        => (object) array( 'source' => 'import', 'declarations' => array( 'color' ) ),
						),
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
check_v3( Code_To_Block_Registry::has_capability( 'core/button', 'buttonAction' ), 'server registry exposes element capability grants' );
check_v3( ! Code_To_Block_Registry::has_capability( 'core/button', 'image' ), 'server capability checks reject ungranted behavior' );
check_v3( in_array( 'typography', Code_To_Block_Registry::target_style_groups( 'core/button', 'label' ), true ), 'server registry exposes target-specific shared packs' );
check_v3( ! in_array( 'icon', Code_To_Block_Registry::target_style_groups( 'core/button', 'label' ), true ), 'server target grants exclude irrelevant packs' );
check_v3( 3 === $sanitized['schema_version'], 'schema version is preserved' );
check_v3( 1 === $sanitized['registry_version'], 'registry version is preserved' );
check_v3( 'core/button' === $sanitized['root']['element'], 'element identity is preserved' );
check_v3( '#112233' === $sanitized['root']['style']['targets']['root']['contexts']['base']['declarations']->color, 'target declaration is preserved' );
check_v3( 'letter-spacing: .1em;' === $sanitized['root']['style']['targets']['root']['contexts']['base']['custom_declarations'], 'target custom declarations survive server sanitation' );
check_v3( 'import' === $sanitized['root']['style']['targets']['root']['contexts']['base']['origin_notes']['source'], 'target origin metadata survives server sanitation' );
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

$form_field_document = clone_v3( $document );
$form_field_document->root->id = 'field-server-fixture';
$form_field_document->root->element = 'forms/field-group';
$form_field_document->root->type = 'form_field';
$form_field_document->root->tag = 'div';
$form_field_document->root->props = (object) array(
	'fieldType'  => 'email',
	'label'      => 'Email',
	'name'       => 'email',
	'placeholder' => 'you@example.com',
	'help'       => 'Reply address',
	'options'    => array(),
	'required'   => true,
);
$form_field_document->root->attributes = new stdClass();
$form_field_document->root->children = array();
$form_field_document->root->style->targets = (object) array(
	'placeholder'  => (object) array(
		'contexts' => (object) array(
			'state:focusVisible' => (object) array( 'declarations' => (object) array( 'color' => '#556677' ) ),
		),
	),
	'requiredMark' => (object) array(
		'contexts' => (object) array(
			'base' => (object) array( 'declarations' => (object) array( 'color' => '#aa0000' ) ),
		),
	),
);
$sanitized_form_field = Code_To_Block_Schema::sanitize_document( $form_field_document );
check_v3( ! is_wp_error( $sanitized_form_field ), 'Form Field props and renderer-backed targets pass server validation' );
check_v3( 'you@example.com' === $sanitized_form_field['root']['props']['placeholder'], 'Form Field semantic placeholder survives server sanitation' );
check_v3( Code_To_Block_Registry::target_is_allowed( 'forms/field-group', 'requiredMark' ), 'server registry exposes the required mark target' );
check_v3( '[data-ctb-part="row"] [data-ctb-part="control"]::placeholder' === Code_To_Block_Registry::target_selector( 'forms/field-group', 'placeholder' ), 'server registry exposes the real control placeholder selector' );

fwrite( STDOUT, "PASS: {$assertions} server schema v3 assertions.\n" );
