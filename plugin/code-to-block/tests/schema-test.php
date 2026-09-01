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

function wp_json_encode( $value, $flags = 0 ) {
	return json_encode( $value, $flags );
}

function sanitize_text_field( $value ) {
	return trim( strip_tags( $value ) );
}

function current_user_can() {
	return true;
}

function get_post_type( $post_id ) {
	return 42 === (int) $post_id ? CODE_TO_BLOCK_POST_TYPE : 'post';
}

require_once dirname( __DIR__ ) . '/includes/class-code-to-block-schema.php';

$assertions = 0;

function assert_true( $condition, $message ) {
	global $assertions;
	++$assertions;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

function json_value( $value ) {
	return json_decode( json_encode( $value ) );
}

$fixtures_path = dirname( __DIR__, 3 ) . '/block-examples.json';
$fixtures      = json_decode( file_get_contents( $fixtures_path ) );
assert_true( JSON_ERROR_NONE === json_last_error(), 'Fixture JSON must decode.' );
assert_true( 5 === count( $fixtures ), 'All five Phase 1 fixtures must be tested.' );

foreach ( $fixtures as $fixture ) {
	$sanitized = Code_To_Block_Schema::sanitize_document( $fixture );
	assert_true( ! is_wp_error( $sanitized ), $fixture->name . ' must validate.' );
	assert_true(
		json_value( $fixture ) == json_value( $sanitized ),
		$fixture->name . ' must round-trip without a value or shape change.'
	);
}

$hero_json = Code_To_Block_Schema::sanitize_meta_value( json_encode( $fixtures[1] ) );
assert_true( '' !== $hero_json, 'The hero must sanitize as registered meta.' );
$stored_hero = json_decode( $hero_json );
assert_true(
	$fixtures[1]->root->styles->mapped->{'background-image'} === $stored_hero->root->styles->mapped->{'background-image'},
	'The layered hero background must be preserved exactly.'
);
assert_true( is_object( $stored_hero->root->attributes ), 'Empty attribute maps must remain JSON objects.' );

$with_unknowns                         = json_value( $fixtures[0] );
$with_unknowns->unexpected             = 'remove me';
$with_unknowns->root->unexpected       = 'remove me';
$with_unknowns->root->attributes->onclick = 'alert(1)';
$cleaned                               = Code_To_Block_Schema::sanitize_document( $with_unknowns );
assert_true( ! isset( $cleaned['unexpected'] ), 'Unknown document fields must be stripped.' );
assert_true( ! isset( $cleaned['root']['unexpected'] ), 'Unknown block fields must be stripped.' );
assert_true( ! isset( $cleaned['root']['attributes']->onclick ), 'Event-handler attributes must be stripped.' );

$invalid             = json_value( $fixtures[0] );
$invalid->root->type = 'composite';
$error               = Code_To_Block_Schema::sanitize_document( $invalid );
assert_true( is_wp_error( $error ), 'Unsupported block types must be rejected.' );
assert_true(
	'$.root.type' === $error->get_error_data()['path'],
	'Validation errors must identify the failing schema path.'
);

$invalid_tag            = json_value( $fixtures[0] );
$invalid_tag->root->tag = 'script';
$tag_error               = Code_To_Block_Schema::sanitize_document( $invalid_tag );
assert_true( is_wp_error( $tag_error ), 'Scriptable HTML tags must be rejected.' );
assert_true( '$.root.tag' === $tag_error->get_error_data()['path'], 'Invalid tags must report their schema path.' );

$unsafe_css                                       = json_value( $fixtures[0] );
$unsafe_css->root->styles->mapped->color          = 'red}body{display:none';
$unsafe_css_error                                 = Code_To_Block_Schema::sanitize_document( $unsafe_css );
assert_true( is_wp_error( $unsafe_css_error ), 'CSS values that escape their scoped rule must be rejected.' );

$duplicate_id                                  = json_value( $fixtures[0] );
$duplicate_id->root->children[0]->id           = $duplicate_id->root->id;
$duplicate_id_error                            = Code_To_Block_Schema::sanitize_document( $duplicate_id );
assert_true( is_wp_error( $duplicate_id_error ), 'Block IDs must be unique within a document.' );

$void_children                         = json_value( $fixtures[2] );
$void_children->root->children[0]->children = array( (object) array( 'kind' => 'text', 'value' => 'invalid' ) );
$void_children_error                   = Code_To_Block_Schema::sanitize_document( $void_children );
assert_true( is_wp_error( $void_children_error ), 'Void HTML elements must reject children.' );

$filtered_attributes                          = json_value( $fixtures[0] );
$filtered_attributes->root->attributes->style = 'display:none';
$filtered_attributes->root->attributes->onclick = 'alert(1)';
$filtered_attributes->root->attributes->{'data-safe'} = 'yes';
$filtered = Code_To_Block_Schema::sanitize_document( $filtered_attributes );
assert_true( ! isset( $filtered['root']['attributes']->style ), 'Inline style attributes must be stripped.' );
assert_true( ! isset( $filtered['root']['attributes']->onclick ), 'Event attributes must be stripped.' );
assert_true( 'yes' === $filtered['root']['attributes']->{'data-safe'}, 'Safe data attributes must be preserved.' );

$expanded_mapping = json_value( $fixtures[0] );
$expanded_mapping->root->styles->mapped->display = 'grid';
$expanded_mapping->root->meta->css_mapping = (object) array(
	'version'      => 1,
	'declarations' => array(
		(object) array(
			'property'    => 'display',
			'value'       => 'grid',
			'important'   => false,
			'origin'      => 'stylesheet',
			'destination' => 'style-control',
			'control'     => 'display',
		),
	),
);
$expanded_mapping_result = Code_To_Block_Schema::sanitize_document( $expanded_mapping );
assert_true( ! is_wp_error( $expanded_mapping_result ), 'Expanded File 9 mapped controls must survive server validation.' );

$optional                                      = json_value( $fixtures[0] );
$optional->root->responsive_overrides          = new stdClass();
$optional->root->responsive_overrides->mobile  = (object) array(
	'mapped'              => (object) array( 'padding' => '12px' ),
	'custom_css_fallback' => '',
);
$optional->root->states                        = new stdClass();
$optional->root->states->hover                 = (object) array(
	'mapped'              => (object) array( 'color' => 'rebeccapurple' ),
	'custom_css_fallback' => '',
);
$optional->root->states->active                = (object) array(
	'mapped'              => (object) array( 'transform' => 'translateY(1px)' ),
	'custom_css_fallback' => '',
);
$optional->root->visibility_conditions         = (object) array(
	'login' => 'logged_in',
	'roles' => array( 'editor', 'administrator' ),
);
$optional->root->permissions                   = (object) array(
	'role'        => 'editor',
	'can_edit'    => false,
	'can_delete'  => false,
	'can_publish' => false,
	'locked'      => true,
);
$optional->root->performance                   = (object) array(
	'lazy_load'       => true,
	'image_lazy_load' => true,
);
$optional->history = array(
	(object) array(
		'id'        => 'history-test-1',
		'action'    => 'Text edited',
		'timestamp' => '2026-08-27T12:00:00.000Z',
		'block_id'  => $optional->root->id,
	),
);
$optional->root->actions                       = array(
	(object) array(
		'trigger'  => 'click',
		'behavior' => 'navigate',
		'params'   => (object) array(
			'url'     => '/pricing',
			'options' => (object) array( 'newTab' => false ),
			'tags'    => array( 'primary', 'sales' ),
		),
	),
);
$optional_sanitized = Code_To_Block_Schema::sanitize_document( $optional );
assert_true( ! is_wp_error( $optional_sanitized ), 'Optional schema branches must validate.' );
assert_true(
	json_value( $optional ) == json_value( $optional_sanitized ),
	'Responsive overrides, states, and action params must round-trip unchanged.'
);
assert_true( isset( $optional_sanitized['root']['states']->active ), 'Active state styles must survive validation.' );
assert_true( true === $optional_sanitized['root']['permissions']['locked'], 'Element locks must survive validation.' );
assert_true( 'logged_in' === $optional_sanitized['root']['visibility_conditions']['login'], 'Login conditions must survive validation.' );
assert_true( 1 === count( $optional_sanitized['history'] ), 'Persistent history must survive validation.' );

$explained = json_value( $fixtures[0] );
$explained->root->meta->css_mapping = (object) array(
	'version' => 1,
	'declarations' => array(
		(object) array(
			'property' => 'padding',
			'value' => '24px',
			'important' => false,
			'origin' => 'stylesheet',
			'destination' => 'style-control',
			'control' => 'padding',
			'unknown' => 'remove me',
		),
		(object) array(
			'property' => 'display',
			'value' => 'grid',
			'important' => true,
			'origin' => 'inline',
			'destination' => 'raw-css',
		),
	),
);
$explained_sanitized = Code_To_Block_Schema::sanitize_document( $explained );
assert_true( ! is_wp_error( $explained_sanitized ), 'CSS mapping provenance must validate.' );
assert_true( 2 === count( $explained_sanitized['root']['meta']['css_mapping']['declarations'] ), 'Every resolved declaration must round-trip.' );
assert_true( ! isset( $explained_sanitized['root']['meta']['css_mapping']['declarations'][0]['unknown'] ), 'Unknown CSS mapping fields must be stripped.' );

$imported = json_value( $fixtures[0] );
$imported->schema_version = 2;
$imported->root->tag = 'div';
$imported->root->attributes->{'data-ctb-original-tag'} = 'my-widget';
$imported->root->meta->imported_original_tag = 'my-widget';
$imported->imported_assets = (object) array(
	'origin' => (object) array(
		'type' => 'code-import',
		'import_session_id' => 'code-import-abc123',
		'source_hash' => 'abc123',
	),
	'page_meta' => (object) array(
		'document_type' => 'full-document',
		'source_type' => 'full-document',
		'detected_languages' => array( 'html', 'css', 'javascript', 'php' ),
		'doctype' => 'html',
		'title' => 'Imported page',
		'base_href' => 'https://example.test/assets/',
		'html_attributes' => (object) array( 'lang' => 'en' ),
		'body_attributes' => (object) array( 'class' => 'imported-body' ),
		'metas' => array( (object) array( 'name' => 'viewport', 'content' => 'width=device-width' ) ),
		'links' => array( (object) array( 'rel' => 'stylesheet', 'href' => 'https://cdn.example.test/page.css' ) ),
	),
	'stylesheets' => array(
		(object) array(
			'id' => 'import-style-abc123-1',
			'source_text' => 'body{margin:0}',
			'scoped_source' => '.ctb-import-scope{margin:0}',
			'selectors' => array( 'body' ),
			'media_conditions' => array(),
			'keyframes' => array(),
			'custom_properties' => array(),
		),
	),
	'token_bindings' => new stdClass(),
	'scripts' => array(
		(object) array(
			'id' => 'import-script-abc123-1',
			'placement' => 'body-end',
			'type' => 'module',
			'source' => '',
			'src' => 'https://cdn.example.test/app.js',
			'attributes' => (object) array( 'defer' => '', 'integrity' => 'sha384-YWJj', 'onclick' => 'blocked()' ),
			'enabled_in_editor' => true,
			'enabled_in_preview' => true,
			'enabled_on_publish' => false,
			'origin' => 'imported',
		),
	),
	'references' => array( (object) array( 'type' => 'css.import', 'value' => 'https://cdn.example.test/page.css', 'external' => true, 'blocked' => true ) ),
	'diagnostics' => array( (object) array( 'severity' => 'warning', 'code' => 'PHP_REVIEW_REQUIRED', 'message' => 'PHP requires review.', 'source' => 'php' ) ),
);
$imported_sanitized = Code_To_Block_Schema::sanitize_document( $imported );
assert_true( ! is_wp_error( $imported_sanitized ), 'Context-aware imported page packages must survive schema validation.' );
assert_true( 'full-document' === $imported_sanitized['imported_assets']['page_meta']['source_type'], 'Detected source type must round-trip.' );
assert_true( array( 'html', 'css', 'javascript', 'php' ) === $imported_sanitized['imported_assets']['page_meta']['detected_languages'], 'Detected languages must round-trip.' );
assert_true( false === $imported_sanitized['imported_assets']['scripts'][0]['enabled_in_editor'], 'The server must force imported scripts off in editor mode.' );
assert_true( ! isset( $imported_sanitized['imported_assets']['scripts'][0]['attributes']->onclick ), 'Event-handler script attributes must be removed.' );
assert_true( 'my-widget' === $imported_sanitized['root']['meta']['imported_original_tag'], 'Normalized custom-element provenance must round-trip.' );
$disabled_imported = Code_To_Block_Schema::disable_imported_script_execution( $imported_sanitized );
assert_true( false === $disabled_imported['imported_assets']['scripts'][0]['enabled_in_preview'], 'Accounts without unfiltered_html must not execute imported scripts in Preview.' );
assert_true( false === $disabled_imported['imported_assets']['scripts'][0]['enabled_on_publish'], 'Accounts without unfiltered_html must not execute imported scripts after publish.' );

$unsafe_explanation = json_value( $explained );
$unsafe_explanation->root->meta->css_mapping->declarations[0]->value = 'red}body{display:none';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $unsafe_explanation ) ), 'Unsafe explanation values must be rejected.' );
$mismatched_control = json_value( $explained );
$mismatched_control->root->meta->css_mapping->declarations[0]->control = 'margin';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $mismatched_control ) ), 'Mapped explanations must name the matching control.' );
$invalid_origin = json_value( $explained );
$invalid_origin->root->meta->css_mapping->declarations[0]->origin = 'guessed';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $invalid_origin ) ), 'CSS mapping origins must use the fixed provenance set.' );

