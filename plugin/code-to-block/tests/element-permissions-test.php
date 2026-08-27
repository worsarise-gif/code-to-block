<?php

define( 'ABSPATH', __DIR__ . '/' );

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

$permission_admin = false;
$permission_roles = array( 'editor' );

function current_user_can( $capability ) {
	global $permission_admin;
	return 'manage_options' === $capability && $permission_admin;
}

function wp_get_current_user() {
	global $permission_roles;
	return (object) array( 'roles' => $permission_roles );
}

function wp_json_encode( $value, $flags = 0 ) { return json_encode( $value, $flags ); }
function rest_authorization_required_code() { return 403; }
function is_wp_error( $value ) { return $value instanceof WP_Error; }

require_once dirname( __DIR__ ) . '/includes/class-code-to-block-element-permissions.php';

$assertions = 0;
function assert_permission( $condition, $message ) {
	global $assertions;
	++$assertions;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

function permission_document( $permissions = array() ) {
	$child = array(
		'id' => 'protected',
		'type' => 'text',
		'tag' => 'p',
		'attributes' => array(),
		'children' => array( array( 'kind' => 'text', 'value' => 'Original' ) ),
		'styles' => array( 'mapped' => array(), 'custom_css_fallback' => '' ),
		'meta' => array( 'source' => 'test' ),
	);
	if ( ! empty( $permissions ) ) $child['permissions'] = $permissions;
	return array(
		'schema_version' => 1,
		'name' => 'Permissions',
		'root' => array(
			'id' => 'root',
			'type' => 'container',
			'tag' => 'div',
			'attributes' => array(),
			'children' => array( $child ),
			'styles' => array( 'mapped' => array(), 'custom_css_fallback' => '' ),
			'meta' => array( 'source' => 'test' ),
		),
	);
}

$locked = permission_document( array( 'locked' => true ) );
assert_permission( true === Code_To_Block_Element_Permissions::validate_update( $locked, $locked ), 'Unchanged locked trees must remain saveable.' );
$changed = json_decode( json_encode( $locked ), true );
$changed['root']['children'][0]['children'][0]['value'] = 'Changed';
$result = Code_To_Block_Element_Permissions::validate_update( $locked, $changed );
assert_permission( is_wp_error( $result ) && 'protected' === $result->get_error_data()['block_id'], 'Locked element edits must be rejected server-side.' );

$role_owned = permission_document( array( 'role' => 'author' ) );
$changed = json_decode( json_encode( $role_owned ), true );
$changed['root']['children'][0]['children'][0]['value'] = 'Changed';
assert_permission( is_wp_error( Code_To_Block_Element_Permissions::validate_update( $role_owned, $changed ) ), 'Non-owner roles must not edit role-owned elements.' );

$no_edit = permission_document( array( 'role' => 'editor', 'can_edit' => false ) );
$changed = json_decode( json_encode( $no_edit ), true );
$changed['root']['children'][0]['attributes']['title'] = 'Changed';
assert_permission( is_wp_error( Code_To_Block_Element_Permissions::validate_update( $no_edit, $changed ) ), 'Can-edit false must be enforced.' );

$no_delete = permission_document( array( 'role' => 'editor', 'can_delete' => false ) );
$changed = json_decode( json_encode( $no_delete ), true );
$changed['root']['children'] = array();
assert_permission( is_wp_error( Code_To_Block_Element_Permissions::validate_update( $no_delete, $changed ) ), 'Can-delete false must be enforced.' );

$no_publish = permission_document( array( 'role' => 'editor', 'can_publish' => false ) );
$changed = json_decode( json_encode( $no_publish ), true );
$changed['root']['children'][0]['styles']['mapped']['color'] = '#123456';
assert_permission( is_wp_error( Code_To_Block_Element_Permissions::validate_update( $no_publish, $changed ) ), 'Can-publish false must reject live saves.' );

$permission_admin = true;
$changed = json_decode( json_encode( $locked ), true );
unset( $changed['root']['children'][0]['permissions'] );
assert_permission( true === Code_To_Block_Element_Permissions::validate_update( $locked, $changed ), 'Administrators must be able to unlock elements.' );

echo 'PASS: ' . $assertions . " element permission assertions.\n";
