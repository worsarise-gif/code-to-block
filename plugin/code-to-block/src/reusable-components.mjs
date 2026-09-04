import {
	blockStyleSets,
	parseTokenReference,
	tokenCssValue,
	tokenReference,
} from './design-tokens.mjs';

export const COMPONENT_FAILURE_MESSAGE = 'this saved component failed to load';

let instanceSequence = 0;
const MAX_BLOCKS = 1000;
const MAX_DEPTH = 50;
const MAX_JSON_BYTES = 2097152;

function clone( value ) {
	return JSON.parse( JSON.stringify( value ) );
}

function isBlock( value ) {
	return Boolean( value && typeof value === 'object' && ! value.kind );
}

export function isSavedComponentBlock( block ) {
	return Number.isInteger( block?.meta?.saved_component_id );
}

function visitBlocks( block, callback ) {
	callback( block );
	for ( const child of block.children || [] ) {
		if ( isBlock( child ) ) {
			visitBlocks( child, callback );
		}
	}
}

function collectTokenReferences( value, references ) {
	if ( Array.isArray( value ) ) {
		value.forEach( ( item ) => collectTokenReferences( item, references ) );
		return;
	}
	if ( value && typeof value === 'object' ) {
		Object.values( value ).forEach( ( item ) =>
			collectTokenReferences( item, references )
		);
		return;
	}
	if ( typeof value === 'string' && parseTokenReference( value ) ) {
		references.add( value );
	}
}

export function createComponentDocument( document, block, name ) {
	if ( ! isBlock( block ) ) {
		throw new Error( 'Select a valid block before saving a component.' );
	}
	const componentName = String( name || '' ).trim();
	if ( ! componentName ) {
		throw new Error( 'Component name is required.' );
	}
	const references = new Set();
	const roleReferences = new Set();
	visitBlocks( block, ( item ) => {
		for ( const styleSet of blockStyleSets( item ) ) {
			for ( const reference of Object.values(
				styleSet.token_bindings || {}
			) ) {
				references.add( reference );
			}
			for ( const binding of Object.values(
				styleSet.role_bindings || {}
			) ) {
				roleReferences.add( binding.roleId );
			}
		}
	} );
	for ( const roleId of roleReferences ) {
		const recipe = document.style_roles?.[ roleId ];
		if ( ! recipe ) {
			throw new Error( `Missing guided role ${ roleId }.` );
		}
		collectTokenReferences( recipe, references );
	}

	const designTokens = {};
	for ( const reference of references ) {
		const parsed = parseTokenReference( reference );
		const token = parsed
			? document.design_tokens?.[ parsed.category ]?.[ parsed.id ]
			: null;
		if ( ! parsed || ! token ) {
			throw new Error( `Missing design token ${ reference }.` );
		}
		designTokens[ parsed.category ] ||= {};
		designTokens[ parsed.category ][ parsed.id ] = clone( token );
	}

	const component = {
		schema_version: document.schema_version >= 2 ? 2 : 1,
		name: componentName,
		root: clone( block ),
	};
	if ( Object.keys( designTokens ).length ) {
		component.design_tokens = designTokens;
	}
	if ( roleReferences.size ) {
		component.style_roles = {};
		for ( const roleId of roleReferences ) {
			component.style_roles[ roleId ] = clone(
				document.style_roles[ roleId ]
			);
		}
		component.feature_flags = { guided_roles: true };
	}
	return component;
}

function containsBlockId( block, id ) {
	if ( block.id === id ) {
		return true;
	}
	return ( block.children || [] ).some(
		( child ) => isBlock( child ) && containsBlockId( child, id )
	);
}

export function createComponentInstanceId( root ) {
	let id;
	do {
		instanceSequence += 1;
		id = `saved-component-${ Date.now().toString(
			36
		) }-${ instanceSequence }`;
	} while ( containsBlockId( root, id ) );
	return id;
}