$token_document = json_value( $fixtures[0] );
$token_document->design_tokens = (object) array(
	'colors' => (object) array(
		'brand' => (object) array( 'label' => 'Brand', 'value' => '#6558d3' ),
	),
	'typography' => (object) array(
		'heading-size' => (object) array( 'label' => 'Heading size', 'value' => '44px' ),
	),
	'spacing' => (object) array(
		'section' => (object) array( 'label' => 'Section', 'value' => '48px' ),
	),
);
$token_document->root->children[0]->styles->mapped->color = 'var(--ctb-token-colors-brand)';
$token_document->root->children[0]->styles->token_bindings = (object) array( 'color' => 'colors.brand' );
$token_document->root->children[1]->styles->mapped->color = '#222222';
$token_document->root->children[1]->styles->token_bindings = (object) array( 'color' => 'colors.brand' );
$token_document->root->responsive_overrides = (object) array(
	'tablet' => (object) array(
		'mapped' => (object) array( 'padding' => 'var(--ctb-token-spacing-section)' ),
		'custom_css_fallback' => '',
		'token_bindings' => (object) array( 'padding' => 'spacing.section' ),
	),
);
$token_sanitized = Code_To_Block_Schema::sanitize_document( $token_document );
assert_true( ! is_wp_error( $token_sanitized ), 'Document tokens and linked style sets must validate.' );
assert_true( json_value( $token_document ) == json_value( $token_sanitized ), 'Token definitions, references, and local overrides must round-trip unchanged.' );
assert_true( '--ctb-token-colors-brand' === Code_To_Block_Schema::design_token_css_name( 'colors.brand' ), 'Token references need deterministic CSS custom-property names.' );

