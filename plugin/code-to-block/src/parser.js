import postcss from 'postcss';
import { calculate, compare } from 'specificity';

import { blockTypeFor } from './block-type.mjs';
import { splitResolvedStyles } from './custom-css.mjs';
import {
	sanitizeElementAttributes,
	SUPPORTED_HTML_TAGS,
} from './html-policy.mjs';
import {
	createStructuredAction,
	createUnverifiedAction,
	detectScriptAction,
} from './script-actions.mjs';
import { extractPhpSnippets } from './php-snippets.mjs';

const MAX_IMPORT_LENGTH = 2 * 1024 * 1024;
const MAX_BLOCKS = 1000;
const MAX_DEPTH = 50;
const MAX_SELECTORS = 2000;
const MAX_CSS_MAPPING_DECLARATIONS = 1000;

const INHERITED_PROPERTIES = new Set( [
	'color',
	'cursor',
	'direction',
	'font',
	'font-family',
	'font-size',
	'font-style',
	'font-variant',
	'font-weight',
	'letter-spacing',
	'line-height',
	'list-style',
	'list-style-image',
	'list-style-position',
	'list-style-type',
	'text-align',
	'text-indent',
	'text-transform',
	'visibility',
	'white-space',
	'word-spacing',
] );

const PSEUDO_ELEMENT = /::|:(?:before|after|first-letter|first-line)\b/i;
const DYNAMIC_PSEUDO =
	/:(?:active|checked|disabled|enabled|focus|focus-visible|focus-within|hover|invalid|link|target|valid|visited)\b/i;
function outranks( candidate, current ) {
	if ( ! current ) {
		return true;
	}
	if ( Boolean( candidate.important ) !== Boolean( current.important ) ) {
		return Boolean( candidate.important );
	}
	if ( candidate.inline !== current.inline ) {
		return candidate.inline;
	}

	const specificityOrder = compare(
		candidate.specificity,
		current.specificity
	);
	return specificityOrder !== 0
		? specificityOrder > 0
		: candidate.order >= current.order;
}

