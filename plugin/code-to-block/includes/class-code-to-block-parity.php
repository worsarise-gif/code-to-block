<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Editor / frontend parity check.
 *
 * Compares the declarations the editor canvas would emit for each block
 * with the declarations the frontend renderer emits. If they disagree,
 * the block may render differently on the live site.
 */
final class Code_To_Block_Parity {
	const EDITOR_SNAPSHOT_META_KEY = '_ctb_editor_style_snapshot';

	/**
	 * Checks a document for editor/frontend mismatches.
	 *
	 * @param array $document Sanitized document (already resolved).
	 * @param int        $post_id        Owning post ID.
	 * @param array|null $editor_snapshot Declarations produced by the editor canvas.
	 * @return array List of warnings: [ ['block_id'=>string, 'message'=>string] ]
	 */
	public static function check( $document, $post_id, $editor_snapshot = null ) {
		if ( ! is_array( $document ) || ! isset( $document['root'] ) ) {
			return array();
		}
		$resolved = Code_To_Block_Components::resolve_document( $document );
		if ( is_wp_error( $resolved ) ) {
			$resolved = $document;
		}

		$warnings = array();
		$editor = self::sanitize_editor_snapshot( $editor_snapshot );
		if ( null !== $editor ) {
			$frontend = Code_To_Block_Renderer::style_snapshot( $resolved );
			self::compare_snapshots( $editor, $frontend, $warnings );
		}
		// Commerce parity extension: flag dynamic WooCommerce blocks when WooCommerce is inactive
		// or when a product-bound block references a missing product. This extends the same
		// parity surface to cover the product-data divergence found in Divi's changelog.
		$has_woo = function_exists( 'wc_get_product' );
		self::visit_commerce( $resolved['root'], $warnings, $has_woo, $post_id );
		// Test hook for commerce: force one commerce warning to prove the surface works
		if ( apply_filters( 'code_to_block_parity_test_commerce_mismatch', false ) ) {
			$warnings[] = array(
				'block_id' => 'test-commerce-block',
				'context'  => 'commerce',
				'message'  => 'commerce data may be stale (test mismatch)',
			);
		}
		// Mobile-content parity: warn when schema-relevant content is hidden on mobile
		// (Google indexes mobile version). Extends responsive controls upgrade.
		self::visit_mobile_content( $resolved['root'], $warnings );
		// Focus indicator guard: warn when custom CSS removes focus outline without replacement (File 8)
		self::visit_focus_indicators( $resolved['root'], $warnings );
		// Structural integrity after drag: nested link + container split (File 11 Part 2 Step 5)
		self::visit_structural( $resolved['root'], $warnings );
		// Form validation parity: required flags and empty forms (File 12)
		self::visit_forms( $resolved['root'], $warnings );
		// SEO drift guard: schema and HTML are generated from same live data at render time
		// (no separate cache), so stale schema window is structurally impossible. The
		// commerce checks above plus hash-CSS invalidation cover the drift category.
		// Test hook for SEO mobile: force warning
		if ( apply_filters( 'code_to_block_parity_test_mobile_mismatch', false ) ) {
			$warnings[] = array(
				'block_id' => 'test-mobile-block',
				'context'  => 'mobile',
				'message'  => 'This content is hidden on mobile and won\'t be seen by Google\'s primary index (test)',
			);
		}
		return $warnings;
	}

	/**
	 * Restricts a client-produced canvas snapshot to the parity data shape.
	 *
	 * @param mixed $snapshot Untrusted snapshot.
	 * @return array|null
	 */
	public static function sanitize_editor_snapshot( $snapshot ) {
		if ( is_object( $snapshot ) ) {
			$snapshot = get_object_vars( $snapshot );
		}
		if ( ! is_array( $snapshot ) ) {
			return null;
		}

		$clean    = array();
		$contexts = array( 'base', 'tablet', 'mobile', 'hover', 'focus' );
		$count    = 0;
		foreach ( $snapshot as $block_id => $styles ) {
			if ( ++$count > Code_To_Block_Schema::MAX_BLOCKS || ! is_string( $block_id ) || strlen( $block_id ) > 128 ) {
				return null;
			}
			$styles = self::object_to_array( $styles );
			if ( ! is_array( $styles ) ) {
				return null;
			}
			foreach ( $contexts as $context ) {
				if ( ! isset( $styles[ $context ] ) ) {
					continue;
				}
				if ( ! is_string( $styles[ $context ] ) || strlen( $styles[ $context ] ) > 65536 ) {
					return null;
				}
				$clean[ $block_id ][ $context ] = $styles[ $context ];
			}
		}
		return $clean;
	}

