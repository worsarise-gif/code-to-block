<?php

define( 'ABSPATH', __DIR__ . '/' );
define( 'CODE_TO_BLOCK_META_KEY', '_ctb_block_tree' );
define( 'CODE_TO_BLOCK_POST_TYPE', 'ctb_page' );
define( 'CODE_TO_BLOCK_COMPONENT_POST_TYPE', 'ctb_component' );
define( 'CODE_TO_BLOCK_COMPONENT_META_KEY', '_ctb_component_tree' );

final class WP_Error {
	private $data;

	public function __construct( $code, $message, $data = null ) {
		unset( $code, $message );
		$this->data = $data;
	}

	public function get_error_data() {
		return $this->data;
	}
}

final class WP_REST_Server {
	const READABLE = 'GET';
	const CREATABLE = 'POST';
}

final class Security_Test_Request extends ArrayObject {
	private $body;

	public function __construct( $post_id, $body = '' ) {
		parent::__construct( array( 'post_id' => $post_id ) );
		$this->body = $body;
	}

	public function get_body() {
		return $this->body;
	}

}

$security_posts = array(
	20 => (object) array( 'post_type' => CODE_TO_BLOCK_POST_TYPE, 'post_status' => 'publish' ),
	21 => (object) array( 'post_type' => 'post', 'post_status' => 'publish' ),
	22 => (object) array( 'post_type' => CODE_TO_BLOCK_POST_TYPE, 'post_status' => 'trash' ),
	30 => (object) array( 'post_type' => CODE_TO_BLOCK_COMPONENT_POST_TYPE, 'post_status' => 'publish' ),
	31 => (object) array( 'post_type' => CODE_TO_BLOCK_COMPONENT_POST_TYPE, 'post_status' => 'trash' ),
);
$security_can_edit = true;
$security_can_manage = true;
$registered_routes = array();
$assertions         = 0;

function __( $message ) {
	return $message;
}

function is_wp_error( $value ) {
	return $value instanceof WP_Error;
}

function rest_authorization_required_code() {
	return 403;
}

function get_post( $post_id ) {
	global $security_posts;
	return isset( $security_posts[ $post_id ] ) ? $security_posts[ $post_id ] : null;
}

function get_post_type( $post_id ) {
	$post = get_post( $post_id );
	return $post ? $post->post_type : null;
}

function current_user_can( $capability ) {
	global $security_can_edit, $security_can_manage;
	return 'manage_options' === $capability ? $security_can_manage : $security_can_edit;
}

function wp_json_encode( $value, $flags = 0 ) {
	return json_encode( $value, $flags );
}

function register_rest_route( $namespace, $route, $definitions ) {
	global $registered_routes;
	$registered_routes[] = compact( 'namespace', 'route', 'definitions' );
}