function resolveStyles( document, css ) {
	const root = postcss.parse( css );
	const warnings = [];
	const declarationsByElement = new Map();
	const elements = [ ...document.body.querySelectorAll( '*' ) ];
	let order = 0;
	let selectorCount = 0;

	for ( const element of elements ) {
		declarationsByElement.set( element, new Map() );
	}

	root.walkAtRules( ( atRule ) => {
		warnings.push(
			`Unsupported rule skipped: @${ atRule.name } ${ atRule.params }`.trim()
		);
	} );

	root.walkRules( ( rule ) => {
		if ( rule.parent.type === 'atrule' ) {
			return;
		}

		for ( const selector of rule.selectors ) {
			selectorCount += 1;
			if ( selectorCount > MAX_SELECTORS ) {
				throw new Error(
					`CSS cannot contain more than ${ MAX_SELECTORS } selectors.`
				);
			}
			if ( /:has\(/i.test( selector ) ) {
				warnings.push( `Expensive selector skipped: ${ selector }` );
				continue;
			}
			if ( PSEUDO_ELEMENT.test( selector ) ) {
				warnings.push(
					`Pseudo-element selector skipped: ${ selector }`
				);
				continue;
			}
			if ( DYNAMIC_PSEUDO.test( selector ) ) {
				warnings.push(
					`Dynamic-state selector skipped: ${ selector }`
				);
				continue;
			}

			let specificity;
			let matches;
			try {
				specificity = calculate( selector );
				matches = elements.filter( ( element ) =>
					element.matches( selector )
				);
				if ( matches.length === 0 ) {
					const parts = selector.trim().split( /[\s>+~]+/ );
					const leafSelector = parts[ parts.length - 1 ];
					if (
						leafSelector &&
						leafSelector !== selector &&
						! leafSelector.includes( ')' )
					) {
						try {
							matches = elements.filter( ( element ) =>
								element.matches( leafSelector )
							);
						} catch {}
					}
				}
			} catch ( error ) {
				warnings.push(
					`Invalid selector skipped: ${ selector } (${ error.message })`
				);
				continue;
			}

			for ( const declaration of rule.nodes.filter(
				( node ) => node.type === 'decl'
			) ) {
				order += 1;
				if ( /var\(/i.test( declaration.value ) ) {
					warnings.push(
						`Custom-property substitution was not computed: ${ declaration.prop }`
					);
				}

				for ( const element of matches ) {
					const resolved = declarationsByElement.get( element );
					const candidate = {
						value: declaration.value,
						important: Boolean( declaration.important ),
						origin: 'stylesheet',
						inline: false,
						specificity,
						order,
					};
					if (
						outranks( candidate, resolved.get( declaration.prop ) )
					) {
						resolved.set( declaration.prop, candidate );
					}
				}
			}
		}
	} );

	for ( const element of elements ) {
		for ( const property of element.style ) {
			order += 1;
			const candidate = {
				value: element.style.getPropertyValue( property ).trim(),
				important:
					element.style.getPropertyPriority( property ) ===
					'important',
				origin: 'inline',
				inline: true,
				specificity: { A: 0, B: 0, C: 0 },
				order,
			};
			const resolved = declarationsByElement.get( element );
			if ( outranks( candidate, resolved.get( property ) ) ) {
				resolved.set( property, candidate );
			}
		}
	}

	for ( const element of elements ) {
		const parentStyles = declarationsByElement.get( element.parentElement );
		if ( ! parentStyles ) {
			continue;
		}
		const resolved = declarationsByElement.get( element );
		for ( const [ property, declaration ] of parentStyles ) {
			if (
				( INHERITED_PROPERTIES.has( property ) ||
					property.startsWith( '--' ) ) &&
				! resolved.has( property )
			) {
				resolved.set( property, {
					...declaration,
					origin: 'inherited',
				} );
			}
		}
	}

	return { declarationsByElement, warnings: [ ...new Set( warnings ) ] };
}

export function parseBlockDocument( html, css, shortcodePrefix = 'ctb_php' ) {
	if ( ! html.trim() ) {
		throw new Error( 'Paste HTML before parsing.' );
	}
	if ( html.length > MAX_IMPORT_LENGTH || css.length > MAX_IMPORT_LENGTH ) {
		throw new Error( 'HTML and CSS must each be 2 MB or smaller.' );
	}

	const php = extractPhpSnippets( html, shortcodePrefix );
	const document = new window.DOMParser().parseFromString(
		php.html,
		'text/html'
	);
	const scripts = [ ...document.querySelectorAll( 'script' ) ].map(
		( script ) => ( {
			code: script.src
				? `<script src="${ script.getAttribute( 'src' ) }"></script>`
				: script.textContent,
		} )
	);
	for ( const script of document.querySelectorAll( 'script' ) ) {
		script.remove();
	}
	let extractedCss = css || '';
	for ( const style of document.querySelectorAll( 'style' ) ) {
		extractedCss += '\n' + style.textContent;
		style.remove();
	}
	const roots = [ ...document.body.children ];
	if ( roots.length !== 1 ) {
		throw new Error( 'HTML must contain exactly one root element.' );
	}
	const elements = [ ...document.body.querySelectorAll( '*' ) ];
	const unsupported = elements.find(
		( element ) =>
			! SUPPORTED_HTML_TAGS.has( element.tagName.toLowerCase() )
	);
	if ( unsupported ) {
		throw new Error(
			`HTML contains unsupported <${ unsupported.tagName.toLowerCase() }> markup.`
		);
	}
	if ( elements.length > MAX_BLOCKS ) {
		throw new Error(
			`HTML cannot contain more than ${ MAX_BLOCKS } elements.`
		);
	}

	const { declarationsByElement, warnings } = resolveStyles(
		document,
		extractedCss
	);
	let blockIndex = 0;
	const blockIdsByHtmlId = new Map();

	function toBlock( element, depth = 1 ) {
		if ( depth > MAX_DEPTH ) {
			throw new Error(
				`HTML cannot be nested more than ${ MAX_DEPTH } levels.`
			);
		}
		const currentIndex = ++blockIndex;
		const tag = element.tagName.toLowerCase();
		const resolved = declarationsByElement.get( element );
		if ( resolved.size > MAX_CSS_MAPPING_DECLARATIONS ) {
			throw new Error(
				`A block cannot resolve more than ${ MAX_CSS_MAPPING_DECLARATIONS } CSS declarations.`
			);
		}
		const { explanation, ...styles } = splitResolvedStyles( resolved );
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

		const block = {
			id: `${ tag }-${ currentIndex }`,
			type: blockTypeFor( element ),
			tag,
			attributes: sanitizeElementAttributes( element, tag ),
			children,
			styles,
			meta: {
				source: 'pasted-html-css',
				css_mapping: { version: 1, declarations: explanation },
			},
		};
		if ( element.id ) {
			const ids = blockIdsByHtmlId.get( element.id ) || [];
			ids.push( block.id );
			blockIdsByHtmlId.set( element.id, ids );
		}
		return block;
	}

	const root = toBlock( roots[ 0 ] );
	const scriptDetections = scripts.map( ( script, index ) => {
		const detection = detectScriptAction( script.code );
		const sourceIds = detection
			? blockIdsByHtmlId.get( detection.sourceHtmlId ) || []
			: [];
		const targetIds = detection
			? blockIdsByHtmlId.get( detection.targetHtmlId ) || []
			: [];
		if ( detection && sourceIds.length === 1 && targetIds.length === 1 ) {
			return {
				id: `script-${ index + 1 }`,
				status: 'recognized',
				code: script.code,
				description: detection.description,
				sourceBlockId: sourceIds[ 0 ],
				targetBlockId: targetIds[ 0 ],
				action: createStructuredAction( detection, targetIds[ 0 ] ),
			};
		}

		const action = createUnverifiedAction( script.code );
		root.actions = [ ...( root.actions || [] ), action ];
		return {
			id: `script-${ index + 1 }`,
			status: 'unverified',
			code: script.code,
			description: action.params.description,
			attachedBlockId: root.id,
		};
	} );

	return {
		document: {
			schema_version: 1,
			name: 'Imported layout',
			root,
		},
		warnings,
		scriptDetections,
		phpDetections: php.phpDetections,
	};
}