$unsafe_token = json_value( $token_document );
$unsafe_token->design_tokens->colors->brand->value = 'red}body{display:none';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $unsafe_token ) ), 'Unsafe token values must be rejected.' );
$dangling_token = json_value( $token_document );
$dangling_token->root->children[0]->styles->token_bindings->color = 'colors.missing';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $dangling_token ) ), 'Token bindings must reference definitions in the same document.' );
$incompatible_token = json_value( $token_document );
$incompatible_token->root->children[0]->styles->token_bindings->color = 'spacing.section';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $incompatible_token ) ), 'Token bindings must use a category compatible with their CSS property.' );
$missing_token_value = json_value( $token_document );
unset( $missing_token_value->root->children[0]->styles->mapped->color );
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $missing_token_value ) ), 'Every token binding must have a mapped value to render.' );
$invalid_token_id = json_value( $token_document );
$invalid_token_id->design_tokens->colors->{'9-brand'} = $invalid_token_id->design_tokens->colors->brand;
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $invalid_token_id ) ), 'Token IDs must be safe stable slugs.' );

$guided_document = json_value( $fixtures[0] );
$guided_document->schema_version = 2;
$guided_document->feature_flags = (object) array( 'guided_roles' => true );
$guided_document->design_tokens = (object) array(
	'typography' => (object) array(
		'font-body' => (object) array( 'label' => 'Body font', 'value' => 'system-ui, sans-serif', 'built_in' => true ),
		'size-body' => (object) array( 'label' => 'Body size', 'value' => '1rem', 'built_in' => true ),
		'weight-regular' => (object) array( 'label' => 'Regular', 'value' => '400', 'built_in' => true ),
		'leading-body' => (object) array( 'label' => 'Body leading', 'value' => '1.6', 'built_in' => true ),
		'tracking-normal' => (object) array( 'label' => 'Normal tracking', 'value' => '0', 'built_in' => true ),
	),
);
$guided_document->style_roles = (object) array(
	'type.body' => (object) array(
		'id' => 'type.body',
		'kind' => 'typography',
		'labelKey' => 'type.body',
		'descriptionKey' => 'type.body',
		'propertyTokenRefs' => (object) array(
			'font-family' => 'typography.font-body',
			'font-size' => 'typography.size-body',
			'font-weight' => 'typography.weight-regular',
			'line-height' => 'typography.leading-body',
			'letter-spacing' => 'typography.tracking-normal',
		),
		'variants' => (object) array(
			'default' => (object) array( 'font-size' => 'typography.size-body' ),
		),
		'densityVariants' => (object) array(
			'default' => (object) array( 'line-height' => 'typography.leading-body' ),
		),
		'supportedContexts' => array( 'paragraph' ),
		'builtIn' => true,
		'version' => 1,
	),
);
$guided_target = $guided_document->root->children[0];
$guided_target->styles->mapped = (object) array(
	'font-family' => 'var(--ctb-token-typography-font-body)',
	'font-size' => 'var(--ctb-token-typography-size-body)',
	'font-weight' => 'var(--ctb-token-typography-weight-regular)',
	'line-height' => 'var(--ctb-token-typography-leading-body)',
	'letter-spacing' => 'var(--ctb-token-typography-tracking-normal)',
);
$guided_target->styles->token_bindings = (object) array(
	'font-family' => 'typography.font-body',
	'font-size' => 'typography.size-body',
	'font-weight' => 'typography.weight-regular',
	'line-height' => 'typography.leading-body',
	'letter-spacing' => 'typography.tracking-normal',
);
$guided_target->styles->role_bindings = (object) array(
	'typography' => (object) array(
		'roleId' => 'type.body',
		'kind' => 'typography',
		'typographyAdjustment' => (object) array( 'size' => 0, 'density' => 0 ),
		'overrides' => array(),
		'source' => 'built-in',
	),
);
$guided_sanitized = Code_To_Block_Schema::sanitize_document( $guided_document );
assert_true( ! is_wp_error( $guided_sanitized ), 'Version 2 guided-role documents must validate.' );
assert_true( json_value( $guided_document ) == json_value( $guided_sanitized ), 'Guided role recipes, bindings, tokens, and feature flags must round-trip unchanged.' );
$missing_guided_role = json_value( $guided_document );
$missing_guided_role->root->children[0]->styles->role_bindings->typography->roleId = 'type.missing';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $missing_guided_role ) ), 'Role bindings must reference a role in the same document.' );
$slot_value_document = json_value( $fixtures[0] );
$slot_value_document->slot_values = (object) array( 'instance-slot-id' => 'Page-local component content' );
$slot_value_sanitized = Code_To_Block_Schema::sanitize_document( $slot_value_document );
assert_true( 'Page-local component content' === $slot_value_sanitized['slot_values']['instance-slot-id'], 'Page-local component slot values must round-trip through the schema.' );

