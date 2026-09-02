import { blockTypeFor } from '../../block-type.mjs';
import { SUPPORTED_HTML_TAGS } from '../../html-policy.mjs';

const SAFE_GENERIC_HTML_TAGS = new Set( [ 'dialog', 'slot', 'template' ] );

export function isCustomElementTag( tagName ) {
	return /^[a-z][a-z0-9._-]*-[a-z0-9._-]+$/.test(
		String( tagName || '' ).toLowerCase()
	);
}

export function isSafeGenericElementTag( tagName ) {
	const tag = String( tagName || '' ).toLowerCase();
	return (
		SUPPORTED_HTML_TAGS.has( tag ) ||
		SAFE_GENERIC_HTML_TAGS.has( tag ) ||
		isCustomElementTag( tag )
	);
}

export class BlockAdapterRegistry {
	#adapters = [];

	register( adapter ) {
		if (
			! adapter ||
			typeof adapter.id !== 'string' ||
			typeof adapter.supports !== 'function' ||
			typeof adapter.describe !== 'function'
		) {
			throw new TypeError(
				'A DOM block adapter needs id, supports, and describe.'
			);
		}
		this.#adapters.push( adapter );
		return this;
	}

	resolve( element, context = {} ) {
		return this.#adapters.find( ( adapter ) =>
			adapter.supports( element, context )
		);
	}
}

export function createDefaultBlockAdapterRegistry() {
	return new BlockAdapterRegistry()
		.register( {
			id: 'native-html',
			fidelity: 'native',
			supports: ( element ) =>
				SUPPORTED_HTML_TAGS.has( element.tagName.toLowerCase() ),
			describe: ( element ) => ( {
				tag: element.tagName.toLowerCase(),
				type: blockTypeFor( element ),
				fidelity: 'native',
			} ),
		} )
		.register( {
			id: 'generic-element',
			fidelity: 'hybrid',
			supports: ( element ) =>
				isSafeGenericElementTag( element.tagName.toLowerCase() ),
			describe: ( element ) => ( {
				tag: element.tagName.toLowerCase(),
				type:
					element.children.length === 0 &&
					! [ 'dialog', 'slot', 'template' ].includes(
						element.tagName.toLowerCase()
					)
						? 'text'
						: 'container',
				fidelity: 'hybrid',
			} ),
		} )
		.register( {
			id: 'preserved-fallback',
			fidelity: 'preserved',
			supports: () => true,
			describe: ( element ) => ( {
				tag: 'div',
				type: 'container',
				fidelity: 'preserved',
				originalTag: element.tagName.toLowerCase(),
			} ),
		} );
}

export function childNodesForElement( element ) {
	if ( element.tagName.toLowerCase() === 'template' && element.content ) {
		return [ ...element.content.childNodes ];
	}
	return [ ...element.childNodes ];
}

export function createFallbackBlock( element, context, error ) {
	const sourceTag = element?.tagName?.toLowerCase() || 'unknown';
	const source = String( element?.outerHTML || '' ).slice( 0, 131072 );
	const text = String( element?.textContent || '' );
	return {
		id: context.makeId( 'fallback' ),
		type: 'container',
		tag: 'div',
		attributes: {
			'data-ctb-fallback': 'preserved',
			'data-ctb-original-tag': sourceTag,
		},
		children: text ? [ { kind: 'text', value: text } ] : [],
		styles: { mapped: {}, custom_css_fallback: '' },
		meta: {
			source: 'pasted-html-css',
			imported_original_tag: sourceTag,
			imported_source: source,
			fallback_reason: String(
				error?.message || 'Conversion failed.'
			).slice( 0, 1000 ),
		},
	};
}
