<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST endpoints for loading and saving block trees.
 */
final class Code_To_Block_REST_Controller {
	const NAMESPACE = 'code-to-block/v1';

	/**
	 * Registers load and save routes.
	 */
	public function register_routes() {
		register_rest_route(
			self::NAMESPACE,
			'/pages/(?P<post_id>\d+)/block-tree',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'load' ),
					'permission_callback' => array( $this, 'permissions_check' ),
					'args'                => $this->post_id_args(),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'save' ),
					'permission_callback' => array( $this, 'permissions_check' ),
					'args'                => $this->post_id_args(),
				),
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/pages/(?P<post_id>\d+)/php-shortcodes',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'review_php' ),
					'permission_callback' => array( $this, 'php_permissions_check' ),
					'args'                => $this->post_id_args(),
				),
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/pages/(?P<post_id>\d+)/components',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'list_components' ),
					'permission_callback' => array( $this, 'permissions_check' ),
					'args'                => $this->post_id_args(),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_component' ),
					'permission_callback' => array( $this, 'component_create_permissions_check' ),
					'args'                => $this->post_id_args(),
				),
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/pages/(?P<post_id>\d+)/parity',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'parity' ),
					'permission_callback' => array( $this, 'permissions_check' ),
					'args'                => $this->post_id_args(),
				),
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/pages/(?P<post_id>\d+)/diagnostics',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'diagnostics' ),
					'permission_callback' => array( $this, 'permissions_check' ),
					'args'                => $this->post_id_args(),
				),
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/pages/(?P<post_id>\d+)/content',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'load_content' ),
					'permission_callback' => array( $this, 'permissions_check' ),
					'args'                => $this->post_id_args(),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'save_content' ),
					'permission_callback' => array( $this, 'permissions_check' ),
					'args'                => $this->post_id_args(),
				),
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/pages/(?P<post_id>\d+)/components/(?P<component_id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'load_component' ),
					'permission_callback' => array( $this, 'permissions_check' ),
					'args'                => $this->component_args(),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( $this, 'update_component' ),
					'permission_callback' => array( $this, 'component_permissions_check' ),
					'args'                => $this->component_args(),
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( $this, 'delete_component' ),
					'permission_callback' => array( $this, 'component_delete_permissions_check' ),
					'args'                => $this->component_args(),
				),
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/pages/(?P<post_id>\d+)/products',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'products' ),
					'permission_callback' => array( $this, 'permissions_check' ),
					'args'                => $this->post_id_args(),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_product' ),
					'permission_callback' => array( $this, 'product_create_permissions_check' ),
					'args'                => $this->post_id_args(),
				),
			)
		);
		register_rest_route(
			self::NAMESPACE,
			'/pages/(?P<post_id>\d+)/products/(?P<product_id>\d+)',
			array(
				array(
					'methods'             => 'PUT',
					'callback'            => array( $this, 'update_product' ),
					'permission_callback' => array( $this, 'product_permissions_check' ),
					'args'                => $this->product_args(),
				),
			)
		);
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return true|WP_Error
	 */
	public function permissions_check( $request ) {
		$post_id = (int) $request['post_id'];
		$post    = get_post( $post_id );

		if ( ! $post || CODE_TO_BLOCK_POST_TYPE !== $post->post_type ) {
			return new WP_Error(
				'code_to_block_page_not_found',
				__( 'Code to Block page not found.', 'code-to-block' ),
				array( 'status' => 404 )
			);
		}

		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return new WP_Error(
				'code_to_block_forbidden',
				__( 'You are not allowed to edit this page.', 'code-to-block' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}
		if ( 'trash' === $post->post_status ) {
			return new WP_Error(
				'code_to_block_page_trashed',
				__( 'Trashed Code to Block pages cannot be loaded or saved.', 'code-to-block' ),
				array( 'status' => 410 )
			);
		}

		return true;
	}

	/**
	 * Restricts PHP review and registration to administrators who can edit the
	 * specific owning page.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return true|WP_Error
	 */
	public function php_permissions_check( $request ) {
		$page_permission = $this->permissions_check( $request );
		if ( is_wp_error( $page_permission ) ) {
			return $page_permission;
		}
		if ( ! Code_To_Block_Shortcodes::current_user_can_register( (int) $request['post_id'] ) ) {
			return new WP_Error(
				'code_to_block_php_forbidden',
				__( 'PHP registration requires trusted administrator code privileges and may be disabled by site policy.', 'code-to-block' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}

		return true;
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return true|WP_Error
	 */
	public function component_permissions_check( $request ) {
		$page_permission = $this->permissions_check( $request );
		if ( is_wp_error( $page_permission ) ) {
			return $page_permission;
		}
		$component_id = (int) $request['component_id'];
		$post = get_post( $component_id );
		if ( ! $post || CODE_TO_BLOCK_COMPONENT_POST_TYPE !== $post->post_type || 'trash' === $post->post_status ) {
			return new WP_Error(
				'code_to_block_component_not_found',
				__( 'Saved component not found.', 'code-to-block' ),
				array( 'status' => 404 )
			);
		}
		if ( ! current_user_can( 'edit_post', $component_id ) ) {
			return new WP_Error(
				'code_to_block_component_forbidden',
				__( 'You are not allowed to edit this saved component.', 'code-to-block' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}
		return true;
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return true|WP_Error
	 */
	public function component_create_permissions_check( $request ) {
		$page_permission = $this->permissions_check( $request );
		if ( is_wp_error( $page_permission ) ) {
			return $page_permission;
		}
		if ( ! current_user_can( 'edit_posts' ) || ! current_user_can( 'publish_posts' ) ) {
			return new WP_Error(
				'code_to_block_component_forbidden',
				__( 'You are not allowed to create saved components.', 'code-to-block' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}
		return true;
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return true|WP_Error
	 */
	public function component_delete_permissions_check( $request ) {
		$permission = $this->component_permissions_check( $request );
		if ( is_wp_error( $permission ) ) {
			return $permission;
		}
		if ( ! current_user_can( 'delete_post', (int) $request['component_id'] ) ) {
			return new WP_Error(
				'code_to_block_component_forbidden',
				__( 'You are not allowed to delete this saved component.', 'code-to-block' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}
		return true;
	}

	/**
	 * Requires both access to the owning builder page and permission to create
	 * WooCommerce products.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return true|WP_Error
	 */
	public function product_create_permissions_check( $request ) {
		$page_permission = $this->permissions_check( $request );
		if ( is_wp_error( $page_permission ) ) {
			return $page_permission;
		}
		if ( ! current_user_can( 'edit_products' ) ) {
			return new WP_Error(
				'code_to_block_product_forbidden',
				__( 'You are not allowed to create WooCommerce products.', 'code-to-block' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}
		return true;
	}

	/**
	 * Requires access to both the owning builder page and the selected product.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return true|WP_Error
	 */
	public function product_permissions_check( $request ) {
		$page_permission = $this->permissions_check( $request );
		if ( is_wp_error( $page_permission ) ) {
			return $page_permission;
		}
		$product_id = (int) $request['product_id'];
		$product_post = get_post( $product_id );
		if ( ! $product_post || 'product' !== $product_post->post_type || 'trash' === $product_post->post_status ) {
			return new WP_Error(
				'code_to_block_product_not_found',
				__( 'WooCommerce product not found.', 'code-to-block' ),
				array( 'status' => 404 )
			);
		}
		if ( ! current_user_can( 'edit_post', $product_id ) ) {
			return new WP_Error(
				'code_to_block_product_forbidden',
				__( 'You are not allowed to edit this WooCommerce product.', 'code-to-block' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}
		return true;
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function diagnostics( $request ) {
		$post_id = (int) $request['post_id'];
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		$active = get_option( 'active_plugins', array() );
		if ( is_multisite() ) {
			$network = get_site_option( 'active_sitewide_plugins', array() );
			$active = array_merge( $active, array_keys( $network ) );
		}
		$all_plugins = function_exists( 'get_plugins' ) ? get_plugins() : array();
		$flagged_keywords = array( 'cart', 'checkout', 'ajax', 'payment', 'stripe', 'paypal', 'woo', 'cache', 'optimize', 'minify', 'autoptimize', 'rocket' );
		$plugins = array();
		foreach ( $active as $plugin_file ) {
			$data = isset( $all_plugins[ $plugin_file ] ) ? $all_plugins[ $plugin_file ] : array( 'Name' => $plugin_file );
			$lower = strtolower( $plugin_file . ' ' . ( isset( $data['Name'] ) ? $data['Name'] : '' ) );
			$flagged = false;
			$reason = '';
			foreach ( $flagged_keywords as $kw ) {
				if ( false !== strpos( $lower, $kw ) ) {
					$flagged = true;
					$reason = 'matches keyword ' . $kw . ' — may hook cart/checkout/session or optimization';
					break;
				}
			}
			// Never flag self
			if ( false !== strpos( $plugin_file, 'code-to-block' ) ) {
				$flagged = false;
				$reason = '';
			}
			$plugins[] = array(
				'file'    => $plugin_file,
				'name'    => isset( $data['Name'] ) ? $data['Name'] : $plugin_file,
				'version' => isset( $data['Version'] ) ? $data['Version'] : '',
				'flagged' => $flagged,
				'reason'  => $reason,
			);
		}
		$has_woo = class_exists( 'WooCommerce' ) || function_exists( 'WC' ) || function_exists( 'wc_get_product' );
		$document = null;
		$json = get_post_meta( $post_id, CODE_TO_BLOCK_META_KEY, true );
		if ( is_string( $json ) && '' !== $json ) {
			$decoded = json_decode( $json, true );
			if ( JSON_ERROR_NONE === json_last_error() ) {
				$document = Code_To_Block_Schema::sanitize_document( $decoded );
				if ( is_wp_error( $document ) ) $document = null;
			}
		}
		$commerce_blocks = 0;
		if ( $document && isset( $document['root'] ) ) {
			$count_woo = function ( $block ) use ( &$count_woo ) {
				$c = in_array( $block['type'], array( 'woocommerce_product', 'woocommerce_product_grid', 'woocommerce_cart', 'woocommerce_checkout' ), true ) ? 1 : 0;
				if ( ! empty( $block['is_dynamic'] ) ) $c++;
				foreach ( $block['children'] as $child ) {
					if ( isset( $child['kind'] ) ) continue;
					$c += $count_woo( $child );
				}
				return $c;
			};
			$commerce_blocks = $count_woo( $document['root'] );
		}
		return new WP_REST_Response( array(
			'post_id'         => $post_id,
			'has_woo'         => $has_woo,
			'commerce_blocks' => $commerce_blocks,
			'plugins'         => $plugins,
			'note'            => 'Isolation is diagnostic-only: no plugins are deactivated. If behavior differs when WooCommerce Blocks are rendered with other plugins disabled via safe mode, consider the flagged list above. Flagging is heuristic, not definitive.',
		), 200 );
	}

	/**
	 * Returns normalized WooCommerce data for the dedicated editor canvas.
	 *
	 * @return WP_REST_Response
	 */
	public function products() {
		return rest_ensure_response(
			array(
				'available'     => function_exists( 'wc_get_products' ),
				'products'      => Code_To_Block_Commerce::products(),
				'cart_html'     => Code_To_Block_Commerce::cart_preview(),
				'checkout_html' => Code_To_Block_Commerce::checkout_preview(),
			)
		);
	}

	/**
	 * Creates a WooCommerce product without leaving the builder.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_product( $request ) {
		if ( ! class_exists( 'WC_Product_Simple' ) || ! class_exists( 'WC_Product_Variable' ) ) {
			return new WP_Error( 'woocommerce_not_available', 'WooCommerce is not available', array( 'status' => 501 ) );
		}
		$product = Code_To_Block_Commerce::create_product( $request->get_json_params() );
		if ( is_wp_error( $product ) ) {
			return $product;
		}
		return new WP_REST_Response(
			array(
				'success' => true,
				'product' => $product,
			),
			201
		);
	}

	/**
	 * Updates editable WooCommerce product data through the commerce adapter.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_product( $request ) {
		if ( ! function_exists( 'wc_get_product' ) ) {
			return new WP_Error( 'woocommerce_not_available', 'WooCommerce is not available', array( 'status' => 501 ) );
		}
		$product_id = (int) $request['product_id'];
		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return new WP_Error( 'product_not_found', 'Product not found', array( 'status' => 404 ) );
		}

		$preview = Code_To_Block_Commerce::update_product( $product, $request->get_json_params() );
		if ( is_wp_error( $preview ) ) {
			return $preview;
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'product' => $preview,
			)
		);
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function parity( $request ) {
		$json = get_post_meta( (int) $request['post_id'], CODE_TO_BLOCK_META_KEY, true );
		if ( ! is_string( $json ) || '' === $json ) {
			return new WP_REST_Response( array( 'warnings' => array() ), 200 );
		}
		$decoded = json_decode( $json );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			return new WP_REST_Response( array( 'warnings' => array() ), 200 );
		}
		$document = Code_To_Block_Schema::sanitize_document( $decoded );
		if ( is_wp_error( $document ) ) {
			return new WP_REST_Response( array( 'warnings' => array() ), 200 );
		}
		$snapshot_json = get_post_meta( (int) $request['post_id'], Code_To_Block_Parity::EDITOR_SNAPSHOT_META_KEY, true );
		$snapshot      = null;
		if ( is_string( $snapshot_json ) && '' !== $snapshot_json ) {
			$snapshot = json_decode( $snapshot_json, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				$snapshot = null;
			}
		}
		$warnings = Code_To_Block_Parity::check( $document, (int) $request['post_id'], $snapshot );
		return new WP_REST_Response( array( 'warnings' => $warnings ), 200 );
	}

	/**
	 * @return WP_REST_Response
	 */
	public function list_components() {
		return new WP_REST_Response( Code_To_Block_Components::all(), 200 );
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_component( $request ) {
		$payload = $this->component_payload( $request );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}
		$component = Code_To_Block_Components::create( $payload );
		return is_wp_error( $component ) ? $component : new WP_REST_Response( $component, 201 );
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function load_component( $request ) {
		$component = Code_To_Block_Components::get( (int) $request['component_id'] );
		return is_wp_error( $component ) ? $component : new WP_REST_Response( $component, 200 );
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_component( $request ) {
		$payload = $this->component_payload( $request );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}
		$component = Code_To_Block_Components::update( (int) $request['component_id'], $payload );
		return is_wp_error( $component ) ? $component : new WP_REST_Response( $component, 200 );
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_component( $request ) {
		$deleted = wp_delete_post( (int) $request['component_id'], true );
		if ( ! $deleted ) {
			return new WP_Error(
				'code_to_block_component_delete_failed',
				__( 'The saved component could not be deleted.', 'code-to-block' ),
				array( 'status' => 500 )
			);
		}
		return new WP_REST_Response( array( 'deleted' => true ), 200 );
	}

	/**
	 * Reviews PHP without execution, or registers it after exact confirmation.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function review_php( $request ) {
		$body = $request->get_body();
		if ( strlen( $body ) > Code_To_Block_Schema::MAX_JSON_BYTES ) {
			return new WP_Error(
				'code_to_block_php_request_too_large',
				__( 'The PHP review request cannot exceed 2 MB.', 'code-to-block' ),
				array( 'status' => 413 )
			);
		}
		$payload = json_decode( $body, true );
		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $payload ) ) {
			return new WP_Error(
				'code_to_block_php_invalid_json',
				__( 'The PHP review request must contain a JSON object.', 'code-to-block' ),
				array( 'status' => 400 )
			);
		}
		$tag  = isset( $payload['tag'] ) ? $payload['tag'] : '';
		$code = isset( $payload['code'] ) ? $payload['code'] : '';

		if ( isset( $payload['register'] ) && true === $payload['register'] ) {
			$result = Code_To_Block_Shortcodes::register_reviewed(
				(int) $request['post_id'],
				$tag,
				$code,
				isset( $payload['reviewed_hash'] ) ? $payload['reviewed_hash'] : '',
				isset( $payload['confirmation'] ) ? $payload['confirmation'] : ''
			);
			return is_wp_error( $result ) ? $result : new WP_REST_Response( $result, 201 );
		}

		$result = Code_To_Block_Shortcodes::review_source( $tag, $code );
		return is_wp_error( $result ) ? $result : new WP_REST_Response( $result, 200 );
	}

	/**
	 * Applies content-slot and SEO patches to the latest saved document.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function save_content( $request ) {
		$body = $request->get_body();
		if ( strlen( $body ) > Code_To_Block_Schema::MAX_JSON_BYTES ) {
			return new WP_Error(
				'code_to_block_content_request_too_large',
				__( 'The content update request cannot exceed 2 MB.', 'code-to-block' ),
				array( 'status' => 413 )
			);
		}
		$payload = json_decode( $body, true );
		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $payload ) ) {
			return new WP_Error(
				'code_to_block_content_invalid_json',
				__( 'The content update request must contain a JSON object.', 'code-to-block' ),
				array( 'status' => 400 )
			);
		}

		$slots = isset( $payload['slots'] ) ? $payload['slots'] : array();
		$seo   = isset( $payload['seo'] ) ? $payload['seo'] : array();
		if ( ! is_array( $slots ) || ! is_array( $seo ) || count( $slots ) > Code_To_Block_Schema::MAX_BLOCKS ) {
			return new WP_Error(
				'code_to_block_content_invalid_patch',
				__( 'The content update has an invalid shape.', 'code-to-block' ),
				array( 'status' => 400 )
			);
		}

		$post_id  = (int) $request['post_id'];
		$document = $this->load_saved_document( $post_id );
		if ( is_wp_error( $document ) ) {
			return $document;
		}
		$existing_document = $document;

		foreach ( $slots as $block_id => $value ) {
			if ( ! is_string( $block_id ) || ! is_string( $value ) || strlen( $value ) > Code_To_Block_Schema::MAX_STRING_BYTES ) {
				return new WP_Error(
					'code_to_block_content_invalid_slot',
					__( 'A content slot update is invalid.', 'code-to-block' ),
					array( 'status' => 400 )
				);
			}
			$updated = false;
			$slot_type = null;
			self::patch_slot( $document['root'], $block_id, $value, $updated, $slot_type );
			if ( ! $updated ) {
				$resolved = Code_To_Block_Components::resolve_document( $document );
				if ( is_wp_error( $resolved ) ) {
					return $resolved;
				}
				self::patch_slot( $resolved['root'], $block_id, $value, $updated, $slot_type );
				if ( ! $updated ) {
					return new WP_Error(
						'code_to_block_content_slot_changed',
						__( 'A content slot no longer exists. Reload Content Mode and try again.', 'code-to-block' ),
						array( 'status' => 409 )
					);
				}
				if ( in_array( $slot_type, array( 'image', 'link' ), true ) ) {
					$clean_url = Code_To_Block_Schema::sanitize_resource_url( $value, 'link' === $slot_type );
					if ( '' !== trim( $value ) && '' === $clean_url ) {
						return new WP_Error(
							'code_to_block_content_invalid_slot',
							__( 'A content slot URL is not allowed.', 'code-to-block' ),
							array( 'status' => 400 )
						);
					}
					$value = $clean_url;
				} elseif ( 'rich_text' === $slot_type ) {
					$value = Code_To_Block_Schema::sanitize_rich_text( $value );
				}
				if ( ! isset( $document['slot_values'] ) || ! is_array( $document['slot_values'] ) ) {
					$document['slot_values'] = array();
				}
				$document['slot_values'][ $block_id ] = $value;
			}
		}

		if ( ! empty( $seo ) ) {
			$allowed   = array( 'title', 'description', 'canonical', 'og_title', 'og_description', 'og_image' );
			$candidate = isset( $document['seo'] ) && is_array( $document['seo'] ) ? $document['seo'] : array();
			foreach ( $seo as $key => $value ) {
				if ( ! in_array( $key, $allowed, true ) || ! is_string( $value ) ) {
					return new WP_Error(
						'code_to_block_content_invalid_seo',
						__( 'An SEO content update is invalid.', 'code-to-block' ),
						array( 'status' => 400 )
					);
				}
				if ( '' === trim( $value ) ) {
					unset( $candidate[ $key ] );
				} else {
					$candidate[ $key ] = $value;
				}
			}
			$sanitized_seo = Code_To_Block_SEO::sanitize_seo( $candidate, '$.seo' );
			if ( is_wp_error( $sanitized_seo ) ) {
				return $sanitized_seo;
			}
			if ( empty( $sanitized_seo ) ) {
				unset( $document['seo'] );
			} else {
				$document['seo'] = $sanitized_seo;
			}
		}

		$document = Code_To_Block_Schema::sanitize_document( $document );
		if ( is_wp_error( $document ) ) {
			return $document;
		}
		$permission = Code_To_Block_Element_Permissions::validate_update( $existing_document, $document );
		if ( is_wp_error( $permission ) ) {
			return $permission;
		}
		return $this->persist_document( $document, $post_id, $this->stored_editor_snapshot( $post_id ), null, true );
	}

	/**
	 * Loads the resolved document used by Content Mode, including component slots.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function load_content( $request ) {
		$document = $this->load_saved_document( (int) $request['post_id'] );
		if ( is_wp_error( $document ) ) {
			return $document;
		}
		$resolved = Code_To_Block_Components::resolve_document( $document );
		return is_wp_error( $resolved ) ? $resolved : new WP_REST_Response( $resolved, 200 );
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function save( $request ) {
		$body = $request->get_body();
		if ( strlen( $body ) > Code_To_Block_Schema::MAX_JSON_BYTES * 2 ) {
			return new WP_Error(
				'code_to_block_request_too_large',
				__( 'The block tree request cannot exceed 2 MB.', 'code-to-block' ),
				array( 'status' => 413 )
			);
		}
		$payload = json_decode( $body );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			return new WP_Error(
				'code_to_block_invalid_json',
				__( 'The request body must contain valid JSON.', 'code-to-block' ),
				array( 'status' => 400 )
			);
		}

		$document_payload = $payload;
		$editor_snapshot  = null;
		$has_snapshot     = false;
		if ( is_object( $payload ) && isset( $payload->document ) ) {
			$document_payload = $payload->document;
			$has_snapshot     = property_exists( $payload, 'editor_styles' );
			$editor_snapshot  = $has_snapshot ? Code_To_Block_Parity::sanitize_editor_snapshot( $payload->editor_styles ) : null;
			if ( $has_snapshot && null === $editor_snapshot ) {
				return new WP_Error(
					'code_to_block_invalid_editor_snapshot',
					__( 'The editor style snapshot is invalid.', 'code-to-block' ),
					array( 'status' => 400 )
				);
			}
		}

		$document = Code_To_Block_Schema::sanitize_document( $document_payload );
		if ( is_wp_error( $document ) ) {
			return $document;
		}

		$post_id = (int) $request['post_id'];
		$stored_json = get_post_meta( $post_id, CODE_TO_BLOCK_META_KEY, true );
		if ( is_string( $stored_json ) && '' !== $stored_json ) {
			$existing = $this->load_saved_document( $post_id );
			if ( is_wp_error( $existing ) ) {
				return $existing;
			}
			$permission = Code_To_Block_Element_Permissions::validate_update( $existing, $document );
			if ( is_wp_error( $permission ) ) {
				return $permission;
			}
		}
		return $this->persist_document( $document, $post_id, $editor_snapshot, $has_snapshot );
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function load( $request ) {
		$json = get_post_meta( (int) $request['post_id'], CODE_TO_BLOCK_META_KEY, true );
		if ( ! is_string( $json ) || '' === $json ) {
			return new WP_Error(
				'code_to_block_tree_not_found',
				__( 'No block tree has been saved for this page.', 'code-to-block' ),
				array( 'status' => 404 )
			);
		}

		$document = json_decode( $json );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			return new WP_Error(
				'code_to_block_corrupt_tree',
				__( 'The saved block tree is not valid JSON.', 'code-to-block' ),
				array( 'status' => 500 )
			);
		}

		$document = Code_To_Block_Schema::sanitize_document( $document );
		if ( is_wp_error( $document ) ) {
			return new WP_Error(
				'code_to_block_corrupt_tree',
				__( 'The saved block tree does not match the supported schema.', 'code-to-block' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response( $document, 200 );
	}

	/**
	 * @return array
	 */
	private function post_id_args() {
		return array(
			'post_id' => array(
				'description'       => __( 'The Code to Block page ID.', 'code-to-block' ),
				'type'              => 'integer',
				'minimum'           => 1,
				'required'          => true,
				'sanitize_callback' => 'absint',
			),
		);
	}

	/**
	 * @return array
	 */
	private function component_args() {
		return array_merge(
			$this->post_id_args(),
			array(
				'component_id' => array(
					'description'       => __( 'The saved component ID.', 'code-to-block' ),
					'type'              => 'integer',
					'minimum'           => 1,
					'required'          => true,
					'sanitize_callback' => 'absint',
				),
			)
		);
	}

	/**
	 * @return array
	 */
	private function product_args() {
		return array_merge(
			$this->post_id_args(),
			array(
				'product_id' => array(
					'description'       => __( 'The WooCommerce product ID.', 'code-to-block' ),
					'type'              => 'integer',
					'minimum'           => 1,
					'required'          => true,
					'sanitize_callback' => 'absint',
				),
			)
		);
	}

	/**
	 * @param WP_REST_Request $request Request object.
	 * @return mixed|WP_Error
	 */
	private function component_payload( $request ) {
		$body = $request->get_body();
		if ( strlen( $body ) > Code_To_Block_Schema::MAX_JSON_BYTES ) {
			return new WP_Error(
				'code_to_block_component_request_too_large',
				__( 'The saved component request cannot exceed 2 MB.', 'code-to-block' ),
				array( 'status' => 413 )
			);
		}
		$payload = json_decode( $body );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			return new WP_Error(
				'code_to_block_component_invalid_json',
				__( 'The saved component request must contain valid JSON.', 'code-to-block' ),
				array( 'status' => 400 )
			);
		}
		return $payload;
	}

	private function load_saved_document( $post_id ) {
		$json = get_post_meta( $post_id, CODE_TO_BLOCK_META_KEY, true );
		if ( ! is_string( $json ) || '' === $json ) {
			return new WP_Error( 'code_to_block_tree_not_found', __( 'No block tree has been saved for this page.', 'code-to-block' ), array( 'status' => 404 ) );
		}
		$document = json_decode( $json );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			return new WP_Error( 'code_to_block_corrupt_tree', __( 'The saved block tree is not valid JSON.', 'code-to-block' ), array( 'status' => 500 ) );
		}
		$document = Code_To_Block_Schema::sanitize_document( $document );
		return is_wp_error( $document )
			? new WP_Error( 'code_to_block_corrupt_tree', __( 'The saved block tree does not match the supported schema.', 'code-to-block' ), array( 'status' => 500 ) )
			: $document;
	}

	private static function patch_slot( &$block, $block_id, $value, &$updated, &$slot_type = null ) {
		if ( isset( $block['id'] ) && $block_id === $block['id'] ) {
			if ( empty( $block['is_content_slot'] ) || empty( $block['slot_content_type'] ) ) {
				return;
			}
			$slot_type = $block['slot_content_type'];
			if ( in_array( $block['slot_content_type'], array( 'text', 'rich_text' ), true ) ) {
				$block['children'] = array(
					array(
						'kind'  => 'text',
						'value' => 'rich_text' === $block['slot_content_type'] ? Code_To_Block_Schema::sanitize_rich_text( $value ) : $value,
					),
				);
			} elseif ( 'image' === $block['slot_content_type'] ) {
				$block['attributes'] = is_object( $block['attributes'] ) ? get_object_vars( $block['attributes'] ) : $block['attributes'];
				$block['attributes']['src'] = $value;
			} elseif ( 'link' === $block['slot_content_type'] ) {
				$block['attributes'] = is_object( $block['attributes'] ) ? get_object_vars( $block['attributes'] ) : $block['attributes'];
				$block['attributes']['href'] = $value;
			} else {
				return;
			}
			$updated = true;
			return;
		}
		foreach ( $block['children'] as &$child ) {
			if ( ! isset( $child['kind'] ) ) {
				self::patch_slot( $child, $block_id, $value, $updated, $slot_type );
				if ( $updated ) {
					break;
				}
			}
		}
		unset( $child );
	}

	private function stored_editor_snapshot( $post_id ) {
		$json = get_post_meta( $post_id, Code_To_Block_Parity::EDITOR_SNAPSHOT_META_KEY, true );
		if ( ! is_string( $json ) || '' === $json ) {
			return null;
		}
		$snapshot = json_decode( $json, true );
		return JSON_ERROR_NONE === json_last_error() ? Code_To_Block_Parity::sanitize_editor_snapshot( $snapshot ) : null;
	}

	private function persist_document( $document, $post_id, $editor_snapshot, $update_snapshot, $resolved_response = false ) {
		$json = wp_json_encode( $document, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( false === $json ) {
			return new WP_Error( 'code_to_block_encode_failed', __( 'The block tree could not be encoded.', 'code-to-block' ), array( 'status' => 500 ) );
		}
		$resolved = Code_To_Block_Components::resolve_document( $document );
		if ( is_wp_error( $resolved ) ) {
			return $resolved;
		}
		$stylesheet = Code_To_Block_Renderer::write_stylesheet( $post_id, $resolved );
		if ( is_wp_error( $stylesheet ) ) {
			return $stylesheet;
		}
		$updated = update_post_meta( $post_id, CODE_TO_BLOCK_META_KEY, wp_slash( $json ) );
		if ( false === $updated && $json !== get_post_meta( $post_id, CODE_TO_BLOCK_META_KEY, true ) ) {
			return new WP_Error( 'code_to_block_save_failed', __( 'The block tree could not be saved.', 'code-to-block' ), array( 'status' => 500 ) );
		}
		Code_To_Block_Renderer::retire_stale_stylesheets( $post_id, $stylesheet['path'] );
		Code_To_Block_Shortcodes::retain_for_document( $post_id, $document );
		if ( true === $update_snapshot ) {
			$snapshot_json = wp_json_encode( $editor_snapshot, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
			update_post_meta( $post_id, Code_To_Block_Parity::EDITOR_SNAPSHOT_META_KEY, wp_slash( $snapshot_json ) );
		} elseif ( false === $update_snapshot ) {
			delete_post_meta( $post_id, Code_To_Block_Parity::EDITOR_SNAPSHOT_META_KEY );
		}
		return new WP_REST_Response(
			array(
				'document'        => $resolved_response ? $resolved : $document,
				'parity_warnings' => Code_To_Block_Parity::check( $document, $post_id, $editor_snapshot ),
			),
			200
		);
	}
}
