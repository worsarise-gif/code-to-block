<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Stores reusable component documents and resolves linked page instances.
 */
final class Code_To_Block_Components {
	const FAILURE_MESSAGE = 'this saved component failed to load';
	const MAX_COMPONENTS = 100;

	/**
	 * @param mixed $value Incoming component meta.
	 * @return string
	 */
	public static function sanitize_meta_value( $value ) {
		if ( is_string( $value ) ) {
			$value = json_decode( $value );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return '';
			}
		}
		$document = Code_To_Block_Schema::sanitize_component_document( $value );
		if ( is_wp_error( $document ) ) {
			return '';
		}
		$json = wp_json_encode( $document, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		return false === $json ? '' : $json;
	}

	/**
	 * @param bool   $allowed Existing authorization result.
	 * @param string $meta_key Meta key.
	 * @param int    $object_id Component post ID.
	 * @return bool
	 */
	public static function authorize_meta( $allowed, $meta_key, $object_id ) {
		unset( $allowed, $meta_key );
		return current_user_can( 'edit_post', (int) $object_id );
	}

	/**
	 * Prevents malformed direct metadata writes from replacing valid components.
	 *
	 * @param mixed  $check Existing short-circuit result.
	 * @param int    $object_id Component post ID.
	 * @param string $meta_key Meta key.
	 * @param mixed  $meta_value Incoming value.
	 * @return mixed
	 */
	public static function validate_meta_write( $check, $object_id, $meta_key, $meta_value ) {
		if ( null !== $check || CODE_TO_BLOCK_COMPONENT_META_KEY !== $meta_key ) {
			return $check;
		}
		if ( CODE_TO_BLOCK_COMPONENT_POST_TYPE !== get_post_type( (int) $object_id ) ) {
			return $check;
		}
		return '' === self::sanitize_meta_value( $meta_value ) ? false : null;
	}

	/**
	 * @param mixed $value Component document.
	 * @return array|WP_Error
	 */
	public static function create( $value ) {
		if ( ! current_user_can( 'edit_posts' ) || ! current_user_can( 'publish_posts' ) ) {
			return self::error( 'code_to_block_component_forbidden', 'You are not allowed to create saved components.', rest_authorization_required_code() );
		}
		$counts = wp_count_posts( CODE_TO_BLOCK_COMPONENT_POST_TYPE );
		if ( $counts && isset( $counts->publish ) && (int) $counts->publish >= self::MAX_COMPONENTS ) {
			return self::error( 'code_to_block_component_limit', 'The saved component library cannot contain more than 100 components.', 413 );
		}
		$document = Code_To_Block_Schema::sanitize_component_document( $value );
		if ( is_wp_error( $document ) ) {
			return $document;
		}
		$post_id = wp_insert_post(
			array(
				'post_type'   => CODE_TO_BLOCK_COMPONENT_POST_TYPE,
				'post_status' => 'publish',
				'post_title'  => $document['name'],
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}
		$result = self::write_document( (int) $post_id, $document );
		if ( is_wp_error( $result ) ) {
			wp_delete_post( (int) $post_id, true );
			return $result;
		}
		return self::get( (int) $post_id );
	}

	/**
	 * @param int   $component_id Component post ID.
	 * @param mixed $value Component document.
	 * @return array|WP_Error
	 */
	public static function update( $component_id, $value ) {
		$post = get_post( (int) $component_id );
		if ( ! $post || CODE_TO_BLOCK_COMPONENT_POST_TYPE !== $post->post_type || 'publish' !== $post->post_status ) {
			return self::error( 'code_to_block_component_not_found', 'Saved component not found.', 404 );
		}
		if ( ! current_user_can( 'edit_post', (int) $component_id ) ) {
			return self::error( 'code_to_block_component_forbidden', 'You are not allowed to edit this saved component.', rest_authorization_required_code() );
		}
		$document = Code_To_Block_Schema::sanitize_component_document( $value );
		if ( is_wp_error( $document ) ) {
			return $document;
		}
		$previous_json = get_post_meta( (int) $component_id, CODE_TO_BLOCK_COMPONENT_META_KEY, true );
		$result = self::write_document( (int) $component_id, $document );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		$title_updated = wp_update_post( array( 'ID' => (int) $component_id, 'post_title' => $document['name'] ), true );
		if ( is_wp_error( $title_updated ) ) {
			update_post_meta( (int) $component_id, CODE_TO_BLOCK_COMPONENT_META_KEY, wp_slash( $previous_json ) );
			return $title_updated;
		}
		return self::get( (int) $component_id );
	}

	/**
	 * @param int $component_id Component post ID.
	 * @return array|WP_Error
	 */
	public static function get( $component_id ) {
		$post = get_post( (int) $component_id );
		if ( ! $post || CODE_TO_BLOCK_COMPONENT_POST_TYPE !== $post->post_type || 'publish' !== $post->post_status ) {
			return self::error( 'code_to_block_component_not_found', 'Saved component not found.', 404 );
		}
		$json = get_post_meta( (int) $component_id, CODE_TO_BLOCK_COMPONENT_META_KEY, true );
		if ( ! is_string( $json ) || '' === $json ) {
			return self::error( 'code_to_block_corrupt_component', self::FAILURE_MESSAGE, 500 );
		}
		$value = json_decode( $json );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			return self::error( 'code_to_block_corrupt_component', self::FAILURE_MESSAGE, 500 );
		}
		$document = Code_To_Block_Schema::sanitize_component_document( $value );
		if ( is_wp_error( $document ) ) {
			return self::error( 'code_to_block_corrupt_component', self::FAILURE_MESSAGE, 500 );
		}
		return array(
			'id'       => (int) $component_id,
			'name'     => $document['name'],
			'status'   => 'ready',
			'revision' => substr( hash( 'sha256', $json ), 0, 16 ),
			'document' => $document,
		);
	}