$runtime_action = json_value( $fixtures[0] );
$runtime_action->root->children[3]->actions = array(
	(object) array(
		'trigger'        => 'click',
		'behavior'       => 'toggle-visibility',
		'animation_type' => 'js_library',
		'params'         => (object) array( 'target_block_id' => $runtime_action->root->id ),
	),
);
$runtime_sanitized = Code_To_Block_Schema::sanitize_document( $runtime_action );
assert_true( ! is_wp_error( $runtime_sanitized ), 'Allowlisted click actions must validate.' );
assert_true(
	'js_library' === $runtime_sanitized['root']['children'][3]['actions'][0]['animation_type'],
	'Runtime action normalization must preserve conditional asset classification.'
);
assert_true(
	'toggle-visibility' === $runtime_sanitized['root']['children'][3]['actions'][0]['behavior'],
	'Executable actions must survive canonicalization.'
);

$bad_runtime = json_value( $runtime_action );
$bad_runtime->root->children[3]->actions[0]->behavior = 'toggle-class';
$bad_runtime->root->children[3]->actions[0]->params->class_name = 'bad class';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $bad_runtime ) ), 'Executable class actions must reject unsafe class tokens.' );
$bad_runtime->root->children[3]->actions[0]->params->class_name = 'is-open';
$bad_runtime->root->children[3]->actions[0]->params->target_block_id = 'missing-block';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $bad_runtime ) ), 'Executable actions must target a block in the same document.' );

