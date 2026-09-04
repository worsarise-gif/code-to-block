const CSS_WIDE_KEYWORDS = [
	'inherit',
	'initial',
	'revert',
	'revert-layer',
	'unset',
];

const CONTROL_GROUPS = {
	typography: {
		id: 'typography',
		label: 'Typography',
		properties: [
			'font-family',
			'font-size',
			'font-weight',
			'font-style',
			'line-height',
			'letter-spacing',
			'text-transform',
			'text-decoration',
			'text-shadow',
			'-webkit-text-stroke',
		],
	},
	text: {
		id: 'text',
		label: 'Text',
		properties: [
			'color',
			'text-align',
			'text-indent',
			'white-space',
			'overflow-wrap',
			'word-break',
			'hyphens',
		],
	},
	background: {
		id: 'background',
		label: 'Background',
		properties: [
			'background',
			'background-color',
			'background-image',
			'background-size',
			'background-position',
			'background-repeat',
			'background-attachment',
			'background-blend-mode',
		],
	},
	border: {
		id: 'border',
		label: 'Border',
		properties: [
			'border',
			'border-top',
			'border-right',
			'border-bottom',
			'border-left',
			'border-radius',
			'outline',
			'outline-offset',
		],
	},
	shadow: {
		id: 'shadow',
		label: 'Shadow',
		properties: [ 'box-shadow' ],
	},
	spacing: {
		id: 'spacing',
		label: 'Spacing',
		properties: [
			'padding',
			'padding-top',
			'padding-right',
			'padding-bottom',
			'padding-left',
			'margin',
			'margin-top',
			'margin-right',
			'margin-bottom',
			'margin-left',
		],
	},
	sizing: {
		id: 'sizing',
		label: 'Sizing',
		properties: [
			'width',
			'min-width',
			'max-width',
			'height',
			'min-height',
			'max-height',
			'aspect-ratio',
		],
	},
	alignment: {
		id: 'alignment',
		label: 'Alignment',
		properties: [ 'text-align', 'align-self' ],
	},
	layout: {
		id: 'layout',
		label: 'Layout',
		properties: [
			'display',
			'justify-content',
			'align-items',
			'align-content',
			'gap',
			'row-gap',
			'column-gap',
		],
	},
	flex: {
		id: 'flex',
		label: 'Flex layout',
		properties: [ 'flex-direction', 'flex-wrap' ],
	},
	grid: {
		id: 'grid',
		label: 'Grid layout',
		properties: [
			'grid-template-columns',
			'grid-template-rows',
			'grid-auto-flow',
			'grid-auto-columns',
			'grid-auto-rows',
			'justify-items',
		],
	},
	childPlacement: {
		id: 'childPlacement',
		label: 'Parent layout item',
		properties: [
			'flex-grow',
			'flex-shrink',
			'flex-basis',
			'order',
			'align-self',
			'grid-column',
			'grid-row',
			'grid-area',
			'justify-self',
		],
	},
	media: {
		id: 'media',
		label: 'Media',
		properties: [
			'object-fit',
			'object-position',
			'aspect-ratio',
			'opacity',
			'filter',
		],
	},
	icon: {
		id: 'icon',
		label: 'Icon',
		properties: [
			'color',
			'fill',
			'stroke',
			'stroke-width',
			'width',
			'height',
			'transform',
		],
	},
	filters: {
		id: 'filters',
		label: 'Filters and opacity',
		properties: [
			'opacity',
			'filter',
			'backdrop-filter',
			'mix-blend-mode',
		],
	},
};

const PROPERTY_OPTIONS = {
	display: [
		'block',
		'inline',
		'inline-block',
		'flex',
		'inline-flex',
		'grid',
		'inline-grid',
		'none',
	],
	'flex-direction': [ 'row', 'row-reverse', 'column', 'column-reverse' ],
	'flex-wrap': [ 'nowrap', 'wrap', 'wrap-reverse' ],
	'justify-content': [
		'start',
		'end',
		'center',
		'space-between',
		'space-around',
		'space-evenly',
		'stretch',
	],
	'align-items': [ 'stretch', 'start', 'end', 'center', 'baseline' ],
	'align-content': [
		'normal',
		'start',
		'end',
		'center',
		'space-between',
		'space-around',
		'space-evenly',
		'stretch',
	],
	'align-self': [ 'auto', 'stretch', 'start', 'end', 'center', 'baseline' ],
	'justify-self': [ 'auto', 'stretch', 'start', 'end', 'center' ],
	'grid-auto-flow': [ 'row', 'column', 'dense', 'row dense', 'column dense' ],
	'object-fit': [ 'fill', 'contain', 'cover', 'none', 'scale-down' ],
	'background-repeat': [
		'repeat',
		'repeat-x',
		'repeat-y',
		'no-repeat',
		'space',
		'round',
	],
	'background-attachment': [ 'scroll', 'fixed', 'local' ],
	'font-style': [ 'normal', 'italic', 'oblique' ],
	'text-transform': [ 'none', 'capitalize', 'uppercase', 'lowercase' ],
	'text-decoration': [ 'none', 'underline', 'overline', 'line-through' ],
	'text-align': [ 'start', 'center', 'end', 'justify', 'left', 'right' ],
	'white-space': [
		'normal',
		'nowrap',
		'pre',
		'pre-wrap',
		'pre-line',
		'break-spaces',
	],
	'overflow-wrap': [ 'normal', 'break-word', 'anywhere' ],
	'word-break': [ 'normal', 'break-all', 'keep-all', 'break-word' ],
	hyphens: [ 'none', 'manual', 'auto' ],
	position: [ 'static', 'relative', 'absolute', 'fixed', 'sticky' ],
	overflow: [ 'visible', 'hidden', 'clip', 'scroll', 'auto' ],
};

