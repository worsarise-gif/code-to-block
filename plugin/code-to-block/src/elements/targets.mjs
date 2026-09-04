const TEXT_TARGETS = new Set( [
	'author',
	'bio',
	'body',
	'caption',
	'citation',
	'code',
	'current',
	'description',
	'empty',
	'error',
	'feature',
	'filename',
	'heading',
	'headings',
	'help',
	'label',
	'link',
	'links',
	'list',
	'lists',
	'mark',
	'name',
	'number',
	'period',
	'prefix',
	'price',
	'quote',
	'requiredMark',
	'role',
	'stock',
	'subtitle',
	'suffix',
	'summary',
	'text',
	'title',
	'value',
] );

const MEDIA_TARGETS = new Set( [
	'avatar',
	'image',
	'media',
	'photo',
	'player',
] );

const ICON_TARGETS = new Set( [
	'checkmark',
	'dot',
	'icon',
	'indicator',
	'marker',
	'markers',
] );

const BUTTON_TARGETS = new Set( [
	'actions',
	'button',
	'copyButton',
	'cta',
	'remove',
	'submit',
	'toggle',
] );

const FIELD_TARGETS = new Set( [
	'control',
	'coupon',
	'dropzone',
	'field',
	'input',
	'option',
	'placeholder',
	'variations',
] );

const TARGET_GROUP_PREFERENCES = Object.freeze( {
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
	media: [
		'media',
		'sizing',
		'spacing',
		'border',
		'shadow',
		'filters',
		'childPlacement',
	],
	icon: [
		'icon',
		'sizing',
		'spacing',
		'background',
		'border',
		'shadow',
		'filters',
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
	line: [ 'sizing', 'spacing', 'border', 'childPlacement' ],
} );

const IMPLEMENTED_TARGETS = Object.freeze( {
	'core/button': Object.freeze( [ 'root', 'label', 'icon', 'spinner' ] ),
	'core/heading': Object.freeze( [ 'root', 'text' ] ),
	'core/image': Object.freeze( [ 'root', 'media', 'caption' ] ),
	'core/link': Object.freeze( [ 'root', 'label', 'icon' ] ),
	'core/text': Object.freeze( [ 'root', 'text' ] ),
	'forms/submit-button': Object.freeze( [
		'root',
		'label',
		'icon',
		'spinner',
	] ),
	'forms/field-group': Object.freeze( [
		'root',
		'row',
		'label',
		'control',
		'placeholder',
		'help',
		'error',
		'requiredMark',
	] ),
} );

function targetKind( targetId ) {
	if ( TEXT_TARGETS.has( targetId ) ) {
		return 'text';
	}
	if ( MEDIA_TARGETS.has( targetId ) ) {
		return 'media';
	}
	if ( ICON_TARGETS.has( targetId ) ) {
		return 'icon';
	}
	if ( BUTTON_TARGETS.has( targetId ) ) {
		return 'button';
	}
	if ( FIELD_TARGETS.has( targetId ) ) {
		return 'field';
	}
	if ( targetId === 'line' || targetId === 'separator' ) {
		return 'line';
	}
	return '';
}

export function groupsForTarget( targetId, definitionGroups, explicitGroups ) {
	const granted = new Set( definitionGroups || [] );
	const requested =
		explicitGroups || TARGET_GROUP_PREFERENCES[ targetKind( targetId ) ];
	if ( ! requested || ( targetId === 'root' && ! explicitGroups ) ) {
		return Object.freeze( [ ...granted ] );
	}
	const groups = requested.filter( ( groupId ) => granted.has( groupId ) );
	return Object.freeze( groups.length ? groups : [ ...granted ] );
}

export function normalizeStyleTargets( targets, definitionGroups ) {
	return Object.freeze(
		( targets || [] ).map( ( target ) => {
			const selector = target.selector || '&';
			return Object.freeze( {
				...target,
				selector,
				editorSelector: target.editorSelector || selector,
				frontendSelector: target.frontendSelector || selector,
				styleGroups: groupsForTarget(
					target.id,
					definitionGroups,
					target.styleGroups
				),
			} );
		} )
	);
}

export function elementRootTargetAttributes( block ) {
	if ( typeof block?.element !== 'string' || ! block.element ) {
		return Object.freeze( {} );
	}
	return Object.freeze( {
		'data-ctb-element': block.element,
		'data-ctb-part': 'root',
	} );
}

export function implementedStyleTargets( elementId, targets ) {
	const implemented = new Set(
		IMPLEMENTED_TARGETS[ elementId ] || [ 'root' ]
	);
	return Object.freeze(
		( targets || [] ).filter( ( target ) => implemented.has( target.id ) )
	);
}
