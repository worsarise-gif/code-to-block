import { create } from 'zustand';

import {
	ensureGuidedRoleDesignSystem,
	guidedRolesEnabled,
	roleCatalog,
	recommendStyleRoles,
	applyRoleToStyleSet,
	adjustRoleInStyleSet,
	setRolePropertyOverride,
	rejoinRoleProperty,
	resolveImportReviewFlag,
	updateRolePropertyGlobally,
	restoreBalancedRole,
	migrateGuidedRolesDocument,
} from '../semantic-roles.mjs';
import {
	commitDocument,
	resetDocumentHistory,
	syncSavedDocument,
	markSavedSnapshot,
	undoDocument,
	redoDocument,
} from '../history.mjs';
import {
	updateBlockStyleSet,
	setStyleSetBindings,
	setHiddenInFallback,
	updateEditableBlock,
	createPrimitiveBlock,
} from './block-commands.mjs';
import { mergeMappedStyleUpdates } from '../custom-css.mjs';
import {
	findBlock,
	moveBlockSibling,
} from '../tree.mjs';
import {
	effectiveMappedStyles,
	ownStyleSet,
	setOwnStyleSet,
} from '../responsive-styles.mjs';
import { canInsertElement } from '../elements/registry.mjs';
import { allowedTagForBlock } from '../elements/resolver.mjs';
import {
	TOKEN_PROPERTIES,
	tokenIdIsValid,
	tokenReference,
	countTokenConsumers,
	getDesignToken,
	tokensForProperty,
	tokenCssValue,
} from '../design-tokens.mjs';
import { insertComponent } from '../reusable-components.mjs';
import {
	prepareStarterDocument,
	insertStarter as insertStarterTemplate,
} from '../starter-templates.mjs';

export const VOID_TAGS = new Set( [
	'br',
	'col',
	'hr',
	'img',
	'input',
	'source',
	'track',
	'wbr',
] );

export const EXAMPLE_DOCUMENT = ensureGuidedRoleDesignSystem(
	{
		schema_version: 1,
		name: 'Pricing card',
		root: {
			id: 'pricing-card',
			type: 'container',
			tag: 'article',
			attributes: { class: 'pricing-card' },
			children: [
				{
					id: 'pricing-plan-name',
					type: 'text',
					tag: 'h2',
					attributes: {},
					children: [ { kind: 'text', value: 'Professional' } ],
					styles: {
						mapped: {
							color: '#27314d',
							'font-size': '22px',
							margin: '0 0 12px',
						},
						custom_css_fallback: '',
					},
					meta: { source: 'phase-3-example' },
				},
				{
					id: 'pricing-price',
					type: 'text',
					tag: 'p',
					attributes: {},
					children: [
						{
							id: 'pricing-price-value',
							type: 'text',
							tag: 'span',
							attributes: {},
							children: [ { kind: 'text', value: '$29' } ],
							styles: {
								mapped: {
									color: '#121936',
									'font-size': '44px',
									'font-weight': '750',
								},
								custom_css_fallback: '',
							},
							meta: { source: 'phase-3-example' },
						},
						{ kind: 'text', value: '/month' },
					],
					styles: {
						mapped: { color: '#69708a', margin: '0 0 24px' },
						custom_css_fallback: '',
					},
					meta: { source: 'phase-3-example' },
				},
				{
					id: 'pricing-features',
					type: 'container',
					tag: 'ul',
					attributes: {},
					children: [
						createTextBlock(
							'pricing-feature-projects',
							'Unlimited projects'
						),
						createTextBlock(
							'pricing-feature-support',
							'Priority support'
						),
					],
					styles: {
						mapped: {
							color: '#3e4662',
							'line-height': '1.9',
							margin: '0 0 28px',
							'padding-left': '20px',
						},
						custom_css_fallback: '',
					},
					meta: { source: 'phase-3-example' },
				},
				{
					id: 'pricing-cta',
					type: 'button',
					tag: 'a',
					attributes: { href: '#signup' },
					children: [ { kind: 'text', value: 'Start free trial' } ],
					styles: {
						mapped: {
							background: '#6558d3',
							'border-radius': '9px',
							color: '#ffffff',
							display: 'block',
							padding: '13px 18px',
							'text-align': 'center',
							'text-decoration': 'none',
						},
						custom_css_fallback: '',
					},
					meta: { source: 'phase-3-example' },
				},
			],
			styles: {
				mapped: {
					background: '#ffffff',
					border: '1px solid #c8cee0',
					'border-radius': '18px',
					'box-shadow': '0 22px 55px rgba(25, 33, 61, 0.16)',
					'font-family': 'Arial, sans-serif',
					'max-width': '360px',
					padding: '34px',
				},
				custom_css_fallback: '',
			},
			meta: { source: 'phase-3-example' },
		},
	},
	{ newDocument: true }
);

function createTextBlock( id, value ) {
	return {
		id,
		type: 'text',
		tag: 'li',
		attributes: {},
		children: [ { kind: 'text', value } ],
		styles: {
			mapped: { color: '#3e4662', 'line-height': '1.9' },
			custom_css_fallback: '',
		},
		meta: { source: 'phase-3-example' },
	};
}