export function createComponentPlaceholder( componentId, id ) {
	return {
		id,
		type: 'container',
		tag: 'div',
		attributes: { class: 'ctb-saved-component' },
		children: [],
		styles: { mapped: {}, custom_css_fallback: '' },
		meta: {
			source: 'saved-component',
			saved_component_id: Number( componentId ),
		},
	};
}

function findBlock( block, id ) {
	if ( block.id === id ) {
		return block;
	}
	for ( const child of block.children || [] ) {
		if ( isBlock( child ) ) {
			const match = findBlock( child, id );
			if ( match ) {
				return match;
			}
		}
	}
	return null;
}

function insertAfter( block, targetId, inserted ) {
	for ( let index = 0; index < block.children.length; index++ ) {
		const child = block.children[ index ];
		if ( ! isBlock( child ) ) {
			continue;
		}
		if ( child.id === targetId ) {
			block.children.splice( index + 1, 0, inserted );
			return true;
		}
		if ( insertAfter( child, targetId, inserted ) ) {
			return true;
		}
	}
	return false;
}

export function insertComponent( document, targetId, componentId, instanceId ) {
	const next = clone( document );
	const target = findBlock( next.root, targetId );
	if ( ! target ) {
		throw new Error( 'The selected insertion target no longer exists.' );
	}
	const id = instanceId || createComponentInstanceId( next.root );
	if ( containsBlockId( next.root, id ) ) {
		throw new Error( 'The saved component instance ID must be unique.' );
	}
	const placeholder = createComponentPlaceholder( componentId, id );
	const canInsertInside =
		target.type === 'container' && ! isSavedComponentBlock( target );
	const inserted = canInsertInside
		? Boolean( target.children.push( placeholder ) )
		: insertAfter( next.root, targetId, placeholder );
	if ( ! inserted ) {
		throw new Error(
			'The saved component cannot be inserted at this position.'
		);
	}
	return next;
}

function assertRenderableBlock( block ) {
	if (
		! isBlock( block ) ||
		typeof block.id !== 'string' ||
		typeof block.tag !== 'string' ||
		! Array.isArray( block.children ) ||
		! block.styles ||
		typeof block.styles !== 'object'
	) {
		throw new Error( COMPONENT_FAILURE_MESSAGE );
	}
	for ( const child of block.children ) {
		if ( child?.kind === 'text' ) {
			if ( typeof child.value !== 'string' ) {
				throw new Error( COMPONENT_FAILURE_MESSAGE );
			}
		} else {
			assertRenderableBlock( child );
		}
	}
}

function tokenIdFor( componentId, id, destination, token ) {
	const base = `saved-${ componentId }-${ id }`.slice( 0, 40 );
	let candidate = base;
	let suffix = 2;
	while (
		destination[ candidate ] &&
		JSON.stringify( destination[ candidate ] ) !== JSON.stringify( token )
	) {
		const tail = `-${ suffix++ }`;
		candidate = `${ base.slice( 0, 40 - tail.length ) }${ tail }`;
	}
	return candidate;
}

function mergeComponentTokens( component, tokens ) {
	const map = {};
	for ( const [ category, categoryTokens ] of Object.entries(
		component.document.design_tokens || {}
	) ) {
		tokens[ category ] ||= {};
		for ( const [ id, token ] of Object.entries( categoryTokens ) ) {
			const nextId = tokenIdFor(
				component.id,
				id,
				tokens[ category ],
				token
			);
			tokens[ category ][ nextId ] = clone( token );
			map[ tokenReference( category, id ) ] = tokenReference(
				category,
				nextId
			);
		}
	}
	return map;
}

function rewriteRoleRecipeTokens( value, tokenMap ) {
	if ( Array.isArray( value ) ) {
		return value.map( ( item ) =>
			rewriteRoleRecipeTokens( item, tokenMap )
		);
	}
	if ( value && typeof value === 'object' ) {
		return Object.fromEntries(
			Object.entries( value ).map( ( [ key, item ] ) => [
				key,
				rewriteRoleRecipeTokens( item, tokenMap ),
			] )
		);
	}
	return tokenMap[ value ] || value;
}

