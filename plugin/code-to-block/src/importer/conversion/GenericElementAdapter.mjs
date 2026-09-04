import { createPrimitiveBlock } from '../../store/block-commands.mjs';
import { attributesObject } from '../html/HtmlDocumentParser.mjs';

/**
 * Parses a raw inline style string into an object of CSS property/value pairs.
 * Complex values (e.g. containing var(), calc()) are separated out as fallback
 * CSS because the builder's mapped style system may not handle them natively.
 *
 * @param {string} styleString Raw CSS inline style text.
 * @return {{ mapped: Object, fallback: string }}
 */
function parseInlineStyle( styleString ) {
	const mapped = {};
	const fallbackParts = [];

	if ( ! styleString || ! styleString.trim() ) {
		return { mapped, fallback: '' };
	}

	// Split on semicolons but respect parentheses (e.g. rgb(), calc())
	const declarations = [];
	let current = '';
	let parenDepth = 0;
	for ( let i = 0; i < styleString.length; i++ ) {
		const ch = styleString[ i ];
		if ( ch === '(' ) {
			parenDepth++;
		} else if ( ch === ')' ) {
			parenDepth = Math.max( 0, parenDepth - 1 );
		} else if ( ch === ';' && parenDepth === 0 ) {
			declarations.push( current.trim() );
			current = '';
			continue;
		}
		current += ch;
	}
	if ( current.trim() ) {
		declarations.push( current.trim() );
	}

	for ( const declaration of declarations ) {
		const colonIndex = declaration.indexOf( ':' );
		if ( colonIndex === -1 ) {
			continue;
		}
		const property = declaration.substring( 0, colonIndex ).trim().toLowerCase();
		const value = declaration.substring( colonIndex + 1 ).trim();
		if ( ! property || ! value ) {
			continue;
		}
		// Store all declarations in mapped — the builder renders them via
		// previewDeclarations which simply iterates mapped entries.
		mapped[ property ] = value.replace( /\s*!important\s*$/i, '' );
	}

	return { mapped, fallback: fallbackParts.join( ' ' ) };
}

/**
 * The ultimate fallback adapter for valid HTML elements that have no
 * native builder equivalent. Instead of discarding the element, this
 * adapter preserves it as a "Generic HTML Element" block.
 */
export const genericElementAdapter = {
	fidelity: 'hybrid',
	
	supports( element ) {
		return element.nodeType === Node.ELEMENT_NODE;
	},

	convert( element, context ) {
		const block = createPrimitiveBlock( 'container' );
		block.type = 'generic_element'; // Override type to track that this is a generic fallback
		block.tag = element.tagName.toLowerCase();
		
		const attributes = attributesObject( element );
		// Store the native classes and ID in the preserved metadata
		if ( attributes.id ) {
			block.htmlId = attributes.id;
			delete attributes.id;
		}

		// Preserve class names both in classList (for backwards compat) and
		// in attributes.class (so the canvas renderer can match scoped CSS
		// selectors against the rendered DOM elements).
		if ( attributes.class ) {
			block.classList = attributes.class.split( /\s+/ ).filter( Boolean );
			// Keep classes in attributes so they render on the DOM element
			// and can be matched by scoped imported stylesheets.
		}

		// Parse inline styles into the builder's native style format so
		// they are rendered by buildPreviewStyles / previewDeclarations.
		if ( attributes.style ) {
			const { mapped, fallback } = parseInlineStyle( attributes.style );
			if ( ! block.styles ) {
				block.styles = {};
			}
			block.styles.mapped = {
				...( block.styles.mapped || {} ),
				...mapped,
			};
			if ( fallback ) {
				block.styles.custom_css_fallback =
					( block.styles.custom_css_fallback || '' ) + fallback;
			}
			// Also keep as inlineStyle for any consumers that still read it
			block.inlineStyle = attributes.style;
			delete attributes.style;
		}

		block.attributes = attributes;
		
		// Recursively process children
		block.children = Array.from( element.childNodes )
			.map( child => context.convertNode( child ) )
			.filter( Boolean );

		return block;
	}
};