	/**
	 * Lists each record independently so one corrupt component cannot hide others.
	 *
	 * @return array
	 */
	public static function all() {
		$posts = get_posts(
			array(
				'post_type'      => CODE_TO_BLOCK_COMPONENT_POST_TYPE,
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'orderby'        => 'title',
				'order'          => 'ASC',
			)
		);
		$components = array();
		foreach ( $posts as $post ) {
			$component = self::get( $post->ID );
			$components[] = is_wp_error( $component )
				? array(
					'id'      => (int) $post->ID,
					'name'    => $post->post_title,
					'status'  => 'failed',
					'message' => self::FAILURE_MESSAGE,
				)
				: $component;
		}
		return $components;
	}

	/**
	 * Resolves component placeholders independently for editor/public rendering.
	 *
	 * @param array $document Sanitized page document.
	 * @return array
	 */
	public static function resolve_document( $document ) {
		if ( ! is_array( $document ) || ! isset( $document['root'] ) ) {
			return $document;
		}
		$resolved       = self::deep_array( $document );
		$tokens         = isset( $resolved['design_tokens'] ) ? self::to_array( $resolved['design_tokens'] ) : array();
		$token_maps     = array();
		$component_cache = array();
		$metrics_cache   = array();
		$used_block_ids = array();
		$used_dom_ids   = array();
		self::collect_used_ids( $resolved['root'], $used_block_ids, $used_dom_ids );
		$block_count   = 0;
		$resolved_bytes = strlen( wp_json_encode( $resolved, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) );
		$resolved['root'] = self::resolve_block(
			$resolved['root'],
			$tokens,
			$token_maps,
			1,
			$block_count,
			$resolved_bytes,
			$used_block_ids,
			$used_dom_ids,
			$component_cache,
			$metrics_cache
		);
		if ( ! empty( $tokens ) ) {
			$resolved['design_tokens'] = $tokens;
		}
		if ( ! empty( $resolved['slot_values'] ) ) {
			self::apply_slot_values( $resolved['root'], $resolved['slot_values'] );
		}
		return $resolved;
	}

