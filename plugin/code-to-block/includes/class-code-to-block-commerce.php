<?php
/**
 * WooCommerce data adapters used by editor previews and frontend rendering.
 *
 * @package Code_To_Block
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Code_To_Block_Commerce {
	const MAX_CUSTOM_FIELDS = 50;
	const MAX_ATTRIBUTES    = 20;
	const MAX_OPTIONS       = 100;
	const MAX_VARIATIONS    = 100;

	/**
	 * Returns normalized published products for editor selection and previews.
	 *
	 * @param int $limit Maximum number of products.
	 * @return array
	 */
	public static function products( $limit = 100 ) {
		if ( ! function_exists( 'wc_get_products' ) ) {
			return array();
		}
		$products = wc_get_products(
			array(
				'limit'   => max( 1, min( 100, (int) $limit ) ),
				'status'  => 'publish',
				'orderby' => 'title',
				'order'   => 'ASC',
			)
		);
		return array_values( array_map( array( __CLASS__, 'preview' ), $products ) );
	}

	/**
	 * Normalizes a WooCommerce product for the dedicated editor.
	 *
	 * Protected WooCommerce meta (keys beginning with an underscore) is never
	 * exposed as an editable custom field.
	 *
	 * @param WC_Product $product Product object.
	 * @return array
	 */
	public static function preview( $product ) {
		$image_id = (int) $product->get_image_id();
		$image    = array( 'url' => '', 'srcset' => '', 'alt' => '' );
		if ( $image_id ) {
			$image['url']    = (string) wp_get_attachment_image_url( $image_id, 'full' );
			$image['srcset'] = (string) wp_get_attachment_image_srcset( $image_id, 'full' );
			$image['alt']    = (string) get_post_meta( $image_id, '_wp_attachment_image_alt', true );
			if ( '' === $image['alt'] ) {
				$image['alt'] = wp_strip_all_tags( $product->get_name() );
			}
		}
		$price_html       = wp_kses_post( $product->get_price_html() );
		$description      = (string) $product->get_short_description();
		$description_html = wp_kses_post( $description );
		$stock_html       = function_exists( 'wc_get_stock_html' ) ? wp_kses_post( wc_get_stock_html( $product ) ) : '';
		if ( '' === trim( wp_strip_all_tags( $stock_html ) ) ) {
			$stock_html = $product->is_in_stock() ? 'In stock' : 'Out of stock';
		}

		$children = $product->is_type( 'variable' ) ? array_map( 'intval', $product->get_children() ) : array();

		return array(
			'id'                     => (int) $product->get_id(),
			'name'                   => (string) $product->get_name(),
			'type'                   => (string) $product->get_type(),
			'price'                  => self::product_value( $product, 'get_price' ),
			'regular_price'          => self::product_value( $product, 'get_regular_price' ),
			'sale_price'             => self::product_value( $product, 'get_sale_price' ),
			'price_html'             => $price_html,
			'price_text'             => html_entity_decode( wp_strip_all_tags( $price_html ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ),
			'short_description'      => $description,
			'short_description_html' => $description_html,
			'short_description_text' => html_entity_decode( wp_strip_all_tags( $description_html ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ),
			'stock_html'             => $stock_html,
			'stock_text'             => html_entity_decode( wp_strip_all_tags( $stock_html ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ),
			'image'                  => $image,
			'variation_count'        => count( $children ),
			'custom_fields'          => self::custom_fields( $product ),
			'attributes'             => self::attributes( $product ),
			'variations'             => self::variations( $children ),
			'variation_selector_html' => self::variation_selector( $product ),
		);
	}

	/**
	 * Renders WooCommerce's native variable add-to-cart form in the supplied
	 * product context. The previous global product is always restored.
	 *
	 * @param WC_Product $wc_product Product object.
	 * @return string
	 */
	public static function variation_selector( $wc_product ) {
		if ( ! $wc_product || ! $wc_product->is_type( 'variable' ) || ! function_exists( 'woocommerce_variable_add_to_cart' ) ) {
			return '';
		}
		global $product;
		$previous_product = $product;
		$product          = $wc_product;
		if ( function_exists( 'wp_enqueue_script' ) ) {
			wp_enqueue_script( 'wc-add-to-cart-variation' );
		}
		ob_start();
		try {
			woocommerce_variable_add_to_cart();
			$html = (string) ob_get_clean();
		} catch ( Throwable $error ) {
			ob_end_clean();
			$html = '';
		}
		$product = $previous_product;
		return $html;
	}

	/**
	 * Creates a simple or variable product using WooCommerce CRUD objects.
	 *
	 * @param array $payload Untrusted request payload.
	 * @return array|WP_Error Normalized product preview or validation error.
	 */
	public static function create_product( $payload ) {
		$payload = is_array( $payload ) ? $payload : array();
		$type    = isset( $payload['type'] ) ? sanitize_key( $payload['type'] ) : 'simple';
		if ( ! in_array( $type, array( 'simple', 'variable' ), true ) ) {
			return self::error( 'invalid_product_type', 'Product type must be simple or variable.' );
		}
		$name = isset( $payload['name'] ) ? sanitize_text_field( $payload['name'] ) : '';
		if ( '' === trim( $name ) ) {
			return self::error( 'invalid_product_name', 'Product name is required.' );
		}
		if ( 'variable' === $type && ! class_exists( 'WC_Product_Variable' ) ) {
			return self::error( 'woocommerce_not_available', 'Variable products are not available.', 501 );
		}
		if ( 'simple' === $type && ! class_exists( 'WC_Product_Simple' ) ) {
			return self::error( 'woocommerce_not_available', 'Simple products are not available.', 501 );
		}

		$product = 'variable' === $type ? new WC_Product_Variable() : new WC_Product_Simple();
		$product->set_name( $name );
		$product->set_status( current_user_can( 'publish_products' ) ? 'publish' : 'draft' );
		$result = self::apply_product_changes( $product, $payload );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return self::preview( $result );
	}

	/**
	 * Updates an existing product through a single validated mutation path.
	 *
	 * @param WC_Product $product Product object.
	 * @param array      $payload Untrusted request payload.
	 * @return array|WP_Error Normalized product preview or validation error.
	 */
	public static function update_product( $product, $payload ) {
		$result = self::apply_product_changes( $product, is_array( $payload ) ? $payload : array() );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return self::preview( $result );
	}

	/**
	 * Renders the official WooCommerce Cart block for the editor preview.
	 *
	 * @return string
	 */
	public static function cart_preview() {
		return class_exists( 'Code_To_Block_Renderer' ) ? Code_To_Block_Renderer::get_woocommerce_block_markup( 'cart' ) : '';
	}

	/**
	 * Renders the official WooCommerce Checkout block for the editor preview.
	 *
	 * @return string
	 */
	public static function checkout_preview() {
		return class_exists( 'Code_To_Block_Renderer' ) ? Code_To_Block_Renderer::get_woocommerce_block_markup( 'checkout' ) : '';
	}

	/**
	 * Applies validated base fields, attributes, custom fields and variations.
	 *
	 * @param WC_Product $product Product object.
	 * @param array      $payload Request payload.
	 * @return WC_Product|WP_Error
	 */
	private static function apply_product_changes( $product, $payload ) {
		$attributes = null;
		if ( array_key_exists( 'attributes', $payload ) ) {
			$attributes = self::prepare_attributes( $payload['attributes'], $product );
			if ( is_wp_error( $attributes ) ) {
				return $attributes;
			}
		}
		$variations = null;
		if ( array_key_exists( 'variations', $payload ) ) {
			if ( ! $product->is_type( 'variable' ) ) {
				return self::error( 'variations_require_variable_product', 'Variations can only be saved on a variable product.' );
			}
			$variations = self::prepare_variations( $payload['variations'] );
			if ( is_wp_error( $variations ) ) {
				return $variations;
			}
			$variation_attributes = null !== $attributes ? $attributes : array_values( (array) $product->get_attributes() );
			$variation_validation = self::validate_variations( $variations, $variation_attributes );
			if ( is_wp_error( $variation_validation ) ) {
				return $variation_validation;
			}
		}
		$custom_fields = null;
		if ( array_key_exists( 'custom_fields', $payload ) ) {
			$custom_fields = self::prepare_custom_fields( $payload['custom_fields'] );
			if ( is_wp_error( $custom_fields ) ) {
				return $custom_fields;
			}
		}

		try {
			if ( isset( $payload['name'] ) ) {
				$name = sanitize_text_field( $payload['name'] );
				if ( '' === trim( $name ) ) {
					return self::error( 'invalid_product_name', 'Product name cannot be empty.' );
				}
				$product->set_name( $name );
			}
			if ( isset( $payload['short_description'] ) ) {
				$product->set_short_description( wp_kses_post( $payload['short_description'] ) );
			}
			if ( array_key_exists( 'price', $payload ) || array_key_exists( 'regular_price', $payload ) ) {
				if ( $product->is_type( 'variable' ) ) {
					return self::error( 'variable_price_is_derived', 'Variable product prices are set on individual variations.' );
				}
				$price = array_key_exists( 'regular_price', $payload ) ? $payload['regular_price'] : $payload['price'];
				$price = self::prepare_price( $price, 'regular_price' );
				if ( is_wp_error( $price ) ) {
					return $price;
				}
				$product->set_regular_price( $price );
			}
			if ( array_key_exists( 'sale_price', $payload ) ) {
				if ( $product->is_type( 'variable' ) ) {
					return self::error( 'variable_price_is_derived', 'Variable sale prices are set on individual variations.' );
				}
				$sale_price = self::prepare_price( $payload['sale_price'], 'sale_price', true );
				if ( is_wp_error( $sale_price ) ) {
					return $sale_price;
				}
				$product->set_sale_price( $sale_price );
			}
			if ( null !== $attributes ) {
				$product->set_attributes( $attributes );
			}
			if ( null !== $custom_fields ) {
				foreach ( $custom_fields as $key => $value ) {
					$product->update_meta_data( $key, $value );
				}
			}
			$product->save();

			if ( null !== $variations ) {
				$variation_result = self::save_variations( $product, $variations );
				if ( is_wp_error( $variation_result ) ) {
					return $variation_result;
				}
			}
			if ( $product->is_type( 'variable' ) && class_exists( 'WC_Product_Variable' ) && method_exists( 'WC_Product_Variable', 'sync' ) ) {
				WC_Product_Variable::sync( $product, true );
			}
			if ( function_exists( 'wc_get_product' ) ) {
				$fresh = wc_get_product( $product->get_id() );
				if ( $fresh ) {
					$product = $fresh;
				}
			}
		} catch ( Throwable $error ) {
			return self::error( 'product_save_failed', $error->getMessage(), 500 );
		}

		return $product;
	}

	/**
	 * @param mixed      $value Attribute payload.
	 * @param WC_Product $product Existing or new product.
	 * @return array|WP_Error
	 */
	private static function prepare_attributes( $value, $product ) {
		if ( ! is_array( $value ) || count( $value ) > self::MAX_ATTRIBUTES ) {
			return self::error( 'invalid_product_attributes', 'Attributes must be an array of no more than 20 items.' );
		}
		$prepared = array();
		$seen     = array();
		foreach ( $value as $position => $input ) {
			if ( ! is_array( $input ) ) {
				return self::error( 'invalid_product_attribute', 'Each product attribute must be an object.' );
			}
			$name = isset( $input['name'] ) ? sanitize_text_field( $input['name'] ) : '';
			$slug = sanitize_title( $name );
			if ( '' === $name || '' === $slug || isset( $seen[ $slug ] ) ) {
				return self::error( 'invalid_product_attribute', 'Attribute names must be non-empty and unique.' );
			}
			$attribute_id = isset( $input['id'] ) ? max( 0, (int) $input['id'] ) : 0;
			if ( $attribute_id ) {
				$existing_attribute = null;
				foreach ( (array) $product->get_attributes() as $candidate ) {
					if ( is_object( $candidate ) && (int) $candidate->get_id() === $attribute_id ) {
						$existing_attribute = $candidate;
						break;
					}
				}
				if ( ! $existing_attribute ) {
					return self::error( 'invalid_product_attribute', 'A global attribute does not belong to this product.' );
				}
				$attribute = new WC_Product_Attribute();
				$attribute->set_id( $existing_attribute->get_id() );
				$attribute->set_name( $existing_attribute->get_name() );
				$attribute->set_options( $existing_attribute->get_options() );
				$attribute->set_position( (int) $position );
				$attribute->set_visible( ! isset( $input['visible'] ) || (bool) $input['visible'] );
				$attribute->set_variation( ! empty( $input['variation'] ) );
				$prepared[]    = $attribute;
				$seen[ $slug ] = true;
				continue;
			}

			$options = isset( $input['options'] ) && is_array( $input['options'] ) ? $input['options'] : array();
			if ( empty( $options ) || count( $options ) > self::MAX_OPTIONS ) {
				return self::error( 'invalid_product_attribute_options', 'Each attribute needs 1 to 100 options.' );
			}
			$clean_options = array();
			foreach ( $options as $option ) {
				if ( ! is_scalar( $option ) ) {
					return self::error( 'invalid_product_attribute_option', 'Attribute options must be text values.' );
				}
				$option = sanitize_text_field( (string) $option );
				if ( '' !== $option && ! in_array( $option, $clean_options, true ) ) {
					$clean_options[] = $option;
				}
			}
			if ( empty( $clean_options ) ) {
				return self::error( 'invalid_product_attribute_options', 'Each attribute needs at least one non-empty option.' );
			}
			$attribute = new WC_Product_Attribute();
			$attribute->set_id( 0 );
			$attribute->set_name( $name );
			$attribute->set_options( $clean_options );
			$attribute->set_position( (int) $position );
			$attribute->set_visible( ! isset( $input['visible'] ) || (bool) $input['visible'] );
			$attribute->set_variation( ! empty( $input['variation'] ) );
			$prepared[]    = $attribute;
			$seen[ $slug ] = true;
		}
		return $prepared;
	}

	/**
	 * Ensures every variation maps each variation attribute to a real option.
	 *
	 * @param array $variations Validated variation payloads.
	 * @param array $attributes WC_Product_Attribute objects.
	 * @return true|WP_Error
	 */
	private static function validate_variations( $variations, $attributes ) {
		$allowed = array();
		foreach ( $attributes as $attribute ) {
			if ( ! is_object( $attribute ) || ! $attribute->get_variation() ) {
				continue;
			}
			$key     = sanitize_title( $attribute->get_name() );
			$options = array();
			if ( $attribute->is_taxonomy() && method_exists( $attribute, 'get_terms' ) ) {
				foreach ( (array) $attribute->get_terms() as $term ) {
					if ( is_object( $term ) && isset( $term->slug ) ) {
						$options[] = (string) $term->slug;
					}
				}
			} else {
				$options = array_map( 'strval', (array) $attribute->get_options() );
			}
			$allowed[ $key ] = $options;
		}
		if ( ! empty( $variations ) && empty( $allowed ) ) {
			return self::error( 'variation_attributes_required', 'At least one product attribute must be enabled for variations.' );
		}
		foreach ( $variations as $variation ) {
			if ( count( $variation['attributes'] ) !== count( $allowed ) ) {
				return self::error( 'invalid_variation_attributes', 'Each variation must select every variation attribute.' );
			}
			foreach ( $allowed as $key => $options ) {
				if ( ! isset( $variation['attributes'][ $key ] ) || ! in_array( $variation['attributes'][ $key ], $options, true ) ) {
					return self::error( 'invalid_variation_option', 'A variation contains an option not assigned to its product.' );
				}
			}
		}
		return true;
	}

	/**
	 * @param mixed $value Variation payload.
	 * @return array|WP_Error
	 */
	private static function prepare_variations( $value ) {
		if ( ! is_array( $value ) || count( $value ) > self::MAX_VARIATIONS ) {
			return self::error( 'invalid_product_variations', 'Variations must be an array of no more than 100 items.' );
		}
		$prepared = array();
		$seen     = array();
		foreach ( $value as $input ) {
			if ( ! is_array( $input ) ) {
				return self::error( 'invalid_product_variation', 'Each variation must be an object.' );
			}
			$attributes       = isset( $input['attributes'] ) && is_array( $input['attributes'] ) ? $input['attributes'] : array();
			$clean_attributes = array();
			foreach ( $attributes as $name => $option ) {
				if ( ! is_string( $name ) || ! is_scalar( $option ) ) {
					return self::error( 'invalid_variation_attributes', 'Variation attributes must map names to text options.' );
				}
				$key = sanitize_title( $name );
				$clean_attributes[ $key ] = sanitize_text_field( (string) $option );
			}
			ksort( $clean_attributes );
			$combination = wp_json_encode( $clean_attributes );
			if ( isset( $seen[ $combination ] ) ) {
				return self::error( 'duplicate_product_variation', 'Variation attribute combinations must be unique.' );
			}
			$seen[ $combination ] = true;

			$regular_price = self::prepare_price( isset( $input['regular_price'] ) ? $input['regular_price'] : '', 'variation_regular_price' );
			if ( is_wp_error( $regular_price ) ) {
				return $regular_price;
			}
			$sale_price = self::prepare_price( isset( $input['sale_price'] ) ? $input['sale_price'] : '', 'variation_sale_price', true );
			if ( is_wp_error( $sale_price ) ) {
				return $sale_price;
			}
			$manage_stock   = ! empty( $input['manage_stock'] );
			$stock_quantity = null;
			if ( $manage_stock ) {
				if ( ! isset( $input['stock_quantity'] ) || ! is_numeric( $input['stock_quantity'] ) || (int) $input['stock_quantity'] < 0 ) {
					return self::error( 'invalid_variation_stock', 'Managed variation stock must be a non-negative number.' );
				}
				$stock_quantity = (int) $input['stock_quantity'];
			}
			$stock_status = isset( $input['stock_status'] ) ? sanitize_key( $input['stock_status'] ) : 'instock';
			if ( ! in_array( $stock_status, array( 'instock', 'outofstock', 'onbackorder' ), true ) ) {
				return self::error( 'invalid_variation_stock_status', 'Variation stock status is invalid.' );
			}
			$prepared[] = array(
				'id'             => isset( $input['id'] ) ? max( 0, (int) $input['id'] ) : 0,
				'attributes'     => $clean_attributes,
				'regular_price'  => $regular_price,
				'sale_price'     => $sale_price,
				'manage_stock'   => $manage_stock,
				'stock_quantity' => $stock_quantity,
				'stock_status'   => $stock_status,
				'enabled'        => ! isset( $input['enabled'] ) || (bool) $input['enabled'],
			);
		}
		return $prepared;
	}

	/**
	 * @param WC_Product_Variable $product Parent product.
	 * @param array               $variations Validated variations.
	 * @return true|WP_Error
	 */
	private static function save_variations( $product, $variations ) {
		$parent_id = (int) $product->get_id();
		foreach ( $variations as $input ) {
			$variation = null;
			if ( $input['id'] ) {
				$variation = function_exists( 'wc_get_product' ) ? wc_get_product( $input['id'] ) : null;
				if ( ! $variation || ! $variation->is_type( 'variation' ) || (int) $variation->get_parent_id() !== $parent_id ) {
					return self::error( 'variation_not_found', 'A variation does not belong to this product.', 404 );
				}
			} elseif ( class_exists( 'WC_Product_Variation' ) ) {
				$variation = new WC_Product_Variation();
				$variation->set_parent_id( $parent_id );
			}
			if ( ! $variation ) {
				return self::error( 'woocommerce_not_available', 'Product variations are not available.', 501 );
			}
			$variation->set_attributes( $input['attributes'] );
			$variation->set_regular_price( $input['regular_price'] );
			$variation->set_sale_price( $input['sale_price'] );
			$variation->set_manage_stock( $input['manage_stock'] );
			if ( $input['manage_stock'] ) {
				$variation->set_stock_quantity( $input['stock_quantity'] );
			}
			$variation->set_stock_status( $input['stock_status'] );
			$variation->set_status( $input['enabled'] ? 'publish' : 'private' );
			$variation->save();
		}
		return true;
	}

	/**
	 * @param mixed $value Custom fields object.
	 * @return array|WP_Error
	 */
	private static function prepare_custom_fields( $value ) {
		if ( ! is_array( $value ) || count( $value ) > self::MAX_CUSTOM_FIELDS ) {
			return self::error( 'invalid_custom_fields', 'Custom fields must be an object with no more than 50 entries.' );
		}
		$prepared = array();
		foreach ( $value as $key => $field_value ) {
			$key = is_string( $key ) ? sanitize_key( $key ) : '';
			if ( '' === $key || '_' === substr( $key, 0, 1 ) || ! is_scalar( $field_value ) ) {
				return self::error( 'invalid_custom_field', 'Custom field keys must be public names and values must be text.' );
			}
			$prepared[ $key ] = sanitize_text_field( (string) $field_value );
		}
		return $prepared;
	}

	/**
	 * @param mixed  $value Price value.
	 * @param string $field Field name for errors.
	 * @param bool   $allow_empty Whether an empty price is valid.
	 * @return string|WP_Error
	 */
	private static function prepare_price( $value, $field, $allow_empty = false ) {
		$value = is_scalar( $value ) ? trim( (string) $value ) : '';
		if ( '' === $value ) {
			return $allow_empty ? '' : self::error( 'invalid_product_price', $field . ' must be a non-negative price.' );
		}
		$price = function_exists( 'wc_format_decimal' ) ? wc_format_decimal( $value ) : $value;
		if ( ! is_numeric( $price ) || (float) $price < 0 ) {
			return self::error( 'invalid_product_price', $field . ' must be a non-negative price.' );
		}
		return (string) $price;
	}

	/**
	 * @param WC_Product $product Product object.
	 * @return array
	 */
	private static function custom_fields( $product ) {
		$fields = array();
		if ( ! method_exists( $product, 'get_meta_data' ) ) {
			return $fields;
		}
		foreach ( $product->get_meta_data() as $meta ) {
			$data  = method_exists( $meta, 'get_data' ) ? $meta->get_data() : (array) $meta;
			$key   = isset( $data['key'] ) ? (string) $data['key'] : '';
			$value = isset( $data['value'] ) ? $data['value'] : null;
			if ( '' === $key || '_' === substr( $key, 0, 1 ) || ! is_scalar( $value ) ) {
				continue;
			}
			$fields[] = array( 'key' => $key, 'value' => (string) $value );
			if ( count( $fields ) >= self::MAX_CUSTOM_FIELDS ) {
				break;
			}
		}
		return $fields;
	}

	/**
	 * @param WC_Product $product Product object.
	 * @return array
	 */
	private static function attributes( $product ) {
		$normalized = array();
		if ( ! method_exists( $product, 'get_attributes' ) ) {
			return $normalized;
		}
		foreach ( $product->get_attributes() as $attribute ) {
			if ( ! is_object( $attribute ) || ! method_exists( $attribute, 'get_name' ) ) {
				continue;
			}
			$options       = array();
			$option_values = array();
			$term_ids      = array();
			if ( method_exists( $attribute, 'get_terms' ) && $attribute->is_taxonomy() ) {
				$terms = $attribute->get_terms();
				foreach ( is_array( $terms ) ? $terms : array() as $term ) {
					if ( is_object( $term ) && isset( $term->name ) ) {
						$options[]       = (string) $term->name;
						$option_values[] = isset( $term->slug ) ? (string) $term->slug : (string) $term->name;
						$term_ids[]      = isset( $term->term_id ) ? (int) $term->term_id : 0;
					}
				}
			} else {
				$options       = array_map( 'strval', (array) $attribute->get_options() );
				$option_values = $options;
			}
			$normalized[] = array(
				'id'        => (int) $attribute->get_id(),
				'name'      => (string) $attribute->get_name(),
				'slug'      => sanitize_title( $attribute->get_name() ),
				'options'   => array_values( $options ),
				'option_values' => array_values( $option_values ),
				'term_ids'  => array_values( array_filter( $term_ids ) ),
				'taxonomy'  => (bool) $attribute->is_taxonomy(),
				'visible'   => (bool) $attribute->get_visible(),
				'variation' => (bool) $attribute->get_variation(),
			);
		}
		return $normalized;
	}

	/**
	 * @param array $children Variation IDs.
	 * @return array
	 */
	private static function variations( $children ) {
		$normalized = array();
		if ( ! function_exists( 'wc_get_product' ) ) {
			return $normalized;
		}
		foreach ( $children as $variation_id ) {
			$variation = wc_get_product( $variation_id );
			if ( ! $variation || ! $variation->is_type( 'variation' ) ) {
				continue;
			}
			$normalized[] = array(
				'id'             => (int) $variation->get_id(),
				'attributes'     => (array) $variation->get_attributes(),
				'price'          => self::product_value( $variation, 'get_price' ),
				'regular_price'  => self::product_value( $variation, 'get_regular_price' ),
				'sale_price'     => self::product_value( $variation, 'get_sale_price' ),
				'price_html'     => wp_kses_post( $variation->get_price_html() ),
				'manage_stock'   => (bool) $variation->get_manage_stock(),
				'stock_quantity' => null === $variation->get_stock_quantity() ? null : (int) $variation->get_stock_quantity(),
				'stock_status'   => (string) $variation->get_stock_status(),
				'is_in_stock'    => (bool) $variation->is_in_stock(),
				'enabled'        => 'publish' === $variation->get_status(),
			);
		}
		return $normalized;
	}

	/**
	 * @param WC_Product $product Product object.
	 * @param string     $method Getter method.
	 * @return string
	 */
	private static function product_value( $product, $method ) {
		return method_exists( $product, $method ) ? (string) $product->{$method}( 'edit' ) : '';
	}

	/**
	 * @param string $code Error code.
	 * @param string $message Error message.
	 * @param int    $status HTTP status.
	 * @return WP_Error
	 */
	private static function error( $code, $message, $status = 400 ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}
}
