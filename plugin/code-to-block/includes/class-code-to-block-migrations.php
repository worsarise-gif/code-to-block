<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Pure, report-producing migrations from legacy documents to schema v3.
 */
final class Code_To_Block_Migrations {
	/**
	 * @param array $source Sanitized source document.
	 * @return array|WP_Error
	 */
	public static function to_v3( $source ) {
		if ( ! is_array( $source ) || ! isset( $source['schema_version'], $source['root'], $source['name'] ) ) {
			return new WP_Error( 'code_to_block_migration_source_invalid', __( 'The migration source is not a valid block document.', 'code-to-block' ), array( 'status' => 400 ) );
		}
		if ( Code_To_Block_Schema::VERSION === $source['schema_version'] ) {
			return array( 'document' => $source, 'report' => array(), 'already_current' => true );
		}
		if ( ! in_array( $source['schema_version'], array( Code_To_Block_Schema::LEGACY_VERSION, Code_To_Block_Schema::COMPAT_VERSION ), true ) ) {
			return new WP_Error( 'code_to_block_migration_version_unsupported', __( 'Only schema versions 1 and 2 can be migrated.', 'code-to-block' ), array( 'status' => 400 ) );
		}
		$report = array();
		$document = array(
			'schema_version'   => Code_To_Block_Schema::VERSION,
			'registry_version' => Code_To_Block_Registry::VERSION,
			'name'             => $source['name'],
			'breakpoints'      => array(
				'desktop' => array( 'id' => 'desktop', 'label' => 'Desktop', 'maxWidth' => null, 'inherits' => null ),
				'tablet'  => array( 'id' => 'tablet', 'label' => 'Tablet', 'maxWidth' => 768, 'inherits' => 'desktop' ),
				'mobile'  => array( 'id' => 'mobile', 'label' => 'Mobile', 'maxWidth' => 390, 'inherits' => 'tablet' ),
			),
			'root'             => self::migrate_block( $source['root'], '$.root', $report ),
			'migration_log'    => array(
				array(
					'from'         => $source['schema_version'],
					'to'           => Code_To_Block_Schema::VERSION,
					'source_hash'  => hash( 'sha256', wp_json_encode( $source, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) ),
					'warning_count' => 0,
				),
			),
		);
		foreach ( array( 'design_tokens', 'style_roles', 'feature_flags', 'slot_values', 'imported_assets', 'seo' ) as $field ) {
			if ( array_key_exists( $field, $source ) ) {
				$document[ $field ] = $source[ $field ];
			}
		}
		$warning_count = count(
			array_filter(
				$report,
				function ( $entry ) {
					return ! empty( $entry['warning'] );
				}
			)
		);
		$document['migration_log'][0]['warning_count'] = $warning_count;
		$sanitized = Code_To_Block_Schema::sanitize_document( json_decode( wp_json_encode( $document ) ) );
		if ( is_wp_error( $sanitized ) ) {
			return $sanitized;
		}
		return array( 'document' => $sanitized, 'report' => $report, 'already_current' => false );
	}

