import { attributesObject, classifyLink, NON_VISUAL_BODY_TAGS } from './HtmlDocumentParser.mjs';

/**
 * Separates document metadata/assets from visible render roots. The returned
 * object is JSON-safe except for renderRoots, whose DOM nodes are intentionally
 * private to the analysis pass.
 *
 * @param {Document} document  Parsed HTML document.
 * @param {Object}   detection Advisory source-detection result.
 * @return {Object} Decomposed import document.
 */
export function decomposeImportedDocument( document, detection = {} ) {
	const head = document.head;
	const body = document.body;
	const meta = [ ...head.querySelectorAll( 'meta' ) ].map( attributesObject );
	const links = [ ...head.querySelectorAll( 'link' ) ].map( ( link ) => {
		const attributes = attributesObject( link );
		return { ...attributes, relation: classifyLink( attributes ) };
	} );
	const styles = [ ...document.querySelectorAll( 'style' ) ].map(
		( style, index ) => ( {
			id: `style-${ index + 1 }`,
			sourceText: style.textContent || '',
			media: style.getAttribute( 'media' ) || undefined,
			attributes: attributesObject( style ),
			placement: style.closest( 'head' ) ? 'head' : 'body',
			order: index,
		} )
	);
	const scriptElements = [ ...document.querySelectorAll( 'script' ) ];
	const renderRoots = [ ...body.children ].filter(
		( element ) =>
			! NON_VISUAL_BODY_TAGS.has( element.tagName.toLowerCase() )
	);

	return {
		doctype: document.doctype?.name || undefined,
		htmlAttributes: attributesObject( document.documentElement ),
		bodyAttributes: attributesObject( body ),
		head: {
			title: document.title || undefined,
			meta,
			links,
			styles,
			scriptElements,
			baseHref:
				head.querySelector( 'base[href]' )?.getAttribute( 'href' ) ||
				undefined,
		},
		renderRoots,
		documentMetadata: {
			documentType:
				detection.documentShape === 'full-document'
					? 'full-document'
					: 'fragment',
			documentShape: detection.documentShape || 'unknown',
			title: document.title || undefined,
			meta,
			links,
		},
		baseUrl:
			head.querySelector( 'base[href]' )?.getAttribute( 'href' ) ||
			undefined,
	};
}

export function serializableDocumentModel( model ) {
	return {
		doctype: model.doctype,
		htmlAttributes: model.htmlAttributes,
		bodyAttributes: model.bodyAttributes,
		head: {
			title: model.head.title,
			meta: model.head.meta,
			links: model.head.links,
			styles: model.head.styles,
			baseHref: model.head.baseHref,
		},
		documentMetadata: model.documentMetadata,
		baseUrl: model.baseUrl,
		renderRootCount: model.renderRoots.length,
	};
}
