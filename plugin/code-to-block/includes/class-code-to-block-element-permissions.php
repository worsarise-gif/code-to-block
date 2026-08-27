<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Enforces per-element roles, capabilities, and locks against the last saved tree.
 */
final class Code_To_Block_Element_Permissions {
	/**
	 * @param array $existing Last saved canonical document.
	 * @param array $incoming Incoming canonical document.
	 * @return true|WP_Error
	 */
	public static function validate_update( $existing, $incoming ) {
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}
		$old_blocks = array();
		$new_blocks = array();
		self::index_blocks( $existing['root'], '', $old_blocks );
		self::index_blocks( $incoming['root'], '', $new_blocks );
		$roles = self::current_roles();

		foreach ( $old_blocks as $block_id => $old_entry ) {
			$old_block = $old_entry['block'];
			$new_entry = isset( $new_blocks[ $block_id ] ) ? $new_blocks[ $block_id ] : null;
			$permissions = isset( $old_block['permissions'] ) && is_array( $old_block['permissions'] )
				? $old_block['permissions']
				: array();
			$changed = null === $new_entry || self::entry_changed( $old_entry, $new_entry );

			if ( null !== $new_entry && self::permissions_changed( $old_block, $new_entry['block'] ) ) {
				return self::error( $block_id, 'Only an administrator can change element permissions.' );
			}
			if ( ! $changed || empty( $permissions ) ) {
				continue;
			}

			if ( ! empty( $permissions['locked'] ) ) {
				return self::error( $block_id, 'This element is locked.' );
			}
			$owner_role = isset( $permissions['role'] ) ? $permissions['role'] : '';
			if ( '' !== $owner_role && ! in_array( $owner_role, $roles, true ) ) {
				return self::error( $block_id, 'Your role cannot change this element.' );
			}
			if ( null === $new_entry && isset( $permissions['can_delete'] ) && false === $permissions['can_delete'] ) {
				return self::error( $block_id, 'Your role cannot delete this element.' );
			}
			if ( null !== $new_entry && isset( $permissions['can_edit'] ) && false === $permissions['can_edit'] ) {
				return self::error( $block_id, 'Your role cannot edit or move this element.' );
			}
			if ( isset( $permissions['can_publish'] ) && false === $permissions['can_publish'] ) {
				return self::error( $block_id, 'Your role cannot publish changes to this element.' );
			}
		}

		foreach ( $new_blocks as $block_id => $new_entry ) {
			if ( ! isset( $old_blocks[ $block_id ] ) && ! empty( $new_entry['block']['permissions'] ) ) {
				return self::error( $block_id, 'Only an administrator can assign element permissions.' );
			}
		}

		return true;
	}

	private static function index_blocks( $block, $parent_id, &$index ) {
		$index[ $block['id'] ] = array(
			'block'  => $block,
			'parent' => $parent_id,
		);
		foreach ( isset( $block['children'] ) ? $block['children'] : array() as $child ) {
			if ( is_array( $child ) && ! isset( $child['kind'] ) ) {
				self::index_blocks( $child, $block['id'], $index );
			}
		}
	}

	private static function entry_changed( $old_entry, $new_entry ) {
		return
			$old_entry['parent'] !== $new_entry['parent'] ||
			wp_json_encode( $old_entry['block'] ) !== wp_json_encode( $new_entry['block'] );
	}

	private static function permissions_changed( $old_block, $new_block ) {
		$old = isset( $old_block['permissions'] ) ? $old_block['permissions'] : array();
		$new = isset( $new_block['permissions'] ) ? $new_block['permissions'] : array();
		return wp_json_encode( $old ) !== wp_json_encode( $new );
	}

	private static function current_roles() {
		if ( ! function_exists( 'wp_get_current_user' ) ) {
			return array();
		}
		$user = wp_get_current_user();
		return isset( $user->roles ) ? (array) $user->roles : array();
	}

	private static function error( $block_id, $message ) {
		$status = function_exists( 'rest_authorization_required_code' ) ? rest_authorization_required_code() : 403;
		return new WP_Error(
			'code_to_block_element_permission_denied',
			$message,
			array(
				'status'   => $status,
				'block_id' => $block_id,
			)
		);
	}
}