$gsap_action = json_value( $fixtures[0] );
$gsap_target = $gsap_action->root->children[3];
$gsap_target->actions = array(
	(object) array(
		'trigger'        => 'scroll',
		'behavior'       => 'scroll-scrub',
		'animation_type' => 'js_library',
		'params'         => (object) array(
			'target_block_id' => $gsap_target->id,
			'start'           => 'top center',
			'end'             => '+=500',
			'scrub'           => 0.5,
			'from_y'          => 80,
			'to_y'            => 0,
		),
	),
);
$gsap_sanitized = Code_To_Block_Schema::sanitize_document( $gsap_action );
assert_true( ! is_wp_error( $gsap_sanitized ), 'Constrained scroll-scrub actions must validate.' );
assert_true( Code_To_Block_Schema::document_needs_gsap( $gsap_sanitized ), 'A real GSAP action must trigger conditional bundle loading.' );
assert_true( 0.5 === $gsap_sanitized['root']['children'][3]['actions'][0]['params']['scrub'], 'GSAP numeric controls must survive canonicalization.' );
assert_true( 1 === $gsap_sanitized['root']['children'][3]['actions'][0]['params']['to_opacity'], 'GSAP actions must receive safe defaults for omitted controls.' );
$bad_gsap = json_value( $gsap_action );
$bad_gsap->root->children[3]->actions[0]->params->target_block_id = 'missing-block';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $bad_gsap ) ), 'GSAP actions must target a block in the same document.' );
$bad_gsap = json_value( $gsap_action );
$bad_gsap->root->children[3]->actions[0]->animation_type = 'css_native';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $bad_gsap ) ), 'GSAP behaviors must retain js_library classification.' );
$stagger_action = json_value( $fixtures[0] );
$stagger_target = $stagger_action->root;
$stagger_target->actions = array(
	(object) array(
		'trigger'        => 'scroll',
		'behavior'       => 'stagger-sequence',
		'animation_type' => 'js_library',
		'params'         => (object) array(
			'target_block_id' => $stagger_target->id,
			'start'           => 'top 85%',
			'duration'        => 0.7,
			'stagger'         => 0.15,
		),
	),
);
$stagger_sanitized = Code_To_Block_Schema::sanitize_document( $stagger_action );
assert_true( ! is_wp_error( $stagger_sanitized ), 'Constrained stagger-sequence actions must validate.' );
assert_true( 0.15 === $stagger_sanitized['root']['actions'][0]['params']['stagger'], 'Stagger timing controls must survive canonicalization.' );
$css_action = json_value( $fixtures[0] );
$css_target = $css_action->root->children[3];
$css_target->actions = array(
	(object) array(
		'trigger'        => 'load',
		'behavior'       => 'css-reveal',
		'animation_type' => 'css_native',
		'params'         => (object) array(
			'target_block_id' => $css_target->id,
			'duration'        => 0.8,
			'delay'           => 0.1,
			'from_y'          => 24,
		),
	),
);
$css_sanitized = Code_To_Block_Schema::sanitize_document( $css_action );
assert_true( ! is_wp_error( $css_sanitized ), 'Pure-CSS reveal actions must validate without a JS-library classification.' );
assert_true( ! Code_To_Block_Schema::document_needs_gsap( $css_sanitized ), 'CSS-native actions must not trigger GSAP loading.' );
assert_true( 0.8 === $css_sanitized['root']['children'][3]['actions'][0]['params']['duration'], 'CSS reveal controls must survive canonicalization.' );

