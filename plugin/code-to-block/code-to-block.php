<?php
/**
 * Plugin Name: Code to Block
 * Description: Stores and serves editable block trees produced from HTML and CSS.
 * Version: 0.22.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Author: Code to Block
 * License: GPL-2.0-or-later
 * Text Domain: code-to-block
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CODE_TO_BLOCK_VERSION', '0.22.0' );
define( 'CODE_TO_BLOCK_PATH', plugin_dir_path( __FILE__ ) );
define( 'CODE_TO_BLOCK_POST_TYPE', 'ctb_page' );
define( 'CODE_TO_BLOCK_META_KEY', '_ctb_block_tree' );
define( 'CODE_TO_BLOCK_COMPONENT_POST_TYPE', 'ctb_component' );
define( 'CODE_TO_BLOCK_COMPONENT_META_KEY', '_ctb_component_tree' );

require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-registry.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-schema.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-migrations.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-element-permissions.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-components.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-commerce.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-renderer.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-seo.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-php-scanner.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-shortcodes.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-parity.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-rest-controller.php';
require_once CODE_TO_BLOCK_PATH . 'includes/class-code-to-block-forms.php';
add_action( 'plugins_loaded', array( 'Code_To_Block_Forms', 'maybe_upgrade' ) );

/**
 * Registers pages managed by Code to Block.
 */
function code_to_block_register_post_type() {
	register_post_type(
		CODE_TO_BLOCK_POST_TYPE,
		array(
			'labels'       => array(
				'name'          => __( 'Code to Block Pages', 'code-to-block' ),
				'singular_name' => __( 'Code to Block Page', 'code-to-block' ),
				'add_new_item'  => __( 'Add Code to Block Page', 'code-to-block' ),
				'edit_item'     => __( 'Edit Code to Block Page', 'code-to-block' ),
			),
			'public'       => true,
			'show_in_rest' => true,
			'rest_base'    => 'ctb-pages',
			'has_archive'  => false,
			'rewrite'      => array( 'slug' => 'built-page' ),
			'supports'     => array( 'title', 'revisions' ),
			'menu_icon'    => 'dashicons-layout',
		)
	);
	register_post_type(
		CODE_TO_BLOCK_COMPONENT_POST_TYPE,
		array(
			'labels'       => array(
				'name'          => __( 'Saved Components', 'code-to-block' ),
				'singular_name' => __( 'Saved Component', 'code-to-block' ),
			),
			'public'       => false,
			'show_ui'      => false,
			'show_in_rest' => false,
			'supports'     => array( 'title', 'author' ),
		)
	);
}
add_action( 'init', 'code_to_block_register_post_type' );
add_action( 'wp', array( 'Code_To_Block_Shortcodes', 'register_runtime' ) );

/**
 * Registers the hidden dedicated editor page.
 */
function code_to_block_register_dedicated_editor_page() {
	add_submenu_page(
		null,
		__( 'Code to Block Dedicated Editor', 'code-to-block' ),
		__( 'Code to Block Dedicated Editor', 'code-to-block' ),
		'edit_posts',
		'code-to-block-dedicated',
		'code_to_block_render_dedicated_editor'
	);
	add_submenu_page(
		null,
		__( 'Code to Block Content Mode', 'code-to-block' ),
		__( 'Code to Block Content Mode', 'code-to-block' ),
		'edit_posts',
		'code-to-block-content',
		'code_to_block_render_dedicated_editor'
	);
}
add_action( 'admin_menu', 'code_to_block_register_dedicated_editor_page' );

/**
 * Renders the dedicated full-screen editor without admin chrome.
 */
function code_to_block_render_dedicated_editor() {
	$post_id = isset( $_GET['post'] ) ? (int) $_GET['post'] : 0;
	$post = get_post( $post_id );
	if ( ! $post || CODE_TO_BLOCK_POST_TYPE !== $post->post_type ) {
		wp_die( esc_html__( 'Code to Block page not found.', 'code-to-block' ), '', array( 'response' => 404 ) );
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		wp_die( esc_html__( 'You are not allowed to edit this page.', 'code-to-block' ), '', array( 'response' => 403 ) );
	}
	// Hide admin bar for the dedicated editor.
	add_filter( 'show_admin_bar', '__return_false' );
	
	$is_content = isset( $_GET['page'] ) && 'code-to-block-content' === $_GET['page'];
	$template_name = $is_content ? 'editor-content.php' : 'editor-dedicated.php';
	$template = CODE_TO_BLOCK_PATH . 'templates/' . $template_name;
	
	if ( file_exists( $template ) ) {
		include $template;
		exit;
	}
	wp_die( esc_html__( 'Dedicated editor template not found.', 'code-to-block' ) );
}

