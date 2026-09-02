/**
 * CSS selector scoping and stylesheet inventory for imported code.
 *
 * Extracted from src/parser.js — behavior-neutral extraction. All function
 * signatures, bodies, outputs, and side effects remain identical.
 */

import postcss from 'postcss';
import safeParser from 'postcss-safe-parser';
import selectorParser from 'postcss-selector-parser';

export const IMPORT_SCOPE_CLASS = 'ctb-import-scope';

const DYNAMIC_PSEUDO_NAMES = new Set( [
	':active',
	':checked',
	':disabled',
	':enabled',
	':focus',
	':focus-visible',
	':focus-within',
	':hover',
	':invalid',
	':link',
	':target',
	':valid',
	':visited',
] );

const KEYFRAME_AT_RULES = new Set( [ 'keyframes', '-webkit-keyframes' ] );

function diagnostic( severity, code, message, source, node ) {
	return {
		severity,
		code,
		message,
		...( source ? { source } : {} ),
		...( node?.source?.start
			? {
					line: node.source.start.line,
					column: node.source.start.column,
			  }
			: {} ),
	};
}

export function isKeyframeRule( rule ) {
	let parent = rule.parent;
	while ( parent ) {
		if (
			parent.type === 'atrule' &&
			KEYFRAME_AT_RULES.has( parent.name.toLowerCase() )
		) {
			return true;
		}
		parent = parent.parent;
	}
	return false;
}

function isRootNode( node ) {
	return (
		( node.type === 'tag' &&
			[ 'html', 'body' ].includes( node.value.toLowerCase() ) ) ||
		( node.type === 'pseudo' && node.value.toLowerCase() === ':root' )
	);
}

function rootClassNode() {
	return selectorParser.className( { value: IMPORT_SCOPE_CLASS } );
}

function removeRedundantDocumentRoots( selector ) {
	let foundRoot = false;
	for ( const node of [ ...selector.nodes ] ) {
		if ( isRootNode( node ) ) {
			if ( ! foundRoot ) {
				node.replaceWith( rootClassNode() );
				foundRoot = true;
			} else {
				const previous = node.prev();
				if ( previous?.type === 'combinator' ) {
					previous.remove();
				}
				node.remove();
			}
		}
	}
	return foundRoot;
}

function addScopeToSelector( selector ) {
	if ( removeRedundantDocumentRoots( selector ) ) {
		return [ selector ];
	}
	const descendant = selector.clone();
	descendant.prepend( selectorParser.combinator( { value: ' ' } ) );
	descendant.prepend( rootClassNode() );

	const self = selector.clone();
	const insertionPoint = self.nodes.find(
		( node ) => node.type === 'combinator'
	);
	if ( insertionPoint ) {
		self.insertBefore( insertionPoint, rootClassNode() );
	} else {
		self.append( rootClassNode() );
	}
	return [ self, descendant ];
}

/**
 * Parses imported CSS, quarantines unsafe declarations, and scopes all
 * non-keyframe selectors under the import scope class.
 *
 * @param {string} css         Raw CSS source.
 * @param {Array}  diagnostics Mutable diagnostics array.
 * @return {{ root: Object, css: string }} Parsed AST root and scoped CSS string.
 */
