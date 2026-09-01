import {
	DEFAULT_BREAKPOINTS,
	formatContextKey,
	parseContextKey,
} from '../schema-v3.mjs';

const STATE_FALLBACKS = Object.freeze( {
	focusVisible: [ 'focusVisible', 'focus', 'default' ],
	readOnly: [ 'readOnly', 'default' ],
	loading: [ 'loading', 'disabled', 'default' ],
} );

function contextsFor( block, targetId ) {
	return block?.style?.targets?.[ targetId ]?.contexts || {};
}

export function contextCascade( contextKey ) {
	const parsed = parseContextKey( contextKey );
	if ( ! parsed ) return [];
	const breakpoints = [];
	let breakpoint = parsed.breakpoint;
	while ( breakpoint ) {
		breakpoints.unshift( breakpoint );
		breakpoint = DEFAULT_BREAKPOINTS[ breakpoint ]?.inherits || null;
	}
	const states = STATE_FALLBACKS[ parsed.state ] || [
		parsed.state,
		'default',
	];
	const keys = [];
	for ( const currentBreakpoint of breakpoints ) {
		keys.push( formatContextKey( currentBreakpoint, 'default' ) );
	}
	for ( const currentState of states.slice().reverse() ) {
		if ( currentState === 'default' ) continue;
		for ( const currentBreakpoint of breakpoints ) {
			keys.push( formatContextKey( currentBreakpoint, currentState ) );
		}
	}
	return [ ...new Set( keys ) ];
}

export function resolveStyleContext(
	block,
	targetId = 'root',
	contextKey = 'base',
	layers = {}
) {
	const declarations = {};
	const sources = {};
	const apply = ( values, source ) => {
		for ( const [ property, value ] of Object.entries( values || {} ) ) {
			if ( value === '' || value === null || value === undefined )
				continue;
			declarations[ property ] = value;
			sources[ property ] = source;
		}
	};
	apply( layers.definition, 'definition' );
	apply( layers.global, 'global' );
	for ( const preset of layers.groupPresets || [] )
		apply( preset, 'groupPreset' );
	apply( layers.elementPreset, 'elementPreset' );
	const contexts = contextsFor( block, targetId );
	for ( const key of contextCascade( contextKey ) ) {
		apply( contexts[ key ]?.declarations, key === 'base' ? 'local' : key );
	}
	return { declarations, sources, contextKey, targetId };
}

function prune( block, targetId, contextKey ) {
	const context =
		block.style?.targets?.[ targetId ]?.contexts?.[ contextKey ];
	if (
		context &&
		! Object.keys( context.declarations || {} ).length &&
		! context.custom_declarations
	) {
		delete block.style.targets[ targetId ].contexts[ contextKey ];
	}
	if (
		block.style?.targets?.[ targetId ] &&
		! Object.keys( block.style.targets[ targetId ].contexts || {} ).length
	) {
		delete block.style.targets[ targetId ];
	}
}

export function setStyleDeclaration(
	sourceBlock,
	targetId,
	contextKey,
	property,
	value
) {
	const block = JSON.parse( JSON.stringify( sourceBlock ) );
	block.style ||= { targets: {} };
	block.style.targets ||= {};
	block.style.targets[ targetId ] ||= { contexts: {} };
	block.style.targets[ targetId ].contexts ||= {};
	block.style.targets[ targetId ].contexts[ contextKey ] ||= {
		declarations: {},
	};
	block.style.targets[ targetId ].contexts[ contextKey ].declarations ||= {};
	if ( value === '' || value === null || value === undefined )
		delete block.style.targets[ targetId ].contexts[ contextKey ]
			.declarations[ property ];
	else
		block.style.targets[ targetId ].contexts[ contextKey ].declarations[
			property
		] = value;
	prune( block, targetId, contextKey );
	return block;
}

export function clearStyleContext( sourceBlock, targetId, contextKey ) {
	const block = JSON.parse( JSON.stringify( sourceBlock ) );
	if ( block.style?.targets?.[ targetId ]?.contexts?.[ contextKey ] ) {
		delete block.style.targets[ targetId ].contexts[ contextKey ];
		prune( block, targetId, contextKey );
	}
	return block;
}