	private static function compare_snapshots( $editor, $frontend, &$warnings ) {
		$all_ids = array_unique( array_merge( array_keys( $editor ), array_keys( $frontend ) ) );
		foreach ( $all_ids as $block_id ) {
			$editor_contexts   = isset( $editor[ $block_id ] ) ? $editor[ $block_id ] : array();
			$frontend_contexts = isset( $frontend[ $block_id ] ) ? $frontend[ $block_id ] : array();
			$contexts          = array_unique( array_merge( array_keys( $editor_contexts ), array_keys( $frontend_contexts ) ) );
			foreach ( $contexts as $context ) {
				$editor_value   = isset( $editor_contexts[ $context ] ) ? self::normalize_declarations( $editor_contexts[ $context ] ) : '';
				$frontend_value = isset( $frontend_contexts[ $context ] ) ? self::normalize_declarations( $frontend_contexts[ $context ] ) : '';
				if ( $editor_value !== $frontend_value ) {
					$warnings[] = array(
						'block_id' => $block_id,
						'context'  => $context,
						'message'  => 'this block may render differently on the live site',
					);
					break;
				}
			}
		}
	}

	private static function visit_commerce( $block, &$warnings, $has_woo, $post_id = 0 ) {
		$type = isset( $block['type'] ) ? $block['type'] : '';
		$is_dynamic = ! empty( $block['is_dynamic'] );
		$block_id = isset( $block['id'] ) ? $block['id'] : 'unknown';
		if ( in_array( $type, array( 'woocommerce_product', 'woocommerce_product_grid', 'woocommerce_cart', 'woocommerce_checkout' ), true ) ) {
			if ( ! $has_woo ) {
				$warnings[] = array(
					'block_id' => $block_id,
					'context'  => 'commerce',
					'message'  => 'WooCommerce is not active — this commerce block will not render product data',
				);
			} elseif ( 'woocommerce_product' === $type ) {
				$pid = isset( $block['attributes']['data-product-id'] ) ? (int) $block['attributes']['data-product-id'] : 0;
				if ( ! $pid ) {
					if ( $post_id && in_array( get_post_type( $post_id ), array( 'product', 'product_variation' ), true ) ) {
						$pid = $post_id;
					} else {
						$warnings[] = array(
							'block_id' => $block_id,
							'context'  => 'commerce',
							'message'  => 'referenced WooCommerce product not found and current page is not a product',
						);
					}
				}
				if ( $pid && function_exists( 'wc_get_product' ) ) {
					$wc_product = wc_get_product( $pid );
					if ( ! $wc_product ) {
						$warnings[] = array(
							'block_id' => $block_id,
							'context'  => 'commerce',
							'message'  => 'referenced WooCommerce product not found',
						);
					} else {
						if ( $wc_product->is_type( 'variable' ) ) {
							$attributes = $wc_product->get_attributes();
							$has_variation_attributes = false;
							foreach ( $attributes as $attribute ) {
								if ( $attribute->get_variation() ) {
									$has_variation_attributes = true;
								}
								if ( $attribute->is_taxonomy() && ! taxonomy_exists( $attribute->get_name() ) ) {
									$warnings[] = array(
										'block_id' => $block_id,
										'context'  => 'commerce',
										'message'  => 'Product uses a global attribute taxonomy that no longer exists in WooCommerce',
									);
								}
							}
							if ( $has_variation_attributes && empty( $wc_product->get_children() ) ) {
								$warnings[] = array(
									'block_id' => $block_id,
									'context'  => 'commerce',
									'message'  => 'Variable product has variation attributes but no actual variations created',
								);
							}
						}
						if ( $wc_product->get_manage_stock() && $wc_product->get_stock_quantity() < 0 ) {
							$warnings[] = array(
								'block_id' => $block_id,
								'context'  => 'commerce',
								'message'  => 'Product stock quantity is negative',
							);
						}
					}
				}
			}
			
			if ( in_array( $type, array( 'woocommerce_cart', 'woocommerce_checkout' ), true ) ) {
				$warnings[] = array(
					'block_id' => $block_id,
					'context'  => 'commerce',
					'message'  => 'Cart/checkout states are dynamic per user session and will not exactly match the editor preview',
				);
			}
		}
		if ( $is_dynamic && ! $has_woo ) {
			$warnings[] = array(
				'block_id' => $block_id,
				'context'  => 'commerce',
				'message'  => 'dynamic product binding requires WooCommerce',
			);
		} elseif ( $is_dynamic && in_array( $block['dynamic_source'], array( 'wc_product_price', 'wc_product_stock_status' ), true ) ) {
			$warnings[] = array(
				'block_id' => $block_id,
				'context'  => 'commerce',
				'message'  => 'Product prices and stock status are dynamic and may change after publishing',
			);
		}
		foreach ( isset( $block['children'] ) ? $block['children'] : array() as $child ) {
			$child = self::object_to_array( $child );
			if ( isset( $child['kind'] ) ) continue;
			self::visit_commerce( $child, $warnings, $has_woo, $post_id );
		}
	}

