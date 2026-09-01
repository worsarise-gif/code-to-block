import postcss from 'postcss';

import { sanitizeResourceUrl } from './html-policy.mjs';
import { STYLE_CONTROLS } from './controls/catalog.mjs';

const LEGACY_STYLE_CONTROL_FIELDS = [
	{
		property: 'padding',
		label: 'Padding',
		placeholder: '24px 32px',
		tier: 'advanced',
	},
	{
		property: 'margin',
		label: 'Margin',
		placeholder: '0 auto',
		tier: 'advanced',
	},
	// Typography
	{
		property: 'font-family',
		label: 'Font family',
		placeholder: 'Inter, sans-serif',
		options: [
			'Arial',
			'Helvetica',
			'Times New Roman',
			'Times',
			'Courier New',
			'Courier',
			'Verdana',
			'Georgia',
			'Palatino',
			'Garamond',
			'Bookman',
			'Comic Sans MS',
			'Trebuchet MS',
			'Arial Black',
			'Impact',
			'Inter, sans-serif',
			'sans-serif',
			'serif',
			'monospace',
		],
		tier: 'advanced',
	},
	{
		property: 'font-size',
		label: 'Font size',
		placeholder: '18px',
		tier: 'advanced',
	},
	{
		property: 'font-weight',
		label: 'Font weight',
		placeholder: '700',
		tier: 'advanced',
	},
	{
		property: 'line-height',
		label: 'Line height',
		placeholder: '1.5',
		tier: 'advanced',
	},
	{
		property: 'letter-spacing',
		label: 'Letter spacing',
		placeholder: '-0.02em',
		tier: 'advanced',
	},
	{
		property: 'text-transform',
		label: 'Text transform',
		placeholder: 'uppercase',
		options: [ 'none', 'capitalize', 'uppercase', 'lowercase' ],
		tier: 'advanced',
	},
	{
		property: 'text-decoration',
		label: 'Text decoration',
		placeholder: 'underline',
		options: [ 'none', 'underline', 'overline', 'line-through' ],
		tier: 'advanced',
	},
	{
		property: '-webkit-text-stroke',
		label: 'Text stroke',
		placeholder: '1px black',
		tier: 'advanced',
	},
	// Border
	{
		property: 'border',
		label: 'Border',
		placeholder: '1px solid #ccc',
		tier: 'simple',
	},
	{
		property: 'border-top',
		label: 'Border top',
		placeholder: '1px solid #ccc',
		tier: 'advanced',
	},
	{
		property: 'border-right',
		label: 'Border right',
		placeholder: '1px solid #ccc',
		tier: 'advanced',
	},
	{
		property: 'border-bottom',
		label: 'Border bottom',
		placeholder: '1px solid #ccc',
		tier: 'advanced',
	},
	{
		property: 'border-left',
		label: 'Border left',
		placeholder: '1px solid #ccc',
		tier: 'advanced',
	},
	{
		property: 'border-radius',
		label: 'Border radius',
		placeholder: '12px',
		tier: 'simple',
	},
	// Layout — Flexbox & Grid (advanced per File 10, visible in Advanced mode; conditional on display)
	{
		property: 'display',
		label: 'Display / Layout mode',
		placeholder: 'flex | grid | block',
		options: [
			'block',
			'inline-block',
			'flex',
			'inline-flex',
			'grid',
			'inline-grid',
			'none',
		],
		tier: 'advanced',
	},
	{
		property: 'flex-direction',
		label: 'Flex direction',
		placeholder: 'row | column',
		options: [ 'row', 'row-reverse', 'column', 'column-reverse' ],
		tier: 'advanced',
	},
	{
		property: 'flex-wrap',
		label: 'Flex wrap',
		placeholder: 'nowrap | wrap',
		options: [ 'nowrap', 'wrap', 'wrap-reverse' ],
		tier: 'advanced',
	},
	{
		property: 'justify-content',
		label: 'Justify content',
		placeholder: 'flex-start | center | space-between',
		options: [
			'flex-start',
			'flex-end',
			'center',
			'space-between',
			'space-around',
			'space-evenly',
		],
		tier: 'advanced',
	},
	{
		property: 'align-items',
		label: 'Align items',
		placeholder: 'stretch | center | flex-start',
		options: [ 'stretch', 'flex-start', 'flex-end', 'center', 'baseline' ],
		tier: 'advanced',
	},
	{
		property: 'align-content',
		label: 'Align content',
		placeholder: 'stretch | center',
		options: [
			'stretch',
			'flex-start',
			'flex-end',
			'center',
			'space-between',
			'space-around',
		],
		tier: 'advanced',
	},
	{ property: 'gap', label: 'Gap', placeholder: '16px', tier: 'advanced' },
	{
		property: 'row-gap',
		label: 'Row gap',
		placeholder: '16px',
		tier: 'advanced',
	},
	{
		property: 'column-gap',
		label: 'Column gap',
		placeholder: '16px',
		tier: 'advanced',
	},
	{
		property: 'grid-template-columns',
		label: 'Grid columns',
		placeholder: 'repeat(3, 1fr)',
		tier: 'advanced',
	},
	{
		property: 'grid-template-rows',
		label: 'Grid rows',
		placeholder: 'auto',
		tier: 'advanced',
	},
	// Per-child layout (advanced — layout mode dependent on parent)
	{
		property: 'flex-grow',
		label: 'Flex grow',
		placeholder: '1',
		tier: 'advanced',
	},
	{
		property: 'flex-shrink',
		label: 'Flex shrink',
		placeholder: '1',
		tier: 'advanced',
	},
	{
		property: 'flex-basis',
		label: 'Flex basis',
		placeholder: '200px',
		tier: 'advanced',
	},
	{
		property: 'align-self',
		label: 'Align self',
		placeholder: 'auto | center',
		options: [
			'auto',
			'flex-start',
			'flex-end',
			'center',
			'baseline',
			'stretch',
		],
		tier: 'advanced',
	},
	{
		property: 'order',
		label: 'Order',
		placeholder: '0 | 1',
		tier: 'advanced',
	},
	{
		property: 'grid-column',
		label: 'Grid column',
		placeholder: 'span 2 | 1 / 3',
		tier: 'advanced',
	},
	{
		property: 'grid-row',
		label: 'Grid row',
		placeholder: 'span 2',
		tier: 'advanced',
	},
	// Sizing — width/max-width simple, rest advanced
	{
		property: 'width',
		label: 'Width',
		placeholder: '100% | 320px',
		tier: 'simple',
	},
	{
		property: 'height',
		label: 'Height',
		placeholder: 'auto | 400px',
		tier: 'advanced',
	},
	{
		property: 'max-width',
		label: 'Max width',
		placeholder: '720px',
		tier: 'simple',
	},
	{
		property: 'min-height',
		label: 'Min height',
		placeholder: '400px',
		tier: 'advanced',
	},
	{
		property: 'object-fit',
		label: 'Object fit',
		placeholder: 'cover | contain',
		options: [ 'fill', 'contain', 'cover', 'none', 'scale-down' ],
		tier: 'advanced',
	},
	{
		property: 'object-position',
		label: 'Object position',
		placeholder: 'center top',
		tier: 'advanced',
	},
	// Positioning & layering (all advanced per File 10)
	{
		property: 'position',
		label: 'Position',
		placeholder: 'static | relative | absolute | sticky',
		options: [ 'static', 'relative', 'absolute', 'fixed', 'sticky' ],
		tier: 'advanced',
	},
	{
		property: 'top',
		label: 'Top',
		placeholder: '0 | 16px',
		tier: 'advanced',
	},
	{ property: 'right', label: 'Right', placeholder: '0', tier: 'advanced' },
	{ property: 'bottom', label: 'Bottom', placeholder: '0', tier: 'advanced' },
	{ property: 'left', label: 'Left', placeholder: '0', tier: 'advanced' },
	{
		property: 'z-index',
		label: 'Z-index',
		placeholder: '10',
		tier: 'advanced',
	},
	// Visual group controls (advanced — except background-color)
	{
		property: 'background',
		label: 'Background',
		placeholder: 'linear-gradient(...), #fff',
		tier: 'advanced',
	},
	{
		property: 'background-color',
		label: 'Background color',
		placeholder: '#ffffff',
		tier: 'simple',
	},
	{
		property: 'background-image',
		label: 'Background image',
		placeholder: 'url(image.jpg)',
		tier: 'advanced',
	},
	{
		property: 'background-size',
		label: 'Background size',
		placeholder: 'cover | contain',
		tier: 'advanced',
	},
	{
		property: 'background-position',
		label: 'Background position',
		placeholder: 'center',
		tier: 'advanced',
	},
	{
		property: 'box-shadow',
		label: 'Box shadow',
		placeholder: '0 4px 12px rgba(0,0,0,0.1)',
		tier: 'advanced',
	},
	{
		property: 'opacity',
		label: 'Opacity',
		placeholder: '1 | 0.8',
		tier: 'advanced',
	},
	{
		property: 'filter',
		label: 'Filter',
		placeholder: 'blur(4px) brightness(1.1)',
		tier: 'advanced',
	},
	{
		property: 'backdrop-filter',
		label: 'Backdrop filter',
		placeholder: 'blur(8px)',
		tier: 'advanced',
	},
	{
		property: 'transform',
		label: 'Transform',
		placeholder: 'translateY(4px) rotate(2deg)',
		tier: 'advanced',
	},
	{
		property: 'text-shadow',
		label: 'Text shadow',
		placeholder: '0 1px 2px rgba(0,0,0,0.2)',
		tier: 'advanced',
	},
	{
		property: 'overflow',
		label: 'Overflow',
		placeholder: 'hidden | visible',
		options: [ 'visible', 'hidden', 'clip', 'scroll', 'auto' ],
		tier: 'advanced',
	},
];

