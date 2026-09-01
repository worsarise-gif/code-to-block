import { ADVANCED_GROUPS, STYLE_GROUPS } from '../controls/catalog.mjs';
import { inferElementDefinition } from './registry.mjs';

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

function conditionPasses( condition, block, editorContext ) {
	if ( ! condition ) {
		return true;
	}
	if ( condition.propEquals ) {
		const [ property, expected ] = condition.propEquals;
		return valueAtPath( block, `props.${ property }` ) === expected;
	}
	if ( condition.attributeEquals ) {
		const [ attribute, expected ] = condition.attributeEquals;
		return valueAtPath( block, `attributes.${ attribute }` ) === expected;
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
			conditionPasses( field.condition, block, editorContext )
		)
		.map( ( field ) => ( { ...field, ...fieldSource( block, field ) } ) );
	const activeTarget = definition.styleTargets.some(
		( item ) => item.id === editorContext.targetId
	)
		? editorContext.targetId
		: 'root';
	const activeContext = editorContext.contextKey || 'base';
	const styleGroups = definition.styleGroups.map( ( groupId, index ) => ( {
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
				targets: definition.styleTargets,
				activeTarget,
				activeContext,
				groups: styleGroups,
				properties: definition.styleProperties,
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
		.map( ( group ) => ( {
			...group,
			controls: group.controls?.filter( ( control ) =>
				[
					control.label,
					control.id,
					control.storage,
					control.description,
				]
					.filter( Boolean )
					.some( ( value ) =>
						String( value ).toLowerCase().includes( normalized )
					)
			),
		} ) )
		.filter(
			( group ) =>
				String( group.label || '' )
					.toLowerCase()
					.includes( normalized ) ||
				group.controls?.length ||
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