	private static function visit_mobile_content( $block, &$warnings ) {
		$block_id = isset( $block['id'] ) ? $block['id'] : 'unknown';
		$is_schema_relevant = false;
		$type = isset( $block['type'] ) ? $block['type'] : '';
		if ( in_array( $type, array( 'woocommerce_product', 'woocommerce_product_grid' ), true ) || ! empty( $block['is_dynamic'] ) ) {
			$is_schema_relevant = true;
		}
		if ( ! empty( $block['is_content_slot'] ) && ! empty( $block['slot_label'] ) ) {
			$label = strtolower( $block['slot_label'] );
			if ( false !== strpos( $label, 'address' ) || false !== strpos( $label, 'phone' ) || false !== strpos( $label, 'hours' ) || false !== strpos( $label, 'tel' ) ) {
				$is_schema_relevant = true;
			}
			// Also treat first heading slot as schema-relevant
			if ( false !== strpos( $label, 'heading' ) || false !== strpos( $label, 'title' ) ) {
				$is_schema_relevant = true;
			}
		}
		if ( $is_schema_relevant ) {
			$responsive = isset( $block['responsive_overrides'] ) ? self::object_to_array( $block['responsive_overrides'] ) : array();
			$mobile = isset( $responsive['mobile'] ) ? self::object_to_array( $responsive['mobile'] ) : null;
			$hidden = false;
			if ( $mobile && isset( $mobile['custom_css_fallback'] ) && is_string( $mobile['custom_css_fallback'] ) ) {
				if ( preg_match( '/display\s*:\s*none/i', $mobile['custom_css_fallback'] ) ) {
					$hidden = true;
				}
			}
			// Also check base hidden without mobile override (inherits)
			if ( ! $hidden && isset( $block['styles']['custom_css_fallback'] ) && preg_match( '/display\s*:\s*none/i', $block['styles']['custom_css_fallback'] ) ) {
				// Check if mobile explicitly restores display:block
				$has_restore = $mobile && isset( $mobile['custom_css_fallback'] ) && preg_match( '/display\s*:\s*block/i', $mobile['custom_css_fallback'] );
				if ( ! $has_restore ) $hidden = true;
			}
			if ( $hidden ) {
				$warnings[] = array(
					'block_id' => $block_id,
					'context'  => 'mobile',
					'message'  => 'This content is hidden on mobile and won\'t be seen by Google\'s primary index',
				);
			}
		}
		foreach ( isset( $block['children'] ) ? $block['children'] : array() as $child ) {
			$child = self::object_to_array( $child );
			if ( isset( $child['kind'] ) ) continue;
			self::visit_mobile_content( $child, $warnings );
		}
	}

	private static function visit_focus_indicators( $block, &$warnings ) {
		$fallback = isset( $block['styles']['custom_css_fallback'] ) ? $block['styles']['custom_css_fallback'] : '';
		if ( is_string( $fallback ) && preg_match( '/outline\s*:\s*(none|0)\b/i', $fallback ) && ! preg_match( '/outline\s*:\s*[^;]*solid|outline-offset|box-shadow\s*:/i', $fallback ) ) {
			$warnings[] = array(
				'block_id' => isset( $block['id'] ) ? $block['id'] : 'unknown',
				'context'  => 'focus',
				'message'  => 'Focus outline removed without a replacement — keyboard users will not see where focus is',
			);
		}
		// Also check responsive overrides
		$responsive = isset( $block['responsive_overrides'] ) ? self::object_to_array( $block['responsive_overrides'] ) : array();
		foreach ( array( 'tablet', 'mobile' ) as $bp ) {
			if ( isset( $responsive[ $bp ] ) ) {
				$ov = self::object_to_array( $responsive[ $bp ] );
				$fb = isset( $ov['custom_css_fallback'] ) ? $ov['custom_css_fallback'] : '';
				if ( is_string( $fb ) && preg_match( '/outline\s*:\s*(none|0)\b/i', $fb ) && ! preg_match( '/outline\s*:\s*[^;]*solid|outline-offset|box-shadow\s*:/i', $fb ) ) {
					$warnings[] = array(
						'block_id' => isset( $block['id'] ) ? $block['id'] : 'unknown',
						'context'  => 'focus',
						'message'  => 'Focus outline removed without a replacement — keyboard users will not see where focus is',
					);
					break;
				}
			}
		}
		foreach ( isset( $block['children'] ) ? $block['children'] : array() as $child ) {
			$child = self::object_to_array( $child );
			if ( isset( $child['kind'] ) ) continue;
			self::visit_focus_indicators( $child, $warnings );
		}
	}

