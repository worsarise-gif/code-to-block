import { getElement } from './registry.mjs';

function attributeIsTrue( value ) {
	if ( value === true || value === 1 ) {
		return true;
	}
	return (
		typeof value === 'string' &&
		[ '1', 'true', 'yes', 'on' ].includes( value.trim().toLowerCase() )
	);
}

/**
 * Resolve the stable target parts emitted by button-family renderers.
 *
 * The returned part order is shared by the editor renderer and its contract
 * tests. Frontend PHP mirrors these rules and is exercised with the same cases.
 *
 * @param {Object} block Element block.
 * @return {Object|null} Button render model, or null for another renderer family.
 */
export function resolveButtonRenderModel( block ) {
	const definition = getElement( block?.element );
	if ( definition?.rendererFamily !== 'button' ) {
		return null;
	}

	const targetIds = new Set(
		( definition.styleTargets || [] ).map( ( target ) => target.id )
	);
	if ( ! targetIds.has( 'label' ) ) {
		return null;
	}

	const attributes = block.attributes || {};
	const props = block.props || {};
	const loading =
		attributeIsTrue( attributes[ 'aria-busy' ] ) ||
		attributeIsTrue( attributes[ 'data-ctb-loading' ] );
	const icon = typeof props.icon === 'string' ? props.icon.trim() : '';
	const loadingLabel =
		loading && typeof props.loadingLabel === 'string'
			? props.loadingLabel.trim()
			: '';

	let parts;
	if ( loading && targetIds.has( 'spinner' ) ) {
		parts = [ 'spinner', 'label' ];
	} else if ( icon && targetIds.has( 'icon' ) ) {
		parts =
			props.iconPosition === 'before'
				? [ 'icon', 'label' ]
				: [ 'label', 'icon' ];
	} else {
		parts = [ 'label' ];
	}

	return Object.freeze( {
		icon,
		loading,
		loadingLabel,
		parts: Object.freeze( parts ),
	} );
}

/**
 * Create the editor DOM nodes for a registry-backed button renderer.
 *
 * @param {Object}   block        Element block.
 * @param {*}        labelContent Existing rendered child content.
 * @param {Function} createNode   Renderer-provided element factory.
 * @return {Array|null} Ordered React nodes, or null for another renderer family.
 */
export function createButtonTargetNodes( block, labelContent, createNode ) {
	const model = resolveButtonRenderModel( block );
	if ( ! model || typeof createNode !== 'function' ) {
		return null;
	}

	const targetNodes = {
		label: createNode(
			'span',
			{ key: 'button-label', 'data-ctb-part': 'label' },
			model.loadingLabel || labelContent
		),
		icon: createNode( 'span', {
			key: 'button-icon',
			className: `ctb-button-icon ${ model.icon }`,
			'data-ctb-part': 'icon',
			'aria-hidden': 'true',
		} ),
		spinner: createNode(
			'span',
			{
				key: 'button-spinner',
				className: 'ctb-button-spinner',
				'data-ctb-part': 'spinner',
				'aria-hidden': 'true',
			},
			'…'
		),
	};

	return model.parts.map( ( part ) => targetNodes[ part ] );
}
