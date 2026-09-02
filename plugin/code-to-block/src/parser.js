import selectorParser from 'postcss-selector-parser';
import { calculate } from 'specificity';

import { splitResolvedStyles } from './custom-css.mjs';
import { sanitizeElementAttributes } from './html-policy.mjs';
import { extractPhpSnippets } from './php-snippets.mjs';
import { detectImportedSource } from './importer/detection/detect-imported-source.mjs';
import { normalizeImportedSource } from './importer/normalization/normalize-imported-source.mjs';
import {
	decomposeImportedDocument,
	parseImportedHtml,
	serializableDocumentModel,
} from './importer/html/HtmlDocumentParser.mjs';
import {
	childNodesForElement,
	createDefaultBlockAdapterRegistry,
	createFallbackBlock,
} from './importer/conversion/BlockAdapterRegistry.mjs';
import { ImportDiagnosticsCollector } from './importer/ImportDiagnosticsCollector.mjs';
import {
	scopeImportedCss,
	selectorForStaticMatching,
	inventoryStylesheet,
	isKeyframeRule,
	addScopeClass,
	IMPORT_SCOPE_CLASS,
} from './importer/css/scope-imported-css.mjs';
import {
	extractScripts,
	standaloneScript,
	analyzeReferences,
	duplicateIdDiagnostics,
} from './importer/assets/collect-import-assets.mjs';

const MAX_IMPORT_LENGTH = 2 * 1024 * 1024;
const MAX_BLOCKS = 1000;
const MAX_DEPTH = 50;
const MAX_CSS_MAPPING_DECLARATIONS = 1000;

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

/**
 * Conservatively classifies a unified import before DOM parsing. Tag-based
 * HTML remains authoritative; bare CSS/JS is only recognized when the source
 * is fenced or contains language-specific syntax.
 *
 * @param {string} rawSource Source pasted into the importer.
 * @return {Object} Detected source characteristics.
 */
export function detectImportedCode( rawSource ) {
	return detectImportedSource( rawSource );
}

/**
 * Reverses escaping introduced by markdown/rich-text transport without
 * globally deleting backslashes from CSS strings or JavaScript.
 *
 * @param {string} rawSource Source pasted into the importer.
 * @return {string} Normalized source.
 */
export function normalizeImportedCode( rawSource ) {
	return normalizeImportedSource( rawSource );
}

export { scopeImportedCss };

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

const MAX_SELECTORS = 2000;

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