/**
 * Handles the dedicated editor before the admin wrapper is rendered.
 */
function code_to_block_handle_dedicated_editor_early() {
	if ( ! isset( $_GET['page'] ) ) {
		return;
	}
	
	$is_dedicated = 'code-to-block-dedicated' === $_GET['page'];
	$is_content = 'code-to-block-content' === $_GET['page'];
	
	if ( ! $is_dedicated && ! $is_content ) {
		return;
	}
	
	$post_id = isset( $_GET['post'] ) ? (int) $_GET['post'] : 0;
	$post = get_post( $post_id );
	if ( ! $post || CODE_TO_BLOCK_POST_TYPE !== $post->post_type ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	
	add_filter( 'show_admin_bar', '__return_false' );
	remove_action( 'wp_body_open', 'wp_admin_bar_render', 0 );
	remove_action( 'wp_footer', 'wp_admin_bar_render', 1000 );
	remove_action( 'wp_head', 'wp_print_font_faces', 50 );
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'wp_enqueue_scripts', 'wp_enqueue_emoji_styles' );
	add_action( 'wp_enqueue_scripts', 'code_to_block_enqueue_dedicated_editor_assets' );
	add_action( 'wp_enqueue_scripts', 'code_to_block_prune_dedicated_editor_assets', PHP_INT_MAX );
	add_action( 'wp_footer', 'code_to_block_prune_dedicated_editor_assets', 0 );
	
	if ( ! defined( 'DONOTCACHEPAGE' ) ) {
		define( 'DONOTCACHEPAGE', true );
	}
	nocache_headers();
	
	$template_name = $is_content ? 'editor-content.php' : 'editor-dedicated.php';
	$template = CODE_TO_BLOCK_PATH . 'templates/' . $template_name;
	
	if ( file_exists( $template ) ) {
		include $template;
		exit;
	}
}
add_action( 'admin_init', 'code_to_block_handle_dedicated_editor_early' );

/**
 * Enqueues editor assets for the dedicated full-screen route.
 */
function code_to_block_enqueue_dedicated_editor_assets() {
	$post_id = isset( $_GET['post'] ) ? (int) $_GET['post'] : 0;
	$post = get_post( $post_id );
	if ( ! $post || CODE_TO_BLOCK_POST_TYPE !== $post->post_type ) {
		return;
	}
	
	$is_content = isset( $_GET['page'] ) && 'code-to-block-content' === $_GET['page'];
	$asset_name = $is_content ? 'content-mode' : 'index';
	
	$asset_path = CODE_TO_BLOCK_PATH . 'build/' . $asset_name . '.asset.php';
	if ( ! file_exists( $asset_path ) ) {
		return;
	}
	$asset = require $asset_path;
	$preview_url = get_preview_post_link( $post );
	if ( ! is_string( $preview_url ) || '' === $preview_url ) {
		$preview_url = get_permalink( $post->ID );
	}
	$role_options = array();
	$roles_object = wp_roles();
	foreach ( $roles_object->roles as $role_slug => $role_data ) {
		$role_options[] = array(
			'value' => $role_slug,
			'label' => translate_user_role( $role_data['name'] ),
		);
	}
	
	wp_enqueue_script(
		'code-to-block-editor',
		plugins_url( 'build/' . $asset_name . '.js', __FILE__ ),
		$asset['dependencies'],
		$asset['version'],
		true
	);
	
	$post_type_object = get_post_type_object( $post->post_type );
	$can_publish = $post_type_object
		&& current_user_can( $post_type_object->cap->publish_posts );
	$server_version = get_post_meta( $post->ID, '_ctb_server_version', true );

	wp_localize_script(
		'code-to-block-editor',
		'codeToBlockEditorSettings',
		array(
			'postId'                     => $post->ID,
			'siteUrl'                    => trailingslashit( home_url() ),
			'previewUrl'                 => $preview_url,
			'postRestPath'                => rest_get_route_for_post( $post ),
			'postStatus'                  => $post->post_status,
			'canPublish'                  => $can_publish,
			'canUnfilteredHtml'           => current_user_can( 'unfiltered_html' ),
			'serverVersion'               => $server_version,
			'contentModeUrl'             => admin_url( 'admin.php?page=code-to-block-content&post=' . $post->ID ),
			'roles'                      => $role_options,
			'canManageElementPermissions' => current_user_can( 'manage_options' ),
			'canRegisterPhp'             => Code_To_Block_Shortcodes::current_user_can_register( $post->ID ),
			'registryVersion'            => Code_To_Block_Registry::VERSION,
			'registryManifest'           => Code_To_Block_Registry::manifest(),
		)
	);
	
	$style_path = CODE_TO_BLOCK_PATH . 'build/' . $asset_name . '.css';
	if ( file_exists( $style_path ) ) {
		wp_enqueue_style(
			'code-to-block-editor',
			plugins_url( 'build/' . $asset_name . '.css', __FILE__ ),
			array(),
			$asset['version']
		);
	}
}

