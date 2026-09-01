import {
	ADVANCED_GROUPS,
	STYLE_GROUPS,
	propertiesForGroups,
} from '../controls/catalog.mjs';

const ALL_ADVANCED = [
	'placement',
	'motion',
	'visibility',
	'conditions',
	'attributes',
	'permissions',
	'developer',
];
const MEDIA_ADVANCED = [ ...ALL_ADVANCED, 'performance' ];
const ROOT_TARGET = Object.freeze( {
	id: 'root',
	label: 'Element',
	selector: '&',
} );

const f = ( id, label, type, storage, extra = {} ) =>
	Object.freeze( {
		id,
		label,
		type,
		storage,
		...extra,
	} );
const text = ( label = 'Text', extra = {} ) =>
	f( 'text', label, 'textarea', 'content', extra );
const prop = ( id, label, type = 'text', extra = {} ) =>
	f( id, label, type, `props.${ id }`, extra );
const attr = ( id, label, type = 'text', extra = {} ) =>
	f( id, label, type, `attributes.${ id }`, extra );
const tag = ( options ) => f( 'tag', 'HTML tag', 'select', 'tag', { options } );

const profiles = Object.freeze( {
	box: [
		'flex',
		'grid',
		'sizing',
		'spacing',
		'background',
		'border',
		'shadow',
		'filters',
		'childPlacement',
	],
	text: [
		'typography',
		'text',
		'sizing',
		'spacing',
		'background',
		'border',
		'shadow',
		'childPlacement',
	],
	button: [
		'typography',
		'text',
		'sizing',
		'spacing',
		'background',
		'border',
		'shadow',
		'icon',
		'filters',
		'childPlacement',
	],
	media: [
		'media',
		'sizing',
		'spacing',
		'border',
		'shadow',
		'filters',
		'childPlacement',
	],
	form: [
		'flex',
		'grid',
		'sizing',
		'spacing',
		'background',
		'border',
		'shadow',
		'typography',
		'text',
		'childPlacement',
	],
	field: [
		'typography',
		'text',
		'sizing',
		'spacing',
		'background',
		'border',
		'shadow',
		'childPlacement',
	],
	composite: [
		'flex',
		'grid',
		'sizing',
		'spacing',
		'background',
		'border',
		'shadow',
		'filters',
		'childPlacement',
	],
} );

function target( id, label, selector = `[data-ctb-part="${ id }"]` ) {
	return Object.freeze( { id, label, selector } );
}

function d( config ) {
	const styleGroups = config.styleGroups || profiles[ config.profile ] || [];
	return Object.freeze( {
		version: 1,
		aliases: [],
		keywords: [],
		palette: true,
		canHaveChildren: false,
		allowedParents: [ '*' ],
		allowedChildren: [],
		contentFields: [],
		styleTargets: [ ROOT_TARGET ],
		advancedGroups: ALL_ADVANCED,
		states: [],
		defaultAttributes: {},
		defaultProps: {},
		defaultStyles: {},
		defaultText: '',
		...config,
		styleGroups,
		styleProperties: propertiesForGroups( styleGroups ),
	} );
}

