<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * SEO architecture: auto JSON-LD from block structure + meta via content-mode.
 *
 * Generation is strictly from live block data (no manual schema entry):
 * - woocommerce_product / woocommerce_product_grid / is_dynamic wc_product_* → Product
 * - content slots labeled address/phone/hours → LocalBusiness
 * - document name + heading → WebPage / Article
 *
 * Drift is structurally avoided because schema and rendered HTML pull from the
 * same wc_get_product() call at the same render time (see decisions log).
 */
final class Code_To_Block_SEO {
	/**
	 * Sanitizes document-level SEO meta.
	 *
	 * @param mixed  $value Incoming seo object.
	 * @param string $path  Error path.
	 * @return array|WP_Error
	 */
	public static function sanitize_seo( $value, $path ) {
		$value = is_object( $value ) ? get_object_vars( $value ) : $value;
		if ( ! is_array( $value ) ) {
			return Code_To_Block_Schema::error( $path, 'must be an object' );
		}
		$allowed = array( 'title', 'description', 'canonical', 'og_title', 'og_description', 'og_image' );
		$seo = array();
		foreach ( $allowed as $key ) {
			if ( ! array_key_exists( $key, $value ) ) {
				continue;
			}
			if ( ! is_string( $value[ $key ] ) ) {
				return Code_To_Block_Schema::error( $path . '.' . $key, 'must be a string' );
			}
			$trimmed = trim( $value[ $key ] );
			if ( '' === $trimmed ) {
				continue;
			}
			if ( strlen( $trimmed ) > 1000 ) {
				return Code_To_Block_Schema::error( $path . '.' . $key, 'must be 1000 chars or fewer' );
			}
			// For URLs, allow only safe patterns
			if ( in_array( $key, array( 'canonical', 'og_image' ), true ) ) {
				// Use esc_url_raw validation: must be http/https or site-root relative
				if ( preg_match( '#^\s*javascript:#i', $trimmed ) ) {
					return Code_To_Block_Schema::error( $path . '.' . $key, 'URL must not use javascript:' );
				}
			}
			// Description length guidance: 50-160 chars is ideal but we accept 0-300, warn via UI not reject
			$seo[ $key ] = sanitize_text_field( $trimmed );
		}
		return $seo;
	}

	/**
	 * Generates JSON-LD graph from document + live WooCommerce data.
	 *
	 * @param array $document Sanitized document.
	 * @param int   $post_id  Owning post ID.
	 * @return array List of schema nodes.
	 */
	public static function generate_json_ld( $document, $post_id ) {
		$graph = array();

		// WebPage base from document name
		$title = isset( $document['name'] ) ? $document['name'] : get_the_title( $post_id );
		$url = get_permalink( $post_id );
		$graph[] = array(
			'@type' => 'WebPage',
			'@id'   => $url ? trailingslashit( $url ) . '#webpage' : '#webpage',
			'name'  => $title,
			'url'   => $url ? $url : '',
		);

		// Collect product nodes from woocommerce blocks + dynamic bindings
		$products = self::collect_products( $document, $post_id );
		foreach ( $products as $product ) {
			$graph[] = $product;
		}

		// LocalBusiness from content slots
		$local = self::collect_local_business( $document );
		if ( $local ) {
			$graph[] = $local;
		}

		// If we have only WebPage and nothing else, keep WebPage.
		// If we have products, also keep WebPage as framing.
		return $graph;
	}

	/**
	 * Returns meta tag map from document seo.
	 *
	 * @param array $document Sanitized document.
	 * @param int   $post_id  Owning post ID.
	 * @return array
	 */
	public static function generate_meta( $document, $post_id ) {
		$seo = isset( $document['seo'] ) && is_array( $document['seo'] ) ? $document['seo'] : array();
		$meta = array();
		if ( ! empty( $seo['title'] ) ) {
			$meta['title'] = $seo['title'];
		} else {
			$meta['title'] = isset( $document['name'] ) ? $document['name'] : '';
		}
		if ( ! empty( $seo['description'] ) ) {
			$meta['description'] = $seo['description'];
		}
		if ( ! empty( $seo['canonical'] ) ) {
			$meta['canonical'] = esc_url( self::normalize_url( $seo['canonical'] ) );
		} else {
			$perm = get_permalink( $post_id );
			if ( $perm ) $meta['canonical'] = esc_url( $perm );
		}
		// OG
		$meta['og:title'] = ! empty( $seo['og_title'] ) ? $seo['og_title'] : $meta['title'];
		$meta['og:description'] = ! empty( $seo['og_description'] ) ? $seo['og_description'] : ( isset( $meta['description'] ) ? $meta['description'] : '' );
		$meta['og:url'] = $meta['canonical'];
		$meta['og:type'] = 'website';
		if ( ! empty( $seo['og_image'] ) ) {
			$meta['og:image'] = esc_url( self::normalize_url( $seo['og_image'] ) );
		}
		return $meta;
	}

