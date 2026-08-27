export const SUPPORTED_HTML_TAGS = new Set( [
	'a',
	'address',
	'article',
	'aside',
	'b',
	'bdi',
	'bdo',
	'blockquote',
	'br',
	'button',
	'cite',
	'code',
	'col',
	'colgroup',
	'data',
	'dd',
	'del',
	'details',
	'dfn',
	'div',
	'dl',
	'dt',
	'em',
	'figcaption',
	'figure',
	'footer',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'header',
	'hgroup',
	'hr',
	'i',
	'iframe',
	'img',
	'ins',
	'kbd',
	'label',
	'li',
	'main',
	'mark',
	'menu',
	'meter',
	'nav',
	'ol',
	'p',
	'picture',
	'pre',
	'progress',
	'q',
	'rp',
	'rt',
	'ruby',
	's',
	'samp',
	'section',
	'small',
	'source',
	'span',
	'strong',
	'sub',
	'summary',
	'sup',
	'table',
	'tbody',
	'td',
	'tfoot',
	'th',
	'thead',
	'time',
	'tr',
	'u',
	'ul',
	'var',
	'wbr',
] );

const GLOBAL_ATTRIBUTES = new Set( [
	'class',
	'id',
	'title',
	'lang',
	'dir',
	'hidden',
	'tabindex',
	'role',
	'translate',
	'spellcheck',
	'draggable',
	'contenteditable',
] );

const ATTRIBUTES_BY_TAG = {
	a: [ 'href', 'target', 'rel', 'download', 'hreflang', 'type' ],
	blockquote: [ 'cite' ],
	button: [ 'type', 'name', 'value', 'disabled' ],
	col: [ 'span' ],
	data: [ 'value' ],
	del: [ 'cite', 'datetime' ],
	details: [ 'open' ],
	iframe: [
		'src',
		'title',
		'loading',
		'width',
		'height',
		'allow',
		'allowfullscreen',
		'referrerpolicy',
		'sandbox',
	],
	img: [
		'src',
		'alt',
		'width',
		'height',
		'loading',
		'decoding',
		'srcset',
		'sizes',
	],
	ins: [ 'cite', 'datetime' ],
	label: [ 'for' ],
	li: [ 'value' ],
	meter: [ 'value', 'min', 'max', 'low', 'high', 'optimum' ],
	ol: [ 'start', 'reversed', 'type' ],
	progress: [ 'value', 'max' ],
	q: [ 'cite' ],
	source: [ 'src', 'srcset', 'sizes', 'type', 'media', 'width', 'height' ],
	td: [ 'colspan', 'rowspan', 'headers' ],
	th: [ 'colspan', 'rowspan', 'headers', 'scope', 'abbr' ],
	time: [ 'datetime' ],
};

const NAVIGATION_PROTOCOLS = new Set( [ 'http', 'https', 'mailto', 'tel' ] );
const RESOURCE_PROTOCOLS = new Set( [ 'http', 'https' ] );
const BOOLEAN_ATTRIBUTES = new Set( [
	'disabled',
	'hidden',
	'open',
	'reversed',
] );

export function attributeIsAllowed( tag, name ) {
	if (
		GLOBAL_ATTRIBUTES.has( name ) ||
		/^(?:aria|data)-[a-z0-9_.:-]+$/.test( name )
	) {
		return true;
	}

	return ATTRIBUTES_BY_TAG[ tag ]?.includes( name ) || false;
}

export function sanitizeResourceUrl( value, navigation = false ) {
	const trimmed = String( value ).trim();
	if ( ! trimmed ) {
		return '';
	}

	const compact = trimmed.replace( /[\u0000-\u0020\u007f]+/g, '' );
	const scheme = compact.match( /^([a-z][a-z0-9+.-]*):/i );
	if ( ! scheme ) {
		return trimmed;
	}

	const allowed = navigation ? NAVIGATION_PROTOCOLS : RESOURCE_PROTOCOLS;
	return allowed.has( scheme[ 1 ].toLowerCase() ) ? trimmed : '';
}

export function sanitizeSrcset( value ) {
	const candidates = String( value )
		.split( ',' )
		.map( ( candidate ) => candidate.trim() )
		.filter( Boolean )
		.map( ( candidate ) => {
			const parts = candidate.split( /\s+/ );
			const url = sanitizeResourceUrl( parts.shift(), false );
			const descriptor = parts.join( ' ' );
			if (
				! url ||
				( descriptor &&
					! /^(?:\d+w|(?:\d+(?:\.\d+)?|\.\d+)x)$/.test( descriptor ) )
			) {
				return '';
			}
			return descriptor ? `${ url } ${ descriptor }` : url;
		} )
		.filter( Boolean );

	return candidates.join( ', ' );
}

export function sanitizeElementAttributes( element, tag ) {
	const attributes = {};
	for ( const attribute of element.attributes ) {
		const name = attribute.name.toLowerCase();
		if ( ! attributeIsAllowed( tag, name ) ) {
			continue;
		}

		let value = attribute.value;
		if ( name === 'href' ) {
			value = sanitizeResourceUrl( value, true );
		} else if ( [ 'src', 'cite' ].includes( name ) ) {
			value = sanitizeResourceUrl( value, false );
		} else if ( name === 'srcset' ) {
			value = sanitizeSrcset( value );
		}
		if ( BOOLEAN_ATTRIBUTES.has( name ) && element.hasAttribute( name ) ) {
			attributes[ name ] = true;
		} else if ( value ) {
			attributes[ name ] = value;
		}
	}

	return attributes;
}