	/**
	 * @param array  $block Source block.
	 * @param string $path Source path.
	 * @param array  $report Migration report.
	 * @return array
	 */
	private static function migrate_block( $block, $path, &$report ) {
		$block = self::object_to_array( $block );
		$inference  = self::infer_element( $block );
		$definition = Code_To_Block_Registry::get( $inference['element'] );
		$contexts   = array();
		$legacy     = array();
		if ( isset( $block['styles'] ) && self::style_set_has_values( $block['styles'] ) ) {
			$contexts['base'] = self::migrate_style_set( $block['styles'], $path . '.styles', $path . '.style.targets.root.contexts.base', $report );
		}
		$responsive = isset( $block['responsive_overrides'] ) ? self::object_to_array( $block['responsive_overrides'] ) : array();
		foreach ( array( 'tablet', 'mobile' ) as $breakpoint ) {
			if ( isset( $responsive[ $breakpoint ] ) && self::style_set_has_values( $responsive[ $breakpoint ] ) ) {
				$context_key = 'bp:' . $breakpoint;
				$contexts[ $context_key ] = self::migrate_style_set( $responsive[ $breakpoint ], $path . '.responsive_overrides.' . $breakpoint, $path . '.style.targets.root.contexts.' . $context_key, $report );
			}
		}
		$states = isset( $block['states'] ) ? self::object_to_array( $block['states'] ) : array();
		foreach ( array( 'hover', 'focus', 'active' ) as $state ) {
			if ( ! isset( $states[ $state ] ) || ! self::style_set_has_values( $states[ $state ] ) ) {
				continue;
			}
			if ( Code_To_Block_Registry::state_is_allowed( $inference['element'], $state ) ) {
				$context_key = 'state:' . $state;
				$contexts[ $context_key ] = self::migrate_style_set( $states[ $state ], $path . '.states.' . $state, $path . '.style.targets.root.contexts.' . $context_key, $report );
			} else {
				$legacy['states'][ $state ] = $states[ $state ];
				$report[] = array(
					'source'     => $path . '.states.' . $state,
					'target'     => $path . '.style.legacy.states.' . $state,
					'action'     => 'preserved',
					'confidence' => 1,
					'warning'    => 'The inferred element does not grant this state, so the legacy value remains isolated.',
				);
			}
		}
		if ( ! empty( $block['meta']['imported_css_rules'] ) ) {
			$legacy['imported_css_rules'] = $block['meta']['imported_css_rules'];
		}
		$report[] = array(
			'source'     => $path,
			'target'     => $path . '.element',
			'action'     => 'inferred',
			'confidence' => $inference['confidence'],
			'reason'     => $inference['reason'],
			'warning'    => $inference['confidence'] < 0.75 ? 'Ambiguous structure remains a Legacy Element.' : '',
		);
		$children = array();
		foreach ( isset( $block['children'] ) ? $block['children'] : array() as $index => $child ) {
			$child = self::object_to_array( $child );
			$children[] = isset( $child['kind'] ) ? $child : self::migrate_block( $child, $path . '.children[' . $index . ']', $report );
		}
		$props = array();
		foreach ( isset( $block['props'] ) ? self::object_to_array( $block['props'] ) : array() as $prop => $value ) {
			if ( Code_To_Block_Registry::prop_is_allowed( $inference['element'], $prop ) ) {
				$props[ $prop ] = $value;
			}
		}
		if ( ! empty( $block['is_dynamic'] ) && Code_To_Block_Registry::prop_is_allowed( $inference['element'], 'dynamic' ) ) {
			$props['dynamic']       = true;
			$props['dynamicSource'] = isset( $block['dynamic_source'] ) ? $block['dynamic_source'] : '';
		}
		$advanced = array();
		if ( ! empty( $block['visibility_conditions'] ) ) {
			$advanced['conditions'] = $block['visibility_conditions'];
		}
		if ( ! empty( $block['permissions'] ) ) {
			$advanced['permissions'] = $block['permissions'];
		}
		if ( ! empty( $block['performance'] ) ) {
			$advanced['performance'] = $block['performance'];
		}
		if ( ! empty( $block['actions'] ) ) {
			$advanced['actions'] = $block['actions'];
		}
		$style = array( 'targets' => empty( $contexts ) ? array() : array( 'root' => array( 'contexts' => $contexts ) ) );
		if ( ! empty( $legacy ) ) {
			$style['legacy'] = $legacy;
		}
		return array(
			'id'                 => $block['id'],
			'element'            => $inference['element'],
			'definition_version' => $definition['version'],
			'type'               => $definition['rendererFamily'],
			'tag'                => $block['tag'],
			'props'              => $props,
			'attributes'         => isset( $block['attributes'] ) ? $block['attributes'] : array(),
			'children'           => $children,
			'style'              => $style,
			'advanced'           => $advanced,
			'meta'               => isset( $block['meta'] ) ? $block['meta'] : array( 'source' => 'legacy-migration' ),
		);
	}