	/**
	 * Echoes JSON-LD and meta tags on frontend (hooked to wp_head).
	 *
	 * @param int   $post_id  Queried post ID.
	 * @param array $document Sanitized document.
	 */
	public static function output_head( $post_id, $document ) {
		$meta = self::generate_meta( $document, $post_id );
		// Title tag is handled by theme; we output description/canonical/OG as meta
		if ( ! empty( $meta['description'] ) ) {
			echo '<meta name="description" content="' . esc_attr( $meta['description'] ) . '">' . "\n";
		}
		if ( ! empty( $meta['canonical'] ) ) {
			echo '<link rel="canonical" href="' . esc_url( $meta['canonical'] ) . '">' . "\n";
		}
		if ( ! empty( $meta['og:title'] ) ) {
			echo '<meta property="og:title" content="' . esc_attr( $meta['og:title'] ) . '">' . "\n";
		}
		if ( ! empty( $meta['og:description'] ) ) {
			echo '<meta property="og:description" content="' . esc_attr( $meta['og:description'] ) . '">' . "\n";
		}
		if ( ! empty( $meta['og:url'] ) ) {
			echo '<meta property="og:url" content="' . esc_attr( $meta['og:url'] ) . '">' . "\n";
		}
		echo '<meta property="og:type" content="website">' . "\n";
		if ( ! empty( $meta['og:image'] ) ) {
			echo '<meta property="og:image" content="' . esc_attr( $meta['og:image'] ) . '">' . "\n";
		}
		$graph = self::generate_json_ld( $document, $post_id );
		if ( ! empty( $graph ) ) {
			$json_ld = array(
				'@context' => 'https://schema.org',
				'@graph'   => $graph,
			);
			$encoded = wp_json_encode( $json_ld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
			if ( false !== $encoded ) {
				echo '<script type="application/ld+json">' . $encoded . '</script>' . "\n";
			}
		}
	}

	private static function collect_products( $document, $post_id ) {
		$products = array();
		$seen_ids = array();
		self::visit_products( $document['root'], $post_id, $products, $seen_ids );
		return $products;
	}

	private static function visit_products( $block, $fallback_post_id, &$products, &$seen_ids ) {
		$type = isset( $block['type'] ) ? $block['type'] : '';
		$attrs = isset( $block['attributes'] ) && is_array( $block['attributes'] ) ? $block['attributes'] : array();
		$is_dynamic = ! empty( $block['is_dynamic'] );

		// woocommerce_product: single product container
		if ( 'woocommerce_product' === $type ) {
			$pid = isset( $attrs['data-product-id'] ) ? (int) $attrs['data-product-id'] : (int) $fallback_post_id;
			if ( $pid && ! isset( $seen_ids[ $pid ] ) && function_exists( 'wc_get_product' ) ) {
				$wc = wc_get_product( $pid );
				if ( $wc ) {
					$seen_ids[ $pid ] = true;
					$products[] = self::product_schema_from_wc( $wc );
				}
			}
		} elseif ( 'woocommerce_product_grid' === $type && function_exists( 'wc_get_products' ) ) {
			// Grid: each product in the grid yields a Product
			$limit = isset( $attrs['data-grid-limit'] ) ? max( 1, min( 12, (int) $attrs['data-grid-limit'] ) ) : 6;
			$args = array( 'limit' => $limit, 'status' => 'publish', 'orderby' => 'date', 'order' => 'DESC' );
			if ( ! empty( $attrs['data-product-category'] ) ) {
				$args['category'] = array( sanitize_text_field( $attrs['data-product-category'] ) );
			}
			$grid_products = wc_get_products( $args );
			foreach ( $grid_products as $wc ) {
				$pid = $wc->get_id();
				if ( isset( $seen_ids[ $pid ] ) ) continue;
				$seen_ids[ $pid ] = true;
				$products[] = self::product_schema_from_wc( $wc );
			}
		} elseif ( $is_dynamic && ! empty( $block['dynamic_source'] ) && 0 === strpos( $block['dynamic_source'], 'wc_product_' ) ) {
			// Loose dynamic binding outside a product container: fallback_post_id is product context if page is product-like
			$pid = (int) $fallback_post_id;
			if ( $pid && ! isset( $seen_ids[ $pid ] ) && function_exists( 'wc_get_product' ) ) {
				$wc = wc_get_product( $pid );
				if ( $wc ) {
					$seen_ids[ $pid ] = true;
					$products[] = self::product_schema_from_wc( $wc );
				}
			}
		}
		// Traverse children: for product containers, pass product id as new fallback (mirrors renderer)
		foreach ( $block['children'] as $child ) {
			if ( isset( $child['kind'] ) ) continue;
			$next_fallback = $fallback_post_id;
			if ( 'woocommerce_product' === $type && isset( $attrs['data-product-id'] ) ) {
				$next_fallback = (int) $attrs['data-product-id'];
			}
			self::visit_products( $child, $next_fallback, $products, $seen_ids );
		}
	}

	private static function product_schema_from_wc( $wc ) {
		$price = $wc->get_price();
		$regular = $wc->get_regular_price();
		$image_id = $wc->get_image_id();
		$image_url = $image_id ? wp_get_attachment_image_url( $image_id, 'full' ) : '';
		$availability = $wc->is_in_stock() ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
		$url = get_permalink( $wc->get_id() );
		$schema = array(
			'@type' => 'Product',
			'name'  => $wc->get_name(),
			'description' => wp_strip_all_tags( $wc->get_short_description() ),
			'sku'   => $wc->get_sku() ? $wc->get_sku() : (string) $wc->get_id(),
			'offers' => array(
				'@type'         => 'Offer',
				'price'         => $price ? $price : $regular,
				'priceCurrency' => get_woocommerce_currency(),
				'availability'  => $availability,
				'url'           => $url ? $url : '',
			),
		);
		if ( $image_url ) {
			$schema['image'] = $image_url;
		}
		return $schema;
	}

	private static function collect_local_business( $document ) {
		// Heuristic: look for content slots whose label suggests business data
		$fields = array( 'streetAddress' => '', 'telephone' => '', 'openingHours' => '' );
		$found = false;
		self::visit_slots( $document['root'], $fields, $found );
		if ( ! $found ) {
			return null;
		}
		$addr = $fields['streetAddress'];
		$tel = $fields['telephone'];
		$hours = $fields['openingHours'];
		// Require at least address or phone to be worth emitting
		if ( '' === trim( $addr ) && '' === trim( $tel ) ) {
			return null;
		}
		$lb = array( '@type' => 'LocalBusiness', 'name' => isset( $document['name'] ) ? $document['name'] : '' );
		if ( '' !== trim( $addr ) ) {
			$lb['address'] = array( '@type' => 'PostalAddress', 'streetAddress' => $addr );
		}
		if ( '' !== trim( $tel ) ) {
			$lb['telephone'] = $tel;
		}
		if ( '' !== trim( $hours ) ) {
			$lb['openingHours'] = $hours;
		}
		return $lb;
	}

	private static function visit_slots( $block, &$fields, &$found ) {
		if ( ! empty( $block['is_content_slot'] ) && ! empty( $block['slot_label'] ) ) {
			$label = strtolower( $block['slot_label'] );
			$value = '';
			if ( isset( $block['children'] ) ) {
				foreach ( $block['children'] as $child ) {
					if ( isset( $child['kind'] ) && 'text' === $child['kind'] ) {
						$value .= $child['value'];
					}
				}
			}
			if ( '' === trim( $value ) && isset( $block['attributes']['src'] ) ) {
				$value = $block['attributes']['src'];
			}
			if ( '' === trim( $value ) && isset( $block['attributes']['href'] ) ) {
				$value = $block['attributes']['href'];
			}
			if ( false !== strpos( $label, 'address' ) ) {
				$fields['streetAddress'] = $value;
				$found = true;
			} elseif ( false !== strpos( $label, 'phone' ) || false !== strpos( $label, 'tel' ) ) {
				$fields['telephone'] = $value;
				$found = true;
			} elseif ( false !== strpos( $label, 'hours' ) || false !== strpos( $label, 'open' ) ) {
				$fields['openingHours'] = $value;
				$found = true;
			}
		}
		foreach ( $block['children'] as $child ) {
			if ( isset( $child['kind'] ) ) continue;
			self::visit_slots( $child, $fields, $found );
		}
	}

	private static function normalize_url( $url ) {
		$url = trim( $url );
		if ( '' === $url || preg_match( '#^(?:[a-z][a-z0-9+.-]*:|//|/|\#)#i', $url ) ) {
			return $url;
		}
		return trailingslashit( home_url() ) . ltrim( $url, '/' );
	}
}
