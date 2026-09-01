<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates and normalizes block documents, including guided style roles.
 */
final class Code_To_Block_Schema {
	const VERSION = 3;
	const COMPAT_VERSION = 2;
	const LEGACY_VERSION = 1;
	const MAX_JSON_BYTES = 2097152;
	const MAX_BLOCKS = 1000;
	const MAX_DEPTH = 50;
	const MAX_ACTIONS = 100;
	const MAX_HISTORY_ENTRIES = 100;
	const MAX_DESIGN_TOKENS = 100;
	const MAX_STYLE_ROLES = 50;
	const MAX_IMPORTED_STYLESHEETS = 20;
	const MAX_IMPORTED_SCRIPTS = 20;
	const MAX_IMPORT_DIAGNOSTICS = 500;
	const MAX_CSS_MAPPING_DECLARATIONS = 1000;
	const MAX_SELECTORS = 2000;
	const MAX_STRING_BYTES = 131072;

	const BLOCK_TYPES = array( 'container', 'text', 'image', 'button', 'woocommerce_cart', 'woocommerce_checkout', 'woocommerce_product', 'woocommerce_product_grid', 'form', 'form_field' );
	const RUNTIME_ACTIONS = array( 'toggle-class', 'add-class', 'remove-class', 'show', 'hide', 'toggle-visibility' );
	const ANIMATION_ACTIONS = array( 'scroll-scrub', 'stagger-sequence' );
	const CSS_ANIMATION_ACTIONS = array( 'css-reveal' );
	const TOKEN_CATEGORIES = array( 'colors', 'typography', 'spacing' );
	const CSS_MAPPING_CONTROLS = array(
		'color', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
		'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
		'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
		'text-transform', 'text-decoration', '-webkit-text-stroke',
		'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius',
		'display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content',
		'gap', 'row-gap', 'column-gap', 'grid-template-columns', 'grid-template-rows', 'flex-grow',
		'flex-shrink', 'flex-basis', 'align-self', 'order', 'grid-column', 'grid-row', 'width',
		'height', 'max-width', 'min-height', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
		'background', 'background-color', 'background-image', 'background-size', 'background-position',
		'box-shadow', 'opacity', 'filter', 'backdrop-filter', 'transform', 'text-shadow', 'overflow',
	);
	const TOKEN_PROPERTIES = array(
		'colors'     => array( 'color' ),
		'typography' => array( 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing' ),
		'spacing'    => array(
			'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
			'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
			'gap', 'row-gap', 'column-gap', 'border-radius',
		),
	);

	const HTML_TAGS = array(
		'a', 'address', 'article', 'aside', 'audio', 'b', 'bdi', 'bdo', 'blockquote',
		'br', 'button', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del',
		'details', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
		'fieldset', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr',
		'i', 'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'main', 'mark', 'menu', 'meter',
		'iframe', 'nav', 'ol', 'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby',
		's', 'samp', 'section', 'select', 'small', 'source', 'span', 'strong', 'sub',
		'summary', 'sup', 'svg', 'g', 'defs', 'symbol', 'use', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect',
		'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'time', 'track',
		'tr', 'u', 'ul', 'var', 'video', 'wbr',
	);

	const VOID_TAGS = array( 'br', 'col', 'hr', 'img', 'input', 'source', 'track', 'wbr' );

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

		if ( ! in_array( $value['schema_version'], array( self::LEGACY_VERSION, self::COMPAT_VERSION, self::VERSION ), true ) ) {
			return self::error( $path . '.schema_version', 'must equal 1, 2, or 3' );
		}
		if ( self::VERSION === $value['schema_version'] ) {
			if ( ! isset( $value['registry_version'] ) || Code_To_Block_Registry::VERSION !== $value['registry_version'] ) {
				return self::error( $path . '.registry_version', 'must match the active control registry version' );
			}
			if ( empty( Code_To_Block_Registry::manifest()['elements'] ) ) {
				return self::error( $path . '.registry_version', 'cannot be validated because the server registry manifest is unavailable', 503 );
			}
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
		$style_roles = null;
		if ( array_key_exists( 'style_roles', $value ) ) {
			$style_roles = self::sanitize_style_roles( $value['style_roles'], $path . '.style_roles' );
			if ( is_wp_error( $style_roles ) ) {
				return $style_roles;
			}
		}
		$feature_flags = null;
		if ( array_key_exists( 'feature_flags', $value ) ) {
			$feature_flags = self::sanitize_feature_flags( $value['feature_flags'], $path . '.feature_flags' );
			if ( is_wp_error( $feature_flags ) ) {
				return $feature_flags;
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
		$imported_assets = null;
		if ( array_key_exists( 'imported_assets', $value ) ) {
			$imported_assets = self::sanitize_imported_assets( $value['imported_assets'], $path . '.imported_assets' );
			if ( is_wp_error( $imported_assets ) ) {
				return $imported_assets;
			}
		}

		$block_count = 0;
		$root        = self::sanitize_block( $value['root'], $path . '.root', 1, $block_count, $value['schema_version'] );
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
		$role_bindings = self::validate_role_bindings(
			$root,
			$path . '.root',
			null === $style_roles ? new stdClass() : $style_roles,
			null === $design_tokens ? new stdClass() : $design_tokens
		);
		if ( is_wp_error( $role_bindings ) ) {
			return $role_bindings;
		}

		$document = array(
			'schema_version' => $value['schema_version'],
			'name'           => $value['name'],
		);
		if ( self::VERSION === $value['schema_version'] ) {
			$document['registry_version'] = Code_To_Block_Registry::VERSION;
			foreach ( array( 'global_styles', 'group_presets', 'element_presets', 'breakpoints', 'migration_log', 'history_metadata' ) as $field ) {
				if ( ! array_key_exists( $field, $value ) ) {
					continue;
				}
				$sanitized_field = self::sanitize_bounded_json( $value[ $field ], $path . '.' . $field, 0 );
				if ( is_wp_error( $sanitized_field ) ) {
					return $sanitized_field;
				}
				$document[ $field ] = $sanitized_field;
			}
		}
		if ( null !== $design_tokens && ! empty( get_object_vars( $design_tokens ) ) ) {
			$document['design_tokens'] = $design_tokens;
		}
		if ( null !== $style_roles && ! empty( get_object_vars( $style_roles ) ) ) {
			$document['style_roles'] = $style_roles;
		}
		if ( null !== $feature_flags && ! empty( get_object_vars( $feature_flags ) ) ) {
			$document['feature_flags'] = $feature_flags;
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
		if ( null !== $imported_assets ) {
			$document['imported_assets'] = $imported_assets;
		}
		$document['root'] = $root;
		return $document;
	}

	/**
	 * Preserves imported scripts for review while making them non-executable.
	 * Call this at write boundaries when the current user lacks unfiltered_html.
	 *
	 * @param array $document Sanitized block document.
	 * @return array
	 */
	public static function disable_imported_script_execution( $document ) {
		if ( ! is_array( $document ) || empty( $document['imported_assets']['scripts'] ) || ! is_array( $document['imported_assets']['scripts'] ) ) {
			return $document;
		}
		foreach ( $document['imported_assets']['scripts'] as &$script ) {
			if ( is_array( $script ) ) {
				$script['enabled_in_editor']  = false;
				$script['enabled_in_preview'] = false;
				$script['enabled_on_publish'] = false;
			}
		}
		unset( $script );
		return $document;
	}

	/**
	 * Validates document-level assets created by the staged code importer.
	 * Original source is retained for review; only separately scoped CSS and
	 * approved script fields are eligible for frontend output.
	 */
	private static function sanitize_imported_assets( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) || ! isset( $value['origin'], $value['page_meta'], $value['stylesheets'], $value['token_bindings'], $value['scripts'], $value['references'], $value['diagnostics'] ) ) {
			return self::error( $path, 'must contain the complete imported page package' );
		}
		$origin = self::object_to_array( $value['origin'] );
		if (
			! is_array( $origin ) ||
			'code-import' !== ( isset( $origin['type'] ) ? $origin['type'] : '' ) ||
			! isset( $origin['import_session_id'], $origin['source_hash'] ) ||
			! is_string( $origin['import_session_id'] ) || ! preg_match( '/^code-import-[a-z0-9]+$/', $origin['import_session_id'] ) ||
			! is_string( $origin['source_hash'] ) || ! preg_match( '/^[a-z0-9]+$/', $origin['source_hash'] )
		) {
			return self::error( $path . '.origin', 'must identify a valid code import session' );
		}

		$page_meta = self::sanitize_imported_page_meta( $value['page_meta'], $path . '.page_meta' );
		if ( is_wp_error( $page_meta ) ) {
			return $page_meta;
		}
		$stylesheets = self::sanitize_imported_stylesheets( $value['stylesheets'], $path . '.stylesheets' );
		if ( is_wp_error( $stylesheets ) ) {
			return $stylesheets;
		}
		$token_bindings = self::sanitize_imported_token_bindings( $value['token_bindings'], $path . '.token_bindings' );
		if ( is_wp_error( $token_bindings ) ) {
			return $token_bindings;
		}
		$scripts = self::sanitize_imported_scripts( $value['scripts'], $path . '.scripts' );
		if ( is_wp_error( $scripts ) ) {
			return $scripts;
		}
		$references = self::sanitize_import_references( $value['references'], $path . '.references' );
		if ( is_wp_error( $references ) ) {
			return $references;
		}
		$diagnostics = self::sanitize_import_diagnostics( $value['diagnostics'], $path . '.diagnostics' );
		if ( is_wp_error( $diagnostics ) ) {
			return $diagnostics;
		}

		return array(
			'origin'         => array(
				'type'              => 'code-import',
				'import_session_id' => $origin['import_session_id'],
				'source_hash'       => $origin['source_hash'],
			),
			'page_meta'      => $page_meta,
			'stylesheets'    => $stylesheets,
			'token_bindings' => $token_bindings,
			'scripts'        => $scripts,
			'references'     => $references,
			'diagnostics'    => $diagnostics,
		);
	}

	private static function sanitize_imported_page_meta( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}
		$result = array();
		if ( isset( $value['document_type'] ) && in_array( $value['document_type'], array( 'full-document', 'fragment' ), true ) ) {
			$result['document_type'] = $value['document_type'];
		}
		if ( isset( $value['source_type'] ) && in_array( $value['source_type'], array( 'full-document', 'mixed', 'html-fragment', 'stylesheet', 'javascript', 'php', 'plain-text' ), true ) ) {
			$result['source_type'] = $value['source_type'];
		}
		$languages = isset( $value['detected_languages'] ) ? $value['detected_languages'] : array();
		if ( ! is_array( $languages ) || count( $languages ) > 4 ) {
			return self::error( $path . '.detected_languages', 'must contain no more than four detected languages' );
		}
		$result['detected_languages'] = array_values( array_intersect( array( 'html', 'css', 'javascript', 'php' ), $languages ) );
		foreach ( array( 'doctype', 'title' ) as $key ) {
			if ( isset( $value[ $key ] ) ) {
				if ( ! is_string( $value[ $key ] ) || strlen( $value[ $key ] ) > 1000 ) {
					return self::error( $path . '.' . $key, 'must be a string of 1000 bytes or fewer' );
				}
				$result[ $key ] = $value[ $key ];
			}
		}
		if ( isset( $value['base_href'] ) ) {
			if ( ! is_string( $value['base_href'] ) || strlen( $value['base_href'] ) > 4000 || preg_match( '/[\x00-\x1f]/', $value['base_href'] ) ) {
				return self::error( $path . '.base_href', 'must be a safe string of 4000 bytes or fewer' );
			}
			$result['base_href'] = $value['base_href'];
		}
		foreach ( array( 'html_attributes', 'body_attributes' ) as $key ) {
			$attributes = isset( $value[ $key ] ) ? self::sanitize_import_string_map( $value[ $key ], $path . '.' . $key, 100 ) : new stdClass();
			if ( is_wp_error( $attributes ) ) {
				return $attributes;
			}
			$result[ $key ] = $attributes;
		}
		foreach ( array( 'metas', 'links' ) as $key ) {
			if ( ! isset( $value[ $key ] ) || ! is_array( $value[ $key ] ) || count( $value[ $key ] ) > 100 ) {
				return self::error( $path . '.' . $key, 'must be an array with no more than 100 entries' );
			}
			$result[ $key ] = array();
			foreach ( $value[ $key ] as $index => $item ) {
				$item = self::sanitize_import_string_map( $item, $path . '.' . $key . '[' . $index . ']', 30 );
				if ( is_wp_error( $item ) ) {
					return $item;
				}
				$result[ $key ][] = $item;
			}
		}
		return $result;
	}

	private static function sanitize_imported_stylesheets( $value, $path ) {
		if ( ! is_array( $value ) || count( $value ) > self::MAX_IMPORTED_STYLESHEETS ) {
			return self::error( $path, 'must be an array with no more than 20 stylesheets' );
		}
		$result = array();
		foreach ( $value as $index => $stylesheet_value ) {
			$stylesheet = self::object_to_array( $stylesheet_value );
			$item_path = $path . '[' . $index . ']';
			if ( ! is_array( $stylesheet ) || ! isset( $stylesheet['id'], $stylesheet['source_text'], $stylesheet['scoped_source'] ) ) {
				return self::error( $item_path, 'must contain id, source_text, and scoped_source' );
			}
			if ( ! is_string( $stylesheet['id'] ) || ! preg_match( '/^[a-z0-9_-]{1,100}$/', $stylesheet['id'] ) ) {
				return self::error( $item_path . '.id', 'must be a safe asset ID' );
			}
			foreach ( array( 'source_text', 'scoped_source' ) as $key ) {
				if ( ! is_string( $stylesheet[ $key ] ) || strlen( $stylesheet[ $key ] ) > self::MAX_STRING_BYTES || preg_match( '/[\x00]|<\s*\/\s*style/i', $stylesheet[ $key ] ) ) {
					return self::error( $item_path . '.' . $key, 'contains unsafe or oversized stylesheet source' );
				}
			}
			if ( preg_match( '/(?:expression\s*\(|javascript\s*:|(?:^|[;{}])\s*(?:behavior|-moz-binding)\s*:)/i', $stylesheet['scoped_source'] ) ) {
				return self::error( $item_path . '.scoped_source', 'contains executable CSS syntax' );
			}
			$clean = array(
				'id'            => $stylesheet['id'],
				'source_text'   => $stylesheet['source_text'],
				'scoped_source' => $stylesheet['scoped_source'],
			);
			foreach ( array( 'selectors', 'media_conditions', 'keyframes', 'custom_properties' ) as $key ) {
				$items = isset( $stylesheet[ $key ] ) ? $stylesheet[ $key ] : array();
				if ( ! is_array( $items ) || count( $items ) > self::MAX_SELECTORS ) {
					return self::error( $item_path . '.' . $key, 'contains too many inventory entries' );
				}
				$clean[ $key ] = array();
				foreach ( $items as $item ) {
					if ( is_string( $item ) && strlen( $item ) <= 1000 ) {
						$clean[ $key ][] = $item;
					}
				}
			}
			$result[] = $clean;
		}
		return $result;
	}

	private static function sanitize_imported_token_bindings( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) || count( $value ) > self::MAX_DESIGN_TOKENS ) {
			return self::error( $path, 'must be an object with no more than 100 bindings' );
		}
		$result = new stdClass();
		foreach ( $value as $css_name => $reference ) {
			if ( ! is_string( $css_name ) || ! preg_match( '/^--[a-z0-9_-]+$/i', $css_name ) || ! is_string( $reference ) || null === self::token_reference_parts( $reference ) ) {
				return self::error( $path, 'contains an invalid CSS variable binding' );
			}
			$result->{$css_name} = $reference;
		}
		return $result;
	}

	private static function sanitize_imported_scripts( $value, $path ) {
		if ( ! is_array( $value ) || count( $value ) > self::MAX_IMPORTED_SCRIPTS ) {
			return self::error( $path, 'must be an array with no more than 20 scripts' );
		}
		$result = array();
		foreach ( $value as $index => $script_value ) {
			$script = self::object_to_array( $script_value );
			$item_path = $path . '[' . $index . ']';
			if ( ! is_array( $script ) || ! isset( $script['id'], $script['placement'], $script['type'], $script['source'], $script['attributes'], $script['enabled_in_editor'], $script['enabled_in_preview'], $script['enabled_on_publish'], $script['origin'] ) ) {
				return self::error( $item_path, 'is missing required script asset fields' );
			}
			if ( ! is_string( $script['id'] ) || ! preg_match( '/^[a-z0-9_-]{1,100}$/', $script['id'] ) || ! in_array( $script['placement'], array( 'head', 'body', 'body-end' ), true ) || 'imported' !== $script['origin'] ) {
				return self::error( $item_path, 'contains invalid script identity or placement' );
			}
			if ( ! is_string( $script['source'] ) || strlen( $script['source'] ) > self::MAX_STRING_BYTES || preg_match( '/[\x00]|<\s*\/\s*script/i', $script['source'] ) ) {
				return self::error( $item_path . '.source', 'contains unsafe or oversized script source' );
			}
			if ( ! is_string( $script['type'] ) || strlen( $script['type'] ) > 100 ) {
				return self::error( $item_path . '.type', 'must be a short string' );
			}
			foreach ( array( 'enabled_in_editor', 'enabled_in_preview', 'enabled_on_publish' ) as $key ) {
				if ( ! is_bool( $script[ $key ] ) ) {
					return self::error( $item_path . '.' . $key, 'must be boolean' );
				}
			}
			$clean = array(
				'id'                 => $script['id'],
				'placement'          => $script['placement'],
				'type'               => $script['type'],
				'source'             => $script['source'],
				'attributes'         => self::sanitize_import_string_map( $script['attributes'], $item_path . '.attributes', 30 ),
				'enabled_in_editor'  => false,
				'enabled_in_preview' => $script['enabled_in_preview'],
				'enabled_on_publish' => $script['enabled_on_publish'],
				'origin'             => 'imported',
			);
			if ( is_wp_error( $clean['attributes'] ) ) {
				return $clean['attributes'];
			}
			if ( isset( $script['src'] ) && is_string( $script['src'] ) ) {
				$src = self::sanitize_resource_url( $script['src'], false );
				if ( '' !== $src ) {
					$clean['src'] = $src;
				}
			}
			$result[] = $clean;
		}
		return $result;
	}

	private static function sanitize_import_references( $value, $path ) {
		if ( ! is_array( $value ) || count( $value ) > 2000 ) {
			return self::error( $path, 'must be an array with no more than 2000 references' );
		}
		$result = array();
		foreach ( $value as $reference_value ) {
			$reference = self::object_to_array( $reference_value );
			if ( ! is_array( $reference ) || ! isset( $reference['type'], $reference['value'], $reference['external'], $reference['blocked'] ) ) {
				continue;
			}
			if ( is_string( $reference['type'] ) && is_string( $reference['value'] ) && strlen( $reference['type'] ) <= 100 && strlen( $reference['value'] ) <= 4000 && is_bool( $reference['external'] ) && is_bool( $reference['blocked'] ) ) {
				$result[] = array( 'type' => $reference['type'], 'value' => $reference['value'], 'external' => $reference['external'], 'blocked' => $reference['blocked'] );
			}
		}
		return $result;
	}

	private static function sanitize_import_diagnostics( $value, $path ) {
		if ( ! is_array( $value ) || count( $value ) > self::MAX_IMPORT_DIAGNOSTICS ) {
			return self::error( $path, 'must be an array with no more than 500 diagnostics' );
		}
		$result = array();
		foreach ( $value as $diagnostic_value ) {
			$item = self::object_to_array( $diagnostic_value );
			if ( ! is_array( $item ) || ! isset( $item['severity'], $item['code'], $item['message'] ) || ! in_array( $item['severity'], array( 'info', 'warning', 'error' ), true ) ) {
				continue;
			}
			if ( ! is_string( $item['code'] ) || ! preg_match( '/^[A-Z0-9_]{2,100}$/', $item['code'] ) || ! is_string( $item['message'] ) || strlen( $item['message'] ) > 2000 ) {
				continue;
			}
			$clean = array( 'severity' => $item['severity'], 'code' => $item['code'], 'message' => $item['message'] );
			if ( isset( $item['source'] ) && in_array( $item['source'], array( 'html', 'css', 'script', 'php' ), true ) ) $clean['source'] = $item['source'];
			foreach ( array( 'line', 'column' ) as $key ) {
				if ( isset( $item[ $key ] ) && is_int( $item[ $key ] ) && $item[ $key ] > 0 ) $clean[ $key ] = $item[ $key ];
			}
			$result[] = $clean;
		}
		return $result;
	}

	private static function sanitize_import_string_map( $value, $path, $limit ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) || count( $value ) > $limit ) {
			return self::error( $path, 'must be a bounded attribute object' );
		}
		$result = new stdClass();
		foreach ( $value as $name => $item ) {
			if ( ! is_string( $name ) || ! preg_match( '/^[a-z_:][a-z0-9:._-]*$/i', $name ) || ! is_string( $item ) || strlen( $item ) > 4000 || preg_match( '/^on/i', $name ) ) {
				continue;
			}
			$result->{strtolower( $name )} = $item;
		}
		return $result;
	}

	private static function sanitize_imported_css_rules( $value, $path ) {
		if ( ! is_array( $value ) || count( $value ) > 200 ) {
			return self::error( $path, 'must contain no more than 200 matched rules' );
		}
		$result = array();
		foreach ( $value as $index => $rule_value ) {
			$rule = self::object_to_array( $rule_value );
			if ( ! is_array( $rule ) || ! isset( $rule['selector'], $rule['declarations'], $rule['order'], $rule['condition'], $rule['stylesheet_id'] ) ) continue;
			if ( ! is_string( $rule['selector'] ) || strlen( $rule['selector'] ) > 2000 || ! is_array( $rule['declarations'] ) || count( $rule['declarations'] ) > 200 ) continue;
			$declarations = array();
			foreach ( $rule['declarations'] as $declaration_value ) {
				$declaration = self::object_to_array( $declaration_value );
				if ( ! is_array( $declaration ) || ! isset( $declaration['property'], $declaration['value'], $declaration['important'] ) ) continue;
				if ( is_string( $declaration['property'] ) && is_string( $declaration['value'] ) && is_bool( $declaration['important'] ) && preg_match( '/^(?:--[a-z0-9_-]+|-?[a-z][a-z0-9-]*)$/i', $declaration['property'] ) && self::css_property_value_is_safe( $declaration['property'], $declaration['value'] ) ) {
					$declarations[] = array( 'property' => $declaration['property'], 'value' => $declaration['value'], 'important' => $declaration['important'] );
				}
			}
			$result[] = array(
				'selector'      => $rule['selector'],
				'declarations'  => $declarations,
				'order'         => is_int( $rule['order'] ) ? $rule['order'] : $index,
				'condition'     => is_string( $rule['condition'] ) ? substr( $rule['condition'], 0, 1000 ) : 'base',
				'stylesheet_id' => is_string( $rule['stylesheet_id'] ) ? substr( $rule['stylesheet_id'], 0, 100 ) : '',
			);
		}
		return $result;
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
	private static function sanitize_block( $value, $path, $depth, &$block_count, $schema_version = self::COMPAT_VERSION ) {
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

		$required_fields = array( 'id', 'type', 'tag', 'attributes', 'children', 'meta' );
		if ( self::VERSION !== $schema_version ) {
			$required_fields[] = 'styles';
		}
		if ( self::VERSION === $schema_version ) {
			$required_fields[] = 'element';
			$required_fields[] = 'definition_version';
		}
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

		if ( ! is_string( $value['tag'] ) || ! self::html_tag_is_allowed( strtolower( $value['tag'] ) ) ) {
			return self::error( $path . '.tag', 'is not a supported HTML tag' );
		}

		$tag        = strtolower( $value['tag'] );
		$element_id = isset( $value['element'] ) && is_string( $value['element'] ) ? $value['element'] : '';
		$definition_version = isset( $value['definition_version'] ) ? $value['definition_version'] : null;
		if ( '' !== $element_id ) {
			if ( ! preg_match( '/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/', $element_id ) || ! Code_To_Block_Registry::exists( $element_id ) ) {
				return self::error( $path . '.element', 'is not a registered element definition' );
			}
			$definition = Code_To_Block_Registry::get( $element_id );
			if ( ! is_int( $definition_version ) || $definition_version !== $definition['version'] ) {
				return self::error( $path . '.definition_version', 'must match the registered element definition version' );
			}
			if ( ! Code_To_Block_Registry::tag_is_allowed( $element_id, $tag ) ) {
				return self::error( $path . '.tag', 'is not allowed by the element definition' );
			}
			if ( isset( $definition['rendererFamily'] ) && $definition['rendererFamily'] !== $value['type'] ) {
				return self::error( $path . '.type', 'must match the element renderer family' );
			}
		} elseif ( self::VERSION === $schema_version ) {
			return self::error( $path . '.element', 'is required for schema version 3' );
		}
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
				$sanitized_child = self::sanitize_block( $child_array, $child_path, $depth + 1, $block_count, $schema_version );
			}

			if ( is_wp_error( $sanitized_child ) ) {
				return $sanitized_child;
			}
			$children[] = $sanitized_child;
		}

		$styles = null;
		if ( array_key_exists( 'styles', $value ) ) {
			$styles = self::sanitize_style_set( $value['styles'], $path . '.styles' );
			if ( is_wp_error( $styles ) ) {
				return $styles;
			}
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
		);
		if ( null !== $styles ) {
			$block['styles'] = $styles;
		}
		if ( '' !== $element_id ) {
			$block['element']            = $element_id;
			$block['definition_version'] = $definition_version;
			$props = self::sanitize_v3_props( isset( $value['props'] ) ? $value['props'] : array(), $path . '.props', $element_id );
			if ( is_wp_error( $props ) ) {
				return $props;
			}
			$block['props'] = $props;
		}
		if ( array_key_exists( 'style', $value ) ) {
			$v3_style = self::sanitize_v3_style( $value['style'], $path . '.style', $element_id );
			if ( is_wp_error( $v3_style ) ) {
				return $v3_style;
			}
			$block['style'] = $v3_style;
		}
		if ( array_key_exists( 'advanced', $value ) ) {
			$advanced = self::sanitize_v3_advanced( $value['advanced'], $path . '.advanced' );
			if ( is_wp_error( $advanced ) ) {
				return $advanced;
			}
			$block['advanced'] = $advanced;
		}

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
		if ( array_key_exists( 'imported_native_html', $meta ) && true === $meta['imported_native_html'] ) {
			$block['meta']['imported_native_html'] = true;
		}
		if ( array_key_exists( 'imported_original_tag', $meta ) ) {
			if ( ! is_string( $meta['imported_original_tag'] ) || ! preg_match( '/^[a-z][a-z0-9._-]{0,99}$/', $meta['imported_original_tag'] ) ) {
				return self::error( $path . '.meta.imported_original_tag', 'must be a safe original element name' );
			}
			$block['meta']['imported_original_tag'] = $meta['imported_original_tag'];
		}
		if ( array_key_exists( 'imported_css_rules', $meta ) ) {
			$imported_css_rules = self::sanitize_imported_css_rules( $meta['imported_css_rules'], $path . '.meta.imported_css_rules' );
			if ( is_wp_error( $imported_css_rules ) ) {
				return $imported_css_rules;
			}
			if ( ! empty( $imported_css_rules ) ) {
				$block['meta']['imported_css_rules'] = $imported_css_rules;
			}
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

	/**
	 * Sanitizes a bounded extension-safe JSON value.
	 *
	 * @param mixed  $value Incoming JSON value.
	 * @param string $path Schema path.
	 * @param int    $depth Current depth.
	 * @return mixed|WP_Error
	 */
	private static function sanitize_bounded_json( $value, $path, $depth ) {
		if ( $depth > 20 ) {
			return self::error( $path, 'exceeds the maximum nested data depth of 20', 413 );
		}
		if ( is_null( $value ) || is_bool( $value ) || is_int( $value ) ) {
			return $value;
		}
		if ( is_float( $value ) ) {
			return is_finite( $value ) ? $value : self::error( $path, 'must be a finite number' );
		}
		if ( is_string( $value ) ) {
			return strlen( $value ) <= self::MAX_STRING_BYTES ? $value : self::error( $path, 'exceeds the maximum string size', 413 );
		}
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) || count( $value ) > 200 ) {
			return self::error( $path, 'must be an object or array with no more than 200 entries', 413 );
		}
		$result = array();
		foreach ( $value as $key => $item ) {
			if ( is_string( $key ) && ! preg_match( '/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/', $key ) ) {
				return self::error( $path, 'contains an invalid key' );
			}
			$clean = self::sanitize_bounded_json( $item, $path . '[' . $key . ']', $depth + 1 );
			if ( is_wp_error( $clean ) ) {
				return $clean;
			}
			$result[ $key ] = $clean;
		}
		return $result;
	}

	/**
	 * @param mixed  $value Incoming semantic props.
	 * @param string $path Schema path.
	 * @param string $element_id Definition ID.
	 * @return array|WP_Error
	 */
	private static function sanitize_v3_props( $value, $path, $element_id ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) || count( $value ) > 100 ) {
			return self::error( $path, 'must be an object with no more than 100 properties', 413 );
		}
		$result = array();
		foreach ( $value as $prop => $prop_value ) {
			if ( ! is_string( $prop ) || ! Code_To_Block_Registry::prop_is_allowed( $element_id, $prop ) ) {
				return self::error( $path . '.' . $prop, 'is not registered for this element' );
			}
			$clean = self::sanitize_bounded_json( $prop_value, $path . '.' . $prop, 0 );
			if ( is_wp_error( $clean ) ) {
				return $clean;
			}
			$result[ $prop ] = $clean;
		}
		return $result;
	}

	/**
	 * @param string $context_key Context key.
	 * @param string $element_id Definition ID.
	 * @return bool
	 */
	private static function v3_context_is_allowed( $context_key, $element_id ) {
		if ( 'base' === $context_key ) {
			return true;
		}
		if ( ! preg_match( '/^(?:bp:(tablet|mobile))?(?:\|?state:([A-Za-z][A-Za-z0-9]*))?$/', $context_key, $matches ) ) {
			return false;
		}
		if ( empty( $matches[1] ) && empty( $matches[2] ) ) {
			return false;
		}
		return empty( $matches[2] ) || Code_To_Block_Registry::state_is_allowed( $element_id, $matches[2] );
	}

	/**
	 * @param mixed  $value Incoming v3 style set.
	 * @param string $path Schema path.
	 * @return array|WP_Error
	 */
	private static function sanitize_v3_style_set( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}
		$legacy = array(
			'mapped'              => isset( $value['declarations'] ) ? $value['declarations'] : array(),
			'custom_css_fallback' => isset( $value['custom_declarations'] ) ? $value['custom_declarations'] : '',
		);
		foreach ( array( 'token_bindings', 'role_bindings' ) as $field ) {
			if ( array_key_exists( $field, $value ) ) {
				$legacy[ $field ] = $value[ $field ];
			}
		}
		$sanitized = self::sanitize_style_set( $legacy, $path );
		if ( is_wp_error( $sanitized ) ) {
			return $sanitized;
		}
		$result = array( 'declarations' => $sanitized['mapped'] );
		if ( '' !== $sanitized['custom_css_fallback'] ) {
			$result['custom_declarations'] = $sanitized['custom_css_fallback'];
		}
		foreach ( array( 'token_bindings', 'role_bindings' ) as $field ) {
			if ( isset( $sanitized[ $field ] ) ) {
				$result[ $field ] = $sanitized[ $field ];
			}
		}
		if ( array_key_exists( 'origin_notes', $value ) ) {
			$notes = self::sanitize_bounded_json( $value['origin_notes'], $path . '.origin_notes', 0 );
			if ( is_wp_error( $notes ) ) {
				return $notes;
			}
			$result['origin_notes'] = $notes;
		}
		return $result;
	}

	/**
	 * @param mixed  $value Incoming v3 style model.
	 * @param string $path Schema path.
	 * @param string $element_id Definition ID.
	 * @return array|WP_Error
	 */
	private static function sanitize_v3_style( $value, $path, $element_id ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}
		$targets = isset( $value['targets'] ) ? self::object_to_array( $value['targets'] ) : array();
		if ( ! is_array( $targets ) || count( $targets ) > 32 ) {
			return self::error( $path . '.targets', 'must contain no more than 32 registered targets', 413 );
		}
		$result_targets = array();
		foreach ( $targets as $target_id => $target_value ) {
			if ( ! is_string( $target_id ) || ! Code_To_Block_Registry::target_is_allowed( $element_id, $target_id ) ) {
				return self::error( $path . '.targets.' . $target_id, 'is not registered for this element' );
			}
			$target_value = self::object_to_array( $target_value );
			$contexts = isset( $target_value['contexts'] ) ? self::object_to_array( $target_value['contexts'] ) : array();
			if ( ! is_array( $contexts ) || count( $contexts ) > 64 ) {
				return self::error( $path . '.targets.' . $target_id . '.contexts', 'must contain no more than 64 contexts', 413 );
			}
			$clean_contexts = array();
			foreach ( $contexts as $context_key => $style_set ) {
				if ( ! is_string( $context_key ) || ! self::v3_context_is_allowed( $context_key, $element_id ) ) {
					return self::error( $path . '.targets.' . $target_id . '.contexts.' . $context_key, 'is not a valid element style context' );
				}
				$clean_style_set = self::sanitize_v3_style_set( $style_set, $path . '.targets.' . $target_id . '.contexts.' . $context_key );
				if ( is_wp_error( $clean_style_set ) ) {
					return $clean_style_set;
				}
				$clean_contexts[ $context_key ] = $clean_style_set;
			}
			$result_targets[ $target_id ] = array( 'contexts' => $clean_contexts );
		}
		$result = array( 'targets' => $result_targets );
		if ( array_key_exists( 'preset_refs', $value ) ) {
			$refs = self::sanitize_bounded_json( $value['preset_refs'], $path . '.preset_refs', 0 );
			if ( is_wp_error( $refs ) ) {
				return $refs;
			}
			$result['preset_refs'] = $refs;
		}
		if ( array_key_exists( 'legacy', $value ) ) {
			$legacy = self::sanitize_bounded_json( $value['legacy'], $path . '.legacy', 0 );
			if ( is_wp_error( $legacy ) ) {
				return $legacy;
			}
			$result['legacy'] = $legacy;
		}
		return $result;
	}

	/**
	 * @param mixed  $value Incoming v3 advanced model.
	 * @param string $path Schema path.
	 * @return array|WP_Error
	 */
	private static function sanitize_v3_advanced( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}
		$result = array();
		if ( isset( $value['visibility'] ) ) {
			$visibility = self::object_to_array( $value['visibility'] );
			if ( ! is_array( $visibility ) ) {
				return self::error( $path . '.visibility', 'must be an object' );
			}
			$clean_visibility = array();
			foreach ( array( 'desktop', 'tablet', 'mobile' ) as $breakpoint ) {
				if ( array_key_exists( $breakpoint, $visibility ) ) {
					if ( ! is_bool( $visibility[ $breakpoint ] ) ) {
						return self::error( $path . '.visibility.' . $breakpoint, 'must be a boolean' );
					}
					$clean_visibility[ $breakpoint ] = $visibility[ $breakpoint ];
				}
			}
			$result['visibility'] = $clean_visibility;
		}
		if ( isset( $value['conditions'] ) ) {
			$conditions = self::sanitize_visibility_conditions( $value['conditions'], $path . '.conditions' );
			if ( is_wp_error( $conditions ) ) {
				return $conditions;
			}
			$result['conditions'] = $conditions;
		}
		if ( isset( $value['permissions'] ) ) {
			$permissions = self::sanitize_element_permissions( $value['permissions'], $path . '.permissions' );
			if ( is_wp_error( $permissions ) ) {
				return $permissions;
			}
			$result['permissions'] = $permissions;
		}
		if ( isset( $value['performance'] ) ) {
			$performance = self::sanitize_bounded_json( $value['performance'], $path . '.performance', 0 );
			if ( is_wp_error( $performance ) ) {
				return $performance;
			}
			$result['performance'] = $performance;
		}
		foreach ( array( 'placement', 'motion', 'accessibility', 'attributes', 'developer', 'actions' ) as $field ) {
			if ( ! array_key_exists( $field, $value ) ) {
				continue;
			}
			$clean = self::sanitize_bounded_json( $value[ $field ], $path . '.' . $field, 0 );
			if ( is_wp_error( $clean ) ) {
				return $clean;
			}
			$result[ $field ] = $clean;
		}
		return $result;
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
			'audio'      => array( 'src', 'controls', 'autoplay', 'loop', 'muted', 'preload', 'crossorigin' ),
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
			'svg'        => array( 'viewbox', 'width', 'height', 'fill', 'stroke', 'xmlns', 'aria-hidden', 'focusable' ),
			'g'          => array( 'fill', 'stroke', 'transform' ),
			'use'        => array( 'href', 'xlink:href', 'x', 'y', 'width', 'height' ),
			'path'       => array( 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'transform' ),
			'circle'     => array( 'cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width' ),
			'ellipse'    => array( 'cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width' ),
			'line'       => array( 'x1', 'x2', 'y1', 'y2', 'stroke', 'stroke-width' ),
			'polyline'   => array( 'points', 'fill', 'stroke', 'stroke-width' ),
			'polygon'    => array( 'points', 'fill', 'stroke', 'stroke-width' ),
			'rect'       => array( 'x', 'y', 'rx', 'ry', 'width', 'height', 'fill', 'stroke', 'stroke-width' ),
			'td'         => array( 'colspan', 'rowspan', 'headers' ),
			'textarea'   => array( 'name', 'placeholder', 'required', 'rows', 'cols', 'disabled', 'maxlength', 'readonly', 'autocomplete' ),
			'th'         => array( 'colspan', 'rowspan', 'headers', 'scope', 'abbr' ),
			'time'       => array( 'datetime' ),
			'track'      => array( 'default', 'kind', 'label', 'src', 'srclang' ),
			'video'      => array( 'src', 'poster', 'controls', 'autoplay', 'loop', 'muted', 'playsinline', 'preload', 'crossorigin', 'width', 'height' ),
		);

		return isset( $by_tag[ $tag ] ) && in_array( $name, $by_tag[ $tag ], true );
	}

	/**
	 * Allows the explicit safe vocabulary plus inert standards-compliant custom
	 * elements. Scriptable and parser-control tags remain excluded.
	 */
	public static function html_tag_is_allowed( $tag ) {
		return in_array( $tag, self::HTML_TAGS, true ) || (bool) preg_match( '/^[a-z][a-z0-9._-]*-[a-z0-9._-]+$/', $tag );
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

	private static function sanitize_feature_flags( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}
		$result = new stdClass();
		if ( array_key_exists( 'guided_roles', $value ) ) {
			if ( ! is_bool( $value['guided_roles'] ) ) {
				return self::error( $path . '.guided_roles', 'must be a boolean' );
			}
			$result->guided_roles = $value['guided_roles'];
		}
		return $result;
	}

	private static function sanitize_role_reference_map( $value, $path, $allow_value_key = false ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) ) {
			return self::error( $path, 'must be an object' );
		}
		$result = new stdClass();
		foreach ( $value as $property => $reference ) {
			if ( ! is_string( $property ) || ( 'value' !== $property && ! preg_match( '/^-?[a-z][a-z0-9-]*$/i', $property ) ) ) {
				return self::error( $path, 'contains an invalid role property' );
			}
			if ( 'value' === $property && ! $allow_value_key ) {
				return self::error( $path . '.value', 'is only valid for spacing roles' );
			}
			if ( ! is_string( $reference ) || null === self::token_reference_parts( $reference ) ) {
				return self::error( $path . '.' . $property, 'must be a valid design token reference' );
			}
			$result->{$property} = $reference;
		}
		return $result;
	}

	private static function sanitize_role_variants( $value, $path, $allow_value_key ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) || ! array_key_exists( 'default', $value ) ) {
			return self::error( $path, 'must be an object containing a default variant' );
		}
		$result = new stdClass();
		foreach ( array( 'minus', 'default', 'plus' ) as $name ) {
			if ( ! array_key_exists( $name, $value ) || null === $value[ $name ] ) {
				continue;
			}
			$variant = self::sanitize_role_reference_map( $value[ $name ], $path . '.' . $name, $allow_value_key );
			if ( is_wp_error( $variant ) ) {
				return $variant;
			}
			$result->{$name} = $variant;
		}
		return $result;
	}

	private static function sanitize_style_roles( $value, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) || count( $value ) > self::MAX_STYLE_ROLES ) {
			return self::error( $path, 'must be an object with no more than 50 roles' );
		}
		$result = new stdClass();
		foreach ( $value as $id => $recipe_value ) {
			$role_path = $path . '.' . $id;
			if ( ! is_string( $id ) || ! preg_match( '/^(?:type|space)\.[a-z][a-z0-9-]{0,39}$/', $id ) ) {
				return self::error( $role_path, 'must use a stable semantic role ID' );
			}
			$recipe_value = self::object_to_array( $recipe_value );
			if ( ! is_array( $recipe_value ) || ! isset( $recipe_value['id'], $recipe_value['kind'], $recipe_value['labelKey'], $recipe_value['descriptionKey'], $recipe_value['propertyTokenRefs'], $recipe_value['variants'], $recipe_value['supportedContexts'], $recipe_value['builtIn'], $recipe_value['version'] ) ) {
				return self::error( $role_path, 'is missing required role fields' );
			}
			if ( $recipe_value['id'] !== $id ) {
				return self::error( $role_path . '.id', 'must match its role key' );
			}
			if ( ! in_array( $recipe_value['kind'], array( 'typography', 'spacing' ), true ) ) {
				return self::error( $role_path . '.kind', 'must be typography or spacing' );
			}
			foreach ( array( 'labelKey', 'descriptionKey' ) as $key ) {
				if ( ! is_string( $recipe_value[ $key ] ) || '' === trim( $recipe_value[ $key ] ) || strlen( $recipe_value[ $key ] ) > 100 ) {
					return self::error( $role_path . '.' . $key, 'must be a non-empty string of 100 bytes or fewer' );
				}
			}
			$spacing = 'spacing' === $recipe_value['kind'];
			$refs = self::sanitize_role_reference_map( $recipe_value['propertyTokenRefs'], $role_path . '.propertyTokenRefs', $spacing );
			if ( is_wp_error( $refs ) ) {
				return $refs;
			}
			$variants = self::sanitize_role_variants( $recipe_value['variants'], $role_path . '.variants', $spacing );
			if ( is_wp_error( $variants ) ) {
				return $variants;
			}
			$contexts = array();
			if ( ! is_array( $recipe_value['supportedContexts'] ) || count( $recipe_value['supportedContexts'] ) > 30 ) {
				return self::error( $role_path . '.supportedContexts', 'must be an array with no more than 30 items' );
			}
			foreach ( $recipe_value['supportedContexts'] as $context ) {
				if ( ! is_string( $context ) || ! preg_match( '/^[a-z][a-z0-9-]{0,49}$/', $context ) ) {
					return self::error( $role_path . '.supportedContexts', 'contains an invalid context ID' );
				}
				$contexts[] = $context;
			}
			if ( ! is_bool( $recipe_value['builtIn'] ) || ! is_int( $recipe_value['version'] ) || $recipe_value['version'] < 1 ) {
				return self::error( $role_path, 'contains invalid builtIn or version metadata' );
			}
			$recipe = array(
				'id'                => $id,
				'kind'              => $recipe_value['kind'],
				'labelKey'          => $recipe_value['labelKey'],
				'descriptionKey'    => $recipe_value['descriptionKey'],
				'propertyTokenRefs' => $refs,
				'variants'          => $variants,
				'supportedContexts' => $contexts,
				'builtIn'           => $recipe_value['builtIn'],
				'version'           => $recipe_value['version'],
			);
			if ( array_key_exists( 'densityVariants', $recipe_value ) ) {
				$density = self::sanitize_role_variants( $recipe_value['densityVariants'], $role_path . '.densityVariants', false );
				if ( is_wp_error( $density ) ) {
					return $density;
				}
				$recipe['densityVariants'] = $density;
			}
			$result->{$id} = $recipe;
		}
		return $result;
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

				$clean_token = array(
					'label' => $token['label'],
					'value' => $token['value'],
				);
				if ( array_key_exists( 'built_in', $token ) ) {
					if ( ! is_bool( $token['built_in'] ) ) {
						return self::error( $token_path . '.built_in', 'must be a boolean' );
					}
					$clean_token['built_in'] = $token['built_in'];
				}
				$tokens->{$id} = $clean_token;
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

	private static function sanitize_relative_step( $value, $path ) {
		if ( ! is_int( $value ) || ! in_array( $value, array( -1, 0, 1 ), true ) ) {
			return self::error( $path, 'must be -1, 0, or 1' );
		}
		return $value;
	}

	private static function sanitize_role_binding( $value, $scope, $path ) {
		$value = self::object_to_array( $value );
		if ( ! is_array( $value ) || ! isset( $value['roleId'], $value['kind'], $value['overrides'], $value['source'] ) ) {
			return self::error( $path, 'is missing required role-binding fields' );
		}
		if ( ! is_string( $value['roleId'] ) || ! preg_match( '/^(?:type|space)\.[a-z][a-z0-9-]{0,39}$/', $value['roleId'] ) ) {
			return self::error( $path . '.roleId', 'must be a valid semantic role ID' );
		}
		if ( ! in_array( $value['kind'], array( 'typography', 'spacing' ), true ) ) {
			return self::error( $path . '.kind', 'must be typography or spacing' );
		}
		if ( 'typography' === $value['kind'] && 'typography' !== $scope ) {
			return self::error( $path, 'typography bindings must use the typography scope' );
		}
		if ( 'spacing' === $value['kind'] && ! in_array( $scope, self::TOKEN_PROPERTIES['spacing'], true ) ) {
			return self::error( $path, 'spacing bindings must use a supported spacing property scope' );
		}
		if ( ! in_array( $value['source'], array( 'built-in', 'user', 'imported', 'legacy' ), true ) ) {
			return self::error( $path . '.source', 'must use a supported role source' );
		}
		$binding = array(
			'roleId'   => $value['roleId'],
			'kind'     => $value['kind'],
			'overrides'=> array(),
			'source'   => $value['source'],
		);
		if ( 'typography' === $value['kind'] ) {
			$adjustment = isset( $value['typographyAdjustment'] ) ? self::object_to_array( $value['typographyAdjustment'] ) : null;
			if ( ! is_array( $adjustment ) || ! isset( $adjustment['size'], $adjustment['density'] ) ) {
				return self::error( $path . '.typographyAdjustment', 'must contain size and density' );
			}
			$size = self::sanitize_relative_step( $adjustment['size'], $path . '.typographyAdjustment.size' );
			if ( is_wp_error( $size ) ) {
				return $size;
			}
			$density = self::sanitize_relative_step( $adjustment['density'], $path . '.typographyAdjustment.density' );
			if ( is_wp_error( $density ) ) {
				return $density;
			}
			$binding['typographyAdjustment'] = array( 'size' => $size, 'density' => $density );
		} else {
			$adjustment = isset( $value['spacingAdjustment'] ) ? self::object_to_array( $value['spacingAdjustment'] ) : null;
			if ( ! is_array( $adjustment ) || ! isset( $adjustment['distance'] ) ) {
				return self::error( $path . '.spacingAdjustment', 'must contain distance' );
			}
			$distance = self::sanitize_relative_step( $adjustment['distance'], $path . '.spacingAdjustment.distance' );
			if ( is_wp_error( $distance ) ) {
				return $distance;
			}
			$binding['spacingAdjustment'] = array( 'distance' => $distance );
		}
		if ( ! is_array( $value['overrides'] ) || count( $value['overrides'] ) > 50 ) {
			return self::error( $path . '.overrides', 'must be an array with no more than 50 overrides' );
		}
		foreach ( $value['overrides'] as $index => $override_value ) {
			$override_path = $path . '.overrides[' . $index . ']';
			$override_value = self::object_to_array( $override_value );
			if ( ! is_array( $override_value ) || ! isset( $override_value['property'], $override_value['value'] ) ) {
				return self::error( $override_path, 'must contain property and value' );
			}
			if ( ! is_string( $override_value['property'] ) || ! preg_match( '/^-?[a-z][a-z0-9-]*$/i', $override_value['property'] ) ) {
				return self::error( $override_path . '.property', 'must be a valid CSS property' );
			}
			if ( ! is_string( $override_value['value'] ) || ! self::css_property_value_is_safe( $override_value['property'], $override_value['value'] ) ) {
				return self::error( $override_path . '.value', 'contains unsafe CSS syntax' );
			}
			$override = array( 'property' => $override_value['property'], 'value' => $override_value['value'] );
			if ( isset( $override_value['breakpoint'] ) ) {
				if ( ! in_array( $override_value['breakpoint'], array( 'desktop', 'tablet', 'mobile' ), true ) ) {
					return self::error( $override_path . '.breakpoint', 'must be a supported breakpoint' );
				}
				$override['breakpoint'] = $override_value['breakpoint'];
			}
			if ( isset( $override_value['state'] ) ) {
				if ( ! in_array( $override_value['state'], array( 'hover', 'focus', 'active' ), true ) ) {
					return self::error( $override_path . '.state', 'must be a supported state' );
				}
				$override['state'] = $override_value['state'];
			}
			$binding['overrides'][] = $override;
		}
		return $binding;
	}

	private static function sanitize_import_review_flags( $value, $path ) {
		if ( ! is_array( $value ) || count( $value ) > 50 ) {
			return self::error( $path, 'must be an array with no more than 50 flags' );
		}
		$result = array();
		foreach ( $value as $index => $flag_value ) {
			$flag_value = self::object_to_array( $flag_value );
			if ( ! is_array( $flag_value ) || ! isset( $flag_value['id'], $flag_value['property'], $flag_value['roleId'], $flag_value['message'] ) ) {
				return self::error( $path . '[' . $index . ']', 'is missing required review fields' );
			}
			foreach ( array( 'id', 'property', 'roleId', 'message' ) as $key ) {
				if ( ! is_string( $flag_value[ $key ] ) || strlen( $flag_value[ $key ] ) > 500 ) {
					return self::error( $path . '[' . $index . '].' . $key, 'must be a string of 500 bytes or fewer' );
				}
			}
			$result[] = array(
				'id'       => $flag_value['id'],
				'property' => $flag_value['property'],
				'roleId'   => $flag_value['roleId'],
				'message'  => $flag_value['message'],
			);
		}
		return $result;
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
		if ( array_key_exists( 'role_bindings', $value ) ) {
			$bindings = self::object_to_array( $value['role_bindings'] );
			if ( ! is_array( $bindings ) ) {
				return self::error( $path . '.role_bindings', 'must be an object' );
			}
			$sanitized_bindings = new stdClass();
			foreach ( $bindings as $scope => $binding_value ) {
				if ( ! is_string( $scope ) || ( 'typography' !== $scope && ! preg_match( '/^-?[a-z][a-z0-9-]*$/i', $scope ) ) ) {
					return self::error( $path . '.role_bindings', 'contains an invalid scope' );
				}
				$binding = self::sanitize_role_binding( $binding_value, $scope, $path . '.role_bindings.' . $scope );
				if ( is_wp_error( $binding ) ) {
					return $binding;
				}
				$sanitized_bindings->{$scope} = $binding;
			}
			if ( ! empty( get_object_vars( $sanitized_bindings ) ) ) {
				$style_set['role_bindings'] = $sanitized_bindings;
			}
		}
		if ( array_key_exists( 'import_review_flags', $value ) ) {
			$flags = self::sanitize_import_review_flags( $value['import_review_flags'], $path . '.import_review_flags' );
			if ( is_wp_error( $flags ) ) {
				return $flags;
			}
			if ( ! empty( $flags ) ) {
				$style_set['import_review_flags'] = $flags;
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
	 * Returns v3 style sets in the legacy validation shape.
	 *
	 * @param array $block Sanitized block.
	 * @return array
	 */
	private static function v3_style_sets( $block ) {
		$result  = array();
		$targets = isset( $block['style']['targets'] ) ? self::object_to_array( $block['style']['targets'] ) : array();
		foreach ( $targets as $target_id => $target ) {
			$contexts = isset( $target['contexts'] ) ? self::object_to_array( $target['contexts'] ) : array();
			foreach ( $contexts as $context_key => $style_set ) {
				$style_set = self::object_to_array( $style_set );
				$legacy = array(
					'mapped'              => isset( $style_set['declarations'] ) ? $style_set['declarations'] : new stdClass(),
					'custom_css_fallback' => isset( $style_set['custom_declarations'] ) ? $style_set['custom_declarations'] : '',
				);
				foreach ( array( 'token_bindings', 'role_bindings' ) as $field ) {
					if ( isset( $style_set[ $field ] ) ) {
						$legacy[ $field ] = $style_set[ $field ];
					}
				}
				$result[ 'targets.' . $target_id . '.contexts.' . $context_key ] = $legacy;
			}
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
		if ( isset( $block['styles'] ) ) {
			$result = self::validate_style_token_bindings( $block['styles'], $path . '.styles', $design_tokens );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}
		foreach ( self::v3_style_sets( $block ) as $style_path => $style_set ) {
			$result = self::validate_style_token_bindings( $style_set, $path . '.style.' . $style_path, $design_tokens );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
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

	private static function validate_role_recipe_tokens( $recipe, $path, $design_tokens ) {
		$tokens = self::object_to_array( $design_tokens );
		$maps = array( $recipe['propertyTokenRefs'] );
		foreach ( array( 'variants', 'densityVariants' ) as $branch ) {
			if ( ! isset( $recipe[ $branch ] ) ) {
				continue;
			}
			foreach ( self::object_to_array( $recipe[ $branch ] ) as $variant ) {
				$maps[] = $variant;
			}
		}
		foreach ( $maps as $map ) {
			foreach ( self::object_to_array( $map ) as $property => $reference ) {
				$parts = self::token_reference_parts( $reference );
				if ( null === $parts ) {
					return self::error( $path, 'contains an invalid token reference' );
				}
				$category_tokens = isset( $tokens[ $parts[0] ] ) ? self::object_to_array( $tokens[ $parts[0] ] ) : array();
				if ( ! isset( $category_tokens[ $parts[1] ] ) ) {
					return self::error( $path, 'must reference a token in the same document' );
				}
				if ( 'value' !== $property && ! in_array( $property, self::TOKEN_PROPERTIES[ $parts[0] ], true ) ) {
					return self::error( $path, 'uses a token category incompatible with its role property' );
				}
			}
		}
		return true;
	}

	private static function validate_style_role_bindings( $style_set, $path, $style_roles ) {
		$bindings = isset( $style_set['role_bindings'] ) ? self::object_to_array( $style_set['role_bindings'] ) : array();
		$roles = self::object_to_array( $style_roles );
		foreach ( $bindings as $scope => $binding ) {
			$binding = self::object_to_array( $binding );
			$role_id = isset( $binding['roleId'] ) ? $binding['roleId'] : '';
			if ( ! isset( $roles[ $role_id ] ) ) {
				return self::error( $path . '.role_bindings.' . $scope . '.roleId', 'must reference a role in the same document' );
			}
			$recipe = self::object_to_array( $roles[ $role_id ] );
			if ( ! isset( $recipe['kind'] ) || $recipe['kind'] !== $binding['kind'] ) {
				return self::error( $path . '.role_bindings.' . $scope . '.kind', 'must match the referenced role kind' );
			}
		}
		return true;
	}

	private static function validate_role_bindings( $block, $path, $style_roles, $design_tokens ) {
		$roles = self::object_to_array( $style_roles );
		foreach ( $roles as $role_id => $recipe ) {
			$result = self::validate_role_recipe_tokens(
				self::object_to_array( $recipe ),
				'$.style_roles.' . $role_id,
				$design_tokens
			);
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}
		if ( isset( $block['styles'] ) ) {
			$result = self::validate_style_role_bindings( $block['styles'], $path . '.styles', $style_roles );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}
		foreach ( self::v3_style_sets( $block ) as $style_path => $style_set ) {
			$result = self::validate_style_role_bindings( $style_set, $path . '.style.' . $style_path, $style_roles );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}
		foreach ( array( 'responsive_overrides', 'states' ) as $branch ) {
			$style_sets = isset( $block[ $branch ] ) ? self::object_to_array( $block[ $branch ] ) : array();
			foreach ( $style_sets as $name => $style_set ) {
				$result = self::validate_style_role_bindings( $style_set, $path . '.' . $branch . '.' . $name, $style_roles );
				if ( is_wp_error( $result ) ) {
					return $result;
				}
			}
		}
		foreach ( $block['children'] as $index => $child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				$result = self::validate_role_bindings( $child, $path . '.children[' . $index . ']', $style_roles, $design_tokens );
				if ( is_wp_error( $result ) ) {
					return $result;
				}
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