const definitions = [
	d( {
		id: 'layout/section',
		key: 'section',
		label: 'Section',
		category: 'layout',
		icon: 'fa-regular fa-window-maximize',
		rendererFamily: 'container',
		defaultTag: 'section',
		allowedTags: [
			'section',
			'header',
			'footer',
			'main',
			'aside',
			'article',
		],
		canHaveChildren: true,
		allowedChildren: [ '*' ],
		profile: 'box',
		states: [ 'hover' ],
		contentFields: [
			tag( [
				'section',
				'header',
				'footer',
				'main',
				'aside',
				'article',
			] ),
			attr( 'aria-label', 'Accessible label' ),
			attr( 'id', 'Anchor ID' ),
		],
		defaultStyles: { padding: '4rem 2rem', 'min-height': '7.5rem' },
	} ),
	d( {
		id: 'layout/row',
		key: 'row',
		label: 'Row',
		category: 'layout',
		icon: 'fa-solid fa-table-columns',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div', 'section' ],
		canHaveChildren: true,
		allowedChildren: [ 'layout/column' ],
		profile: 'box',
		contentFields: [
			prop( 'columns', 'Columns', 'number', {
				min: 1,
				max: 12,
				default: 2,
			} ),
			tag( [ 'div', 'section' ] ),
		],
		defaultStyles: {
			display: 'grid',
			'grid-template-columns': 'repeat(2, minmax(0, 1fr))',
			gap: '1.5rem',
		},
	} ),
	d( {
		id: 'layout/column',
		key: 'column',
		label: 'Column',
		category: 'layout',
		icon: 'fa-regular fa-square',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div', 'article', 'aside' ],
		canHaveChildren: true,
		allowedParents: [ 'layout/row', 'layout/container', 'layout/section' ],
		allowedChildren: [ '*' ],
		profile: 'box',
		contentFields: [
			tag( [ 'div', 'article', 'aside' ] ),
			prop( 'editorLabel', 'Editor label' ),
		],
		defaultStyles: { 'min-width': '0' },
	} ),
	d( {
		id: 'layout/container',
		key: 'container',
		label: 'Container',
		category: 'layout',
		icon: 'fa-regular fa-object-group',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [
			'div',
			'article',
			'aside',
			'nav',
			'header',
			'footer',
			'section',
		],
		canHaveChildren: true,
		allowedChildren: [ '*' ],
		profile: 'box',
		states: [ 'hover' ],
		contentFields: [
			tag( [
				'div',
				'article',
				'aside',
				'nav',
				'header',
				'footer',
				'section',
			] ),
			prop( 'editorLabel', 'Editor label' ),
		],
		defaultStyles: {
			'max-width': '75rem',
			margin: '0 auto',
			padding: '1.5rem',
		},
	} ),
	d( {
		id: 'layout/wrapper',
		key: 'wrapper',
		label: 'Div / Wrapper',
		category: 'layout',
		icon: 'fa-regular fa-square',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div', 'span' ],
		canHaveChildren: true,
		allowedChildren: [ '*' ],
		profile: 'box',
		states: [ 'hover' ],
		contentFields: [
			tag( [ 'div', 'span' ] ),
			prop( 'editorLabel', 'Editor label' ),
		],
	} ),
	d( {
		id: 'core/heading',
		key: 'heading',
		label: 'Heading',
		category: 'basic',
		icon: 'fa-solid fa-heading',
		rendererFamily: 'text',
		defaultTag: 'h2',
		allowedTags: [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ],
		profile: 'text',
		states: [ 'hover', 'focusVisible', 'visited' ],
		contentFields: [
			text( 'Heading text', { required: true } ),
			tag( [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ] ),
			attr( 'data-dynamic-source', 'Dynamic source' ),
			attr( 'data-link-url', 'Optional link', 'url' ),
		],
		defaultText: 'Your heading',
		defaultStyles: {
			'font-size': '2.625rem',
			'font-weight': '700',
			margin: '0 0 1rem',
		},
		styleTargets: [ ROOT_TARGET, target( 'text', 'Text' ) ],
	} ),
	d( {
		id: 'core/text',
		key: 'text',
		label: 'Paragraph / Text',
		category: 'basic',
		icon: 'fa-solid fa-font',
		rendererFamily: 'text',
		defaultTag: 'p',
		allowedTags: [ 'p', 'span', 'small', 'address' ],
		profile: 'text',
		states: [ 'hover' ],
		contentFields: [
			text( 'Text', { required: true } ),
			tag( [ 'p', 'span', 'small', 'address' ] ),
			attr( 'data-dynamic-source', 'Dynamic source' ),
		],
		defaultText: 'Add your text here.',
		defaultStyles: { 'line-height': '1.6' },
		styleTargets: [ ROOT_TARGET, target( 'text', 'Text' ) ],
	} ),
	d( {
		id: 'core/rich-text',
		key: 'rich-text',
		label: 'Rich Text',
		category: 'basic',
		icon: 'fa-solid fa-paragraph',
		rendererFamily: 'text',
		defaultTag: 'div',
		allowedTags: [ 'div', 'article', 'address' ],
		profile: 'text',
		states: [ 'hover', 'focusVisible', 'visited' ],
		contentFields: [
			text( 'Rich text', { rich: true } ),
			tag( [ 'div', 'article', 'address' ] ),
			attr( 'data-dynamic-source', 'Dynamic source' ),
		],
		defaultText: '<p>Add formatted text here.</p>',
		styleTargets: [
			ROOT_TARGET,
			target( 'body', 'Body' ),
			target( 'headings', 'Headings' ),
			target( 'links', 'Links' ),
			target( 'lists', 'Lists' ),
			target( 'markers', 'Markers' ),
			target( 'quotes', 'Quotes' ),
			target( 'code', 'Code' ),
		],
	} ),
	d( {
		id: 'core/link',
		key: 'link',
		label: 'Link',
		category: 'basic',
		icon: 'fa-solid fa-link',
		rendererFamily: 'button',
		defaultTag: 'a',
		allowedTags: [ 'a' ],
		profile: 'button',
		states: [ 'hover', 'focusVisible', 'active', 'visited' ],
		contentFields: [
			text( 'Link label', { required: true } ),
			attr( 'href', 'URL', 'url', { required: true } ),
			attr( 'target', 'Open target', 'select', {
				options: [ '', '_self', '_blank' ],
			} ),
			attr( 'rel', 'Relationship' ),
			attr( 'download', 'Download filename' ),
		],
		defaultText: 'Learn more',
		defaultAttributes: { href: '#' },
		styleTargets: [
			ROOT_TARGET,
			target( 'label', 'Label' ),
			target( 'icon', 'Icon' ),
		],
	} ),
	d( {
		id: 'core/list',
		key: 'list',
		label: 'List',
		category: 'basic',
		icon: 'fa-solid fa-list',
		rendererFamily: 'container',
		defaultTag: 'ul',
		allowedTags: [ 'ul', 'ol', 'menu' ],
		canHaveChildren: true,
		allowedChildren: [ 'core/list-item' ],
		profile: 'text',
		states: [ 'hover', 'focusVisible', 'visited' ],
		contentFields: [
			tag( [ 'ul', 'ol', 'menu' ] ),
			attr( 'start', 'Start number', 'number' ),
			attr( 'reversed', 'Reverse order', 'toggle' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'item', 'Item' ),
			target( 'marker', 'Marker' ),
			target( 'link', 'Contained links' ),
		],
	} ),
	d( {
		id: 'core/list-item',
		key: 'list-item',
		label: 'List Item',
		category: 'basic',
		icon: 'fa-solid fa-minus',
		rendererFamily: 'text',
		defaultTag: 'li',
		allowedTags: [ 'li' ],
		canHaveChildren: true,
		allowedParents: [ 'core/list' ],
		allowedChildren: [ '*' ],
		profile: 'text',
		contentFields: [
			text( 'Item content' ),
			attr( 'value', 'Ordered value', 'number' ),
		],
		defaultText: 'List item',
		styleTargets: [
			ROOT_TARGET,
			target( 'item', 'Item' ),
			target( 'marker', 'Marker' ),
		],
	} ),
	d( {
		id: 'core/button',
		key: 'button',
		label: 'Button',
		category: 'basic',
		icon: 'fa-regular fa-square',
		rendererFamily: 'button',
		defaultTag: 'a',
		allowedTags: [ 'a', 'button' ],
		profile: 'button',
		states: [ 'hover', 'focusVisible', 'active', 'disabled', 'loading' ],
		contentFields: [
			text( 'Button label', { required: true } ),
			prop( 'mode', 'Mode', 'select', {
				options: [ 'link', 'action', 'submit' ],
				default: 'link',
			} ),
			attr( 'href', 'URL', 'url', {
				condition: { propEquals: [ 'mode', 'link' ] },
			} ),
			attr( 'target', 'Open target', 'select', {
				options: [ '', '_self', '_blank' ],
			} ),
			attr( 'rel', 'Relationship' ),
			prop( 'icon', 'Icon' ),
			prop( 'iconPosition', 'Icon position', 'select', {
				options: [ 'before', 'after' ],
				default: 'after',
			} ),
			prop( 'accessibleName', 'Accessible name' ),
			prop( 'loadingLabel', 'Loading label' ),
		],
		defaultText: 'Button',
		defaultAttributes: { href: '#' },
		defaultStyles: {
			display: 'inline-flex',
			padding: '0.8125rem 1.125rem',
			'border-radius': '0.5625rem',
			'text-decoration': 'none',
		},
		styleTargets: [
			ROOT_TARGET,
			target( 'label', 'Label' ),
			target( 'icon', 'Icon' ),
			target( 'spinner', 'Spinner' ),
		],
	} ),
	d( {
		id: 'core/image',
		key: 'image',
		label: 'Image',
		category: 'media',
		icon: 'fa-regular fa-image',
		rendererFamily: 'image',
		defaultTag: 'img',
		allowedTags: [ 'img' ],
		profile: 'media',
		advancedGroups: MEDIA_ADVANCED,
		states: [ 'hover', 'focusVisible' ],
		contentFields: [
			attr( 'src', 'Source URL', 'url', { required: true } ),
			prop( 'mediaId', 'WordPress media ID', 'number' ),
			attr( 'alt', 'Alt text' ),
			prop( 'decorative', 'Decorative image', 'toggle' ),
			attr( 'title', 'Title' ),
			prop( 'caption', 'Caption', 'textarea' ),
			prop( 'link', 'Link URL', 'url' ),
		],
		defaultAttributes: {
			src: 'https://picsum.photos/seed/ctb-builder/1200/800',
			alt: 'Editable placeholder',
		},
		defaultStyles: { width: '100%', height: 'auto' },
		styleTargets: [
			ROOT_TARGET,
			target( 'media', 'Image' ),
			target( 'caption', 'Caption' ),
		],
	} ),
	d( {
		id: 'core/figure',
		key: 'figure',
		label: 'Figure / Caption',
		category: 'media',
		icon: 'fa-regular fa-image',
		rendererFamily: 'container',
		defaultTag: 'figure',
		allowedTags: [ 'figure' ],
		canHaveChildren: true,
		allowedChildren: [ 'core/image', 'core/video', 'core/audio' ],
		profile: 'media',
		advancedGroups: MEDIA_ADVANCED,
		contentFields: [
			prop( 'caption', 'Caption', 'textarea' ),
			prop( 'source', 'Source or citation', 'url' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'media', 'Media' ),
			target( 'caption', 'Caption' ),
		],
	} ),
	d( {
		id: 'core/icon',
		key: 'icon',
		label: 'Icon',
		category: 'media',
		icon: 'fa-regular fa-star',
		rendererFamily: 'container',
		defaultTag: 'span',
		allowedTags: [ 'span', 'svg' ],
		styleGroups: [
			'icon',
			'sizing',
			'spacing',
			'background',
			'border',
			'shadow',
			'filters',
			'childPlacement',
		],
		states: [ 'hover', 'focusVisible', 'active' ],
		contentFields: [
			prop( 'icon', 'Icon source', 'icon' ),
			prop( 'decorative', 'Decorative', 'toggle' ),
			attr( 'aria-label', 'Accessible label' ),
			prop( 'link', 'Link URL', 'url' ),
		],
		defaultAttributes: { 'aria-hidden': 'true' },
		styleTargets: [ ROOT_TARGET, target( 'icon', 'Icon' ) ],
	} ),
	d( {
		id: 'core/divider',
		key: 'divider',
		label: 'Divider',
		category: 'layout',
		icon: 'fa-solid fa-minus',
		rendererFamily: 'container',
		defaultTag: 'hr',
		allowedTags: [ 'hr', 'div' ],
		styleGroups: [
			'sizing',
			'spacing',
			'border',
			'alignment',
			'childPlacement',
		],
		contentFields: [
			prop( 'semantic', 'Semantic divider', 'toggle', { default: true } ),
			prop( 'orientation', 'Orientation', 'select', {
				options: [ 'horizontal', 'vertical' ],
				default: 'horizontal',
			} ),
		],
		defaultStyles: {
			border: '0',
			'border-top': '1px solid #d7dce5',
			margin: '1.5rem 0',
		},
		styleTargets: [ ROOT_TARGET, target( 'line', 'Line' ) ],
	} ),
	d( {
		id: 'core/spacer',
		key: 'spacer',
		label: 'Spacer',
		category: 'layout',
		icon: 'fa-solid fa-arrows-up-down',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div' ],
		styleGroups: [ 'sizing' ],
		advancedGroups: [ 'visibility', 'attributes', 'developer' ],
		contentFields: [],
		defaultAttributes: { 'aria-hidden': 'true' },
		defaultStyles: { height: '2rem' },
	} ),
	d( {
		id: 'core/video',
		key: 'video',
		label: 'Video',
		category: 'media',
		icon: 'fa-solid fa-video',
		rendererFamily: 'container',
		defaultTag: 'video',
		allowedTags: [ 'video' ],
		profile: 'media',
		advancedGroups: MEDIA_ADVANCED,
		states: [ 'hover', 'focusVisible' ],
		contentFields: [
			attr( 'src', 'Source URL', 'url' ),
			attr( 'poster', 'Poster URL', 'url' ),
			attr( 'controls', 'Show controls', 'toggle' ),
			attr( 'autoplay', 'Autoplay', 'toggle' ),
			attr( 'muted', 'Muted', 'toggle' ),
			attr( 'loop', 'Loop', 'toggle' ),
			attr( 'playsinline', 'Play inline', 'toggle' ),
			prop( 'captions', 'Captions track', 'url' ),
			prop( 'transcript', 'Transcript', 'textarea' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'media', 'Video' ),
			target( 'caption', 'Caption' ),
		],
	} ),
	d( {
		id: 'core/audio',
		key: 'audio',
		label: 'Audio',
		category: 'media',
		icon: 'fa-solid fa-volume-high',
		rendererFamily: 'container',
		defaultTag: 'audio',
		allowedTags: [ 'audio' ],
		styleGroups: [
			'sizing',
			'spacing',
			'background',
			'border',
			'shadow',
			'childPlacement',
		],
		advancedGroups: MEDIA_ADVANCED,
		states: [ 'focusVisible' ],
		contentFields: [
			attr( 'src', 'Source URL', 'url' ),
			attr( 'controls', 'Show controls', 'toggle' ),
			attr( 'autoplay', 'Autoplay', 'toggle' ),
			attr( 'loop', 'Loop', 'toggle' ),
			attr( 'muted', 'Muted', 'toggle' ),
			attr( 'preload', 'Preload', 'select', {
				options: [ 'none', 'metadata', 'auto' ],
			} ),
			prop( 'transcript', 'Transcript', 'textarea' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'player', 'Player' ),
			target( 'caption', 'Caption' ),
		],
	} ),
	d( {
		id: 'core/embed',
		key: 'embed',
		label: 'Embed / Iframe',
		category: 'media',
		icon: 'fa-solid fa-code',
		rendererFamily: 'container',
		defaultTag: 'iframe',
		allowedTags: [ 'iframe' ],
		profile: 'media',
		advancedGroups: MEDIA_ADVANCED,
		states: [ 'focusVisible' ],
		contentFields: [
			attr( 'src', 'Embed URL', 'url', { required: true } ),
			attr( 'title', 'Accessible title', 'text', { required: true } ),
			attr( 'sandbox', 'Sandbox policy' ),
			attr( 'allow', 'Feature policy' ),
			attr( 'loading', 'Loading', 'select', {
				options: [ 'lazy', 'eager' ],
			} ),
		],
		defaultAttributes: {
			src: 'https://example.com',
			title: 'Embedded content',
			loading: 'lazy',
		},
		defaultStyles: { width: '100%', height: '26.25rem', border: '0' },
		styleTargets: [
			ROOT_TARGET,
			target( 'frame', 'Frame' ),
			target( 'placeholder', 'Consent placeholder' ),
		],
	} ),
	d( {
		id: 'core/map',
		key: 'map',
		label: 'Map',
		category: 'media',
		icon: 'fa-solid fa-location-dot',
		rendererFamily: 'container',
		defaultTag: 'iframe',
		allowedTags: [ 'iframe' ],
		profile: 'media',
		advancedGroups: MEDIA_ADVANCED,
		states: [ 'hover', 'focusVisible' ],
		contentFields: [
			prop( 'provider', 'Provider', 'select', {
				options: [ 'openstreetmap', 'google', 'custom' ],
				default: 'openstreetmap',
			} ),
			prop( 'address', 'Address' ),
			prop( 'latitude', 'Latitude', 'number' ),
			prop( 'longitude', 'Longitude', 'number' ),
			prop( 'zoom', 'Zoom', 'number', { min: 1, max: 20, default: 14 } ),
			attr( 'title', 'Accessible title' ),
			prop( 'consentRequired', 'Require consent', 'toggle' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'frame', 'Map frame' ),
			target( 'marker', 'Marker' ),
			target( 'placeholder', 'Consent placeholder' ),
		],
	} ),
	d( {
		id: 'core/logo',
		key: 'logo',
		label: 'Logo',
		category: 'media',
		icon: 'fa-regular fa-gem',
		rendererFamily: 'image',
		defaultTag: 'img',
		allowedTags: [ 'img' ],
		profile: 'media',
		advancedGroups: MEDIA_ADVANCED,
		states: [ 'hover', 'focusVisible', 'visited' ],
		contentFields: [
			attr( 'src', 'Logo URL', 'url' ),
			prop( 'mediaId', 'WordPress media ID', 'number' ),
			attr( 'alt', 'Alt text' ),
			prop( 'linkHome', 'Link to home', 'toggle', { default: true } ),
			prop( 'textFallback', 'Site-name fallback' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'media', 'Logo image' ),
			target( 'text', 'Text fallback' ),
		],
	} ),
	d( {
		id: 'core/html',
		key: 'html',
		label: 'HTML',
		category: 'advanced',
		icon: 'fa-brands fa-html5',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div' ],
		styleGroups: [
			'sizing',
			'spacing',
			'background',
			'border',
			'childPlacement',
		],
		contentFields: [ text( 'Sanitized HTML', { rich: true } ) ],
		defaultText: '<div>HTML content</div>',
	} ),
	d( {
		id: 'core/code',
		key: 'code',
		label: 'Code',
		category: 'advanced',
		icon: 'fa-solid fa-code',
		rendererFamily: 'text',
		defaultTag: 'pre',
		allowedTags: [ 'pre', 'code' ],
		styleGroups: [
			'typography',
			'text',
			'sizing',
			'spacing',
			'background',
			'border',
			'shadow',
			'childPlacement',
		],
		states: [ 'hover', 'focusVisible' ],
		contentFields: [
			text( 'Code', { required: true } ),
			prop( 'language', 'Language' ),
			prop( 'lineNumbers', 'Line numbers', 'toggle' ),
			prop( 'copyButton', 'Copy button', 'toggle', { default: true } ),
		],
		defaultText: 'const example = true;',
		styleTargets: [
			ROOT_TARGET,
			target( 'code', 'Code' ),
			target( 'toolbar', 'Toolbar' ),
			target( 'copyButton', 'Copy button' ),
		],
	} ),
	d( {
		id: 'core/shortcode',
		key: 'shortcode',
		label: 'Shortcode',
		category: 'advanced',
		icon: 'fa-solid fa-brackets-square',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div', 'span' ],
		styleGroups: [
			'sizing',
			'spacing',
			'background',
			'border',
			'childPlacement',
		],
		contentFields: [
			prop( 'shortcode', 'Registered shortcode', 'text', {
				required: true,
			} ),
			prop( 'attributes', 'Shortcode attributes', 'keyValue' ),
			prop( 'content', 'Enclosed content', 'textarea' ),
			prop( 'fallback', 'Missing-plugin fallback', 'textarea' ),
		],
	} ),
	d( {
		id: 'core/navigation',
		key: 'navigation',
		label: 'Menu / Navigation',
		category: 'interactive',
		icon: 'fa-solid fa-bars',
		rendererFamily: 'container',
		defaultTag: 'nav',
		allowedTags: [ 'nav' ],
		canHaveChildren: true,
		allowedChildren: [ 'core/link', 'core/list' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'active', 'current', 'expanded' ],
		contentFields: [
			prop( 'menuId', 'WordPress menu', 'number' ),
			attr( 'aria-label', 'Navigation label', 'text', {
				required: true,
			} ),
			prop( 'orientation', 'Orientation', 'select', {
				options: [ 'horizontal', 'vertical' ],
				default: 'horizontal',
			} ),
			prop( 'dropdownTrigger', 'Dropdown trigger', 'select', {
				options: [ 'click', 'hover' ],
				default: 'click',
			} ),
			prop( 'mobileBreakpoint', 'Mobile breakpoint', 'select', {
				options: [ 'tablet', 'mobile' ],
				default: 'tablet',
			} ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'item', 'Item' ),
			target( 'link', 'Link' ),
			target( 'dropdown', 'Dropdown' ),
			target( 'dropdownItem', 'Dropdown item' ),
			target( 'toggle', 'Mobile toggle' ),
			target( 'icon', 'Toggle icon' ),
		],
	} ),
	d( {
		id: 'forms/form',
		key: 'form',
		label: 'Form',
		category: 'forms',
		icon: 'fa-regular fa-rectangle-list',
		rendererFamily: 'form',
		defaultTag: 'form',
		allowedTags: [ 'form' ],
		canHaveChildren: true,
		allowedChildren: [
			'forms/field-group',
			'forms/input',
			'forms/textarea',
			'forms/select',
			'forms/checkbox',
			'forms/radio',
			'forms/file-upload',
			'forms/submit-button',
		],
		profile: 'form',
		states: [ 'focusVisible', 'invalid', 'disabled' ],
		contentFields: [
			prop( 'submissionMode', 'Submission mode', 'select', {
				options: [ 'email', 'webhook', 'database' ],
				default: 'email',
			} ),
			prop( 'successMessage', 'Success message', 'textarea', {
				default: 'Your response was received.',
			} ),
			prop( 'errorMessage', 'Error message', 'textarea', {
				default: 'We could not submit the form. Please try again.',
			} ),
			prop( 'spamProtection', 'Spam protection', 'select', {
				options: [ 'honeypot', 'recaptcha', 'none' ],
				default: 'honeypot',
			} ),
			prop( 'privacyText', 'Privacy notice', 'textarea' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'row', 'Field row' ),
			target( 'label', 'Label' ),
			target( 'control', 'Control' ),
			target( 'help', 'Help text' ),
			target( 'error', 'Error' ),
			target( 'success', 'Success' ),
			target( 'submit', 'Submit' ),
		],
	} ),
	d( {
		id: 'forms/field-group',
		key: 'form-field',
		label: 'Form Field',
		category: 'forms',
		icon: 'fa-regular fa-square-check',
		rendererFamily: 'form_field',
		defaultTag: 'div',
		allowedTags: [ 'div', 'fieldset' ],
		canHaveChildren: true,
		allowedParents: [ 'forms/form' ],
		allowedChildren: [
			'forms/input',
			'forms/textarea',
			'forms/select',
			'forms/checkbox',
			'forms/radio',
			'forms/file-upload',
		],
		profile: 'field',
		states: [ 'focusVisible', 'invalid', 'disabled', 'checked' ],
		contentFields: [
			prop( 'fieldType', 'Field type', 'select', {
				options: [
					'text',
					'email',
					'tel',
					'number',
					'textarea',
					'select',
					'checkbox',
					'radio',
					'file',
				],
				default: 'text',
			} ),
			prop( 'label', 'Label', 'text', { required: true } ),
			prop( 'name', 'Name', 'text', { required: true } ),
			prop( 'help', 'Help text' ),
			prop( 'required', 'Required', 'toggle' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'label', 'Label' ),
			target( 'control', 'Control' ),
			target( 'placeholder', 'Placeholder' ),
			target( 'help', 'Help' ),
			target( 'error', 'Error' ),
		],
	} ),
	d( {
		id: 'forms/input',
		key: 'input',
		label: 'Input',
		category: 'forms',
		icon: 'fa-solid fa-i-cursor',
		rendererFamily: 'form_field',
		defaultTag: 'input',
		allowedTags: [ 'input' ],
		profile: 'field',
		states: [ 'focus', 'focusVisible', 'disabled', 'invalid', 'readOnly' ],
		contentFields: [
			attr( 'type', 'Input type', 'select', {
				options: [
					'text',
					'email',
					'tel',
					'url',
					'number',
					'date',
					'time',
					'password',
					'search',
				],
				default: 'text',
			} ),
			attr( 'name', 'Name', 'text', { required: true } ),
			attr( 'value', 'Default value' ),
			attr( 'placeholder', 'Placeholder' ),
			attr( 'autocomplete', 'Autocomplete' ),
			attr( 'inputmode', 'Input mode' ),
			attr( 'required', 'Required', 'toggle' ),
			attr( 'readonly', 'Read only', 'toggle' ),
			attr( 'min', 'Minimum' ),
			attr( 'max', 'Maximum' ),
			attr( 'pattern', 'Pattern' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'control', 'Control' ),
			target( 'placeholder', 'Placeholder' ),
			target( 'label', 'Label' ),
			target( 'help', 'Help' ),
			target( 'error', 'Error' ),
		],
	} ),
	d( {
		id: 'forms/textarea',
		key: 'textarea',
		label: 'Textarea',
		category: 'forms',
		icon: 'fa-solid fa-align-left',
		rendererFamily: 'form_field',
		defaultTag: 'textarea',
		allowedTags: [ 'textarea' ],
		profile: 'field',
		states: [ 'focus', 'focusVisible', 'disabled', 'invalid', 'readOnly' ],
		contentFields: [
			attr( 'name', 'Name', 'text', { required: true } ),
			text( 'Default value' ),
			attr( 'placeholder', 'Placeholder' ),
			attr( 'rows', 'Rows', 'number', { min: 1, max: 50, default: 5 } ),
			attr( 'minlength', 'Minimum length', 'number' ),
			attr( 'maxlength', 'Maximum length', 'number' ),
			attr( 'required', 'Required', 'toggle' ),
			attr( 'readonly', 'Read only', 'toggle' ),
			prop( 'resize', 'Resize', 'select', {
				options: [ 'both', 'vertical', 'horizontal', 'none' ],
				default: 'vertical',
			} ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'control', 'Control' ),
			target( 'placeholder', 'Placeholder' ),
			target( 'label', 'Label' ),
			target( 'help', 'Help' ),
			target( 'error', 'Error' ),
		],
	} ),
	d( {
		id: 'forms/select',
		key: 'select',
		label: 'Select',
		category: 'forms',
		icon: 'fa-solid fa-caret-down',
		rendererFamily: 'form_field',
		defaultTag: 'select',
		allowedTags: [ 'select' ],
		canHaveChildren: true,
		allowedChildren: [ 'legacy/html-node' ],
		profile: 'field',
		states: [ 'focusVisible', 'disabled', 'invalid', 'expanded' ],
		contentFields: [
			attr( 'name', 'Name', 'text', { required: true } ),
			prop( 'options', 'Options', 'repeater' ),
			attr( 'multiple', 'Allow multiple', 'toggle' ),
			attr( 'required', 'Required', 'toggle' ),
			prop( 'placeholder', 'Placeholder option' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'control', 'Control' ),
			target( 'indicator', 'Indicator' ),
			target( 'label', 'Label' ),
			target( 'help', 'Help' ),
			target( 'error', 'Error' ),
		],
	} ),
	d( {
		id: 'forms/checkbox',
		key: 'checkbox',
		label: 'Checkbox',
		category: 'forms',
		icon: 'fa-regular fa-square-check',
		rendererFamily: 'form_field',
		defaultTag: 'input',
		allowedTags: [ 'input' ],
		profile: 'field',
		states: [ 'focusVisible', 'checked', 'disabled', 'invalid' ],
		contentFields: [
			attr( 'name', 'Name', 'text', { required: true } ),
			attr( 'value', 'Value' ),
			prop( 'label', 'Label', 'text', { required: true } ),
			attr( 'checked', 'Checked by default', 'toggle' ),
			attr( 'required', 'Required', 'toggle' ),
			prop( 'consent', 'Consent field', 'toggle' ),
		],
		defaultAttributes: { type: 'checkbox' },
		styleTargets: [
			ROOT_TARGET,
			target( 'control', 'Control' ),
			target( 'checkmark', 'Checkmark' ),
			target( 'label', 'Label' ),
			target( 'help', 'Help' ),
			target( 'error', 'Error' ),
		],
	} ),
	d( {
		id: 'forms/radio',
		key: 'radio',
		label: 'Radio Group',
		category: 'forms',
		icon: 'fa-regular fa-circle-dot',
		rendererFamily: 'form_field',
		defaultTag: 'div',
		allowedTags: [ 'div', 'fieldset' ],
		profile: 'field',
		states: [ 'focusVisible', 'checked', 'disabled', 'invalid' ],
		contentFields: [
			prop( 'name', 'Group name', 'text', { required: true } ),
			prop( 'legend', 'Legend', 'text', { required: true } ),
			prop( 'options', 'Options', 'repeater' ),
			prop( 'selected', 'Default selection' ),
			prop( 'required', 'Required', 'toggle' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'option', 'Option' ),
			target( 'control', 'Control' ),
			target( 'dot', 'Dot' ),
			target( 'label', 'Option label' ),
			target( 'error', 'Error' ),
		],
	} ),
	d( {
		id: 'forms/file-upload',
		key: 'file-upload',
		label: 'File Upload',
		category: 'forms',
		icon: 'fa-solid fa-arrow-up-from-bracket',
		rendererFamily: 'form_field',
		defaultTag: 'input',
		allowedTags: [ 'input' ],
		profile: 'field',
		advancedGroups: MEDIA_ADVANCED,
		states: [ 'hover', 'focusVisible', 'disabled', 'invalid' ],
		contentFields: [
			attr( 'name', 'Name', 'text', { required: true } ),
			attr( 'accept', 'Accepted file types' ),
			attr( 'multiple', 'Allow multiple', 'toggle' ),
			prop( 'maxSize', 'Maximum size (MB)', 'number' ),
			prop( 'label', 'Button label' ),
			prop( 'help', 'Privacy and file help', 'textarea' ),
		],
		defaultAttributes: { type: 'file' },
		styleTargets: [
			ROOT_TARGET,
			target( 'dropzone', 'Dropzone' ),
			target( 'button', 'Button' ),
			target( 'filename', 'Filename' ),
			target( 'help', 'Help' ),
			target( 'error', 'Error' ),
		],
	} ),
	d( {
		id: 'forms/submit-button',
		key: 'submit-button',
		label: 'Submit Button',
		category: 'forms',
		icon: 'fa-solid fa-paper-plane',
		rendererFamily: 'button',
		defaultTag: 'button',
		allowedTags: [ 'button', 'input' ],
		profile: 'button',
		states: [ 'hover', 'focusVisible', 'active', 'disabled', 'loading' ],
		contentFields: [
			text( 'Button label', { required: true } ),
			attr( 'type', 'Button type', 'select', {
				options: [ 'submit', 'reset' ],
				default: 'submit',
			} ),
			prop( 'loadingLabel', 'Loading label' ),
			prop( 'successLabel', 'Success label' ),
			prop( 'icon', 'Icon' ),
		],
		defaultText: 'Submit',
		defaultAttributes: { type: 'submit' },
		styleTargets: [
			ROOT_TARGET,
			target( 'label', 'Label' ),
			target( 'icon', 'Icon' ),
			target( 'spinner', 'Spinner' ),
		],
	} ),
	d( {
		id: 'interactive/accordion',
		key: 'accordion',
		label: 'Accordion',
		category: 'interactive',
		icon: 'fa-solid fa-bars-staggered',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div' ],
		canHaveChildren: true,
		allowedChildren: [ '*' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'expanded', 'disabled' ],
		contentFields: [
			prop( 'items', 'Accordion items', 'repeater' ),
			prop( 'multiple', 'Allow multiple open', 'toggle' ),
			prop( 'defaultOpen', 'Initially open item' ),
			prop( 'headingLevel', 'Heading level', 'select', {
				options: [ 'h2', 'h3', 'h4', 'h5', 'h6' ],
				default: 'h3',
			} ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'item', 'Item' ),
			target( 'header', 'Header' ),
			target( 'title', 'Title' ),
			target( 'icon', 'Icon' ),
			target( 'content', 'Content' ),
		],
	} ),
	d( {
		id: 'interactive/toggle',
		key: 'toggle',
		label: 'Toggle',
		category: 'interactive',
		icon: 'fa-solid fa-chevron-down',
		rendererFamily: 'container',
		defaultTag: 'details',
		allowedTags: [ 'details' ],
		canHaveChildren: true,
		allowedChildren: [ '*' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'expanded', 'disabled' ],
		contentFields: [
			prop( 'title', 'Title', 'text', { required: true } ),
			prop( 'content', 'Content', 'textarea' ),
			attr( 'open', 'Open by default', 'toggle' ),
			prop( 'headingLevel', 'Heading level', 'select', {
				options: [ 'h2', 'h3', 'h4', 'h5', 'h6' ],
				default: 'h3',
			} ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'header', 'Header' ),
			target( 'title', 'Title' ),
			target( 'icon', 'Icon' ),
			target( 'content', 'Content' ),
		],
	} ),
	d( {
		id: 'interactive/tabs',
		key: 'tabs',
		label: 'Tabs',
		category: 'interactive',
		icon: 'fa-regular fa-folder',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div' ],
		canHaveChildren: true,
		allowedChildren: [ '*' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'selected', 'disabled' ],
		contentFields: [
			prop( 'tabs', 'Tabs and panels', 'repeater' ),
			prop( 'activeTab', 'Initially active tab' ),
			prop( 'orientation', 'Orientation', 'select', {
				options: [ 'horizontal', 'vertical' ],
				default: 'horizontal',
			} ),
			prop( 'activation', 'Keyboard activation', 'select', {
				options: [ 'automatic', 'manual' ],
				default: 'automatic',
			} ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'tablist', 'Tab list' ),
			target( 'tab', 'Tab' ),
			target( 'activeTab', 'Active tab' ),
			target( 'panel', 'Panel' ),
			target( 'icon', 'Icon' ),
		],
	} ),
	d( {
		id: 'content/testimonial',
		key: 'testimonial',
		label: 'Testimonial',
		category: 'content',
		icon: 'fa-solid fa-quote-left',
		rendererFamily: 'container',
		defaultTag: 'figure',
		allowedTags: [ 'figure', 'blockquote' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'visited' ],
		contentFields: [
			prop( 'quote', 'Quote', 'textarea', { required: true } ),
			prop( 'author', 'Author', 'text', { required: true } ),
			prop( 'role', 'Role or organization' ),
			prop( 'avatar', 'Avatar', 'url' ),
			prop( 'rating', 'Rating', 'number', { min: 0, max: 5 } ),
			prop( 'sourceUrl', 'Source URL', 'url' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'quote', 'Quote' ),
			target( 'author', 'Author' ),
			target( 'role', 'Role' ),
			target( 'avatar', 'Avatar' ),
			target( 'rating', 'Rating' ),
		],
	} ),
	d( {
		id: 'content/counter',
		key: 'counter',
		label: 'Counter',
		category: 'content',
		icon: 'fa-solid fa-arrow-up-9-1',
		rendererFamily: 'text',
		defaultTag: 'div',
		allowedTags: [ 'div', 'span' ],
		profile: 'text',
		contentFields: [
			prop( 'value', 'End value', 'number', { required: true } ),
			prop( 'start', 'Start value', 'number', { default: 0 } ),
			prop( 'prefix', 'Prefix' ),
			prop( 'suffix', 'Suffix' ),
			prop( 'duration', 'Duration (ms)', 'number', {
				min: 0,
				default: 1000,
			} ),
			prop( 'decimals', 'Decimal places', 'number', {
				min: 0,
				max: 6,
				default: 0,
			} ),
			prop( 'label', 'Accessible label', 'text', { required: true } ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'number', 'Number' ),
			target( 'prefix', 'Prefix' ),
			target( 'suffix', 'Suffix' ),
			target( 'label', 'Label' ),
		],
	} ),
	d( {
		id: 'content/progress',
		key: 'progress',
		label: 'Progress Bar',
		category: 'content',
		icon: 'fa-solid fa-bars-progress',
		rendererFamily: 'container',
		defaultTag: 'progress',
		allowedTags: [ 'progress', 'div' ],
		styleGroups: [
			'sizing',
			'spacing',
			'background',
			'border',
			'typography',
			'text',
			'childPlacement',
		],
		contentFields: [
			attr( 'value', 'Value', 'number', { min: 0, required: true } ),
			attr( 'max', 'Maximum', 'number', { min: 1, default: 100 } ),
			prop( 'label', 'Label', 'text', { required: true } ),
			prop( 'showValue', 'Show value', 'toggle', { default: true } ),
			prop( 'indeterminate', 'Indeterminate', 'toggle' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'track', 'Track' ),
			target( 'fill', 'Fill' ),
			target( 'label', 'Label' ),
			target( 'value', 'Value' ),
		],
	} ),
	d( {
		id: 'content/gallery',
		key: 'gallery',
		label: 'Gallery',
		category: 'media',
		icon: 'fa-regular fa-images',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div', 'figure' ],
		canHaveChildren: true,
		allowedChildren: [ 'core/image', 'core/figure' ],
		profile: 'composite',
		advancedGroups: MEDIA_ADVANCED,
		states: [ 'hover', 'focusVisible', 'active' ],
		contentFields: [
			prop( 'items', 'Images', 'mediaCollection' ),
			prop( 'captions', 'Show captions', 'toggle' ),
			prop( 'linkMode', 'Link behavior', 'select', {
				options: [
					'none',
					'media',
					'attachment',
					'custom',
					'lightbox',
				],
				default: 'none',
			} ),
			prop( 'columns', 'Columns', 'number', {
				min: 1,
				max: 12,
				default: 3,
			} ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'grid', 'Grid' ),
			target( 'item', 'Item' ),
			target( 'media', 'Image' ),
			target( 'caption', 'Caption' ),
			target( 'overlay', 'Overlay' ),
		],
	} ),
	d( {
		id: 'content/slider',
		key: 'slider',
		label: 'Slider',
		category: 'interactive',
		icon: 'fa-regular fa-images',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div', 'section' ],
		canHaveChildren: true,
		allowedChildren: [ '*' ],
		profile: 'composite',
		advancedGroups: MEDIA_ADVANCED,
		states: [ 'hover', 'focusVisible', 'disabled', 'selected' ],
		contentFields: [
			prop( 'slides', 'Slides', 'repeater' ),
			prop( 'autoplay', 'Autoplay', 'toggle' ),
			prop( 'interval', 'Interval (ms)', 'number', {
				min: 1000,
				default: 5000,
			} ),
			prop( 'loop', 'Loop', 'toggle', { default: true } ),
			prop( 'pauseOnHover', 'Pause on hover', 'toggle', {
				default: true,
			} ),
			prop( 'arrows', 'Show arrows', 'toggle', { default: true } ),
			prop( 'dots', 'Show dots', 'toggle', { default: true } ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'track', 'Track' ),
			target( 'slide', 'Slide' ),
			target( 'media', 'Media' ),
			target( 'caption', 'Caption' ),
			target( 'arrows', 'Arrows' ),
			target( 'dots', 'Dots' ),
		],
	} ),
	d( {
		id: 'content/carousel',
		key: 'carousel',
		label: 'Carousel',
		category: 'interactive',
		icon: 'fa-solid fa-arrows-left-right',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div', 'section' ],
		canHaveChildren: true,
		allowedChildren: [ '*' ],
		profile: 'composite',
		advancedGroups: MEDIA_ADVANCED,
		states: [ 'hover', 'focusVisible', 'disabled', 'selected' ],
		contentFields: [
			prop( 'items', 'Items', 'repeater' ),
			prop( 'visibleCount', 'Visible items', 'number', {
				min: 1,
				max: 12,
				default: 3,
			} ),
			prop( 'scrollCount', 'Items per move', 'number', {
				min: 1,
				max: 12,
				default: 1,
			} ),
			prop( 'autoplay', 'Autoplay', 'toggle' ),
			prop( 'loop', 'Loop', 'toggle' ),
			prop( 'snap', 'Scroll snap', 'toggle', { default: true } ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'track', 'Track' ),
			target( 'item', 'Item' ),
			target( 'arrows', 'Arrows' ),
			target( 'dots', 'Dots' ),
		],
	} ),
	d( {
		id: 'content/social-icons',
		key: 'social-icons',
		label: 'Social Icons',
		category: 'content',
		icon: 'fa-solid fa-share-nodes',
		rendererFamily: 'container',
		defaultTag: 'nav',
		allowedTags: [ 'nav', 'div' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'active', 'visited' ],
		contentFields: [
			prop( 'networks', 'Networks and URLs', 'repeater' ),
			prop( 'showLabels', 'Show labels', 'toggle' ),
			prop( 'newTab', 'Open in new tab', 'toggle', { default: true } ),
			attr( 'aria-label', 'Navigation label', 'text', {
				default: 'Social links',
			} ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'item', 'Item' ),
			target( 'icon', 'Icon' ),
			target( 'label', 'Label' ),
		],
	} ),
	d( {
		id: 'content/breadcrumbs',
		key: 'breadcrumbs',
		label: 'Breadcrumbs',
		category: 'content',
		icon: 'fa-solid fa-angle-right',
		rendererFamily: 'container',
		defaultTag: 'nav',
		allowedTags: [ 'nav' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'visited', 'current' ],
		contentFields: [
			prop( 'source', 'Source', 'select', {
				options: [ 'wordpress', 'woocommerce', 'manual' ],
				default: 'wordpress',
			} ),
			prop( 'homeLabel', 'Home label', 'text', { default: 'Home' } ),
			prop( 'separator', 'Separator', 'text', { default: '/' } ),
			prop( 'showCurrent', 'Show current item', 'toggle', {
				default: true,
			} ),
			attr( 'aria-label', 'Navigation label', 'text', {
				default: 'Breadcrumb',
			} ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'item', 'Item' ),
			target( 'link', 'Link' ),
			target( 'separator', 'Separator' ),
			target( 'current', 'Current item' ),
		],
	} ),
	d( {
		id: 'content/search',
		key: 'search',
		label: 'Search',
		category: 'forms',
		icon: 'fa-solid fa-magnifying-glass',
		rendererFamily: 'form',
		defaultTag: 'form',
		allowedTags: [ 'form' ],
		profile: 'form',
		states: [ 'focusVisible', 'hover', 'active', 'disabled', 'expanded' ],
		contentFields: [
			prop( 'source', 'Search source', 'select', {
				options: [ 'site', 'posts', 'products', 'custom' ],
				default: 'site',
			} ),
			prop( 'placeholder', 'Placeholder', 'text', { default: 'Search' } ),
			prop( 'buttonLabel', 'Button label', 'text', {
				default: 'Search',
			} ),
			prop( 'resultsMode', 'Results', 'select', {
				options: [ 'page', 'live' ],
				default: 'page',
			} ),
			prop( 'emptyText', 'No-results message', 'text', {
				default: 'No results found.',
			} ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'input', 'Input' ),
			target( 'button', 'Button' ),
			target( 'icon', 'Icon' ),
			target( 'results', 'Results' ),
			target( 'result', 'Result' ),
			target( 'empty', 'Empty state' ),
			target( 'loading', 'Loading state' ),
		],
	} ),
	d( {
		id: 'content/quote',
		key: 'quote',
		label: 'Quote',
		category: 'content',
		icon: 'fa-solid fa-quote-left',
		rendererFamily: 'text',
		defaultTag: 'q',
		allowedTags: [ 'q' ],
		profile: 'text',
		states: [ 'hover', 'focusVisible', 'visited' ],
		contentFields: [
			text( 'Quote', { required: true } ),
			prop( 'citation', 'Citation' ),
			prop( 'sourceUrl', 'Source URL', 'url' ),
		],
		defaultText: 'Quoted text',
		styleTargets: [
			ROOT_TARGET,
			target( 'quote', 'Quote' ),
			target( 'citation', 'Citation' ),
			target( 'mark', 'Quote mark' ),
		],
	} ),
	d( {
		id: 'content/blockquote',
		key: 'blockquote',
		label: 'Blockquote',
		category: 'content',
		icon: 'fa-solid fa-quote-right',
		rendererFamily: 'text',
		defaultTag: 'blockquote',
		allowedTags: [ 'blockquote' ],
		profile: 'text',
		states: [ 'hover', 'focusVisible', 'visited' ],
		contentFields: [
			text( 'Quote', { required: true, rich: true } ),
			prop( 'attribution', 'Attribution' ),
			attr( 'cite', 'Citation URL', 'url' ),
		],
		defaultText: 'A considered quotation.',
		styleTargets: [
			ROOT_TARGET,
			target( 'quote', 'Quote' ),
			target( 'citation', 'Citation' ),
		],
	} ),
	d( {
		id: 'composite/pricing-table',
		key: 'pricing-table',
		label: 'Pricing Table',
		category: 'content',
		icon: 'fa-solid fa-tags',
		rendererFamily: 'container',
		defaultTag: 'article',
		allowedTags: [ 'article', 'div' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'active', 'disabled' ],
		contentFields: [
			prop( 'plan', 'Plan name', 'text', { required: true } ),
			prop( 'price', 'Price', 'text', { required: true } ),
			prop( 'period', 'Billing period' ),
			prop( 'features', 'Features', 'repeater' ),
			prop( 'ctaLabel', 'CTA label' ),
			prop( 'ctaUrl', 'CTA URL', 'url' ),
			prop( 'badge', 'Badge' ),
			prop( 'featured', 'Featured plan', 'toggle' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'header', 'Header' ),
			target( 'price', 'Price' ),
			target( 'period', 'Period' ),
			target( 'features', 'Features' ),
			target( 'feature', 'Feature' ),
			target( 'cta', 'CTA' ),
			target( 'badge', 'Badge' ),
		],
	} ),
	d( {
		id: 'composite/icon-box',
		key: 'icon-box',
		label: 'Icon Box',
		category: 'content',
		icon: 'fa-regular fa-square-caret-up',
		rendererFamily: 'container',
		defaultTag: 'article',
		allowedTags: [ 'article', 'div', 'a' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'visited' ],
		contentFields: [
			prop( 'icon', 'Icon', 'icon' ),
			prop( 'title', 'Title', 'text', { required: true } ),
			prop( 'description', 'Description', 'textarea' ),
			prop( 'url', 'Link URL', 'url' ),
			prop( 'headingLevel', 'Heading level', 'select', {
				options: [ 'h2', 'h3', 'h4', 'h5', 'h6' ],
				default: 'h3',
			} ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'icon', 'Icon' ),
			target( 'title', 'Title' ),
			target( 'description', 'Description' ),
		],
	} ),
	d( {
		id: 'composite/countdown',
		key: 'countdown',
		label: 'Countdown Timer',
		category: 'content',
		icon: 'fa-regular fa-clock',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div', 'time' ],
		profile: 'composite',
		states: [ 'expired' ],
		contentFields: [
			prop( 'end', 'End date and time', 'datetime', { required: true } ),
			prop( 'timezone', 'Timezone', 'text', { required: true } ),
			prop( 'mode', 'Mode', 'select', {
				options: [ 'countdown', 'evergreen' ],
				default: 'countdown',
			} ),
			prop( 'segments', 'Segments', 'multiSelect', {
				options: [ 'days', 'hours', 'minutes', 'seconds' ],
				default: [ 'days', 'hours', 'minutes', 'seconds' ],
			} ),
			prop( 'expiryAction', 'On expiry', 'select', {
				options: [ 'hold', 'hide', 'message', 'redirect' ],
				default: 'hold',
			} ),
			prop( 'expiryMessage', 'Expiry message' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'segment', 'Segment' ),
			target( 'value', 'Value' ),
			target( 'label', 'Label' ),
			target( 'separator', 'Separator' ),
			target( 'expired', 'Expired state' ),
		],
	} ),
	d( {
		id: 'composite/team-member',
		key: 'team-member',
		label: 'Team Member',
		category: 'content',
		icon: 'fa-regular fa-user',
		rendererFamily: 'container',
		defaultTag: 'article',
		allowedTags: [ 'article', 'div' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'visited' ],
		contentFields: [
			prop( 'photo', 'Photo', 'url' ),
			prop( 'name', 'Name', 'text', { required: true } ),
			prop( 'role', 'Role' ),
			prop( 'bio', 'Biography', 'textarea' ),
			prop( 'social', 'Social links', 'repeater' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'photo', 'Photo' ),
			target( 'name', 'Name' ),
			target( 'role', 'Role' ),
			target( 'bio', 'Biography' ),
			target( 'social', 'Social links' ),
			target( 'icon', 'Social icon' ),
		],
	} ),
	d( {
		id: 'woocommerce/product',
		key: 'woo-product',
		label: 'Woo Product',
		category: 'commerce',
		icon: 'fa-solid fa-box',
		rendererFamily: 'woocommerce_product',
		defaultTag: 'article',
		allowedTags: [ 'article', 'div' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'active', 'disabled', 'invalid' ],
		contentFields: [
			attr( 'data-product-id', 'Product ID', 'number' ),
			prop( 'source', 'Product source', 'select', {
				options: [ 'current', 'selected', 'dynamic' ],
				default: 'current',
			} ),
			attr( 'data-show-variations', 'Show variations', 'toggle' ),
			prop( 'showQuantity', 'Show quantity', 'toggle' ),
			prop( 'parts', 'Visible product parts', 'multiSelect' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'image', 'Image' ),
			target( 'title', 'Title' ),
			target( 'price', 'Price' ),
			target( 'stock', 'Stock' ),
			target( 'description', 'Description' ),
			target( 'variations', 'Variations' ),
			target( 'button', 'Add to cart button' ),
		],
	} ),
	d( {
		id: 'woocommerce/product-grid',
		key: 'woo-product-grid',
		label: 'Woo Product Grid',
		category: 'commerce',
		icon: 'fa-solid fa-border-all',
		rendererFamily: 'woocommerce_product_grid',
		defaultTag: 'section',
		allowedTags: [ 'section', 'div' ],
		canHaveChildren: true,
		allowedChildren: [ '*' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'active', 'disabled' ],
		contentFields: [
			prop( 'category', 'Category' ),
			prop( 'orderBy', 'Order by', 'select', {
				options: [
					'date',
					'title',
					'price',
					'popularity',
					'rating',
					'rand',
				],
				default: 'date',
			} ),
			prop( 'order', 'Order', 'select', {
				options: [ 'asc', 'desc' ],
				default: 'desc',
			} ),
			attr( 'data-limit', 'Product limit', 'number', {
				min: 1,
				max: 100,
				default: 12,
			} ),
			prop( 'columns', 'Columns', 'number', {
				min: 1,
				max: 6,
				default: 3,
			} ),
			prop( 'pagination', 'Pagination', 'toggle' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'grid', 'Grid' ),
			target( 'item', 'Product item' ),
			target( 'image', 'Image' ),
			target( 'title', 'Title' ),
			target( 'price', 'Price' ),
			target( 'button', 'Button' ),
		],
	} ),
	d( {
		id: 'woocommerce/cart',
		key: 'woo-cart',
		label: 'Woo Cart',
		category: 'commerce',
		icon: 'fa-solid fa-cart-shopping',
		rendererFamily: 'woocommerce_cart',
		defaultTag: 'section',
		allowedTags: [ 'section', 'div' ],
		profile: 'composite',
		states: [ 'hover', 'focusVisible', 'active', 'disabled', 'invalid' ],
		contentFields: [
			prop( 'showCoupon', 'Show coupon', 'toggle', { default: true } ),
			prop( 'showShipping', 'Show shipping', 'toggle', {
				default: true,
			} ),
			prop( 'showCrossSells', 'Show cross-sells', 'toggle' ),
			prop( 'emptyMessage', 'Empty-cart message' ),
			prop( 'returnLabel', 'Return link label' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'item', 'Cart item' ),
			target( 'image', 'Image' ),
			target( 'name', 'Product name' ),
			target( 'quantity', 'Quantity' ),
			target( 'price', 'Price' ),
			target( 'remove', 'Remove' ),
			target( 'totals', 'Totals' ),
			target( 'coupon', 'Coupon' ),
			target( 'actions', 'Actions' ),
			target( 'empty', 'Empty state' ),
		],
	} ),
	d( {
		id: 'woocommerce/checkout',
		key: 'woo-checkout',
		label: 'Woo Checkout',
		category: 'commerce',
		icon: 'fa-solid fa-credit-card',
		rendererFamily: 'woocommerce_checkout',
		defaultTag: 'section',
		allowedTags: [ 'section', 'div' ],
		profile: 'form',
		states: [ 'hover', 'focusVisible', 'active', 'disabled', 'invalid' ],
		contentFields: [
			prop( 'showLogin', 'Show login prompt', 'toggle', {
				default: true,
			} ),
			prop( 'showCoupon', 'Show coupon prompt', 'toggle', {
				default: true,
			} ),
			prop( 'showOrderNotes', 'Show order notes', 'toggle', {
				default: true,
			} ),
			prop( 'submitLabel', 'Place-order label' ),
			prop( 'sectionOrder', 'Section order', 'sortableList' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'form', 'Form' ),
			target( 'section', 'Section' ),
			target( 'heading', 'Heading' ),
			target( 'label', 'Label' ),
			target( 'field', 'Field' ),
			target( 'error', 'Error' ),
			target( 'summary', 'Summary' ),
			target( 'payment', 'Payment' ),
			target( 'submit', 'Place order button' ),
		],
	} ),
	d( {
		id: 'data/loop',
		key: 'loop',
		label: 'Loop / Repeater',
		category: 'dynamic',
		icon: 'fa-solid fa-repeat',
		rendererFamily: 'container',
		defaultTag: 'div',
		allowedTags: [ 'div', 'section', 'ul', 'ol' ],
		canHaveChildren: true,
		allowedChildren: [ '*' ],
		profile: 'composite',
		advancedGroups: [
			'placement',
			'visibility',
			'conditions',
			'performance',
			'attributes',
			'permissions',
			'developer',
		],
		contentFields: [
			prop( 'source', 'Data source', 'select', {
				options: [ 'posts', 'products', 'manual', 'registered' ],
				default: 'posts',
			} ),
			prop( 'filters', 'Filters', 'conditionBuilder' ),
			prop( 'orderBy', 'Order by' ),
			prop( 'order', 'Order', 'select', {
				options: [ 'asc', 'desc' ],
				default: 'desc',
			} ),
			prop( 'limit', 'Item limit', 'number', {
				min: 1,
				max: 100,
				default: 10,
			} ),
			prop( 'pagination', 'Pagination', 'select', {
				options: [ 'none', 'pages', 'loadMore', 'infinite' ],
				default: 'none',
			} ),
			prop( 'emptyContent', 'Empty content', 'textarea' ),
			prop( 'errorContent', 'Error content', 'textarea' ),
			prop( 'loadingContent', 'Loading content', 'textarea' ),
		],
		styleTargets: [
			ROOT_TARGET,
			target( 'list', 'List' ),
			target( 'item', 'Item' ),
			target( 'empty', 'Empty state' ),
			target( 'error', 'Error state' ),
			target( 'loading', 'Loading state' ),
		],
	} ),
];