export const useEditorStore = create( ( set ) => ( {
	document: EXAMPLE_DOCUMENT,
	past: [],
	future: [],
	savedDocument: null,
	selectedBlockId: EXAMPLE_DOCUMENT.root.id,
	activeBreakpoint: 'desktop',
	panelMode: 'simple',
	setEditorContext: ( activeBreakpoint, panelMode ) =>
		set( { activeBreakpoint, panelMode } ),
	setDocument: ( document ) =>
		set( ( state ) => commitDocument( state, document, document.root.id ) ),
	resetDocument: ( document ) => set( resetDocumentHistory( document ) ),
	syncSavedDocument: ( document ) =>
		set( ( state ) => syncSavedDocument( state, document ) ),
	markSavedSnapshot: ( snapshot, savedDocument ) =>
		set( ( state ) => markSavedSnapshot( state, snapshot, savedDocument ) ),
	undo: () => set( ( state ) => undoDocument( state ) ),
	redo: () => set( ( state ) => redoDocument( state ) ),
	selectBlock: ( selectedBlockId ) => set( { selectedBlockId } ),
	updateBlockColor: ( id, color, breakpoint = 'desktop' ) =>
		set( ( state ) =>
			updateBlockStyleSet( state, id, breakpoint, ( styleSet ) => {
				styleSet.mapped = mergeMappedStyleUpdates( styleSet.mapped, {
					color,
				} );
				const bindings = { ...( styleSet.token_bindings || {} ) };
				if ( ! color ) {
					delete bindings.color;
				}
				return setStyleSetBindings( styleSet, bindings );
			} )
		),
	updateBlockCustomCss: ( id, customCss, breakpoint = 'desktop' ) =>
		set( ( state ) =>
			updateBlockStyleSet( state, id, breakpoint, ( styleSet ) => ( {
				...styleSet,
				custom_css_fallback: customCss,
			} ) )
		),
	updateBlockMappedStyles: ( id, updates, breakpoint = 'desktop' ) =>
		set( ( state ) =>
			updateBlockStyleSet( state, id, breakpoint, ( styleSet ) => {
				styleSet.mapped = mergeMappedStyleUpdates(
					styleSet.mapped,
					updates
				);
				const bindings = { ...( styleSet.token_bindings || {} ) };
				for ( const [ property, value ] of Object.entries( updates ) ) {
					if ( ! value ) {
						delete bindings[ property ];
					}
				}
				return setStyleSetBindings( styleSet, bindings );
			} )
		),
	replaceBlockStyleSet: ( id, replacement, breakpoint = 'desktop' ) =>
		set( ( state ) =>
			updateBlockStyleSet( state, id, breakpoint, () =>
				JSON.parse( JSON.stringify( replacement ) )
			)
		),
	setBlockHidden: ( id, breakpoint, hidden ) =>
		set( ( state ) => {
			const block = findBlock( state.document.root, id );
			const mappedDisplay = block
				? effectiveMappedStyles( block, breakpoint ).display
				: '';
			const visibleDisplay =
				mappedDisplay && mappedDisplay !== 'none'
					? mappedDisplay
					: 'block';
			return updateBlockStyleSet(
				state,
				id,
				breakpoint,
				( styleSet ) => ( {
					...styleSet,
					custom_css_fallback: setHiddenInFallback(
						styleSet.custom_css_fallback,
						hidden,
						visibleDisplay
					),
				} )
			);
		} ),
	updateBlockContent: ( id, value ) =>
		set( ( state ) =>
			updateEditableBlock( state, id, ( block ) => {
				const textChildren = ( block.children || [] ).filter(
					( child ) => child.kind === 'text'
				);
				if ( textChildren.length ) {
					textChildren[ 0 ].value = String( value );
					block.children = [
						...textChildren,
						...( block.children || [] ).filter(
							( child ) => child.kind !== 'text'
						),
					];
				} else if ( ! VOID_TAGS.has( block.tag ) ) {
					block.children = [
						{ kind: 'text', value: String( value ) },
					];
				}
			} )
		),
	updateBlockAttribute: ( id, name, value ) =>
		set( ( state ) =>
			updateEditableBlock( state, id, ( block ) => {
				const normalized = String( name || '' )
					.trim()
					.toLowerCase();
				if (
					! /^(?:[a-z][a-z0-9_.:-]*|aria-[a-z0-9_.:-]+|data-[a-z0-9_.:-]+)$/.test(
						normalized
					) ||
					/^on/.test( normalized ) ||
					normalized === 'style'
				) {
					return;
				}
				block.attributes = { ...( block.attributes || {} ) };
				if ( '' === String( value ?? '' ).trim() ) {
					delete block.attributes[ normalized ];
				} else {
					block.attributes[ normalized ] = value;
				}
			} )
		),
	updateBlockProp: ( id, name, value ) =>
		set( ( state ) =>
			updateEditableBlock( state, id, ( block ) => {
				const normalized = String( name || '' ).trim();
				if ( ! /^[a-z][A-Za-z0-9_-]{0,63}$/.test( normalized ) ) {
					return;
				}
				block.props = { ...( block.props || {} ) };
				if ( value === '' || value === null || value === undefined ) {
					delete block.props[ normalized ];
				} else {
					block.props[ normalized ] = value;
				}
			} )
		),
	updateBlockTag: ( id, tag ) =>
		set( ( state ) =>
			updateEditableBlock( state, id, ( block ) => {
				const normalized = String( tag || '' ).toLowerCase();
				if (
					! allowedTagForBlock( block, normalized ) ||
					( VOID_TAGS.has( normalized ) && block.children?.length )
				) {
					return;
				}
				block.tag = normalized;
			} )
		),
	setBlockVisibilityConditions: ( id, conditions ) =>
		set( ( state ) =>
			updateEditableBlock( state, id, ( block ) => {
				const login = [ 'logged_in', 'logged_out' ].includes(
					conditions?.login
				)
					? conditions.login
					: 'any';
				const roles = Array.isArray( conditions?.roles )
					? conditions.roles.filter( Boolean )
					: [];
				if ( login === 'any' && roles.length === 0 ) {
					delete block.visibility_conditions;
				} else {
					block.visibility_conditions = {
						...( login !== 'any' ? { login } : {} ),
						...( roles.length ? { roles } : {} ),
					};
				}
			} )
		),
	setBlockStateStyles: ( id, stateName, updates ) =>
		set( ( state ) =>
			updateEditableBlock( state, id, ( block ) => {
				if ( stateName === 'default' ) {
					block.styles.mapped = mergeMappedStyleUpdates(
						block.styles.mapped,
						updates
					);
					return;
				}
				if ( ! [ 'hover', 'focus', 'active' ].includes( stateName ) ) {
					return;
				}
				const current = block.states?.[ stateName ] || {
					mapped: {},
					custom_css_fallback: '',
				};
				const next = {
					...current,
					mapped: mergeMappedStyleUpdates(
						current.mapped || {},
						updates
					),
				};
				block.states = {
					...( block.states || {} ),
					[ stateName ]: next,
				};
				if (
					Object.keys( next.mapped || {} ).length === 0 &&
					! next.custom_css_fallback
				) {
					delete block.states[ stateName ];
					if ( Object.keys( block.states ).length === 0 ) {
						delete block.states;
					}
				}
			} )
		),
	setBlockPermissions: ( id, permissions ) =>
		set( ( state ) =>
			updateEditableBlock(
				state,
				id,
				( block ) => {
					const next = {
						...( permissions?.role
							? { role: permissions.role }
							: {} ),
						...( permissions?.can_edit === false
							? { can_edit: false }
							: {} ),
						...( permissions?.can_delete === false
							? { can_delete: false }
							: {} ),
						...( permissions?.can_publish === false
							? { can_publish: false }
							: {} ),
						...( permissions?.locked ? { locked: true } : {} ),
					};
					if ( Object.keys( next ).length ) {
						block.permissions = next;
					} else {
						delete block.permissions;
					}
				},
				true
			)
		),
	setBlockPerformance: ( id, performance ) =>
		set( ( state ) =>
			updateEditableBlock( state, id, ( block ) => {
				const next = {
					...( performance?.lazy_load ? { lazy_load: true } : {} ),
					...( performance?.image_lazy_load
						? { image_lazy_load: true }
						: {} ),
				};
				if ( Object.keys( next ).length ) {
					block.performance = next;
				} else {
					delete block.performance;
				}
			} )
		),
	insertPrimitive: ( targetId, primitive, position = 'auto' ) =>
		set( ( state ) => {
			const newBlock = createPrimitiveBlock( primitive );
			const target = findBlock( state.document.root, targetId );
			if ( ! newBlock || ! target || target.permissions?.locked ) {
				return state;
			}
			const canInsertInside = canInsertElement( target, newBlock );
			if (
				( position === 'inside' && ! canInsertInside ) ||
				( [ 'before', 'after' ].includes( position ) &&
					targetId === state.document.root.id )
			) {
				return state;
			}
			const document = JSON.parse( JSON.stringify( state.document ) );
			const inserted = insertAtDropPosition(
				document.root,
				targetId,
				newBlock,
				position,
				canInsertInside
			);
			if ( ! inserted ) {
				return state;
			}
			if ( guidedRolesEnabled( document ) ) {
				const insertedBlock = findBlock( document.root, newBlock.id );
				const roles = roleCatalog( document );
				if (
					insertedBlock &&
					[ 'heading', 'text', 'button' ].includes( primitive )
				) {
					const recommendation = recommendStyleRoles(
						document,
						newBlock.id,
						{
							property: 'font-size',
						}
					)[ 0 ];
					if ( recommendation ) {
						insertedBlock.styles = applyRoleToStyleSet(
							insertedBlock.styles,
							recommendation.roleId,
							'typography',
							roles
						);
					}
				}
				if (
					insertedBlock &&
					[ 'section', 'container' ].includes( primitive )
				) {
					const recommendation = recommendStyleRoles(
						document,
						newBlock.id,
						{
							property: 'padding',
						}
					)[ 0 ];
					if ( recommendation ) {
						insertedBlock.styles = applyRoleToStyleSet(
							insertedBlock.styles,
							recommendation.roleId,
							'padding',
							roles
						);
					}
				}
			}
			return commitDocument( state, document, newBlock.id );
		} ),
	setBlockSlotProperties: ( id, isSlot, label, type ) =>
		set( ( state ) => {
			if ( findBlock( state.document.root, id )?.permissions?.locked ) {
				return state;
			}
			const document = JSON.parse( JSON.stringify( state.document ) );
			const block = findBlock( document.root, id );
			if ( ! block ) {
				return state;
			}

			if ( isSlot ) {
				block.is_content_slot = true;
				if ( label ) {
					block.slot_label = label;
				}
				if ( type ) {
					block.slot_content_type = type;
				}
			} else {
				delete block.is_content_slot;
				delete block.slot_label;
				delete block.slot_content_type;
			}
			return commitDocument( state, document, state.selectedBlockId );
		} ),
	setBlockDynamicProperties: ( id, isDynamic, dynamicSource ) =>
		set( ( state ) => {
			if ( findBlock( state.document.root, id )?.permissions?.locked ) {
				return state;
			}
			const document = JSON.parse( JSON.stringify( state.document ) );
			const block = findBlock( document.root, id );
			if ( ! block ) {
				return state;
			}

			if ( isDynamic ) {
				block.is_dynamic = true;
				if ( dynamicSource ) {
					block.dynamic_source = dynamicSource;
				}
			} else {
				delete block.is_dynamic;
				delete block.dynamic_source;
			}
			return commitDocument( state, document, state.selectedBlockId );
		} ),
	upsertDesignToken: ( category, id, token ) =>
		set( ( state ) => {
			if (
				! TOKEN_PROPERTIES[ category ] ||
				! tokenIdIsValid( id ) ||
				! token?.label ||
				! token?.value
			) {
				return state;
			}
			const current = state.document.design_tokens?.[ category ]?.[ id ];
			if ( JSON.stringify( current ) === JSON.stringify( token ) ) {
				return state;
			}
			const document = JSON.parse( JSON.stringify( state.document ) );
			document.design_tokens = {
				...( document.design_tokens || {} ),
				[ category ]: {
					...( document.design_tokens?.[ category ] || {} ),
					[ id ]: token,
				},
			};
			return commitDocument( state, document, state.selectedBlockId );
		} ),
	deleteDesignToken: ( category, id ) =>
		set( ( state ) => {
			const reference = tokenReference( category, id );
			if (
				! state.document.design_tokens?.[ category ]?.[ id ] ||
				countTokenConsumers( state.document, reference )
			) {
				return state;
			}
			const document = JSON.parse( JSON.stringify( state.document ) );
			delete document.design_tokens[ category ][ id ];
			if ( ! Object.keys( document.design_tokens[ category ] ).length ) {
				delete document.design_tokens[ category ];
			}
			if ( ! Object.keys( document.design_tokens ).length ) {
				delete document.design_tokens;
			}
			return commitDocument( state, document, state.selectedBlockId );
		} ),
	setBlockTokenBinding: (
		id,
		property,
		reference,
		breakpoint = 'desktop',
		localOverride = false
	) =>
		set( ( state ) => {
			const token = getDesignToken(
				state.document.design_tokens,
				reference
			);
			if (
				! token ||
				! tokensForProperty(
					state.document.design_tokens,
					property
				).some( ( item ) => item.reference === reference )
			) {
				return state;
			}
			return updateBlockStyleSet( state, id, breakpoint, ( styleSet ) => {
				styleSet.mapped[ property ] = localOverride
					? token.value
					: tokenCssValue( reference );
				return setStyleSetBindings( styleSet, {
					...( styleSet.token_bindings || {} ),
					[ property ]: reference,
				} );
			} );
		} ),
	removeBlockTokenBinding: (
		id,
		property,
		reference,
		breakpoint = 'desktop'
	) =>
		set( ( state ) => {
			const token = getDesignToken(
				state.document.design_tokens,
				reference
			);
			return updateBlockStyleSet( state, id, breakpoint, ( styleSet ) => {
				const bindings = { ...( styleSet.token_bindings || {} ) };
				delete bindings[ property ];
				if (
					token &&
					styleSet.mapped[ property ] === tokenCssValue( reference )
				) {
					styleSet.mapped[ property ] = token.value;
				}
				return setStyleSetBindings( styleSet, bindings );
			} );
		} ),
	setBlockStyleRole: (
		id,
		roleId,
		scope,
		breakpoint = 'desktop',
		source = 'built-in'
	) =>
		set( ( state ) =>
			updateBlockStyleSet( state, id, breakpoint, ( styleSet ) =>
				applyRoleToStyleSet(
					styleSet,
					roleId,
					scope,
					roleCatalog( state.document ),
					{ source }
				)
			)
		),
	adjustBlockStyleRole: ( id, scope, adjustment, breakpoint = 'desktop' ) =>
		set( ( state ) =>
			updateBlockStyleSet( state, id, breakpoint, ( styleSet ) =>
				adjustRoleInStyleSet(
					styleSet,
					scope,
					{ ...adjustment, breakpoint },
					roleCatalog( state.document )
				)
			)
		),
	setBlockRolePropertyOverride: (
		id,
		scope,
		property,
		value,
		breakpoint = 'desktop',
		stateName = ''
	) =>
		set( ( state ) =>
			updateBlockStyleSet( state, id, breakpoint, ( styleSet ) =>
				setRolePropertyOverride(
					styleSet,
					scope,
					property,
					value,
					{
						...( breakpoint !== 'desktop' ? { breakpoint } : {} ),
						...( stateName ? { state: stateName } : {} ),
					},
					roleCatalog( state.document )
				)
			)
		),
	rejoinBlockRoleProperty: (
		id,
		scope,
		property,
		breakpoint = 'desktop',
		stateName = ''
	) =>
		set( ( state ) =>
			updateBlockStyleSet( state, id, breakpoint, ( styleSet ) =>
				rejoinRoleProperty(
					styleSet,
					scope,
					property,
					{
						...( breakpoint !== 'desktop' ? { breakpoint } : {} ),
						...( stateName ? { state: stateName } : {} ),
					},
					roleCatalog( state.document )
				)
			)
		),
	resolveBlockImportReview: ( id, flagId, useRole, breakpoint = 'desktop' ) =>
		set( ( state ) =>
			updateBlockStyleSet( state, id, breakpoint, ( styleSet ) =>
				resolveImportReviewFlag(
					styleSet,
					flagId,
					{ useRole },
					roleCatalog( state.document )
				)
			)
		),
	rejoinGuidedRoleOverride: (
		id,
		scope,
		property,
		breakpoint = 'desktop',
		stateName = ''
	) =>
		set( ( state ) => {
			const currentBlock = findBlock( state.document.root, id );
			if ( ! currentBlock || currentBlock.permissions?.locked ) {
				return state;
			}
			const currentStyleSet = stateName
				? currentBlock.states?.[ stateName ]
				: ownStyleSet( currentBlock, breakpoint );
			if ( ! currentStyleSet ) {
				return state;
			}
			const nextStyleSet = rejoinRoleProperty(
				currentStyleSet,
				scope,
				property,
				{
					...( breakpoint !== 'desktop' ? { breakpoint } : {} ),
					...( stateName ? { state: stateName } : {} ),
				},
				roleCatalog( state.document )
			);
			if (
				JSON.stringify( currentStyleSet ) ===
				JSON.stringify( nextStyleSet )
			) {
				return state;
			}
			const document = JSON.parse( JSON.stringify( state.document ) );
			const block = findBlock( document.root, id );
			if ( stateName ) {
				block.states = {
					...( block.states || {} ),
					[ stateName ]: nextStyleSet,
				};
			} else {
				setOwnStyleSet( block, breakpoint, nextStyleSet );
			}
			return commitDocument( state, document, id );
		} ),
	updateGuidedRoleProperty: ( roleId, property, value, scope, binding ) =>
		set( ( state ) => {
			const document = updateRolePropertyGlobally(
				state.document,
				roleId,
				property,
				value,
				{ scope, binding }
			);
			return JSON.stringify( document ) ===
				JSON.stringify( state.document )
				? state
				: commitDocument( state, document, state.selectedBlockId );
		} ),
	restoreGuidedRole: ( roleId ) =>
		set( ( state ) => {
			const document = restoreBalancedRole( state.document, roleId );
			return JSON.stringify( document ) ===
				JSON.stringify( state.document )
				? state
				: commitDocument( state, document, state.selectedBlockId );
		} ),
	setSeoField: ( key, value ) =>
		set( ( state ) => {
			const document = JSON.parse( JSON.stringify( state.document ) );
			if ( ! document.seo ) {
				document.seo = {};
			}
			if ( '' === ( value || '' ).trim() ) {
				delete document.seo[ key ];
				if ( ! Object.keys( document.seo ).length ) {
					delete document.seo;
				}
			} else {
				document.seo[ key ] = String( value ).slice( 0, 1000 );
			}
			return commitDocument( state, document, state.selectedBlockId );
		} ),
	addBlockAction: ( id, action ) =>
		set( ( state ) => {
			const currentBlock = findBlock( state.document.root, id );
			if ( ! currentBlock || currentBlock.permissions?.locked ) {
				return state;
			}
			const actions = currentBlock.actions || [];
			if (
				actions.some(
					( currentAction ) =>
						JSON.stringify( currentAction ) ===
						JSON.stringify( action )
				)
			) {
				return state;
			}
			const document = JSON.parse( JSON.stringify( state.document ) );
			const block = findBlock( document.root, id );
			block.actions = [ ...( block.actions || [] ), action ];
			return commitDocument( state, document, id );
		} ),
	updateBlockAction: ( id, index, updatedAction ) =>
		set( ( state ) => {
			const currentBlock = findBlock( state.document.root, id );
			if (
				! currentBlock ||
				currentBlock.permissions?.locked ||
				! currentBlock.actions ||
				! currentBlock.actions[ index ]
			) {
				return state;
			}
			const document = JSON.parse( JSON.stringify( state.document ) );
			const block = findBlock( document.root, id );
			block.actions[ index ] = updatedAction;
			return commitDocument( state, document, id );
		} ),
	removeBlockAction: ( id, index ) =>
		set( ( state ) => {
			const currentBlock = findBlock( state.document.root, id );
			if (
				! currentBlock?.actions?.[ index ] ||
				currentBlock.permissions?.locked
			) {
				return state;
			}
			const document = JSON.parse( JSON.stringify( state.document ) );
			const block = findBlock( document.root, id );
			block.actions.splice( index, 1 );
			if ( ! block.actions.length ) {
				delete block.actions;
			}
			return commitDocument( state, document, id );
		} ),
	moveBlock: ( activeId, targetId, position = 'auto' ) =>
		set( ( state ) => {
			if (
				activeId === state.document.root.id ||
				activeId === targetId
			) {
				return state;
			}

			const source = findBlock( state.document.root, activeId );
			const target = findBlock( state.document.root, targetId );
			if (
				! source ||
				! target ||
				source.permissions?.locked ||
				target.permissions?.locked ||
				findBlock( source, targetId )
			) {
				return state;
			}
			const canContain =
				target.type === 'container' && ! VOID_TAGS.has( target.tag );
			if (
				( position === 'inside' && ! canContain ) ||
				( [ 'before', 'after' ].includes( position ) &&
					targetId === state.document.root.id )
			) {
				return state;
			}

			const document = JSON.parse( JSON.stringify( state.document ) );
			const movedBlock = removeBlock( document.root, activeId );
			if ( ! movedBlock ) {
				return state;
			}

			const inserted = insertAtDropPosition(
				document.root,
				targetId,
				movedBlock,
				position,
				canContain
			);

			return inserted ? commitDocument( state, document ) : state;
		} ),
	moveBlockSibling: ( id, direction ) =>
		set( ( state ) => {
			if ( findBlock( state.document.root, id )?.permissions?.locked ) {
				return state;
			}
			const document = JSON.parse( JSON.stringify( state.document ) );
			return moveBlockSibling( document.root, id, direction )
				? commitDocument( state, document )
				: state;
		} ),
	insertSavedComponent: ( targetId, componentId ) =>
		set( ( state ) => {
			const document = insertComponent(
				state.document,
				targetId,
				componentId
			);
			return commitDocument( state, document, targetId );
		} ),
	replaceWithStarter: ( templateId ) =>
		set( () => {
			const document = migrateGuidedRolesDocument(
				prepareStarterDocument( templateId ),
				{ newDocument: true }
			);
			return resetDocumentHistory( document );
		} ),
	insertStarter: ( targetId, templateId ) =>
		set( ( state ) => {
			const document = insertStarterTemplate(
				state.document,
				targetId,
				templateId
			);
			return commitDocument( state, document, targetId );
		} ),
	insertWooCommerceBlock: ( targetId, wooType, options = {} ) =>
		set( ( state ) => {
			const document = JSON.parse( JSON.stringify( state.document ) );
			const target = findBlock( document.root, targetId );
			if ( ! target ) {
				return state;
			}
			const usedIds = new Set();
			const collectIds = ( block ) => {
				usedIds.add( block.id );
				for ( const child of block.children || [] ) {
					if ( child.kind !== 'text' ) {
						collectIds( child );
					}
				}
			};
			collectIds( document.root );
			const makeId = ( base ) => {
				let id = base;
				let n = 2;
				while ( usedIds.has( id ) ) {
					id = `${ base }-${ n++ }`;
				}
				usedIds.add( id );
				return id;
			};
			const blockCount = ( block ) => {
				let c = 1;
				for ( const child of block.children || [] ) {
					if ( child.kind !== 'text' ) {
						c += blockCount( child );
					}
				}
				return c;
			};
			const existingCount = blockCount( document.root );
			let newBlock = null;
			const baseId = `woo-${ wooType }-${ Date.now().toString( 36 ) }`;
			if ( 'woocommerce_cart' === wooType ) {
				newBlock = {
					id: makeId( baseId ),
					type: 'woocommerce_cart',
					tag: 'div',
					attributes: { class: 'ctb-woo-cart' },
					children: [],
					styles: {
						mapped: { padding: '16px', border: '1px solid #ddd' },
						custom_css_fallback: '',
					},
					meta: { source: 'editor' },
				};
			} else if ( 'woocommerce_checkout' === wooType ) {
				newBlock = {
					id: makeId( baseId ),
					type: 'woocommerce_checkout',
					tag: 'div',
					attributes: { class: 'ctb-woo-checkout' },
					children: [],
					styles: {
						mapped: { padding: '16px', border: '1px solid #ddd' },
						custom_css_fallback: '',
					},
					meta: { source: 'editor' },
				};
			} else if ( 'woocommerce_product' === wooType ) {
				const productId = options.productId
					? String( options.productId )
					: '';
				const attrs = { class: 'ctb-woo-product' };
				if ( productId ) {
					attrs[ 'data-product-id' ] = productId;
				}
				// Create a product template: image + title + price + description within product context
				const pId = makeId( baseId );
				const titleId = makeId( `${ baseId }-title` );
				const priceId = makeId( `${ baseId }-price` );
				const descId = makeId( `${ baseId }-desc` );
				const imgId = makeId( `${ baseId }-img` );
				const stockId = makeId( `${ baseId }-stock` );
				newBlock = {
					id: pId,
					type: 'woocommerce_product',
					tag: 'div',
					attributes: attrs,
					children: [
						{
							id: imgId,
							type: 'image',
							tag: 'img',
							attributes: { alt: '', src: '' },
							children: [],
							styles: { mapped: {}, custom_css_fallback: '' },
							is_dynamic: true,
							dynamic_source: 'wc_product_image',
							meta: { source: 'editor' },
						},
						{
							id: titleId,
							type: 'text',
							tag: 'h3',
							attributes: {},
							children: [ { kind: 'text', value: '' } ],
							styles: {
								mapped: {
									'font-size': '18px',
									'font-weight': '700',
								},
								custom_css_fallback: '',
							},
							is_dynamic: true,
							dynamic_source: 'wc_product_title',
							meta: { source: 'editor' },
						},
						{
							id: priceId,
							type: 'text',
							tag: 'p',
							attributes: { class: 'ctb-woo-price' },
							children: [ { kind: 'text', value: '' } ],
							styles: {
								mapped: { color: '#111' },
								custom_css_fallback: '',
							},
							is_dynamic: true,
							dynamic_source: 'wc_product_price',
							meta: { source: 'editor' },
						},
						{
							id: descId,
							type: 'text',
							tag: 'p',
							attributes: {},
							children: [ { kind: 'text', value: '' } ],
							styles: {
								mapped: { 'font-size': '14px' },
								custom_css_fallback: '',
							},
							is_dynamic: true,
							dynamic_source: 'wc_product_short_description',
							meta: { source: 'editor' },
						},
						{
							id: stockId,
							type: 'text',
							tag: 'p',
							attributes: { class: 'ctb-woo-stock' },
							children: [ { kind: 'text', value: '' } ],
							styles: {
								mapped: { 'font-size': '13px' },
								custom_css_fallback: '',
							},
							is_dynamic: true,
							dynamic_source: 'wc_product_stock_status',
							meta: { source: 'editor' },
						},
					],
					styles: {
						mapped: {
							border: '1px solid #e5e7eb',
							'border-radius': '8px',
							padding: '16px',
						},
						custom_css_fallback: 'display:grid;gap:12px;',
					},
					meta: { source: 'editor' },
				};
			} else if ( 'woocommerce_product_grid' === wooType ) {
				const limit = options.limit
					? String(
							Math.max(
								1,
								Math.min(
									12,
									parseInt( options.limit, 10 ) || 6
								)
							)
					  )
					: '6';
				const gId = makeId( baseId );
				// grid template item: reuse product template as child template
				const itemId = makeId( `${ baseId }-item` );
				const tId = makeId( `${ baseId }-t` );
				const pId = makeId( `${ baseId }-p` );
				const iId = makeId( `${ baseId }-i` );
				newBlock = {
					id: gId,
					type: 'woocommerce_product_grid',
					tag: 'div',
					attributes: {
						class: 'ctb-woo-grid',
						'data-grid-limit': limit,
					},
					children: [
						{
							id: itemId,
							type: 'container',
							tag: 'div',
							attributes: { class: 'ctb-woo-grid-item-template' },
							children: [
								{
									id: iId,
									type: 'image',
									tag: 'img',
									attributes: { alt: '' },
									children: [],
									styles: {
										mapped: { 'border-radius': '6px' },
										custom_css_fallback: '',
									},
									is_dynamic: true,
									dynamic_source: 'wc_product_image',
									meta: { source: 'editor' },
								},
								{
									id: tId,
									type: 'text',
									tag: 'h3',
									attributes: {},
									children: [ { kind: 'text', value: '' } ],
									styles: {
										mapped: {
											'font-size': '16px',
											'font-weight': '700',
										},
										custom_css_fallback: '',
									},
									is_dynamic: true,
									dynamic_source: 'wc_product_title',
									meta: { source: 'editor' },
								},
								{
									id: pId,
									type: 'text',
									tag: 'p',
									attributes: {},
									children: [ { kind: 'text', value: '' } ],
									styles: {
										mapped: {},
										custom_css_fallback: '',
									},
									is_dynamic: true,
									dynamic_source: 'wc_product_price',
									meta: { source: 'editor' },
								},
							],
							styles: {
								mapped: {
									border: '1px solid #e5e7eb',
									'border-radius': '8px',
									padding: '12px',
								},
								custom_css_fallback: 'display:grid;gap:8px;',
							},
							meta: { source: 'editor' },
						},
					],
					styles: { mapped: {}, custom_css_fallback: '' },
					meta: { source: 'editor' },
				};
			}
			if ( ! newBlock ) {
				return state;
			}
			if ( existingCount + blockCount( newBlock ) > 1000 ) {
				return state;
			}
			const inserted =
				target.type === 'container' ||
				target.type === 'woocommerce_product' ||
				target.type === 'woocommerce_product_grid'
					? ( () => {
							const parent = findBlock( document.root, targetId );
							if ( parent ) {
								parent.children.push( newBlock );
								return true;
							}
							return false;
					  } )()
					: ( () => {
							const parent = ( () => {
								const findParent = ( block, id ) => {
									for ( const child of block.children ) {
										if ( child.kind === 'text' ) {
											continue;
										}
										if ( child.id === id ) {
											return block;
										}
										const p = findParent( child, id );
										if ( p ) {
											return p;
										}
									}
									return null;
								};
								return findParent( document.root, targetId );
							} )();
							if ( ! parent ) {
								return false;
							}
							const idx = parent.children.findIndex(
								( c ) => c.kind !== 'text' && c.id === targetId
							);
							if ( idx === -1 ) {
								return false;
							}
							parent.children.splice( idx + 1, 0, newBlock );
							return true;
					  } )();
			return inserted
				? commitDocument( state, document, newBlock.id )
				: state;
		} ),
	duplicateBlock: ( id ) =>
		set( ( state ) => {
			const document = JSON.parse( JSON.stringify( state.document ) );
			const block = findBlock( document.root, id );
			if (
				! block ||
				id === document.root.id ||
				block.permissions?.locked
			) {
				return state;
			}
			const parent = ( () => {
				const findParent = ( b, targetId ) => {
					for ( const child of b.children ) {
						if ( child.kind === 'text' ) {
							continue;
						}
						if ( child.id === targetId ) {
							return b;
						}
						const p = findParent( child, targetId );
						if ( p ) {
							return p;
						}
					}
					return null;
				};
				return findParent( document.root, id );
			} )();
			if ( ! parent ) {
				return state;
			}
			const usedIds = new Set();
			const collect = ( b ) => {
				usedIds.add( b.id );
				for ( const c of b.children || [] ) {
					if ( c.kind !== 'text' ) {
						collect( c );
					}
				}
			};
			collect( document.root );
			const cloneWithIds = ( b, prefix ) => {
				const clone = JSON.parse( JSON.stringify( b ) );
				const mapIds = ( node, pfx, counter ) => {
					const old = node.id;
					node.id = `${ pfx }-${ counter.n++ }-${ Date.now()
						.toString( 36 )
						.slice( -4 ) }`;
					while ( usedIds.has( node.id ) ) {
						node.id = `${ pfx }-${ counter.n++ }-${ Math.random()
							.toString( 36 )
							.slice( 2, 5 ) }`;
					}
					usedIds.add( node.id );
					if ( node.attributes?.id ) {
						node.attributes.id = `${ node.id }-dom`;
					}
					for ( const child of node.children || [] ) {
						if ( child.kind !== 'text' ) {
							mapIds( child, pfx, counter );
						}
					}
				};
				mapIds( clone, `${ prefix }-dup`, { n: 1 } );
				return clone;
			};
			const idx = parent.children.findIndex(
				( c ) => c.kind !== 'text' && c.id === id
			);
			if ( -1 === idx ) {
				return state;
			}
			// Check block count
			const countBlocks = ( b ) => {
				let c = 1;
				for ( const ch of b.children || [] ) {
					if ( ch.kind !== 'text' ) {
						c += countBlocks( ch );
					}
				}
				return c;
			};
			const total = countBlocks( document.root ) + countBlocks( block );
			if ( total > 1000 ) {
				return state;
			}
			const cloned = cloneWithIds( block, block.id );
			parent.children.splice( idx + 1, 0, cloned );
			return commitDocument( state, document, cloned.id );
		} ),
	deleteBlock: ( id ) =>
		set( ( state ) => {
			if (
				id === state.document.root.id ||
				findBlock( state.document.root, id )?.permissions?.locked
			) {
				return state;
			}
			const document = JSON.parse( JSON.stringify( state.document ) );
			const removed = removeBlock( document.root, id );
			if ( ! removed ) {
				return state;
			}
			const nextSelected =
				state.selectedBlockId === id
					? document.root.id
					: state.selectedBlockId;
			return commitDocument(
				{ ...state, selectedBlockId: nextSelected },
				document,
				nextSelected
			);
		} ),
	addInnerContainer: ( id ) =>
		set( ( state ) => {
			const document = JSON.parse( JSON.stringify( state.document ) );
			const target = findBlock( document.root, id );
			if (
				! target ||
				target.type !== 'container' ||
				target.permissions?.locked
			) {
				return state;
			}
			const usedIds = new Set();
			const collect = ( b ) => {
				usedIds.add( b.id );
				for ( const c of b.children || [] ) {
					if ( c.kind !== 'text' ) {
						collect( c );
					}
				}
			};
			collect( document.root );
			const newId = ( () => {
				const base = `ctb-inner-${ Date.now().toString( 36 ) }`;
				let n = 1,
					cur = base;
				while ( usedIds.has( cur ) ) {
					cur = `${ base }-${ n++ }`;
				}
				usedIds.add( cur );
				return cur;
			} )();
			const inner = {
				id: newId,
				type: 'container',
				tag: 'div',
				attributes: { class: 'ctb-inner' },
				children: [],
				styles: {
					mapped: { padding: '16px', border: '1px dashed #ccc' },
					custom_css_fallback: '',
				},
				meta: { source: 'editor' },
			};
			target.children.push( inner );
			return commitDocument( state, document, inner.id );
		} ),
	convertLayoutMode: ( id, mode ) =>
		set( ( state ) => {
			const document = JSON.parse( JSON.stringify( state.document ) );
			const block = findBlock( document.root, id );
			if ( ! block || block.type !== 'container' ) {
				return state;
			}
			return updateBlockStyleSet(
				{ ...state, document },
				id,
				'desktop',
				( styleSet ) => {
					const next = {
						...styleSet,
						mapped: { ...styleSet.mapped },
					};
					if ( 'flex' === mode ) {
						next.mapped.display = 'flex';
					} else if ( 'grid' === mode ) {
						next.mapped.display = 'grid';
					} else if ( 'block' === mode ) {
						next.mapped.display = 'block';
					}
					return next;
				}
			);
		} ),
	insertForm: ( targetId ) =>
		set( ( state ) => {
			const document = JSON.parse( JSON.stringify( state.document ) );
			const target = findBlock( document.root, targetId );
			if ( ! target ) {
				return state;
			}
			const used = new Set();
			const collect = ( b ) => {
				used.add( b.id );
				for ( const c of b.children || [] ) {
					if ( c.kind !== 'text' ) {
						collect( c );
					}
				}
			};
			collect( document.root );
			const makeId = ( base ) => {
				let id = base;
				let n = 2;
				while ( used.has( id ) ) {
					id = `${ base }-${ n++ }`;
				}
				used.add( id );
				return id;
			};
			const formId = makeId(
				`ctb-form-${ Date.now().toString( 36 ).slice( -4 ) }`
			);
			const f1 = makeId( `${ formId }-field-name` );
			const f2 = makeId( `${ formId }-field-email` );
			const f3 = makeId( `${ formId }-field-message` );
			const formBlock = {
				id: formId,
				type: 'form',
				tag: 'form',
				attributes: {
					class: 'ctb-form',
					'data-submission': 'native',
					'data-email-to': '',
				},
				children: [
					{
						id: f1,
						type: 'form_field',
						tag: 'div',
						attributes: {
							'data-field-type': 'text',
							'data-field-label': 'Name',
							'data-field-name': 'name',
							'data-field-placeholder': 'Your name',
							'data-field-required': true,
						},
						children: [],
						styles: { mapped: {}, custom_css_fallback: '' },
						meta: { source: 'editor' },
					},
					{
						id: f2,
						type: 'form_field',
						tag: 'div',
						attributes: {
							'data-field-type': 'email',
							'data-field-label': 'Email',
							'data-field-name': 'email',
							'data-field-placeholder': 'you@example.com',
							'data-field-required': true,
						},
						children: [],
						styles: { mapped: {}, custom_css_fallback: '' },
						meta: { source: 'editor' },
					},
					{
						id: f3,
						type: 'form_field',
						tag: 'div',
						attributes: {
							'data-field-type': 'textarea',
							'data-field-label': 'Message',
							'data-field-name': 'message',
							'data-field-placeholder': 'Your message',
							'data-field-required': true,
						},
						children: [],
						styles: { mapped: {}, custom_css_fallback: '' },
						meta: { source: 'editor' },
					},
				],
				styles: {
					mapped: {
						padding: '24px',
						border: '1px solid #ddd',
						'border-radius': '8px',
					},
					custom_css_fallback: 'display:grid;gap:12px;',
				},
				meta: { source: 'editor' },
			};
			const blockCount = ( b ) => {
				let c = 1;
				for ( const ch of b.children || [] ) {
					if ( ch.kind !== 'text' ) {
						c += blockCount( ch );
					}
				}
				return c;
			};
			if (
				blockCount( document.root ) + blockCount( formBlock ) >
				1000
			) {
				return state;
			}
			const parent = ( () => {
				const findParent = ( b, tid ) => {
					for ( const ch of b.children ) {
						if ( ch.kind === 'text' ) {
							continue;
						}
						if ( ch.id === tid ) {
							return b;
						}
						const p = findParent( ch, tid );
						if ( p ) {
							return p;
						}
					}
					return null;
				};
				return findParent( document.root, targetId );
			} )();
			if ( target.type === 'container' || target.type === 'form' ) {
				target.children.push( formBlock );
			} else if ( parent ) {
				const idx = parent.children.findIndex(
					( c ) => c.kind !== 'text' && c.id === targetId
				);
				if ( -1 !== idx ) {
					parent.children.splice( idx + 1, 0, formBlock );
				} else {
					parent.children.push( formBlock );
				}
			} else {
				document.root.children.push( formBlock );
			}
			return commitDocument( state, document, formId );
		} ),
	insertFormField: ( formId, fieldType ) =>
		set( ( state ) => {
			const document = JSON.parse( JSON.stringify( state.document ) );
			const form = findBlock( document.root, formId );
			if ( ! form || 'form' !== form.type ) {
				return state;
			}
			const used = new Set();
			const collect = ( b ) => {
				used.add( b.id );
				for ( const c of b.children || [] ) {
					if ( c.kind !== 'text' ) {
						collect( c );
					}
				}
			};
			collect( document.root );
			const makeId = ( base ) => {
				let id = base;
				let n = 2;
				while ( used.has( id ) ) {
					id = `${ base }-${ n++ }`;
				}
				used.add( id );
				return id;
			};
			const fid = makeId(
				`ctb-field-${ fieldType }-${ Date.now()
					.toString( 36 )
					.slice( -3 ) }`
			);
			const field = {
				id: fid,
				type: 'form_field',
				tag: 'div',
				attributes: {
					'data-field-type': fieldType,
					'data-field-label':
						fieldType.charAt( 0 ).toUpperCase() +
						fieldType.slice( 1 ),
					'data-field-name': fid,
					'data-field-placeholder': '',
					'data-field-required': false,
				},
				children: [],
				styles: { mapped: {}, custom_css_fallback: '' },
				meta: { source: 'editor' },
			};
			form.children.push( field );
			return commitDocument( state, document, fid );
		} ),
	updateFormField: ( id, updates ) =>
		set( ( state ) => {
			const document = JSON.parse( JSON.stringify( state.document ) );
			const block = findBlock( document.root, id );
			if ( ! block || 'form_field' !== block.type ) {
				return state;
			}
			for ( const [ k, v ] of Object.entries( updates ) ) {
				if ( '' === v || null === v || undefined === v ) {
					delete block.attributes[ k ];
				} else {
					block.attributes[ k ] = v;
				}
			}
			return commitDocument( state, document, id );
		} ),
	updateFormSettings: ( id, updates ) =>
		set( ( state ) => {
			const document = JSON.parse( JSON.stringify( state.document ) );
			const block = findBlock( document.root, id );
			if ( ! block || 'form' !== block.type ) {
				return state;
			}
			for ( const [ k, v ] of Object.entries( updates ) ) {
				if ( '' === v || null === v || undefined === v ) {
					delete block.attributes[ k ];
				} else {
					block.attributes[ k ] = v;
				}
			}
			return commitDocument( state, document, id );
		} ),
	updateWooSettings: ( id, updates ) =>
		set( ( state ) => {
			const document = JSON.parse( JSON.stringify( state.document ) );
			const block = findBlock( document.root, id );
			if (
				! block ||
				( 'woocommerce_product' !== block.type &&
					'woocommerce_product_grid' !== block.type )
			) {
				return state;
			}
			for ( const [ k, v ] of Object.entries( updates ) ) {
				if ( '' === v || null === v || undefined === v ) {
					delete block.attributes[ k ];
				} else {
					block.attributes[ k ] = v;
				}
			}
			return commitDocument( state, document, id );
		} ),
	insertWidget: ( targetId, widgetBlock ) =>
		set( ( state ) => {
			const document = JSON.parse( JSON.stringify( state.document ) );
			const target = findBlock( document.root, targetId );
			if ( ! target || ! widgetBlock ) {
				return state;
			}
			const used = new Set();
			const collect = ( b ) => {
				used.add( b.id );
				for ( const c of b.children || [] ) {
					if ( c.kind !== 'text' ) {
						collect( c );
					}
				}
			};
			collect( document.root );
			const clone = JSON.parse( JSON.stringify( widgetBlock ) );
			const makeId = ( base ) => {
				let id = base;
				let n = 2;
				while ( used.has( id ) ) {
					id = `${ base }-${ n++ }`;
				}
				used.add( id );
				return id;
			};
			const remap = ( node, prefix ) => {
				const old = node.id;
				node.id = makeId(
					`${ prefix }-${ old }-${ Date.now()
						.toString( 36 )
						.slice( -3 ) }`
				);
				if ( node.attributes?.id ) {
					node.attributes.id = `${ node.id }-dom`;
				}
				for ( const ch of node.children || [] ) {
					if ( ch.kind !== 'text' ) {
						remap( ch, prefix );
					}
				}
			};
			remap( clone, `widget-${ widgetBlock.id }` );
			const blockCount = ( b ) => {
				let c = 1;
				for ( const ch of b.children || [] ) {
					if ( ch.kind !== 'text' ) {
						c += blockCount( ch );
					}
				}
				return c;
			};
			if ( blockCount( document.root ) + blockCount( clone ) > 1000 ) {
				return state;
			}
			const parent = ( () => {
				const findParent = ( b, tid ) => {
					for ( const ch of b.children ) {
						if ( ch.kind === 'text' ) {
							continue;
						}
						if ( ch.id === tid ) {
							return b;
						}
						const p = findParent( ch, tid );
						if ( p ) {
							return p;
						}
					}
					return null;
				};
				return findParent( document.root, targetId );
			} )();
			if ( target.type === 'container' || target.type === 'form' ) {
				target.children.push( clone );
			} else if ( parent ) {
				const idx = parent.children.findIndex(
					( c ) => c.kind !== 'text' && c.id === targetId
				);
				if ( -1 !== idx ) {
					parent.children.splice( idx + 1, 0, clone );
				} else {
					parent.children.push( clone );
				}
			} else {
				document.root.children.push( clone );
			}
			return commitDocument( state, document, clone.id );
		} ),
} ) );