function componentRoleIdFor( componentId, roleId, destination, recipe ) {
	if (
		! destination[ roleId ] ||
		JSON.stringify( destination[ roleId ] ) === JSON.stringify( recipe )
	) {
		return roleId;
	}
	const [ prefix, slug = 'role' ] = roleId.split( '.', 2 );
	const base = `${ prefix }.${ slug }-saved-${ componentId }`.slice( 0, 45 );
	let candidate = base;
	let suffix = 2;
	while (
		destination[ candidate ] &&
		JSON.stringify( destination[ candidate ] ) !== JSON.stringify( recipe )
	) {
		const tail = `-${ suffix++ }`;
		candidate = `${ base.slice( 0, 45 - tail.length ) }${ tail }`;
	}
	return candidate;
}

function mergeComponentRoles( component, roles, tokenMap ) {
	const map = {};
	for ( const [ roleId, sourceRecipe ] of Object.entries(
		component.document.style_roles || {}
	) ) {
		const recipe = rewriteRoleRecipeTokens(
			clone( sourceRecipe ),
			tokenMap
		);
		const nextId = componentRoleIdFor(
			component.id,
			roleId,
			roles,
			recipe
		);
		recipe.id = nextId;
		roles[ nextId ] = recipe;
		map[ roleId ] = nextId;
	}
	return map;
}

function uniqueId( base, used, maxLength = 500 ) {
	base = base.slice( 0, maxLength );
	let id = base;
	let suffix = 2;
	while ( used.has( id ) ) {
		const tail = `-${ suffix++ }`;
		id = `${ base.slice( 0, maxLength - tail.length ) }${ tail }`;
	}
	used.add( id );
	return id;
}

function mapCloneIds(
	block,
	instanceId,
	componentId,
	idMap,
	domIdMap,
	counters,
	usedBlockIds,
	usedDomIds
) {
	const oldId = block.id;
	counters.block += 1;
	const base = `saved-${ componentId }-${ instanceId }-${ counters.block }`;
	block.id = uniqueId( base, usedBlockIds );
	idMap[ oldId ] = block.id;
	if ( typeof block.attributes?.id === 'string' ) {
		const oldDomId = block.attributes.id;
		counters.dom += 1;
		block.attributes.id = uniqueId(
			`${ base }-dom-${ counters.dom }`,
			usedDomIds
		);
		domIdMap[ oldDomId ] = block.attributes.id;
	}
	for ( const child of block.children ) {
		if ( isBlock( child ) ) {
			mapCloneIds(
				child,
				instanceId,
				componentId,
				idMap,
				domIdMap,
				counters,
				usedBlockIds,
				usedDomIds
			);
		}
	}
}

function rewriteStyleTokens( styleSet, tokenMap ) {
	if ( ! styleSet?.token_bindings ) {
		return;
	}
	for ( const [ property, reference ] of Object.entries(
		styleSet.token_bindings
	) ) {
		const nextReference = tokenMap[ reference ];
		if ( ! nextReference ) {
			continue;
		}
		const values = styleSet.mapped || styleSet.declarations;
		if ( values?.[ property ] === tokenCssValue( reference ) ) {
			values[ property ] = tokenCssValue( nextReference );
		}
		styleSet.token_bindings[ property ] = nextReference;
	}
}

function rewriteDomReferences( block, domIdMap ) {
	const idReferenceAttributes = [
		'for',
		'headers',
		'aria-labelledby',
		'aria-describedby',
		'aria-controls',
		'aria-owns',
		'aria-flowto',
		'aria-details',
		'aria-errormessage',
		'aria-activedescendant',
	];
	for ( const name of idReferenceAttributes ) {
		if ( typeof block.attributes?.[ name ] !== 'string' ) {
			continue;
		}
		block.attributes[ name ] = block.attributes[ name ]
			.trim()
			.split( /\s+/ )
			.map( ( id ) => domIdMap[ id ] || id )
			.join( ' ' );
	}
	if ( typeof block.attributes?.href === 'string' ) {
		const id = block.attributes.href.startsWith( '#' )
			? block.attributes.href.slice( 1 )
			: '';
		if ( id && domIdMap[ id ] ) {
			block.attributes.href = `#${ domIdMap[ id ] }`;
		}
	}
}