function mergePageRootAttributes( target, pageMeta ) {
	for ( const attributes of [
		pageMeta.html_attributes,
		pageMeta.body_attributes,
	] ) {
		for ( const [ name, value ] of Object.entries( attributes ) ) {
			if (
				/^on/i.test( name ) ||
				name === 'style' ||
				name.startsWith( 'data-ctb-' ) ||
				! (
					[
						'class',
						'lang',
						'dir',
						'title',
						'role',
						'hidden',
						'tabindex',
					].includes( name ) ||
					/^(?:aria|data)-[a-z0-9_.:-]+$/.test( name )
				)
			) {
				continue;
			}
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

function makeStylesheet(
	source,
	index,
	sessionId,
	diagnostics,
	metadata = {}
) {
	const scoped = scopeImportedCss( source, diagnostics );
	const inventory = inventoryStylesheet( scoped.root );
	const renderedSource = metadata.media
		? `@media ${ metadata.media }{${ scoped.css }}`
		: scoped.css;
	return {
		ast: scoped.root,
		asset: {
			id: `import-style-${ sessionId }-${ index + 1 }`,
			source_text: source,
			scoped_source: renderedSource,
			origin: {
				type: 'code-import',
				import_session_id: sessionId,
			},
			asset_origin: metadata.origin || 'style-element',
			order: metadata.order ?? index,
			...( metadata.media ? { media: metadata.media } : {} ),
			...( metadata.attributes
				? { attributes: metadata.attributes }
				: {} ),
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
	const diagnostics = new ImportDiagnosticsCollector();
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
	const fullDocument = detection.documentShape === 'full-document';
	const document = parseImportedHtml( htmlSource, window );
	const decomposedDocument = decomposeImportedDocument( document, detection );
	const pageMeta = {
		document_type: fullDocument ? 'full-document' : 'fragment',
		document_shape: detection.documentShape,
		source_type: detection.source_type,
		detected_languages: detection.languages,
		doctype: decomposedDocument.doctype,
		html_attributes: decomposedDocument.htmlAttributes,
		title: decomposedDocument.head.title,
		metas: decomposedDocument.head.meta,
		links: decomposedDocument.head.links,
		base_href: decomposedDocument.baseUrl,
		body_attributes: decomposedDocument.bodyAttributes,
	};
	if ( detection.malformedLikely ) {
		diagnostics.push(
			diagnostic(
				'warning',
				'HTML_PARSE_RECOVERED',
				'The source appeared malformed; browser HTML5 error recovery was applied and the original source was retained.',
				'html'
			)
		);
	}
	const scripts = extractScripts( document, hash, diagnostics );
	if ( detection.standalone_javascript ) {
		scripts.push(
			standaloneScript( normalizedSource, hash, scripts.length )
		);
	}
	for ( const script of document.querySelectorAll( 'script' ) ) {
		script.remove();
	}

	const stylesheetSources = decomposedDocument.head.styles.map(
		( style ) => ( {
			source: style.sourceText,
			metadata: {
				origin: 'style-element',
				order: style.order,
				media: style.media,
				attributes: style.attributes,
			},
		} )
	);
	if ( detection.standalone_css ) {
		stylesheetSources.push( {
			source: normalizedSource,
			metadata: {
				origin: 'standalone-css',
				order: stylesheetSources.length,
			},
		} );
	}
	if ( css.trim() ) {
		stylesheetSources.push( {
			source: css,
			metadata: {
				origin: 'separate-css',
				order: stylesheetSources.length,
			},
		} );
	}
	for ( const style of document.querySelectorAll( 'style' ) ) {
		style.remove();
	}
	const stylesheets = stylesheetSources.map( ( item, index ) =>
		makeStylesheet( item.source, index, hash, diagnostics, item.metadata )
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

	let roots = decomposedDocument.renderRoots.filter(
		( element ) => element.isConnected
	);
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
		native: 0,
		hybrid: 0,
		preserved: 0,
		restricted: php.phpDetections.length,
	};
	const fallbacks = [];
	const adapterRegistry = createDefaultBlockAdapterRegistry();

	function toBlock( element, depth = 1 ) {
		try {
			return convertElementToBlock( element, depth );
		} catch ( error ) {
			const fallbackIndex = ++blockIndex;
			const fallback = createFallbackBlock(
				element,
				{
					makeId: () =>
						`import-${ hash }-fallback-${ fallbackIndex }`,
				},
				error
			);
			fallbacks.push( {
				block_id: fallback.id,
				original_tag: element?.tagName?.toLowerCase() || 'unknown',
				source: fallback.meta.imported_source,
				reason: fallback.meta.fallback_reason,
			} );
			importStats.preserved++;
			diagnostics.push(
				diagnostic(
					'warning',
					'NODE_CONVERSION_FALLBACK',
					`<${
						element?.tagName?.toLowerCase() || 'unknown'
					}> was preserved as a localized fallback because its subtree could not be converted: ${
						error.message
					}`,
					'html',
					element
				)
			);
			return fallback;
		}
	}

	function convertElementToBlock( element, depth = 1 ) {
		if ( depth > MAX_DEPTH ) {
			throw new Error(
				`HTML cannot be nested more than ${ MAX_DEPTH } levels.`
			);
		}
		const currentIndex = ++blockIndex;
		const sourceTag = element.tagName.toLowerCase();
		const adapter = adapterRegistry.resolve( element );
		const adapterResult = adapter.describe( element );
		const supported = adapter.fidelity === 'native';
		const generic = adapter.fidelity === 'hybrid';
		const tag = adapterResult.tag;

		if ( generic ) {
			importStats.unsupportedElements++;
			diagnostics.push(
				diagnostic(
					'info',
					'UNSUPPORTED_ELEMENT_PRESERVED',
					`<${ sourceTag }> was retained as a generic editable HTML element.`,
					'html',
					element
				)
			);
		} else if ( adapter.fidelity === 'preserved' ) {
			importStats.unsupportedElements++;
			diagnostics.push(
				diagnostic(
					'warning',
					'UNSUPPORTED_ELEMENT_NORMALIZED',
					`Unsafe or parser-control <${ sourceTag }> markup was represented by a preserved fallback container.`,
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

		const children = childNodesForElement( element )
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
		if ( adapter.fidelity === 'preserved' ) {
			attributes[ 'data-ctb-original-tag' ] = sourceTag;
		}
		const block = {
			id: `import-${ hash }-${ tag }-${ currentIndex }`,
			type: adapterResult.type,
			tag,
			attributes,
			children,
			styles,
			meta: {
				source: 'pasted-html-css',
				...( supported ? {} : { imported_original_tag: sourceTag } ),
				import_fidelity: adapter.fidelity,
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
		importStats[ adapter.fidelity ]++;
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
	const collectedDiagnostics = diagnostics.toArray();

	const title = pageMeta.title || 'Imported layout';
	const serverCode = php.phpDetections.map( ( item ) => ( {
		id: item.id,
		language: 'php',
		source: item.code,
		shortcode: item.shortcode,
		status: 'restricted',
	} ) );
	let compatibilityLevel = 1;
	if ( importStats.restricted > 0 ) {
		compatibilityLevel = 4;
	} else if ( importStats.preserved > 0 ) {
		compatibilityLevel = 3;
	} else if (
		importStats.hybrid > 0 ||
		stylesheets.length ||
		scripts.length
	) {
		compatibilityLevel = 2;
	}
	const compatibility = {
		native: importStats.native,
		hybrid: importStats.hybrid,
		preserved: importStats.preserved,
		restricted: importStats.restricted,
		level: compatibilityLevel,
	};
	const security = {
		scripts_disabled_in_editor: scripts.length,
		restricted_server_code: serverCode.length,
		blocked_urls: references.filter( ( reference ) => reference.blocked )
			.length,
		inline_event_handlers: collectedDiagnostics.filter(
			( item ) => item.code === 'INLINE_EVENT_HANDLER_BLOCKED'
		).length,
	};
	const importedAssets = {
		origin: {
			type: 'code-import',
			import_session_id: sessionId,
			source_hash: hash,
		},
		source: {
			original: String( rawSource ),
			normalized: normalizedSource,
			hash,
			transport_encoding: detection.transportEncoding,
		},
		page_meta: pageMeta,
		stylesheets: stylesheets.map( ( item ) => item.asset ),
		token_bindings: bindings,
		scripts,
		references,
		server_code: serverCode,
		fallbacks,
		compatibility,
		security,
		diagnostics: collectedDiagnostics,
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
		schemaVersion: 1,
		state: 'analyzed',
		rawSource,
		normalizedSource,
		source: importedAssets.source,
		document: importedDocument,
		documentModel: serializableDocumentModel( decomposedDocument ),
		dom: {
			renderRootCount: roots.length,
			blockCount: blockIndex + ( needsDocumentRoot ? 1 : 0 ),
		},
		stylesheets: importedAssets.stylesheets,
		scripts,
		serverCode,
		fallbackNodes: fallbacks,
		assets: { references },
		compatibility,
		security,
		nodes: root,
		pageMeta,
		detection,
		warnings: collectedDiagnostics.filter(
			( item ) => item.severity === 'warning'
		),
		errors: collectedDiagnostics.filter(
			( item ) => item.severity === 'error'
		),
		diagnostics: collectedDiagnostics,
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
			warnings: collectedDiagnostics.filter(
				( item ) => item.severity === 'warning'
			).length,
			errors: collectedDiagnostics.filter(
				( item ) => item.severity === 'error'
			).length,
			mapped_responsive: importStats.mappedResponsive,
			mapped_states: importStats.mappedStates,
			custom_css: importStats.customCss,
			unsupported_elements: importStats.unsupportedElements,
			compatibility,
			security,
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