	private static function apply_slot_values( &$block, $values ) {
		if ( ! empty( $block['is_content_slot'] ) && isset( $values[ $block['id'] ] ) ) {
			$value = $values[ $block['id'] ];
			if ( in_array( $block['slot_content_type'], array( 'text', 'rich_text' ), true ) ) {
				if ( 'rich_text' === $block['slot_content_type'] ) {
					$value = Code_To_Block_Schema::sanitize_rich_text( $value );
				}
				$block['children'] = array( array( 'kind' => 'text', 'value' => $value ) );
			} elseif ( 'image' === $block['slot_content_type'] ) {
				$block['attributes'] = self::to_array( $block['attributes'] );
				$block['attributes']['src'] = $value;
			} elseif ( 'link' === $block['slot_content_type'] ) {
				$block['attributes'] = self::to_array( $block['attributes'] );
				$block['attributes']['href'] = $value;
			}
		}
		foreach ( $block['children'] as &$child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				self::apply_slot_values( $child, $values );
			}
		}
		unset( $child );
	}

	/**
	 * @param int   $component_id Component post ID.
	 * @param array $document Canonical document.
	 * @return true|WP_Error
	 */
	private static function write_document( $component_id, $document ) {
		$json = wp_json_encode( $document, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( false === $json ) {
			return self::error( 'code_to_block_component_encode_failed', 'The saved component could not be encoded.', 500 );
		}
		$updated = update_post_meta( $component_id, CODE_TO_BLOCK_COMPONENT_META_KEY, wp_slash( $json ) );
		if ( false === $updated && $json !== get_post_meta( $component_id, CODE_TO_BLOCK_COMPONENT_META_KEY, true ) ) {
			return self::error( 'code_to_block_component_save_failed', 'The saved component could not be saved.', 500 );
		}
		return true;
	}

	/**
	 * @param array $block Block or component placeholder.
	 * @param array $tokens Destination token registry.
	 * @param array $token_maps Per-component reference maps.
	 * @return array
	 */
	private static function resolve_block( $block, &$tokens, &$token_maps, $depth, &$block_count, &$resolved_bytes, &$used_block_ids, &$used_dom_ids, &$component_cache, &$metrics_cache ) {
		++$block_count;
		$component_id = isset( $block['meta']['saved_component_id'] ) ? (int) $block['meta']['saved_component_id'] : 0;
		if ( $component_id ) {
			if ( ! array_key_exists( $component_id, $component_cache ) ) {
				$component_cache[ $component_id ] = self::get( $component_id );
			}
			$component = $component_cache[ $component_id ];
			$attributes = self::to_array( isset( $block['attributes'] ) ? $block['attributes'] : array() );
			$attributes['class'] = trim( ( isset( $attributes['class'] ) ? $attributes['class'] . ' ' : '' ) . 'ctb-saved-component' );
			$block['attributes'] = $attributes;
			if ( is_wp_error( $component ) ) {
				return self::failed_block( $block );
			}
			if ( ! isset( $metrics_cache[ $component_id ] ) ) {
				$metrics_cache[ $component_id ] = self::component_metrics( $component['document']['root'] );
				$metrics_cache[ $component_id ]['bytes'] = strlen( wp_json_encode( $component['document'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) );
			}
			$metrics = $metrics_cache[ $component_id ];
			$component_bytes = $metrics['bytes'];
			if (
				$block_count + $metrics['blocks'] > Code_To_Block_Schema::MAX_BLOCKS ||
				$depth + $metrics['depth'] > Code_To_Block_Schema::MAX_DEPTH ||
				$resolved_bytes + $component_bytes > Code_To_Block_Schema::MAX_JSON_BYTES
			) {
				return self::failed_block( $block );
			}
			$next_tokens = self::deep_array( $tokens );
			$token_map = isset( $token_maps[ $component_id ] )
				? $token_maps[ $component_id ]
				: self::merge_component_tokens( $component_id, $component['document'], $next_tokens );
			if ( self::count_tokens( $next_tokens ) > Code_To_Block_Schema::MAX_DESIGN_TOKENS ) {
				return self::failed_block( $block );
			}
			$next_block_ids = $used_block_ids;
			$next_dom_ids   = $used_dom_ids;
			$cloned_root = self::clone_component_root(
					$component['document']['root'],
					$block['id'],
					$component_id,
					$token_map,
					$next_block_ids,
					$next_dom_ids
				);
			$clone_bytes = strlen( wp_json_encode( $cloned_root, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) );
			$token_bytes = max(
				0,
				strlen( wp_json_encode( $next_tokens, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) ) -
				strlen( wp_json_encode( $tokens, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) )
			);
			if ( $resolved_bytes + $clone_bytes + $token_bytes > Code_To_Block_Schema::MAX_JSON_BYTES ) {
				return self::failed_block( $block );
			}
			$block_count    += $metrics['blocks'];
			$resolved_bytes += $clone_bytes + $token_bytes;
			$tokens          = $next_tokens;
			$used_block_ids  = $next_block_ids;
			$used_dom_ids    = $next_dom_ids;
			$token_maps[ $component_id ] = $token_map;
			$block['children'] = array( $cloned_root );
			return $block;
		}
		foreach ( $block['children'] as $index => $child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				$block['children'][ $index ] = self::resolve_block(
					$child,
					$tokens,
					$token_maps,
					$depth + 1,
					$block_count,
					$resolved_bytes,
					$used_block_ids,
					$used_dom_ids,
					$component_cache,
					$metrics_cache
				);
			}
		}
		return $block;
	}

	/**
	 * @param int   $component_id Component ID.
	 * @param array $document Component document.
	 * @param array $tokens Destination token registry.
	 * @return array
	 */
	private static function merge_component_tokens( $component_id, $document, &$tokens ) {
		$map = array();
		$source_tokens = isset( $document['design_tokens'] ) ? self::to_array( $document['design_tokens'] ) : array();
		foreach ( Code_To_Block_Schema::TOKEN_CATEGORIES as $category ) {
			$category_tokens = isset( $source_tokens[ $category ] ) ? self::to_array( $source_tokens[ $category ] ) : array();
			if ( ! isset( $tokens[ $category ] ) ) {
				$tokens[ $category ] = array();
			} else {
				$tokens[ $category ] = self::to_array( $tokens[ $category ] );
			}
			foreach ( $category_tokens as $id => $token ) {
				$base = substr( 'saved-' . $component_id . '-' . $id, 0, 40 );
				$next = $base;
				$suffix = 2;
				while ( isset( $tokens[ $category ][ $next ] ) && $tokens[ $category ][ $next ] != $token ) {
					$tail = '-' . $suffix++;
					$next = substr( $base, 0, 40 - strlen( $tail ) ) . $tail;
				}
				$tokens[ $category ][ $next ] = $token;
				$map[ $category . '.' . $id ] = $category . '.' . $next;
			}
			if ( empty( $tokens[ $category ] ) ) {
				unset( $tokens[ $category ] );
			}
		}
		return $map;
	}

	private static function count_tokens( $tokens ) {
		$count = 0;
		foreach ( Code_To_Block_Schema::TOKEN_CATEGORIES as $category ) {
			$count += count( isset( $tokens[ $category ] ) ? self::to_array( $tokens[ $category ] ) : array() );
		}
		return $count;
	}

	/**
	 * @param array  $root Component root.
	 * @param string $instance_id Placeholder ID.
	 * @param int    $component_id Component ID.
	 * @param array  $token_map Token reference map.
	 * @return array
	 */
	private static function clone_component_root( $root, $instance_id, $component_id, $token_map, &$used_block_ids, &$used_dom_ids ) {
		$root    = self::deep_array( $root );
		$id_map  = array();
		$dom_id_map = array();
		$counter = 0;
		$dom_counter = 0;
		self::map_clone_ids( $root, $instance_id, $component_id, $counter, $dom_counter, $id_map, $dom_id_map, $used_block_ids, $used_dom_ids );
		self::rewrite_clone( $root, $id_map, $dom_id_map, $token_map );
		return $root;
	}

	private static function map_clone_ids( &$block, $instance_id, $component_id, &$counter, &$dom_counter, &$id_map, &$dom_id_map, &$used_block_ids, &$used_dom_ids ) {
		$old = $block['id'];
		$base = 'saved-' . $component_id . '-' . $instance_id . '-' . ++$counter;
		$new = self::unique_id( $base, $used_block_ids, 500 );
		$id_map[ $old ] = $new;
		$block['id'] = $new;
		$attributes = self::to_array( isset( $block['attributes'] ) ? $block['attributes'] : array() );
		if ( isset( $attributes['id'] ) && is_string( $attributes['id'] ) ) {
			$old_dom_id = $attributes['id'];
			$new_dom_id = self::unique_id( $base . '-dom-' . ++$dom_counter, $used_dom_ids, 500 );
			$dom_id_map[ $old_dom_id ] = $new_dom_id;
			$attributes['id'] = $new_dom_id;
			$block['attributes'] = $attributes;
		}
		foreach ( $block['children'] as &$child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				self::map_clone_ids( $child, $instance_id, $component_id, $counter, $dom_counter, $id_map, $dom_id_map, $used_block_ids, $used_dom_ids );
			}
		}
	}

	private static function rewrite_clone( &$block, $id_map, $dom_id_map, $token_map ) {
		foreach ( array( 'styles' ) as $branch ) {
			self::rewrite_style_tokens( $block[ $branch ], $token_map );
		}
		foreach ( array( 'responsive_overrides', 'states' ) as $branch ) {
			if ( isset( $block[ $branch ] ) ) {
				foreach ( $block[ $branch ] as &$style_set ) {
					self::rewrite_style_tokens( $style_set, $token_map );
				}
			}
		}
		if ( isset( $block['actions'] ) ) {
			foreach ( $block['actions'] as &$action ) {
				if ( isset( $action['params']['target_block_id'], $id_map[ $action['params']['target_block_id'] ] ) ) {
					$action['params']['target_block_id'] = $id_map[ $action['params']['target_block_id'] ];
				}
			}
			unset( $action );
		}
		self::rewrite_dom_references( $block, $dom_id_map );
		foreach ( $block['children'] as &$child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				self::rewrite_clone( $child, $id_map, $dom_id_map, $token_map );
			}
		}
	}

	private static function rewrite_dom_references( &$block, $dom_id_map ) {
		$attributes = self::to_array( isset( $block['attributes'] ) ? $block['attributes'] : array() );
		foreach ( array( 'for', 'headers', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-flowto', 'aria-details', 'aria-errormessage', 'aria-activedescendant' ) as $name ) {
			if ( ! isset( $attributes[ $name ] ) || ! is_string( $attributes[ $name ] ) ) {
				continue;
			}
			$parts = preg_split( '/\s+/', trim( $attributes[ $name ] ) );
			$attributes[ $name ] = implode( ' ', array_map( static function ( $id ) use ( $dom_id_map ) {
				return isset( $dom_id_map[ $id ] ) ? $dom_id_map[ $id ] : $id;
			}, $parts ) );
		}
		if ( isset( $attributes['href'] ) && is_string( $attributes['href'] ) && 0 === strpos( $attributes['href'], '#' ) ) {
			$id = substr( $attributes['href'], 1 );
			if ( isset( $dom_id_map[ $id ] ) ) {
				$attributes['href'] = '#' . $dom_id_map[ $id ];
			}
		}
		$block['attributes'] = $attributes;
	}

	private static function unique_id( $base, &$used, $max_length ) {
		$base = substr( $base, 0, $max_length );
		$id = $base;
		$suffix = 2;
		while ( isset( $used[ $id ] ) ) {
			$tail = '-' . $suffix++;
			$id = substr( $base, 0, $max_length - strlen( $tail ) ) . $tail;
		}
		$used[ $id ] = true;
		return $id;
	}

	private static function collect_used_ids( $block, &$block_ids, &$dom_ids ) {
		$block_ids[ $block['id'] ] = true;
		$attributes = self::to_array( isset( $block['attributes'] ) ? $block['attributes'] : array() );
		if ( isset( $attributes['id'] ) && is_string( $attributes['id'] ) ) {
			$dom_ids[ $attributes['id'] ] = true;
		}
		foreach ( $block['children'] as $child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				self::collect_used_ids( $child, $block_ids, $dom_ids );
			}
		}
	}

	private static function component_metrics( $block ) {
		$blocks = 1;
		$depth = 1;
		foreach ( $block['children'] as $child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				$child_metrics = self::component_metrics( $child );
				$blocks += $child_metrics['blocks'];
				$depth = max( $depth, 1 + $child_metrics['depth'] );
			}
		}
		return compact( 'blocks', 'depth' );
	}

	private static function failed_block( $block ) {
		$block['attributes']['class'] .= ' is-failed';
		$block['children'] = array( array( 'kind' => 'text', 'value' => self::FAILURE_MESSAGE ) );
		return $block;
	}

	private static function rewrite_style_tokens( &$style_set, $token_map ) {
		if ( empty( $style_set['token_bindings'] ) ) {
			return;
		}
		$bindings = self::to_array( $style_set['token_bindings'] );
		$mapped   = self::to_array( $style_set['mapped'] );
		foreach ( $bindings as $property => $reference ) {
			if ( ! isset( $token_map[ $reference ] ) ) {
				continue;
			}
			$old_value = 'var(' . Code_To_Block_Schema::design_token_css_name( $reference ) . ')';
			$bindings[ $property ] = $token_map[ $reference ];
			if ( isset( $mapped[ $property ] ) && $old_value === $mapped[ $property ] ) {
				$mapped[ $property ] = 'var(' . Code_To_Block_Schema::design_token_css_name( $token_map[ $reference ] ) . ')';
			}
		}
		$style_set['token_bindings'] = $bindings;
		$style_set['mapped'] = $mapped;
	}

	private static function deep_array( $value ) {
		return json_decode( wp_json_encode( $value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ), true );
	}

	private static function to_array( $value ) {
		return is_object( $value ) ? get_object_vars( $value ) : ( is_array( $value ) ? $value : array() );
	}

	private static function error( $code, $message, $status ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}
}
