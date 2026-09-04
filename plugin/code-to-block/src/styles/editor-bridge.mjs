import { resolveElementDefinition } from '../elements/registry.mjs';
import { formatContextKey, parseContextKey } from '../schema-v3.mjs';
import { contextCascade } from './context.mjs';

const EMPTY_STYLE_SET = Object.freeze( {
	mapped: Object.freeze( {} ),
	custom_css_fallback: '',
} );

function clone( value ) {
	return JSON.parse( JSON.stringify( value ) );
}

function normalizeStyleSet( styleSet ) {
	const normalized = {
		mapped: { ...( styleSet?.mapped || {} ) },
		custom_css_fallback: String(
			styleSet?.custom_css_fallback || ''
		).trim(),
	};
	for ( const key of [
		'token_bindings',
		'role_bindings',
		'import_review_flags',
	] ) {
		if ( Object.keys( styleSet?.[ key ] || {} ).length ) {
			normalized[ key ] = clone( styleSet[ key ] );
		}
	}
	if ( styleSet?.origin_notes !== undefined ) {
		normalized.origin_notes = clone( styleSet.origin_notes );
	}
	return normalized;
}

function contextToStyleSet( context ) {
	return normalizeStyleSet( {
		mapped: context?.declarations,
		custom_css_fallback: context?.custom_declarations,
		token_bindings: context?.token_bindings,
		role_bindings: context?.role_bindings,
		origin_notes: context?.origin_notes,
	} );
}

function styleSetToContext( styleSet ) {
	const normalized = normalizeStyleSet( styleSet );
	const context = {};
	if ( Object.keys( normalized.mapped ).length ) {
		context.declarations = normalized.mapped;
	}
	if ( normalized.custom_css_fallback ) {
		context.custom_declarations = normalized.custom_css_fallback;
	}
	for ( const key of [ 'token_bindings', 'role_bindings' ] ) {
		if ( Object.keys( normalized[ key ] || {} ).length ) {
			context[ key ] = clone( normalized[ key ] );
		}
	}
	if ( normalized.origin_notes !== undefined ) {
		context.origin_notes = clone( normalized.origin_notes );
	}
	return context;
}

function canonicalContextKey( contextKey ) {
	return parseContextKey( contextKey )?.key || '';
}

function legacyStateName( state ) {
	if ( state === 'focusVisible' ) {
		return 'focus';
	}
	return [ 'hover', 'focus', 'active' ].includes( state ) ? state : '';
}

function legacyRootStyleSet( block, contextKey ) {
	const parsed = parseContextKey( contextKey );
	if ( ! parsed ) {
		return EMPTY_STYLE_SET;
	}
	if ( parsed.state === 'default' ) {
		return parsed.breakpoint === 'desktop'
			? block.styles || EMPTY_STYLE_SET
			: block.responsive_overrides?.[ parsed.breakpoint ] ||
					EMPTY_STYLE_SET;
	}
	if ( parsed.breakpoint !== 'desktop' ) {
		return EMPTY_STYLE_SET;
	}
	const state = legacyStateName( parsed.state );
	return state ? block.states?.[ state ] || EMPTY_STYLE_SET : EMPTY_STYLE_SET;
}

function styleSetIsEmpty( styleSet ) {
	return (
		Object.keys( styleSet?.mapped || {} ).length === 0 &&
		Object.keys( styleSet?.token_bindings || {} ).length === 0 &&
		Object.keys( styleSet?.role_bindings || {} ).length === 0 &&
		styleSet?.origin_notes === undefined &&
		! String( styleSet?.custom_css_fallback || '' ).trim()
	);
}

function writeLegacyRootStyleSet( block, contextKey, styleSet ) {
	const parsed = parseContextKey( contextKey );
	if ( ! parsed ) {
		return;
	}
	const normalized = normalizeStyleSet( styleSet );
	if ( parsed.state === 'default' ) {
		if ( parsed.breakpoint === 'desktop' ) {
			block.styles = normalized;
			return;
		}
		block.responsive_overrides ||= {};
		if ( styleSetIsEmpty( normalized ) ) {
			delete block.responsive_overrides[ parsed.breakpoint ];
			if ( ! Object.keys( block.responsive_overrides ).length ) {
				delete block.responsive_overrides;
			}
		} else {
			block.responsive_overrides[ parsed.breakpoint ] = normalized;
		}
		return;
	}
	if ( parsed.breakpoint !== 'desktop' ) {
		return;
	}
	const state = legacyStateName( parsed.state );
	if ( ! state ) {
		return;
	}
	block.states ||= {};
	if ( styleSetIsEmpty( normalized ) ) {
		delete block.states[ state ];
		if ( ! Object.keys( block.states ).length ) {
			delete block.states;
		}
	} else {
		block.states[ state ] = normalized;
	}
}