/**
 * Keeps the dedicated editor isolated from theme and unrelated plugin assets.
 */
function code_to_block_prune_dedicated_editor_assets() {
	$scripts = wp_scripts();
	$allowed_scripts = array( 'code-to-block-editor' => true );
	$pending = array( 'code-to-block-editor' );
	while ( $pending ) {
		$handle = array_pop( $pending );
		if ( ! isset( $scripts->registered[ $handle ] ) ) {
			continue;
		}
		foreach ( $scripts->registered[ $handle ]->deps as $dependency ) {
			if ( ! isset( $allowed_scripts[ $dependency ] ) ) {
				$allowed_scripts[ $dependency ] = true;
				$pending[] = $dependency;
			}
		}
	}
	foreach ( $scripts->queue as $handle ) {
		if ( ! isset( $allowed_scripts[ $handle ] ) ) {
			wp_dequeue_script( $handle );
		}
	}

	$styles = wp_styles();
	foreach ( $styles->queue as $handle ) {
		if ( 'code-to-block-editor' !== $handle ) {
			wp_dequeue_style( $handle );
		}
	}
}

/**
 * Adds "Edit with Code to Block" to the post list row actions.
 *
 * @param array   $actions Existing actions.
 * @param WP_Post $post    Post object.
 * @return array
 */
function code_to_block_add_row_actions( $actions, $post ) {
	if ( CODE_TO_BLOCK_POST_TYPE === $post->post_type && current_user_can( 'edit_post', $post->ID ) ) {
		$url = admin_url( 'admin.php?page=code-to-block-dedicated&post=' . (int) $post->ID );
		$actions['code_to_block_dedicated'] = sprintf(
			'<a href="%s">%s</a>',
			esc_url( $url ),
			esc_html__( 'Edit with Code to Block', 'code-to-block' )
		);
		
		$content_url = admin_url( 'admin.php?page=code-to-block-content&post=' . (int) $post->ID );
		$actions['code_to_block_content'] = sprintf(
			'<a href="%s" style="color: #2271b1; font-weight: 500;">%s</a>',
			esc_url( $content_url ),
			esc_html__( 'Content Mode', 'code-to-block' )
		);
		
		$duplicate_url = wp_nonce_url( admin_url( 'admin-post.php?action=code_to_block_duplicate&post=' . (int) $post->ID ), 'code_to_block_duplicate_' . $post->ID );
		$actions['code_to_block_duplicate'] = sprintf(
			'<a href="%s" style="color: #008a20;">%s</a>',
			esc_url( $duplicate_url ),
			esc_html__( 'Duplicate and refill', 'code-to-block' )
		);
	}
	return $actions;
}
add_filter( 'post_row_actions', 'code_to_block_add_row_actions', 10, 2 );
add_filter( 'page_row_actions', 'code_to_block_add_row_actions', 10, 2 );

/**
 * Adds a dedicated editor link to the post edit screen.
 */
