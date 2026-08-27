<?php

define( 'ABSPATH', __DIR__ . '/' );
define( 'CODE_TO_BLOCK_POST_TYPE', 'ctb_page' );
define( 'CODE_TO_BLOCK_META_KEY', '_ctb_block_tree' );
define( 'CODE_TO_BLOCK_COMPONENT_POST_TYPE', 'ctb_component' );
define( 'CODE_TO_BLOCK_COMPONENT_META_KEY', '_ctb_component_tree' );

final class WP_Error {
	private $code;
	private $message;
	private $data;
	public function __construct( $code, $message, $data = null ) {
		$this->code = $code;
		$this->message = $message;
		$this->data = $data;
	}
	public function get_error_code() { return $this->code; }
	public function get_error_message() { return $this->message; }
	public function get_error_data() { return $this->data; }
}

$component_posts = array();
$component_meta  = array();
$component_next_id = 40;
$assertions = 0;

function is_wp_error( $value ) { return $value instanceof WP_Error; }
function wp_json_encode( $value, $flags = 0 ) { return json_encode( $value, $flags ); }
function wp_slash( $value ) { return $value; }
function sanitize_text_field( $value ) { return trim( strip_tags( $value ) ); }
function current_user_can() { return true; }
function rest_authorization_required_code() { return 403; }
function get_post_type( $post_id ) {
	$post = get_post( $post_id );
	return $post ? $post->post_type : null;
}
function get_post( $post_id ) {
	global $component_posts;
	return isset( $component_posts[ $post_id ] ) ? $component_posts[ $post_id ] : null;
}
function wp_insert_post( $values, $return_error = false ) {
	global $component_posts, $component_next_id;
	unset( $return_error );
	$id = $component_next_id++;
	$component_posts[ $id ] = (object) array(
		'ID' => $id,
		'post_type' => $values['post_type'],
		'post_status' => $values['post_status'],
		'post_title' => $values['post_title'],
	);
	return $id;
}
function wp_update_post( $values, $return_error = false ) {
	global $component_posts;
	unset( $return_error );
	if ( isset( $component_posts[ $values['ID'] ] ) ) {
		$component_posts[ $values['ID'] ]->post_title = $values['post_title'];
	}
	return $values['ID'];
}
function wp_count_posts() {
	global $component_posts;
	$count = 0;
	foreach ( $component_posts as $post ) {
		if ( CODE_TO_BLOCK_COMPONENT_POST_TYPE === $post->post_type && 'publish' === $post->post_status ) {
			++$count;
		}
	}
	return (object) array( 'publish' => $count );
}
function wp_delete_post( $post_id ) {
	global $component_posts, $component_meta;
	unset( $component_posts[ $post_id ], $component_meta[ $post_id ] );
	return true;
}
function update_post_meta( $post_id, $key, $value ) {
	global $component_meta;
	$changed = ! isset( $component_meta[ $post_id ][ $key ] ) || $component_meta[ $post_id ][ $key ] !== $value;
	$component_meta[ $post_id ][ $key ] = $value;
	return $changed;
}
function get_post_meta( $post_id, $key ) {
	global $component_meta;
	return isset( $component_meta[ $post_id ][ $key ] ) ? $component_meta[ $post_id ][ $key ] : '';
}
function get_posts() {
	global $component_posts;
	return array_values( $component_posts );
}