function removeBlock( block, id ) {
	for ( let index = 0; index < block.children.length; index++ ) {
		const child = block.children[ index ];
		if ( child.kind === 'text' ) {
			continue;
		}

		if ( child.id === id ) {
			return block.children.splice( index, 1 )[ 0 ];
		}

		const removed = removeBlock( child, id );
		if ( removed ) {
			return removed;
		}
	}

	return null;
}

function insertInside( block, targetId, movedBlock ) {
	const target = findBlock( block, targetId );
	if ( ! target ) {
		return false;
	}

	target.children.push( movedBlock );
	return true;
}

function insertBefore( block, targetId, movedBlock ) {
	for ( let index = 0; index < block.children.length; index++ ) {
		const child = block.children[ index ];
		if ( child.kind === 'text' ) {
			continue;
		}

		if ( child.id === targetId ) {
			block.children.splice( index, 0, movedBlock );
			return true;
		}

		if ( insertBefore( child, targetId, movedBlock ) ) {
			return true;
		}
	}

	return false;
}

function insertAfter( block, targetId, movedBlock ) {
	for ( let index = 0; index < block.children.length; index++ ) {
		const child = block.children[ index ];
		if ( child.kind === 'text' ) {
			continue;
		}

		if ( child.id === targetId ) {
			block.children.splice( index + 1, 0, movedBlock );
			return true;
		}

		if ( insertAfter( child, targetId, movedBlock ) ) {
			return true;
		}
	}

	return false;
}

function insertAtDropPosition(
	root,
	targetId,
	movedBlock,
	position,
	canContain
) {
	if ( position === 'before' ) {
		return insertBefore( root, targetId, movedBlock );
	}
	if ( position === 'after' ) {
		return insertAfter( root, targetId, movedBlock );
	}
	if ( position === 'inside' ) {
		return canContain && insertInside( root, targetId, movedBlock );
	}
	return canContain
		? insertInside( root, targetId, movedBlock )
		: insertAfter( root, targetId, movedBlock );
}