const legacyProperties = new Set(
	LEGACY_STYLE_CONTROL_FIELDS.map( ( field ) => field.property )
);

export const STYLE_CONTROL_FIELDS = Object.freeze( [
	...LEGACY_STYLE_CONTROL_FIELDS,
	...Object.values( STYLE_CONTROLS )
		.filter(
			( control ) =>
				control.property !== 'color' &&
				! legacyProperties.has( control.property )
		)
		.map( ( control ) => ( {
			property: control.property,
			label: control.label,
			placeholder: control.placeholder,
			options: control.options.length ? control.options : undefined,
			tier: 'advanced',
		} ) ),
] );

export const MAPPED_STYLE_PROPERTIES = new Set( [
	'color',
	...STYLE_CONTROL_FIELDS.map( ( field ) => field.property ),
] );

// Centralized conditional-visibility system (fixes File 9 failure #1, reused by File 10 for Simple/Advanced)
// Layout-mode (display) + panel mode (simple/advanced) + search govern visibility. Single place.
const FLEX_CONTAINER_CONTROLS = new Set( [
	'flex-direction',
	'flex-wrap',
	'justify-content',
	'align-items',
	'align-content',
	'gap',
	'row-gap',
	'column-gap',
] );
const FLEX_CHILD_CONTROLS = new Set( [
	'flex-grow',
	'flex-shrink',
	'flex-basis',
	'align-self',
	'order',
] );
const GRID_CONTAINER_CONTROLS = new Set( [
	'grid-template-columns',
	'grid-template-rows',
	'gap',
	'row-gap',
	'column-gap',
] );
const GRID_CHILD_CONTROLS = new Set( [ 'grid-column', 'grid-row' ] );