export function contextKeyForBreakpoint( breakpoint = 'desktop' ) {
	return formatContextKey( breakpoint, 'default' );
}

export function targetContextIsAllowed( block, targetId, contextKey ) {
	const parsed = parseContextKey( contextKey );
	if ( ! parsed || ( targetId !== 'root' && ! block?.element ) ) {
		return false;
	}
	const definition = resolveElementDefinition( block );
	if (
		! definition.styleTargets.some( ( target ) => target.id === targetId )
	) {
		return false;
	}
	return (
		parsed.state === 'default' || definition.states.includes( parsed.state )
	);
}

export function readTargetStyleSet(
	block,
	targetId = 'root',
	contextKey = 'base'
) {
	contextKey = canonicalContextKey( contextKey );
	if ( ! contextKey ) {
		return normalizeStyleSet( EMPTY_STYLE_SET );
	}
	const contexts = block?.style?.targets?.[ targetId ]?.contexts;
	if ( contexts && Object.hasOwn( contexts, contextKey ) ) {
		const styleSet = contextToStyleSet( contexts[ contextKey ] );
		const legacyStyleSet =
			targetId === 'root'
				? legacyRootStyleSet( block, contextKey )
				: EMPTY_STYLE_SET;
		if ( Object.keys( legacyStyleSet.import_review_flags || {} ).length ) {
			styleSet.import_review_flags = clone(
				legacyStyleSet.import_review_flags
			);
		}
		return styleSet;
	}
	return targetId === 'root'
		? normalizeStyleSet( legacyRootStyleSet( block, contextKey ) )
		: normalizeStyleSet( EMPTY_STYLE_SET );
}

function mergeStyleSetField( block, targetId, contextKey, field ) {
	const merged = {};
	for ( const key of contextCascade( contextKey ) ) {
		Object.assign(
			merged,
			readTargetStyleSet( block, targetId, key )[ field ]
		);
	}
	return merged;
}

export function inheritedTargetMappedStyles(
	block,
	targetId = 'root',
	contextKey = 'base'
) {
	const currentKey = parseContextKey( contextKey )?.key;
	const inherited = {};
	for ( const key of contextCascade( contextKey ) ) {
		if ( key !== currentKey ) {
			Object.assign(
				inherited,
				readTargetStyleSet( block, targetId, key ).mapped
			);
		}
	}
	return inherited;
}

export function effectiveTargetMappedStyles(
	block,
	targetId = 'root',
	contextKey = 'base'
) {
	return mergeStyleSetField( block, targetId, contextKey, 'mapped' );
}

export function effectiveTargetTokenBindings(
	block,
	targetId = 'root',
	contextKey = 'base'
) {
	return mergeStyleSetField( block, targetId, contextKey, 'token_bindings' );
}

/**
 * Mutates a cloned block to keep the v3 context authoritative while preserving
 * the legacy root locations used by the compatibility editor and preview.
 *
 * @param {Object} block      Block from an already-cloned document.
 * @param {string} targetId   Registered style target.
 * @param {string} contextKey Canonical breakpoint/state context.
 * @param {Object} styleSet   Legacy-shaped editor style set.
 */
export function writeTargetStyleSet( block, targetId, contextKey, styleSet ) {
	contextKey = canonicalContextKey( contextKey );
	if ( ! contextKey ) {
		return;
	}
	const context = styleSetToContext( styleSet );
	const existingContext =
		block?.style?.targets?.[ targetId ]?.contexts?.[ contextKey ];
	if (
		context.origin_notes === undefined &&
		existingContext?.origin_notes !== undefined
	) {
		context.origin_notes = clone( existingContext.origin_notes );
	}
	block.style ||= { targets: {} };
	block.style.targets ||= {};
	block.style.targets[ targetId ] ||= { contexts: {} };
	block.style.targets[ targetId ].contexts ||= {};
	if ( Object.keys( context ).length ) {
		block.style.targets[ targetId ].contexts[ contextKey ] = context;
	} else {
		delete block.style.targets[ targetId ].contexts[ contextKey ];
		if (
			! Object.keys( block.style.targets[ targetId ].contexts ).length
		) {
			delete block.style.targets[ targetId ];
		}
	}
	if ( targetId === 'root' ) {
		writeLegacyRootStyleSet( block, contextKey, styleSet );
	}
}