const PROPERTY_PLACEHOLDERS = {
	color: '#24314a',
	'font-family': 'var(--wp--preset--font-family--body)',
	'font-size': '1rem',
	'font-weight': '600',
	'line-height': '1.5',
	'letter-spacing': '-0.01em',
	padding: '1rem 1.5rem',
	margin: '0 auto',
	width: '100%',
	'max-width': '75rem',
	height: 'auto',
	'min-height': '7.5rem',
	'aspect-ratio': '16 / 9',
	gap: '1rem',
	'grid-template-columns': 'repeat(3, minmax(0, 1fr))',
	background: '#ffffff',
	'background-color': '#ffffff',
	'background-image': 'url(https://example.com/image.jpg)',
	border: '1px solid #d7dce5',
	'border-radius': '0.75rem',
	'box-shadow': '0 1rem 2.5rem rgba(31, 42, 68, 0.12)',
	opacity: '1',
	filter: 'saturate(0.95)',
	transform: 'translateY(-0.125rem)',
};

const PROPERTY_STATES = {
	color: [
		'hover',
		'focusVisible',
		'focus',
		'active',
		'visited',
		'disabled',
		'checked',
		'selected',
		'current',
	],
	background: [
		'hover',
		'focusVisible',
		'active',
		'disabled',
		'checked',
		'selected',
		'expanded',
		'current',
	],
	'background-color': [
		'hover',
		'focusVisible',
		'active',
		'disabled',
		'checked',
		'selected',
		'expanded',
		'current',
	],
	border: [
		'hover',
		'focusVisible',
		'focus',
		'active',
		'disabled',
		'invalid',
		'checked',
		'selected',
		'expanded',
	],
	outline: [ 'focusVisible', 'focus', 'invalid' ],
	'box-shadow': [ 'hover', 'focusVisible', 'focus', 'active', 'invalid' ],
	opacity: [ 'hover', 'active', 'disabled', 'loading' ],
	filter: [ 'hover', 'active', 'disabled' ],
	transform: [ 'hover', 'active', 'expanded', 'checked', 'loading' ],
};

function labelForProperty( property ) {
	return property
		.split( '-' )
		.map( ( part ) => part.charAt( 0 ).toUpperCase() + part.slice( 1 ) )
		.join( ' ' );
}

function createPropertyControl( property ) {
	return Object.freeze( {
		id: `style.${ property }`,
		type: PROPERTY_OPTIONS[ property ] ? 'select' : 'cssValue',
		label: labelForProperty( property ),
		property,
		placeholder: PROPERTY_PLACEHOLDERS[ property ] || '',
		options: PROPERTY_OPTIONS[ property ] || [],
		responsive: true,
		states: PROPERTY_STATES[ property ] || [],
		dynamic: false,
		cssWideKeywords: CSS_WIDE_KEYWORDS,
		output: Object.freeze( { mapper: 'declaration', property } ),
		sourceSupport: Object.freeze( {
			tokens: true,
			groupPresets: true,
			elementPresets: true,
		} ),
	} );
}

const propertyIds = new Set();
for ( const group of Object.values( CONTROL_GROUPS ) ) {
	for ( const property of group.properties ) {
		propertyIds.add( property );
	}
}

export const STYLE_GROUPS = Object.freeze( CONTROL_GROUPS );
export const STYLE_CONTROLS = Object.freeze(
	Object.fromEntries(
		[ ...propertyIds ]
			.sort()
			.map( ( property ) => [
				property,
				createPropertyControl( property ),
			] )
	)
);

export const ADVANCED_GROUPS = Object.freeze( {
	placement: {
		id: 'placement',
		label: 'Placement',
		fields: [
			'position',
			'inset',
			'zIndex',
			'overflow',
			'isolation',
			'stickyOffset',
		],
	},
	motion: {
		id: 'motion',
		label: 'Motion',
		fields: [
			'transform',
			'transformOrigin',
			'transition',
			'animation',
			'reducedMotion',
		],
	},
	visibility: {
		id: 'visibility',
		label: 'Visibility',
		fields: [ 'desktop', 'tablet', 'mobile' ],
	},
	conditions: {
		id: 'conditions',
		label: 'Conditions',
		fields: [ 'login', 'roles', 'rules' ],
	},
	attributes: {
		id: 'attributes',
		label: 'Attributes and accessibility',
		fields: [ 'id', 'class', 'title', 'role', 'aria', 'data', 'tabindex' ],
	},
	performance: {
		id: 'performance',
		label: 'Performance',
		fields: [ 'loading', 'decoding', 'fetchPriority', 'preload' ],
	},
	permissions: {
		id: 'permissions',
		label: 'Permissions',
		fields: [ 'locked', 'canEdit', 'canDelete', 'canPublish', 'role' ],
	},
	developer: {
		id: 'developer',
		label: 'Developer',
		fields: [ 'customDeclarations', 'selectorPreview', 'diagnostics' ],
	},
} );

export function propertiesForGroups( groupIds ) {
	const properties = new Set();
	for ( const groupId of groupIds || [] ) {
		const group = STYLE_GROUPS[ groupId ];
		if ( ! group ) {
			continue;
		}
		for ( const property of group.properties ) {
			properties.add( property );
		}
	}
	return [ ...properties ];
}

export function validateCatalog() {
	const errors = [];
	for ( const [ id, group ] of Object.entries( STYLE_GROUPS ) ) {
		if ( id !== group.id ) {
			errors.push(
				`Style group key ${ id } does not match ${ group.id }.`
			);
		}
		for ( const property of group.properties ) {
			if ( ! STYLE_CONTROLS[ property ] ) {
				errors.push(
					`Style group ${ id } references unknown ${ property }.`
				);
			}
		}
	}
	return errors;
}
