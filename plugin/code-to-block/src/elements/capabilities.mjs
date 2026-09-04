const CAPABILITY_DESCRIPTIONS = {
	text: 'Owns editable plain-text content.',
	richText: 'Owns editable rich-text content.',
	link: 'Can navigate to or reference another resource.',
	buttonAction: 'Can trigger a button-like action.',
	image: 'Owns or renders image media.',
	icon: 'Owns or renders icon media.',
	video: 'Owns or renders video media.',
	audio: 'Owns or renders audio media.',
	children: 'Can contain child elements.',
	flexLayout: 'Can control a flex layout context.',
	gridLayout: 'Can control a grid layout context.',
	background: 'Can render shared background controls.',
	border: 'Can render shared border controls.',
	spacing: 'Can render shared spacing controls.',
	sizing: 'Can render shared sizing controls.',
	typography: 'Can render shared typography controls.',
	imageStyle: 'Can render shared image styling controls.',
	iconStyle: 'Can render shared icon styling controls.',
	interactive: 'Supports one or more interaction states.',
	hoverState: 'Supports a hover style state.',
	focusState: 'Supports a focus or focus-visible style state.',
	repeater: 'Owns an ordered collection of repeated items.',
	form: 'Owns form-level behavior.',
	formField: 'Owns form-field behavior.',
	query: 'Owns a data query.',
	navigation: 'Owns navigation behavior or structure.',
	dynamicData: 'Can resolve dynamic data.',
	animation: 'Can own motion configuration.',
	responsive: 'Can own responsive visibility configuration.',
	accessibility: 'Can own accessibility attributes.',
	customAttributes: 'Can own custom HTML attributes.',
	customCss: 'Can own custom CSS declarations.',
};

export const CAPABILITY_DEFINITIONS = Object.freeze(
	Object.fromEntries(
		Object.entries( CAPABILITY_DESCRIPTIONS ).map(
			( [ id, description ] ) => [
				id,
				Object.freeze( { id, description } ),
			]
		)
	)
);

const STYLE_GROUP_CAPABILITIES = Object.freeze( {
	typography: 'typography',
	background: 'background',
	border: 'border',
	spacing: 'spacing',
	sizing: 'sizing',
	flex: 'flexLayout',
	grid: 'gridLayout',
	media: 'imageStyle',
	icon: 'iconStyle',
} );

const ADVANCED_GROUP_CAPABILITIES = Object.freeze( {
	motion: [ 'animation' ],
	visibility: [ 'responsive' ],
	attributes: [ 'accessibility', 'customAttributes' ],
	developer: [ 'customCss' ],
} );

const ELEMENT_CAPABILITIES = Object.freeze( {
	'core/button': [ 'link', 'buttonAction', 'icon' ],
	'core/link': [ 'link' ],
	'core/image': [ 'image', 'link' ],
	'core/figure': [ 'image' ],
	'core/icon': [ 'icon' ],
	'core/video': [ 'video' ],
	'core/audio': [ 'audio' ],
	'core/logo': [ 'image', 'link' ],
	'core/navigation': [ 'navigation', 'link', 'repeater' ],
	'forms/form': [ 'form', 'repeater' ],
	'forms/submit-button': [ 'formField', 'buttonAction' ],
	'interactive/accordion': [ 'repeater' ],
	'interactive/tabs': [ 'repeater' ],
	'content/gallery': [ 'image', 'repeater' ],
	'content/slider': [ 'image', 'repeater' ],
	'content/carousel': [ 'image', 'repeater' ],
	'content/social-icons': [ 'icon', 'link', 'repeater' ],
	'content/breadcrumbs': [ 'navigation', 'link', 'repeater' ],
	'content/search': [ 'query', 'formField', 'buttonAction' ],
	'composite/pricing-table': [ 'buttonAction', 'repeater' ],
	'composite/countdown': [ 'dynamicData', 'repeater' ],
	'composite/team-member': [ 'image', 'link', 'repeater' ],
	'woocommerce/product': [ 'dynamicData', 'query', 'image', 'buttonAction' ],
	'woocommerce/product-grid': [
		'dynamicData',
		'query',
		'image',
		'buttonAction',
		'repeater',
	],
	'woocommerce/cart': [ 'dynamicData', 'query', 'image', 'buttonAction' ],
	'woocommerce/checkout': [ 'dynamicData', 'form', 'buttonAction' ],
	'data/loop': [ 'dynamicData', 'query', 'repeater' ],
} );

function addFieldCapabilities( capabilities, fields ) {
	for ( const field of fields || [] ) {
		if ( field.storage === 'content' ) {
			capabilities.add( field.rich ? 'richText' : 'text' );
		}
		if (
			[ 'repeater', 'mediaCollection', 'sortableList' ].includes(
				field.type
			)
		) {
			capabilities.add( 'repeater' );
		}
	}
}

export function composeCapabilities( definition ) {
	const capabilities = new Set( definition.capabilities || [] );
	for ( const groupId of definition.styleGroups || [] ) {
		const capability = STYLE_GROUP_CAPABILITIES[ groupId ];
		if ( capability ) {
			capabilities.add( capability );
		}
	}
	for ( const groupId of definition.advancedGroups || [] ) {
		for ( const capability of ADVANCED_GROUP_CAPABILITIES[ groupId ] ||
			[] ) {
			capabilities.add( capability );
		}
	}
	for ( const capability of ELEMENT_CAPABILITIES[ definition.id ] || [] ) {
		capabilities.add( capability );
	}
	if ( definition.canHaveChildren ) {
		capabilities.add( 'children' );
	}
	if ( definition.id?.startsWith( 'forms/' ) ) {
		capabilities.add(
			definition.id === 'forms/form' ? 'form' : 'formField'
		);
	}
	if ( definition.id?.startsWith( 'data/' ) ) {
		capabilities.add( 'dynamicData' );
	}
	if ( definition.states?.length ) {
		capabilities.add( 'interactive' );
	}
	if ( definition.states?.includes( 'hover' ) ) {
		capabilities.add( 'hoverState' );
	}
	if (
		definition.states?.includes( 'focus' ) ||
		definition.states?.includes( 'focusVisible' )
	) {
		capabilities.add( 'focusState' );
		capabilities.add( 'accessibility' );
	}
	addFieldCapabilities( capabilities, definition.contentFields );
	return Object.freeze( [ ...capabilities ].sort() );
}

export function validateCapabilities( capabilities ) {
	const errors = [];
	const seen = new Set();
	for ( const capability of capabilities || [] ) {
		if ( seen.has( capability ) ) {
			errors.push( `Duplicate capability ${ capability }.` );
		}
		seen.add( capability );
		if ( ! CAPABILITY_DEFINITIONS[ capability ] ) {
			errors.push( `Unknown capability ${ capability }.` );
		}
	}
	return errors;
}