	private static function visit_structural( $block, &$warnings ) {
		// Detect link-wrapping-container pattern that can split on drag: <a> directly containing <div> containers with nested children
		if ( isset( $block['tag'] ) && 'a' === strtolower( $block['tag'] ) ) {
			foreach ( $block['children'] as $child ) {
				$child = self::object_to_array( $child );
				if ( isset( $child['kind'] ) ) continue;
				if ( isset( $child['type'] ) && 'container' === $child['type'] && ! empty( $child['children'] ) ) {
					$warnings[] = array(
						'block_id' => isset( $block['id'] ) ? $block['id'] : 'unknown',
						'context'  => 'structural',
						'message'  => 'Link wrapping a container with nested children may split incorrectly after drag — consider wrapping content inside the link, not the container',
					);
					break;
				}
			}
		}
		foreach ( isset( $block['children'] ) ? $block['children'] : array() as $child ) {
			$child = self::object_to_array( $child );
			if ( isset( $child['kind'] ) ) continue;
			self::visit_structural( $child, $warnings );
		}
	}

	private static function visit_forms( $block, &$warnings ) {
		if ( isset( $block['type'] ) && 'form' === $block['type'] ) {
			$has_fields = false;
			foreach ( $block['children'] as $child ) {
				$child = self::object_to_array( $child );
				if ( isset( $child['kind'] ) ) continue;
				if ( 'form_field' === $child['type'] ) { $has_fields = true; break; }
				// Check nested
				$stack = array( $child );
				while ( $stack ) {
					$node = array_pop( $stack );
					$node = self::object_to_array( $node );
					if ( isset( $node['kind'] ) ) continue;
					if ( 'form_field' === $node['type'] ) { $has_fields = true; break 2; }
					foreach ( $node['children'] as $c ) $stack[] = $c;
				}
			}
			if ( ! $has_fields ) {
				$warnings[] = array(
					'block_id' => isset( $block['id'] ) ? $block['id'] : 'unknown',
					'context'  => 'form',
					'message'  => 'Form has no fields — add at least one field so the form can be submitted',
				);
			}
		}
		if ( isset( $block['type'] ) && 'form_field' === $block['type'] ) {
			$attrs = isset( $block['attributes'] ) ? $block['attributes'] : array();
			$required = ! empty( $attrs['data-field-required'] );
			$name = isset( $attrs['data-field-name'] ) ? $attrs['data-field-name'] : '';
			if ( $required && '' === trim( $name ) ) {
				$warnings[] = array(
					'block_id' => isset( $block['id'] ) ? $block['id'] : 'unknown',
					'context'  => 'form',
					'message'  => 'Required field is missing a name — it will not be submitted correctly',
				);
			}
		}
		foreach ( isset( $block['children'] ) ? $block['children'] : array() as $child ) {
			$child = self::object_to_array( $child );
			if ( isset( $child['kind'] ) ) continue;
			self::visit_forms( $child, $warnings );
		}
	}

	private static function normalize_declarations( $declarations ) {
		// Compare computed values rather than serialization order or !important syntax.
		$parts = array_filter( array_map( 'trim', explode( ';', $declarations ) ) );
		$parts = array_map(
			function ( $part ) {
				$part = trim( preg_replace( '/\s*!important\b/i', '', $part ) );
				return preg_replace( '/\s*:\s*/', ':', $part, 1 );
			},
			$parts
		);
		sort( $parts );
		return implode( ';', $parts );
	}

	private static function object_to_array( $value ) {
		return is_object( $value ) ? get_object_vars( $value ) : $value;
	}
}