function code_to_block_add_edit_screen_link() {
	global $post;
	if ( ! $post || CODE_TO_BLOCK_POST_TYPE !== $post->post_type || ! current_user_can( 'edit_post', $post->ID ) ) {
		return;
	}
	$url = admin_url( 'admin.php?page=code-to-block-dedicated&post=' . (int) $post->ID );
	$content_url = admin_url( 'admin.php?page=code-to-block-content&post=' . (int) $post->ID );
	printf(
		'<div class="notice notice-info inline" style="margin:12px 0; padding:10px;">
			<a href="%s" class="button button-primary">%s</a> 
			<a href="%s" class="button button-secondary" style="margin-left:8px;">%s</a> 
			<span style="margin-left:8px; opacity:.7;">%s</span>
		</div>',
		esc_url( $url ),
		esc_html__( 'Edit with Code to Block (Full-screen)', 'code-to-block' ),
		esc_url( $content_url ),
		esc_html__( 'Edit Content Only', 'code-to-block' ),
		esc_html__( 'Opens a dedicated editor without WordPress admin chrome.', 'code-to-block' )
	);
}
add_action( 'edit_form_after_title', 'code_to_block_add_edit_screen_link' );

/**
 * Handles duplicating a Code to Block page and redirecting to Content Mode.
 */
function code_to_block_handle_duplicate() {
	if ( ! isset( $_GET['post'] ) ) {
		wp_die( esc_html__( 'No post provided.', 'code-to-block' ) );
	}
	$post_id = (int) $_GET['post'];
	check_admin_referer( 'code_to_block_duplicate_' . $post_id );
	
	if ( ! current_user_can( 'edit_posts' ) ) {
		wp_die( esc_html__( 'You are not allowed to duplicate posts.', 'code-to-block' ) );
	}
	
	$post = get_post( $post_id );
	if ( ! $post || CODE_TO_BLOCK_POST_TYPE !== $post->post_type ) {
		wp_die( esc_html__( 'Post not found or invalid type.', 'code-to-block' ) );
	}
	
	$new_post_args = array(
		'post_title'   => $post->post_title . ' (Copy)',
		'post_content' => $post->post_content,
		'post_status'  => 'draft',
		'post_type'    => $post->post_type,
		'post_author'  => get_current_user_id(),
	);
	
	$new_post_id = wp_insert_post( $new_post_args );
	if ( is_wp_error( $new_post_id ) ) {
		wp_die( esc_html( $new_post_id->get_error_message() ) );
	}
	
	$document_json = get_post_meta( $post_id, CODE_TO_BLOCK_META_KEY, true );
	if ( $document_json ) {
		$document = json_decode( $document_json, true );
		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $document ) || ! isset( $document['root'] ) ) {
			wp_delete_post( $new_post_id, true );
			wp_die( esc_html__( 'The source page has an invalid block tree.', 'code-to-block' ) );
		}
		code_to_block_empty_content_slots( $document['root'] );
		unset( $document['slot_values'] );
		$document = Code_To_Block_Schema::sanitize_document( $document );
		if ( is_wp_error( $document ) ) {
			wp_delete_post( $new_post_id, true );
			wp_die( esc_html( $document->get_error_message() ) );
		}
		if ( ! current_user_can( 'unfiltered_html' ) ) {
			$document = Code_To_Block_Schema::disable_imported_script_execution( $document );
		}
		$duplicate_json = wp_json_encode( $document, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		update_post_meta( $new_post_id, CODE_TO_BLOCK_META_KEY, wp_slash( $duplicate_json ) );
		$editor_snapshot = get_post_meta( $post_id, Code_To_Block_Parity::EDITOR_SNAPSHOT_META_KEY, true );
		if ( is_string( $editor_snapshot ) && '' !== $editor_snapshot ) {
			update_post_meta( $new_post_id, Code_To_Block_Parity::EDITOR_SNAPSHOT_META_KEY, wp_slash( $editor_snapshot ) );
		}
	}
	
	$redirect_url = admin_url( 'admin.php?page=code-to-block-content&post=' . $new_post_id );
	wp_safe_redirect( $redirect_url );
	exit;
}
add_action( 'admin_post_code_to_block_duplicate', 'code_to_block_handle_duplicate' );

/**
 * Clears client-specific values while preserving a duplicate's structure.
 *
 * @param array $block Block to mutate recursively.
 */
function code_to_block_empty_content_slots( &$block ) {
	if ( ! empty( $block['is_content_slot'] ) && ! empty( $block['slot_content_type'] ) ) {
		if ( in_array( $block['slot_content_type'], array( 'text', 'rich_text' ), true ) ) {
			$block['children'] = array( array( 'kind' => 'text', 'value' => '' ) );
		} elseif ( 'image' === $block['slot_content_type'] ) {
			$block['attributes']['src'] = '';
		} elseif ( 'link' === $block['slot_content_type'] ) {
			$block['attributes']['href'] = '';
		}
	}
	if ( empty( $block['children'] ) || ! is_array( $block['children'] ) ) {
		return;
	}
	foreach ( $block['children'] as &$child ) {
		if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
			code_to_block_empty_content_slots( $child );
		}
	}
	unset( $child );
}