function rewriteClone( block, idMap, domIdMap, tokenMap, roleMap ) {
	for ( const styleSet of blockStyleSets( block ) ) {
		rewriteStyleTokens( styleSet, tokenMap );
		for ( const binding of Object.values( styleSet.role_bindings || {} ) ) {
			if ( roleMap[ binding.roleId ] ) {
				binding.roleId = roleMap[ binding.roleId ];
			} else {
				styleSet.import_review_flags = [
					...( styleSet.import_review_flags || [] ),
					{
						id: `missing-role-${ binding.roleId.replace(
							/[^a-z0-9-]/gi,
							'-'
						) }`,
						property:
							binding.kind === 'typography'
								? 'font-size'
								: 'padding',
						roleId: binding.roleId,
						message:
							'The source guided role is missing. The computed appearance was preserved locally.',
					},
				];
			}
		}
	}
	for ( const action of block.actions || [] ) {
		const target = action.params?.target_block_id;
		if ( target && idMap[ target ] ) {
			action.params.target_block_id = idMap[ target ];
		}
	}
	rewriteDomReferences( block, domIdMap );
	for ( const child of block.children ) {
		if ( isBlock( child ) ) {
			rewriteClone( child, idMap, domIdMap, tokenMap, roleMap );
		}
	}
}

function cloneComponentRoot(
	component,
	instanceId,
	tokenMap,
	roleMap,
	usedBlockIds,
	usedDomIds
) {
	const root = clone( component.document.root );
	const idMap = Object.create( null );
	const domIdMap = Object.create( null );
	mapCloneIds(
		root,
		instanceId,
		component.id,
		idMap,
		domIdMap,
		{ block: 0, dom: 0 },
		usedBlockIds,
		usedDomIds
	);
	rewriteClone( root, idMap, domIdMap, tokenMap, roleMap );
	return root;
}

function failedPlaceholder( block ) {
	block.attributes = {
		...( block.attributes || {} ),
		class: `${
			block.attributes?.class || ''
		} ctb-saved-component is-failed`.trim(),
	};
	block.children = [ { kind: 'text', value: COMPONENT_FAILURE_MESSAGE } ];
	block.meta = { ...( block.meta || {} ), component_error: true };
	block.meta.component_revision = 'failed';
	return block;
}

function collectUsedIds( block, blockIds, domIds ) {
	blockIds.add( block.id );
	if ( typeof block.attributes?.id === 'string' ) {
		domIds.add( block.attributes.id );
	}
	for ( const child of block.children || [] ) {
		if ( isBlock( child ) ) {
			collectUsedIds( child, blockIds, domIds );
		}
	}
}

function componentMetrics( block ) {
	let blocks = 1;
	let depth = 1;
	for ( const child of block.children ) {
		if ( isBlock( child ) ) {
			const childMetrics = componentMetrics( child );
			blocks += childMetrics.blocks;
			depth = Math.max( depth, childMetrics.depth + 1 );
		}
	}
	return { blocks, depth };
}

function jsonBytes( value ) {
	return new TextEncoder().encode( JSON.stringify( value ) ).length;
}

function countTokens( designTokens ) {
	return Object.values( designTokens || {} ).reduce(
		( total, category ) => total + Object.keys( category || {} ).length,
		0
	);
}

function applySlotValues( block, values ) {
	if ( block.is_content_slot && Object.hasOwn( values, block.id ) ) {
		const value = values[ block.id ];
		if ( [ 'text', 'rich_text' ].includes( block.slot_content_type ) ) {
			block.children = [ { kind: 'text', value } ];
		} else if ( block.slot_content_type === 'image' ) {
			block.attributes = { ...( block.attributes || {} ), src: value };
		} else if ( block.slot_content_type === 'link' ) {
			block.attributes = { ...( block.attributes || {} ), href: value };
		}
	}
	for ( const child of block.children || [] ) {
		if ( isBlock( child ) ) {
			applySlotValues( child, values );
		}
	}
}