function matchesSearch( field, query ) {
	if ( ! query ) {
		return false;
	}
	const q = String( query ).trim().toLowerCase();
	if ( ! q ) {
		return false;
	}
	return (
		field.label.toLowerCase().includes( q ) ||
		field.property.toLowerCase().includes( q )
	);
}

export function isMappedControlVisible(
	property,
	displayValue,
	parentDisplayValue,
	mode,
	searchQuery,
	field
) {
	// Search filters the panel and lets matching controls bypass tier/layout gates.
	if ( String( searchQuery || '' ).trim() ) {
		return Boolean( field && matchesSearch( field, searchQuery ) );
	}
	// Tier gate: simple mode hides advanced controls (File 10) — reuse same system as layout
	if ( mode === 'simple' && field && field.tier === 'advanced' ) {
		return false;
	}
	// Layout gate (File 9)
	const display = String( displayValue || '' )
		.trim()
		.toLowerCase();
	const parentDisplay = String( parentDisplayValue || '' )
		.trim()
		.toLowerCase();
	const isFlex = 'flex' === display || 'inline-flex' === display;
	const isGrid = 'grid' === display || 'inline-grid' === display;
	const isParentFlex =
		'flex' === parentDisplay || 'inline-flex' === parentDisplay;
	const isParentGrid =
		'grid' === parentDisplay || 'inline-grid' === parentDisplay;

	if ( FLEX_CONTAINER_CONTROLS.has( property ) && ! isFlex ) {
		return false;
	}
	if ( GRID_CONTAINER_CONTROLS.has( property ) && ! isGrid ) {
		return false;
	}
	if ( FLEX_CHILD_CONTROLS.has( property ) && ! isParentFlex ) {
		return false;
	}
	if ( GRID_CHILD_CONTROLS.has( property ) && ! isParentGrid ) {
		return false;
	}

	return true;
}