/**
 * Registers the canonical JSON string used for block-tree storage.
 */
function code_to_block_register_meta() {
	$block_tree_args = array(
		'type'              => 'string',
		'single'            => true,
		'default'           => '',
		'show_in_rest'      => false,
		'sanitize_callback' => array( 'Code_To_Block_Schema', 'sanitize_meta_value' ),
		'auth_callback'     => array( 'Code_To_Block_Schema', 'authorize_meta' ),
	);
	// WordPress 6.4+ supports native meta revisions.
	if ( version_compare( get_bloginfo( 'version' ), '6.4', '>=' ) ) {
		$block_tree_args['revisions_enabled'] = true;
	}
	register_post_meta( CODE_TO_BLOCK_POST_TYPE, CODE_TO_BLOCK_META_KEY, $block_tree_args );

	// Non-revisioned server version for optimistic concurrency.
	register_post_meta(
		CODE_TO_BLOCK_POST_TYPE,
		'_ctb_server_version',
		array(
			'type'              => 'string',
			'single'            => true,
			'default'           => '',
			'show_in_rest'      => false,
			'sanitize_callback' => 'sanitize_text_field',
			'auth_callback'     => array( 'Code_To_Block_Schema', 'authorize_meta' ),
		)
	);

	register_post_meta(
		CODE_TO_BLOCK_COMPONENT_POST_TYPE,
		CODE_TO_BLOCK_COMPONENT_META_KEY,
		array(
			'type'              => 'string',
			'single'            => true,
			'default'           => '',
			'show_in_rest'      => false,
			'sanitize_callback' => array( 'Code_To_Block_Components', 'sanitize_meta_value' ),
			'auth_callback'     => array( 'Code_To_Block_Components', 'authorize_meta' ),
		)
	);
}
add_action( 'init', 'code_to_block_register_meta' );
add_filter( 'add_post_metadata', array( 'Code_To_Block_Schema', 'validate_meta_write' ), 10, 4 );
add_filter( 'update_post_metadata', array( 'Code_To_Block_Schema', 'validate_meta_write' ), 10, 4 );
add_filter( 'add_post_metadata', array( 'Code_To_Block_Components', 'validate_meta_write' ), 10, 4 );
add_filter( 'update_post_metadata', array( 'Code_To_Block_Components', 'validate_meta_write' ), 10, 4 );

/**
 * Scans the saved block tree for js_library actions to determine if GSAP is needed.
 */
function code_to_block_scan_for_gsap( $meta_id, $post_id, $meta_key, $meta_value ) {
	if ( CODE_TO_BLOCK_META_KEY !== $meta_key ) {
		return;
	}
	
	$document   = code_to_block_get_saved_document( $post_id );
	$needs_gsap = null !== $document && code_to_block_document_needs_gsap( $document ) ? 'yes' : 'no';
	update_post_meta( $post_id, '_code_to_block_needs_gsap', $needs_gsap );
}
add_action( 'added_post_meta', 'code_to_block_scan_for_gsap', 10, 4 );
add_action( 'updated_post_meta', 'code_to_block_scan_for_gsap', 10, 4 );

/**
 * Registers the dedicated block-tree REST routes.
 */
function code_to_block_register_rest_routes() {
	$controller = new Code_To_Block_REST_Controller();
	$controller->register_routes();
}
add_action( 'rest_api_init', 'code_to_block_register_rest_routes' );

/**
 * Adds the visual editor canvas to Code to Block page edit screens.
 */
function code_to_block_register_editor_meta_box() {
	add_meta_box(
		'code-to-block-editor',
		__( 'Code to Block Canvas', 'code-to-block' ),
		'code_to_block_render_editor_meta_box',
		CODE_TO_BLOCK_POST_TYPE,
		'normal',
		'high'
);
}
add_action( 'add_meta_boxes_' . CODE_TO_BLOCK_POST_TYPE, 'code_to_block_register_editor_meta_box' );

/**
 * Safe Mode: Remove other plugins' scripts and styles if ?ctb_safe_mode=1 is present,
 * leaving only this plugin and WooCommerce active on the frontend to isolate styling/JS conflicts.
 */
