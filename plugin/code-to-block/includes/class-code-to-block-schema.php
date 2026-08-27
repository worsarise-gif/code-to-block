<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates and normalizes version 1 block documents.
 */
final class Code_To_Block_Schema {
	const VERSION = 1;
	const MAX_JSON_BYTES = 2097152;
	const MAX_BLOCKS = 1000;
	const MAX_DEPTH = 50;
	const MAX_ACTIONS = 100;
	const MAX_HISTORY_ENTRIES = 100;
	const MAX_DESIGN_TOKENS = 100;
	const MAX_CSS_MAPPING_DECLARATIONS = 1000;
	const MAX_STRING_BYTES = 131072;

	const BLOCK_TYPES = array( 'container', 'text', 'image', 'button', 'woocommerce_cart', 'woocommerce_checkout', 'woocommerce_product', 'woocommerce_product_grid', 'form', 'form_field' );
	const RUNTIME_ACTIONS = array( 'toggle-class', 'add-class', 'remove-class', 'show', 'hide', 'toggle-visibility' );
	const ANIMATION_ACTIONS = array( 'scroll-scrub', 'stagger-sequence' );
	const CSS_ANIMATION_ACTIONS = array( 'css-reveal' );
	const TOKEN_CATEGORIES = array( 'colors', 'typography', 'spacing' );
	const CSS_MAPPING_CONTROLS = array(
		'color', 'padding', 'margin', 'font-size', 'font-weight', 'border', 'border-radius',
		'display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content',
		'gap', 'row-gap', 'column-gap', 'grid-template-columns', 'grid-template-rows', 'flex-grow',
		'flex-shrink', 'flex-basis', 'align-self', 'order', 'grid-column', 'grid-row', 'width',
		'height', 'max-width', 'min-height', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
		'background', 'background-color', 'background-image', 'background-size', 'background-position',
		'box-shadow', 'opacity', 'filter', 'backdrop-filter', 'transform', 'text-shadow', 'overflow',
	);
	const TOKEN_PROPERTIES = array(
		'colors'     => array( 'color' ),
		'typography' => array( 'font-size', 'font-weight' ),
		'spacing'    => array( 'padding', 'margin', 'border-radius' ),
	);

	const HTML_TAGS = array(
		'a', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'blockquote',
		'br', 'button', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del',
		'details', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
		'fieldset', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr',
		'i', 'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'main', 'mark', 'menu', 'meter',
		'iframe', 'nav', 'ol', 'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby',
		's', 'samp', 'section', 'select', 'small', 'source', 'span', 'strong', 'sub',
		'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'time',
		'tr', 'u', 'ul', 'var', 'wbr',
	);

	const VOID_TAGS = array( 'br', 'col', 'hr', 'img', 'input', 'source', 'wbr' );

	/**
	 * Sanitizes a document or returns a path-specific validation error.
	 *
	 * Unknown structural fields and unsafe event-handler attributes are stripped.
	 * Known values are preserved rather than text-sanitized so valid CSS and text
	 * round-trip unchanged.
	 *
	 * @param mixed  $value Incoming document.
	 * @param string $path  Error path.
	 * @return array|WP_Error
	 */
	public static function sanitize_document( $value, $path = '$' ) {
		$encoded_value = wp_json_encode( $value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( false === $encoded_value ) {
			return self::error( $path, 'must contain encodable finite JSON values' );
		}
		if ( strlen( $encoded_value ) > self::MAX_JSON_BYTES ) {
			return self::error( $path, 'exceeds the 2 MB document limit', 413 );
		}
		$value = self::object_to_array( $value );

		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be a JSON object' );
		}

		foreach ( array( 'schema_version', 'name', 'root' ) as $required ) {
			if ( ! array_key_exists( $required, $value ) ) {
				return self::error( $path . '.' . $required, 'is required' );
			}
		}

		if ( self::VERSION !== $value['schema_version'] ) {
			return self::error( $path . '.schema_version', 'must equal 1' );
		}

		if ( ! is_string( $value['name'] ) || '' === trim( $value['name'] ) ) {
			return self::error( $path . '.name', 'must be a non-empty string' );
		}
		if ( strlen( $value['name'] ) > 500 ) {
			return self::error( $path . '.name', 'must be 500 bytes or fewer' );
		}

		$design_tokens = null;
		if ( array_key_exists( 'design_tokens', $value ) ) {
			$design_tokens = self::sanitize_design_tokens( $value['design_tokens'], $path . '.design_tokens' );
			if ( is_wp_error( $design_tokens ) ) {
				return $design_tokens;
			}
		}

		$seo = null;
		if ( array_key_exists( 'seo', $value ) ) {
			$seo = self::sanitize_seo( $value['seo'], $path . '.seo' );
			if ( is_wp_error( $seo ) ) {
				return $seo;
			}
		}
		$slot_values = null;
		if ( array_key_exists( 'slot_values', $value ) ) {
			$slot_values = self::sanitize_slot_values( $value['slot_values'], $path . '.slot_values' );
			if ( is_wp_error( $slot_values ) ) {
				return $slot_values;
			}
		}
		$history = null;
		if ( array_key_exists( 'history', $value ) ) {
			$history = self::sanitize_history( $value['history'], $path . '.history' );
			if ( is_wp_error( $history ) ) {
				return $history;
			}
		}

		$block_count = 0;
		$root        = self::sanitize_block( $value['root'], $path . '.root', 1, $block_count );
		if ( is_wp_error( $root ) ) {
			return $root;
		}
		$seen       = array();
		$unique_ids = self::validate_unique_ids( $root, $path . '.root', $seen );
		if ( is_wp_error( $unique_ids ) ) {
			return $unique_ids;
		}
		$action_targets = self::validate_action_targets( $root, $path . '.root', $seen );
		if ( is_wp_error( $action_targets ) ) {
			return $action_targets;
		}
		$token_bindings = self::validate_token_bindings(
			$root,
			$path . '.root',
			null === $design_tokens ? new stdClass() : $design_tokens
		);
		if ( is_wp_error( $token_bindings ) ) {
			return $token_bindings;
		}

		$document = array(
			'schema_version' => self::VERSION,
			'name'           => $value['name'],
		);
		if ( null !== $design_tokens && ! empty( get_object_vars( $design_tokens ) ) ) {
			$document['design_tokens'] = $design_tokens;
		}
		if ( null !== $seo && is_array( $seo ) && ! empty( $seo ) ) {
			$document['seo'] = $seo;
		}
		if ( null !== $slot_values && ! empty( $slot_values ) ) {
			$document['slot_values'] = $slot_values;
		}
		if ( null !== $history && ! empty( $history ) ) {
			$document['history'] = $history;
		}
		$document['root'] = $root;
		return $document;
	}

	private static function sanitize_history( $value, $path ) {
		if ( ! is_array( $value ) || count( $value ) > self::MAX_HISTORY_ENTRIES ) {
			return self::error( $path, 'must be an array with no more than 100 entries' );
		}
		$clean = array();
		foreach ( $value as $index => $entry ) {
			$entry = self::object_to_array( $entry );
			if ( ! is_array( $entry ) || ! isset( $entry['id'], $entry['action'], $entry['timestamp'] ) ) {
				return self::error( $path . '[' . $index . ']', 'must contain id, action, and timestamp' );
			}
			if (
				! is_string( $entry['id'] ) || ! preg_match( '/^[a-zA-Z0-9_-]{1,100}$/', $entry['id'] ) ||
				! is_string( $entry['action'] ) || '' === trim( $entry['action'] ) || strlen( $entry['action'] ) > 240 ||
				! is_string( $entry['timestamp'] ) || strlen( $entry['timestamp'] ) > 50 || false === strtotime( $entry['timestamp'] )
			) {
				return self::error( $path . '[' . $index . ']', 'contains an invalid history entry' );
			}
			$clean_entry = array(
				'id'        => $entry['id'],
				'action'    => trim( strip_tags( $entry['action'] ) ),
				'timestamp' => $entry['timestamp'],
			);
			if ( isset( $entry['block_id'] ) && is_string( $entry['block_id'] ) && '' !== trim( $entry['block_id'] ) && strlen( $entry['block_id'] ) <= 500 ) {
				$clean_entry['block_id'] = $entry['block_id'];
			}
			$clean[] = $clean_entry;
		}
		return $clean;
	}

