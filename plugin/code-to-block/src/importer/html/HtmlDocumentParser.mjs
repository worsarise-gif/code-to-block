export const NON_VISUAL_BODY_TAGS = new Set( [
	'base',
	'link',
	'meta',
	'script',
	'style',
	'title',
] );

export function attributesObject( element ) {
	return Object.fromEntries(
		[ ...( element?.attributes || [] ) ].map( ( attribute ) => [
			attribute.name.toLowerCase(),
			attribute.value,
		] )
	);
}

export function classifyLink( attributes ) {
	const relations = String( attributes.rel || '' )
		.toLowerCase()
		.split( /\s+/ )
		.filter( Boolean );
	for ( const relation of [
		'stylesheet',
		'preconnect',
		'preload',
		'canonical',
		'icon',
		'alternate',
	] ) {
		if ( relations.includes( relation ) ) {
			return relation;
		}
	}
	return 'other';
}

export function parseImportedHtml( source, runtimeWindow = globalThis.window ) {
	if ( ! runtimeWindow?.DOMParser ) {
		throw new Error( 'The HTML import runtime is unavailable.' );
	}
	return new runtimeWindow.DOMParser().parseFromString(
		String( source || '' ),
		'text/html'
	);
}

export function parseImportedFragment(
	source,
	runtimeWindow = globalThis.window
) {
	const document = parseImportedHtml( source, runtimeWindow );
	return {
		document,
		fragment: document.body,
	};
}

export {
	decomposeImportedDocument,
	serializableDocumentModel,
} from './HtmlDocumentDecomposer.mjs';