if ( isset( $_GET['ctb_safe_mode'] ) && '1' === $_GET['ctb_safe_mode'] ) {
	add_action( 'wp_enqueue_scripts', 'code_to_block_safe_mode_dequeue', 9999 );
	function code_to_block_safe_mode_dequeue() {
		global $wp_scripts, $wp_styles;
		foreach ( array( $wp_scripts, $wp_styles ) as $dependency_obj ) {
			if ( ! $dependency_obj ) continue;
			foreach ( $dependency_obj->queue as $handle ) {
				// Keep WordPress core, WooCommerce, and Code to Block
				if ( false === strpos( $handle, 'code-to-block' ) && false === strpos( $handle, 'wc-' ) && false === strpos( $handle, 'woocommerce' ) && false === strpos( $handle, 'wp-' ) && 'jquery' !== $handle ) {
					$dependency_obj->dequeue( $handle );
				}
			}
		}
	}
}

/**
 * Prints the mount point used by the React editor.
 */
function code_to_block_render_editor_meta_box() {
	echo '<div id="code-to-block-editor-root">';
	echo '<p>' . esc_html__( 'Loading the visual canvas...', 'code-to-block' ) . '</p>';
	echo '</div>';
}

/**
 * Loads editor assets only where their mount point is present.
 *
 * @param string $hook_suffix Current admin page.
 */
