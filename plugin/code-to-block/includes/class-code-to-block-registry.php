<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Server-side view of the deterministic element registry manifest.
 */
final class Code_To_Block_Registry {
	const VERSION = 1;

	/** @var array|null */
	private static $manifest = null;

	/**
	 * @return array
	 */
	public static function manifest() {
		if ( null !== self::$manifest ) {
			return self::$manifest;
		}
		$path = CODE_TO_BLOCK_PATH . 'includes/generated/control-registry.json';
		if ( ! file_exists( $path ) || ! is_readable( $path ) ) {
			self::$manifest = array( 'registry_version' => self::VERSION, 'elements' => array() );
			return self::$manifest;
		}
		$decoded = json_decode( (string) file_get_contents( $path ), true );
		if (
			! is_array( $decoded ) ||
			! isset( $decoded['registry_version'], $decoded['elements'] ) ||
			self::VERSION !== $decoded['registry_version'] ||
			! is_array( $decoded['elements'] )
		) {
			self::$manifest = array( 'registry_version' => self::VERSION, 'elements' => array() );
			return self::$manifest;
		}
		self::$manifest = $decoded;
		return self::$manifest;
	}

	/**
	 * @param string $element_id Element definition ID.
	 * @return array|null
	 */
	public static function get( $element_id ) {
		$manifest = self::manifest();
		return isset( $manifest['elements'][ $element_id ] ) && is_array( $manifest['elements'][ $element_id ] )
			? $manifest['elements'][ $element_id ]
			: null;
	}

	/**
	 * @param string $element_id Element definition ID.
	 * @return bool
	 */
	public static function exists( $element_id ) {
		return null !== self::get( $element_id );
	}

	/**
	 * @param string $element_id Element definition ID.
	 * @return array
	 */
	public static function capabilities( $element_id ) {
		$definition = self::get( $element_id );
		return null !== $definition && ! empty( $definition['capabilities'] ) && is_array( $definition['capabilities'] )
			? $definition['capabilities']
			: array();
	}

	/**
	 * @param string $element_id Element definition ID.
	 * @param string $capability Capability ID.
	 * @return bool
	 */
	public static function has_capability( $element_id, $capability ) {
		return in_array( $capability, self::capabilities( $element_id ), true );
	}

	/**
	 * @param string $element_id Element definition ID.
	 * @param string $tag HTML tag.
	 * @return bool
	 */
	public static function tag_is_allowed( $element_id, $tag ) {
		$definition = self::get( $element_id );
		if ( null === $definition || empty( $definition['allowedTags'] ) || ! is_array( $definition['allowedTags'] ) ) {
			return false;
		}
		return in_array( '*', $definition['allowedTags'], true ) || in_array( strtolower( $tag ), $definition['allowedTags'], true );
	}

	/**
	 * @param string $element_id Element definition ID.
	 * @param string $prop Property ID.
	 * @return bool
	 */
	public static function prop_is_allowed( $element_id, $prop ) {
		$definition = self::get( $element_id );
		return null !== $definition && ! empty( $definition['props'] ) && in_array( $prop, $definition['props'], true );
	}

	/**
	 * @param string $element_id Element definition ID.
	 * @param string $target Target ID.
	 * @return bool
	 */
	public static function target_is_allowed( $element_id, $target ) {
		$definition = self::get( $element_id );
		return null !== $definition && ! empty( $definition['targets'] ) && in_array( $target, $definition['targets'], true );
	}

	/**
	 * @param string $element_id Element definition ID.
	 * @param string $target Target ID.
	 * @return array
	 */
	public static function target_style_groups( $element_id, $target ) {
		$definition = self::get( $element_id );
		return null !== $definition &&
			! empty( $definition['targetStyleGroups'][ $target ] ) &&
			is_array( $definition['targetStyleGroups'][ $target ] )
			? $definition['targetStyleGroups'][ $target ]
			: array();
	}

	/**
	 * @param string $element_id Element definition ID.
	 * @param string $target Target ID.
	 * @return string
	 */
	public static function target_selector( $element_id, $target ) {
		$definition = self::get( $element_id );
		if ( null === $definition || empty( $definition['targetSelectors'][ $target ] ) || ! is_string( $definition['targetSelectors'][ $target ] ) ) {
			return '';
		}
		return $definition['targetSelectors'][ $target ];
	}

	/**
	 * @param string $element_id Element definition ID.
	 * @param string $state State ID.
	 * @return bool
	 */
	public static function state_is_allowed( $element_id, $state ) {
		$definition = self::get( $element_id );
		return null !== $definition && ! empty( $definition['states'] ) && in_array( $state, $definition['states'], true );
	}
}