function assert_security( $condition, $message ) {
	global $assertions;
	++$assertions;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

require_once dirname( __DIR__ ) . '/includes/class-code-to-block-schema.php';
require_once dirname( __DIR__ ) . '/includes/class-code-to-block-php-scanner.php';
require_once dirname( __DIR__ ) . '/includes/class-code-to-block-shortcodes.php';
require_once dirname( __DIR__ ) . '/includes/class-code-to-block-rest-controller.php';

$controller = new Code_To_Block_REST_Controller();
$controller->register_routes();
assert_security( 12 === count( $registered_routes ), 'Exactly twelve custom route patterns must be registered.' );
assert_security( 2 === count( $registered_routes[0]['definitions'] ), 'The block-tree route must expose only GET and POST definitions.' );
foreach ( $registered_routes[0]['definitions'] as $definition ) {
	assert_security( array( $controller, 'permissions_check' ) === $definition['permission_callback'], 'Every custom method must use the object-specific permission callback.' );
}
assert_security( 1 === count( $registered_routes[1]['definitions'] ), 'The PHP route must expose only POST.' );
assert_security( array( $controller, 'php_permissions_check' ) === $registered_routes[1]['definitions'][0]['permission_callback'], 'The PHP route must use its stricter permission callback.' );
assert_security( 2 === count( $registered_routes[2]['definitions'] ), 'The component collection must expose GET and POST.' );
assert_security( array( $controller, 'component_create_permissions_check' ) === $registered_routes[2]['definitions'][1]['permission_callback'], 'Component creation must require create and publish capabilities.' );
assert_security( 1 === count( $registered_routes[3]['definitions'] ), 'The parity route must expose only GET.' );
assert_security( array( $controller, 'permissions_check' ) === $registered_routes[3]['definitions'][0]['permission_callback'], 'The parity route must use the standard page permission check.' );
assert_security( 1 === count( $registered_routes[4]['definitions'] ), 'The diagnostics route must expose only GET.' );
assert_security( array( $controller, 'permissions_check' ) === $registered_routes[4]['definitions'][0]['permission_callback'], 'The diagnostics route must use the standard page permission check.' );
assert_security( '/pages/(?P<post_id>\d+)/content' === $registered_routes[5]['route'], 'Content Mode must use a dedicated patch route.' );
assert_security( 2 === count( $registered_routes[5]['definitions'] ), 'Content Mode must expose resolved reads and patch writes.' );
foreach ( $registered_routes[5]['definitions'] as $definition ) {
	assert_security( array( $controller, 'permissions_check' ) === $definition['permission_callback'], 'Content reads and patches must use the standard page permission check.' );
}
assert_security( '/pages/(?P<post_id>\d+)/autosave' === $registered_routes[6]['route'], 'Autosave must use a page-scoped route.' );
assert_security( array( $controller, 'permissions_check' ) === $registered_routes[6]['definitions'][0]['permission_callback'], 'Autosave must require permission to edit the owning page.' );
assert_security( '/pages/(?P<post_id>\d+)/revisions' === $registered_routes[7]['route'], 'Revision history must use a page-scoped route.' );
assert_security( array( $controller, 'permissions_check' ) === $registered_routes[7]['definitions'][0]['permission_callback'], 'Revision history must require permission to edit the owning page.' );
assert_security( '/pages/(?P<post_id>\d+)/revisions/(?P<revision_id>\d+)/restore' === $registered_routes[8]['route'], 'Revision restoration must use a page-scoped item route.' );
assert_security( array( $controller, 'permissions_check' ) === $registered_routes[8]['definitions'][0]['permission_callback'], 'Revision restoration must require permission to edit the owning page.' );
assert_security( 3 === count( $registered_routes[9]['definitions'] ), 'A component item must expose GET, PUT, and DELETE.' );
assert_security( array( $controller, 'component_permissions_check' ) === $registered_routes[9]['definitions'][1]['permission_callback'], 'Component updates must use object-specific component permissions.' );
assert_security( array( $controller, 'component_delete_permissions_check' ) === $registered_routes[9]['definitions'][2]['permission_callback'], 'Component deletion must require object-specific delete permission.' );
assert_security( '/pages/(?P<post_id>\d+)/products' === $registered_routes[10]['route'], 'Product previews must use a page-scoped route.' );
assert_security( array( $controller, 'permissions_check' ) === $registered_routes[10]['definitions'][0]['permission_callback'], 'Product previews must require permission to edit the owning page.' );
assert_security( '/pages/(?P<post_id>\d+)/products/(?P<product_id>\d+)' === $registered_routes[11]['route'], 'Product updates must use a page-scoped item route.' );
assert_security( 1 === count( $registered_routes[11]['definitions'] ), 'The product item route must expose only PUT.' );
assert_security( array( $controller, 'product_permissions_check' ) === $registered_routes[11]['definitions'][0]['permission_callback'], 'Product updates must use object-specific product permissions.' );

$missing = $controller->permissions_check( new Security_Test_Request( 999 ) );
assert_security( is_wp_error( $missing ) && 404 === $missing->get_error_data()['status'], 'Missing objects must return 404.' );
$wrong_type = $controller->permissions_check( new Security_Test_Request( 21 ) );
assert_security( is_wp_error( $wrong_type ) && 404 === $wrong_type->get_error_data()['status'], 'Other post types must return 404.' );
$security_can_edit = false;
$forbidden = $controller->permissions_check( new Security_Test_Request( 20 ) );
assert_security( is_wp_error( $forbidden ) && 403 === $forbidden->get_error_data()['status'], 'Users without edit_post must be forbidden.' );
$security_can_edit = true;
$trashed = $controller->permissions_check( new Security_Test_Request( 22 ) );
assert_security( is_wp_error( $trashed ) && 410 === $trashed->get_error_data()['status'], 'Trashed pages must reject tree operations.' );
assert_security( true === $controller->permissions_check( new Security_Test_Request( 20 ) ), 'Editors of the correct page must be allowed.' );
$component_request = new Security_Test_Request( 20 );
$component_request['component_id'] = 30;
assert_security( true === $controller->component_permissions_check( $component_request ), 'Page editors who can edit the component may update it.' );
assert_security( true === $controller->component_create_permissions_check( new Security_Test_Request( 20 ) ), 'Page editors with post creation capabilities may create components.' );
assert_security( true === $controller->component_delete_permissions_check( $component_request ), 'Component deletion must pass only with delete_post permission.' );
$missing_component_request = new Security_Test_Request( 20 );
$missing_component_request['component_id'] = 999;
$missing_component = $controller->component_permissions_check( $missing_component_request );
assert_security( is_wp_error( $missing_component ) && 404 === $missing_component->get_error_data()['status'], 'Missing component records must return 404.' );
$trashed_component_request = new Security_Test_Request( 20 );
$trashed_component_request['component_id'] = 31;
$trashed_component = $controller->component_permissions_check( $trashed_component_request );
assert_security( is_wp_error( $trashed_component ) && 404 === $trashed_component->get_error_data()['status'], 'Trashed components must reject updates before storage.' );

$security_can_manage = false;
$php_forbidden = $controller->php_permissions_check( new Security_Test_Request( 20 ) );
assert_security( is_wp_error( $php_forbidden ) && 403 === $php_forbidden->get_error_data()['status'], 'Page editors without manage_options must not review PHP.' );
$security_can_manage = true;
assert_security( true === $controller->php_permissions_check( new Security_Test_Request( 20 ) ), 'Administrators who can edit the page may review PHP.' );

$oversized = $controller->save( new Security_Test_Request( 20, str_repeat( 'x', ( Code_To_Block_Schema::MAX_JSON_BYTES * 2 ) + 1 ) ) );
assert_security( is_wp_error( $oversized ) && 413 === $oversized->get_error_data()['status'], 'Document-plus-snapshot requests larger than 4 MB must be rejected before decoding.' );
$oversized_component = $controller->create_component( new Security_Test_Request( 20, str_repeat( 'x', Code_To_Block_Schema::MAX_JSON_BYTES + 1 ) ) );
assert_security( is_wp_error( $oversized_component ) && 413 === $oversized_component->get_error_data()['status'], 'Oversized component writes must be rejected before storage.' );

fwrite( STDOUT, "PASS: {$assertions} REST security assertions.\n" );