export function controlVisibilityReason(
	property,
	displayValue,
	parentDisplayValue,
	mode,
	field
) {
	if ( mode === 'simple' && field && field.tier === 'advanced' ) {
		return 'Advanced — switch to Advanced mode to edit';
	}
	const display = String( displayValue || '' )
		.trim()
		.toLowerCase();
	const parentDisplay = String( parentDisplayValue || '' )
		.trim()
		.toLowerCase();

	if (
		FLEX_CONTAINER_CONTROLS.has( property ) &&
		display !== 'flex' &&
		display !== 'inline-flex'
	) {
		return 'Flex controls apply when Display is flex';
	}
	if (
		GRID_CONTAINER_CONTROLS.has( property ) &&
		display !== 'grid' &&
		display !== 'inline-grid'
	) {
		return 'Grid controls apply when Display is grid';
	}
	if (
		FLEX_CHILD_CONTROLS.has( property ) &&
		parentDisplay !== 'flex' &&
		parentDisplay !== 'inline-flex'
	) {
		return 'Flex child controls apply when parent Display is flex';
	}
	if (
		GRID_CHILD_CONTROLS.has( property ) &&
		parentDisplay !== 'grid' &&
		parentDisplay !== 'inline-grid'
	) {
		return 'Grid child controls apply when parent Display is grid';
	}

	return '';
}

export function styleControlLabel( property ) {
	if ( property === 'color' ) {
		return 'Color';
	}
	return (
		STYLE_CONTROL_FIELDS.find( ( field ) => field.property === property )
			?.label || property
	);
}

export function mergeMappedStyleUpdates( mapped, updates ) {
	const result = { ...mapped };
	for ( const [ property, value ] of Object.entries( updates ) ) {
		if ( ! MAPPED_STYLE_PROPERTIES.has( property ) ) {
			continue;
		}
		if ( value ) {
			result[ property ] = value;
		} else {
			delete result[ property ];
		}
	}

	return result;
}

function declarationText( declaration ) {
	return `${ declaration.prop }: ${ declaration.value }${
		declaration.important ? ' !important' : ''
	};`;
}

export function assertSafeCssDeclaration( property, value ) {
	if ( /^(?:behavior|-moz-binding)$/i.test( property ) ) {
		throw new Error( `Unsupported CSS property: ${ property }.` );
	}
	if ( /expression\s*\(|@import|<\s*\/\s*style/i.test( value ) ) {
		throw new Error( `Unsafe CSS value for ${ property }.` );
	}

	let urlCount = 0;
	const remaining = value.replace(
		/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
		( match, quote, url ) => {
			urlCount += 1;
			if ( url.includes( '\\' ) || ! sanitizeResourceUrl( url, false ) ) {
				throw new Error( `Unsafe CSS URL for ${ property }.` );
			}
			return '';
		}
	);
	if (
		/url\s*\(/i.test( remaining ) ||
		( /url\s*\(/i.test( value ) && ! urlCount )
	) {
		throw new Error( `Malformed CSS URL for ${ property }.` );
	}
}

export function splitResolvedStyles( resolved ) {
	const mapped = {};
	const fallback = [];
	const explanation = [];

	for ( const [ property, declaration ] of [ ...resolved ].sort(
		( [ left ], [ right ] ) => left.localeCompare( right )
	) ) {
		assertSafeCssDeclaration( property, declaration.value );
		const isMapped = MAPPED_STYLE_PROPERTIES.has( property );
		if ( isMapped ) {
			mapped[ property ] = declaration.value;
		} else {
			fallback.push(
				declarationText( { ...declaration, prop: property } )
			);
		}
		explanation.push( {
			property,
			value: declaration.value,
			important: Boolean( declaration.important ),
			origin: declaration.origin || 'stylesheet',
			destination: isMapped ? 'style-control' : 'raw-css',
			...( isMapped ? { control: property } : {} ),
		} );
	}

	return {
		mapped,
		custom_css_fallback: fallback.join( '\n' ),
		explanation,
	};
}

export function normalizeCustomCssFallback( value ) {
	if ( ! value.trim() ) {
		return '';
	}

	let root;
	try {
		root = postcss.parse( `.ctb-fallback {${ value }}` );
	} catch ( error ) {
		throw new Error( `Invalid CSS: ${ error.reason || error.message }` );
	}

	if ( root.nodes.length !== 1 || root.first.type !== 'rule' ) {
		throw new Error( 'Raw CSS must contain declarations only.' );
	}
	if ( root.first.nodes.some( ( node ) => node.type !== 'decl' ) ) {
		throw new Error( 'Raw CSS must contain declarations only.' );
	}
	for ( const declaration of root.first.nodes ) {
		assertSafeCssDeclaration( declaration.prop, declaration.value );
	}

	return root.first.nodes.map( declarationText ).join( '\n' );
}

export function previewCustomCssFallback( value ) {
	const normalized = normalizeCustomCssFallback( value );
	if ( ! normalized ) {
		return '';
	}

	const root = postcss.parse( `.ctb-fallback {${ normalized }}` );
	return root.first.nodes
		.map( ( declaration ) =>
			declarationText( {
				...declaration,
				important:
					declaration.important ||
					! MAPPED_STYLE_PROPERTIES.has( declaration.prop ),
			} )
		)
		.join( '\n' );
}