export function materializeComponents( document, components ) {
	const resolved = clone( document );
	let tokens = clone( resolved.design_tokens || {} );
	let roles = clone( resolved.style_roles || {} );
	const records = new Map(
		( components || [] ).map( ( component ) => [ component.id, component ] )
	);
	const tokenMaps = new Map();
	const roleMaps = new Map();
	const metricsCache = new Map();
	let usedBlockIds = new Set();
	let usedDomIds = new Set();
	collectUsedIds( resolved.root, usedBlockIds, usedDomIds );
	const budget = { blocks: 0, bytes: jsonBytes( resolved ) };

	function resolve( block, depth ) {
		budget.blocks += 1;
		if ( isSavedComponentBlock( block ) ) {
			const component = records.get( block.meta.saved_component_id );
			try {
				if ( component?.status !== 'ready' || ! component.document ) {
					throw new Error( COMPONENT_FAILURE_MESSAGE );
				}
				if ( ! metricsCache.has( component.id ) ) {
					assertRenderableBlock( component.document.root );
					metricsCache.set( component.id, {
						...componentMetrics( component.document.root ),
						bytes: jsonBytes( component.document ),
					} );
				}
				const metrics = metricsCache.get( component.id );
				const componentBytes = metrics.bytes;
				if (
					budget.blocks + metrics.blocks > MAX_BLOCKS ||
					depth + metrics.depth > MAX_DEPTH ||
					budget.bytes + componentBytes > MAX_JSON_BYTES
				) {
					throw new Error( COMPONENT_FAILURE_MESSAGE );
				}
				const nextTokens = clone( tokens );
				const tokenMap = tokenMaps.has( component.id )
					? tokenMaps.get( component.id )
					: mergeComponentTokens( component, nextTokens );
				const nextRoles = clone( roles );
				const roleMap = roleMaps.has( component.id )
					? roleMaps.get( component.id )
					: mergeComponentRoles( component, nextRoles, tokenMap );
				if ( countTokens( nextTokens ) > 100 ) {
					throw new Error( COMPONENT_FAILURE_MESSAGE );
				}
				const nextBlockIds = new Set( usedBlockIds );
				const nextDomIds = new Set( usedDomIds );
				const clonedRoot = cloneComponentRoot(
					component,
					block.id,
					tokenMap,
					roleMap,
					nextBlockIds,
					nextDomIds
				);
				const cloneBytes = jsonBytes( clonedRoot );
				const tokenBytes = Math.max(
					0,
					jsonBytes( nextTokens ) - jsonBytes( tokens )
				);
				if ( budget.bytes + cloneBytes + tokenBytes > MAX_JSON_BYTES ) {
					throw new Error( COMPONENT_FAILURE_MESSAGE );
				}
				budget.blocks += metrics.blocks;
				budget.bytes += cloneBytes + tokenBytes;
				tokens = nextTokens;
				roles = nextRoles;
				usedBlockIds = nextBlockIds;
				usedDomIds = nextDomIds;
				tokenMaps.set( component.id, tokenMap );
				roleMaps.set( component.id, roleMap );
				block.attributes = {
					...( block.attributes || {} ),
					class: `${
						block.attributes?.class || ''
					} ctb-saved-component`.trim(),
				};
				block.meta = {
					...block.meta,
					component_revision:
						component.revision ||
						String( jsonBytes( component.document ) ),
				};
				block.children = [ clonedRoot ];
				return block;
			} catch {
				return failedPlaceholder( block );
			}
		}
		block.children = block.children.map( ( child ) =>
			isBlock( child ) ? resolve( child, depth + 1 ) : child
		);
		return block;
	}

	resolved.root = resolve( resolved.root, 1 );
	if ( Object.keys( tokens ).length ) {
		resolved.design_tokens = tokens;
	}
	if ( Object.keys( roles ).length ) {
		resolved.style_roles = roles;
	}
	if ( resolved.slot_values ) {
		applySlotValues( resolved.root, resolved.slot_values );
	}
	return resolved;
}