$component_page = json_value( $fixtures[0] );
$component_page->root->children[] = (object) array(
	'id'         => 'component-instance',
	'type'       => 'container',
	'tag'        => 'div',
	'attributes' => (object) array( 'class' => 'ctb-saved-component' ),
	'children'   => array(),
	'styles'     => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
	'meta'       => (object) array( 'source' => 'saved-component', 'saved_component_id' => 30 ),
);
$component_page_sanitized = Code_To_Block_Schema::sanitize_document( $component_page );
assert_true( ! is_wp_error( $component_page_sanitized ), 'Linked component placeholders must validate as empty containers.' );
assert_true( 30 === $component_page_sanitized['root']['children'][4]['meta']['saved_component_id'], 'Component IDs must survive canonicalization.' );
$nested_component_error = Code_To_Block_Schema::sanitize_component_document( $component_page );
assert_true( is_wp_error( $nested_component_error ), 'Saved components cannot recursively contain linked components.' );
$component_with_mapping = json_value( $component_page );
$component_with_mapping->root->children[4]->meta->css_mapping = $explained->root->meta->css_mapping;
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $component_with_mapping ) ), 'Linked placeholders cannot claim CSS mapping stored inside their component.' );
$php_component = json_value( $fixtures[0] );
$php_component->root->children[0]->children[0]->value = '[ctb_php_25_reserved]';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_component_document( $php_component ) ), 'Saved components must reject page-bound PHP placeholders that cannot execute cross-page.' );
$custom_php_component = json_value( $fixtures[0] );
$custom_php_component->root->children[0]->children[0]->value = '[ctb_custom]';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_component_document( $custom_php_component ) ), 'Every reserved ctb_ shortcode placeholder must be rejected from cross-page components.' );
$component_dom_limit = json_value( $fixtures[0] );
$component_dom_limit->root->attributes->id = 'component-target';
$component_dom_limit->root->children[0]->tag = 'label';
$component_dom_limit->root->children[0]->attributes->for = implode( ' ', array_fill( 0, 1001, 'component-target' ) );
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_component_document( $component_dom_limit ) ), 'Component DOM references must be bounded before instance ID expansion.' );
$invalid_component_page = json_value( $component_page );
$invalid_component_page->root->children[4]->children[] = (object) array( 'kind' => 'text', 'value' => 'not empty' );
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $invalid_component_page ) ), 'Component placeholders cannot persist materialized children.' );

