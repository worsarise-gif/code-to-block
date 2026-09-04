import { getElement } from './registry.mjs';

function safeLinkUrl( value ) {
	const url = typeof value === 'string' ? value.trim() : '';
	return /^(?:javascript|data|vbscript):/i.test( url ) ? '' : url;
}

export function resolveTextRenderModel( block ) {
	const definition = getElement( block?.element );
	if (
		! definition ||
		definition.rendererFamily !== 'text' ||
		! definition.styleTargets.some( ( target ) => target.id === 'text' )
	) {
		return null;
	}

	const href = safeLinkUrl( block?.attributes?.[ 'data-link-url' ] );
	return Object.freeze( {
		href,
		tag: href ? 'a' : 'span',
	} );
}

export function createTextTargetNodes( block, content, createNode ) {
	const model = resolveTextRenderModel( block );
	if ( ! model || typeof createNode !== 'function' ) {
		return null;
	}
	const attributes = {
		key: 'text',
		'data-ctb-part': 'text',
	};
	if ( model.href ) {
		attributes.href = model.href;
		attributes.onClick = ( event ) => event.preventDefault();
	}
	return [ createNode( model.tag, attributes, content ) ];
}
