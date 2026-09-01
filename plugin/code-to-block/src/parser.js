import postcss from 'postcss';
import safeParser from 'postcss-safe-parser';
import selectorParser from 'postcss-selector-parser';
import { calculate } from 'specificity';

import { blockTypeFor } from './block-type.mjs';
import { splitResolvedStyles } from './custom-css.mjs';
import {
	sanitizeElementAttributes,
	SUPPORTED_HTML_TAGS,
} from './html-policy.mjs';
import { extractPhpSnippets } from './php-snippets.mjs';

const MAX_IMPORT_LENGTH = 2 * 1024 * 1024;
const MAX_BLOCKS = 1000;
const MAX_DEPTH = 50;
const MAX_SELECTORS = 2000;
const MAX_CSS_MAPPING_DECLARATIONS = 1000;
const IMPORT_SCOPE_CLASS = 'ctb-import-scope';
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
const COLOR_VALUE =
	/^(?:#[0-9a-f]{3,8}|(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\()/i;
const SIZE_VALUE =
	/^-?(?:\d+|\d*\.\d+)(?:px|rem|em|vw|vh|vmin|vmax|%|ch|ex|cm|mm|in|pt|pc)$/i;

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

function sourceHash( source ) {
	let hash = 2166136261;
	for ( let index = 0; index < source.length; index++ ) {
		// FNV-1a is intentionally a 32-bit hash.
		// eslint-disable-next-line no-bitwise
		hash ^= source.charCodeAt( index );
		hash = Math.imul( hash, 16777619 );
	}
	// eslint-disable-next-line no-bitwise
	return ( hash >>> 0 ).toString( 36 );
}

function wholeCodeFence( source ) {
	const match = source.match(
		/^\s*```(html|css|javascript|js|php)?\s*\n([\s\S]*?)\n```\s*$/i
	);
	return match
		? {
				language: String( match[ 1 ] || '' ).toLowerCase(),
				source: match[ 2 ],
		  }
		: null;
}

function stripWholeCodeFence( source ) {
	return wholeCodeFence( source )?.source || source;
}

function looksLikeStandaloneCss( source ) {
	return (
		/(?:^|})\s*(?:@(?:media|supports|container|font-face|keyframes)\b|[^{};]+)\s*\{[\s\S]*\}\s*$/i.test(
			source
		) &&
		/(?:^|[;{])\s*(?:--[a-z0-9_-]+|-?[a-z][a-z0-9-]*)\s*:/i.test( source )
	);
}

function looksLikeStandaloneJavaScript( source ) {
	return /(?:^|[;{}\n])\s*(?:import\s|export\s|(?:const|let|var|class|function)\s+[A-Za-z_$]|document\.|window\.|console\.|[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(?:addEventListener|querySelector|getElementById|alert|setTimeout|setInterval|fetch)\s*\()/m.test(
		source
	);
}

/**
 * Conservatively classifies a unified import before DOM parsing. Tag-based
 * HTML remains authoritative; bare CSS/JS is only recognized when the source
 * is fenced or contains language-specific syntax.
 *
 * @param {string} rawSource Source pasted into the importer.
 * @return {Object} Detected source characteristics.
 */
export function detectImportedCode( rawSource ) {
	const raw = String( rawSource || '' ).replace( /\r\n?/g, '\n' );
	const fence = wholeCodeFence( raw );
	const source = fence?.source || raw;
	const fenceLanguage =
		fence?.language === 'js' ? 'javascript' : fence?.language || '';
	const fullDocument = /<!doctype\s+html|<html\b|<head\b|<body\b/i.test(
		source
	);
	const hasHtml =
		fullDocument ||
		/<(?:meta|title|style|script|link|base|[a-z][\w:-]*)(?:\s|\/?>)/i.test(
			source
		);
	const hasPhp = /<\?(?:php\b|=)/i.test( source ) || fenceLanguage === 'php';
	const hasEmbeddedCss = /<style\b/i.test( source );
	const hasEmbeddedJavaScript = /<script\b/i.test( source );
	const standaloneCss =
		fenceLanguage === 'css' ||
		( ! hasHtml && ! hasPhp && looksLikeStandaloneCss( source ) );
	const standaloneJavaScript =
		fenceLanguage === 'javascript' ||
		( ! hasHtml &&
			! hasPhp &&
			! standaloneCss &&
			looksLikeStandaloneJavaScript( source ) );
	const languages = [];
	if ( hasHtml ) {
		languages.push( 'html' );
	}
	if ( hasEmbeddedCss || standaloneCss ) {
		languages.push( 'css' );
	}
	if ( hasEmbeddedJavaScript || standaloneJavaScript ) {
		languages.push( 'javascript' );
	}
	if ( hasPhp ) {
		languages.push( 'php' );
	}

	let sourceType = 'plain-text';
	if ( fullDocument ) {
		sourceType = 'full-document';
	} else if ( languages.length > 1 ) {
		sourceType = 'mixed';
	} else if ( hasHtml ) {
		sourceType = 'html-fragment';
	} else if ( standaloneCss ) {
		sourceType = 'stylesheet';
	} else if ( standaloneJavaScript ) {
		sourceType = 'javascript';
	} else if ( hasPhp ) {
		sourceType = 'php';
	}

	return {
		source_type: sourceType,
		languages,
		full_document: fullDocument,
		has_html: hasHtml,
		standalone_css: standaloneCss,
		standalone_javascript: standaloneJavaScript,
		has_php: hasPhp,
		fenced_language: fenceLanguage,
	};
}

function protectRegexLiterals( source ) {
	const protectedValues = [];
	const value = source.replace(
		/(^|[=(,:;!&|?{}\[\]\n]\s*)(\/(?![/*])(?:\\.|[^/\n\\])+\/[dgimsuvy]*)/g,
		( match, prefix, literal ) => {
			const token = `__CTB_REGEX_${ protectedValues.length }__`;
			protectedValues.push( literal );
			return prefix + token;
		}
	);
	return {
		value,
		restore: ( normalized ) =>
			normalized.replace(
				/__CTB_REGEX_(\d+)__/g,
				( match, index ) => protectedValues[ Number( index ) ] ?? match
			),
	};
}

/**
 * Reverses escaping introduced by markdown/rich-text transport without
 * globally deleting backslashes from CSS strings or JavaScript.
 *
 * @param {string} rawSource Source pasted into the importer.
 * @return {string} Normalized source.
 */
export function normalizeImportedCode( rawSource ) {
	let source = String( rawSource || '' ).replace( /\r\n?/g, '\n' );
	source = source.replace(
		/^[\uFEFF\u200B-\u200D\u2060]+|[\u200B-\u200D\u2060]+$/g,
		''
	);
	source = stripWholeCodeFence( source );
	const escapedMarkers =
		source.match(
			/\\<(?:!doctype|\/?html\b|\/?head\b|\/?body\b|\/?style\b|\/?script\b|\/?[a-z][\w:-]*\b)/gi
		) || [];
	const escapedDocument = escapedMarkers.length > 0;
	if ( ! escapedDocument ) {
		return source;
	}

	const protectedRegex = protectRegexLiterals( source );
	source = protectedRegex.value
		.replace( /^(?:&#x20;|&#32;)+/gim, ( encoded ) =>
			' '.repeat( encoded.match( /&#(?:x20|32);/gi )?.length || 0 )
		)
		.replace( /\\([<>@*])/g, '$1' )
		.replace( /\\--/g, '--' )
		.replace( /([A-Za-z_$][\w$]*)\\\.(?=[A-Za-z_$])/g, '$1.' );
	return protectedRegex.restore( source );
}

function attributesObject( element ) {
	return Object.fromEntries(
		[ ...element.attributes ].map( ( attribute ) => [
			attribute.name.toLowerCase(),
			attribute.value,
		] )
	);
}

function isKeyframeRule( rule ) {
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
			/(?:expression\s*\(|javascript\s*:|<\s*\/\s*style)/i.test(
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

function selectorForStaticMatching( selector ) {
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

function inventoryStylesheet( root ) {
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

function tokenCategory( name, value ) {
	if (
		COLOR_VALUE.test( value ) ||
		/(?:color|background|surface|accent|brand)/i.test( name )
	) {
		return 'colors';
	}
	if ( /(?:font|type|line-height|letter-spacing)/i.test( name ) ) {
		return 'typography';
	}
	if ( SIZE_VALUE.test( value ) ) {
		return 'spacing';
	}
	return '';
}

function tokenId( name, used ) {
	const base =
		name
			.replace( /^--/, '' )
			.toLowerCase()
			.replace( /[^a-z0-9]+/g, '-' )
			.replace( /^-+|-+$/g, '' )
			.slice( 0, 40 ) || 'imported';
	let candidate = /^[a-z]/.test( base ) ? base : `v-${ base }`.slice( 0, 40 );
	let suffix = 2;
	while ( used.has( candidate ) ) {
		candidate = `${ base.slice( 0, 36 ) }-${ suffix++ }`;
	}
	used.add( candidate );
	return candidate;
}

function mapRootTokens( stylesheets ) {
	const designTokens = {};
	const bindings = {};
	const used = new Set();
	for ( const stylesheet of stylesheets ) {
		stylesheet.ast.walkRules( ( rule ) => {
			if (
				rule.selector.trim() !== ':root' ||
				rule.parent.type === 'atrule'
			) {
				return;
			}
			rule.walkDecls( /^--/, ( declaration ) => {
				if ( bindings[ declaration.prop ] ) {
					return;
				}
				const category = tokenCategory(
					declaration.prop,
					declaration.value
				);
				if ( ! category ) {
					return;
				}
				const id = tokenId( declaration.prop, used );
				designTokens[ category ] ||= {};
				designTokens[ category ][ id ] = {
					label: declaration.prop,
					value: declaration.value,
				};
				bindings[ declaration.prop ] = `${ category }.${ id }`;
			} );
		} );
	}
	return { designTokens, bindings };
}

function stylesheetMatches( document, stylesheets, diagnostics ) {
	const matches = new Map();
	const elements = [ ...document.body.querySelectorAll( '*' ) ];
	let selectorCount = 0;
	let order = 0;
	for ( const stylesheet of stylesheets ) {
		stylesheet.ast.walkRules( ( rule ) => {
			if ( isKeyframeRule( rule ) ) {
				return;
			}
			for ( const selector of rule.selectors ) {
				selectorCount += 1;
				if ( selectorCount > MAX_SELECTORS ) {
					throw new Error(
						`CSS cannot contain more than ${ MAX_SELECTORS } selectors.`
					);
				}
				let staticSelector;
				let specificity;
				const pseudoStates = [];
				try {
					selectorParser( ( selectors ) => {
						selectors.walkPseudos( ( pseudo ) => {
							const name = pseudo.value.toLowerCase();
							if (
								[
									':hover',
									':focus',
									':focus-visible',
								].includes( name )
							) {
								pseudoStates.push(
									name === ':hover' ? 'hover' : 'focus'
								);
							}
						} );
					} ).processSync( selector );
					staticSelector = selectorForStaticMatching( selector );
					specificity = calculate( selector );
				} catch {
					diagnostics.push(
						diagnostic(
							'warning',
							'SELECTOR_NOT_NATIVE_EDITABLE',
							`Selector was preserved but could not be indexed: ${ selector }`,
							'css',
							rule
						)
					);
					continue;
				}
				let selected;
				try {
					selected = staticSelector.trim()
						? elements.filter( ( element ) =>
								element.matches( staticSelector )
						  )
						: [];
				} catch {
					selected = [];
				}
				const declarations = rule.nodes
					.filter( ( node ) => node.type === 'decl' )
					.map( ( declaration ) => ( {
						property: declaration.prop,
						value: declaration.value,
						important: Boolean( declaration.important ),
					} ) );
				for ( const element of selected ) {
					matches.set( element, [
						...( matches.get( element ) || [] ),
						{
							selector,
							declarations,
							specificity,
							order: order++,
							condition:
								rule.parent.type === 'atrule'
									? `@${ rule.parent.name } ${ rule.parent.params }`.trim()
									: 'base',
							pseudo_states: pseudoStates,
							stylesheet_id: stylesheet.asset.id,
						},
					] );
				}
			}
		} );
	}
	return matches;
}

function inlineStyles( element ) {
	const declarations = new Map();
	let order = 0;
	for ( const property of element.style ) {
		declarations.set( property, {
			value: element.style.getPropertyValue( property ).trim(),
			important:
				element.style.getPropertyPriority( property ) === 'important',
			origin: 'inline',
			inline: true,
			specificity: { A: 1, B: 0, C: 0 },
			order: order++,
		} );
	}
	return declarations;
}

function extractPageMeta( document, fullDocument, detection ) {
	const metas = [ ...document.head.querySelectorAll( 'meta' ) ].map(
		attributesObject
	);
	const links = [ ...document.head.querySelectorAll( 'link' ) ].map(
		attributesObject
	);
	return {
		document_type: fullDocument ? 'full-document' : 'fragment',
		source_type: detection.source_type,
		detected_languages: detection.languages,
		doctype: document.doctype?.name || undefined,
		html_attributes: attributesObject( document.documentElement ),
		title: document.title || undefined,
		metas,
		links,
		base_href:
			document.head
				.querySelector( 'base[href]' )
				?.getAttribute( 'href' ) || undefined,
		body_attributes: attributesObject( document.body ),
	};
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

function extractScripts( document, sessionId, diagnostics ) {
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
				placement: scriptPlacement( script, document ),
				type: attributes.type || 'text/javascript',
				source: src ? '' : script.textContent,
				...( src ? { src } : {} ),
				attributes,
				enabled_in_editor: false,
				enabled_in_preview: true,
				enabled_on_publish: true,
				origin: 'imported',
			};
		}
	);
}

function standaloneScript( source, sessionId, index ) {
	return {
		id: `import-script-${ sessionId }-${ index + 1 }`,
		placement: 'body-end',
		type: 'text/javascript',
		source,
		attributes: {},
		enabled_in_editor: false,
		enabled_in_preview: true,
		enabled_on_publish: true,
		origin: 'imported',
	};
}

function analyzeReferences( document, stylesheets, scripts, diagnostics ) {
	const references = [];
	for ( const element of document.querySelectorAll(
		'[href], [src], [srcset]'
	) ) {
		for ( const name of [ 'href', 'src', 'srcset' ] ) {
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
	return references;
}

function addScopeClass( attributes ) {
	const classes = String( attributes.class || '' )
		.split( /\s+/ )
		.filter( Boolean );
	if ( ! classes.includes( IMPORT_SCOPE_CLASS ) ) {
		classes.push( IMPORT_SCOPE_CLASS );
	}
	attributes.class = classes.join( ' ' );
}

function mergePageRootAttributes( target, pageMeta ) {
	for ( const attributes of [
		pageMeta.html_attributes,
		pageMeta.body_attributes,
	] ) {
		for ( const [ name, value ] of Object.entries( attributes ) ) {
			if ( name === 'class' ) {
				target.class = [ target.class, value ]
					.filter( Boolean )
					.join( ' ' );
			} else if ( name !== 'id' && target[ name ] === undefined ) {
				target[ name ] = value;
			}
		}
	}
}

function duplicateIdDiagnostics( document, diagnostics ) {
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

function makeStylesheet( source, index, sessionId, diagnostics ) {
	const scoped = scopeImportedCss( source, diagnostics );
	const inventory = inventoryStylesheet( scoped.root );
	return {
		ast: scoped.root,
		asset: {
			id: `import-style-${ sessionId }-${ index + 1 }`,
			source_text: source,
			scoped_source: scoped.css,
			origin: {
				type: 'code-import',
				import_session_id: sessionId,
			},
			...inventory,
		},
	};
}

function toWarningStrings( diagnostics ) {
	return diagnostics
		.filter( ( item ) => item.severity !== 'info' )
		.map( ( item ) => item.message );
}

/**
 * Builds a complete candidate package. This function never mutates editor state
 * and DOMParser does not execute scripts or inline event attributes.
 *
 * @param {string} rawSource       Unified source pasted into the importer.
 * @param {string} css             Optional separate stylesheet source.
 * @param {string} shortcodePrefix Prefix for inert PHP placeholders.
 * @return {Object} Complete candidate import session.
 */
export function createCodeImportSession(
	rawSource,
	css = '',
	shortcodePrefix = 'ctb_php'
) {
	if ( ! String( rawSource || '' ).trim() ) {
		throw new Error( 'Paste HTML before parsing.' );
	}
	if (
		rawSource.length > MAX_IMPORT_LENGTH ||
		css.length > MAX_IMPORT_LENGTH
	) {
		throw new Error( 'HTML and CSS must each be 2 MB or smaller.' );
	}

	const normalizedSource = normalizeImportedCode( rawSource );
	const hash = sourceHash( normalizedSource );
	const sessionId = `code-import-${ hash }`;
	const diagnostics = [];
	const detection = detectImportedCode( rawSource );
	const phpSource =
		detection.fenced_language === 'php' &&
		! /<\?(?:php\b|=)/i.test( normalizedSource )
			? `<?php\n${ normalizedSource }\n?>`
			: normalizedSource;
	const php = extractPhpSnippets( phpSource, shortcodePrefix );
	const htmlSource =
		detection.standalone_css || detection.standalone_javascript
			? ''
			: php.html;
	const fullDocument = detection.full_document;
	const document = new window.DOMParser().parseFromString(
		htmlSource,
		'text/html'
	);
	const pageMeta = extractPageMeta( document, fullDocument, detection );
	const scripts = extractScripts( document, hash, diagnostics );
	if ( detection.standalone_javascript ) {
		scripts.push(
			standaloneScript( normalizedSource, hash, scripts.length )
		);
	}
	for ( const script of document.querySelectorAll( 'script' ) ) {
		script.remove();
	}

	const stylesheetSources = [ ...document.querySelectorAll( 'style' ) ].map(
		( style ) => style.textContent
	);
	if ( detection.standalone_css ) {
		stylesheetSources.push( normalizedSource );
	}
	if ( css.trim() ) {
		stylesheetSources.push( css );
	}
	for ( const style of document.querySelectorAll( 'style' ) ) {
		style.remove();
	}
	const stylesheets = stylesheetSources.map( ( source, index ) =>
		makeStylesheet( source, index, hash, diagnostics )
	);
	const matches = stylesheetMatches( document, stylesheets, diagnostics );
	const { designTokens, bindings } = mapRootTokens( stylesheets );
	const references = analyzeReferences(
		document,
		stylesheets,
		scripts,
		diagnostics
	);
	duplicateIdDiagnostics( document, diagnostics );
	for ( const link of pageMeta.links ) {
		if (
			/(?:^|\s)stylesheet(?:\s|$)/i.test( link.rel || '' ) &&
			link.href
		) {
			diagnostics.push(
				diagnostic(
					'warning',
					'EXTERNAL_STYLESHEET_NOT_FETCHED',
					`External stylesheet was recorded without being fetched during import: ${ link.href }`,
					'css'
				)
			);
		}
	}

	for ( const element of document.body.querySelectorAll( '*' ) ) {
		for ( const attribute of element.attributes ) {
			if ( /^on/i.test( attribute.name ) ) {
				diagnostics.push(
					diagnostic(
						'warning',
						'INLINE_EVENT_HANDLER_BLOCKED',
						`${
							attribute.name
						} was removed from <${ element.tagName.toLowerCase() }> and will not execute.`,
						'html',
						element
					)
				);
			}
		}
	}

	let roots = [ ...document.body.children ];
	if ( roots.length === 0 ) {
		const generatedRoot = document.createElement( 'main' );
		generatedRoot.setAttribute(
			'data-ctb-generated-root',
			detection.source_type
		);
		const text = document.body.textContent || '';
		if ( text.trim() ) {
			const content = document.createElement(
				detection.source_type === 'plain-text' ? 'p' : 'div'
			);
			content.textContent = text;
			generatedRoot.append( content );
		}
		document.body.replaceChildren( generatedRoot );
		roots = [ generatedRoot ];
		let generatedRootSource = 'html';
		if ( detection.standalone_css ) {
			generatedRootSource = 'css';
		} else if ( detection.standalone_javascript ) {
			generatedRootSource = 'script';
		} else if ( detection.has_php ) {
			generatedRootSource = 'php';
		}
		diagnostics.push(
			diagnostic(
				'info',
				'GENERATED_SAFE_ROOT',
				`A safe page root was generated for ${ detection.source_type } input.`,
				generatedRootSource
			)
		);
	}
	const elements = [ ...document.body.querySelectorAll( '*' ) ];
	const needsDocumentRoot = fullDocument || roots.length > 1;
	if ( elements.length + ( needsDocumentRoot ? 1 : 0 ) > MAX_BLOCKS ) {
		throw new Error(
			`HTML cannot contain more than ${ MAX_BLOCKS } elements.`
		);
	}

	let blockIndex = 0;
	const importStats = {
		mappedResponsive: 0,
		mappedStates: 0,
		customCss: 0,
		unsupportedElements: 0,
	};
	function toBlock( element, depth = 1 ) {
		if ( depth > MAX_DEPTH ) {
			throw new Error(
				`HTML cannot be nested more than ${ MAX_DEPTH } levels.`
			);
		}
		const currentIndex = ++blockIndex;
		const sourceTag = element.tagName.toLowerCase();
		const supported = SUPPORTED_HTML_TAGS.has( sourceTag );
		const tag = supported ? sourceTag : 'div';

		if ( ! supported ) {
			importStats.unsupportedElements++;
			diagnostics.push(
				diagnostic(
					'warning',
					'UNSUPPORTED_ELEMENT_NORMALIZED',
					`Unsupported <${ sourceTag }> was normalized to an editable <div>; its safe attributes, children, and matched styles were retained.`,
					'html',
					element
				)
			);
		}

		const resolved = inlineStyles( element );
		if ( resolved.size > MAX_CSS_MAPPING_DECLARATIONS ) {
			throw new Error(
				`A block cannot resolve more than ${ MAX_CSS_MAPPING_DECLARATIONS } CSS declarations.`
			);
		}
		const { explanation, ...styles } = splitResolvedStyles( resolved );
		const matchedRules = matches.get( element ) || [];

		for ( const rule of matchedRules ) {
			const isMedia = rule.condition.startsWith( '@media' );
			let breakpoint = null;
			let state = null;

			if ( isMedia ) {
				const isDesktopOnly =
					rule.condition.includes( 'min-width: 769px' );
				if ( ! isDesktopOnly ) {
					const tabletMatch =
						rule.condition.match( /max-width:\s*(\d+)px/ );
					if ( tabletMatch ) {
						const width = parseInt( tabletMatch[ 1 ], 10 );
						breakpoint = width < 768 ? 'mobile' : 'tablet';
					}
				}
			}

			if ( rule.pseudo_states && rule.pseudo_states.length > 0 ) {
				state = rule.pseudo_states[ 0 ];
			}

			const ruleDecls = new Map();
			for ( const declaration of rule.declarations ) {
				ruleDecls.set( declaration.property, {
					value: declaration.value,
					important: declaration.important,
					origin: 'stylesheet',
				} );
			}
			const mappedStyles = splitResolvedStyles( ruleDecls );
			explanation.push( ...mappedStyles.explanation );

			if ( breakpoint && ! state ) {
				importStats.mappedResponsive++;
			} else if ( state && ! breakpoint ) {
				importStats.mappedStates++;
			} else {
				importStats.customCss += rule.declarations.length;
			}
		}

		const children = [ ...element.childNodes ]
			.filter(
				( child ) =>
					child.nodeType === window.Node.ELEMENT_NODE ||
					( child.nodeType === window.Node.TEXT_NODE &&
						child.textContent.trim() )
			)
			.map( ( child ) =>
				child.nodeType === window.Node.TEXT_NODE
					? { kind: 'text', value: child.textContent }
					: toBlock( child, depth + 1 )
			);
		const attributes = sanitizeElementAttributes( element, tag );
		if ( ! supported ) {
			attributes[ 'data-ctb-original-tag' ] = sourceTag;
		}
		const block = {
			id: `import-${ hash }-${
				supported ? tag : 'fallback'
			}-${ currentIndex }`,
			type: supported ? blockTypeFor( element ) : 'container',
			tag,
			attributes,
			children,
			styles,
			meta: {
				source: 'pasted-html-css',
				...( supported ? {} : { imported_original_tag: sourceTag } ),
				imported_native_html: [
					'form',
					'input',
					'select',
					'textarea',
				].includes( tag ),
				css_mapping: {
					version: 1,
					declarations: explanation.slice(
						0,
						MAX_CSS_MAPPING_DECLARATIONS
					),
				},
				...( matchedRules.length
					? { imported_css_rules: matchedRules }
					: {} ),
			},
		};
		return block;
	}

	let root;
	if ( needsDocumentRoot ) {
		const attributes = {};
		mergePageRootAttributes( attributes, pageMeta );
		addScopeClass( attributes );
		root = {
			id: `import-${ hash }-page-root`,
			type: 'container',
			tag: 'div',
			attributes,
			children: roots.map( ( element ) => toBlock( element, 2 ) ),
			styles: { mapped: {}, custom_css_fallback: '' },
			meta: { source: 'pasted-html-css' },
		};
	} else {
		root = toBlock( roots[ 0 ] );
		addScopeClass( root.attributes );
	}

	if ( roots.length > 1 && ! fullDocument ) {
		diagnostics.push(
			diagnostic(
				'info',
				'FRAGMENT_ROOT_GROUPED',
				`${ roots.length } top-level elements were grouped in an imported layout container.`,
				'html'
			)
		);
	}
	if ( scripts.length ) {
		diagnostics.push(
			diagnostic(
				'info',
				'SCRIPT_DISABLED_IN_EDITOR',
				`${ scripts.length } imported script${
					scripts.length === 1 ? ' is' : 's are'
				} disabled in edit mode and retained for Preview/Publish only.`,
				'script'
			)
		);
	}

	const title = pageMeta.title || 'Imported layout';
	const importedAssets = {
		origin: {
			type: 'code-import',
			import_session_id: sessionId,
			source_hash: hash,
		},
		page_meta: pageMeta,
		stylesheets: stylesheets.map( ( item ) => item.asset ),
		token_bindings: bindings,
		scripts,
		references,
		diagnostics,
	};
	const importedDocument = {
		schema_version: 2,
		name: title,
		...( Object.keys( designTokens ).length
			? { design_tokens: designTokens }
			: {} ),
		...( pageMeta.title ? { seo: { title: pageMeta.title } } : {} ),
		imported_assets: importedAssets,
		root,
	};

	const scriptDetections = scripts.map( ( script ) => ( {
		id: script.id,
		status: 'preserved',
		code: script.src
			? `<script src="${ script.src }"></script>`
			: script.source,
		description:
			'Preserved as a page script. Disabled in the editor; enabled only in Preview/Publish.',
	} ) );
	return {
		id: sessionId,
		rawSource,
		normalizedSource,
		document: importedDocument,
		stylesheets: importedAssets.stylesheets,
		scripts,
		nodes: root,
		pageMeta,
		detection,
		warnings: diagnostics.filter( ( item ) => item.severity === 'warning' ),
		errors: diagnostics.filter( ( item ) => item.severity === 'error' ),
		diagnostics,
		sourceMap: {},
		review: {
			document_type: pageMeta.document_type,
			source_type: pageMeta.source_type,
			detected_languages: pageMeta.detected_languages,
			builder_nodes: blockIndex + ( needsDocumentRoot ? 1 : 0 ),
			stylesheets: stylesheets.length,
			css_variables: Object.keys( bindings ).length,
			media_conditions: [
				...new Set(
					stylesheets.flatMap(
						( item ) => item.asset.media_conditions
					)
				),
			],
			keyframes: [
				...new Set(
					stylesheets.flatMap( ( item ) => item.asset.keyframes )
				),
			],
			scripts: scripts.length,
			external_assets: references.filter(
				( reference ) => reference.external
			).length,
			warnings: diagnostics.filter(
				( item ) => item.severity === 'warning'
			).length,
			errors: diagnostics.filter( ( item ) => item.severity === 'error' )
				.length,
			mapped_responsive: importStats.mappedResponsive,
			mapped_states: importStats.mappedStates,
			custom_css: importStats.customCss,
			unsupported_elements: importStats.unsupportedElements,
		},
		scriptDetections,
		phpDetections: php.phpDetections,
	};
}

export function parseBlockDocument( html, css, shortcodePrefix = 'ctb_php' ) {
	const session = createCodeImportSession( html, css, shortcodePrefix );
	return {
		document: session.document,
		warnings: toWarningStrings( session.diagnostics ),
		diagnostics: session.diagnostics,
		scriptDetections: session.scriptDetections,
		phpDetections: session.phpDetections,
		session,
	};
}