const legacy = d( {
	id: 'legacy/html-node',
	key: 'legacy-html-node',
	label: 'Legacy Element',
	category: 'advanced',
	icon: 'fa-solid fa-triangle-exclamation',
	rendererFamily: 'container',
	defaultTag: 'div',
	allowedTags: [ '*' ],
	palette: false,
	canHaveChildren: true,
	allowedChildren: [ '*' ],
	styleGroups: [ 'sizing', 'spacing', 'background', 'border' ],
	advancedGroups: [ 'visibility', 'attributes', 'developer' ],
	contentFields: [],
} );

export const ELEMENT_DEFINITIONS = Object.freeze( [ ...definitions, legacy ] );
export const FIRST_CLASS_ELEMENT_COUNT = definitions.length;
const BY_ID = new Map(
	ELEMENT_DEFINITIONS.map( ( definition ) => [ definition.id, definition ] )
);
const BY_KEY = new Map(
	ELEMENT_DEFINITIONS.map( ( definition ) => [ definition.key, definition ] )
);

export function getElementDefinition( id ) {
	return BY_ID.get( id ) || legacy;
}

export function getElementDefinitionByKey( key ) {
	return BY_KEY.get( key ) || null;
}

export function inferElementDefinition( block ) {
	if ( block?.element && BY_ID.has( block.element ) ) {
		return {
			definition: BY_ID.get( block.element ),
			confidence: 1,
			reason: 'explicit element ID',
		};
	}
	const type = String( block?.type || '' );
	const tagName = String( block?.tag || '' ).toLowerCase();
	const specialized = {
		woocommerce_product: 'woocommerce/product',
		woocommerce_product_grid: 'woocommerce/product-grid',
		woocommerce_cart: 'woocommerce/cart',
		woocommerce_checkout: 'woocommerce/checkout',
		form: 'forms/form',
	};
	if ( specialized[ type ] ) {
		return {
			definition: BY_ID.get( specialized[ type ] ),
			confidence: 1,
			reason: `specialized type ${ type }`,
		};
	}
	if ( type === 'form_field' ) {
		const fieldId =
			tagName === 'textarea'
				? 'forms/textarea'
				: tagName === 'select'
				? 'forms/select'
				: block?.attributes?.type === 'checkbox'
				? 'forms/checkbox'
				: block?.attributes?.type === 'radio'
				? 'forms/radio'
				: block?.attributes?.type === 'file'
				? 'forms/file-upload'
				: 'forms/input';
		return {
			definition: BY_ID.get( fieldId ),
			confidence: 0.95,
			reason: `form field tag ${ tagName }`,
		};
	}
	let id = null;
	if ( /^h[1-6]$/.test( tagName ) ) id = 'core/heading';
	else if ( tagName === 'img' ) id = 'core/image';
	else if ( tagName === 'hr' ) id = 'core/divider';
	else if ( tagName === 'iframe' ) id = 'core/embed';
	else if ( tagName === 'video' ) id = 'core/video';
	else if ( tagName === 'audio' ) id = 'core/audio';
	else if ( tagName === 'nav' ) id = 'core/navigation';
	else if ( tagName === 'form' ) id = 'forms/form';
	else if ( tagName === 'textarea' ) id = 'forms/textarea';
	else if ( tagName === 'select' ) id = 'forms/select';
	else if ( tagName === 'input' ) id = 'forms/input';
	else if ( tagName === 'a' && type === 'button' ) id = 'core/button';
	else if ( tagName === 'a' ) id = 'core/link';
	else if ( tagName === 'button' )
		id =
			block?.attributes?.type === 'submit'
				? 'forms/submit-button'
				: 'core/button';
	else if ( [ 'ul', 'ol', 'menu' ].includes( tagName ) ) id = 'core/list';
	else if ( tagName === 'li' ) id = 'core/list-item';
	else if ( tagName === 'blockquote' ) id = 'content/blockquote';
	else if ( tagName === 'q' ) id = 'content/quote';
	else if ( [ 'pre', 'code' ].includes( tagName ) ) id = 'core/code';
	else if ( tagName === 'figure' ) id = 'core/figure';
	else if ( tagName === 'details' ) id = 'interactive/toggle';
	else if ( tagName === 'progress' ) id = 'content/progress';
	else if (
		[ 'p', 'span', 'small', 'address' ].includes( tagName ) &&
		type === 'text'
	)
		id = 'core/text';
	else if (
		[ 'section', 'header', 'footer', 'main', 'aside', 'article' ].includes(
			tagName
		)
	)
		id = 'layout/section';
	else if ( tagName === 'div' && type === 'container' )
		id = 'layout/container';
	if ( id ) {
		return {
			definition: BY_ID.get( id ),
			confidence: 0.85,
			reason: `legacy ${ type }/${ tagName } matcher`,
		};
	}
	return {
		definition: legacy,
		confidence: 0.4,
		reason: `ambiguous ${ type || 'unknown' }/${ tagName || 'unknown' }`,
	};
}

