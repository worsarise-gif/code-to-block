export const SUPPORTED_HTML_TAGS = new Set( [
	'a',
	'address',
	'article',
	'aside',
	'audio',
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
	'datalist',
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
	'fieldset',
	'footer',
	'form',
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
	'input',
	'ins',
	'kbd',
	'label',
	'legend',
	'li',
	'main',
	'mark',
	'menu',
	'meter',
	'nav',
	'ol',
	'optgroup',
	'option',
	'output',
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
	'select',
	'small',
	'source',
	'span',
	'strong',
	'sub',
	'summary',
	'sup',
	'svg',
	'g',
	'defs',
	'symbol',
	'use',
	'path',
	'circle',
	'ellipse',
	'line',
	'polyline',
	'polygon',
	'rect',
	'table',
	'tbody',
	'td',
	'tfoot',
	'th',
	'thead',
	'time',
	'tr',
	'textarea',
	'u',
	'ul',
	'var',
	'video',
	'track',
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
	dialog: [ 'open' ],
	fieldset: [ 'disabled', 'form', 'name' ],
	form: [
		'action',
		'method',
		'enctype',
		'novalidate',
		'target',
		'autocomplete',
	],
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
	audio: [
		'src',
		'controls',
		'autoplay',
		'loop',
		'muted',
		'preload',
		'crossorigin',
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
	input: [
		'type',
		'name',
		'placeholder',
		'required',
		'value',
		'checked',
		'disabled',
		'min',
		'max',
		'maxlength',
		'pattern',
		'autocomplete',
		'readonly',
		'step',
	],
	ins: [ 'cite', 'datetime' ],
	label: [ 'for' ],
	li: [ 'value' ],
	meter: [ 'value', 'min', 'max', 'low', 'high', 'optimum' ],
	ol: [ 'start', 'reversed', 'type' ],
	optgroup: [ 'label', 'disabled' ],
	option: [ 'value', 'selected', 'disabled', 'label' ],
	output: [ 'for', 'form', 'name' ],
	progress: [ 'value', 'max' ],
	q: [ 'cite' ],
	select: [
		'name',
		'required',
		'disabled',
		'multiple',
		'size',
		'autocomplete',
	],
	slot: [ 'name' ],
	source: [ 'src', 'srcset', 'sizes', 'type', 'media', 'width', 'height' ],
	svg: [
		'viewbox',
		'width',
		'height',
		'fill',
		'stroke',
		'xmlns',
		'aria-hidden',
		'focusable',
	],
	g: [ 'fill', 'stroke', 'transform' ],
	use: [ 'href', 'xlink:href', 'x', 'y', 'width', 'height' ],
	path: [
		'd',
		'fill',
		'stroke',
		'stroke-width',
		'stroke-linecap',
		'stroke-linejoin',
		'transform',
	],
	circle: [ 'cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width' ],
	ellipse: [ 'cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width' ],
	line: [ 'x1', 'x2', 'y1', 'y2', 'stroke', 'stroke-width' ],
	polyline: [ 'points', 'fill', 'stroke', 'stroke-width' ],
	polygon: [ 'points', 'fill', 'stroke', 'stroke-width' ],
	rect: [
		'x',
		'y',
		'rx',
		'ry',
		'width',
		'height',
		'fill',
		'stroke',
		'stroke-width',
	],
	track: [ 'default', 'kind', 'label', 'src', 'srclang' ],
	td: [ 'colspan', 'rowspan', 'headers' ],
	th: [ 'colspan', 'rowspan', 'headers', 'scope', 'abbr' ],
	time: [ 'datetime' ],
	textarea: [
		'name',
		'placeholder',
		'required',
		'rows',
		'cols',
		'disabled',
		'maxlength',
		'readonly',
		'autocomplete',
	],
	video: [
		'src',
		'poster',
		'controls',
		'autoplay',
		'loop',
		'muted',
		'playsinline',
		'preload',
		'crossorigin',
		'width',
		'height',
	],
};

const NAVIGATION_PROTOCOLS = new Set( [ 'http', 'https', 'mailto', 'tel' ] );
const RESOURCE_PROTOCOLS = new Set( [ 'http', 'https' ] );
const BOOLEAN_ATTRIBUTES = new Set( [
	'disabled',
	'checked',
	'hidden',
	'multiple',
	'controls',
	'autoplay',
	'loop',
	'muted',
	'playsinline',
	'default',
	'novalidate',
	'open',
	'readonly',
	'required',
	'reversed',
	'selected',
] );

export function attributeIsAllowed( tag, name ) {
	if (
		GLOBAL_ATTRIBUTES.has( name ) ||
		/^(?:aria|data)-[a-z0-9_.:-]+$/.test( name )
	) {
		return true;
	}
	if (
		/^[a-z][a-z0-9._-]*-[a-z0-9._-]+$/.test( tag ) &&
		/^[a-z_:][a-z0-9:._-]*$/i.test( name ) &&
		! /^on/i.test( name ) &&
		name !== 'style'
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
		if ( [ 'href', 'action', 'formaction' ].includes( name ) ) {
			value = sanitizeResourceUrl( value, true );
		} else if (
			[ 'src', 'cite', 'poster', 'xlink:href' ].includes( name )
		) {
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
