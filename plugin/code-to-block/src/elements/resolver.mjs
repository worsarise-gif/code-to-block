import {
	ADVANCED_GROUPS,
	STYLE_GROUPS,
	propertiesForGroups,
} from '../controls/catalog.mjs';
import { inferElementDefinition } from './registry.mjs';
import { implementedStyleTargets } from './targets.mjs';
import { parseContextKey } from '../schema-v3.mjs';

function valueAtPath( block, path ) {
	if ( path === 'content' ) {
		return ( block.children || [] )
			.filter( ( child ) => child?.kind === 'text' )
			.map( ( child ) => child.value )
			.join( '' );
	}
	if ( path === 'tag' ) {
		return block.tag || '';
	}
	const parts = String( path ).split( '.' );
	let value = block;
	for ( const part of parts ) {
		if ( value === null || typeof value !== 'object' ) {
			return undefined;
		}
		value = value[ part ];
	}
	return value;
}

function conditionValue( block, path, definition ) {
	const value = valueAtPath( block, path );
	if ( value !== undefined ) {
		return value;
	}
	return definition.contentFields.find( ( field ) => field.storage === path )
		?.default;
}

function conditionPasses( condition, block, editorContext, definition ) {
	if ( ! condition ) {
		return true;
	}
	if ( condition.propEquals ) {
		const [ property, expected ] = condition.propEquals;
		return (
			conditionValue( block, `props.${ property }`, definition ) ===
			expected
		);
	}
	if ( condition.attributeEquals ) {
		const [ attribute, expected ] = condition.attributeEquals;
		return (
			conditionValue( block, `attributes.${ attribute }`, definition ) ===
			expected
		);
	}
	if ( condition.propTruthy ) {
		return Boolean(
			conditionValue(
				block,
				`props.${ condition.propTruthy }`,
				definition
			)
		);
	}
	if ( condition.parentDisplay ) {
		return condition.parentDisplay.includes(
			editorContext?.parentDisplay || 'block'
		);
	}
	return false;
}

function fieldSource( block, field ) {
	const value = valueAtPath( block, field.storage );
	return {
		value: value ?? field.default ?? '',
		modified: value !== undefined && value !== '' && value !== false,
		source: value !== undefined && value !== '' ? 'local' : 'definition',
	};
}

export function resolveInspector( block, editorContext = {} ) {
	const inference = inferElementDefinition( block );
	const definition = inference.definition;
	const contentControls = definition.contentFields
		.filter( ( field ) =>
			conditionPasses( field.condition, block, editorContext, definition )
		)
		.map( ( field ) => ( { ...field, ...fieldSource( block, field ) } ) );
	const editableTargets = implementedStyleTargets(
		block?.element,
		definition.styleTargets
	).filter( ( target ) =>
		conditionPasses( target.condition, block, editorContext, definition )
	);
	const activeTarget = editableTargets.some(
		( item ) => item.id === editorContext.targetId
	)
		? editorContext.targetId
		: 'root';
	const activeTargetDefinition = editableTargets.find(
		( item ) => item.id === activeTarget
	);
	const activeStyleGroups =
		activeTargetDefinition?.styleGroups || definition.styleGroups;
	const requestedContext = parseContextKey(
		editorContext.contextKey || 'base'
	);
	const activeContext =
		requestedContext &&
		( requestedContext.state === 'default' ||
			definition.states.includes( requestedContext.state ) )
			? requestedContext.key
			: 'base';
	const styleGroups = activeStyleGroups.map( ( groupId, index ) => ( {
		...STYLE_GROUPS[ groupId ],
		priority: index,
		availability:
			index < 4 ? 'primary' : index < 7 ? 'recommended' : 'optional',
		targetId: activeTarget,
	} ) );
	const advancedGroups = definition.advancedGroups.map(
		( groupId, index ) => ( {
			...ADVANCED_GROUPS[ groupId ],
			priority: index,
		} )
	);
	return {
		definition,
		inference,
		identity: {
			id: definition.id,
			label: definition.label,
			version: definition.version,
			legacy: definition.id === 'legacy/html-node',
		},
		tabs: {
			content: {
				id: 'content',
				label: 'Content',
				groups: contentControls.length
					? [
							{
								id: 'content',
								label: definition.label,
								controls: contentControls,
							},
					  ]
					: [],
			},
			style: {
				id: 'style',
				label: 'Style',
				targets: editableTargets,
				activeTarget,
				activeContext,
				groups: styleGroups,
				properties: propertiesForGroups( activeStyleGroups ),
				states: definition.states,
			},
			advanced: {
				id: 'advanced',
				label: 'Advanced',
				groups: advancedGroups,
			},
		},
	};
}

export function panelSearch( panel, query ) {
	const normalized = String( query || '' )
		.trim()
		.toLowerCase();
	if ( ! normalized ) {
		return panel;
	}
	const groups = ( panel.groups || [] )
		.map( ( group ) => {
			const groupMatches = [ group.id, group.label ]
				.filter( Boolean )
				.some( ( value ) =>
					String( value ).toLowerCase().includes( normalized )
				);
			return {
				...group,
				controls: groupMatches
					? group.controls
					: group.controls?.filter( ( control ) =>
							[
								control.label,
								control.id,
								control.storage,
								control.description,
							]
								.filter( Boolean )
								.some( ( value ) =>
									String( value )
										.toLowerCase()
										.includes( normalized )
								)
					  ),
			};
		} )
		.filter(
			( group ) =>
				[ group.id, group.label ]
					.filter( Boolean )
					.some( ( value ) =>
						String( value ).toLowerCase().includes( normalized )
					) ||
				group.controls?.length ||
				( group.fields || [] ).some( ( field ) =>
					String( field ).toLowerCase().includes( normalized )
				) ||
				( group.properties || [] ).some( ( property ) =>
					property.includes( normalized )
				)
		);
	return { ...panel, groups };
}

export function allowedTagForBlock( block, tagName ) {
	const definition = inferElementDefinition( block ).definition;
	return (
		definition.allowedTags.includes( '*' ) ||
		definition.allowedTags.includes( String( tagName ).toLowerCase() )
	);
}