export function resolveElementDefinition( block ) {
	return inferElementDefinition( block ).definition;
}

export function canInsertElement( parentBlock, childBlock ) {
	const parent = resolveElementDefinition( parentBlock );
	const child = resolveElementDefinition( childBlock );
	if ( ! parent.canHaveChildren ) {
		return false;
	}
	const childAllowed =
		parent.allowedChildren.includes( '*' ) ||
		parent.allowedChildren.includes( child.id );
	const parentAllowed =
		child.allowedParents.includes( '*' ) ||
		child.allowedParents.includes( parent.id );
	return childAllowed && parentAllowed;
}

function clone( value ) {
	return JSON.parse( JSON.stringify( value ) );
}

export function createElementBlock( key, idSuffix ) {
	const definition = BY_KEY.get( key ) || BY_ID.get( key );
	if ( ! definition || ! definition.palette ) {
		return null;
	}
	const suffix =
		idSuffix ||
		`${ Date.now().toString( 36 ) }-${ Math.random()
			.toString( 36 )
			.slice( 2, 6 ) }`;
	const block = {
		id: `${ definition.key }-${ suffix }`,
		element: definition.id,
		definition_version: definition.version,
		type: definition.rendererFamily,
		tag: definition.defaultTag,
		props: clone( definition.defaultProps ),
		attributes: clone( definition.defaultAttributes ),
		children: definition.defaultText
			? [ { kind: 'text', value: definition.defaultText } ]
			: [],
		styles: {
			mapped: clone( definition.defaultStyles ),
			custom_css_fallback: '',
		},
		meta: { source: 'editor-element-palette' },
	};
	if ( definition.canHaveChildren && ! block.children.length ) {
		block.children = [];
	}
	return block;
}