$unverified = json_value( $fixtures[0] );
$unverified->root->actions = array(
	(object) array(
		'trigger'  => 'manual-review',
		'behavior' => 'unverified-script',
		'params'   => (object) array(
			'code'        => '</script><script>alert(1)</script>',
			'description' => 'Never executed.',
		),
	),
);
$unverified_sanitized = Code_To_Block_Schema::sanitize_document( $unverified );
assert_true( ! is_wp_error( $unverified_sanitized ), 'Unverified source must persist as non-executable review metadata.' );
assert_true(
	$unverified->root->actions[0]->params->code === $unverified_sanitized['root']['actions'][0]['params']->code,
	'Unverified source must remain fully visible for manual review.'
);
$unverified->root->actions[0]->trigger = 'click';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $unverified ) ), 'Unverified source can never use an executable trigger.' );

$unsafe_urls                                      = json_value( $fixtures[0] );
$unsafe_urls->root->children[3]->attributes->href = " java\nscript:alert(1)";
$unsafe_urls->root->children[3]->attributes->onclick = 'alert(1)';
$unsafe_urls_sanitized = Code_To_Block_Schema::sanitize_document( $unsafe_urls );
assert_true( ! isset( $unsafe_urls_sanitized['root']['children'][3]['attributes']->href ), 'Script navigation URLs must be stripped.' );
assert_true( ! isset( $unsafe_urls_sanitized['root']['children'][3]['attributes']->onclick ), 'Event handlers must remain stripped beside unsafe URLs.' );