function assert_component( $condition, $message ) {
	global $assertions;
	++$assertions;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

require_once dirname( __DIR__ ) . '/includes/class-code-to-block-schema.php';
require_once dirname( __DIR__ ) . '/includes/class-code-to-block-components.php';

$fixtures = json_decode( file_get_contents( dirname( __DIR__, 3 ) . '/block-examples.json' ) );
$component_source = json_decode( json_encode( $fixtures[0] ) );
$component_source->name = 'Reusable pricing card';
$component_source->design_tokens = (object) array(
	'colors' => (object) array(
		'brand' => (object) array( 'label' => 'Brand', 'value' => '#6558d3' ),
	),
);
$component_source->root->styles->mapped->color = 'var(--ctb-token-colors-brand)';
$component_source->root->styles->token_bindings = (object) array( 'color' => 'colors.brand' );
$component_source->root->attributes->id = 'component-dom-id';
$component_source->root->children[0]->tag = 'label';
$component_source->root->children[0]->attributes->for = 'component-dom-id';
$component_source->root->children[0]->is_content_slot = true;
$component_source->root->children[0]->slot_label = 'Plan name';
$component_source->root->children[0]->slot_content_type = 'text';
$component_source->root->actions = array(
	(object) array(
		'trigger' => 'click',
		'behavior' => 'toggle-visibility',
		'params' => (object) array( 'target_block_id' => $component_source->root->id ),
	),
);

$created = Code_To_Block_Components::create( $component_source );
assert_component( ! is_wp_error( $created ), 'A canonical subtree document must be stored.' );
assert_component( 'ready' === $created['status'], 'Stored components must load as ready.' );
assert_component( 'Reusable pricing card' === $created['name'], 'The component name must round-trip.' );
$component_id = $created['id'];
$stored_before_invalid_update = get_post_meta( $component_id, CODE_TO_BLOCK_COMPONENT_META_KEY, true );

$invalid_update = json_decode( json_encode( $component_source ) );
$invalid_update->root->id = 7;
$rejected = Code_To_Block_Components::update( $component_id, $invalid_update );
assert_component( is_wp_error( $rejected ), 'Invalid component updates must be rejected before persistence.' );
assert_component( $stored_before_invalid_update === get_post_meta( $component_id, CODE_TO_BLOCK_COMPONENT_META_KEY, true ), 'Rejected updates must leave the last valid component unchanged.' );

$page = json_decode( json_encode( $fixtures[0] ) );
$page->root->children[] = (object) array(
	'id' => 'instance-one',
	'type' => 'container',
	'tag' => 'div',
	'attributes' => new stdClass(),
	'children' => array(),
	'styles' => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
	'meta' => (object) array( 'source' => 'saved-component', 'saved_component_id' => $component_id ),
);
$page->root->children[] = (object) array(
	'id' => 'instance-two',
	'type' => 'container',
	'tag' => 'div',
	'attributes' => new stdClass(),
	'children' => array(),
	'styles' => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
	'meta' => (object) array( 'source' => 'saved-component', 'saved_component_id' => $component_id ),
);
$page = Code_To_Block_Schema::sanitize_document( $page );
assert_component( ! is_wp_error( $page ), 'A page with linked placeholders must validate before resolution.' );
$resolved = Code_To_Block_Components::resolve_document( $page );
$first = $resolved['root']['children'][4]['children'][0];
$second = $resolved['root']['children'][5]['children'][0];
assert_component( $first['id'] !== $second['id'], 'Two instances must receive disjoint block IDs.' );
assert_component( 'saved-' . $component_id . '-instance-one-1' === $first['id'], 'PHP component IDs must match the editor materialization algorithm.' );
assert_component( $first['attributes']['id'] !== $second['attributes']['id'], 'Two instances must receive disjoint HTML IDs.' );
assert_component( $first['children'][0]['attributes']['for'] === $first['attributes']['id'], 'HTML ID references must follow each regenerated ID.' );
assert_component( $first['id'] === $first['actions'][0]['params']['target_block_id'], 'Internal action targets must follow regenerated IDs.' );
assert_component( 'colors.saved-' . $component_id . '-brand' === $first['styles']['token_bindings']['color'], 'Component token references must be namespaced.' );
assert_component( isset( $resolved['design_tokens']['colors']['saved-' . $component_id . '-brand'] ), 'Required token definitions must merge into the rendered document.' );
$first_slot_id = $first['children'][0]['id'];
$second_slot_id = $second['children'][0]['id'];
$page['slot_values'] = array( $first_slot_id => 'Instance-specific plan' );
$overridden = Code_To_Block_Components::resolve_document( Code_To_Block_Schema::sanitize_document( $page ) );
assert_component( 'Instance-specific plan' === $overridden['root']['children'][4]['children'][0]['children'][0]['children'][0]['value'], 'A page-local slot override must apply inside one linked component instance.' );
assert_component( 'Instance-specific plan' !== $overridden['root']['children'][5]['children'][0]['children'][0]['children'][0]['value'], 'A component slot override must not leak to another instance.' );
assert_component( $first_slot_id !== $second_slot_id, 'Component slot IDs must remain instance-specific.' );

$token_limit_page = json_decode( json_encode( $page ) );
$token_limit_page->design_tokens = (object) array( 'colors' => new stdClass() );
for ( $index = 0; $index < 100; ++$index ) {
	$id = 'extra-' . $index;
	$token_limit_page->design_tokens->colors->{$id} = (object) array( 'label' => 'Extra ' . $index, 'value' => '#111111' );
}
$token_limit_page = Code_To_Block_Schema::sanitize_document( $token_limit_page );
$token_limit_resolved = Code_To_Block_Components::resolve_document( $token_limit_page );
assert_component( Code_To_Block_Components::FAILURE_MESSAGE === $token_limit_resolved['root']['children'][4]['children'][0]['value'], 'Component token merging cannot exceed the 100-token document limit.' );

$wide_root = (object) array(
	'id' => 'wide-root',
	'type' => 'container',
	'tag' => 'div',
	'attributes' => new stdClass(),
	'children' => array(),
	'styles' => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
	'meta' => (object) array( 'source' => 'component-limit-test' ),
);
for ( $index = 0; $index < 999; ++$index ) {
	$wide_root->children[] = (object) array(
		'id' => 'wide-' . $index,
		'type' => 'container',
		'tag' => 'div',
		'attributes' => new stdClass(),
		'children' => array(),
		'styles' => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
		'meta' => (object) array( 'source' => 'component-limit-test' ),
	);
}
$wide_component = Code_To_Block_Components::create( (object) array( 'schema_version' => 1, 'name' => 'Wide component', 'root' => $wide_root ) );
assert_component( ! is_wp_error( $wide_component ), 'A component at the standalone 1000-block limit may be stored.' );
$limit_page = json_decode( json_encode( $fixtures[0] ) );
$limit_page->root->children[] = (object) array(
	'id' => 'wide-instance',
	'type' => 'container',
	'tag' => 'div',
	'attributes' => new stdClass(),
	'children' => array(),
	'styles' => (object) array( 'mapped' => new stdClass(), 'custom_css_fallback' => '' ),
	'meta' => (object) array( 'source' => 'saved-component', 'saved_component_id' => $wide_component['id'] ),
);
$limit_page = Code_To_Block_Schema::sanitize_document( $limit_page );
$limit_resolved = Code_To_Block_Components::resolve_document( $limit_page );
assert_component( Code_To_Block_Components::FAILURE_MESSAGE === $limit_resolved['root']['children'][4]['children'][0]['value'], 'Aggregate expansion beyond 1000 blocks must fail only that component slot.' );

$component_meta[ $component_id ][ CODE_TO_BLOCK_COMPONENT_META_KEY ] = '{broken';
$isolated = Code_To_Block_Components::resolve_document( $page );
assert_component( Code_To_Block_Components::FAILURE_MESSAGE === $isolated['root']['children'][4]['children'][0]['value'], 'Corrupt component data must produce the exact local fallback.' );
assert_component( 'Professional' === $isolated['root']['children'][0]['children'][0]['value'], 'A sibling outside the corrupt component must remain usable.' );
$listed = Code_To_Block_Components::all();
assert_component( 'failed' === $listed[0]['status'], 'A corrupt library record must not break the component list.' );
assert_component( false === Code_To_Block_Components::validate_meta_write( null, $component_id, CODE_TO_BLOCK_COMPONENT_META_KEY, '{}' ), 'Direct malformed component writes must be rejected.' );

fwrite( STDOUT, "PASS: {$assertions} saved-component assertions.\n" );