export function paletteGroups() {
	const categoryOrder = [
		'basic',
		'layout',
		'media',
		'forms',
		'interactive',
		'content',
		'commerce',
		'dynamic',
		'advanced',
	];
	const labels = {
		basic: 'Basic',
		layout: 'Layout',
		media: 'Media',
		forms: 'Forms',
		interactive: 'Interactive',
		content: 'Content',
		commerce: 'WooCommerce',
		dynamic: 'Dynamic',
		advanced: 'Advanced',
	};
	return categoryOrder
		.map( ( category ) => ( {
			id: category,
			label: labels[ category ],
			items: definitions
				.filter(
					( definition ) =>
						definition.palette && definition.category === category
				)
				.map( ( definition ) => [
					definition.key,
					definition.icon,
					definition.label,
				] ),
		} ) )
		.filter( ( group ) => group.items.length );
}

export function validateElementRegistry() {
	const errors = [];
	const ids = new Set();
	const keys = new Set();
	for ( const definition of ELEMENT_DEFINITIONS ) {
		if ( ids.has( definition.id ) )
			errors.push( `Duplicate element ID ${ definition.id }.` );
		if ( keys.has( definition.key ) )
			errors.push( `Duplicate element key ${ definition.key }.` );
		ids.add( definition.id );
		keys.add( definition.key );
		if ( ! /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/.test( definition.id ) )
			errors.push( `Invalid element ID ${ definition.id }.` );
		if ( ! definition.styleTargets.some( ( item ) => item.id === 'root' ) )
			errors.push( `${ definition.id } has no root style target.` );
		for ( const groupId of definition.styleGroups ) {
			if ( ! STYLE_GROUPS[ groupId ] )
				errors.push(
					`${ definition.id } grants unknown style group ${ groupId }.`
				);
		}
		for ( const groupId of definition.advancedGroups ) {
			if ( ! ADVANCED_GROUPS[ groupId ] )
				errors.push(
					`${ definition.id } grants unknown advanced group ${ groupId }.`
				);
		}
	}
	return errors;
}

export function registryManifest() {
	return {
		registry_version: 1,
		elements: Object.fromEntries(
			ELEMENT_DEFINITIONS.map( ( definition ) => [
				definition.id,
				{
					version: definition.version,
					rendererFamily: definition.rendererFamily,
					allowedTags: definition.allowedTags,
				props: definition.contentFields
						.filter( ( field ) =>
							field.storage.startsWith( 'props.' )
						)
						.map( ( field ) => field.id ),
				targets: definition.styleTargets.map( ( item ) => item.id ),
				targetSelectors: Object.fromEntries(
					definition.styleTargets.map( ( item ) => [
						item.id,
						item.selector,
					] )
				),
					styleGroups: definition.styleGroups,
					advancedGroups: definition.advancedGroups,
					states: definition.states,
				},
			] )
		),
	};
}