	private static function sanitize_slot_values( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) || count( $value ) > self::MAX_BLOCKS ) {
			return self::error( $path, 'must be an object with no more than 1000 slot values' );
		}
		$clean = array();
		foreach ( $value as $block_id => $slot_value ) {
			if ( ! is_string( $block_id ) || '' === trim( $block_id ) || strlen( $block_id ) > 500 ) {
				return self::error( $path, 'contains an invalid block ID' );
			}
			if ( ! is_string( $slot_value ) || strlen( $slot_value ) > self::MAX_STRING_BYTES ) {
				return self::error( $path . '.' . $block_id, 'must be a string within the normal value limit' );
			}
			$clean[ $block_id ] = $slot_value;
		}
		return $clean;
	}

	/**
	 * Sanitizes a saved component document and rejects nested component links.
	 *
	 * @param mixed $value Incoming component document.
	 * @return array|WP_Error
	 */
	public static function sanitize_component_document( $value ) {
		$document = self::sanitize_document( $value, '$.component' );
		if ( is_wp_error( $document ) ) {
			return $document;
		}
		if ( self::block_contains_saved_component( $document['root'] ) ) {
			return self::error( '$.component.root', 'cannot contain another saved component' );
		}
		if ( self::block_contains_page_shortcode( $document['root'] ) ) {
			return self::error( '$.component.root', 'cannot contain a page-bound PHP shortcode' );
		}
		$dom_ids = array();
		$dom_ids_result = self::collect_component_dom_ids( $document['root'], '$.component.root', $dom_ids );
		if ( is_wp_error( $dom_ids_result ) ) {
			return $dom_ids_result;
		}
		$id_reference_count = 0;
		$id_references = self::validate_component_dom_references( $document['root'], '$.component.root', $dom_ids, $id_reference_count );
		if ( is_wp_error( $id_references ) ) {
			return $id_references;
		}

		return $document;
	}

	/**
	 * Sanitizes registered post meta to a canonical JSON string.
	 *
	 * @param mixed $value Incoming meta value.
	 * @return string
	 */
	public static function sanitize_meta_value( $value ) {
		if ( is_string( $value ) ) {
			$value = json_decode( $value );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return '';
			}
		}

		$document = self::sanitize_document( $value );
		if ( is_wp_error( $document ) ) {
			return '';
		}

		$encoded = wp_json_encode( $document, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		return false === $encoded ? '' : $encoded;
	}

	/**
	 * Limits direct meta writes to users who can edit the owning post.
	 *
	 * @param bool   $allowed   Existing authorization result.
	 * @param string $meta_key  Meta key.
	 * @param int    $object_id Post ID.
	 * @return bool
	 */
	public static function authorize_meta( $allowed, $meta_key, $object_id ) {
		unset( $allowed, $meta_key );
		return current_user_can( 'edit_post', (int) $object_id );
	}

	/**
	 * Prevents malformed direct Metadata API writes from erasing a valid tree.
	 *
	 * @param mixed  $check      Existing short-circuit result.
	 * @param int    $object_id  Post ID.
	 * @param string $meta_key   Meta key.
	 * @param mixed  $meta_value Incoming value.
	 * @return mixed
	 */
	public static function validate_meta_write( $check, $object_id, $meta_key, $meta_value ) {
		if ( null !== $check || CODE_TO_BLOCK_META_KEY !== $meta_key ) {
			return $check;
		}
		if ( CODE_TO_BLOCK_POST_TYPE !== get_post_type( (int) $object_id ) ) {
			return $check;
		}

		return '' === self::sanitize_meta_value( $meta_value ) ? false : null;
	}

	/**
	 * @param mixed  $value Incoming block.
	 * @param string $path  Error path.
	 * @return array|WP_Error
	 */
	private static function sanitize_block( $value, $path, $depth, &$block_count ) {
		if ( $depth > self::MAX_DEPTH ) {
			return self::error( $path, 'exceeds the maximum block depth of 50', 413 );
		}
		++$block_count;
		if ( $block_count > self::MAX_BLOCKS ) {
			return self::error( $path, 'exceeds the maximum of 1000 blocks', 413 );
		}
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be a block object' );
		}

		$required_fields = array( 'id', 'type', 'tag', 'attributes', 'children', 'styles', 'meta' );
		foreach ( $required_fields as $required ) {
			if ( ! array_key_exists( $required, $value ) ) {
				return self::error( $path . '.' . $required, 'is required' );
			}
		}

		if ( ! is_string( $value['id'] ) || '' === trim( $value['id'] ) ) {
			return self::error( $path . '.id', 'must be a non-empty string' );
		}
		if ( strlen( $value['id'] ) > 500 ) {
			return self::error( $path . '.id', 'must be 500 bytes or fewer' );
		}

		if ( ! is_string( $value['type'] ) || ! in_array( $value['type'], self::BLOCK_TYPES, true ) ) {
			return self::error( $path . '.type', 'is not a supported block type' );
		}

		if ( ! is_string( $value['tag'] ) || ! in_array( strtolower( $value['tag'] ), self::HTML_TAGS, true ) ) {
			return self::error( $path . '.tag', 'is not a supported HTML tag' );
		}

		$tag        = strtolower( $value['tag'] );
		$attributes = self::sanitize_attributes( $value['attributes'], $path . '.attributes', $tag );
		if ( is_wp_error( $attributes ) ) {
			return $attributes;
		}

		if ( ! is_array( $value['children'] ) ) {
			return self::error( $path . '.children', 'must be an array' );
		}
		if ( in_array( $tag, self::VOID_TAGS, true ) && ! empty( $value['children'] ) ) {
			return self::error( $path . '.children', 'must be empty for a void HTML element' );
		}

		$children = array();
		foreach ( $value['children'] as $index => $child ) {
			$child_path  = $path . '.children[' . $index . ']';
			$child_array = self::object_to_array( $child );
			if ( is_array( $child_array ) && array_key_exists( 'kind', $child_array ) ) {
				$sanitized_child = self::sanitize_text_node( $child_array, $child_path );
			} else {
				$sanitized_child = self::sanitize_block( $child_array, $child_path, $depth + 1, $block_count );
			}

			if ( is_wp_error( $sanitized_child ) ) {
				return $sanitized_child;
			}
			$children[] = $sanitized_child;
		}

		$styles = self::sanitize_style_set( $value['styles'], $path . '.styles' );
		if ( is_wp_error( $styles ) ) {
			return $styles;
		}

		$meta = self::object_to_array( $value['meta'] );
		if ( ! is_array( $meta ) || ! isset( $meta['source'] ) || ! is_string( $meta['source'] ) ) {
			return self::error( $path . '.meta.source', 'must be a string' );
		}
		if ( strlen( $meta['source'] ) > 500 ) {
			return self::error( $path . '.meta.source', 'must be 500 bytes or fewer' );
		}

		$block = array(
			'id'         => $value['id'],
			'type'       => $value['type'],
			'tag'        => $tag,
			'attributes' => $attributes,
			'children'   => $children,
			'styles'     => $styles,
		);

		if ( array_key_exists( 'responsive_overrides', $value ) ) {
			$responsive = self::sanitize_named_style_sets(
				$value['responsive_overrides'],
				array( 'tablet', 'mobile' ),
				$path . '.responsive_overrides'
			);
			if ( is_wp_error( $responsive ) ) {
				return $responsive;
			}
			$block['responsive_overrides'] = $responsive;
		}

		if ( array_key_exists( 'states', $value ) ) {
			$states = self::sanitize_named_style_sets(
				$value['states'],
				array( 'hover', 'focus', 'active' ),
				$path . '.states'
			);
			if ( is_wp_error( $states ) ) {
				return $states;
			}
			$block['states'] = $states;
		}

		if ( array_key_exists( 'actions', $value ) ) {
			$actions = self::sanitize_actions( $value['actions'], $path . '.actions' );
			if ( is_wp_error( $actions ) ) {
				return $actions;
			}
			$block['actions'] = $actions;
		}

		$block['meta'] = array( 'source' => $meta['source'] );
		if ( array_key_exists( 'css_mapping', $meta ) ) {
			$css_mapping = self::sanitize_css_mapping( $meta['css_mapping'], $path . '.meta.css_mapping' );
			if ( is_wp_error( $css_mapping ) ) {
				return $css_mapping;
			}
			$block['meta']['css_mapping'] = $css_mapping;
		}
		if ( array_key_exists( 'saved_component_id', $meta ) ) {
			if ( ! is_int( $meta['saved_component_id'] ) || $meta['saved_component_id'] < 1 ) {
				return self::error( $path . '.meta.saved_component_id', 'must be a positive integer' );
			}
			if (
				'saved-component' !== $meta['source'] ||
				'container' !== $block['type'] ||
				'div' !== $block['tag'] ||
				! empty( $block['children'] ) ||
				isset( $block['actions'] ) ||
				isset( $block['meta']['css_mapping'] )
			) {
				return self::error( $path, 'must be an empty saved-component container' );
			}
			$block['meta']['saved_component_id'] = $meta['saved_component_id'];
		}

		if ( array_key_exists( 'is_content_slot', $value ) && true === $value['is_content_slot'] ) {
			$block['is_content_slot'] = true;
			if ( array_key_exists( 'slot_label', $value ) && is_string( $value['slot_label'] ) ) {
				$block['slot_label'] = sanitize_text_field( $value['slot_label'] );
			}
			if ( array_key_exists( 'slot_content_type', $value ) && in_array( $value['slot_content_type'], array( 'text', 'rich_text', 'image', 'link' ), true ) ) {
				$block['slot_content_type'] = $value['slot_content_type'];
			}
		}
			
		if ( array_key_exists( 'is_dynamic', $value ) && true === $value['is_dynamic'] ) {
			$block['is_dynamic'] = true;
			if ( array_key_exists( 'dynamic_source', $value ) && is_string( $value['dynamic_source'] ) ) {
				$block['dynamic_source'] = sanitize_text_field( $value['dynamic_source'] );
			}
		}

		if ( array_key_exists( 'visibility_conditions', $value ) ) {
			$conditions = self::sanitize_visibility_conditions( $value['visibility_conditions'], $path . '.visibility_conditions' );
			if ( is_wp_error( $conditions ) ) {
				return $conditions;
			}
			if ( ! empty( $conditions ) ) {
				$block['visibility_conditions'] = $conditions;
			}
		}

		if ( array_key_exists( 'permissions', $value ) ) {
			$permissions = self::sanitize_element_permissions( $value['permissions'], $path . '.permissions' );
			if ( is_wp_error( $permissions ) ) {
				return $permissions;
			}
			if ( ! empty( $permissions ) ) {
				$block['permissions'] = $permissions;
			}
		}

		if ( array_key_exists( 'performance', $value ) ) {
			$performance = self::sanitize_performance_settings( $value['performance'], $path . '.performance' );
			if ( is_wp_error( $performance ) ) {
				return $performance;
			}
			if ( ! empty( $performance ) ) {
				$block['performance'] = $performance;
			}
		}

		return $block;
	}

	private static function sanitize_visibility_conditions( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}
		$conditions = array();
		if ( isset( $value['login'] ) ) {
			if ( ! is_string( $value['login'] ) || ! in_array( $value['login'], array( 'any', 'logged_in', 'logged_out' ), true ) ) {
				return self::error( $path . '.login', 'must be any, logged_in, or logged_out' );
			}
			if ( 'any' !== $value['login'] ) {
				$conditions['login'] = $value['login'];
			}
		}
		if ( isset( $value['roles'] ) ) {
			if ( ! is_array( $value['roles'] ) || count( $value['roles'] ) > 20 ) {
				return self::error( $path . '.roles', 'must be an array with no more than 20 roles' );
			}
			$roles = array();
			foreach ( $value['roles'] as $role ) {
				if ( ! is_string( $role ) || ! preg_match( '/^[a-z0-9_-]{1,64}$/', $role ) ) {
					return self::error( $path . '.roles', 'contains an invalid WordPress role slug' );
				}
				$roles[] = $role;
			}
			$roles = array_values( array_unique( $roles ) );
			if ( ! empty( $roles ) ) {
				$conditions['roles'] = $roles;
			}
		}
		return $conditions;
	}

	private static function sanitize_element_permissions( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}
		$permissions = array();
		if ( isset( $value['role'] ) ) {
			if ( ! is_string( $value['role'] ) || ( '' !== $value['role'] && ! preg_match( '/^[a-z0-9_-]{1,64}$/', $value['role'] ) ) ) {
				return self::error( $path . '.role', 'must be a WordPress role slug' );
			}
			if ( '' !== $value['role'] ) {
				$permissions['role'] = $value['role'];
			}
		}
		foreach ( array( 'can_edit', 'can_delete', 'can_publish', 'locked' ) as $key ) {
			if ( array_key_exists( $key, $value ) ) {
				if ( ! is_bool( $value[ $key ] ) ) {
					return self::error( $path . '.' . $key, 'must be a boolean' );
				}
				$default = 'locked' === $key ? false : true;
				if ( $default !== $value[ $key ] ) {
					$permissions[ $key ] = $value[ $key ];
				}
			}
		}
		return $permissions;
	}

	private static function sanitize_performance_settings( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}
		$performance = array();
		foreach ( array( 'lazy_load', 'image_lazy_load' ) as $key ) {
			if ( array_key_exists( $key, $value ) ) {
				if ( ! is_bool( $value[ $key ] ) ) {
					return self::error( $path . '.' . $key, 'must be a boolean' );
				}
				if ( $value[ $key ] ) {
					$performance[ $key ] = true;
				}
			}
		}
		return $performance;
	}

	/**
	 * Validates the immutable mapping recorded when source CSS is imported.
	 *
	 * @param mixed  $value Incoming mapping.
	 * @param string $path  Error path.
	 * @return array|WP_Error
	 */
	private static function sanitize_css_mapping( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) || ! isset( $value['version'], $value['declarations'] ) ) {
			return self::error( $path, 'must contain version and declarations' );
		}
		if ( 1 !== $value['version'] ) {
			return self::error( $path . '.version', 'must equal 1' );
		}
		if ( ! is_array( $value['declarations'] ) ) {
			return self::error( $path . '.declarations', 'must be an array' );
		}
		if ( count( $value['declarations'] ) > self::MAX_CSS_MAPPING_DECLARATIONS ) {
			return self::error( $path . '.declarations', 'exceeds the maximum of 1000 declarations', 413 );
		}

		$declarations = array();
		foreach ( $value['declarations'] as $index => $declaration ) {
			$declaration_path = $path . '.declarations[' . $index . ']';
			$declaration      = self::object_to_array( $declaration );
			$required         = array( 'property', 'value', 'important', 'origin', 'destination' );
			if ( ! is_array( $declaration ) ) {
				return self::error( $declaration_path, 'must be an object' );
			}
			foreach ( $required as $field ) {
				if ( ! array_key_exists( $field, $declaration ) ) {
					return self::error( $declaration_path . '.' . $field, 'is required' );
				}
			}

			$property = $declaration['property'];
			if ( ! is_string( $property ) || ! preg_match( '/^(?:--[a-z0-9_-]+|-?[a-z][a-z0-9-]*)$/i', $property ) ) {
				return self::error( $declaration_path . '.property', 'must be a valid CSS property' );
			}
			if ( ! is_string( $declaration['value'] ) || ! self::css_property_value_is_safe( $property, $declaration['value'] ) ) {
				return self::error( $declaration_path . '.value', 'contains unsafe CSS syntax' );
			}
			if ( ! is_bool( $declaration['important'] ) ) {
				return self::error( $declaration_path . '.important', 'must be a boolean' );
			}
			if ( ! is_string( $declaration['origin'] ) || ! in_array( $declaration['origin'], array( 'stylesheet', 'inline', 'inherited' ), true ) ) {
				return self::error( $declaration_path . '.origin', 'must be stylesheet, inline, or inherited' );
			}
			if ( ! is_string( $declaration['destination'] ) || ! in_array( $declaration['destination'], array( 'style-control', 'raw-css' ), true ) ) {
				return self::error( $declaration_path . '.destination', 'must be style-control or raw-css' );
			}

			$sanitized = array(
				'property'    => $property,
				'value'       => $declaration['value'],
				'important'   => $declaration['important'],
				'origin'      => $declaration['origin'],
				'destination' => $declaration['destination'],
			);
			if ( 'style-control' === $declaration['destination'] ) {
				if (
					! isset( $declaration['control'] ) ||
					! is_string( $declaration['control'] ) ||
					$property !== $declaration['control'] ||
					! in_array( $declaration['control'], self::CSS_MAPPING_CONTROLS, true )
				) {
					return self::error( $declaration_path . '.control', 'must name the matching style control' );
				}
				$sanitized['control'] = $declaration['control'];
			} elseif ( array_key_exists( 'control', $declaration ) ) {
				return self::error( $declaration_path . '.control', 'is not allowed for raw CSS' );
			}
			$declarations[] = $sanitized;
		}

		return array(
			'version'      => 1,
			'declarations' => $declarations,
		);
	}

	/**
	 * @param array $block Sanitized block.
	 * @return bool
	 */
	private static function block_contains_saved_component( $block ) {
		if ( isset( $block['meta']['saved_component_id'] ) ) {
			return true;
		}
		foreach ( $block['children'] as $child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) && self::block_contains_saved_component( $child ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array $block Sanitized block.
	 * @return bool
	 */
	private static function block_contains_page_shortcode( $block ) {
		foreach ( $block['children'] as $child ) {
			if ( is_array( $child ) && isset( $child['kind'] ) ) {
				if ( preg_match( '/\[ctb_[a-z0-9_-]{2,60}\]/', $child['value'] ) ) {
					return true;
				}
			} elseif ( is_array( $child ) && self::block_contains_page_shortcode( $child ) ) {
				return true;
			}
		}
		return false;
	}

	private static function collect_component_dom_ids( $block, $path, &$ids ) {
		$attributes = self::object_to_array( $block['attributes'] );
		if ( isset( $attributes['id'] ) ) {
			if ( isset( $ids[ $attributes['id'] ] ) ) {
				return self::error( $path . '.attributes.id', 'must be unique within a saved component' );
			}
			$ids[ $attributes['id'] ] = true;
		}
		foreach ( $block['children'] as $index => $child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				$result = self::collect_component_dom_ids( $child, $path . '.children[' . $index . ']', $ids );
				if ( is_wp_error( $result ) ) {
					return $result;
				}
			}
		}
		return true;
	}

	private static function validate_component_dom_references( $block, $path, $ids, &$reference_count ) {
		$attributes = self::object_to_array( $block['attributes'] );
		foreach ( array( 'for', 'headers', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-flowto', 'aria-details', 'aria-errormessage', 'aria-activedescendant' ) as $name ) {
			if ( ! isset( $attributes[ $name ] ) ) {
				continue;
			}
			$references = preg_split( '/\s+/', trim( $attributes[ $name ] ) );
			$reference_count += count( $references );
			if ( $reference_count > self::MAX_BLOCKS ) {
				return self::error( $path . '.attributes.' . $name, 'contains too many DOM ID references' );
			}
			foreach ( $references as $reference ) {
				if ( ! isset( $ids[ $reference ] ) ) {
					return self::error( $path . '.attributes.' . $name, 'must reference an HTML ID in the same saved component' );
				}
			}
		}
		if ( isset( $attributes['href'] ) && is_string( $attributes['href'] ) && 0 === strpos( $attributes['href'], '#' ) ) {
			++$reference_count;
			if ( $reference_count > self::MAX_BLOCKS ) {
				return self::error( $path . '.attributes.href', 'contains too many DOM ID references' );
			}
		}
		foreach ( $block['children'] as $index => $child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				$result = self::validate_component_dom_references( $child, $path . '.children[' . $index . ']', $ids, $reference_count );
				if ( is_wp_error( $result ) ) {
					return $result;
				}
			}
		}
		return true;
	}

	/**
	 * @param mixed  $value Incoming text node.
	 * @param string $path  Error path.
	 * @return array|WP_Error
	 */
	private static function sanitize_text_node( $value, $path ) {
		if ( 'text' !== $value['kind'] ) {
			return self::error( $path . '.kind', 'must equal "text"' );
		}

		if ( ! array_key_exists( 'value', $value ) || ! is_string( $value['value'] ) ) {
			return self::error( $path . '.value', 'must be a string' );
		}
		if ( strlen( $value['value'] ) > self::MAX_STRING_BYTES ) {
			return self::error( $path . '.value', 'exceeds the 128 KiB string limit', 413 );
		}

		return array(
			'kind'  => 'text',
			'value' => $value['value'],
		);
	}

	/**
	 * @param mixed  $value Incoming attributes map.
	 * @param string $path  Error path.
	 * @param string $tag   Owning HTML tag.
	 * @return stdClass|WP_Error
	 */
	private static function sanitize_attributes( $value, $path, $tag ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}

		$attributes = new stdClass();
		foreach ( $value as $name => $attribute_value ) {
			if ( ! is_string( $name ) || ! preg_match( '/^[a-z_:][a-z0-9:._-]*$/i', $name ) ) {
				continue;
			}
			$name = strtolower( $name );
			if ( ! self::attribute_is_allowed( $tag, $name ) ) {
				continue;
			}
			if ( ! is_string( $attribute_value ) && ! is_bool( $attribute_value ) ) {
				continue;
			}
			if ( is_string( $attribute_value ) && strlen( $attribute_value ) > self::MAX_STRING_BYTES ) {
				return self::error( $path . '.' . $name, 'exceeds the 128 KiB string limit', 413 );
			}
			if ( is_string( $attribute_value ) && 'href' === $name ) {
				$attribute_value = self::sanitize_resource_url( $attribute_value, true );
			} elseif ( is_string( $attribute_value ) && in_array( $name, array( 'src', 'cite' ), true ) ) {
				$attribute_value = self::sanitize_resource_url( $attribute_value, false );
			} elseif ( is_string( $attribute_value ) && 'srcset' === $name ) {
				$attribute_value = self::sanitize_srcset( $attribute_value );
			}
			if ( '' === $attribute_value ) {
				continue;
			}
			$attributes->{$name} = $attribute_value;
		}

		return $attributes;
	}

	/**
	 * @param string $tag  HTML tag.
	 * @param string $name Attribute name.
	 * @return bool
	 */
	public static function attribute_is_allowed( $tag, $name ) {
		$global = array(
			'class', 'id', 'title', 'lang', 'dir', 'hidden', 'tabindex', 'role',
			'translate', 'spellcheck', 'draggable', 'contenteditable',
		);
		if ( in_array( $name, $global, true ) || preg_match( '/^(?:aria|data)-[a-z0-9_.:-]+$/', $name ) ) {
			return true;
		}

		$by_tag = array(
			'a'          => array( 'href', 'target', 'rel', 'download', 'hreflang', 'type' ),
			'blockquote' => array( 'cite' ),
			'button'     => array( 'type', 'name', 'value', 'disabled' ),
			'col'        => array( 'span' ),
			'data'       => array( 'value' ),
			'datalist'   => array(),
			'del'        => array( 'cite', 'datetime' ),
			'details'    => array( 'open' ),
			'fieldset'   => array( 'disabled', 'form', 'name' ),
			'form'       => array( 'action', 'method', 'enctype', 'novalidate', 'target', 'autocomplete' ),
			'iframe'     => array( 'src', 'title', 'loading', 'width', 'height', 'allow', 'allowfullscreen', 'referrerpolicy', 'sandbox' ),
			'img'        => array( 'src', 'alt', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes' ),
			'input'      => array( 'type', 'name', 'placeholder', 'required', 'value', 'checked', 'disabled', 'min', 'max', 'maxlength', 'pattern', 'autocomplete', 'readonly', 'step' ),
			'ins'        => array( 'cite', 'datetime' ),
			'label'      => array( 'for' ),
			'legend'     => array(),
			'li'         => array( 'value' ),
			'meter'      => array( 'value', 'min', 'max', 'low', 'high', 'optimum' ),
			'ol'         => array( 'start', 'reversed', 'type' ),
			'optgroup'   => array( 'label', 'disabled' ),
			'option'     => array( 'value', 'selected', 'disabled', 'label' ),
			'output'     => array( 'for', 'form', 'name' ),
			'progress'   => array( 'value', 'max' ),
			'q'          => array( 'cite' ),
			'select'     => array( 'name', 'required', 'disabled', 'multiple', 'size', 'autocomplete' ),
			'source'     => array( 'src', 'srcset', 'sizes', 'type', 'media', 'width', 'height' ),
			'td'         => array( 'colspan', 'rowspan', 'headers' ),
			'textarea'   => array( 'name', 'placeholder', 'required', 'rows', 'cols', 'disabled', 'maxlength', 'readonly', 'autocomplete' ),
			'th'         => array( 'colspan', 'rowspan', 'headers', 'scope', 'abbr' ),
			'time'       => array( 'datetime' ),
		);

		return isset( $by_tag[ $tag ] ) && in_array( $name, $by_tag[ $tag ], true );
	}

	/**
	 * @param mixed  $value Incoming document-level token registry.
	 * @param string $path  Error path.
	 * @return stdClass|WP_Error
	 */
	private static function sanitize_seo( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}
		$allowed = array( 'title', 'description', 'canonical', 'og_title', 'og_description', 'og_image' );
		$seo = array();
		foreach ( $allowed as $key ) {
			if ( ! array_key_exists( $key, $value ) ) {
				continue;
			}
			if ( ! is_string( $value[ $key ] ) ) {
				return self::error( $path . '.' . $key, 'must be a string' );
			}
			$trimmed = trim( $value[ $key ] );
			if ( '' === $trimmed ) {
				continue;
			}
			if ( strlen( $trimmed ) > 1000 ) {
				return self::error( $path . '.' . $key, 'must be 1000 chars or fewer' );
			}
			if ( in_array( $key, array( 'canonical', 'og_image' ), true ) && preg_match( '#^\s*javascript:#i', $trimmed ) ) {
				return self::error( $path . '.' . $key, 'URL must not use javascript:' );
			}
			$seo[ $key ] = sanitize_text_field( $trimmed );
		}
		return $seo;
	}

	private static function sanitize_design_tokens( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}

		$result      = new stdClass();
		$token_count = 0;
		foreach ( self::TOKEN_CATEGORIES as $category ) {
			if ( ! array_key_exists( $category, $value ) ) {
				continue;
			}
			$incoming_tokens = self::object_to_array( $value[ $category ] );
			if ( ! is_array( $incoming_tokens ) ) {
				return self::error( $path . '.' . $category, 'must be an object' );
			}

			$tokens = new stdClass();
			foreach ( $incoming_tokens as $id => $token ) {
				$token_path = $path . '.' . $category . '.' . $id;
				if ( ! is_string( $id ) || ! preg_match( '/^[a-z][a-z0-9-]{0,39}$/', $id ) ) {
					return self::error( $token_path, 'must use a lowercase token ID beginning with a letter' );
				}
				++$token_count;
				if ( $token_count > self::MAX_DESIGN_TOKENS ) {
					return self::error( $path, 'cannot contain more than 100 tokens', 413 );
				}

				$token = self::object_to_array( $token );
				if ( ! is_array( $token ) || ! isset( $token['label'], $token['value'] ) ) {
					return self::error( $token_path, 'must contain label and value strings' );
				}
				if ( ! is_string( $token['label'] ) || '' === trim( $token['label'] ) || strlen( $token['label'] ) > 100 ) {
					return self::error( $token_path . '.label', 'must be a non-empty string of 100 bytes or fewer' );
				}
				if ( ! is_string( $token['value'] ) || '' === trim( $token['value'] ) || strlen( $token['value'] ) > 500 ) {
					return self::error( $token_path . '.value', 'must be a non-empty string of 500 bytes or fewer' );
				}
				$css_name = self::design_token_css_name( $category . '.' . $id );
				if ( '' === $css_name || ! self::css_property_value_is_safe( $css_name, $token['value'] ) ) {
					return self::error( $token_path . '.value', 'contains unsafe CSS syntax' );
				}

				$tokens->{$id} = array(
					'label' => $token['label'],
					'value' => $token['value'],
				);
			}
			if ( ! empty( get_object_vars( $tokens ) ) ) {
				$result->{$category} = $tokens;
			}
		}

		return $result;
	}

	/**
	 * Returns the deterministic custom-property name for a token reference.
	 *
	 * @param string $reference Category and token ID.
	 * @return string
	 */
	public static function design_token_css_name( $reference ) {
		$parts = self::token_reference_parts( $reference );
		return null === $parts ? '' : '--ctb-token-' . $parts[0] . '-' . $parts[1];
	}

	/**
	 * @param string $reference Category and token ID.
	 * @return array|null
	 */
	private static function token_reference_parts( $reference ) {
		if ( ! is_string( $reference ) || ! preg_match( '/^(colors|typography|spacing)\.([a-z][a-z0-9-]{0,39})$/', $reference, $matches ) ) {
			return null;
		}
		return array( $matches[1], $matches[2] );
	}

	/**
	 * @param mixed  $value Incoming style set.
	 * @param string $path  Error path.
	 * @return array|WP_Error
	 */
	private static function sanitize_style_set( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}

		foreach ( array( 'mapped', 'custom_css_fallback' ) as $required ) {
			if ( ! array_key_exists( $required, $value ) ) {
				return self::error( $path . '.' . $required, 'is required' );
			}
		}

		$mapped = self::object_to_array( $value['mapped'] );
		if ( ! is_array( $mapped ) ) {
			return self::error( $path . '.mapped', 'must be an object' );
		}

		$sanitized_mapped = new stdClass();
		foreach ( $mapped as $property => $property_value ) {
			if ( ! is_string( $property ) || ! preg_match( '/^(?:--[a-z0-9_-]+|-?[a-z][a-z0-9-]*)$/i', $property ) ) {
				continue;
			}
			if ( is_string( $property_value ) && self::css_property_value_is_safe( $property, $property_value ) ) {
				$sanitized_mapped->{$property} = $property_value;
			} elseif ( is_string( $property_value ) ) {
				return self::error( $path . '.mapped.' . $property, 'contains unsafe CSS syntax' );
			}
		}

		if ( ! is_string( $value['custom_css_fallback'] ) ) {
			return self::error( $path . '.custom_css_fallback', 'must be a string' );
		}
		if ( ! self::css_declaration_list_is_safe( $value['custom_css_fallback'] ) ) {
			return self::error( $path . '.custom_css_fallback', 'contains unsafe CSS syntax' );
		}

		$style_set = array(
			'mapped'              => $sanitized_mapped,
			'custom_css_fallback' => $value['custom_css_fallback'],
		);
		if ( array_key_exists( 'token_bindings', $value ) ) {
			$bindings = self::object_to_array( $value['token_bindings'] );
			if ( ! is_array( $bindings ) ) {
				return self::error( $path . '.token_bindings', 'must be an object' );
			}
			$sanitized_bindings = new stdClass();
			foreach ( $bindings as $property => $reference ) {
				if ( ! is_string( $property ) || ! preg_match( '/^-?[a-z][a-z0-9-]*$/i', $property ) ) {
					return self::error( $path . '.token_bindings', 'contains an invalid CSS property' );
				}
				if ( ! is_string( $reference ) || null === self::token_reference_parts( $reference ) ) {
					return self::error( $path . '.token_bindings.' . $property, 'must be a valid design token reference' );
				}
				if ( ! property_exists( $sanitized_mapped, $property ) ) {
					return self::error( $path . '.token_bindings.' . $property, 'must have a matching mapped value' );
				}
				$sanitized_bindings->{$property} = $reference;
			}
			if ( ! empty( get_object_vars( $sanitized_bindings ) ) ) {
				$style_set['token_bindings'] = $sanitized_bindings;
			}
		}

		return $style_set;
	}

	/**
	 * @param mixed  $value   Incoming responsive or state map.
	 * @param array  $allowed Allowed keys.
	 * @param string $path    Error path.
	 * @return stdClass|WP_Error
	 */
	private static function sanitize_named_style_sets( $value, $allowed, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}

		$result = new stdClass();
		foreach ( $allowed as $name ) {
			if ( ! array_key_exists( $name, $value ) ) {
				continue;
			}
			$style_set = self::sanitize_style_set( $value[ $name ], $path . '.' . $name );
			if ( is_wp_error( $style_set ) ) {
				return $style_set;
			}
			$result->{$name} = $style_set;
		}

		return $result;
	}

	/**
	 * @param array    $block         Sanitized block.
	 * @param string   $path          Schema path.
	 * @param stdClass $design_tokens Sanitized token registry.
	 * @return true|WP_Error
	 */
	private static function validate_token_bindings( $block, $path, $design_tokens ) {
		$result = self::validate_style_token_bindings( $block['styles'], $path . '.styles', $design_tokens );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		foreach ( array( 'responsive_overrides', 'states' ) as $branch ) {
			$style_sets = isset( $block[ $branch ] ) ? self::object_to_array( $block[ $branch ] ) : array();
			foreach ( $style_sets as $name => $style_set ) {
				$result = self::validate_style_token_bindings( $style_set, $path . '.' . $branch . '.' . $name, $design_tokens );
				if ( is_wp_error( $result ) ) {
					return $result;
				}
			}
		}

		foreach ( $block['children'] as $index => $child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				$result = self::validate_token_bindings( $child, $path . '.children[' . $index . ']', $design_tokens );
				if ( is_wp_error( $result ) ) {
					return $result;
				}
			}
		}
		return true;
	}

	/**
	 * @param array    $style_set     Sanitized style set.
	 * @param string   $path          Schema path.
	 * @param stdClass $design_tokens Sanitized token registry.
	 * @return true|WP_Error
	 */
	private static function validate_style_token_bindings( $style_set, $path, $design_tokens ) {
		$bindings = isset( $style_set['token_bindings'] ) ? self::object_to_array( $style_set['token_bindings'] ) : array();
		$tokens   = self::object_to_array( $design_tokens );
		foreach ( $bindings as $property => $reference ) {
			$parts    = self::token_reference_parts( $reference );
			$category = null === $parts ? '' : $parts[0];
			$id       = null === $parts ? '' : $parts[1];
			$category_tokens = isset( $tokens[ $category ] ) ? self::object_to_array( $tokens[ $category ] ) : array();
			if ( ! isset( $category_tokens[ $id ] ) ) {
				return self::error( $path . '.token_bindings.' . $property, 'must reference a token in the same document' );
			}
			if ( ! in_array( $property, self::TOKEN_PROPERTIES[ $category ], true ) ) {
				return self::error( $path . '.token_bindings.' . $property, 'uses an incompatible token category' );
			}
		}
		return true;
	}

	/**
	 * @param mixed  $value Incoming actions array.
	 * @param string $path  Error path.
	 * @return array|WP_Error
	 */
	private static function sanitize_actions( $value, $path ) {
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an array' );
		}
		if ( count( $value ) > self::MAX_ACTIONS ) {
			return self::error( $path, 'cannot contain more than 100 actions', 413 );
		}

		$actions = array();
		foreach ( $value as $index => $action ) {
			$action      = self::object_to_array( $action );
			$action_path = $path . '[' . $index . ']';
			if ( ! is_array( $action ) ) {
				return self::error( $action_path, 'must be an object' );
			}

			foreach ( array( 'trigger', 'behavior', 'params' ) as $required ) {
				if ( ! array_key_exists( $required, $action ) ) {
					return self::error( $action_path . '.' . $required, 'is required' );
				}
			}

			if ( ! is_string( $action['trigger'] ) || ! is_string( $action['behavior'] ) ) {
				return self::error( $action_path, 'trigger and behavior must be strings' );
			}
			if ( strlen( $action['trigger'] ) > 100 || strlen( $action['behavior'] ) > 100 ) {
				return self::error( $action_path, 'trigger and behavior must be 100 bytes or fewer' );
			}

			if ( array_key_exists( 'animation_type', $action ) ) {
				if ( ! is_string( $action['animation_type'] ) || ! in_array( $action['animation_type'], array( 'css_native', 'js_library' ), true ) ) {
					return self::error( $action_path . '.animation_type', 'must be css_native or js_library' );
				}
			}

			$params = self::sanitize_json_object( $action['params'], $action_path . '.params' );
			if ( is_wp_error( $params ) ) {
				return $params;
			}

			$normalized_action = array(
				'trigger'  => $action['trigger'],
				'behavior' => $action['behavior'],
				'params'   => $params,
			);
			
			if ( array_key_exists( 'animation_type', $action ) ) {
				$normalized_action['animation_type'] = $action['animation_type'];
			}

			if ( in_array( $action['behavior'], self::RUNTIME_ACTIONS, true ) ) {
				$runtime_action = self::normalize_runtime_action( $normalized_action );
				if ( null === $runtime_action ) {
					return self::error( $action_path, 'contains an invalid executable action' );
				}
				$normalized_action = $runtime_action;
			} elseif ( in_array( $action['behavior'], self::ANIMATION_ACTIONS, true ) ) {
				$animation_action = self::normalize_animation_action( $normalized_action );
				if ( null === $animation_action ) {
					return self::error( $action_path, 'contains invalid GSAP animation settings' );
				}
				$normalized_action = $animation_action;
			} elseif ( in_array( $action['behavior'], self::CSS_ANIMATION_ACTIONS, true ) ) {
				$css_animation = self::normalize_css_animation_action( $normalized_action );
				if ( null === $css_animation ) {
					return self::error( $action_path, 'contains invalid CSS animation settings' );
				}
				$normalized_action = $css_animation;
			} elseif ( 'unverified-script' === $action['behavior'] ) {
				$params_array = self::object_to_array( $params );
				if (
					'manual-review' !== $action['trigger'] ||
					! isset( $params_array['code'], $params_array['description'] ) ||
					! is_string( $params_array['code'] ) ||
					! is_string( $params_array['description'] )
				) {
					return self::error( $action_path, 'contains invalid unverified script metadata' );
				}
			}

			$actions[] = $normalized_action;
		}

		return $actions;
	}

	/**
	 * Returns the small executable subset of an action, or null when dormant.
	 *
	 * @param mixed $action Candidate action.
	 * @return array|null
	 */
	public static function normalize_runtime_action( $action ) {
		$action = self::object_to_array( $action );
		if (
			! is_array( $action ) ||
			! isset( $action['trigger'], $action['behavior'], $action['params'] ) ||
			'click' !== $action['trigger'] ||
			! in_array( $action['behavior'], self::RUNTIME_ACTIONS, true )
		) {
			return null;
		}
		$params = self::object_to_array( $action['params'] );
		if (
			! is_array( $params ) ||
			! isset( $params['target_block_id'] ) ||
			! is_string( $params['target_block_id'] ) ||
			'' === trim( $params['target_block_id'] ) ||
			strlen( $params['target_block_id'] ) > 500
		) {
			return null;
		}

		$normalized_params = array( 'target_block_id' => $params['target_block_id'] );
		if ( in_array( $action['behavior'], array( 'toggle-class', 'add-class', 'remove-class' ), true ) ) {
			if (
				! isset( $params['class_name'] ) ||
				! is_string( $params['class_name'] ) ||
				! preg_match( '/^[a-z_][a-z0-9_-]*$/i', $params['class_name'] )
			) {
				return null;
			}
			$normalized_params['class_name'] = $params['class_name'];
		}

		$normalized = array(
			'trigger'  => 'click',
			'behavior' => $action['behavior'],
			'params'   => $normalized_params,
		);
		if ( isset( $action['animation_type'] ) && in_array( $action['animation_type'], array( 'css_native', 'js_library' ), true ) ) {
			$normalized['animation_type'] = $action['animation_type'];
		}
		return $normalized;
	}

	/**
	 * Returns a constrained GSAP action, or null for non-animation actions.
	 *
	 * @param mixed $action Candidate action.
	 * @return array|null
	 */
	public static function normalize_animation_action( $action ) {
		$action = self::object_to_array( $action );
		if (
			! is_array( $action ) ||
			! isset( $action['trigger'], $action['behavior'], $action['animation_type'], $action['params'] ) ||
			'scroll' !== $action['trigger'] ||
			'js_library' !== $action['animation_type'] ||
			! in_array( $action['behavior'], self::ANIMATION_ACTIONS, true )
		) {
			return null;
		}
		$params = self::object_to_array( $action['params'] );
		if (
			! is_array( $params ) ||
			! isset( $params['target_block_id'] ) ||
			! is_string( $params['target_block_id'] ) ||
			'' === trim( $params['target_block_id'] ) ||
			strlen( $params['target_block_id'] ) > 500
		) {
			return null;
		}

		$starts = array( 'top bottom', 'top 85%', 'top center', 'center center' );
		$ends   = array( 'bottom top', 'bottom 20%', '+=500', '+=1000' );
		$eases  = array( 'none', 'power1.out', 'power2.out', 'power3.out' );
		$start  = isset( $params['start'] ) && in_array( $params['start'], $starts, true ) ? $params['start'] : 'top 85%';
		$ease   = isset( $params['ease'] ) && in_array( $params['ease'], $eases, true ) ? $params['ease'] : ( 'scroll-scrub' === $action['behavior'] ? 'none' : 'power2.out' );
		$clean  = array(
			'target_block_id' => $params['target_block_id'],
			'start'           => $start,
			'ease'            => $ease,
			'from_x'          => self::animation_number( $params, 'from_x', 0, -5000, 5000 ),
			'from_y'          => self::animation_number( $params, 'from_y', 40, -5000, 5000 ),
			'from_opacity'    => self::animation_number( $params, 'from_opacity', 0, 0, 1 ),
			'from_scale'      => self::animation_number( $params, 'from_scale', 1, 0, 10 ),
			'from_rotation'   => self::animation_number( $params, 'from_rotation', 0, -3600, 3600 ),
		);
		if ( 'scroll-scrub' === $action['behavior'] ) {
			$clean['end']         = isset( $params['end'] ) && in_array( $params['end'], $ends, true ) ? $params['end'] : 'bottom 20%';
			$clean['scrub']       = self::animation_number( $params, 'scrub', 1, 0, 5 );
			$clean['to_x']        = self::animation_number( $params, 'to_x', 0, -5000, 5000 );
			$clean['to_y']        = self::animation_number( $params, 'to_y', 0, -5000, 5000 );
			$clean['to_opacity']  = self::animation_number( $params, 'to_opacity', 1, 0, 1 );
			$clean['to_scale']    = self::animation_number( $params, 'to_scale', 1, 0, 10 );
			$clean['to_rotation'] = self::animation_number( $params, 'to_rotation', 0, -3600, 3600 );
		} else {
			$clean['duration'] = self::animation_number( $params, 'duration', 0.6, 0.05, 20 );
			$clean['stagger']  = self::animation_number( $params, 'stagger', 0.12, 0, 10 );
		}
		return array(
			'trigger'        => 'scroll',
			'behavior'       => $action['behavior'],
			'params'         => $clean,
			'animation_type' => 'js_library',
		);
	}

	private static function animation_number( $params, $key, $default, $minimum, $maximum ) {
		if ( ! isset( $params[ $key ] ) || ! is_numeric( $params[ $key ] ) ) {
			return $default;
		}
		return max( $minimum, min( $maximum, (float) $params[ $key ] ) );
	}

	/**
	 * Returns a pure-CSS entrance action, or null for other actions.
	 *
	 * @param mixed $action Candidate action.
	 * @return array|null
	 */
	public static function normalize_css_animation_action( $action ) {
		$action = self::object_to_array( $action );
		if (
			! is_array( $action ) ||
			! isset( $action['behavior'], $action['animation_type'], $action['params'] ) ||
			'css-reveal' !== $action['behavior'] ||
			'css_native' !== $action['animation_type']
		) {
			return null;
		}
		$params = self::object_to_array( $action['params'] );
		if (
			! is_array( $params ) ||
			! isset( $params['target_block_id'] ) ||
			! is_string( $params['target_block_id'] ) ||
			'' === trim( $params['target_block_id'] ) ||
			strlen( $params['target_block_id'] ) > 500
		) {
			return null;
		}
		return array(
			'trigger'        => 'load',
			'behavior'       => 'css-reveal',
			'params'         => array(
				'target_block_id' => $params['target_block_id'],
				'duration'        => self::animation_number( $params, 'duration', 0.6, 0.05, 20 ),
				'delay'           => self::animation_number( $params, 'delay', 0, 0, 20 ),
				'from_y'          => self::animation_number( $params, 'from_y', 30, -5000, 5000 ),
			),
			'animation_type' => 'css_native',
		);
	}

	/**
	 * Returns whether a sanitized or resolved document needs the GSAP bundle.
	 *
	 * @param mixed $document Block document.
	 * @return bool
	 */
	public static function document_needs_gsap( $document ) {
		$document = self::object_to_array( $document );
		return is_array( $document ) && isset( $document['root'] )
			? self::block_needs_gsap( self::object_to_array( $document['root'] ) )
			: false;
	}

	private static function block_needs_gsap( $block ) {
		foreach ( isset( $block['actions'] ) ? $block['actions'] : array() as $action ) {
			if ( null !== self::normalize_animation_action( $action ) ) {
				return true;
			}
		}
		foreach ( isset( $block['children'] ) ? $block['children'] : array() as $child ) {
			$child = self::object_to_array( $child );
			if ( is_array( $child ) && ! isset( $child['kind'] ) && self::block_needs_gsap( $child ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param mixed  $value Incoming params object.
	 * @param string $path  Error path.
	 * @return stdClass|WP_Error
	 */
	private static function sanitize_json_object( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}

		$result = new stdClass();
		foreach ( $value as $name => $item ) {
			if ( ! is_string( $name ) ) {
				return self::error( $path, 'must be an object, not an array' );
			}
			$sanitized = self::sanitize_json_value( $item, $path . '.' . $name );
			if ( is_wp_error( $sanitized ) ) {
				return $sanitized;
			}
			$result->{$name} = $sanitized;
		}

		return $result;
	}

	/**
	 * @param mixed  $value Incoming JSON value.
	 * @param string $path  Error path.
	 * @return mixed|WP_Error
	 */
	private static function sanitize_json_value( $value, $path ) {
		if ( is_float( $value ) && ! is_finite( $value ) ) {
			return self::error( $path, 'must be a finite number' );
		}
		if ( is_string( $value ) && strlen( $value ) > self::MAX_STRING_BYTES ) {
			return self::error( $path, 'exceeds the 128 KiB string limit', 413 );
		}
		if ( is_null( $value ) || is_string( $value ) || is_bool( $value ) || is_int( $value ) || is_float( $value ) ) {
			return $value;
		}

		if ( is_object( $value ) ) {
			return self::sanitize_json_object( $value, $path );
		}

		if ( is_array( $value ) ) {
			$result = array();
			foreach ( $value as $index => $item ) {
				$sanitized = self::sanitize_json_value( $item, $path . '[' . $index . ']' );
				if ( is_wp_error( $sanitized ) ) {
					return $sanitized;
				}
				$result[] = $sanitized;
			}
			return $result;
		}

		return self::error( $path, 'contains a non-JSON value' );
	}

	/**
	 * @param mixed $value Potential object.
	 * @return mixed
	 */
	private static function object_to_array( $value ) {
		return is_object( $value ) ? get_object_vars( $value ) : $value;
	}

	/**
	 * @param array  $block Sanitized block.
	 * @param string $path  Schema path.
	 * @param array  $seen  Previously visited IDs.
	 * @return true|WP_Error
	 */
	private static function validate_unique_ids( $block, $path, &$seen = array() ) {
		if ( isset( $seen[ $block['id'] ] ) ) {
			return self::error( $path . '.id', 'must be unique within the document' );
		}
		$seen[ $block['id'] ] = true;

		foreach ( $block['children'] as $index => $child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				$result = self::validate_unique_ids( $child, $path . '.children[' . $index . ']', $seen );
				if ( is_wp_error( $result ) ) {
					return $result;
				}
			}
		}

		return true;
	}

	/**
	 * @param array  $block Sanitized block.
	 * @param string $path  Schema path.
	 * @param array  $ids   Document block IDs.
	 * @return true|WP_Error
	 */
	private static function validate_action_targets( $block, $path, $ids ) {
		foreach ( isset( $block['actions'] ) ? $block['actions'] : array() as $index => $action ) {
			$runtime_action = self::normalize_runtime_action( $action );
			$animation_action = self::normalize_animation_action( $action );
			$css_animation = self::normalize_css_animation_action( $action );
			$target_action = null !== $runtime_action ? $runtime_action : ( null !== $animation_action ? $animation_action : $css_animation );
			if ( null !== $target_action && ! isset( $ids[ $target_action['params']['target_block_id'] ] ) ) {
				return self::error(
					$path . '.actions[' . $index . '].params.target_block_id',
					'must reference a block in the same document'
				);
			}
		}
		foreach ( $block['children'] as $index => $child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				$result = self::validate_action_targets( $child, $path . '.children[' . $index . ']', $ids );
				if ( is_wp_error( $result ) ) {
					return $result;
				}
			}
		}
		return true;
	}

	/**
	 * Prevents a declaration value from escaping its generated scoped rule.
	 *
	 * @param string $value CSS value or declaration list.
	 * @return bool
	 */
	public static function css_property_value_is_safe( $property, $value ) {
		if ( ! is_string( $property ) || ! is_string( $value ) || strlen( $value ) > self::MAX_STRING_BYTES ) {
			return false;
		}
		if ( preg_match( '/^(?:behavior|-moz-binding)$/i', trim( $property ) ) ) {
			return false;
		}
		if ( preg_match( '/[{}\x00-\x08\x0b\x0c\x0e-\x1f\x7f]|\/\*|\*\/|expression\s*\(|@import|<\s*\/\s*style/i', $value ) ) {
			return false;
		}
		if ( ! self::css_value_is_balanced( $value ) ) {
			return false;
		}

		$remaining = preg_replace_callback(
			'/url\(\s*(?:(["\'])(.*?)\1|([^"\')]*))\s*\)/is',
			function ( $matches ) use ( $property ) {
				$url = isset( $matches[2] ) && '' !== $matches[2] ? $matches[2] : $matches[3];
				if ( false !== strpos( $url, '\\' ) || '' === self::sanitize_resource_url( $url, false ) ) {
					return 'url(unsafe-' . $property . ')';
				}
				return '';
			},
			$value
		);
		return ! preg_match( '/url\s*\(/i', $remaining ) && false === strpos( $remaining, 'url(unsafe-' );
	}

	/**
	 * @param string $value CSS declaration list.
	 * @return bool
	 */
	public static function css_declaration_list_is_safe( $value ) {
		if ( ! is_string( $value ) || strlen( $value ) > self::MAX_STRING_BYTES ) {
			return false;
		}
		if ( '' === trim( $value ) ) {
			return true;
		}
		$declarations = self::split_css_declarations( $value );
		if ( false === $declarations ) {
			return false;
		}
		foreach ( $declarations as $declaration ) {
			$colon = strpos( $declaration, ':' );
			if ( false === $colon ) {
				return false;
			}
			$property       = trim( substr( $declaration, 0, $colon ) );
			$property_value = trim( substr( $declaration, $colon + 1 ) );
			if ( ! preg_match( '/^(?:--[a-z0-9_-]+|-?[a-z][a-z0-9-]*)$/i', $property ) || '' === $property_value ) {
				return false;
			}
			if ( ! self::css_property_value_is_safe( $property, $property_value ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * @param string $value      URL attribute value.
	 * @param bool   $navigation Whether mail and telephone schemes are allowed.
	 * @return string
	 */
	public static function sanitize_resource_url( $value, $navigation = false ) {
		$value = trim( $value );
		if ( '' === $value ) {
			return '';
		}
		$compact = preg_replace( '/[\x00-\x20\x7f]+/', '', $value );
		if ( preg_match( '/^([a-z][a-z0-9+.-]*):/i', $compact, $matches ) ) {
			$allowed = $navigation ? array( 'http', 'https', 'mailto', 'tel' ) : array( 'http', 'https' );
			if ( ! in_array( strtolower( $matches[1] ), $allowed, true ) ) {
				return '';
			}
		}
		return $value;
	}

	/**
	 * Sanitizes the inline formatting supported by a single-value rich-text slot.
	 *
	 * @param string $value Rich-text HTML.
	 * @return string
	 */
	public static function sanitize_rich_text( $value ) {
		return wp_kses(
			(string) $value,
			array(
				'a'      => array( 'href' => true, 'rel' => true, 'target' => true ),
				'b'      => array(),
				'br'     => array(),
				'code'   => array(),
				'em'     => array(),
				'i'      => array(),
				's'      => array(),
				'strong' => array(),
				'u'      => array(),
			)
		);
	}

	/**
	 * @param string $value Source candidate list.
	 * @return string
	 */
	private static function sanitize_srcset( $value ) {
		$candidates = array();
		foreach ( explode( ',', $value ) as $candidate ) {
			$parts = preg_split( '/\s+/', trim( $candidate ) );
			$url   = self::sanitize_resource_url( array_shift( $parts ), false );
			$descriptor = implode( ' ', $parts );
			if ( '' === $url || ( '' !== $descriptor && ! preg_match( '/^(?:\d+w|(?:\d+(?:\.\d+)?|\.\d+)x)$/', $descriptor ) ) ) {
				continue;
			}
			$candidates[] = '' === $descriptor ? $url : $url . ' ' . $descriptor;
		}
		return implode( ', ', $candidates );
	}

	/**
	 * @param string $value CSS value.
	 * @return bool
	 */
	private static function css_value_is_balanced( $value ) {
		$quote = null;
		$depth = 0;
		$escaped = false;
		for ( $index = 0, $length = strlen( $value ); $index < $length; ++$index ) {
			$character = $value[ $index ];
			if ( $escaped ) {
				$escaped = false;
				continue;
			}
			if ( '\\' === $character ) {
				$escaped = true;
				continue;
			}
			if ( null !== $quote ) {
				if ( $quote === $character ) {
					$quote = null;
				}
				continue;
			}
			if ( '"' === $character || "'" === $character ) {
				$quote = $character;
			} elseif ( '(' === $character ) {
				++$depth;
			} elseif ( ')' === $character ) {
				if ( 0 === $depth ) {
					return false;
				}
				--$depth;
			} elseif ( ';' === $character && 0 === $depth ) {
				return false;
			}
		}
		return null === $quote && 0 === $depth && ! $escaped;
	}

	/**
	 * @param string $value CSS declaration list.
	 * @return array|false
	 */
	private static function split_css_declarations( $value ) {
		$declarations = array();
		$buffer       = '';
		$quote        = null;
		$depth        = 0;
		$escaped      = false;
		for ( $index = 0, $length = strlen( $value ); $index < $length; ++$index ) {
			$character = $value[ $index ];
			if ( $escaped ) {
				$buffer .= $character;
				$escaped = false;
				continue;
			}
			if ( '\\' === $character ) {
				$buffer .= $character;
				$escaped = true;
				continue;
			}
			if ( null !== $quote ) {
				$buffer .= $character;
				if ( $quote === $character ) {
					$quote = null;
				}
				continue;
			}
			if ( '"' === $character || "'" === $character ) {
				$quote  = $character;
				$buffer .= $character;
			} elseif ( '(' === $character ) {
				++$depth;
				$buffer .= $character;
			} elseif ( ')' === $character ) {
				if ( 0 === $depth ) {
					return false;
				}
				--$depth;
				$buffer .= $character;
			} elseif ( ';' === $character && 0 === $depth ) {
				if ( '' !== trim( $buffer ) ) {
					$declarations[] = trim( $buffer );
				}
				$buffer = '';
			} else {
				$buffer .= $character;
			}
		}
		if ( null !== $quote || 0 !== $depth || $escaped ) {
			return false;
		}
		if ( '' !== trim( $buffer ) ) {
			$declarations[] = trim( $buffer );
		}
		return $declarations;
	}

	/**
	 * @param string $path    Error path.
	 * @param string $message Error detail.
	 * @return WP_Error
	 */
	private static function error( $path, $message, $status = 400 ) {
		return new WP_Error(
			'code_to_block_invalid_schema',
			'Invalid block tree: ' . $path . ' ' . $message . '.',
			array( 'status' => $status, 'path' => $path )
		);
	}
}
