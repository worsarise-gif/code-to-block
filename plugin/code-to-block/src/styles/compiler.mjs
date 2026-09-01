import { DEFAULT_BREAKPOINTS, parseContextKey } from '../schema-v3.mjs';
import { resolveElementDefinition } from '../elements/registry.mjs';

const STATE_SELECTORS = Object.freeze( {
	hover: ':hover',
	focusVisible: ':focus-visible',
	focus: ':focus',
	active: ':active',
	visited: ':visited',
	disabled: ':disabled,[aria-disabled="true"]',
	checked: ':checked,[aria-checked="true"]',
	expanded: '[aria-expanded="true"],[open]',
	selected: '[aria-selected="true"]',
	invalid: ':invalid,[aria-invalid="true"]',
	readOnly: ':read-only,[aria-readonly="true"]',
	loading: '[aria-busy="true"],[data-ctb-loading="true"]',
	current: '[aria-current="page"],[aria-current="true"]',
	expired: '[data-ctb-expired="true"]',
} );

export function stableElementHash( id ) {
	let hash = 2166136261;
	for ( const character of String( id || '' ) ) {
		hash ^= character.codePointAt( 0 );
		hash = Math.imul( hash, 16777619 );
	}
	return ( hash >>> 0 ).toString( 16 ).padStart( 8, '0' );
}

export function stableElementClass( id ) {
	return `ctb-e-${ stableElementHash( id ) }`;
}

function declarationText( declarations ) {
	return Object.entries( declarations || {} )
		.filter(
			( [ property, value ] ) =>
				/^[a-z-]+$/.test( property ) &&
				value !== '' &&
				value !== null &&
				value !== undefined
		)
		.sort( ( [ a ], [ b ] ) => a.localeCompare( b ) )
		.map(
			( [ property, value ] ) =>
				`${ property }:${ String( value )
					.trim()
					.replace( /\s*!important\s*$/i, '' ) };`
		)
		.join( '' );
}

function targetSelector( block, targetId, pageId ) {
	const definition = resolveElementDefinition( block );
	const target = definition.styleTargets.find(
		( item ) => item.id === targetId
	);
	const root = `:where(#ctb-page-${
		Number( pageId ) || 0
	}) .${ stableElementClass( block.id ) }`;
	if ( ! target || target.id === 'root' || target.selector === '&' )
		return root;
	return `${ root } > ${ target.selector }`;
}

function selectorForState( selector, state ) {
	if ( state === 'default' ) return selector;
	const suffix = STATE_SELECTORS[ state ];
	if ( ! suffix ) return selector;
	if ( suffix.includes( ',' ) ) {
		return suffix
			.split( ',' )
			.map( ( item ) => `${ selector }${ item }` )
			.join( ',' );
	}
	return `${ selector }${ suffix }`;
}

function contextWeight( key ) {
	const parsed = parseContextKey( key );
	if ( ! parsed ) return 999;
	const breakpointWeight =
		parsed.breakpoint === 'desktop'
			? 0
			: parsed.breakpoint === 'tablet'
			? 10
			: 20;
	const stateWeight = parsed.state === 'default' ? 0 : 100;
	return breakpointWeight + stateWeight;
}

function wrapMedia( css, breakpoint ) {
	const maxWidth = DEFAULT_BREAKPOINTS[ breakpoint ]?.maxWidth;
	return maxWidth ? `@media(max-width:${ maxWidth }px){${ css }}` : css;
}

export function compileBlockStyles( block, pageId, options = {} ) {
	if ( block?.style?.targets ) {
		const rules = [];
		const debug = [];
		for ( const [ targetId, targetValue ] of Object.entries(
			block.style.targets
		).sort( ( [ a ], [ b ] ) => a.localeCompare( b ) ) ) {
			const selector = targetSelector( block, targetId, pageId );
			for ( const [ contextKey, styleSet ] of Object.entries(
				targetValue?.contexts || {}
			).sort(
				( [ a ], [ b ] ) =>
					contextWeight( a ) - contextWeight( b ) ||
					a.localeCompare( b )
			) ) {
				const parsed = parseContextKey( contextKey );
				if ( ! parsed ) continue;
				const declarations = declarationText( styleSet.declarations );
				const custom = String(
					styleSet.custom_declarations || ''
				).trim();
				if ( ! declarations && ! custom ) continue;
				const stateSelector = selectorForState(
					selector,
					parsed.state
				);
				const rule = `${ stateSelector }{${ declarations }${ custom }}`;
				rules.push( wrapMedia( rule, parsed.breakpoint ) );
				debug.push( {
					blockId: block.id,
					targetId,
					contextKey,
					selector: stateSelector,
				} );
			}
		}
		for ( const breakpoint of [ 'desktop', 'tablet', 'mobile' ] ) {
			if ( block.advanced?.visibility?.[ breakpoint ] === false ) {
				const hidden = `${ targetSelector(
					block,
					'root',
					pageId
				) }{display:none!important;}`;
				rules.push( wrapMedia( hidden, breakpoint ) );
			}
		}
		return { css: rules.join( '\n' ), debug };
	}
	if ( options.legacyCompiler )
		return options.legacyCompiler( block, pageId );
	return { css: '', debug: [] };
}

export function compileDocumentStyles( document, pageId, options = {} ) {
	const rules = [];
	const debug = [];
	function visit( block ) {
		const compiled = compileBlockStyles( block, pageId, options );
		if ( compiled.css ) rules.push( compiled.css );
		debug.push( ...compiled.debug );
		for ( const child of block.children || [] ) {
			if ( child?.kind !== 'text' ) visit( child );
		}
	}
	visit( document.root );
	return {
		css: rules.join( '\n' ),
		debug,
	};
}