function code_to_block_enqueue_editor_assets( $hook_suffix ) {
	$is_dedicated = isset( $_GET['page'] ) && 'code-to-block-dedicated' === $_GET['page'] && isset( $_GET['post'] );
	$post = null;
	if ( $is_dedicated ) {
		$post_id = (int) $_GET['post'];
		$post = get_post( $post_id );
		if ( ! $post || CODE_TO_BLOCK_POST_TYPE !== $post->post_type ) {
			return;
		}
	} else {
		if ( ! in_array( $hook_suffix, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}
		$screen = get_current_screen();
		if ( ! $screen || CODE_TO_BLOCK_POST_TYPE !== $screen->post_type ) {
			return;
		}
		global $post;
	}

	$asset_path = CODE_TO_BLOCK_PATH . 'build/index.asset.php';
	if ( ! file_exists( $asset_path ) ) {
		return;
	}

	$asset = require $asset_path;
	wp_enqueue_script(
		'code-to-block-editor',
		plugins_url( 'build/index.js', __FILE__ ),
		$asset['dependencies'],
		$asset['version'],
		true
	);
	wp_localize_script(
		'code-to-block-editor',
		'codeToBlockEditorSettings',
		array(
			'postId'         => $post instanceof WP_Post ? $post->ID : 0,
			'siteUrl'        => trailingslashit( home_url() ),
			'canRegisterPhp'  => $post instanceof WP_Post && Code_To_Block_Shortcodes::current_user_can_register( $post->ID ),
			'registryVersion' => Code_To_Block_Registry::VERSION,
			'registryManifest' => Code_To_Block_Registry::manifest(),
		)
	);

	$style_path = CODE_TO_BLOCK_PATH . 'build/index.css';
	if ( file_exists( $style_path ) ) {
		wp_enqueue_style(
			'code-to-block-editor',
			plugins_url( 'build/index.css', __FILE__ ),
			array(),
			$asset['version']
		);
	}
}
add_action( 'admin_enqueue_scripts', 'code_to_block_enqueue_editor_assets' );

/**
 * Loads and validates a saved block document.
 *
 * @param int $post_id Owning post ID.
 * @return array|null
 */
function code_to_block_get_saved_document( $post_id ) {
	$json = get_post_meta( (int) $post_id, CODE_TO_BLOCK_META_KEY, true );
	if ( ! is_string( $json ) || '' === $json ) {
		return null;
	}

	$decoded = json_decode( $json, true );
	if ( JSON_ERROR_NONE !== json_last_error() ) {
		return null;
	}

	$document = Code_To_Block_Schema::sanitize_document( $decoded );
	return is_wp_error( $document ) ? null : Code_To_Block_Components::resolve_document( $document );
}

/**
 * Returns whether a resolved document contains an executable GSAP action.
 *
 * @param array $document Sanitized, resolved document.
 * @return bool
 */
function code_to_block_document_needs_gsap( $document ) {
	return Code_To_Block_Schema::document_needs_gsap( $document );
}

/**
 * Replaces the custom post type's empty content with its rendered block tree.
 *
 * @param string $content Existing post content.
 * @return string
 */
function code_to_block_render_frontend_content( $content ) {
	if ( ! is_singular( CODE_TO_BLOCK_POST_TYPE ) || ! in_the_loop() || ! is_main_query() ) {
		return $content;
	}

	$post_id  = get_the_ID();
	if ( post_password_required( $post_id ) ) {
		return $content;
	}
	$document = code_to_block_get_saved_document( $post_id );
	if ( null === $document ) {
		return $content;
	}

	return do_blocks( Code_To_Block_Renderer::render_document( $document, $post_id ) );
}
add_filter( 'the_content', 'code_to_block_render_frontend_content' );

/**
 * Enqueues the generated stylesheet for a live Code to Block page.
 */
function code_to_block_enqueue_frontend_styles() {
	if ( ! is_singular( CODE_TO_BLOCK_POST_TYPE ) ) {
		return;
	}

	$post_id = get_queried_object_id();
	if ( post_password_required( $post_id ) ) {
		return;
	}
	$document = code_to_block_get_saved_document( $post_id );
	if ( null === $document ) {
		return;
	}
	$asset = Code_To_Block_Renderer::get_stylesheet( $post_id, $document );
	if ( is_wp_error( $asset ) || ! file_exists( $asset['path'] ) ) {
		$asset = Code_To_Block_Renderer::write_stylesheet( $post_id, $document );
	}
	if ( is_wp_error( $asset ) || ! file_exists( $asset['path'] ) ) {
		return;
	}
	Code_To_Block_Renderer::retire_stale_stylesheets( $post_id, $asset['path'] );

	wp_enqueue_style(
		'code-to-block-page-' . $post_id,
		$asset['url'],
		array(),
		null
	);

	$runtime_path = CODE_TO_BLOCK_PATH . 'assets/runtime.js';
	if ( file_exists( $runtime_path ) ) {
		wp_enqueue_script(
			'code-to-block-runtime',
			plugins_url( 'assets/runtime.js', __FILE__ ),
			array(),
			(string) filemtime( $runtime_path ),
			true
		);
	}

	if ( code_to_block_document_needs_gsap( $document ) ) {
		$gsap_asset_path = CODE_TO_BLOCK_PATH . 'build/frontend-gsap.asset.php';
		if ( file_exists( $gsap_asset_path ) ) {
			$gsap_asset = require $gsap_asset_path;
			wp_enqueue_script(
				'code-to-block-gsap',
				plugins_url( 'build/frontend-gsap.js', __FILE__ ),
				$gsap_asset['dependencies'],
				$gsap_asset['version'],
				true
			);
		}
	}
}
add_action( 'wp_enqueue_scripts', 'code_to_block_enqueue_frontend_styles' );

/**
 * Outputs SEO meta and JSON-LD for a Code to Block page.
 */
function code_to_block_output_seo_head() {
	if ( ! is_singular( CODE_TO_BLOCK_POST_TYPE ) ) {
		return;
	}
	$post_id = get_queried_object_id();
	if ( post_password_required( $post_id ) ) {
		return;
	}
	$document = code_to_block_get_saved_document( $post_id );
	if ( null === $document ) {
		return;
	}
	Code_To_Block_SEO::output_head( $post_id, $document );
}
add_action( 'wp_head', 'code_to_block_output_seo_head', 5 );

/**
 * Emits preserved imported scripts only in the separate frontend document.
 * The visual editor never calls these hooks, so imported code cannot reach the
 * builder shell. Preview windows are opened without an opener reference.
 */
function code_to_block_output_imported_head_scripts() {
	if ( ! is_singular( CODE_TO_BLOCK_POST_TYPE ) ) {
		return;
	}
	$post_id = get_queried_object_id();
	if ( post_password_required( $post_id ) ) {
		return;
	}
	$document = code_to_block_get_saved_document( $post_id );
	if ( null !== $document ) {
		echo Code_To_Block_Renderer::render_imported_scripts( $document, is_preview(), 'head' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- validated script assets.
	}
}
add_action( 'wp_head', 'code_to_block_output_imported_head_scripts', 99 );

function code_to_block_output_imported_footer_scripts() {
	if ( ! is_singular( CODE_TO_BLOCK_POST_TYPE ) ) {
		return;
	}
	$post_id = get_queried_object_id();
	if ( post_password_required( $post_id ) ) {
		return;
	}
	$document = code_to_block_get_saved_document( $post_id );
	if ( null === $document ) {
		return;
	}
	$preview = is_preview();
	echo Code_To_Block_Renderer::render_imported_scripts( $document, $preview, 'body' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- validated script assets.
	echo Code_To_Block_Renderer::render_imported_scripts( $document, $preview, 'body-end' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- validated script assets.
}
add_action( 'wp_footer', 'code_to_block_output_imported_footer_scripts', 99 );

/**
 * Uses a full-canvas public template while retaining WordPress head/footer hooks.
 *
 * @param string $template Theme-selected template path.
 * @return string
 */
function code_to_block_frontend_template( $template ) {
	if ( is_singular( CODE_TO_BLOCK_POST_TYPE ) ) {
		$plugin_template = CODE_TO_BLOCK_PATH . 'templates/singular-ctb-page.php';
		if ( file_exists( $plugin_template ) ) {
			return $plugin_template;
		}
	}

	return $template;
}
add_filter( 'template_include', 'code_to_block_frontend_template' );

/**
 * Removes generated files when their owning post is permanently deleted.
 *
 * @param int     $post_id Post ID.
 * @param WP_Post $post    Post object.
 */
function code_to_block_delete_frontend_styles( $post_id, $post ) {
	if ( $post instanceof WP_Post && CODE_TO_BLOCK_POST_TYPE === $post->post_type ) {
		Code_To_Block_Renderer::delete_stylesheet( $post_id );
		Code_To_Block_Shortcodes::delete_for_post( $post_id );
	}
}
add_action( 'before_delete_post', 'code_to_block_delete_frontend_styles', 10, 2 );

/**
 * Removes public generated CSS when a page is moved to the trash.
 *
 * @param int $post_id Post ID.
 */
function code_to_block_trash_frontend_styles( $post_id ) {
	if ( CODE_TO_BLOCK_POST_TYPE === get_post_type( (int) $post_id ) ) {
		Code_To_Block_Renderer::delete_stylesheet( $post_id );
	}
}
add_action( 'wp_trash_post', 'code_to_block_trash_frontend_styles' );

/**
 * Excludes Code to Block assets from third-party optimization/minification plugins.
 *
 * @param string $tag    HTML for the script/style tag.
 * @param string $handle Registered handle.
 * @return string
 */
function code_to_block_exclude_from_optimization( $tag, $handle ) {
	if ( strpos( $handle, 'code-to-block-' ) !== 0 ) {
		return $tag;
	}

	$exclusions = ' data-no-optimize="1" data-cfasync="false" data-noptimize="1" data-minify="false" ';
	
	if ( strpos( $tag, '<script' ) === 0 ) {
		return str_replace( '<script ', '<script' . $exclusions, $tag );
	}
	if ( strpos( $tag, '<link' ) === 0 ) {
		return str_replace( '<link ', '<link' . $exclusions, $tag );
	}
	
	return $tag;
}
add_filter( 'script_loader_tag', 'code_to_block_exclude_from_optimization', 10, 2 );
add_filter( 'style_loader_tag', 'code_to_block_exclude_from_optimization', 10, 2 );

/**
 * Makes the post type's rewrite rules available immediately after activation.
 */
function code_to_block_activate() {
	code_to_block_register_post_type();
	Code_To_Block_Forms::install();
	flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'code_to_block_activate' );

function code_to_block_register_form_routes() {
	register_rest_route(
		'code-to-block/v1',
		'/forms/(?P<post_id>\d+)/submit',
		array(
			'methods'             => 'POST',
			'callback'            => array( 'Code_To_Block_Forms', 'handle_submit' ),
			'permission_callback' => '__return_true',
			'args'                => array(
				'post_id' => array(
					'description' => 'The Code to Block page ID.',
					'type'        => 'integer',
					'minimum'     => 1,
					'required'    => true,
					'sanitize_callback' => 'absint',
				),
			),
		)
	);
}
add_action( 'rest_api_init', 'code_to_block_register_form_routes' );

function code_to_block_forms_admin_menu() {
	Code_To_Block_Forms::admin_menu();
}
add_action( 'admin_menu', 'code_to_block_forms_admin_menu' );

/**
 * Removes rewrite rules created for the post type.
 */
function code_to_block_deactivate() {
	flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'code_to_block_deactivate' );