	/**
	 * @param array $block Legacy block.
	 * @return array
	 */
	private static function infer_element( $block ) {
		if ( ! empty( $block['element'] ) && Code_To_Block_Registry::exists( $block['element'] ) ) {
			return array( 'element' => $block['element'], 'confidence' => 1, 'reason' => 'explicit element ID' );
		}
		$type = isset( $block['type'] ) ? $block['type'] : '';
		$tag  = isset( $block['tag'] ) ? strtolower( $block['tag'] ) : '';
		$specialized = array(
			'woocommerce_product'      => 'woocommerce/product',
			'woocommerce_product_grid' => 'woocommerce/product-grid',
			'woocommerce_cart'         => 'woocommerce/cart',
			'woocommerce_checkout'     => 'woocommerce/checkout',
			'form'                     => 'forms/form',
		);
		if ( isset( $specialized[ $type ] ) ) {
			return array( 'element' => $specialized[ $type ], 'confidence' => 1, 'reason' => 'specialized type ' . $type );
		}
		if ( 'form_field' === $type ) {
			$input_type = isset( $block['attributes']['type'] ) ? $block['attributes']['type'] : '';
			$element = 'textarea' === $tag ? 'forms/textarea' : ( 'select' === $tag ? 'forms/select' : ( 'checkbox' === $input_type ? 'forms/checkbox' : ( 'radio' === $input_type ? 'forms/radio' : ( 'file' === $input_type ? 'forms/file-upload' : 'forms/input' ) ) ) );
			return array( 'element' => $element, 'confidence' => 0.95, 'reason' => 'form field tag ' . $tag );
		}
		$element = '';
		if ( preg_match( '/^h[1-6]$/', $tag ) ) $element = 'core/heading';
		elseif ( 'img' === $tag ) $element = 'core/image';
		elseif ( 'hr' === $tag ) $element = 'core/divider';
		elseif ( 'iframe' === $tag ) $element = 'core/embed';
		elseif ( 'video' === $tag ) $element = 'core/video';
		elseif ( 'audio' === $tag ) $element = 'core/audio';
		elseif ( 'nav' === $tag ) $element = 'core/navigation';
		elseif ( 'textarea' === $tag ) $element = 'forms/textarea';
		elseif ( 'select' === $tag ) $element = 'forms/select';
		elseif ( 'input' === $tag ) $element = 'forms/input';
		elseif ( 'a' === $tag && 'button' === $type ) $element = 'core/button';
		elseif ( 'a' === $tag ) $element = 'core/link';
		elseif ( 'button' === $tag ) $element = isset( $block['attributes']['type'] ) && 'submit' === $block['attributes']['type'] ? 'forms/submit-button' : 'core/button';
		elseif ( in_array( $tag, array( 'ul', 'ol', 'menu' ), true ) ) $element = 'core/list';
		elseif ( 'li' === $tag ) $element = 'core/list-item';
		elseif ( 'blockquote' === $tag ) $element = 'content/blockquote';
		elseif ( 'q' === $tag ) $element = 'content/quote';
		elseif ( in_array( $tag, array( 'pre', 'code' ), true ) ) $element = 'core/code';
		elseif ( 'figure' === $tag ) $element = 'core/figure';
		elseif ( 'details' === $tag ) $element = 'interactive/toggle';
		elseif ( 'progress' === $tag ) $element = 'content/progress';
		elseif ( in_array( $tag, array( 'p', 'span', 'small', 'address' ), true ) && 'text' === $type ) $element = 'core/text';
		elseif ( in_array( $tag, array( 'section', 'header', 'footer', 'main', 'aside', 'article' ), true ) ) $element = 'layout/section';
		elseif ( 'div' === $tag && 'container' === $type ) $element = 'layout/container';
		if ( '' !== $element && Code_To_Block_Registry::tag_is_allowed( $element, $tag ) ) {
			return array( 'element' => $element, 'confidence' => 0.85, 'reason' => 'legacy ' . $type . '/' . $tag . ' matcher' );
		}
		return array( 'element' => 'legacy/html-node', 'confidence' => 0.4, 'reason' => 'ambiguous ' . $type . '/' . $tag );
	}

	/**
	 * @param mixed $style_set Legacy style set.
	 * @return bool
	 */
	private static function style_set_has_values( $style_set ) {
		$style_set = self::object_to_array( $style_set );
		return ! empty( self::object_to_array( isset( $style_set['mapped'] ) ? $style_set['mapped'] : array() ) ) ||
			! empty( $style_set['custom_css_fallback'] ) ||
			! empty( self::object_to_array( isset( $style_set['token_bindings'] ) ? $style_set['token_bindings'] : array() ) ) ||
			! empty( self::object_to_array( isset( $style_set['role_bindings'] ) ? $style_set['role_bindings'] : array() ) );
	}

	/**
	 * @param mixed  $style_set Source style set.
	 * @param string $source_path Report source.
	 * @param string $target_path Report target.
	 * @param array  $report Report entries.
	 * @return array
	 */
	private static function migrate_style_set( $style_set, $source_path, $target_path, &$report ) {
		$style_set = self::object_to_array( $style_set );
		$result = array( 'declarations' => isset( $style_set['mapped'] ) ? $style_set['mapped'] : array() );
		if ( ! empty( $style_set['custom_css_fallback'] ) ) {
			$result['custom_declarations'] = $style_set['custom_css_fallback'];
		}
		foreach ( array( 'token_bindings', 'role_bindings' ) as $field ) {
			if ( ! empty( $style_set[ $field ] ) ) {
				$result[ $field ] = $style_set[ $field ];
			}
		}
		$report[] = array( 'source' => $source_path, 'target' => $target_path, 'action' => 'moved', 'confidence' => 1, 'warning' => '' );
		return $result;
	}

	/**
	 * @param mixed $value Value.
	 * @return array
	 */
	private static function object_to_array( $value ) {
		return is_object( $value ) ? get_object_vars( $value ) : ( is_array( $value ) ? $value : array() );
	}
}
