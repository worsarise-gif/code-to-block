import {
	getElementDefinition,
	inferElementDefinition,
} from './elements/registry.mjs';

export const DOCUMENT_SCHEMA_VERSION = 3;
export const REGISTRY_VERSION = 1;
export const CONTEXT_STATES = Object.freeze( [
	'hover',
	'focusVisible',
	'focus',
	'active',
	'visited',
	'disabled',
	'checked',
	'expanded',
	'selected',
	'invalid',
	'readOnly',
	'loading',
	'current',
	'expired',
] );
export const DEFAULT_BREAKPOINTS = Object.freeze( {
	desktop: {
		id: 'desktop',
		label: 'Desktop',
		maxWidth: null,
		inherits: null,
	},
	tablet: {
		id: 'tablet',
		label: 'Tablet',
		maxWidth: 768,
		inherits: 'desktop',
	},
	mobile: {
		id: 'mobile',
		label: 'Mobile',
		maxWidth: 390,
		inherits: 'tablet',
	},
} );

export function parseContextKey( key ) {
	const normalized = String( key || 'base' );
	if ( normalized === 'base' ) {
		return { key: 'base', breakpoint: 'desktop', state: 'default' };
	}
	let breakpoint = 'desktop';
	let state = 'default';
	for ( const segment of normalized.split( '|' ) ) {
		if ( segment.startsWith( 'bp:' ) ) breakpoint = segment.slice( 3 );
		else if ( segment.startsWith( 'state:' ) ) state = segment.slice( 6 );
		else return null;
	}
	if (
		! Object.hasOwn( DEFAULT_BREAKPOINTS, breakpoint ) ||
		( state !== 'default' && ! CONTEXT_STATES.includes( state ) )
	) {
		return null;
	}
	return { key: formatContextKey( breakpoint, state ), breakpoint, state };
}

export function formatContextKey( breakpoint = 'desktop', state = 'default' ) {
	const parts = [];
	if ( breakpoint !== 'desktop' ) parts.push( `bp:${ breakpoint }` );
	if ( state !== 'default' ) parts.push( `state:${ state }` );
	return parts.length ? parts.join( '|' ) : 'base';
}

export function canonicalize( value ) {
	if ( Array.isArray( value ) ) {
		return value.map( canonicalize );
	}
	if ( ! value || typeof value !== 'object' ) {
		return value;
	}
	const result = {};
	for ( const key of Object.keys( value ).sort() ) {
		const normalized = canonicalize( value[ key ] );
		const emptyObject =
			normalized &&
			typeof normalized === 'object' &&
			! Array.isArray( normalized ) &&
			Object.keys( normalized ).length === 0;
		if ( normalized === undefined || normalized === '' || emptyObject ) {
			continue;
		}
		result[ key ] = normalized;
	}
	return result;
}

export function validateBlockV3( block, path = '$.root', seen = new Set() ) {
	const errors = [];
	if ( ! block || typeof block !== 'object' || Array.isArray( block ) ) {
		return [ `${ path } must be an object.` ];
	}
	if ( typeof block.id !== 'string' || ! block.id.trim() )
		errors.push( `${ path }.id must be a non-empty string.` );
	else if ( seen.has( block.id ) )
		errors.push( `${ path }.id duplicates ${ block.id }.` );
	else seen.add( block.id );
	const definition = getElementDefinition( block.element );
	if (
		definition.id === 'legacy/html-node' &&
		block.element !== 'legacy/html-node'
	)
		errors.push( `${ path }.element is not registered.` );
	if ( block.definition_version !== definition.version )
		errors.push(
			`${ path }.definition_version must equal ${ definition.version }.`
		);
	if (
		! definition.allowedTags.includes( '*' ) &&
		! definition.allowedTags.includes( block.tag )
	)
		errors.push( `${ path }.tag is not valid for ${ definition.id }.` );
	for ( const [ targetId, targetValue ] of Object.entries(
		block.style?.targets || {}
	) ) {
		if (
			! definition.styleTargets.some(
				( target ) => target.id === targetId
			)
		)
			errors.push(
				`${ path }.style.targets.${ targetId } is not registered.`
			);
		for ( const contextKey of Object.keys( targetValue?.contexts || {} ) ) {
			if ( ! parseContextKey( contextKey ) )
				errors.push(
					`${ path }.style.targets.${ targetId }.contexts.${ contextKey } is invalid.`
				);
		}
	}
	for ( const [ index, child ] of ( block.children || [] ).entries() ) {
		if ( child?.kind === 'text' ) continue;
		errors.push(
			...validateBlockV3( child, `${ path }.children[${ index }]`, seen )
		);
	}
	return errors;
}

export function validateDocumentV3( document ) {
	const errors = [];
	if ( document?.schema_version !== DOCUMENT_SCHEMA_VERSION )
		errors.push( '$.schema_version must equal 3.' );
	if ( document?.registry_version !== REGISTRY_VERSION )
		errors.push( '$.registry_version must equal 1.' );
	if ( typeof document?.name !== 'string' || ! document.name.trim() )
		errors.push( '$.name must be a non-empty string.' );
	if ( ! document?.root ) errors.push( '$.root is required.' );
	else errors.push( ...validateBlockV3( document.root ) );
	return errors;
}

export function ensureElementIdentity( block ) {
	const inference = inferElementDefinition( block );
	return {
		...block,
		element: inference.definition.id,
		definition_version: inference.definition.version,
		props: block.props || {},
	};
}
