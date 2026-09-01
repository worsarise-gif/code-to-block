const REACT_ATTRIBUTE_NAMES = Object.freeze( {
	class: 'className',
	for: 'htmlFor',
	tabindex: 'tabIndex',
	contenteditable: 'contentEditable',
	spellcheck: 'spellCheck',
	autocomplete: 'autoComplete',
	autoplay: 'autoPlay',
	crossorigin: 'crossOrigin',
	datetime: 'dateTime',
	enctype: 'encType',
	formaction: 'formAction',
	formenctype: 'formEncType',
	formmethod: 'formMethod',
	formnovalidate: 'formNoValidate',
	formtarget: 'formTarget',
	hreflang: 'hrefLang',
	maxlength: 'maxLength',
	minlength: 'minLength',
	novalidate: 'noValidate',
	readonly: 'readOnly',
	referrerpolicy: 'referrerPolicy',
	srcset: 'srcSet',
	usemap: 'useMap',
	allowfullscreen: 'allowFullScreen',
	playsinline: 'playsInline',
	colspan: 'colSpan',
	rowspan: 'rowSpan',
	cellpadding: 'cellPadding',
	cellspacing: 'cellSpacing',
	viewbox: 'viewBox',
	preserveaspectratio: 'preserveAspectRatio',
	gradientunits: 'gradientUnits',
	gradienttransform: 'gradientTransform',
	markerheight: 'markerHeight',
	markerwidth: 'markerWidth',
	markerunits: 'markerUnits',
	refx: 'refX',
	refy: 'refY',
	textlength: 'textLength',
	lengthadjust: 'lengthAdjust',
	'xlink:href': 'xlinkHref',
	'stroke-width': 'strokeWidth',
	'stroke-linecap': 'strokeLinecap',
	'stroke-linejoin': 'strokeLinejoin',
} );

/**
 * Converts safe, DOM-shaped imported attributes into the names expected by
 * React. Data and ARIA attributes intentionally pass through unchanged.
 *
 * @param {Object} source Sanitized attributes stored in a builder block.
 * @return {Object} Attributes ready for createElement().
 */
export function normalizeReactAttributes( source = {} ) {
	const normalized = {};
	for ( const [ name, value ] of Object.entries( source || {} ) ) {
		const reactName = REACT_ATTRIBUTE_NAMES[ name.toLowerCase() ] || name;
		normalized[ reactName ] = value;
	}
	return normalized;
}