export function scopeImportedCss( css, diagnostics = [] ) {
	let root;
	try {
		root = postcss.parse( css, { from: 'imported.css' } );
	} catch ( error ) {
		diagnostics.push(
			diagnostic(
				'warning',
				'CSS_PARSE_RECOVERED',
				`CSS syntax was recovered and preserved where possible: ${
					error.reason || error.message
				}`,
				'css',
				error
			)
		);
		root = safeParser( css, { from: 'imported.css' } );
	}

	const scopedRoot = root.clone();
	scopedRoot.walkAtRules( 'import', ( atRule ) => {
		diagnostics.push(
			diagnostic(
				'warning',
				'CSS_IMPORT_QUARANTINED',
				`@import ${ atRule.params } was retained as a reference but not loaded because its selectors cannot be scoped safely.`,
				'css',
				atRule
			)
		);
		atRule.remove();
	} );
	scopedRoot.walkDecls( ( declaration ) => {
		if (
			/^(?:behavior|-moz-binding)$/i.test( declaration.prop ) ||
			/(?:expression\s*\(|javascript\s*:|\<\s*\/\s*style)/i.test(
				declaration.value
			)
		) {
			diagnostics.push(
				diagnostic(
					'warning',
					'UNSAFE_CSS_DECLARATION_BLOCKED',
					`${ declaration.prop } was quarantined from rendered CSS.`,
					'css',
					declaration
				)
			);
			declaration.remove();
		}
	} );

	scopedRoot.walkRules( ( rule ) => {
		if ( isKeyframeRule( rule ) ) {
			return;
		}
		try {
			const scopedSelectors = [];
			selectorParser( ( selectors ) => {
				selectors.each( ( selector ) => {
					for ( const scoped of addScopeToSelector( selector ) ) {
						scopedSelectors.push( scoped.toString() );
					}
				} );
			} ).processSync( rule.selector );
			rule.selector = [ ...new Set( scopedSelectors ) ].join( ', ' );
		} catch {
			diagnostics.push(
				diagnostic(
					'warning',
					'SELECTOR_NOT_RENDERED',
					`Selector was preserved as source but could not be safely scoped: ${ rule.selector }`,
					'css',
					rule
				)
			);
			rule.remove();
		}
	} );
	return { root, css: scopedRoot.toString() };
}

/**
 * Strips dynamic pseudo-classes and pseudo-elements from a selector for
 * static DOM matching.
 *
 * @param {string} selector CSS selector string.
 * @return {string} Selector suitable for element.matches().
 */
export function selectorForStaticMatching( selector ) {
	return selectorParser( ( selectors ) => {
		selectors.walkPseudos( ( pseudo ) => {
			const name = pseudo.value.toLowerCase();
			if (
				name.startsWith( '::' ) ||
				[ ':before', ':after' ].includes( name )
			) {
				pseudo.remove();
			} else if ( DYNAMIC_PSEUDO_NAMES.has( name ) ) {
				pseudo.remove();
			}
		} );
	} ).processSync( selector );
}

/**
 * Inventories a parsed CSS AST's selectors, media conditions, keyframes,
 * and custom properties.
 *
 * @param {Object} root PostCSS root AST.
 * @return {Object} Deduplicated inventory.
 */
export function inventoryStylesheet( root ) {
	const selectors = [];
	const mediaConditions = [];
	const keyframes = [];
	const customProperties = [];
	root.walkRules( ( rule ) => {
		if ( ! isKeyframeRule( rule ) ) {
			selectors.push( ...rule.selectors );
		}
	} );
	root.walkAtRules( ( atRule ) => {
		const name = atRule.name.toLowerCase();
		if ( name === 'media' ) {
			mediaConditions.push( atRule.params );
		} else if ( KEYFRAME_AT_RULES.has( name ) ) {
			keyframes.push( atRule.params );
		}
	} );
	root.walkDecls( ( declaration ) => {
		if ( declaration.prop.startsWith( '--' ) ) {
			customProperties.push( declaration.prop );
		}
	} );
	return {
		selectors: [ ...new Set( selectors ) ],
		media_conditions: [ ...new Set( mediaConditions ) ],
		keyframes: [ ...new Set( keyframes ) ],
		custom_properties: [ ...new Set( customProperties ) ],
	};
}

/**
 * Adds the import scope class to a block's class attribute.
 *
 * @param {Object} attributes Mutable attributes object.
 */
export function addScopeClass( attributes ) {
	const classes = String( attributes.class || '' )
		.split( /\s+/ )
		.filter( Boolean );
	if ( ! classes.includes( IMPORT_SCOPE_CLASS ) ) {
		classes.push( IMPORT_SCOPE_CLASS );
	}
	attributes.class = classes.join( ' ' );
}
