/**
 * Asset collection, URL analysis, and script extraction for imported code.
 *
 * Extracted from src/parser.js — behavior-neutral extraction. All function
 * signatures, bodies, outputs, and side effects remain identical.
 */

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

function attributesObject( element ) {
	return Object.fromEntries(
		[ ...element.attributes ].map( ( attribute ) => [
			attribute.name.toLowerCase(),
			attribute.value,
		] )
	);
}

function scriptPlacement( script, document ) {
	if ( script.closest( 'head' ) ) {
		return 'head';
	}
	const following = [ ...document.body.children ].filter(
		( element ) =>
			element !== script &&
			// compareDocumentPosition exposes relationships as a bitmask.
			// eslint-disable-next-line no-bitwise
			element.compareDocumentPosition( script ) &
				window.Node.DOCUMENT_POSITION_FOLLOWING
	);
	return following.length === 0 ? 'body-end' : 'body';
}

/**
 * Extracts script assets from a parsed HTML document.
 *
 * @param {Document} document    Parsed HTML document.
 * @param {string}   sessionId   Import session hash.
 * @param {Array}    diagnostics Mutable diagnostics array.
 * @return {Array} Script asset descriptors.
 */
export function extractScripts( document, sessionId, diagnostics ) {
	return [ ...document.querySelectorAll( 'script' ) ].map(
		( script, index ) => {
			const attributes = attributesObject( script );
			const src = String( script.getAttribute( 'src' ) || '' ).trim();
			if ( src && /^(?:https?:)?\/\//i.test( src ) ) {
				diagnostics.push(
					diagnostic(
						'warning',
						'EXTERNAL_SCRIPT_NOT_FETCHED',
						`External script was recorded without being fetched during import: ${ src }`,
						'script',
						script
					)
				);
			}
			return {
				id: `import-script-${ sessionId }-${ index + 1 }`,
				source_type: src ? 'external-script' : 'inline-script',
				placement: scriptPlacement( script, document ),
				type: attributes.type || 'text/javascript',
				source: src ? '' : script.textContent,
				...( src ? { src } : {} ),
				attributes,
				enabled_in_editor: false,
				enabled_in_preview: true,
				enabled_on_publish: true,
				execution_policy: 'preview-and-frontend',
				security_status: 'requires-trust',
				origin: 'imported',
			};
		}
	);
}

/**
 * Creates a standalone script asset descriptor for bare JavaScript input.
 *
 * @param {string} source    Script source text.
 * @param {string} sessionId Import session hash.
 * @param {number} index     Script index.
 * @return {Object} Script asset descriptor.
 */
export function standaloneScript( source, sessionId, index ) {
	return {
		id: `import-script-${ sessionId }-${ index + 1 }`,
		source_type: 'inline-script',
		placement: 'body-end',
		type: 'text/javascript',
		source,
		attributes: {},
		enabled_in_editor: false,
		enabled_in_preview: true,
		enabled_on_publish: true,
		execution_policy: 'preview-and-frontend',
		security_status: 'requires-trust',
		origin: 'imported',
	};
}

/**
 * Collects and classifies all URL references from DOM elements, CSS
 * `@import`/`url()`, and script src attributes.
 *
 * @param {Document} document    Parsed HTML document.
 * @param {Array}    stylesheets Stylesheet objects with PostCSS AST.
 * @param {Array}    scripts     Script asset descriptors.
 * @param {Array}    diagnostics Mutable diagnostics array.
 * @return {Array} URL reference descriptors.
 */
export function analyzeReferences(
	document,
	stylesheets,
	scripts,
	diagnostics
) {
	const references = [];
	for ( const element of document.querySelectorAll(
		'[href], [src], [srcset], [poster], [action], [formaction], [cite], [data]'
	) ) {
		for ( const name of [
			'href',
			'src',
			'srcset',
			'poster',
			'action',
			'formaction',
			'cite',
			'data',
		] ) {
			if ( ! element.hasAttribute( name ) ) {
				continue;
			}
			const value = element.getAttribute( name );
			const dangerous =
				/^\s*(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i.test(
					value
				);
			if ( dangerous ) {
				diagnostics.push(
					diagnostic(
						'warning',
						'UNSAFE_URL_BLOCKED',
						`Unsafe ${ name } URL was quarantined on <${ element.tagName.toLowerCase() }>.`,
						'html',
						element
					)
				);
			}
			references.push( {
				type: `${ element.tagName.toLowerCase() }.${ name }`,
				value,
				external: /^(?:https?:)?\/\//i.test( value ),
				blocked: dangerous,
			} );
		}
	}
	for ( const stylesheet of stylesheets ) {
		stylesheet.ast.walkAtRules( 'import', ( atRule ) => {
			const value = atRule.params.trim();
			const urlMatch = value.match(
				/^(?:url\(\s*)?(['"]?)(.*?)\1\s*\)?(?:\s|$)/i
			);
			const url = urlMatch?.[ 2 ] || value;
			references.push( {
				type: 'css.import',
				value: url,
				external: /^(?:https?:)?\/\//i.test( url ),
				blocked: true,
			} );
		} );
		stylesheet.ast.walkDecls( ( declaration ) => {
			for ( const match of declaration.value.matchAll(
				/url\(\s*(['"]?)(.*?)\1\s*\)/gi
			) ) {
				references.push( {
					type: 'css.url',
					value: match[ 2 ],
					external: /^(?:https?:)?\/\//i.test( match[ 2 ] ),
					blocked: /^\s*(?:javascript|vbscript)\s*:/i.test(
						match[ 2 ]
					),
				} );
			}
		} );
	}
	for ( const script of scripts ) {
		if ( script.src ) {
			references.push( {
				type: 'script.src',
				value: script.src,
				external: /^(?:https?:)?\/\//i.test( script.src ),
				blocked:
					! /^(?:https?:)?\/\//i.test( script.src ) &&
					/^[a-z][a-z0-9+.-]*:/i.test( script.src ),
			} );
		}
	}
	const hasBase = Boolean( document.querySelector( 'base[href]' ) );
	if (
		! hasBase &&
		references.some(
			( reference ) =>
				! reference.blocked &&
				! reference.external &&
				! /^(?:#|data:|blob:|mailto:|tel:|\/\/)/i.test(
					reference.value
				)
		)
	) {
		diagnostics.push(
			diagnostic(
				'warning',
				'RELATIVE_ASSET_BASE_UNKNOWN',
				'Relative asset URLs were preserved because the pasted source has no base URL.',
				'asset'
			)
		);
	}
	return references;
}

/**
 * Reports diagnostics for duplicate HTML IDs in the document.
 *
 * @param {Document} document    Parsed HTML document.
 * @param {Array}    diagnostics Mutable diagnostics array.
 */
export function duplicateIdDiagnostics( document, diagnostics ) {
	const ids = new Map();
	for ( const element of document.querySelectorAll( '[id]' ) ) {
		ids.set( element.id, [ ...( ids.get( element.id ) || [] ), element ] );
	}
	for ( const [ id, elements ] of ids ) {
		if ( elements.length > 1 ) {
			diagnostics.push(
				diagnostic(
					'warning',
					'DUPLICATE_HTML_ID',
					`HTML id "${ id }" occurs ${ elements.length } times and was preserved unchanged.`,
					'html',
					elements[ 0 ]
				)
			);
		}
	}
}
