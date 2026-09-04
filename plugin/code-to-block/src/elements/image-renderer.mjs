import { getElement } from './registry.mjs';

const MEDIA_ATTRIBUTES = Object.freeze( [
	'alt',
	'crossOrigin',
	'decoding',
	'height',
	'isMap',
	'loading',
	'referrerPolicy',
	'sizes',
	'src',
	'srcSet',
	'title',
	'useMap',
	'width',
	'data-ctb-lazy-media',
] );

function safeLinkUrl( value ) {
	const url = typeof value === 'string' ? value.trim() : '';
	return /^(?:javascript|data|vbscript):/i.test( url ) ? '' : url;
}

function propertyIsTrue( value ) {
	return (
		value === true ||
		value === 1 ||
		( typeof value === 'string' &&
			[ '1', 'true', 'yes', 'on' ].includes(
				value.trim().toLowerCase()
			) )
	);
}

export function resolveImageRenderModel( block ) {
	const definition = getElement( block?.element );
	if (
		! definition ||
		definition.rendererFamily !== 'image' ||
		! definition.styleTargets.some( ( target ) => target.id === 'media' )
	) {
		return null;
	}
	const props = block?.props || {};
	return Object.freeze( {
		caption: typeof props.caption === 'string' ? props.caption.trim() : '',
		decorative: propertyIsTrue( props.decorative ),
		link: safeLinkUrl( props.link ),
	} );
}

export function createImageTargetElement(
	block,
	sourceAttributes,
	createNode
) {
	const model = resolveImageRenderModel( block );
	if ( ! model || typeof createNode !== 'function' ) {
		return null;
	}

	const rootAttributes = { ...sourceAttributes };
	const mediaAttributes = {};
	for ( const name of MEDIA_ATTRIBUTES ) {
		if ( Object.hasOwn( rootAttributes, name ) ) {
			mediaAttributes[ name ] = rootAttributes[ name ];
			delete rootAttributes[ name ];
		}
	}
	mediaAttributes.alt = model.decorative
		? ''
		: String( mediaAttributes.alt || '' );
	mediaAttributes.className = 'ctb-image-media';
	mediaAttributes[ 'data-ctb-part' ] = 'media';
	if (
		! Object.keys( block.style?.targets || {} ).length &&
		rootAttributes.style
	) {
		mediaAttributes.style = rootAttributes.style;
		delete rootAttributes.style;
	}
	rootAttributes.className = `${
		rootAttributes.className || ''
	} ctb-image-root`.trim();

	const children = [
		createNode( 'img', { key: 'media', ...mediaAttributes } ),
	];
	if ( model.caption ) {
		children.push(
			createNode(
				'figcaption',
				{ key: 'caption', 'data-ctb-part': 'caption' },
				model.caption
			)
		);
	}
	const figure = createNode( 'figure', rootAttributes, children );
	if ( ! model.link ) {
		return figure;
	}
	return createNode(
		'a',
		{
			className: 'ctb-image-link',
			href: model.link,
			onClick: ( event ) => event.preventDefault(),
		},
		figure
	);
}