$srcset                              = json_value( $fixtures[2] );
$srcset->root->children[0]->attributes->srcset = 'small.jpg 1x, javascript:alert(1) 2x, wide.jpg 900w';
$srcset_sanitized                    = Code_To_Block_Schema::sanitize_document( $srcset );
assert_true(
	'small.jpg 1x, wide.jpg 900w' === $srcset_sanitized['root']['children'][0]['attributes']->srcset,
	'Srcset must retain only valid safe candidates.'
);

$unsafe_fallback                                  = json_value( $fixtures[0] );
$unsafe_fallback->root->styles->custom_css_fallback = '@import url(//evil.test);';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $unsafe_fallback ) ), 'Fallback at-rules must be rejected server-side.' );
$unsafe_fallback->root->styles->custom_css_fallback = 'width: expression(alert(1));';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $unsafe_fallback ) ), 'Executable legacy CSS expressions must be rejected.' );
$unsafe_fallback->root->styles->custom_css_fallback = 'color: red; broken';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $unsafe_fallback ) ), 'Malformed declaration lists must be rejected.' );
$unsafe_fallback->root->styles->custom_css_fallback = 'content: ";"; background: url("/safe.jpg");';
assert_true( ! is_wp_error( Code_To_Block_Schema::sanitize_document( $unsafe_fallback ) ), 'Balanced declaration values and safe relative URLs must pass.' );

$mapped_injection                               = json_value( $fixtures[0] );
$mapped_injection->root->styles->mapped->color = 'red; display:none';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $mapped_injection ) ), 'Mapped values cannot inject additional declarations.' );
$mapped_injection->root->styles->mapped->background = 'url(javascript:alert(1))';
assert_true( is_wp_error( Code_To_Block_Schema::sanitize_document( $mapped_injection ) ), 'Mapped values cannot contain script-scheme URLs.' );

function security_test_block( $id, $children = array() ) {
	return (object) array(
		'id'         => $id,
		'type'       => 'container',
		'tag'        => 'div',
		'attributes' => new stdClass(),
		'children'   => $children,
		'styles'     => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
		'meta'       => (object) array( 'source' => 'security-test' ),
	);
}

$deep_block = security_test_block( 'depth-51' );
for ( $depth = 50; $depth >= 1; --$depth ) {
	$deep_block = security_test_block( 'depth-' . $depth, array( $deep_block ) );
}
$deep_document = (object) array( 'schema_version' => 1, 'name' => 'Deep', 'root' => $deep_block );
$deep_error    = Code_To_Block_Schema::sanitize_document( $deep_document );
assert_true( is_wp_error( $deep_error ) && 413 === $deep_error->get_error_data()['status'], 'Trees deeper than 50 blocks must return 413.' );

$wide_children = array();
for ( $index = 0; $index < 1000; ++$index ) {
	$wide_children[] = security_test_block( 'wide-' . $index );
}
$wide_document = (object) array( 'schema_version' => 1, 'name' => 'Wide', 'root' => security_test_block( 'wide-root', $wide_children ) );
$wide_error    = Code_To_Block_Schema::sanitize_document( $wide_document );
assert_true( is_wp_error( $wide_error ) && 413 === $wide_error->get_error_data()['status'], 'Trees with more than 1000 blocks must return 413.' );

$valid_meta = json_encode( $fixtures[0] );
assert_true( null === Code_To_Block_Schema::validate_meta_write( null, 42, CODE_TO_BLOCK_META_KEY, $valid_meta ), 'Valid direct meta writes must continue.' );
assert_true( false === Code_To_Block_Schema::validate_meta_write( null, 42, CODE_TO_BLOCK_META_KEY, '{}' ), 'Malformed direct meta writes must be rejected.' );
assert_true( null === Code_To_Block_Schema::validate_meta_write( null, 7, CODE_TO_BLOCK_META_KEY, '{}' ), 'Other post types must be left to their own metadata policy.' );
assert_true( true === Code_To_Block_Schema::validate_meta_write( true, 42, CODE_TO_BLOCK_META_KEY, '{}' ), 'Existing metadata short-circuit results must be preserved.' );

fwrite( STDOUT, "PASS: {$assertions} schema assertions.\n" );
