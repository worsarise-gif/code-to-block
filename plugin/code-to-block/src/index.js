import TopHeader from './components/TopHeader.js';
import LeftRail from './components/LeftRail.js';
import RightInspector from './components/RightInspector.js';
import CenterCanvas from './components/CenterCanvas.js';
import NavigatorTree from './components/NavigatorTree.js';
import RevisionHistory from './components/RevisionHistory.js';
import {
	GuidedRolePanel,
	GuidedRolesManager,
	RoleEditDecisionDialog,
} from './components/GuidedRoleControls.js';
import {
	Component,
	createElement,
	createRoot,
	useEffect,
	useRef,
	useState,
} from '@wordpress/element';
import {
	closestCenter,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	pointerWithin,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import apiFetch from '@wordpress/api-fetch';
import { create } from 'zustand';

import {
	contentHash,
	freshPreviewUrl,
	installNavigationGuard,
	publishSavedDocument,
	autosaveDocument,
} from './editor-persistence.mjs';

import './editor.css';
import {
	controlVisibilityReason,
	isMappedControlVisible,
	mergeMappedStyleUpdates,
	normalizeCustomCssFallback,
	previewCustomCssFallback,
	styleControlLabel,
	STYLE_CONTROL_FIELDS,
} from './custom-css.mjs';
import {
	blockHasTokenOverride,
	countTokenConsumers,
	designTokenDeclarations,
	effectiveTokenBindings,
	getDesignToken,
	TOKEN_CATEGORIES,
	TOKEN_PROPERTIES,
	tokenCssValue,
	tokenIdFromLabel,
	tokenIdIsValid,
	tokenReference,
	tokensForProperty,
} from './design-tokens.mjs';
import {
	commitDocument,
	markSavedSnapshot,
	redoDocument,
	resetDocumentHistory,
	syncSavedDocument,
	undoDocument,
} from './history.mjs';
import { rankDropCandidates, resolveDropIntent } from './drop-intent.mjs';
import { createImportCodeService } from './importer/ImportCodeService.mjs';
import { materializeCommerce } from './commerce-preview.mjs';
import {
	CommerceProductEditor,
	createProductDraft,
} from './commerce-product-editor';
import { sanitizeRichTextHtml } from './rich-text.mjs';
import { normalizeReactAttributes } from './react-attributes.mjs';
import {
	BREAKPOINTS,
	breakpointCascade,
	countStyleOverrides,
	effectiveMappedStyles,
	inheritedMappedStyles,
	isBlockHidden,
	isHiddenOverridden,
	ownStyleSet,
	setOwnStyleSet,
} from './responsive-styles.mjs';
import {
	canMoveBlock,
	countBlocks,
	findBlock,
	findBlockLocation,
	moveBlockSibling,
} from './tree.mjs';
import {
	createPrimitiveBlock,
	setHiddenInFallback,
	setStyleSetBindings,
	updateBlockStyleSet,
	updateEditableBlock,
} from './store/block-commands.mjs';
import {
	COMPONENT_FAILURE_MESSAGE,
	createComponentDocument,
	insertComponent,
	isSavedComponentBlock,
	materializeComponents,
} from './reusable-components.mjs';
import {
	insertStarter as insertStarterTemplate,
	prepareStarterDocument,
} from './starter-templates.mjs';
import { runAccessibilityChecks } from './accessibility.mjs';
import { WIDGET_LIBRARY } from './widget-library.mjs';
import {
	adjustRoleInStyleSet,
	applyRoleToStyleSet,
	countRoleUsage,
	ensureGuidedRoleDesignSystem,
	guidedRolesEnabled,
	migrateGuidedRolesDocument,
	normalizeImportedStyles,
	recommendStyleRoles,
	rejoinRoleProperty,
	resolveImportReviewFlag,
	restoreBalancedRole,
	roleBindingForProperty,
	roleCatalog,
	rolePreviewStyles,
	sanitizeGuidedRoleTelemetry,
	semanticDetentFromPointerDelta,
	setRolePropertyOverride,
	updateRolePropertyGlobally,
} from './semantic-roles.mjs';
import { canInsertElement } from './elements/registry.mjs';
import { allowedTagForBlock, resolveInspector } from './elements/resolver.mjs';

const VOID_TAGS = new Set( [
	'br',
	'col',
	'hr',
	'img',
	'input',
	'source',
	'track',
	'wbr',
] );
const IMPORT_SCOPE_CLASS = 'ctb-import-scope';
const importCodeService = createImportCodeService();

import { useEditorStore, EXAMPLE_DOCUMENT } from './store/editor-store.mjs';

function resolveDocumentDropIntent( {
	root,
	targetId,
	activeId = null,
	point,
	rect,
} ) {
	const targetLocation = findBlockLocation( root, targetId );
	const source = activeId ? findBlock( root, activeId ) : null;
	if ( ! targetLocation || ( activeId && ! source ) ) {
		return null;
	}

	const target = targetLocation.block;
	const canContain =
		target.type === 'container' && ! VOID_TAGS.has( target.tag );
	let reason = '';
	if ( activeId === root.id ) {
		reason = 'The document root cannot be moved.';
	} else if ( source?.permissions?.locked ) {
		reason = 'This block is locked.';
	} else if ( target.permissions?.locked ) {
		reason = 'The target block is locked.';
	} else if ( activeId === target.id ) {
		reason = 'A block cannot be dropped onto itself.';
	} else if ( activeId && targetLocation.ancestorIds.includes( activeId ) ) {
		reason = 'A block cannot be moved into one of its descendants.';
	}

	return resolveDropIntent( {
		point,
		candidates: [
			{
				id: target.id,
				rect,
				depth: targetLocation.depth,
				parentId: targetLocation.parentId,
				index: targetLocation.index,
				childCount: ( target.children || [] ).filter(
					( child ) => child.kind !== 'text'
				).length,
				canContain,
				allowSibling: target.id !== root.id,
				valid: ! reason,
				reason,
			},
		],
	} );
}

function dragEventPoint( event ) {
	const activatorEvent = event.activatorEvent;
	if (
		Number.isFinite( activatorEvent?.clientX ) &&
		Number.isFinite( activatorEvent?.clientY )
	) {
		return {
			x: activatorEvent.clientX + ( event.delta?.x || 0 ),
			y: activatorEvent.clientY + ( event.delta?.y || 0 ),
		};
	}

	const translated = event.active.rect.current.translated;
	return translated
		? {
				x: translated.left + translated.width / 2,
				y: translated.top + translated.height / 2,
		  }
		: null;
}

function toReactStyles( styles, resourceBase = '' ) {
	return Object.fromEntries(
		Object.entries( styles ).map( ( [ property, value ] ) => [
			property.startsWith( '--' )
				? property
				: property.replace( /-([a-z])/g, ( match, letter ) =>
						letter.toUpperCase()
				  ),
			normalizeCssUrls( value, resourceBase ),
		] )
	);
}

function normalizeResourceUrl( value, resourceBase = '' ) {
	if ( /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test( value ) ) {
		return value;
	}

	const siteUrl =
		window.codeToBlockEditorSettings?.siteUrl || window.location.origin;
	try {
		const baseUrl = resourceBase
			? new URL( resourceBase, siteUrl ).href
			: siteUrl;
		return new URL( value, baseUrl ).href;
	} catch {
		return new URL( value, siteUrl ).href;
	}
}

function normalizeCssUrls( value, resourceBase = '' ) {
	return String( value ).replace(
		/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
		( match, quote, url ) =>
			`url(${ quote }${ normalizeResourceUrl(
				url,
				resourceBase
			) }${ quote })`
	);
}

function previewDeclarations( styleSet, important = false, resourceBase = '' ) {
	if ( ! styleSet ) {
		return '';
	}

	const suffix = important ? ' !important' : '';
	const mapped = Object.entries( styleSet.mapped || {} )
		.map(
			( [ property, value ] ) =>
				`${ property }:${ normalizeCssUrls(
					value,
					resourceBase
				).replace( /\s*!important\s*$/i, '' ) }${ suffix };`
		)
		.join( '' );
	const fallback = previewCustomCssFallback(
		String( styleSet.custom_css_fallback || '' )
	);
	return mapped + ( fallback ? `${ fallback.replace( /;+$/, '' ) };` : '' );
}

function buildPreviewStyles( document, activeBreakpoint ) {
	const indexes = {};
	const base = [];
	const responsive = [];
	let index = 0;
	const resourceBase = document.imported_assets?.page_meta?.base_href || '';
	const tokenDeclarations = designTokenDeclarations( document.design_tokens );
	if ( tokenDeclarations ) {
		base.push( `.ctb-canvas-stage{${ tokenDeclarations }}` );
	}
	for ( const stylesheet of document.imported_assets?.stylesheets || [] ) {
		if ( stylesheet.scoped_source ) {
			base.push(
				normalizeCssUrls( stylesheet.scoped_source, resourceBase )
			);
		}
	}
	const importedTokenDeclarations = Object.entries(
		document.imported_assets?.token_bindings || {}
	)
		.map( ( [ cssName, reference ] ) => {
			const token = getDesignToken( document.design_tokens, reference );
			return token
				? `${ cssName }:${ normalizeCssUrls(
						token.value,
						resourceBase
				  ) };`
				: '';
		} )
		.filter( Boolean )
		.join( '' );
	if ( importedTokenDeclarations ) {
		base.push( `.${ IMPORT_SCOPE_CLASS }{${ importedTokenDeclarations }}` );
	}

	function visit( block ) {
		const currentIndex = index++;
		indexes[ block.id ] = currentIndex;
		const selector = `.ctb-canvas-stage .ctb-preview-block-${ currentIndex }`;
		const fallback = previewCustomCssFallback(
			String( block.styles.custom_css_fallback || '' )
		);
		if ( fallback ) {
			base.push( `${ selector }{${ fallback.replace( /;+$/, '' ) };}` );
		}

		for ( const state of [ 'hover', 'focus', 'active' ] ) {
			const declarations = previewDeclarations(
				block.states?.[ state ],
				true,
				resourceBase
			);
			if ( declarations ) {
				base.push( `${ selector }:${ state }{${ declarations }}` );
			}
		}

		for ( const viewport of breakpointCascade( activeBreakpoint ) ) {
			const declarations = previewDeclarations(
				block.responsive_overrides?.[ viewport ],
				true,
				resourceBase
			);
			if ( declarations ) {
				responsive.push( `${ selector }{${ declarations }}` );
			}
		}

		for ( const child of block.children ) {
			if ( child.kind !== 'text' ) {
				visit( child );
			}
		}
	}

	visit( document.root );
	return { indexes, css: [ ...base, ...responsive ].join( '\n' ) };
}

function buildEditorStyleSnapshot( document ) {
	const snapshot = {};

	function visit( block ) {
		const styles = {
			base: block.styles,
			tablet: block.responsive_overrides?.tablet,
			mobile: block.responsive_overrides?.mobile,
			hover: block.states?.hover,
			focus: block.states?.focus,
			active: block.states?.active,
		};
		for ( const [ context, styleSet ] of Object.entries( styles ) ) {
			const declarations = previewDeclarations( styleSet, true );
			if ( declarations ) {
				snapshot[ block.id ] ||= {};
				snapshot[ block.id ][ context ] = declarations;
			}
		}
		for ( const child of block.children || [] ) {
			if ( child.kind !== 'text' ) {
				visit( child );
			}
		}
	}

	visit( document.root );
	return snapshot;
}

function collisionStrategy( args ) {
	const pointerCollisions = pointerWithin( args );
	if ( ! pointerCollisions.length ) {
		return closestCenter( args );
	}

	const activeId = String( args.active.id );
	const activeData = args.active.data.current || {};
	const ranked = rankDropCandidates(
		pointerCollisions.map( ( collision, order ) => {
			const container = collision.data?.droppableContainer;
			const data = container?.data.current || {};
			const invalid =
				activeData.locked ||
				data.locked ||
				String( collision.id ) === activeId ||
				( data.ancestorIds || [] ).includes( activeId );
			return {
				id: collision.id,
				depth: data.depth,
				order,
				valid: ! invalid,
				rect: args.droppableRects.get( collision.id ),
			};
		} )
	);
	const rank = new Map(
		ranked.map( ( candidate, index ) => [ candidate.id, index ] )
	);
	return pointerCollisions.sort(
		( left, right ) => rank.get( left.id ) - rank.get( right.id )
	);
}

function cursorOffsetModifier( {
	activatorEvent,
	draggingNodeRect,
	transform,
} ) {
	if (
		! activatorEvent ||
		! draggingNodeRect ||
		! Number.isFinite( activatorEvent.clientX ) ||
		! Number.isFinite( activatorEvent.clientY )
	) {
		return transform;
	}

	return {
		...transform,
		x: transform.x + activatorEvent.clientX - draggingNodeRect.left + 14,
		y: transform.y + activatorEvent.clientY - draggingNodeRect.top + 14,
	};
}

function SkeletonLoader( { type, block } ) {
	if ( block && block.children && block.children.length > 0 ) {
		const layoutStyle = {};
		const mapped = block.styles?.mapped || {};
		const display = mapped.display || 'block';

		if ( display.includes( 'flex' ) || display.includes( 'grid' ) ) {
			layoutStyle.display = display;
			layoutStyle.flexDirection = mapped[ 'flex-direction' ];
			layoutStyle.gap = mapped.gap;
			layoutStyle.gridTemplateColumns = mapped[ 'grid-template-columns' ];
		}

		return (
			<div className="ctb-skeleton-container" style={ layoutStyle }>
				{ block.children
					.filter( ( child ) => child.kind !== 'text' )
					.map( ( child ) => (
						<SkeletonLoader
							key={ child.id }
							type={
								child.is_content_slot
									? child.slot_content_type
									: 'container'
							}
							block={ child }
						/>
					) ) }
			</div>
		);
	}

	let shapeClass = 'ctb-skeleton-text';
	if ( type === 'rich_text' ) {
		shapeClass = 'ctb-skeleton-rich-text';
	}
	if ( type === 'image' ) {
		shapeClass = 'ctb-skeleton-image';
	}
	if ( type === 'link' ) {
		shapeClass = 'ctb-skeleton-link';
	}

	if ( type === 'rich_text' ) {
		return (
			<div className="ctb-skeleton ctb-skeleton-rich-text">
				<div className="ctb-skeleton-bar" style={ { width: '100%' } } />
				<div className="ctb-skeleton-bar" style={ { width: '100%' } } />
				<div className="ctb-skeleton-bar" style={ { width: '75%' } } />
			</div>
		);
	}

	return (
		<div className={ `ctb-skeleton ctb-skeleton-bar ${ shapeClass }` } />
	);
}

function colorPickerValue( color ) {
	if ( /^#[0-9a-f]{6}$/i.test( color ) ) {
		return color;
	}
	if ( /^#[0-9a-f]{3}$/i.test( color ) ) {
		return `#${ color
			.slice( 1 )
			.split( '' )
			.map( ( character ) => character.repeat( 2 ) )
			.join( '' ) }`;
	}
	return '#000000';
}

class SavedComponentBoundary extends Component {
	constructor( props ) {
		super( props );
		this.state = { failed: false };
	}

	static getDerivedStateFromError() {
		return { failed: true };
	}

	render() {
		return this.state.failed ? this.props.fallback : this.props.children;
	}
}

function Block( props ) {
	const selectBlock = useEditorStore( ( state ) => state.selectBlock );
	if ( isSavedComponentBlock( props.block ) ) {
		return (
			<SavedComponentBoundary
				key={ `${ props.block.id }:${
					props.block.meta.component_revision || 'pending'
				}` }
				fallback={
					<button
						type="button"
						className="ctb-component-render-error"
						onClick={ () => selectBlock( props.block.id ) }
					>
						{ COMPONENT_FAILURE_MESSAGE }
					</button>
				}
			>
				<BlockContent { ...props } />
			</SavedComponentBoundary>
		);
	}
	return <BlockContent { ...props } />;
}

function CanvasDragHandles( { blockId } ) {
	const activeBreakpoint = useEditorStore(
		( state ) => state.activeBreakpoint
	);
	const panelMode = useEditorStore( ( state ) => state.panelMode );

	const parseShorthand = ( val ) => {
		const parts = String( val || '' )
			.split( /\s+/ )
			.filter( Boolean );
		let top = '0px',
			right = '0px',
			bottom = '0px',
			left = '0px';
		if ( parts.length === 1 ) {
			top = right = bottom = left = parts[ 0 ];
		} else if ( parts.length === 2 ) {
			top = bottom = parts[ 0 ];
			right = left = parts[ 1 ];
		} else if ( parts.length === 3 ) {
			top = parts[ 0 ];
			right = left = parts[ 1 ];
			bottom = parts[ 2 ];
		} else if ( parts.length >= 4 ) {
			top = parts[ 0 ];
			right = parts[ 1 ];
			bottom = parts[ 2 ];
			left = parts[ 3 ];
		}
		return { top, right, bottom, left };
	};

	const parsePart = ( val ) => {
		const match = String( val || '' ).match( /^(-?\d*\.?\d+)(.*)$/ );
		if ( match ) {
			return {
				num: parseFloat( match[ 1 ] ),
				strUnit: match[ 2 ] || 'px',
			};
		}
		return { num: 0, strUnit: 'px' };
	};

	const createHandle = ( property, edge ) => {
		const handleMouseDown = ( e ) => {
			e.preventDefault();
			e.stopPropagation();
			const ownerWindow =
				e.currentTarget.ownerDocument.defaultView || window;
			const startX = e.clientX;
			const startY = e.clientY;

			const state = useEditorStore.getState();
			const block = findBlock( state.document.root, blockId );
			if ( ! block ) {
				return;
			}

			const styleSet = ownStyleSet(
				block,
				activeBreakpoint || 'desktop'
			);
			const currentMapped = styleSet.mapped || {};
			const currentVal = currentMapped[ property ] || '';
			const initialParts = parseShorthand( currentVal );
			const startPart = parsePart( initialParts[ edge ] );
			const roleSource = roleBindingForProperty( styleSet, property );
			const guided = panelMode === 'simple' && Boolean( roleSource );
			const rendered = e.currentTarget.closest( '[data-block-id]' );
			const originalInline =
				rendered?.style.getPropertyValue( property ) || '';
			let previewValue = currentVal;
			let detent = roleSource?.binding.spacingAdjustment?.distance || 0;

			const handleMouseMove = ( moveEvent ) => {
				const deltaX = moveEvent.clientX - startX;
				const deltaY = moveEvent.clientY - startY;
				let delta = 0;
				if ( edge === 'top' ) {
					delta = deltaY;
				} else if ( edge === 'bottom' ) {
					delta = -deltaY;
				} else if ( edge === 'left' ) {
					delta = deltaX;
				} else if ( edge === 'right' ) {
					delta = -deltaX;
				}

				let multiplier = 1;
				if ( moveEvent.shiftKey ) {
					multiplier = 10;
				} else if ( moveEvent.altKey || moveEvent.metaKey ) {
					multiplier = 0.1;
				}

				if ( guided ) {
					detent = semanticDetentFromPointerDelta( delta );
					const styles = rolePreviewStyles(
						state.document,
						roleSource.binding.roleId,
						roleSource.scope,
						{ distance: detent }
					);
					previewValue = styles[ property ] || currentVal;
					if ( rendered ) {
						rendered.style.setProperty( property, previewValue );
						let detentLabel = 'Default';
						if ( detent < 0 ) {
							detentLabel = 'Closer';
						} else if ( detent > 0 ) {
							detentLabel = 'Farther';
						}
						rendered.dataset.guidedDetent = detentLabel;
					}
					return;
				}

				const newNum = startPart.num + delta * multiplier * 0.5;
				const formattedValue =
					newNum.toFixed( 1 ).replace( /\.0$/, '' ) +
					startPart.strUnit;
				const parts = { ...initialParts, [ edge ]: formattedValue };
				previewValue = `${ parts.top } ${ parts.right } ${ parts.bottom } ${ parts.left }`;
				if ( rendered ) {
					rendered.style.setProperty( property, previewValue );
				}
			};

			const handleMouseUp = () => {
				cleanup();
				if ( rendered ) {
					if ( originalInline ) {
						rendered.style.setProperty( property, originalInline );
					} else {
						rendered.style.removeProperty( property );
					}
					delete rendered.dataset.guidedDetent;
				}
				if ( guided ) {
					useEditorStore
						.getState()
						.adjustBlockStyleRole(
							blockId,
							roleSource.scope,
							{ distance: detent },
							activeBreakpoint || 'desktop'
						);
				} else if ( previewValue !== currentVal ) {
					useEditorStore
						.getState()
						.updateBlockMappedStyles(
							blockId,
							{ [ property ]: previewValue },
							activeBreakpoint || 'desktop'
						);
				}
			};
			const handleKeyDown = ( keyEvent ) => {
				if ( keyEvent.key !== 'Escape' ) {
					return;
				}
				keyEvent.preventDefault();
				cleanup();
				if ( rendered ) {
					if ( originalInline ) {
						rendered.style.setProperty( property, originalInline );
					} else {
						rendered.style.removeProperty( property );
					}
					delete rendered.dataset.guidedDetent;
				}
			};
			const cleanup = () => {
				ownerWindow.removeEventListener( 'mousemove', handleMouseMove );
				ownerWindow.removeEventListener( 'mouseup', handleMouseUp );
				ownerWindow.removeEventListener( 'keydown', handleKeyDown );
			};

			ownerWindow.addEventListener( 'mousemove', handleMouseMove );
			ownerWindow.addEventListener( 'mouseup', handleMouseUp );
			ownerWindow.addEventListener( 'keydown', handleKeyDown );
		};

		const positionStyles = {
			position: 'absolute',
			zIndex: 9999,
		};
		if ( edge === 'top' ) {
			positionStyles.top = '-5px';
			positionStyles.left = '0';
			positionStyles.right = '0';
			positionStyles.height = '10px';
			positionStyles.cursor = 'ns-resize';
		} else if ( edge === 'bottom' ) {
			positionStyles.bottom = '-5px';
			positionStyles.left = '0';
			positionStyles.right = '0';
			positionStyles.height = '10px';
			positionStyles.cursor = 'ns-resize';
		} else if ( edge === 'left' ) {
			positionStyles.left = '-5px';
			positionStyles.top = '0';
			positionStyles.bottom = '0';
			positionStyles.width = '10px';
			positionStyles.cursor = 'ew-resize';
		} else if ( edge === 'right' ) {
			positionStyles.right = '-5px';
			positionStyles.top = '0';
			positionStyles.bottom = '0';
			positionStyles.width = '10px';
			positionStyles.cursor = 'ew-resize';
		}

		return (
			<button
				key={ edge }
				type="button"
				className={ `ctb-canvas-drag-handle is-${ property }-${ edge }` }
				style={ positionStyles }
				onMouseDown={ handleMouseDown }
				aria-label={ `Drag to adjust ${ property } ${ edge }` }
				title={ `Drag to adjust ${ property } ${ edge }` }
			/>
		);
	};

	return (
		<div
			style={ {
				position: 'absolute',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				pointerEvents: 'none',
			} }
		>
			<div
				style={ {
					pointerEvents: 'auto',
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
				} }
			>
				{ createHandle( 'padding', 'top' ) }
				{ createHandle( 'padding', 'right' ) }
				{ createHandle( 'padding', 'bottom' ) }
				{ createHandle( 'padding', 'left' ) }
			</div>
		</div>
	);
}

function BlockContent( {
	block,
	styleIndexes,
	isRoot = false,
	componentOwnerId = null,
	onContextMenu,
	dropIntent = null,
	ancestorIds = [],
	depth = 0,
	siblingIndex = 0,
} ) {
	const selectedBlockId = useEditorStore(
		( state ) => state.selectedBlockId
	);
	const selectBlock = useEditorStore( ( state ) => state.selectBlock );
	const commercePreviewSourceId = block.meta?.commerce_preview_source_id;
	const commercePreview = Boolean( block.meta?.commerce_preview_owner_id );
	const resourceBase = useEditorStore(
		( state ) => state.document.imported_assets?.page_meta?.base_href || ''
	);
	const {
		attributes: dragAttributes,
		isDragging,
		listeners,
		setNodeRef: setDraggableNodeRef,
	} = useDraggable( {
		id: block.id,
		disabled: isRoot || Boolean( componentOwnerId ) || commercePreview,
		data: { label: block.id, locked: Boolean( block.permissions?.locked ) },
	} );
	const canContain =
		block.type === 'container' && ! VOID_TAGS.has( block.tag );
	const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable( {
		id: block.id,
		disabled: Boolean( componentOwnerId ) || commercePreview,
		data: {
			type: block.type,
			parentId: ancestorIds.at( -1 ) || null,
			index: siblingIndex,
			depth,
			childCount: ( block.children || [] ).filter(
				( child ) => child.kind !== 'text'
			).length,
			canContain,
			allowSibling: ! isRoot,
			locked: Boolean( block.permissions?.locked ),
			ancestorIds,
		},
	} );
	const attributes = normalizeReactAttributes( block.attributes );
	for ( const name of [ 'href', 'src', 'cite' ] ) {
		if ( typeof attributes[ name ] === 'string' ) {
			attributes[ name ] = normalizeResourceUrl(
				attributes[ name ],
				resourceBase
			);
		}
	}
	if ( block.type === 'skeleton' ) {
		return (
			<SkeletonLoader
				type={ attributes[ 'data-skeleton-type' ] }
				block={ block }
			/>
		);
	}

	const hasTokenOverride = blockHasTokenOverride( block );
	const savedComponent = isSavedComponentBlock( block );
	const selectionId = componentOwnerId || commercePreviewSourceId || block.id;
	const isIntentTarget = dropIntent?.targetId === block.id;
	const dropIntentClass = isIntentTarget
		? dropIntent.valid
			? `is-drop-${ dropIntent.position }`
			: 'is-drop-invalid'
		: '';
	attributes.className = [
		'ctb-rendered-block',
		`ctb-preview-block-${ styleIndexes[ block.id ] }`,
		isRoot ? 'is-root' : 'is-draggable',
		isDragging ? 'is-dragging' : '',
		isOver && ! isIntentTarget ? 'is-drop-target' : '',
		dropIntentClass,
		selectedBlockId === selectionId ? 'is-selected' : '',
		savedComponent ? 'is-saved-component' : '',
		hasTokenOverride ? 'has-token-override' : '',
		block.is_content_slot ? 'is-content-slot' : '',
		attributes.className,
	]
		.filter( Boolean )
		.join( ' ' );
	attributes.style = toReactStyles( block.styles.mapped, resourceBase );
	attributes[ 'data-block-id' ] = selectionId;
	attributes[ 'data-block-type' ] = block.type;
	if ( isIntentTarget ) {
		attributes[ 'data-drop-position' ] = dropIntent.valid
			? dropIntent.position
			: 'invalid';
	}
	let blockLabel = `${ savedComponent ? 'saved component' : block.tag } · ${
		block.id
	}${ hasTokenOverride ? ' · token override' : '' }`;
	if ( block.is_content_slot ) {
		blockLabel = `Slot: ${
			block.slot_label || block.id
		} (${ blockLabel })`;
	}
	attributes[ 'data-block-label' ] = blockLabel;
	attributes.ref = ( node ) => {
		setDraggableNodeRef( node );
		setDroppableNodeRef( node );
	};

	if ( ! isRoot && ! componentOwnerId && ! commercePreview ) {
		Object.assign( attributes, dragAttributes, listeners );
	}
	if ( block.tag === 'button' ) {
		attributes.type = 'button';
	}

	attributes.onClick = ( event ) => {
		event.preventDefault();
		event.stopPropagation();
		selectBlock( selectionId );
	};
	if ( ! componentOwnerId && onContextMenu ) {
		attributes.onContextMenu = ( event ) => {
			event.preventDefault();
			event.stopPropagation();
			onContextMenu(
				event,
				commercePreviewSourceId
					? { ...block, id: commercePreviewSourceId }
					: block
			);
		};
	}
	if ( VOID_TAGS.has( block.tag ) ) {
		delete attributes.children;
		delete attributes.dangerouslySetInnerHTML;
		return createElement( block.tag, attributes );
	}
	if ( block.is_content_slot && block.slot_content_type === 'rich_text' ) {
		attributes.dangerouslySetInnerHTML = {
			__html: sanitizeRichTextHtml(
				block.children
					.filter( ( child ) => child.kind === 'text' )
					.map( ( child ) => child.value )
					.join( '' )
			),
		};
		return createElement( block.tag, attributes );
	}
	if ( attributes.dangerouslySetInnerHTML ) {
		return createElement( block.tag, attributes );
	}

	const isNativeImportedForm = Boolean( block.meta?.imported_native_html );
	const isForm = block.type === 'form' && ! isNativeImportedForm;
	const isFormField = block.type === 'form_field' && ! isNativeImportedForm;

	const childBlockIndexes = new Map(
		block.children
			.filter( ( child ) => child.kind !== 'text' )
			.map( ( child, index ) => [ child.id, index ] )
	);
	const childrenNodes = block.children.map( ( child, index ) =>
		child.kind === 'text' ? (
			child.value
		) : (
			<Block
				key={ child.id || index }
				block={ child }
				styleIndexes={ styleIndexes }
				componentOwnerId={
					componentOwnerId || ( savedComponent ? block.id : null )
				}
				onContextMenu={ onContextMenu }
				dropIntent={ dropIntent }
				ancestorIds={ [ ...ancestorIds, block.id ] }
				depth={ depth + 1 }
				siblingIndex={ childBlockIndexes.get( child.id ) }
			/>
		)
	);

	if ( isFormField ) {
		const fieldType = attributes[ 'data-field-type' ] || 'text';
		const fieldLabel = attributes[ 'data-field-label' ] || '';
		const placeholder = attributes[ 'data-field-placeholder' ] || '';
		let inputNode = null;
		if ( fieldType === 'textarea' ) {
			inputNode = (
				<textarea
					placeholder={ placeholder }
					disabled
					style={ {
						width: '100%',
						padding: '8px',
						border: '1px solid #ccc',
						borderRadius: '3px',
						background: '#fafafa',
					} }
				/>
			);
		} else if ( [ 'select', 'radio', 'checkbox' ].includes( fieldType ) ) {
			inputNode = (
				<select
					disabled
					style={ {
						width: '100%',
						padding: '8px',
						border: '1px solid #ccc',
						borderRadius: '3px',
						background: '#fafafa',
					} }
				>
					<option>{ placeholder || 'Select option' }</option>
				</select>
			);
		} else {
			inputNode = (
				<input
					type={ fieldType === 'file' ? 'file' : 'text' }
					placeholder={ placeholder }
					disabled
					style={ {
						width: '100%',
						padding: '8px',
						border: '1px solid #ccc',
						borderRadius: '3px',
						background: '#fafafa',
					} }
				/>
			);
		}
		childrenNodes.push(
			<div key="input-mock" style={ { marginTop: '4px' } }>
				{ fieldLabel ? (
					<span
						style={ {
							display: 'block',
							fontSize: '12px',
							fontWeight: 600,
							marginBottom: '6px',
						} }
					>
						{ fieldLabel }
						{ attributes[ 'data-field-required' ] ? ' *' : '' }
					</span>
				) : null }
				{ inputNode }
			</div>
		);
	} else if ( isForm ) {
		childrenNodes.push(
			<div key="submit-mock" style={ { marginTop: '12px' } }>
				<button
					type="button"
					disabled
					style={ {
						padding: '8px 16px',
						background: '#171d35',
						color: '#fff',
						border: 'none',
						borderRadius: '3px',
						cursor: 'not-allowed',
					} }
				>
					{ attributes[ 'data-submit-label' ] || 'Submit' }
				</button>
			</div>
		);
	}
	if (
		selectedBlockId === selectionId &&
		! VOID_TAGS.has( block.tag ) &&
		[ 'relative', 'absolute', 'fixed', 'sticky' ].includes(
			attributes.style.position
		)
	) {
		childrenNodes.push(
			<CanvasDragHandles
				key="canvas-drag-handles"
				blockId={ selectionId }
			/>
		);
	}

	return createElement( block.tag, attributes, childrenNodes );
}

function ExplainPanel( { block } ) {
	const declarations = block.meta?.css_mapping?.declarations;
	const importedRules = block.meta?.imported_css_rules || [];
	const mapped = Array.isArray( declarations )
		? declarations.filter(
				( declaration ) => declaration.destination === 'style-control'
		  )
		: [];
	const fallback = Array.isArray( declarations )
		? declarations.filter(
				( declaration ) => declaration.destination === 'raw-css'
		  )
		: [];
	const count = mapped.length + fallback.length;

	function MappingRows( { items, destination } ) {
		return (
			<ul className="ctb-explain-list">
				{ items.map( ( declaration, index ) => (
					<li key={ `${ declaration.property }-${ index }` }>
						<div className="ctb-explain-route">
							<code>{ declaration.property }</code>
							<span aria-hidden="true">→</span>
							<strong>
								{ destination === 'style-control'
									? styleControlLabel( declaration.control )
									: 'Raw CSS' }
							</strong>
						</div>
						<code className="ctb-explain-value">
							{ declaration.value }
							{ declaration.important ? ' !important' : '' }
						</code>
						<small>{ declaration.origin }</small>
					</li>
				) ) }
			</ul>
		);
	}

	return (
		<>
			<details className="ctb-explain-panel" open={ count > 0 }>
				<summary>
					<span>Explain CSS</span>
					<small>
						{ count ? `${ count } resolved` : 'no import data' }
					</small>
				</summary>
				<p className="ctb-explain-help">
					This is the resolved CSS captured at import. Later style
					edits do not rewrite this record.
				</p>
				{ isSavedComponentBlock( block ) ? (
					<p className="ctb-explain-empty">
						Mapping is stored inside the linked component, not on
						this instance.
					</p>
				) : null }
				{ ! isSavedComponentBlock( block ) && ! count ? (
					<p className="ctb-explain-empty">
						No CSS mapping was recorded for this block.
					</p>
				) : null }
				{ mapped.length ? (
					<section className="ctb-explain-group">
						<h4>Mapped to controls</h4>
						<MappingRows
							items={ mapped }
							destination="style-control"
						/>
					</section>
				) : null }
				{ fallback.length ? (
					<section className="ctb-explain-group">
						<h4>Preserved as raw CSS</h4>
						<MappingRows items={ fallback } destination="raw-css" />
					</section>
				) : null }
			</details>
			{ importedRules.length ? (
				<details className="ctb-explain-panel" open>
					<summary>
						<span>Styles from imported CSS</span>
						<small>{ importedRules.length } matched</small>
					</summary>
					<ul className="ctb-explain-list">
						{ importedRules.map( ( rule, index ) => (
							<li
								key={ `${ rule.stylesheet_id }-${ rule.order }-${ index }` }
							>
								<div className="ctb-explain-route">
									<code>{ rule.selector }</code>
									<strong>{ rule.condition }</strong>
								</div>
								<code className="ctb-explain-value">
									{ rule.declarations
										.map(
											( declaration ) =>
												`${ declaration.property }: ${
													declaration.value
												}${
													declaration.important
														? ' !important'
														: ''
												};`
										)
										.join( ' ' ) }
								</code>
							</li>
						) ) }
					</ul>
				</details>
			) : null }
		</>
	);
}

function WooCommercePanel( {
	selectedBlock,
	onUpdateSettings,
	onInsert,
	onUpdateProduct,
	onCreateProduct,
	productSaving,
	products,
	available,
} ) {
	const [ productId, setProductId ] = useState( '' );
	const [ gridLimit, setGridLimit ] = useState( '6' );
	const [ creatingProduct, setCreatingProduct ] = useState( null );

	const isProduct = selectedBlock?.type === 'woocommerce_product';
	const selectedProductData =
		isProduct &&
		products.find(
			( p ) =>
				p.id ===
				Number( selectedBlock.attributes?.[ 'data-product-id' ] || 0 )
		);

	return (
		<details
			className="ctb-woo-panel"
			style={ {
				border: '1px solid #bcb6a8',
				marginTop: '12px',
				padding: '0 10px 10px',
			} }
			open={ isProduct }
		>
			<summary
				style={ {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					cursor: 'pointer',
					padding: '10px 0',
					fontSize: '11px',
					fontWeight: 700,
				} }
			>
				<span>WooCommerce</span>
				<small
					style={ {
						color: '#686355',
						fontFamily: 'monospace',
						fontSize: '8px',
						textTransform: 'uppercase',
					} }
				>
					Blocks
				</small>
			</summary>
			{ isProduct && (
				<div
					style={ {
						marginBottom: '12px',
						padding: '10px',
						background: '#eef3fc',
						border: '1px solid #c9d8f0',
						borderRadius: '4px',
					} }
				>
					<strong
						style={ {
							display: 'block',
							fontSize: '11px',
							marginBottom: '6px',
						} }
					>
						Product Settings
					</strong>

					{ selectedProductData ? (
						<div style={ { display: 'grid', gap: '8px' } }>
							<div>
								<span
									style={ {
										fontSize: '10px',
										fontWeight: 700,
									} }
								>
									Custom Fields:{ ' ' }
								</span>
								<select
									onChange={ ( e ) =>
										onUpdateSettings( selectedBlock.id, {
											'data-bind-custom-field':
												e.target.value,
										} )
									}
									value={
										selectedBlock.attributes?.[
											'data-bind-custom-field'
										] || ''
									}
									style={ {
										width: '100%',
										padding: '4px',
										fontSize: '10px',
									} }
								>
									<option value="">(None bound)</option>
									{ selectedProductData.custom_fields?.map(
										( f ) => (
											<option
												key={ f.key }
												value={ f.key }
											>
												{ f.key }
											</option>
										)
									) }
								</select>
							</div>

							<div
								style={ {
									marginTop: '12px',
									borderTop: '1px solid #c9d8f0',
									paddingTop: '12px',
								} }
							>
								<strong
									style={ {
										display: 'block',
										fontSize: '11px',
										marginBottom: '8px',
									} }
								>
									Edit Product Data
								</strong>
								<CommerceProductEditor
									product={ selectedProductData }
									onSave={ ( payload ) =>
										onUpdateProduct(
											selectedProductData.id,
											payload
										)
									}
									saving={ productSaving }
								/>
							</div>
							{ selectedProductData.type === 'variable' ? (
								<label
									style={ {
										display: 'flex',
										alignItems: 'center',
										gap: '6px',
										fontSize: '10px',
									} }
								>
									<input
										type="checkbox"
										checked={
											selectedBlock.attributes?.[
												'data-show-variations'
											] === 'true'
										}
										onChange={ ( event ) =>
											onUpdateSettings(
												selectedBlock.id,
												{
													'data-show-variations':
														event.target.checked
															? 'true'
															: '',
												}
											)
										}
									/>{ ' ' }
									Show the variation selector on the product
									block
								</label>
							) : null }
						</div>
					) : (
						<p
							style={ {
								fontSize: '10px',
								margin: 0,
								color: '#d32f2f',
							} }
						>
							Selected product not found or invalid.
						</p>
					) }
				</div>
			) }
			<p
				style={ {
					color: '#686355',
					fontSize: '10px',
					lineHeight: '1.45',
					margin: '0 0 10px',
				} }
			>
				{ available
					? 'Live product data from WooCommerce. Style with the normal panel.'
					: 'WooCommerce is unavailable. Product previews cannot load.' }
			</p>
			<div
				style={ {
					background: '#f7f5ee',
					border: '1px solid #d3cec1',
					padding: '9px',
					marginBottom: '8px',
				} }
			>
				<strong
					style={ {
						display: 'block',
						fontSize: '11px',
						marginBottom: '6px',
					} }
				>
					Create Product
				</strong>
				{ creatingProduct ? (
					<CommerceProductEditor
						product={ creatingProduct }
						onSave={ async ( payload ) => {
							await onCreateProduct( payload );
							setCreatingProduct( null );
						} }
						onCancel={ () => setCreatingProduct( null ) }
						saving={ productSaving }
						submitLabel="Create product"
					/>
				) : (
					<div style={ { display: 'flex', gap: '6px' } }>
						<button
							type="button"
							disabled={ ! available }
							onClick={ () =>
								setCreatingProduct(
									createProductDraft( 'simple' )
								)
							}
						>
							New simple product
						</button>
						<button
							type="button"
							disabled={ ! available }
							onClick={ () =>
								setCreatingProduct(
									createProductDraft( 'variable' )
								)
							}
						>
							New variable product
						</button>
					</div>
				) }
			</div>
			<div style={ { display: 'grid', gap: '8px' } }>
				<div
					style={ {
						display: 'grid',
						gap: '4px',
						background: '#f7f5ee',
						border: '1px solid #d3cec1',
						padding: '9px',
					} }
				>
					<strong style={ { fontSize: '11px' } }>
						Single Product
					</strong>
					<small style={ { color: '#686355', fontSize: '9px' } }>
						Renders title, price, image, short description via
						dynamic bindings.
					</small>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '9px',
							fontWeight: 700,
							marginTop: '6px',
						} }
					>
						<span>Product</span>
						<select
							value={ productId }
							onChange={ ( e ) => setProductId( e.target.value ) }
							style={ {
								border: '1px solid #aaa393',
								borderRadius: '3px',
								padding: '5px 6px',
								fontSize: '10px',
							} }
						>
							<option value="">Select a product</option>
							{ products.map( ( product ) => (
								<option key={ product.id } value={ product.id }>
									{ product.name } ({ product.type })
								</option>
							) ) }
						</select>
					</label>
					<button
						type="button"
						disabled={ ! productId }
						onClick={ () =>
							onInsert( 'woocommerce_product', { productId } )
						}
						style={ {
							background: '#171d35',
							color: '#fff',
							border: '1px solid #171d35',
							borderRadius: '3px',
							padding: '6px 8px',
							fontSize: '9px',
							fontWeight: 700,
							cursor: productId ? 'pointer' : 'not-allowed',
							opacity: productId ? 1 : 0.55,
							marginTop: '6px',
						} }
					>
						Insert Product after selection
					</button>
				</div>
				<div
					style={ {
						display: 'grid',
						gap: '4px',
						background: '#f7f5ee',
						border: '1px solid #d3cec1',
						padding: '9px',
					} }
				>
					<strong style={ { fontSize: '11px' } }>Product Grid</strong>
					<small style={ { color: '#686355', fontSize: '9px' } }>
						Loops latest products. Customize template children after
						insert.
					</small>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '9px',
							fontWeight: 700,
							marginTop: '6px',
						} }
					>
						<span>Limit</span>
						<input
							type="text"
							value={ gridLimit }
							onChange={ ( e ) => setGridLimit( e.target.value ) }
							style={ {
								border: '1px solid #aaa393',
								borderRadius: '3px',
								padding: '5px 6px',
								fontSize: '10px',
								width: '80px',
							} }
						/>
					</label>
					<button
						type="button"
						onClick={ () =>
							onInsert( 'woocommerce_product_grid', {
								limit: gridLimit,
							} )
						}
						style={ {
							background: '#171d35',
							color: '#fff',
							border: '1px solid #171d35',
							borderRadius: '3px',
							padding: '6px 8px',
							fontSize: '9px',
							fontWeight: 700,
							cursor: 'pointer',
							marginTop: '6px',
						} }
					>
						Insert Grid after selection
					</button>
				</div>
				<div
					style={ {
						display: 'grid',
						gridTemplateColumns: '1fr 1fr',
						gap: '6px',
					} }
				>
					<button
						type="button"
						onClick={ () => onInsert( 'woocommerce_cart', {} ) }
						style={ {
							background: '#fff',
							color: '#171d35',
							border: '1px solid #171d35',
							borderRadius: '3px',
							padding: '6px 8px',
							fontSize: '9px',
							fontWeight: 700,
							cursor: 'pointer',
						} }
					>
						Insert Cart
					</button>
					<button
						type="button"
						onClick={ () => onInsert( 'woocommerce_checkout', {} ) }
						style={ {
							background: '#fff',
							color: '#171d35',
							border: '1px solid #171d35',
							borderRadius: '3px',
							padding: '6px 8px',
							fontSize: '9px',
							fontWeight: 700,
							cursor: 'pointer',
						} }
					>
						Insert Checkout
					</button>
				</div>
				<small
					style={ {
						color: '#686355',
						fontSize: '8px',
						lineHeight: '1.4',
					} }
				>
					Cart/Checkout use WooCommerce Blocks (Interactivity API),
					not shortcodes — avoids markup-fragility.
				</small>
			</div>
		</details>
	);
}

function FormsPanel( {
	selectedBlock,
	onInsertForm,
	onInsertField,
	onUpdateField,
	onUpdateFormSettings,
} ) {
	const isForm = selectedBlock?.type === 'form';
	const isField = selectedBlock?.type === 'form_field';
	return (
		<details
			className="ctb-forms-panel"
			style={ {
				border: '1px solid #bcb6a8',
				marginTop: '12px',
				padding: '0 10px 10px',
			} }
		>
			<summary
				style={ {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					cursor: 'pointer',
					padding: '10px 0',
					fontSize: '11px',
					fontWeight: 700,
				} }
			>
				<span>Forms — native or external</span>
				<small
					style={ {
						color: '#686355',
						fontFamily: 'monospace',
						fontSize: '8px',
					} }
				>
					Blocks
				</small>
			</summary>
			<p
				style={ {
					color: '#686355',
					fontSize: '10px',
					lineHeight: '1.45',
					margin: '0 0 8px',
				} }
			>
				Build with our blocks, choose where submissions go. One visual
				builder, two destinations (native DB+email or external plugin).
				Native spam defenses are server-side enforced.
			</p>
			<button
				type="button"
				onClick={ () => onInsertForm() }
				style={ {
					width: '100%',
					background: '#171d35',
					color: '#fff',
					border: '1px solid #171d35',
					borderRadius: '3px',
					padding: '8px',
					fontSize: '10px',
					fontWeight: 700,
					cursor: 'pointer',
					marginBottom: '8px',
				} }
			>
				Insert Contact Form after selection
			</button>
			{ isForm ? (
				<div
					style={ {
						background: '#f7f5ee',
						border: '1px solid #d3cec1',
						padding: '9px',
						display: 'grid',
						gap: '8px',
					} }
				>
					<strong style={ { fontSize: '11px' } }>
						Form Settings ({ selectedBlock.id })
					</strong>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<span>Submission Handling</span>
						<select
							value={
								selectedBlock.attributes?.[
									'data-submission'
								] || 'native'
							}
							onChange={ ( e ) =>
								onUpdateFormSettings( selectedBlock.id, {
									'data-submission': e.target.value,
								} )
							}
							style={ { padding: '5px', fontSize: '10px' } }
						>
							<option value="native">
								Native (DB + email, server-side spam checks)
							</option>
							<option value="external">
								External Plugin (shortcode)
							</option>
						</select>
					</label>
					{ ( selectedBlock.attributes?.[ 'data-submission' ] ||
						'native' ) === 'native' ? (
						<label
							style={ {
								display: 'grid',
								gap: '4px',
								fontSize: '10px',
								fontWeight: 700,
							} }
						>
							<span>Email To</span>
							<input
								type="text"
								value={
									selectedBlock.attributes?.[
										'data-email-to'
									] || ''
								}
								onChange={ ( e ) =>
									onUpdateFormSettings( selectedBlock.id, {
										'data-email-to': e.target.value,
									} )
								}
								placeholder="admin@example.com"
								style={ { padding: '5px', fontSize: '10px' } }
							/>
							<small
								style={ { color: '#686355', fontWeight: 400 } }
							>
								Uses wp_mail(). Blank = admin_email.
							</small>
						</label>
					) : (
						<label
							style={ {
								display: 'grid',
								gap: '4px',
								fontSize: '10px',
								fontWeight: 700,
							} }
						>
							<span>External Shortcode</span>
							<input
								type="text"
								value={
									selectedBlock.attributes?.[
										'data-external-shortcode'
									] || ''
								}
								onChange={ ( e ) =>
									onUpdateFormSettings( selectedBlock.id, {
										'data-external-shortcode':
											e.target.value,
									} )
								}
								placeholder='[contact-form-7 id="123"]'
								style={ {
									padding: '5px',
									fontSize: '10px',
									fontFamily: 'monospace',
								} }
							/>
							<small
								style={ { color: '#686355', fontWeight: 400 } }
							>
								Only Contact Form 7 / WPForms / Formidable /
								Gravity / Ninja shortcodes are rendered. Others
								show as note.
							</small>
						</label>
					) }
					<div
						style={ {
							display: 'grid',
							gap: '6px',
							marginTop: '6px',
						} }
					>
						<span style={ { fontSize: '10px', fontWeight: 700 } }>
							Add Field to this Form
						</span>
						<div
							style={ {
								display: 'grid',
								gridTemplateColumns: '1fr 1fr',
								gap: '4px',
							} }
						>
							{ [
								'text',
								'email',
								'textarea',
								'select',
								'checkbox',
								'radio',
								'file',
							].map( ( t ) => (
								<button
									key={ t }
									type="button"
									onClick={ () =>
										onInsertField( selectedBlock.id, t )
									}
									style={ {
										padding: '6px',
										fontSize: '9px',
										border: '1px solid #171d35',
										background: '#fff',
										cursor: 'pointer',
										borderRadius: '3px',
									} }
								>
									{ t }
								</button>
							) ) }
						</div>
					</div>
				</div>
			) : null }
			{ isField ? (
				<div
					style={ {
						background: '#f7f5ee',
						border: '1px solid #d3cec1',
						padding: '9px',
						display: 'grid',
						gap: '8px',
						marginTop: '8px',
					} }
				>
					<strong style={ { fontSize: '11px' } }>
						Field: { selectedBlock.id }
					</strong>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<span>Type</span>
						<select
							value={
								selectedBlock.attributes?.[
									'data-field-type'
								] || 'text'
							}
							onChange={ ( e ) =>
								onUpdateField( selectedBlock.id, {
									'data-field-type': e.target.value,
								} )
							}
							style={ { padding: '5px', fontSize: '10px' } }
						>
							{ [
								'text',
								'email',
								'tel',
								'url',
								'number',
								'textarea',
								'select',
								'checkbox',
								'radio',
								'file',
							].map( ( o ) => (
								<option key={ o } value={ o }>
									{ o }
								</option>
							) ) }
						</select>
					</label>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<span>Label</span>
						<input
							type="text"
							value={
								selectedBlock.attributes?.[
									'data-field-label'
								] || ''
							}
							onChange={ ( e ) =>
								onUpdateField( selectedBlock.id, {
									'data-field-label': e.target.value,
								} )
							}
							style={ { padding: '5px', fontSize: '10px' } }
						/>
					</label>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<span>Name (field key)</span>
						<input
							type="text"
							value={
								selectedBlock.attributes?.[
									'data-field-name'
								] || ''
							}
							onChange={ ( e ) =>
								onUpdateField( selectedBlock.id, {
									'data-field-name': e.target.value,
								} )
							}
							style={ {
								padding: '5px',
								fontSize: '10px',
								fontFamily: 'monospace',
							} }
						/>
					</label>
					<label
						style={ {
							display: 'grid',
							gap: '4px',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<span>Placeholder</span>
						<input
							type="text"
							value={
								selectedBlock.attributes?.[
									'data-field-placeholder'
								] || ''
							}
							onChange={ ( e ) =>
								onUpdateField( selectedBlock.id, {
									'data-field-placeholder': e.target.value,
								} )
							}
							style={ { padding: '5px', fontSize: '10px' } }
						/>
					</label>
					<label
						style={ {
							display: 'flex',
							gap: '6px',
							alignItems: 'center',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<input
							type="checkbox"
							checked={
								!! selectedBlock.attributes?.[
									'data-field-required'
								]
							}
							onChange={ ( e ) =>
								onUpdateField( selectedBlock.id, {
									'data-field-required': e.target.checked
										? true
										: '',
								} )
							}
						/>{ ' ' }
						Required
					</label>
					{ [ 'select', 'checkbox', 'radio' ].includes(
						selectedBlock.attributes?.[ 'data-field-type' ]
					) ? (
						<label
							style={ {
								display: 'grid',
								gap: '4px',
								fontSize: '10px',
								fontWeight: 700,
							} }
						>
							<span>Options (comma separated)</span>
							<input
								type="text"
								value={
									selectedBlock.attributes?.[
										'data-field-options'
									] || ''
								}
								onChange={ ( e ) =>
									onUpdateField( selectedBlock.id, {
										'data-field-options': e.target.value,
									} )
								}
								placeholder="Option 1, Option 2"
								style={ { padding: '5px', fontSize: '10px' } }
							/>
						</label>
					) : null }
				</div>
			) : null }
		</details>
	);
}

function WidgetLibraryPanel( { onInsert } ) {
	return (
		<details
			className="ctb-widget-library-panel"
			style={ {
				border: '1px solid #bcb6a8',
				marginTop: '12px',
				padding: '0 10px 10px',
			} }
		>
			<summary
				style={ {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					cursor: 'pointer',
					padding: '10px 0',
					fontSize: '11px',
					fontWeight: 700,
				} }
			>
				<span>Widget Library — 8 pre-built</span>
				<small
					style={ {
						color: '#686355',
						fontFamily: 'monospace',
						fontSize: '8px',
					} }
				>
					On File 4
				</small>
			</summary>
			<p
				style={ {
					color: '#686355',
					fontSize: '10px',
					lineHeight: '1.45',
					margin: '0 0 8px',
				} }
			>
				Pre-built arrangements of existing blocks with slots, built on
				reusable-components. No second architecture.
			</p>
			<div style={ { display: 'grid', gap: '6px' } }>
				{ WIDGET_LIBRARY.map( ( w ) => (
					<div
						key={ w.id }
						style={ {
							background: '#f7f5ee',
							border: '1px solid #d3cec1',
							padding: '9px',
							display: 'grid',
							gap: '4px',
						} }
					>
						<strong style={ { fontSize: '11px' } }>
							{ w.label }
						</strong>
						<small style={ { color: '#686355', fontSize: '9px' } }>
							{ w.description }
						</small>
						<button
							type="button"
							onClick={ () => onInsert( w.block ) }
							style={ {
								background: '#171d35',
								color: '#fff',
								border: '1px solid #171d35',
								borderRadius: '3px',
								padding: '6px',
								fontSize: '9px',
								fontWeight: 700,
								cursor: 'pointer',
								marginTop: '4px',
							} }
						>
							Insert after selection
						</button>
					</div>
				) ) }
			</div>
		</details>
	);
}

function SeoPanel( { document, onChange } ) {
	const seo = document.seo || {};
	const fields = [
		{
			key: 'title',
			label: 'SEO Title',
			placeholder: 'Page title — 50-60 chars ideal',
			help: 'Title tag — shown in Google results and browser tab. Keep 50-60 chars.',
		},
		{
			key: 'description',
			label: 'Meta Description',
			placeholder: 'Brief summary — 120-160 chars ideal',
			help: 'Meta description — shown under title in search results. Aim 120-160 chars.',
		},
		{
			key: 'canonical',
			label: 'Canonical URL',
			placeholder: 'https://example.com/page/',
			help: 'Canonical — preferred URL for this page. Usually leave blank for auto.',
		},
		{
			key: 'og_title',
			label: 'Open Graph Title',
			placeholder: 'Social sharing title',
			help: 'OG title — for Facebook/Twitter shares. Falls back to SEO Title.',
		},
		{
			key: 'og_description',
			label: 'OG Description',
			placeholder: 'Social sharing description',
			help: 'OG description — for social shares. Falls back to meta description.',
		},
		{
			key: 'og_image',
			label: 'OG Image URL',
			placeholder: 'https://example.com/image.jpg',
			help: 'OG image — preview image for social shares.',
		},
	];
	return (
		<details
			className="ctb-seo-panel"
			style={ {
				border: '1px solid #bcb6a8',
				marginTop: '12px',
				padding: '0 10px 10px',
			} }
		>
			<summary
				style={ {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					cursor: 'pointer',
					padding: '10px 0',
					fontSize: '11px',
					fontWeight: 700,
				} }
			>
				<span>SEO</span>
				<small
					style={ {
						color: '#686355',
						fontFamily: 'monospace',
						fontSize: '8px',
						textTransform: 'uppercase',
					} }
				>
					{ Object.keys( seo ).length || '0' } fields
				</small>
			</summary>
			<p
				style={ {
					color: '#686355',
					fontSize: '10px',
					lineHeight: '1.45',
					margin: '0 0 8px',
				} }
			>
				Title/description/canonical/Open Graph — editable here and via
				Content Mode. Auto JSON-LD (WebPage/Product/LocalBusiness) is
				generated from your blocks, not typed.
			</p>
			{ fields.map( ( f ) => {
				const val = seo[ f.key ] || '';
				const isDesc =
					f.key === 'description' || f.key === 'og_description';
				const len = val.length;
				const counter = isDesc ? `${ len } / 160` : `${ len } / 60`;
				const warn = isDesc ? len > 160 : len > 60 && f.key === 'title';
				return (
					<label
						key={ f.key }
						style={ {
							display: 'grid',
							gap: '4px',
							marginTop: '8px',
							fontSize: '10px',
							fontWeight: 700,
						} }
					>
						<span
							style={ {
								display: 'flex',
								justifyContent: 'space-between',
							} }
						>
							<span>{ f.label }</span>
							<span
								style={ {
									color: warn ? '#9f2525' : '#686355',
									fontWeight: 400,
									fontFamily: 'monospace',
									fontSize: '8px',
								} }
							>
								{ val ? counter : '' }
							</span>
						</span>
						{ f.key === 'description' ||
						f.key === 'og_description' ? (
							<textarea
								value={ val }
								onChange={ ( e ) =>
									onChange( f.key, e.target.value )
								}
								placeholder={ f.placeholder }
								rows={ 2 }
								style={ {
									border: '1px solid #aaa393',
									borderRadius: '3px',
									padding: '6px',
									fontSize: '10px',
									fontFamily: 'inherit',
								} }
							/>
						) : (
							<input
								type="text"
								value={ val }
								onChange={ ( e ) =>
									onChange( f.key, e.target.value )
								}
								placeholder={ f.placeholder }
								style={ {
									border: '1px solid #aaa393',
									borderRadius: '3px',
									padding: '6px',
									fontSize: '10px',
								} }
							/>
						) }
						<small
							style={ {
								color: '#686355',
								fontWeight: 400,
								fontSize: '8px',
								lineHeight: '1.3',
							} }
						>
							{ f.help }
						</small>
					</label>
				);
			} ) }
		</details>
	);
}

function AccessibilityPanel( { issues, onSelect } ) {
	if ( ! issues.length ) {
		return (
			<details
				className="ctb-a11y-panel"
				style={ {
					border: '1px solid #bcb6a8',
					marginTop: '12px',
					padding: '0 10px 10px',
				} }
			>
				<summary
					style={ {
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						cursor: 'pointer',
						padding: '10px 0',
						fontSize: '11px',
						fontWeight: 700,
					} }
				>
					<span>Accessibility — helps identify common issues</span>
					<small
						style={ {
							color: '#2e7d32',
							fontFamily: 'monospace',
							fontSize: '8px',
						} }
					>
						0 issues
					</small>
				</summary>
				<p
					style={ {
						color: '#686355',
						fontSize: '10px',
						lineHeight: '1.45',
						margin: 0,
					} }
				>
					No common issues detected. Automated checks catch many
					common issues but cannot replace testing with real assistive
					technology and real users.
				</p>
			</details>
		);
	}
	return (
		<details
			className="ctb-a11y-panel"
			style={ {
				border: '1px solid #d8a77a',
				marginTop: '12px',
				padding: '0 10px 10px',
				background: '#fff8e1',
			} }
			open
		>
			<summary
				style={ {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					cursor: 'pointer',
					padding: '10px 0',
					fontSize: '11px',
					fontWeight: 700,
				} }
			>
				<span>Accessibility — helps identify common issues</span>
				<small
					style={ {
						color: '#b42318',
						fontFamily: 'monospace',
						fontSize: '8px',
					} }
				>
					{ issues.length } found
				</small>
			</summary>
			<p
				style={ {
					color: '#686355',
					fontSize: '9px',
					lineHeight: '1.4',
					margin: '0 0 8px',
				} }
			>
				Automated checks catch many common issues but cannot replace
				testing with real assistive technology and real users. This tool
				never claims compliance.
			</p>
			<ul
				style={ {
					listStyle: 'none',
					padding: 0,
					margin: 0,
					display: 'grid',
					gap: '6px',
				} }
			>
				{ issues.map( ( issue, idx ) => (
					<li
						key={ `${ issue.block_id }-${ issue.type }-${ idx }` }
						style={ {
							background: '#fff',
							border: '1px solid #d3cec1',
							borderLeft: '3px solid #d57a2a',
							padding: '8px',
							fontSize: '9px',
						} }
					>
						<div
							style={ {
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
							} }
						>
							<strong>{ issue.type }</strong>
							<button
								type="button"
								onClick={ () => onSelect( issue.block_id ) }
								style={ {
									background: '#171d35',
									color: '#fff',
									border: '1px solid #171d35',
									borderRadius: '3px',
									padding: '3px 6px',
									fontSize: '8px',
									cursor: 'pointer',
									fontFamily: 'monospace',
								} }
							>
								{ issue.block_id }
							</button>
						</div>
						<p style={ { margin: '4px 0 0', lineHeight: '1.4' } }>
							{ issue.message }
						</p>
						<small
							style={ {
								color: '#686355',
								display: 'block',
								marginTop: '4px',
								lineHeight: '1.3',
							} }
						>
							{ issue.why }
						</small>
					</li>
				) ) }
			</ul>
		</details>
	);
}

function ContextMenu( {
	menu,
	onClose,
	onAction,
	hasClipboard,
	hasStylesClipboard,
} ) {
	if ( ! menu ) {
		return null;
	}
	const { x, y, zone } = menu;
	const actions = [];
	if ( 'WIDGET' === zone ) {
		actions.push( { id: 'edit', label: 'Edit' } );
		actions.push( { id: 'duplicate', label: 'Duplicate' } );
		actions.push( { id: 'copy', label: 'Copy' } );
		if ( hasClipboard ) {
			actions.push( { id: 'paste', label: 'Paste' } );
		}
		actions.push( { id: 'delete', label: 'Delete' } );
		actions.push( { id: 'copyStyles', label: 'Copy Styles' } );
		if ( hasStylesClipboard ) {
			actions.push( { id: 'pasteStyles', label: 'Paste Styles' } );
		}
		actions.push( {
			id: 'saveComponent',
			label: 'Save as Reusable Component',
		} );
	} else if ( 'CONTAINER' === zone ) {
		actions.push( { id: 'edit', label: 'Edit' } );
		actions.push( { id: 'duplicate', label: 'Duplicate' } );
		actions.push( { id: 'copy', label: 'Copy' } );
		if ( hasClipboard ) {
			actions.push( { id: 'paste', label: 'Paste' } );
		}
		actions.push( { id: 'delete', label: 'Delete' } );
		actions.push( { id: 'addInner', label: 'Add Inner Container' } );
		actions.push( { id: 'convertLayout', label: 'Convert Layout Mode' } );
		actions.push( { id: 'copyStyles', label: 'Copy Styles' } );
		if ( hasStylesClipboard ) {
			actions.push( { id: 'pasteStyles', label: 'Paste Styles' } );
		}
		actions.push( {
			id: 'saveComponent',
			label: 'Save as Reusable Component',
		} );
	} else if ( 'SLOT' === zone ) {
		actions.push( { id: 'edit', label: 'Edit' } );
		actions.push( { id: 'editSlotLabel', label: 'Edit Slot Label' } );
		actions.push( { id: 'duplicate', label: 'Duplicate' } );
		actions.push( { id: 'copy', label: 'Copy' } );
		if ( hasClipboard ) {
			actions.push( { id: 'paste', label: 'Paste' } );
		}
		actions.push( { id: 'delete', label: 'Delete' } );
		actions.push( { id: 'copyStyles', label: 'Copy Styles' } );
		if ( hasStylesClipboard ) {
			actions.push( { id: 'pasteStyles', label: 'Paste Styles' } );
		}
		actions.push( {
			id: 'saveComponent',
			label: 'Save as Reusable Component',
		} );
	} else if ( 'EMPTY' === zone ) {
		if ( hasClipboard ) {
			actions.push( { id: 'paste', label: 'Paste' } );
		}
		actions.push( { id: 'addBlock', label: 'Add Block' } );
		actions.push( { id: 'pageSettings', label: 'Page Settings' } );
	}
	return (
		<div
			role="menu"
			aria-label={ `${ zone } context menu` }
			style={ {
				position: 'fixed',
				left: Math.min( x, window.innerWidth - 220 ),
				top: Math.min( y, window.innerHeight - 300 ),
				background: '#fff',
				border: '1px solid #bcb6a8',
				boxShadow: '0 8px 24px rgba(23,29,53,0.18)',
				zIndex: 9999,
				minWidth: '200px',
				padding: '4px 0',
				fontFamily: 'Inter, sans-serif',
			} }
			onClick={ ( e ) => e.stopPropagation() }
		>
			<div
				style={ {
					padding: '6px 12px 4px',
					fontSize: '8px',
					letterSpacing: '0.08em',
					textTransform: 'uppercase',
					color: '#686355',
					borderBottom: '1px solid #eee',
					fontWeight: 700,
				} }
			>
				{ zone } · { actions.length } actions
			</div>
			{ actions.map( ( a ) => (
				<button
					key={ a.id }
					role="menuitem"
					type="button"
					onClick={ () => {
						onAction( a.id );
						onClose();
					} }
					style={ {
						display: 'block',
						width: '100%',
						textAlign: 'left',
						padding: '8px 12px',
						background: 'transparent',
						border: '0',
						fontSize: '11px',
						cursor: 'pointer',
					} }
					onMouseEnter={ ( e ) =>
						( e.currentTarget.style.background = '#f3f1eb' )
					}
					onMouseLeave={ ( e ) =>
						( e.currentTarget.style.background = 'transparent' )
					}
				>
					{ a.label }
				</button>
			) ) }
			<div
				style={ {
					borderTop: '1px solid #eee',
					marginTop: '4px',
					padding: '6px 12px',
					fontSize: '8px',
					color: '#686355',
				} }
			>
				Shift+F10 also opens this menu for the focused block
			</div>
		</div>
	);
}

function DiagnosticsPanel( { postId } ) {
	const [ data, setData ] = useState( null );
	const [ loading, setLoading ] = useState( false );
	const [ error, setError ] = useState( '' );
	async function run() {
		if ( ! postId ) {
			setError( 'Save the post first.' );
			return;
		}
		setLoading( true );
		setError( '' );
		try {
			const res = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/diagnostics`,
			} );
			setData( res );
		} catch ( e ) {
			setError( e.message || 'Diagnostics failed.' );
		} finally {
			setLoading( false );
		}
	}
	return (
		<details
			className="ctb-woo-panel"
			style={ {
				border: '1px solid #bcb6a8',
				marginTop: '12px',
				padding: '0 10px 10px',
			} }
		>
			<summary
				style={ {
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					cursor: 'pointer',
					padding: '10px 0',
					fontSize: '11px',
					fontWeight: 700,
				} }
			>
				<span>Diagnostics</span>
				<small
					style={ {
						color: '#686355',
						fontFamily: 'monospace',
						fontSize: '8px',
					} }
				>
					Woo conflict check
				</small>
			</summary>
			<p
				style={ {
					color: '#686355',
					fontSize: '10px',
					lineHeight: '1.45',
					margin: '0 0 8px',
				} }
			>
				Lists active plugins and flags heuristic conflicts with
				cart/checkout/session. Safe — no plugins are deactivated.
			</p>
			<button
				type="button"
				onClick={ run }
				disabled={ loading }
				style={ {
					background: '#171d35',
					color: '#fff',
					border: '1px solid #171d35',
					borderRadius: '3px',
					padding: '6px 8px',
					fontSize: '9px',
					fontWeight: 700,
					cursor: 'pointer',
				} }
			>
				{ loading ? 'Checking…' : 'Run diagnostics' }
			</button>
			{ error ? (
				<p
					style={ {
						color: '#9f2525',
						fontSize: '10px',
						marginTop: '8px',
					} }
				>
					{ error }
				</p>
			) : null }
			{ data ? (
				<div
					style={ { marginTop: '10px', display: 'grid', gap: '6px' } }
				>
					<div
						style={ {
							fontSize: '10px',
							display: 'flex',
							gap: '8px',
						} }
					>
						<span>
							WooCommerce:{ ' ' }
							{ data.has_woo ? 'active' : 'not active' }
						</span>
						<span>·</span>
						<span>{ data.commerce_blocks } commerce block(s)</span>
					</div>
					<div style={ { marginTop: '4px' } }>
						<a
							href={ `${
								window.codeToBlockEditorSettings?.liveUrl || '/'
							}?ctb_safe_mode=1` }
							target="_blank"
							rel="noopener noreferrer"
							style={ {
								display: 'inline-block',
								background: '#d57a2a',
								color: '#fff',
								border: '1px solid #c2691e',
								borderRadius: '3px',
								padding: '4px 8px',
								fontSize: '9px',
								fontWeight: 700,
								textDecoration: 'none',
							} }
						>
							Open Live Preview in Safe Mode (Isolate CSS/JS
							Conflicts)
						</a>
					</div>
					<ul
						style={ {
							listStyle: 'none',
							padding: 0,
							margin: 0,
							display: 'grid',
							gap: '4px',
						} }
					>
						{ data.plugins.map( ( p ) => (
							<li
								key={ p.file }
								style={ {
									fontSize: '9px',
									padding: '6px',
									background: p.flagged
										? '#fff8df'
										: '#f7f5ee',
									border: `1px solid ${
										p.flagged ? '#d8a77a' : '#d3cec1'
									}`,
									borderLeft: `3px solid ${
										p.flagged ? '#d57a2a' : '#bcb6a8'
									}`,
								} }
							>
								<strong>{ p.name }</strong>{ ' ' }
								<small style={ { color: '#686355' } }>
									{ p.version }
								</small>
								{ p.flagged ? (
									<div
										style={ {
											color: '#81530d',
											marginTop: '2px',
										} }
									>
										Flagged: { p.reason }
									</div>
								) : null }
								<div
									style={ {
										color: '#686355',
										fontFamily: 'monospace',
										fontSize: '8px',
									} }
								>
									{ p.file }
								</div>
							</li>
						) ) }
					</ul>
					<small
						style={ {
							color: '#686355',
							fontSize: '8px',
							lineHeight: '1.4',
						} }
					>
						{ data.note }
					</small>
				</div>
			) : null }
		</details>
	);
}

function ParityWarningsPanel( { warnings, onSelect } ) {
	if ( ! warnings.length ) {
		return null;
	}
	return (
		<div className="ctb-parity-warnings" role="alert">
			<strong>Parity check</strong>
			<p>
				The editor and the live site disagree on { warnings.length }{ ' ' }
				block
				{ warnings.length === 1 ? '' : 's' }.
			</p>
			<ul>
				{ warnings.map( ( warning ) => (
					<li key={ `${ warning.block_id }:${ warning.context }` }>
						<button
							type="button"
							onClick={ () => onSelect( warning.block_id ) }
						>
							{ warning.block_id }
						</button>
						<span> — { warning.message }</span>
						<small> ({ warning.context })</small>
					</li>
				) ) }
			</ul>
		</div>
	);
}

function BlockVisibilityControl( { block, breakpoint, onToggle } ) {
	const ownHidden = isHiddenOverridden( block, breakpoint );
	const effectiveHidden = isBlockHidden( block, breakpoint );
	const inherited = effectiveHidden && ! ownHidden;
	const inputId = `ctb-hide-${ block.id }-${ breakpoint }`;
	return (
		<div className="ctb-visibility-control">
			<label htmlFor={ inputId }>
				<input
					id={ inputId }
					type="checkbox"
					checked={ ownHidden }
					onChange={ ( event ) => onToggle( event.target.checked ) }
				/>
				<span>Hide on { breakpoint }</span>
			</label>
			{ inherited ? (
				<small>Inherited hidden from wider device</small>
			) : null }
			{ effectiveHidden && ! inherited ? (
				<small>Hidden on this device</small>
			) : null }
			{ ! effectiveHidden && ! ownHidden ? (
				<small>Visible on this device</small>
			) : null }
		</div>
	);
}

function BreakpointSwitcher( { value, onChange, compact = false } ) {
	const deviceIcons = {
		desktop: 'fa-display',
		tablet: 'fa-tablet-screen-button',
		mobile: 'fa-mobile-screen-button',
	};

	return (
		<div
			className={ `flex items-center gap-1 rounded-lg bg-gray-100 p-1 ${
				compact ? '' : 'w-full'
			}` }
			role="group"
			aria-label={ compact ? 'Style breakpoint' : 'Canvas breakpoint' }
		>
			{ BREAKPOINTS.map( ( breakpoint ) => (
				<button
					key={ breakpoint.id }
					type="button"
					className={ `flex h-8 items-center justify-center gap-2 rounded-md border-0 px-2.5 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
						value === breakpoint.id
							? 'bg-white text-indigo-600 shadow-sm'
							: 'bg-transparent text-gray-500 hover:bg-white/70 hover:text-gray-800'
					}` }
					aria-pressed={ value === breakpoint.id }
					title={ `${ breakpoint.label } · ${ breakpoint.width }` }
					onClick={ () => onChange( breakpoint.id ) }
				>
					<i
						className={ `fa-solid ${
							deviceIcons[ breakpoint.id ]
						} text-xs` }
						aria-hidden="true"
					></i>
					<span className={ compact ? 'sr-only' : '' }>
						{ breakpoint.label }
					</span>
				</button>
			) ) }
		</div>
	);
}

function ResponsiveColorOverride( { breakpoint, color, ownColor, onClear } ) {
	if ( breakpoint === 'desktop' ) {
		return null;
	}
	if ( ownColor ) {
		return (
			<button type="button" onClick={ onClear }>
				Clear color override
			</button>
		);
	}
	return <span>Inherited { color }</span>;
}

function breakpointStyleSummary( breakpoint, count ) {
	if ( breakpoint === 'desktop' ) {
		return `${ count } base declarations`;
	}
	if ( count ) {
		return `${ count } explicit ${ breakpoint } overrides`;
	}
	return `No explicit ${ breakpoint } overrides; inherited values are previewed.`;
}

function tokenValueIsValid( category, value ) {
	return TOKEN_PROPERTIES[ category ].some( ( property ) =>
		window.CSS.supports( property, value )
	);
}

function DesignTokenRow( { category, id, token, usage, onSave, onDelete } ) {
	const [ label, setLabel ] = useState( token.label );
	const [ value, setValue ] = useState( token.value );
	const [ error, setError ] = useState( '' );
	const changed = label !== token.label || value !== token.value;

	useEffect( () => {
		setLabel( token.label );
		setValue( token.value );
		setError( '' );
	}, [ token.label, token.value ] );

	function saveToken() {
		const nextLabel = label.trim();
		if ( ! nextLabel ) {
			setError( 'Token name is required.' );
			return;
		}
		const nextValue = value.trim();
		if ( ! nextValue || ! tokenValueIsValid( category, nextValue ) ) {
			setError( 'Enter a valid value for this token category.' );
			return;
		}
		onSave( category, id, { label: nextLabel, value: nextValue } );
		setError( '' );
	}

	return (
		<div className="ctb-token-row">
			<div className="ctb-token-row-heading">
				<code>{ id }</code>
				<span>{ usage } uses</span>
			</div>
			<label htmlFor={ `ctb-token-${ category }-${ id }-label` }>
				<span>Name</span>
				<input
					id={ `ctb-token-${ category }-${ id }-label` }
					type="text"
					value={ label }
					onChange={ ( event ) => setLabel( event.target.value ) }
				/>
			</label>
			<label htmlFor={ `ctb-token-${ category }-${ id }-value` }>
				<span>Value</span>
				<input
					id={ `ctb-token-${ category }-${ id }-value` }
					type="text"
					value={ value }
					onChange={ ( event ) => setValue( event.target.value ) }
				/>
			</label>
			<div className="ctb-token-row-actions">
				<button
					type="button"
					disabled={ ! changed }
					onClick={ saveToken }
				>
					Update
				</button>
				<button
					type="button"
					disabled={ usage > 0 }
					title={
						usage ? 'Remove token references before deleting.' : ''
					}
					onClick={ () => onDelete( category, id ) }
				>
					Delete
				</button>
			</div>
			{ error ? (
				<p className="ctb-token-error" role="alert">
					{ error }
				</p>
			) : null }
		</div>
	);
}

function DesignTokenPanel( { document, onSave, onDelete } ) {
	const [ category, setCategory ] = useState( 'colors' );
	const [ label, setLabel ] = useState( '' );
	const [ value, setValue ] = useState( '' );
	const [ error, setError ] = useState( '' );
	const tokenCount = TOKEN_CATEGORIES.reduce(
		( total, item ) =>
			total +
			Object.keys( document.design_tokens?.[ item.id ] || {} ).length,
		0
	);

	function addToken() {
		const id = tokenIdFromLabel( label );
		if ( ! tokenIdIsValid( id ) ) {
			setError( 'Use a name beginning with a letter.' );
			return;
		}
		if ( document.design_tokens?.[ category ]?.[ id ] ) {
			setError( 'A token with this generated ID already exists.' );
			return;
		}
		const nextValue = value.trim();
		if ( ! nextValue || ! tokenValueIsValid( category, nextValue ) ) {
			setError( 'Enter a valid value for this token category.' );
			return;
		}
		const nextLabel = label.trim();
		onSave( category, id, { label: nextLabel, value: nextValue } );
		setLabel( '' );
		setValue( '' );
		setError( '' );
	}

	return (
		<details className="ctb-design-token-panel">
			<summary>
				<span>Global design tokens</span>
				<small>{ tokenCount } defined</small>
			</summary>
			<p className="ctb-token-help">
				Define once, then link compatible controls on any block.
			</p>
			<div className="ctb-token-create">
				<label htmlFor="ctb-token-category">
					<span>Category</span>
					<select
						id="ctb-token-category"
						value={ category }
						onChange={ ( event ) =>
							setCategory( event.target.value )
						}
					>
						{ TOKEN_CATEGORIES.map( ( item ) => (
							<option key={ item.id } value={ item.id }>
								{ item.label }
							</option>
						) ) }
					</select>
				</label>
				<label htmlFor="ctb-token-new-label">
					<span>Name</span>
					<input
						id="ctb-token-new-label"
						type="text"
						placeholder="Brand"
						value={ label }
						onChange={ ( event ) => setLabel( event.target.value ) }
					/>
				</label>
				<label htmlFor="ctb-token-new-value">
					<span>Value</span>
					<input
						id="ctb-token-new-value"
						type="text"
						placeholder={
							category === 'colors' ? '#6558d3' : '32px'
						}
						value={ value }
						onChange={ ( event ) => setValue( event.target.value ) }
					/>
				</label>
				<button type="button" onClick={ addToken }>
					Add token
				</button>
			</div>
			{ error ? (
				<p className="ctb-token-error" role="alert">
					{ error }
				</p>
			) : null }
			{ TOKEN_CATEGORIES.map( ( item ) => {
				const tokens = Object.entries(
					document.design_tokens?.[ item.id ] || {}
				);
				return tokens.length ? (
					<section key={ item.id } className="ctb-token-category">
						<h4>{ item.label }</h4>
						{ tokens.map( ( [ id, token ] ) => (
							<DesignTokenRow
								key={ id }
								category={ item.id }
								id={ id }
								token={ token }
								usage={ countTokenConsumers(
									document,
									tokenReference( item.id, id )
								) }
								onSave={ onSave }
								onDelete={ onDelete }
							/>
						) ) }
					</section>
				) : null;
			} ) }
		</details>
	);
}

function TokenBindingControl( {
	designTokens,
	property,
	breakpoint,
	styleSet,
	effectiveMapped,
	effectiveBindings,
	onLink,
	onRemove,
	onOverride,
} ) {
	const ownReference = styleSet.token_bindings?.[ property ] || '';
	const effectiveReference = effectiveBindings[ property ] || '';
	const compatibleTokens = tokensForProperty( designTokens, property ).filter(
		( token ) =>
			token.reference === effectiveReference ||
			window.CSS.supports( property, token.value )
	);
	if ( ! compatibleTokens.length && ! effectiveReference ) {
		return null;
	}
	const activeToken = getDesignToken( designTokens, effectiveReference );
	const isOverride = Boolean(
		effectiveReference &&
			effectiveMapped[ property ] !== tokenCssValue( effectiveReference )
	);

	function changeBinding( nextReference ) {
		if ( nextReference ) {
			onLink( property, nextReference );
		} else if ( ownReference ) {
			onRemove( property, ownReference );
		} else if ( effectiveReference ) {
			onOverride( property, effectiveReference );
		}
	}

	let status = 'Local value';
	if ( activeToken ) {
		let mode = 'inherited';
		if ( isOverride ) {
			mode = ownReference ? 'overridden here' : 'inherited override';
		} else if ( ownReference || breakpoint === 'desktop' ) {
			mode = 'linked';
		}
		status = `${ activeToken.label } · ${ mode }`;
	}

	return (
		<div
			className={ `ctb-token-binding${
				isOverride ? ' is-overridden' : ''
			}` }
		>
			<label htmlFor={ `ctb-${ breakpoint }-${ property }-token` }>
				<span>Global token</span>
				<select
					id={ `ctb-${ breakpoint }-${ property }-token` }
					aria-label={ `${ breakpoint } ${ property } global token` }
					value={ effectiveReference }
					onChange={ ( event ) =>
						changeBinding( event.target.value )
					}
				>
					<option value="">Local value</option>
					{ compatibleTokens.map( ( token ) => (
						<option
							key={ token.reference }
							value={ token.reference }
						>
							{ token.label } · { token.value }
						</option>
					) ) }
				</select>
			</label>
			<div className="ctb-token-binding-status">
				<span>{ status }</span>
				{ effectiveReference ? (
					<button
						type="button"
						onClick={ () =>
							isOverride
								? onLink( property, effectiveReference )
								: onOverride( property, effectiveReference )
						}
					>
						{ isOverride
							? 'Restore global'
							: 'Override this block' }
					</button>
				) : null }
			</div>
		</div>
	);
}

function RawCssControl( { styleSet, breakpoint, onApply } ) {
	const currentValue = styleSet.custom_css_fallback || '';
	const [ value, setValue ] = useState( currentValue );
	const [ error, setError ] = useState( '' );
	const fieldId = `ctb-raw-css-${ breakpoint }`;
	let fallbackStatus = 'Inherits earlier breakpoints';
	if ( currentValue ) {
		fallbackStatus = `${ breakpoint } CSS override`;
	} else if ( breakpoint === 'desktop' ) {
		fallbackStatus = 'No fallback CSS';
	}

	useEffect( () => {
		setValue( currentValue );
		setError( '' );
	}, [ currentValue ] );

	function applyCss() {
		try {
			const normalized = normalizeCustomCssFallback( value );
			onApply( normalized );
			setValue( normalized );
			setError( '' );
		} catch ( cssError ) {
			setError( cssError.message );
		}
	}

	return (
		<div className="ctb-raw-css-control">
			<label htmlFor={ fieldId }>Raw CSS fallback</label>
			<textarea
				id={ fieldId }
				aria-describedby={ `${ fieldId }-help` }
				value={ value }
				onChange={ ( event ) => setValue( event.target.value ) }
			/>
			<div className="ctb-raw-css-actions">
				<span>{ fallbackStatus }</span>
				<button
					type="button"
					disabled={ value === currentValue }
					onClick={ applyCss }
				>
					Apply CSS
				</button>
			</div>
			<p id={ `${ fieldId }-help` }>
				Enter declarations for { breakpoint } only. Mapped controls win
				unless a raw value uses{ ' !important' }.
			</p>
			{ error ? (
				<p className="ctb-raw-css-error" role="alert">
					{ error }
				</p>
			) : null }
		</div>
	);
}

function ScrubbableInput( { id, value, placeholder, disabled, onChange } ) {
	const [ isDragging, setIsDragging ] = useState( false );
	const [ startX, setStartX ] = useState( 0 );
	const [ startValue, setStartValue ] = useState( 0 );
	const [ unit, setUnit ] = useState( '' );

	const parseValue = ( val ) => {
		const match = String( val || '' ).match( /^(-?\d*\.?\d+)(.*)$/ );
		if ( match ) {
			return {
				num: parseFloat( match[ 1 ] ),
				strUnit: match[ 2 ] || 'px',
			};
		}
		return { num: 0, strUnit: 'px' };
	};

	const handleMouseDown = ( e ) => {
		if ( disabled ) {
			return;
		}
		setIsDragging( true );
		setStartX( e.clientX );
		const parsed = parseValue( value );
		setStartValue( parsed.num );
		setUnit( parsed.strUnit );
		e.preventDefault(); // prevent text selection
	};

	useEffect( () => {
		if ( ! isDragging ) {
			return;
		}

		const handleMouseMove = ( e ) => {
			const deltaX = e.clientX - startX;
			let multiplier = 1;
			if ( e.shiftKey ) {
				multiplier = 10;
			} else if ( e.altKey || e.metaKey ) {
				multiplier = 0.1;
			}

			const newValue = startValue + deltaX * multiplier * 0.5; // 0.5 sensitivity factor
			// format to 1 decimal place to avoid floating point issues, then remove trailing .0
			const formattedValue = newValue.toFixed( 1 ).replace( /\.0$/, '' );
			onChange( { target: { value: `${ formattedValue }${ unit }` } } );
		};

		const handleMouseUp = () => {
			setIsDragging( false );
		};

		window.addEventListener( 'mousemove', handleMouseMove );
		window.addEventListener( 'mouseup', handleMouseUp );

		return () => {
			window.removeEventListener( 'mousemove', handleMouseMove );
			window.removeEventListener( 'mouseup', handleMouseUp );
		};
	}, [ isDragging, startX, startValue, unit, onChange ] );

	const handleWheel = ( e ) => {
		if ( disabled ) {
			return;
		}
		e.preventDefault();
		const parsed = parseValue( value );
		let multiplier = 1;
		if ( e.shiftKey ) {
			multiplier = 10;
		} else if ( e.altKey || e.metaKey ) {
			multiplier = 0.1;
		}
		const delta = e.deltaY < 0 ? 1 : -1;
		const newValue = parsed.num + delta * multiplier;
		const formattedValue = newValue.toFixed( 1 ).replace( /\.0$/, '' );
		onChange( {
			target: { value: `${ formattedValue }${ parsed.strUnit }` },
		} );
	};

	return (
		<input
			id={ id }
			type="text"
			disabled={ disabled }
			placeholder={ placeholder }
			value={ value }
			onChange={ onChange }
			onMouseDown={ handleMouseDown }
			onWheel={ handleWheel }
			style={ { cursor: isDragging ? 'ew-resize' : 'text' } }
		/>
	);
}

function MappedStyleControls( {
	styleSet,
	inheritedMapped,
	effectiveMapped,
	effectiveBindings,
	designTokens,
	breakpoint,
	panelMode,
	searchQuery,
	parentDisplayValue,
	onApply,
	onLinkToken,
	onRemoveToken,
	onOverrideToken,
	allowedProperties,
} ) {
	const allowedPropertySet = new Set( allowedProperties || [] );
	const currentValues = Object.fromEntries(
		STYLE_CONTROL_FIELDS.map( ( field ) => [
			field.property,
			styleSet.mapped[ field.property ] || '',
		] )
	);
	const [ values, setValues ] = useState( currentValues );
	const [ error, setError ] = useState( '' );

	const changed = STYLE_CONTROL_FIELDS.some(
		( field ) =>
			values[ field.property ] !== currentValues[ field.property ]
	);

	function applyStyles() {
		const normalized = {};
		for ( const field of STYLE_CONTROL_FIELDS ) {
			const value = values[ field.property ].trim();
			if ( value && ! window.CSS.supports( field.property, value ) ) {
				setError( `${ field.label } is not a valid CSS value.` );
				return;
			}
			normalized[ field.property ] = value;
		}

		onApply( normalized );
		setValues( normalized );
		setError( '' );
	}

	const TAXONOMY_GROUPS = [
		{
			title: 'Layout & Sizing',
			fields: [
				'display',
				'width',
				'height',
				'max-width',
				'min-height',
				'padding',
				'margin',
				'flex-direction',
				'flex-wrap',
				'justify-content',
				'align-items',
				'align-content',
				'gap',
				'row-gap',
				'column-gap',
				'grid-template-columns',
				'grid-template-rows',
				'flex-grow',
				'flex-shrink',
				'flex-basis',
				'align-self',
				'order',
				'grid-column',
				'grid-row',
				'position',
				'top',
				'right',
				'bottom',
				'left',
				'z-index',
				'overflow',
			],
		},
		{
			title: 'Typography',
			fields: [
				'font-family',
				'font-size',
				'font-weight',
				'line-height',
				'letter-spacing',
				'text-transform',
				'text-decoration',
				'text-shadow',
				'-webkit-text-stroke',
			],
		},
		{
			title: 'Borders',
			fields: [
				'border',
				'border-top',
				'border-right',
				'border-bottom',
				'border-left',
				'border-radius',
			],
		},
		{
			title: 'Backgrounds & Images',
			fields: [
				'background',
				'background-color',
				'background-image',
				'background-size',
				'background-position',
				'object-fit',
				'object-position',
			],
		},
		{
			title: 'Effects',
			fields: [
				'box-shadow',
				'opacity',
				'filter',
				'backdrop-filter',
				'transform',
			],
		},
	];

	// Ensure all fields are covered
	const mappedGroups = TAXONOMY_GROUPS.map( ( group ) => {
		return {
			...group,
			fieldObjs: group.fields
				.map( ( fp ) =>
					STYLE_CONTROL_FIELDS.find( ( f ) => f.property === fp )
				)
				.filter(
					( field ) =>
						Boolean( field ) &&
						( ! allowedProperties ||
							allowedPropertySet.has( field.property ) )
				),
		};
	} );

	return (
		<div className="ctb-mapped-style-controls">
			<p className="ctb-style-group-title">
				{ breakpoint === 'desktop'
					? 'Base mapped controls'
					: `${ breakpoint } overrides` }
			</p>
			{ mappedGroups.map( ( group, groupIdx ) => {
				const renderedFields = group.fieldObjs
					.map( ( field ) => {
						const reference =
							effectiveBindings[ field.property ] || '';
						const roleSource = roleBindingForProperty(
							styleSet,
							field.property
						);
						const linked = Boolean(
							reference &&
								effectiveMapped[ field.property ] ===
									tokenCssValue( reference )
						);
						const displayVal =
							values.display || effectiveMapped.display || '';
						const visible = isMappedControlVisible(
							field.property,
							displayVal,
							parentDisplayValue,
							panelMode,
							searchQuery,
							field
						);
						const reason = controlVisibilityReason(
							field.property,
							displayVal,
							parentDisplayValue,
							panelMode,
							field
						);
						if ( ! visible ) {
							if (
								String( searchQuery || '' ).trim() ||
								( panelMode === 'simple' &&
									field.tier === 'advanced' )
							) {
								return null;
							}
							return (
								<div
									key={ field.property }
									className="ctb-mapped-style-field is-hidden-by-layout"
									style={ { opacity: 0.55 } }
								>
									<label
										htmlFor={ `ctb-${ breakpoint }-${ field.property }` }
									>
										<span>
											{ field.label }{ ' ' }
											<small
												style={ {
													background: '#fff8df',
													border: '1px solid #d8a77a',
													padding: '1px 4px',
													borderRadius: '999px',
												} }
											>
												{ reason }
											</small>
										</span>
										<input
											id={ `ctb-${ breakpoint }-${ field.property }` }
											type="text"
											disabled
											placeholder={ reason }
											value={ values[ field.property ] }
											onChange={ () => {} }
										/>
									</label>
								</div>
							);
						}
						return (
							<div
								key={ field.property }
								className="ctb-mapped-style-field"
							>
								<label
									htmlFor={ `ctb-${ breakpoint }-${ field.property }` }
								>
									<span>
										{ field.label }
										{ breakpoint !== 'desktop' &&
										! currentValues[ field.property ] &&
										inheritedMapped[ field.property ] ? (
											<small>Inherited</small>
										) : null }
									</span>
									{ field.options ? (
										<select
											id={ `ctb-${ breakpoint }-${ field.property }` }
											disabled={ linked && ! roleSource }
											value={
												values[ field.property ] || ''
											}
											onChange={ ( event ) =>
												setValues( {
													...values,
													[ field.property ]:
														event.target.value,
												} )
											}
										>
											<option value="">
												{ breakpoint !== 'desktop' &&
												inheritedMapped[
													field.property
												]
													? `Inherits ${
															inheritedMapped[
																field.property
															]
													  }`
													: field.placeholder ||
													  'Default' }
											</option>
											{ field.options.map( ( opt ) => (
												<option
													key={ opt }
													value={ opt }
												>
													{ opt }
												</option>
											) ) }
										</select>
									) : (
										<ScrubbableInput
											id={ `ctb-${ breakpoint }-${ field.property }` }
											disabled={ linked && ! roleSource }
											placeholder={
												breakpoint !== 'desktop' &&
												inheritedMapped[
													field.property
												]
													? `Inherits ${
															inheritedMapped[
																field.property
															]
													  }`
													: field.placeholder
											}
											value={ values[ field.property ] }
											onChange={ ( event ) =>
												setValues( {
													...values,
													[ field.property ]:
														event.target.value,
												} )
											}
										/>
									) }
								</label>
								<TokenBindingControl
									designTokens={ designTokens }
									property={ field.property }
									breakpoint={ breakpoint }
									styleSet={ styleSet }
									effectiveMapped={ effectiveMapped }
									effectiveBindings={ effectiveBindings }
									onLink={ onLinkToken }
									onRemove={ onRemoveToken }
									onOverride={ onOverrideToken }
								/>
							</div>
						);
					} )
					.filter( Boolean );

				if ( ! renderedFields.length ) {
					return null;
				}

				// Always open the first group or if searching
				const shouldOpen =
					groupIdx === 0 ||
					Boolean( String( searchQuery || '' ).trim() );

				return (
					<details
						key={ group.title }
						className="ctb-taxonomy-group"
						style={ {
							marginBottom: '8px',
							border: '1px solid #d1cdc1',
							borderRadius: '4px',
							background: '#fff',
						} }
						open={ shouldOpen }
					>
						<summary
							style={ {
								padding: '8px 12px',
								fontSize: '11px',
								fontWeight: 700,
								cursor: 'pointer',
								background: '#f8f7f3',
								borderBottom: '1px solid #e8e5db',
							} }
						>
							{ group.title }
						</summary>
						<div style={ { padding: '8px 12px' } }>
							{ renderedFields }
						</div>
					</details>
				);
			} ) }
			<button
				type="button"
				disabled={ ! changed }
				onClick={ applyStyles }
			>
				Apply { breakpoint } styles
			</button>
			{ error ? (
				<p className="ctb-mapped-style-error" role="alert">
					{ error }
				</p>
			) : null }
		</div>
	);
}

function ScriptDetections( { detections, onMap } ) {
	if ( ! detections.length ) {
		return null;
	}
	const labels = {
		recognized: 'Recognized / confirmation required',
		mapped: 'Mapped action',
		unverified: 'Unverified / not executable',
		preserved: 'Preserved / Preview and Publish only',
		blocked: 'Preserved / disabled by permission',
	};
	const contextFor = ( detection ) => {
		if ( detection.status === 'unverified' ) {
			return (
				<p>
					Attached to <code>{ detection.attachedBlockId }</code> for
					manual review only.
				</p>
			);
		}
		if ( [ 'recognized', 'mapped' ].includes( detection.status ) ) {
			return (
				<p>
					Source <code>{ detection.sourceBlockId }</code>
					{ ' -> ' }target <code>{ detection.targetBlockId }</code>
				</p>
			);
		}
		if ( detection.status === 'blocked' ) {
			return (
				<p>
					Preserved for review, but execution requires the WordPress
					<code>unfiltered_html</code> capability.
				</p>
			);
		}
		return (
			<p>
				Disabled in the editor iframe. Execution is limited to the
				separate opener-detached WordPress page.
			</p>
		);
	};

	return (
		<section
			className="ctb-script-detections"
			aria-label="Detected JavaScript"
		>
			<div className="ctb-script-detections-heading">
				<strong>Detected JavaScript</strong>
				<span>
					{ detections.length } script
					{ detections.length === 1 ? '' : 's' }
				</span>
			</div>
			{ detections.map( ( detection ) => (
				<article
					key={ detection.id }
					className={ `ctb-script-detection is-${ detection.status }` }
				>
					<div>
						<span className="ctb-script-status">
							{ labels[ detection.status ] }
						</span>
						<p>{ detection.description }</p>
						{ contextFor( detection ) }
					</div>
					<pre>{ detection.code }</pre>
					{ detection.status === 'recognized' ? (
						<button
							type="button"
							onClick={ () => onMap( detection ) }
						>
							Confirm and map action
						</button>
					) : null }
				</article>
			) ) }
		</section>
	);
}

function PhpDetection( { detection, onRegister } ) {
	const [ confirmation, setConfirmation ] = useState( '' );
	const [ message, setMessage ] = useState( '' );
	const [ registering, setRegistering ] = useState( false );
	const phrase = detection.confirmationPhrase || '';
	const canRegister = detection.status === 'safe' && confirmation === phrase;

	async function register() {
		setRegistering( true );
		setMessage( 'Repeating server scan and registering...' );
		try {
			await onRegister( detection, confirmation );
			setMessage( `Registered ${ detection.shortcode }.` );
		} catch ( error ) {
			setMessage( error.message || 'Registration failed.' );
		} finally {
			setRegistering( false );
		}
	}

	const labels = {
		pending: 'Awaiting server review',
		reviewing: 'Server review in progress',
		safe: 'Passed scan / confirmation required',
		warning: 'Strong warning / cannot register',
		blocked: 'Blocked / cannot register',
		registered: 'Registered after confirmation',
		unavailable: 'Registration unavailable',
		error: 'Review failed',
	};

	return (
		<article className={ `ctb-php-detection is-${ detection.status }` }>
			<div className="ctb-php-review-summary">
				<span className="ctb-php-status">
					{ labels[ detection.status ] || detection.status }
				</span>
				<p>{ detection.description }</p>
				<p>
					Canvas placeholder: <code>{ detection.shortcode }</code>
				</p>
				{ detection.blockedReasons?.length ? (
					<ul className="ctb-php-reasons">
						{ detection.blockedReasons.map( ( reason ) => (
							<li key={ reason }>{ reason }</li>
						) ) }
					</ul>
				) : null }
				{ detection.warnings?.length ? (
					<ul className="ctb-php-warnings">
						{ detection.warnings.map( ( warning ) => (
							<li key={ warning }>{ warning }</li>
						) ) }
					</ul>
				) : null }
			</div>
			<div>
				<p className="ctb-php-code-label">Full detected PHP</p>
				<pre>{ detection.code }</pre>
			</div>
			{ detection.status === 'safe' ? (
				<div className="ctb-php-confirmation">
					<p>
						This grants the snippet PHP execution privileges
						whenever <code>{ detection.shortcode }</code> is
						rendered.
					</p>
					<label htmlFor={ `ctb-php-confirm-${ detection.id }` }>
						Type <code>{ phrase }</code>
						<input
							id={ `ctb-php-confirm-${ detection.id }` }
							type="text"
							autoComplete="off"
							value={ confirmation }
							onChange={ ( event ) =>
								setConfirmation( event.target.value )
							}
						/>
					</label>
					<button
						type="button"
						disabled={ ! canRegister || registering }
						onClick={ register }
					>
						Confirm and register shortcode
					</button>
					{ message ? <p role="status">{ message }</p> : null }
				</div>
			) : null }
			{ detection.status === 'registered' ? (
				<p className="ctb-php-registered" role="status">
					Registered only after the server repeated its scan and
					matched the reviewed source hash.
				</p>
			) : null }
		</article>
	);
}

function PhpDetections( { detections, onRegister } ) {
	if ( ! detections.length ) {
		return null;
	}

	return (
		<section className="ctb-php-detections" aria-label="Detected PHP">
			<div className="ctb-php-detections-heading">
				<div>
					<strong>Detected PHP</strong>
					<p>
						Static review reduces obvious risk; it is not a PHP
						sandbox.
					</p>
				</div>
				<span>
					{ detections.length } block
					{ detections.length === 1 ? '' : 's' }
				</span>
			</div>
			{ detections.map( ( detection ) => (
				<PhpDetection
					key={ detection.tag }
					detection={ detection }
					onRegister={ onRegister }
				/>
			) ) }
		</section>
	);
}

function BlockDynamicControl( { block, onChange } ) {
	const handleToggle = ( event ) => {
		const isDynamic = event.target.checked;
		onChange(
			block.id,
			isDynamic,
			isDynamic ? 'wc_product_title' : undefined
		);
	};

	const handleSourceChange = ( event ) => {
		onChange( block.id, true, event.target.value );
	};

	return (
		<div className="ctb-slot-control">
			<label className="ctb-slot-toggle">
				<input
					type="checkbox"
					checked={ !! block.is_dynamic }
					onChange={ handleToggle }
				/>
				<span>Bind to WooCommerce data</span>
			</label>
			{ block.is_dynamic ? (
				<label
					className="ctb-slot-label-input"
					style={ { marginTop: '8px' } }
				>
					<span>Data Source</span>
					<select
						value={ block.dynamic_source || '' }
						onChange={ handleSourceChange }
						style={ {
							width: '100%',
							marginTop: '4px',
							padding: '4px',
						} }
					>
						<option value="wc_product_title">Product Title</option>
						<option value="wc_product_price">Product Price</option>
						<option value="wc_product_short_description">
							Short Description
						</option>
						<option value="wc_product_stock_status">
							Stock Status
						</option>
						{ block.tag === 'img' && (
							<option value="wc_product_image">
								Product Image
							</option>
						) }
					</select>
				</label>
			) : null }
		</div>
	);
}

function BlockSlotControl( { block, onChange } ) {
	const canBeSlot = [ 'text', 'image', 'button' ].includes( block.type );
	if ( ! canBeSlot ) {
		return null;
	}

	const handleToggle = ( event ) => {
		const isSlot = event.target.checked;
		let defaultType = 'text';
		if ( block.type === 'image' ) {
			defaultType = 'image';
		}
		if ( block.type === 'button' ) {
			defaultType = 'link';
		}

		onChange(
			block.id,
			isSlot,
			isSlot ? block.slot_label || 'New Slot' : undefined,
			isSlot ? defaultType : undefined
		);
	};

	const handleLabelChange = ( event ) => {
		onChange( block.id, true, event.target.value, block.slot_content_type );
	};

	const handleTypeChange = ( event ) => {
		onChange( block.id, true, block.slot_label, event.target.value );
	};

	return (
		<div className="ctb-slot-control">
			<p className="ctb-style-group-title">Client Content</p>
			<label className="ctb-slot-toggle">
				<input
					type="checkbox"
					checked={ !! block.is_content_slot }
					onChange={ handleToggle }
				/>
				<span>Make editable for clients</span>
			</label>
			{ block.is_content_slot ? (
				<>
					<label className="ctb-slot-label-input">
						<span>Slot label</span>
						<input
							type="text"
							value={ block.slot_label || '' }
							onChange={ handleLabelChange }
							placeholder="e.g. Hero Headline"
						/>
					</label>
					<label className="ctb-slot-label-input">
						<span>Content type</span>
						{ block.type === 'text' ? (
							<select
								value={ block.slot_content_type || 'text' }
								onChange={ handleTypeChange }
							>
								<option value="text">text</option>
								<option value="rich_text">rich_text</option>
							</select>
						) : (
							<input
								type="text"
								value={ block.slot_content_type || '' }
								disabled
							/>
						) }
					</label>
					<small
						style={ {
							color: '#686355',
							fontSize: '9px',
							marginTop: '4px',
							display: 'block',
						} }
					>
						{ block.type === 'text'
							? 'text = single line, rich_text = multi-line'
							: block.type === 'image'
							? 'image = URL to src'
							: 'link = URL to href' }
					</small>
				</>
			) : null }
		</div>
	);
}

const GSAP_ANIMATION_BEHAVIORS = new Set( [
	'scroll-scrub',
	'stagger-sequence',
] );
const CSS_ANIMATION_BEHAVIORS = new Set( [ 'css-reveal' ] );
let editorGsapPromise;

function loadEditorGsap() {
	if ( ! editorGsapPromise ) {
		editorGsapPromise = Promise.all( [
			import( 'gsap' ),
			import( 'gsap/ScrollTrigger' ),
		] ).then( ( [ core, plugin ] ) => {
			core.gsap.registerPlugin( plugin.ScrollTrigger );
			return { gsap: core.gsap, ScrollTrigger: plugin.ScrollTrigger };
		} );
	}
	return editorGsapPromise;
}

function documentHasGsapAnimation( block ) {
	if (
		block.actions?.some(
			( action ) =>
				action.animation_type === 'js_library' &&
				GSAP_ANIMATION_BEHAVIORS.has( action.behavior )
		)
	) {
		return true;
	}
	return ( block.children || [] ).some(
		( child ) => child.kind !== 'text' && documentHasGsapAnimation( child )
	);
}

function defaultGsapAction( behavior, blockId ) {
	if ( behavior === 'css-reveal' ) {
		return {
			trigger: 'load',
			behavior,
			animation_type: 'css_native',
			params: {
				target_block_id: blockId,
				duration: 0.6,
				delay: 0,
				from_y: 30,
			},
		};
	}
	const common = {
		trigger: 'scroll',
		behavior,
		animation_type: 'js_library',
		params: {
			target_block_id: blockId,
			start: 'top 85%',
			ease: behavior === 'scroll-scrub' ? 'none' : 'power2.out',
			from_x: 0,
			from_y: 40,
			from_opacity: 0,
			from_scale: 1,
			from_rotation: 0,
		},
	};
	if ( behavior === 'scroll-scrub' ) {
		Object.assign( common.params, {
			end: 'bottom 20%',
			scrub: 1,
			to_x: 0,
			to_y: 0,
			to_opacity: 1,
			to_scale: 1,
			to_rotation: 0,
		} );
	} else {
		Object.assign( common.params, { duration: 0.6, stagger: 0.12 } );
	}
	return common;
}

function BlockAnimationControl( { block } ) {
	const addBlockAction = useEditorStore( ( state ) => state.addBlockAction );
	const updateBlockAction = useEditorStore(
		( state ) => state.updateBlockAction
	);
	const removeBlockAction = useEditorStore(
		( state ) => state.removeBlockAction
	);
	const animations = ( block.actions || [] )
		.map( ( action, index ) => ( { action, index } ) )
		.filter(
			( item ) =>
				GSAP_ANIMATION_BEHAVIORS.has( item.action.behavior ) ||
				CSS_ANIMATION_BEHAVIORS.has( item.action.behavior )
		);

	function updateParam( index, action, key, value ) {
		updateBlockAction( block.id, index, {
			...action,
			params: { ...action.params, [ key ]: value },
		} );
	}

	const numberFields = {
		'scroll-scrub': [
			[ 'scrub', 'Scrub smoothing', 0.1 ],
			[ 'from_y', 'From Y', 1 ],
			[ 'to_y', 'To Y', 1 ],
			[ 'from_opacity', 'From opacity', 0.05 ],
			[ 'to_opacity', 'To opacity', 0.05 ],
			[ 'from_scale', 'From scale', 0.05 ],
			[ 'to_scale', 'To scale', 0.05 ],
			[ 'from_rotation', 'From rotation', 1 ],
			[ 'to_rotation', 'To rotation', 1 ],
		],
		'stagger-sequence': [
			[ 'duration', 'Duration', 0.05 ],
			[ 'stagger', 'Stagger delay', 0.01 ],
			[ 'from_y', 'From Y', 1 ],
			[ 'from_opacity', 'From opacity', 0.05 ],
			[ 'from_scale', 'From scale', 0.05 ],
			[ 'from_rotation', 'From rotation', 1 ],
		],
		'css-reveal': [
			[ 'duration', 'Duration', 0.05 ],
			[ 'delay', 'Delay', 0.05 ],
			[ 'from_y', 'From Y', 1 ],
		],
	};

	return (
		<section
			className="ctb-block-actions"
			aria-label={ `Animations for ${ block.id }` }
		>
			<p className="ctb-style-group-title">Motion</p>
			<p>
				CSS reveal adds no JavaScript. Scroll and stagger load GSAP and
				ScrollTrigger only on pages that use them.
			</p>
			<div className="ctb-structure-controls">
				<button
					type="button"
					disabled={ animations.some(
						( item ) => item.action.behavior === 'css-reveal'
					) }
					onClick={ () =>
						addBlockAction(
							block.id,
							defaultGsapAction( 'css-reveal', block.id )
						)
					}
				>
					Add CSS reveal
				</button>
				<button
					type="button"
					disabled={ animations.some(
						( item ) => item.action.behavior === 'scroll-scrub'
					) }
					onClick={ () =>
						addBlockAction(
							block.id,
							defaultGsapAction( 'scroll-scrub', block.id )
						)
					}
				>
					Add scroll scrub
				</button>
				<button
					type="button"
					disabled={ animations.some(
						( item ) => item.action.behavior === 'stagger-sequence'
					) }
					onClick={ () =>
						addBlockAction(
							block.id,
							defaultGsapAction( 'stagger-sequence', block.id )
						)
					}
				>
					Add child stagger
				</button>
			</div>
			{ animations.map( ( { action, index } ) => (
				<div
					className="ctb-block-action"
					key={ `${ action.behavior }:${ index }` }
				>
					<strong>
						{ action.behavior === 'scroll-scrub'
							? 'Scroll scrub'
							: action.behavior === 'stagger-sequence'
							? 'Stagger children'
							: 'CSS reveal' }
					</strong>
					{ action.behavior !== 'css-reveal' ? (
						<label className="ctb-slot-label-input">
							<span>Start</span>
							<select
								value={ action.params.start }
								onChange={ ( event ) =>
									updateParam(
										index,
										action,
										'start',
										event.target.value
									)
								}
							>
								<option value="top bottom">
									Top enters viewport
								</option>
								<option value="top 85%">Top reaches 85%</option>
								<option value="top center">
									Top reaches center
								</option>
								<option value="center center">
									Centers align
								</option>
							</select>
						</label>
					) : null }
					{ action.behavior === 'scroll-scrub' ? (
						<label className="ctb-slot-label-input">
							<span>End</span>
							<select
								value={ action.params.end }
								onChange={ ( event ) =>
									updateParam(
										index,
										action,
										'end',
										event.target.value
									)
								}
							>
								<option value="bottom top">
									Bottom leaves viewport
								</option>
								<option value="bottom 20%">
									Bottom reaches 20%
								</option>
								<option value="+=500">
									500px scroll distance
								</option>
								<option value="+=1000">
									1000px scroll distance
								</option>
							</select>
						</label>
					) : null }
					{ action.behavior !== 'css-reveal' ? (
						<label className="ctb-slot-label-input">
							<span>Ease</span>
							<select
								value={ action.params.ease }
								onChange={ ( event ) =>
									updateParam(
										index,
										action,
										'ease',
										event.target.value
									)
								}
							>
								<option value="none">None</option>
								<option value="power1.out">Power 1</option>
								<option value="power2.out">Power 2</option>
								<option value="power3.out">Power 3</option>
							</select>
						</label>
					) : null }
					<div className="ctb-mapped-style-controls">
						{ numberFields[ action.behavior ].map(
							( [ key, label, step ] ) => (
								<label
									className="ctb-mapped-style-field"
									key={ key }
								>
									<span>{ label }</span>
									<input
										type="number"
										step={ step }
										value={ action.params[ key ] }
										onChange={ ( event ) =>
											updateParam(
												index,
												action,
												key,
												Number( event.target.value )
											)
										}
									/>
								</label>
							)
						) }
					</div>
					<button
						type="button"
						onClick={ () => removeBlockAction( block.id, index ) }
					>
						Remove animation
					</button>
				</div>
			) ) }
		</section>
	);
}

function BlockActions( { block } ) {
	const actions = ( block.actions || [] ).filter(
		( action ) =>
			! GSAP_ANIMATION_BEHAVIORS.has( action.behavior ) &&
			! CSS_ANIMATION_BEHAVIORS.has( action.behavior )
	);
	if ( ! actions.length ) {
		return null;
	}

	return (
		<section
			className="ctb-block-actions"
			aria-label={ `Actions for ${ block.id }` }
		>
			<p className="ctb-style-group-title">Action bindings</p>
			{ actions.map( ( action, index ) => {
				const unverified = action.behavior === 'unverified-script';
				return (
					<div
						key={ `${ action.trigger }:${ action.behavior }:${ index }` }
						className={ `ctb-block-action${
							unverified ? ' is-unverified' : ''
						}` }
					>
						<strong>
							{ unverified
								? 'Unverified script / never executed'
								: `${ action.trigger } -> ${ action.behavior }` }
						</strong>
						{ unverified ? (
							<>
								<p>{ action.params.description }</p>
								<pre>{ action.params.code }</pre>
							</>
						) : (
							<p>
								Target{ ' ' }
								<code>{ action.params.target_block_id }</code>
								{ action.params.class_name
									? ` / .${ action.params.class_name }`
									: '' }
							</p>
						) }
					</div>
				);
			} ) }
		</section>
	);
}

function Editor() {
	const editorSettings = window.codeToBlockEditorSettings || {};
	const document = useEditorStore( ( state ) => state.document );
	const setDocument = useEditorStore( ( state ) => state.setDocument );
	const resetDocument = useEditorStore( ( state ) => state.resetDocument );
	const syncSavedTree = useEditorStore(
		( state ) => state.syncSavedDocument
	);
	const markSavedTree = useEditorStore(
		( state ) => state.markSavedSnapshot
	);
	const undo = useEditorStore( ( state ) => state.undo );
	const redo = useEditorStore( ( state ) => state.redo );
	const canUndo = useEditorStore( ( state ) => state.past.length > 0 );
	const canRedo = useEditorStore( ( state ) => state.future.length > 0 );
	const moveBlock = useEditorStore( ( state ) => state.moveBlock );
	const moveSelectedBlock = useEditorStore(
		( state ) => state.moveBlockSibling
	);
	const insertWooCommerceBlock = useEditorStore(
		( state ) => state.insertWooCommerceBlock
	);
	const selectBlock = useEditorStore( ( state ) => state.selectBlock );
	const setBlockHidden = useEditorStore( ( state ) => state.setBlockHidden );
	const updateBlockContent = useEditorStore(
		( state ) => state.updateBlockContent
	);
	const updateBlockAttribute = useEditorStore(
		( state ) => state.updateBlockAttribute
	);
	const updateBlockProp = useEditorStore(
		( state ) => state.updateBlockProp
	);
	const updateBlockTag = useEditorStore( ( state ) => state.updateBlockTag );
	const setBlockVisibilityConditions = useEditorStore(
		( state ) => state.setBlockVisibilityConditions
	);
	const setBlockStateStyles = useEditorStore(
		( state ) => state.setBlockStateStyles
	);
	const setBlockPermissions = useEditorStore(
		( state ) => state.setBlockPermissions
	);
	const setBlockPerformance = useEditorStore(
		( state ) => state.setBlockPerformance
	);
	const insertPrimitive = useEditorStore(
		( state ) => state.insertPrimitive
	);
	const selectedBlockId = useEditorStore(
		( state ) => state.selectedBlockId
	);
	const updateBlockColor = useEditorStore(
		( state ) => state.updateBlockColor
	);
	const updateBlockCustomCss = useEditorStore(
		( state ) => state.updateBlockCustomCss
	);
	const updateBlockMappedStyles = useEditorStore(
		( state ) => state.updateBlockMappedStyles
	);
	const replaceBlockStyleSet = useEditorStore(
		( state ) => state.replaceBlockStyleSet
	);
	const upsertDesignToken = useEditorStore(
		( state ) => state.upsertDesignToken
	);
	const deleteDesignToken = useEditorStore(
		( state ) => state.deleteDesignToken
	);
	const setBlockTokenBinding = useEditorStore(
		( state ) => state.setBlockTokenBinding
	);
	const removeBlockTokenBinding = useEditorStore(
		( state ) => state.removeBlockTokenBinding
	);
	const setBlockStyleRole = useEditorStore(
		( state ) => state.setBlockStyleRole
	);
	const adjustBlockStyleRole = useEditorStore(
		( state ) => state.adjustBlockStyleRole
	);
	const setBlockRolePropertyOverride = useEditorStore(
		( state ) => state.setBlockRolePropertyOverride
	);
	const rejoinBlockRoleProperty = useEditorStore(
		( state ) => state.rejoinBlockRoleProperty
	);
	const resolveBlockImportReview = useEditorStore(
		( state ) => state.resolveBlockImportReview
	);
	const rejoinGuidedRoleOverride = useEditorStore(
		( state ) => state.rejoinGuidedRoleOverride
	);
	const updateGuidedRoleProperty = useEditorStore(
		( state ) => state.updateGuidedRoleProperty
	);
	const restoreGuidedRole = useEditorStore(
		( state ) => state.restoreGuidedRole
	);
	const setEditorContext = useEditorStore(
		( state ) => state.setEditorContext
	);
	const setBlockSlotProperties = useEditorStore(
		( state ) => state.setBlockSlotProperties
	);
	const setBlockDynamicProperties = useEditorStore(
		( state ) => state.setBlockDynamicProperties
	);
	const addBlockAction = useEditorStore( ( state ) => state.addBlockAction );
	const duplicateBlock = useEditorStore( ( state ) => state.duplicateBlock );
	const deleteBlock = useEditorStore( ( state ) => state.deleteBlock );
	const addInnerContainer = useEditorStore(
		( state ) => state.addInnerContainer
	);
	const convertLayoutMode = useEditorStore(
		( state ) => state.convertLayoutMode
	);
	const insertForm = useEditorStore( ( state ) => state.insertForm );
	const insertFormField = useEditorStore(
		( state ) => state.insertFormField
	);
	const updateFormField = useEditorStore(
		( state ) => state.updateFormField
	);
	const updateFormSettings = useEditorStore(
		( state ) => state.updateFormSettings
	);
	const insertWidget = useEditorStore( ( state ) => state.insertWidget );
	const [ activeId, setActiveId ] = useState( null );
	const [ dropIntent, setDropIntent ] = useState( null );
	const dropIntentRef = useRef( null );
	const [ activeState, setActiveState ] = useState( 'default' );
	const [ isImporterOpen, setIsImporterOpen ] = useState( false );
	const [ isRevisionsOpen, setIsRevisionsOpen ] = useState( false );
	const [ paletteDragging, setPaletteDragging ] = useState( null );
	useEffect( () => {
		if ( ! paletteDragging && ! activeId && dropIntentRef.current ) {
			clearDropIntent();
		}
	}, [ activeId, paletteDragging ] );
	const [ customAttributeName, setCustomAttributeName ] = useState( '' );
	const [ customAttributeValue, setCustomAttributeValue ] = useState( '' );
	const [ unifiedInput, setUnifiedInput ] = useState( '' );
	const [ parseError, setParseError ] = useState( '' );
	const [ importActivity, setImportActivity ] = useState(
		'Paste code, then choose Display in Builder.'
	);
	const liveImportStartedRef = useRef( false );
	const liveImportTimerRef = useRef( null );
	const lastImportedInputRef = useRef( '' );
	const applyImportedCodeRef = useRef( null );
	const importAnalysisRequestRef = useRef( 0 );
	const [ documentLoading, setDocumentLoading ] = useState( true );
	const [ parseWarnings, setParseWarnings ] = useState( [] );
	const [ importReview, setImportReview ] = useState( null );
	const [ scriptDetections, setScriptDetections ] = useState( [] );
	const [ phpDetections, setPhpDetections ] = useState( [] );
	const [ persistenceStatus, setPersistenceStatus ] = useState( '' );
	const [ previewBreakpoint, setPreviewBreakpoint ] = useState( 'desktop' );
	const [ components, setComponents ] = useState( [] );
	const [ , setComponentsLoading ] = useState( false );
	const updateWooSettings = useEditorStore(
		( state ) => state.updateWooSettings
	);
	const [ commerceProducts, setCommerceProducts ] = useState( [] );
	const [ cartHtml, setCartHtml ] = useState( '' );
	const [ checkoutHtml, setCheckoutHtml ] = useState( '' );
	const [ commerceAvailable, setCommerceAvailable ] = useState( false );
	const [ commerceLoading, setCommerceLoading ] = useState( false );
	const [ parityWarnings, setParityWarnings ] = useState( [] );
	const [ a11yIssues, setA11yIssues ] = useState( [] );
	const [ editorAction, setEditorAction ] = useState( '' );
	const [ postStatus, setPostStatus ] = useState(
		editorSettings.postStatus || 'draft'
	);
	const [ serverVersion, setServerVersion ] = useState(
		editorSettings.serverVersion || ''
	);
	const [ lastSavedContentHash, setLastSavedContentHash ] = useState( '' );
	const [ hasNewerAutosave, setHasNewerAutosave ] = useState( false );
	const postId = Number( editorSettings.postId || 0 );

	async function recoverAutosave() {
		try {
			setPersistenceStatus( 'Recovering autosave...' );
			const revisionsResponse = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/revisions`,
			} );
			const autosaveRev = revisionsResponse.revisions.find(
				( r ) => r.is_autosave
			);
			if ( autosaveRev ) {
				const restoreResponse = await apiFetch( {
					path: `/code-to-block/v1/pages/${ postId }/revisions/${ autosaveRev.id }/restore`,
					method: 'POST',
				} );
				resetDocument( restoreResponse.document );
				setHasNewerAutosave( false );
				setPersistenceStatus(
					'Autosave recovered. Save to keep these changes.'
				);
			} else {
				setPersistenceStatus( 'No autosave found to recover.' );
				setHasNewerAutosave( false );
			}
		} catch ( e ) {
			setPersistenceStatus( 'Failed to recover autosave.' );
		}
	}

	const isDirty =
		lastSavedContentHash !== '' &&
		contentHash( document ) !== lastSavedContentHash;

	useEffect( () => {
		const checkDirty = () => isDirty;
		return installNavigationGuard( checkDirty );
	}, [ isDirty ] );

	const documentRef = useRef( document );
	const isDirtyRef = useRef( isDirty );
	useEffect( () => {
		documentRef.current = document;
		isDirtyRef.current = isDirty;
	}, [ document, isDirty ] );

	useEffect( () => {
		if ( ! postId ) {
			return;
		}
		const interval = setInterval( async () => {
			if ( isDirtyRef.current ) {
				const response = await autosaveDocument( {
					apiFetch,
					postId,
					document: documentRef.current,
				} );
				if ( response && response.success ) {
					const time = new Date().toLocaleTimeString( [], {
						hour: '2-digit',
						minute: '2-digit',
					} );
					setPersistenceStatus( `Autosaved at ${ time }` );
				}
			}
		}, 60000 );
		return () => clearInterval( interval );
	}, [ postId ] );

	const [ contextMenu, setContextMenu ] = useState( null );
	const [ clipboardBlock, setClipboardBlock ] = useState( null );
	const [ clipboardStyles, setClipboardStyles ] = useState( null );
	const [ pendingRoleEdit, setPendingRoleEdit ] = useState( null );
	const previewSnapshot = useRef( null );
	const [ activeTab, setActiveTab ] = useState( 'content' );
	useEffect( () => {
		if ( ! isImporterOpen ) {
			liveImportStartedRef.current = false;
			return undefined;
		}
		function closeImporter( event ) {
			if ( event.key === 'Escape' ) {
				setIsImporterOpen( false );
			}
		}
		window.addEventListener( 'keydown', closeImporter );
		return () => window.removeEventListener( 'keydown', closeImporter );
	}, [ isImporterOpen ] );
	useEffect( () => {
		setEditorContext(
			previewBreakpoint,
			activeTab === 'advanced' ? 'advanced' : 'simple'
		);
	}, [ activeTab, previewBreakpoint, setEditorContext ] );
	const sensors = useSensors(
		useSensor( PointerSensor, { activationConstraint: { distance: 3 } } ),
		useSensor( KeyboardSensor )
	);
	const viewDocument = materializeCommerce(
		materializeComponents( document, components ),
		commerceProducts,
		cartHtml,
		checkoutHtml,
		commerceLoading,
		postId
	);
	const needsEditorGsap = documentHasGsapAnimation( viewDocument.root );
	useEffect( () => {
		if ( needsEditorGsap ) {
			void loadEditorGsap();
		}
	}, [ needsEditorGsap ] );
	const blockCount = countBlocks( viewDocument.root );
	const previewStyles = buildPreviewStyles( viewDocument, previewBreakpoint );
	const activeBlock = activeId ? findBlock( document.root, activeId ) : null;
	const selectedBlock =
		findBlock( document.root, selectedBlockId ) || document.root;
	const selectedParentBlock = ( () => {
		if ( selectedBlock.id === document.root.id ) {
			return null;
		}
		const findParent = ( b, tid ) => {
			for ( const ch of b.children || [] ) {
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
		return findParent( document.root, selectedBlock.id );
	} )();
	const selectedParentDisplay = selectedParentBlock
		? effectiveMappedStyles( selectedParentBlock, previewBreakpoint )
				.display || 'block'
		: 'block';
	const selectedInspector = resolveInspector( selectedBlock, {
		breakpoint: previewBreakpoint,
		state: activeState,
		parentDisplay: selectedParentDisplay,
	} );
	const selectedStyleSet = ownStyleSet( selectedBlock, previewBreakpoint );
	const selectedInheritedMapped = inheritedMappedStyles(
		selectedBlock,
		previewBreakpoint
	);
	const selectedEffectiveMapped = effectiveMappedStyles(
		selectedBlock,
		previewBreakpoint
	);
	const selectedEffectiveBindings = effectiveTokenBindings(
		selectedBlock,
		previewBreakpoint
	);
	const selectedColor = selectedEffectiveMapped.color || '#000000';
	const selectedOwnColor = selectedStyleSet.mapped.color || '';
	const selectedColorReference = selectedEffectiveBindings.color || '';
	const selectedColorToken = getDesignToken(
		document.design_tokens,
		selectedColorReference
	);
	const selectedColorLinked = Boolean(
		selectedColorReference &&
			selectedColor === tokenCssValue( selectedColorReference )
	);
	const selectedMappedStyleKey =
		STYLE_CONTROL_FIELDS.map(
			( field ) => selectedStyleSet.mapped[ field.property ] || ''
		).join( '|' ) + JSON.stringify( selectedStyleSet.role_bindings || {} );
	useEffect( () => {
		cancelGuidedRolePreview();
	}, [ selectedBlockId, activeTab, previewBreakpoint ] );
	const selectedOverrideCount = countStyleOverrides( selectedStyleSet );
	const activeBreakpoint = BREAKPOINTS.find(
		( breakpoint ) => breakpoint.id === previewBreakpoint
	);
	const selectedBreakpointSummary = breakpointStyleSummary(
		previewBreakpoint,
		selectedOverrideCount
	);
	const canMoveSelectedUp = canMoveBlock(
		document.root,
		selectedBlock.id,
		-1
	);
	const canMoveSelectedDown = canMoveBlock(
		document.root,
		selectedBlock.id,
		1
	);
	const getZoneForBlock = ( block ) => {
		if ( ! block ) {
			return 'EMPTY';
		}
		if ( block.is_content_slot ) {
			return 'SLOT';
		}
		if ( block.type === 'container' ) {
			return 'CONTAINER';
		}
		return 'WIDGET';
	};
	const handleBlockContextMenu = ( event, block ) => {
		event.preventDefault();
		event.stopPropagation();
		const zone = getZoneForBlock( block );
		setContextMenu( {
			x: event.clientX,
			y: event.clientY,
			blockId: block.id,
			zone,
		} );
		selectBlock( block.id );
	};
	const handleEmptyContextMenu = ( event ) => {
		if ( event.target.closest( '[data-ctb-block-id]' ) ) {
			return;
		}
		event.preventDefault();
		setContextMenu( {
			x: event.clientX,
			y: event.clientY,
			blockId: null,
			zone: 'EMPTY',
		} );
	};
	const handleContextAction = ( actionId ) => {
		const currentState = useEditorStore.getState();
		const currentSelectedBlockId = currentState.selectedBlockId;
		const currentDocument = currentState.document;

		const targetId = contextMenu?.blockId || currentSelectedBlockId;
		const targetBlock = targetId
			? findBlock( currentDocument.root, targetId )
			: null;
		switch ( actionId ) {
			case 'edit':
				if ( targetId ) {
					selectBlock( targetId );
				}
				break;
			case 'editSlotLabel':
				if ( targetId ) {
					selectBlock( targetId );
				}
				setPersistenceStatus(
					'Edit the Slot label in the Client Content panel.'
				);
				break;
			case 'duplicate':
				if ( targetId ) {
					duplicateBlock( targetId );
					setPersistenceStatus(
						'Block duplicated. Unsaved changes.'
					);
				}
				break;
			case 'delete':
				if ( targetId ) {
					deleteBlock( targetId );
					setPersistenceStatus( 'Block deleted. Unsaved changes.' );
				}
				break;
			case 'copy': {
				const src = targetBlock
					? JSON.parse( JSON.stringify( targetBlock ) )
					: null;
				if ( src ) {
					setClipboardBlock( src );
					setPersistenceStatus(
						'Block copied to internal clipboard.'
					);
				}
				break;
			}
			case 'paste': {
				if ( ! clipboardBlock ) {
					break;
				}
				// Paste after target as duplicate with new IDs (reuse duplicate logic via store: create paste by duplicating clipboard)
				const doc = JSON.parse( JSON.stringify( currentDocument ) );
				const used = new Set();
				const collect = ( b ) => {
					used.add( b.id );
					for ( const c of b.children || [] ) {
						if ( c.kind !== 'text' ) {
							collect( c );
						}
					}
				};
				collect( doc.root );
				const clone = JSON.parse( JSON.stringify( clipboardBlock ) );
				const remap = ( node, usedSet ) => {
					const old = node.id;
					node.id = `${ old }-paste-${ Date.now()
						.toString( 36 )
						.slice( -3 ) }`;
					while ( usedSet.has( node.id ) ) {
						node.id +=
							`-` + Math.random().toString( 36 ).slice( 2, 3 );
					}
					usedSet.add( node.id );
					if ( node.attributes?.id ) {
						node.attributes.id = `${ node.id }-dom`;
					}
					for ( const ch of node.children || [] ) {
						if ( ch.kind !== 'text' ) {
							remap( ch, usedSet );
						}
					}
				};
				remap( clone, used );
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
					return findParent( doc.root, targetId );
				} )();
				if ( parent ) {
					const idx = parent.children.findIndex(
						( c ) => c.kind !== 'text' && c.id === targetId
					);
					if ( -1 !== idx ) {
						parent.children.splice( idx + 1, 0, clone );
					} else {
						parent.children.push( clone );
					}
					// Use commit via store: we have no direct paste store method, so use setDocument via commitDocument helper
					// Instead, use the store's duplicate logic indirectly: setDocument via commitDocument
					const nextDoc = doc;
					// Directly use zustand commit
					const state = useEditorStore.getState();
					useEditorStore.setState( {
						document: nextDoc,
						past: [ ...state.past, state.document ],
						future: [],
					} );
					setPersistenceStatus(
						'Pasted after selection. Unsaved changes.'
					);
					selectBlock( clone.id );
				} else if ( ! targetId ) {
					// Empty canvas paste: add to root
					const root = doc.root;
					root.children.push( clone );
					const state = useEditorStore.getState();
					useEditorStore.setState( {
						document: doc,
						past: [ ...state.past, state.document ],
						future: [],
					} );
					setPersistenceStatus(
						'Pasted to canvas. Unsaved changes.'
					);
				}
				break;
			}
			case 'copyStyles': {
				if ( targetBlock ) {
					setClipboardStyles(
						JSON.parse( JSON.stringify( targetBlock.styles ) )
					);
					setPersistenceStatus( 'Styles copied.' );
				}
				break;
			}
			case 'pasteStyles': {
				if ( targetBlock && clipboardStyles ) {
					replaceBlockStyleSet(
						targetId,
						clipboardStyles,
						previewBreakpoint
					);
					setPersistenceStatus( 'Styles pasted. Unsaved changes.' );
				}
				break;
			}
			case 'saveComponent': {
				// Trigger save as reusable component for target block
				const name = window.prompt( 'Component name?' );
				if ( name && targetBlock ) {
					const prevSelected = selectedBlockId;
					selectBlock( targetId );
					// Use existing saveSelectedAsComponent flow (async)
					saveSelectedAsComponent( name )
						.then( ( msg ) => setPersistenceStatus( msg ) )
						.catch( ( e ) => setPersistenceStatus( e.message ) );
				}
				break;
			}
			case 'addInner':
				if ( targetId ) {
					addInnerContainer( targetId );
					setPersistenceStatus(
						'Inner container added. Unsaved changes.'
					);
				}
				break;
			case 'convertLayout': {
				if ( targetBlock ) {
					const cur = targetBlock.styles?.mapped?.display || 'block';
					const next =
						cur === 'flex'
							? 'grid'
							: cur === 'grid'
							? 'block'
							: 'flex';
					convertLayoutMode( targetId, next );
					setPersistenceStatus(
						`Layout converted to ${ next }. Unsaved changes.`
					);
				}
				break;
			}
			case 'addBlock': {
				// Add a simple container block to root
				const doc = JSON.parse( JSON.stringify( currentDocument ) );
				const newId = `ctb-add-${ Date.now().toString( 36 ) }`;
				doc.root.children.push( {
					id: newId,
					type: 'container',
					tag: 'div',
					attributes: { class: 'ctb-new-block' },
					children: [ { kind: 'text', value: 'New block' } ],
					styles: {
						mapped: { padding: '16px', border: '1px dashed #ccc' },
						custom_css_fallback: '',
					},
					meta: { source: 'editor' },
				} );
				const state = useEditorStore.getState();
				useEditorStore.setState( {
					document: doc,
					past: [ ...state.past, state.document ],
					future: [],
				} );
				setPersistenceStatus(
					'Block added to canvas. Unsaved changes.'
				);
				selectBlock( newId );
				break;
			}
			case 'pageSettings':
				setPersistenceStatus(
					'Page settings are in the Document details rail (name, tokens, SEO).'
				);
				break;
			default:
				break;
		}
	};

	async function refreshComponents() {
		if ( ! postId ) {
			setComponents( [] );
			return [];
		}
		setComponentsLoading( true );
		try {
			const records = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/components`,
			} );
			setComponents( records );
			return records;
		} finally {
			setComponentsLoading( false );
		}
	}

	useEffect( () => {
		if ( ! postId ) {
			setComponents( [] );
			return;
		}
		setComponentsLoading( true );
		void apiFetch( {
			path: `/code-to-block/v1/pages/${ postId }/components`,
		} )
			.then( setComponents )
			.catch( ( error ) => {
				setPersistenceStatus(
					error.message || 'Saved component library failed to load.'
				);
			} )
			.finally( () => setComponentsLoading( false ) );
	}, [ postId ] );

	useEffect( () => {
		if ( ! postId ) {
			setCommerceProducts( [] );
			setCommerceAvailable( false );
			return;
		}
		setCommerceLoading( true );
		void apiFetch( {
			path: `/code-to-block/v1/pages/${ postId }/products`,
		} )
			.then( ( response ) => {
				setCommerceProducts( response.products || [] );
				setCartHtml( response.cart_html || '' );
				setCheckoutHtml( response.checkout_html || '' );
				setCommerceAvailable( Boolean( response.available ) );
			} )
			.catch( ( error ) => {
				setCommerceProducts( [] );
				setCommerceAvailable( false );
				setPersistenceStatus(
					error.message ||
						'WooCommerce product previews failed to load.'
				);
			} )
			.finally( () => setCommerceLoading( false ) );
	}, [ postId ] );

	useEffect( () => {
		if ( ! postId ) {
			setDocumentLoading( false );
			return;
		}
		let active = true;
		setDocumentLoading( true );
		setPersistenceStatus( 'Loading...' );
		void apiFetch( {
			path: `/code-to-block/v1/pages/${ postId }/block-tree`,
		} )
			.then( ( savedDocument ) => {
				if ( active ) {
					const migratedDocument =
						migrateGuidedRolesDocument( savedDocument );
					resetDocument( migratedDocument );
					setScriptDetections( [] );
					setPhpDetections( [] );
					setParityWarnings( [] );
					setA11yIssues( runAccessibilityChecks( migratedDocument ) );
					setPersistenceStatus( 'Loaded.' );
					setDocumentLoading( false );
				}
			} )
			.catch( ( error ) => {
				if ( active ) {
					setPersistenceStatus( error.message || 'Load failed.' );
					setDocumentLoading( false );
				}
			} );
		return () => {
			active = false;
		};
	}, [ postId, resetDocument ] );

	useEffect( () => {
		const onPointerDown = ( e ) => {
			if ( e.button !== 0 ) {
				return;
			}
			if ( e.target.closest( '[role="menu"]' ) ) {
				return;
			}
			setContextMenu( null );
		};
		window.addEventListener( 'pointerdown', onPointerDown );
		return () => window.removeEventListener( 'pointerdown', onPointerDown );
	}, [] );

	useEffect( () => {
		const onKeyDown = ( e ) => {
			if (
				( e.shiftKey && 'F10' === e.key ) ||
				'ContextMenu' === e.key
			) {
				const block = selectedBlock;
				if ( block ) {
					e.preventDefault();
					const zone = getZoneForBlock( block );
					const escapedId = window.CSS.escape( block.id );
					const el = window.document.querySelector(
						`[data-block-id="${ escapedId }"]`
					);
					const rect = el?.getBoundingClientRect();
					const x = rect
						? rect.left + rect.width / 2
						: window.innerWidth / 2;
					const y = rect
						? rect.top + rect.height / 2
						: window.innerHeight / 2;
					setContextMenu( { x, y, blockId: block.id, zone } );
				}
			}
		};
		window.addEventListener( 'keydown', onKeyDown );
		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [ selectedBlock ] );

	useEffect( () => {
		function handleHistoryShortcut( event ) {
			if ( ! ( event.ctrlKey || event.metaKey ) || event.altKey ) {
				return;
			}
			if (
				event.target instanceof window.HTMLElement &&
				event.target.closest(
					'input, textarea, [contenteditable="true"]'
				)
			) {
				return;
			}

			const key = event.key.toLowerCase();
			const wantsUndo = key === 'z' && ! event.shiftKey;
			const wantsRedo = ( key === 'z' && event.shiftKey ) || key === 'y';
			const state = useEditorStore.getState();
			if ( wantsUndo && state.past.length > 0 ) {
				event.preventDefault();
				state.undo();
				updateHistoryStatus( 'Undid change.' );
			} else if ( wantsRedo && state.future.length > 0 ) {
				event.preventDefault();
				state.redo();
				updateHistoryStatus( 'Redid change.' );
			}
		}

		window.addEventListener( 'keydown', handleHistoryShortcut );
		return () =>
			window.removeEventListener( 'keydown', handleHistoryShortcut );
	}, [] );

	function updateHistoryStatus( action ) {
		const state = useEditorStore.getState();
		const saveStatus =
			state.document === state.savedDocument
				? 'All changes saved.'
				: 'Unsaved changes.';
		setPersistenceStatus( `${ action } ${ saveStatus }` );
	}

	function undoChange() {
		if ( canUndo ) {
			undo();
			updateHistoryStatus( 'Undid change.' );
		}
	}

	function redoChange() {
		if ( canRedo ) {
			redo();
			updateHistoryStatus( 'Redid change.' );
		}
	}

	function applyCustomCss( customCss ) {
		const documentBeforeEdit = useEditorStore.getState().document;
		updateBlockCustomCss( selectedBlock.id, customCss, previewBreakpoint );
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus(
				`${ activeBreakpoint.label } CSS changed. Unsaved changes.`
			);
		}
	}

	function applyMappedStyles( styles ) {
		const changedRoleProperty = Object.entries( styles ).find(
			( [ property, value ] ) =>
				value !== ( selectedStyleSet.mapped?.[ property ] || '' ) &&
				roleBindingForProperty( selectedStyleSet, property )
		);
		if ( changedRoleProperty ) {
			const [ property, value ] = changedRoleProperty;
			const source = roleBindingForProperty( selectedStyleSet, property );
			setPendingRoleEdit( {
				property,
				value,
				scope: source.scope,
				binding: source.binding,
			} );
			recordGuidedRoleEvent( 'guided_advanced_exact_edit_started', {
				role_id: source.binding.roleId,
				context_category: source.scope,
				breakpoint_category: previewBreakpoint,
				action_result: 'decision_required',
			} );
			return;
		}
		const documentBeforeEdit = useEditorStore.getState().document;
		updateBlockMappedStyles( selectedBlock.id, styles, previewBreakpoint );
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus(
				`${ activeBreakpoint.label } styles changed. Unsaved changes.`
			);
		}
	}

	function recordGuidedRoleEvent( eventName, payload ) {
		const event = sanitizeGuidedRoleTelemetry( eventName, payload );
		if ( ! event ) {
			return;
		}
		window.dispatchEvent(
			new window.CustomEvent( 'ctb-guided-role-event', { detail: event } )
		);
	}

	function cancelGuidedRolePreview() {
		const snapshot = previewSnapshot.current;
		if ( ! snapshot ) {
			return;
		}
		for ( const [ property, value ] of Object.entries( snapshot.values ) ) {
			if ( value ) {
				snapshot.element.style.setProperty( property, value );
			} else {
				snapshot.element.style.removeProperty( property );
			}
		}
		snapshot.element.classList.remove( 'is-guided-role-preview' );
		delete snapshot.element.dataset.guidedPreviewScope;
		previewSnapshot.current = null;
	}

	function previewGuidedRole( roleId, scope ) {
		cancelGuidedRolePreview();
		const escapedId = window.CSS.escape( selectedBlock.id );
		const element = window.document.querySelector(
			`[data-block-id="${ escapedId }"]`
		);
		if ( ! element ) {
			return;
		}
		const styles = rolePreviewStyles( document, roleId, scope );
		const values = Object.fromEntries(
			Object.keys( styles ).map( ( property ) => [
				property,
				element.style.getPropertyValue( property ),
			] )
		);
		previewSnapshot.current = { element, values };
		for ( const [ property, value ] of Object.entries( styles ) ) {
			element.style.setProperty( property, value );
		}
		element.classList.add( 'is-guided-role-preview' );
		element.dataset.guidedPreviewScope = scope;
	}

	function selectGuidedRole( roleId, scope ) {
		cancelGuidedRolePreview();
		const before = useEditorStore.getState().document;
		setBlockStyleRole(
			selectedBlock.id,
			roleId,
			scope,
			previewBreakpoint,
			roleCatalog( document )[ roleId ]?.builtIn ? 'built-in' : 'user'
		);
		if ( useEditorStore.getState().document !== before ) {
			setPersistenceStatus(
				`${
					roleCatalog( document )[ roleId ]?.labelKey || roleId
				} selected. Unsaved changes.`
			);
			recordGuidedRoleEvent( 'guided_role_selected', {
				role_id: roleId,
				context_category: scope,
				breakpoint_category: previewBreakpoint,
				action_result: 'committed',
			} );
		}
	}

	function adjustGuidedRole( scope, adjustment ) {
		adjustBlockStyleRole(
			selectedBlock.id,
			scope,
			adjustment,
			previewBreakpoint
		);
		setPersistenceStatus( 'Guided adjustment applied. Unsaved changes.' );
		const binding = selectedStyleSet.role_bindings?.[ scope ];
		recordGuidedRoleEvent( 'guided_relative_adjustment_used', {
			role_id: binding?.roleId || '',
			context_category: scope,
			breakpoint_category: previewBreakpoint,
			action_result: 'committed',
		} );
	}

	function rejoinGuidedRole( scope, property ) {
		rejoinBlockRoleProperty(
			selectedBlock.id,
			scope,
			property,
			previewBreakpoint
		);
		setPersistenceStatus( 'Local override removed. Unsaved changes.' );
		const binding = selectedStyleSet.role_bindings?.[ scope ];
		recordGuidedRoleEvent( 'guided_override_rejoined', {
			role_id: binding?.roleId || '',
			context_category: scope,
			breakpoint_category: previewBreakpoint,
			action_result: 'committed',
		} );
	}

	function resolveGuidedImportReview( flagId, useRole ) {
		resolveBlockImportReview(
			selectedBlock.id,
			flagId,
			useRole,
			previewBreakpoint
		);
		setPersistenceStatus(
			useRole
				? 'Imported difference rejoined to the site role. Unsaved changes.'
				: 'Imported difference kept as a local override. Unsaved changes.'
		);
	}

	function rejoinOverrideFromManager( element, override ) {
		rejoinGuidedRoleOverride(
			element.blockId,
			element.scope,
			override.property,
			element.breakpoint || 'desktop',
			element.state || ''
		);
		selectBlock( element.blockId );
		setPersistenceStatus( 'Role override rejoined. Unsaved changes.' );
		recordGuidedRoleEvent( 'guided_override_rejoined', {
			role_id: element.roleId,
			context_category: element.scope,
			breakpoint_category: element.breakpoint || 'desktop',
			action_result: 'committed',
		} );
	}

	function applyPendingRoleEditGlobally() {
		if ( ! pendingRoleEdit ) {
			return;
		}
		updateGuidedRoleProperty(
			pendingRoleEdit.binding.roleId,
			pendingRoleEdit.property,
			pendingRoleEdit.value,
			pendingRoleEdit.scope,
			pendingRoleEdit.binding
		);
		recordGuidedRoleEvent( 'guided_global_role_updated', {
			role_id: pendingRoleEdit.binding.roleId,
			context_category: pendingRoleEdit.scope,
			breakpoint_category: previewBreakpoint,
			action_result: 'committed',
		} );
		setPendingRoleEdit( null );
		setPersistenceStatus(
			'Guided role updated everywhere. Unsaved changes.'
		);
	}

	function applyPendingRoleEditLocally() {
		if ( ! pendingRoleEdit ) {
			return;
		}
		setBlockRolePropertyOverride(
			selectedBlock.id,
			pendingRoleEdit.scope,
			pendingRoleEdit.property,
			pendingRoleEdit.value,
			previewBreakpoint
		);
		recordGuidedRoleEvent( 'guided_local_override_created', {
			role_id: pendingRoleEdit.binding.roleId,
			context_category: pendingRoleEdit.scope,
			breakpoint_category: previewBreakpoint,
			action_result: 'committed',
		} );
		setPendingRoleEdit( null );
		setPersistenceStatus(
			'Local style override created. Unsaved changes.'
		);
	}

	function restoreGuidedRoleDefaults( roleId ) {
		if (
			! window.confirm( `Restore ${ roleId } to the Balanced defaults?` )
		) {
			return;
		}
		restoreGuidedRole( roleId );
		setPersistenceStatus(
			'Guided role defaults restored. Unsaved changes.'
		);
	}

	function clearColorOverride() {
		updateBlockColor( selectedBlock.id, '', previewBreakpoint );
		setPersistenceStatus(
			`${ activeBreakpoint.label } color override cleared. Unsaved changes.`
		);
	}

	function saveDesignToken( category, id, token ) {
		const documentBeforeEdit = useEditorStore.getState().document;
		upsertDesignToken( category, id, token );
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus(
				`${ token.label } token changed. Unsaved changes.`
			);
		}
	}

	function removeDesignToken( category, id ) {
		const documentBeforeEdit = useEditorStore.getState().document;
		deleteDesignToken( category, id );
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus( 'Design token deleted. Unsaved changes.' );
		}
	}

	function linkSelectedToken( property, reference ) {
		const documentBeforeEdit = useEditorStore.getState().document;
		setBlockTokenBinding(
			selectedBlock.id,
			property,
			reference,
			previewBreakpoint
		);
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus(
				`${ activeBreakpoint.label } token linked. Unsaved changes.`
			);
		}
	}

	function overrideSelectedToken( property, reference ) {
		const documentBeforeEdit = useEditorStore.getState().document;
		setBlockTokenBinding(
			selectedBlock.id,
			property,
			reference,
			previewBreakpoint,
			true
		);
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus(
				`${ activeBreakpoint.label } token overridden for this block. Unsaved changes.`
			);
		}
	}

	function unlinkSelectedToken( property, reference ) {
		const documentBeforeEdit = useEditorStore.getState().document;
		removeBlockTokenBinding(
			selectedBlock.id,
			property,
			reference,
			previewBreakpoint
		);
		if ( useEditorStore.getState().document !== documentBeforeEdit ) {
			setPersistenceStatus(
				`${ activeBreakpoint.label } token unlinked. Unsaved changes.`
			);
		}
	}

	function moveSelected( direction ) {
		const documentBeforeMove = useEditorStore.getState().document;
		moveSelectedBlock( selectedBlock.id, direction );
		if ( useEditorStore.getState().document !== documentBeforeMove ) {
			setPersistenceStatus( 'Unsaved changes.' );
		}
	}

	async function saveSelectedAsComponent( name ) {
		if ( ! postId ) {
			throw new Error(
				'Save the WordPress post once before saving a component.'
			);
		}
		const componentDocument = createComponentDocument(
			useEditorStore.getState().document,
			selectedBlock,
			name
		);
		const component = await apiFetch( {
			path: `/code-to-block/v1/pages/${ postId }/components`,
			method: 'POST',
			data: componentDocument,
		} );
		await refreshComponents();
		return `${ component.name } saved to the component library.`;
	}

	function insertWooCommerceBlockAtSelection( wooType, options ) {
		const documentBeforeInsert = useEditorStore.getState().document;
		insertWooCommerceBlock( selectedBlock.id, wooType, options );
		if ( useEditorStore.getState().document === documentBeforeInsert ) {
			throw new Error(
				'The WooCommerce block could not be inserted here.'
			);
		}
		setPersistenceStatus(
			`WooCommerce ${ wooType } inserted. Unsaved changes.`
		);
	}

	async function updateProductData( productId, updates ) {
		try {
			setCommerceLoading( true );
			const response = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/products/${ productId }`,
				method: 'PUT',
				data: updates,
			} );
			if ( response.success ) {
				setCommerceProducts( ( prev ) =>
					prev.map( ( p ) =>
						p.id === response.product.id ? response.product : p
					)
				);
				setPersistenceStatus( 'WooCommerce product saved.' );
				return response.product;
			}
			throw new Error( 'WooCommerce did not confirm the product save.' );
		} catch ( e ) {
			console.error( e );
			throw e;
		} finally {
			setCommerceLoading( false );
		}
	}

	async function createProductData( payload ) {
		try {
			setCommerceLoading( true );
			const response = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/products`,
				method: 'POST',
				data: payload,
			} );
			if ( response.success && response.product ) {
				setCommerceProducts( ( current ) =>
					[ ...current, response.product ].sort( ( left, right ) =>
						left.name.localeCompare( right.name )
					)
				);
				setPersistenceStatus( 'WooCommerce product created.' );
				return response.product;
			}
			throw new Error( 'WooCommerce did not confirm product creation.' );
		} catch ( error ) {
			console.error( error );
			throw error;
		} finally {
			setCommerceLoading( false );
		}
	}

	function mapDetectedAction( detection ) {
		const documentBeforeAction = useEditorStore.getState().document;
		addBlockAction( detection.sourceBlockId, detection.action );
		if ( useEditorStore.getState().document !== documentBeforeAction ) {
			setScriptDetections( ( current ) =>
				current.map( ( item ) =>
					item.id === detection.id
						? { ...item, status: 'mapped' }
						: item
				)
			);
			setPersistenceStatus( 'Action mapped. Unsaved changes.' );
		}
	}

	function storeDropIntent( nextIntent ) {
		dropIntentRef.current = nextIntent;
		setDropIntent( ( current ) =>
			JSON.stringify( current ) === JSON.stringify( nextIntent )
				? current
				: nextIntent
		);
	}

	function clearDropIntent() {
		storeDropIntent( null );
	}

	function resolveDndEventIntent( event ) {
		if ( ! event.over ) {
			return null;
		}
		const root = useEditorStore.getState().document.root;
		const targetId = String( event.over.id );
		const activeBlockId = String( event.active.id );
		const point = dragEventPoint( event );
		let intent = resolveDocumentDropIntent( {
			root,
			targetId,
			activeId: activeBlockId,
			point,
			rect: event.over.rect,
		} );

		if ( ! intent && event.over.rect ) {
			intent = resolveDocumentDropIntent( {
				root,
				targetId,
				activeId: activeBlockId,
				point: {
					x: event.over.rect.left + event.over.rect.width / 2,
					y: event.over.rect.top + event.over.rect.height / 2,
				},
				rect: event.over.rect,
			} );
		}
		return intent;
	}

	function updateDragIntent( event ) {
		storeDropIntent( resolveDndEventIntent( event ) );
	}

	function startDrag( event ) {
		setActiveId( event.active.id );
		clearDropIntent();
	}

	function finishDrag( event ) {
		const currentState = useEditorStore.getState();
		const intent = resolveDndEventIntent( event ) || dropIntentRef.current;
		if (
			intent?.valid &&
			event.active.id !== currentState.document.root.id
		) {
			const documentBeforeMove = currentState.document;
			moveBlock( event.active.id, intent.targetId, intent.position );
			if ( useEditorStore.getState().document !== documentBeforeMove ) {
				setPersistenceStatus( 'Unsaved changes.' );
			}
		}
		setActiveId( null );
		clearDropIntent();
	}

	function cancelDrag() {
		setActiveId( null );
		clearDropIntent();
	}

	function resolvePaletteEventIntent( event ) {
		const eventTarget =
			event.target?.nodeType === 1
				? event.target
				: event.target?.parentElement;
		const targetNode = eventTarget?.closest?.( '[data-block-id]' );
		const root = useEditorStore.getState().document.root;
		const targetId = targetNode?.dataset.blockId || root.id;
		const rect = (
			targetNode || event.currentTarget
		)?.getBoundingClientRect?.();
		if ( ! rect ) {
			return null;
		}
		return resolveDocumentDropIntent( {
			root,
			targetId,
			point: { x: event.clientX, y: event.clientY },
			rect,
		} );
	}

	function updatePaletteDropIntent( event ) {
		storeDropIntent( resolvePaletteEventIntent( event ) );
	}

	function addPrimitiveAtDrop( primitive, event ) {
		const intent =
			resolvePaletteEventIntent( event ) || dropIntentRef.current;
		const before = useEditorStore.getState().document;
		if ( intent?.valid ) {
			insertPrimitive( intent.targetId, primitive, intent.position );
		}
		if ( useEditorStore.getState().document !== before ) {
			setPersistenceStatus( 'Element added. Unsaved changes.' );
		}
		setPaletteDragging( null );
		clearDropIntent();
	}

	async function reviewPhpDetections( detections ) {
		if ( ! detections.length ) {
			return;
		}
		const canRegisterPhp = Boolean(
			window.codeToBlockEditorSettings?.canRegisterPhp
		);
		if ( ! postId || ! canRegisterPhp ) {
			const description = ! postId
				? 'Save the WordPress post once before requesting a server review.'
				: 'PHP registration requires trusted administrator code privileges and may be disabled by site policy.';
			setPhpDetections( ( current ) =>
				current.map( ( detection ) => ( {
					...detection,
					status: 'unavailable',
					description,
				} ) )
			);
			return;
		}

		await Promise.all(
			detections.map( async ( detection ) => {
				try {
					const response = await apiFetch( {
						path: `/code-to-block/v1/pages/${ postId }/php-shortcodes`,
						method: 'POST',
						data: { tag: detection.tag, code: detection.code },
					} );
					setPhpDetections( ( current ) =>
						current.map( ( item ) =>
							item.id === detection.id &&
							item.code === detection.code &&
							item.tag === detection.tag
								? {
										...item,
										status: response.review.status,
										description:
											response.review.description,
										blockedReasons:
											response.review.blocked_reasons ||
											[],
										warnings:
											response.review.warnings || [],
										reviewHash: response.review.hash,
										confirmationPhrase:
											response.confirmation_phrase,
								  }
								: item
						)
					);
				} catch ( error ) {
					setPhpDetections( ( current ) =>
						current.map( ( item ) =>
							item.id === detection.id &&
							item.code === detection.code &&
							item.tag === detection.tag
								? {
										...item,
										status: 'error',
										description:
											error.message ||
											'Server review failed.',
								  }
								: item
						)
					);
				}
			} )
		);
	}

	async function registerPhpShortcode( detection, confirmation ) {
		const response = await apiFetch( {
			path: `/code-to-block/v1/pages/${ postId }/php-shortcodes`,
			method: 'POST',
			data: {
				tag: detection.tag,
				code: detection.code,
				reviewed_hash: detection.reviewHash,
				register: true,
				confirmation,
			},
		} );
		setPhpDetections( ( current ) =>
			current.map( ( item ) =>
				item.id === detection.id &&
				item.code === detection.code &&
				item.tag === detection.tag
					? {
							...item,
							status: 'registered',
							description: response.review.description,
							warnings: response.review.warnings || [],
					  }
					: item
			)
		);
		setPersistenceStatus(
			`${ response.shortcode } registered. Save the tree to publish its placeholder.`
		);
		return response;
	}

	async function prepareImportedCode( source ) {
		if ( ! source.trim() ) {
			setParseError(
				'Paste HTML, CSS, JavaScript, PHP, or text before importing.'
			);
			setImportActivity( 'Waiting for code.' );
			setImportReview( null );
			return null;
		}
		setImportActivity( 'Parsing code...' );
		const requestId = ++importAnalysisRequestRef.current;
		try {
			const shortcodePrefix = `ctb_php_${ postId || 'draft' }`;

			const result = await importCodeService.analyze( source, {
				shortcodePrefix,
				canExecuteScripts: editorSettings.canUnfilteredHtml !== false,
			} );
			if ( requestId !== importAnalysisRequestRef.current ) {
				return null;
			}
			setImportReview( { source, result } );
			lastImportedInputRef.current = source;
			setImportActivity(
				`Ready: ${ result.session.review.builder_nodes } builder nodes parsed. Choose Display in Builder to apply them.`
			);
			setParseWarnings( result.warnings );
			setScriptDetections( result.scriptDetections );
			setPhpDetections(
				result.phpDetections.map( ( detection ) => ( {
					...detection,
					status: 'reviewing',
				} ) )
			);
			setParseError( '' );
			void reviewPhpDetections( result.phpDetections );
			return result;
		} catch ( error ) {
			if ( requestId !== importAnalysisRequestRef.current ) {
				return null;
			}
			setParseError( error.message );
			setImportActivity( 'Fix the code below to continue.' );
			setImportReview( null );
			setParseWarnings( [] );
			setScriptDetections( [] );
			setPhpDetections( [] );
			return null;
		}
	}
	applyImportedCodeRef.current = prepareImportedCode;

	function commitImportedCode( result ) {
		if ( ! result ) {
			return false;
		}
		let normalized;
		importCodeService.commit( result.session.id, {
			transformCandidate: ( candidate ) => {
				normalized = normalizeImportedStyles(
					candidate,
					useEditorStore.getState().document
				);
				return normalized.document;
			},
			commitDocument: ( candidate ) => setDocument( candidate ),
		} );
		liveImportStartedRef.current = true;
		setPersistenceStatus(
			`Imported ${ countBlocks(
				normalized.document.root
			) } blocks. Unsaved changes.`
		);
		setImportActivity(
			'Displayed in the builder. One Undo restores the previous page.'
		);
		setParseWarnings( [
			...result.warnings,
			`${ normalized.summary.mappedElements } elements mapped to existing roles.`,
			...normalized.summary.normalizedGroups.map(
				( group ) =>
					`${ group.count } ${ group.label } normalized to ${ group.roleId }.`
			),
			`${ normalized.summary.retainedOverrides } deliberate differences kept as local overrides.`,
		] );
		recordGuidedRoleEvent( 'guided_import_normalized', {
			role_id: 'multiple',
			context_category: 'import',
			breakpoint_category: 'desktop',
			action_result: 'committed',
		} );
		setIsImporterOpen( false );
		return true;
	}

	async function applyImportNow() {
		window.clearTimeout( liveImportTimerRef.current );
		const result =
			importReview?.source === unifiedInput
				? importReview.result
				: await applyImportedCodeRef.current( unifiedInput );
		commitImportedCode( result );
	}

	function importCode( event ) {
		event.preventDefault();
		void applyImportNow();
	}

	useEffect( () => {
		window.clearTimeout( liveImportTimerRef.current );
		if (
			! isImporterOpen ||
			! unifiedInput.trim() ||
			unifiedInput === lastImportedInputRef.current
		) {
			return undefined;
		}

		setImportActivity( 'Waiting for you to finish typing...' );
		const source = unifiedInput;
		liveImportTimerRef.current = window.setTimeout( () => {
			if ( source !== lastImportedInputRef.current ) {
				void applyImportedCodeRef.current( source );
			}
		}, 700 );
		return () => window.clearTimeout( liveImportTimerRef.current );
	}, [ isImporterOpen, unifiedInput ] );

	async function checkParity() {
		if ( ! postId ) {
			setParityWarnings( [] );
			return;
		}
		try {
			const response = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/parity`,
			} );
			setParityWarnings( response.warnings || [] );
		} catch {
			setParityWarnings( [] );
		}
	}

	async function saveDocument( statusMessage = 'Saving...' ) {
		if ( ! postId ) {
			setPersistenceStatus(
				'Save the WordPress post once before saving its block tree.'
			);
			return null;
		}

		setPersistenceStatus( statusMessage );
		try {
			const documentToSave = useEditorStore.getState().document;

			// Run accessibility checks at save-time
			const a11y = runAccessibilityChecks( documentToSave );
			setA11yIssues( a11y );

			const response = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/block-tree`,
				method: 'POST',
				data: {
					document: documentToSave,
					base_server_version: serverVersion,
					editor_styles: buildEditorStyleSnapshot(
						materializeComponents( documentToSave, components )
					),
				},
			} );
			const savedDocument = response.document || response;
			setParityWarnings( response.parity_warnings || [] );

			if ( response.server_version ) {
				setServerVersion( response.server_version );
			}

			const savedHash =
				response.content_hash || contentHash( savedDocument );
			setLastSavedContentHash( savedHash );

			const currentHash = contentHash(
				useEditorStore.getState().document
			);
			const hasUnsavedChanges = currentHash !== savedHash;

			if ( ! hasUnsavedChanges ) {
				syncSavedTree( savedDocument );
				setPersistenceStatus( 'Saved.' );
			} else {
				markSavedTree( documentToSave, savedDocument );
				setPersistenceStatus( 'Unsaved changes.' );
			}
			return { hasUnsavedChanges };
		} catch ( error ) {
			setPersistenceStatus( error.message || 'Save failed.' );
			return null;
		}
	}

	async function previewDocument() {
		if ( editorAction || ! editorSettings.previewUrl ) {
			return;
		}
		const previewWindow = window.open( 'about:blank', '_blank' );
		if ( ! previewWindow ) {
			setPersistenceStatus(
				'Preview was blocked. Allow pop-ups and try again.'
			);
			return;
		}

		previewWindow.opener = null;
		previewWindow.document.title = 'Preparing preview...';
		previewWindow.document.body.textContent = 'Preparing preview...';
		setEditorAction( 'preview' );
		try {
			const saveResult = await saveDocument( 'Saving before preview...' );
			if ( ! saveResult ) {
				previewWindow.close();
				return;
			}
			previewWindow.location.replace(
				freshPreviewUrl(
					editorSettings.previewUrl,
					window.location.href
				)
			);
		} catch ( error ) {
			previewWindow.close();
			setPersistenceStatus( error.message || 'Preview failed.' );
		} finally {
			setEditorAction( '' );
		}
	}

	async function publishDocument( targetStatus = 'publish' ) {
		if ( editorAction ) {
			return;
		}
		setEditorAction( 'publish' );
		try {
			if ( ! editorSettings.canPublish && targetStatus !== 'draft' ) {
				await saveDocument();
				return;
			}
			const result = await publishSavedDocument( {
				apiFetch,
				postRestPath: editorSettings.postRestPath,
				postStatus,
				targetStatus,
				saveDocument,
			} );
			if ( ! result ) {
				return;
			}
			const nextStatus = result.post.status || targetStatus;

			let completedAction = 'Saved';
			if ( nextStatus === 'publish' ) {
				completedAction =
					postStatus === 'publish' ? 'Updated' : 'Published';
			} else if ( nextStatus === 'pending' ) {
				completedAction = 'Submitted for review';
			} else if ( nextStatus === 'private' ) {
				completedAction = 'Made private';
			} else if ( nextStatus === 'draft' && postStatus !== 'draft' ) {
				completedAction = 'Unpublished to draft';
			}

			setPostStatus( nextStatus );
			setPersistenceStatus(
				result.saveResult.hasUnsavedChanges
					? `${ completedAction }. Unsaved changes.`
					: `${ completedAction }.`
			);
		} catch ( error ) {
			setPersistenceStatus( error.message || 'Status change failed.' );
		} finally {
			setEditorAction( '' );
		}
	}

	async function loadDocument() {
		if ( ! postId ) {
			setPersistenceStatus(
				'Save the WordPress post once before loading a block tree.'
			);
			return;
		}

		setPersistenceStatus( 'Loading...' );
		try {
			const savedResponse = await apiFetch( {
				path: `/code-to-block/v1/pages/${ postId }/block-tree`,
			} );
			const savedDocument = savedResponse.document || savedResponse;
			const migratedDocument =
				migrateGuidedRolesDocument( savedDocument );
			resetDocument( migratedDocument );

			if ( savedResponse.server_version ) {
				setServerVersion( savedResponse.server_version );
			}
			if ( savedResponse.post_status ) {
				setPostStatus( savedResponse.post_status );
			}
			setLastSavedContentHash( contentHash( migratedDocument ) );

			setScriptDetections( [] );
			setPhpDetections( [] );
			setParityWarnings( [] );
			setA11yIssues( runAccessibilityChecks( migratedDocument ) );

			if ( savedResponse.has_newer_autosave ) {
				setHasNewerAutosave( true );
			}

			setPersistenceStatus( 'Loaded.' );
		} catch ( error ) {
			setPersistenceStatus( error.message || 'Load failed.' );
		}
	}

	const historyLog = document.history || [];

	// Breadcrumb path computation
	const breadcrumbPath = [];
	if ( selectedBlock ) {
		let current = selectedBlock;
		while ( current ) {
			breadcrumbPath.unshift( current );
			current = getParentBlock( document.root, current.id );
		}
	}

	function getParentBlock( root, targetId ) {
		if ( ! root.children || root.children.length === 0 ) {
			return null;
		}
		for ( const child of root.children ) {
			if ( child.id === targetId ) {
				return root;
			}
			const found = getParentBlock( child, targetId );
			if ( found ) {
				return found;
			}
		}
		return null;
	}

	const renderNavigatorNode = ( node, depth = 0 ) => {
		const isSelected = selectedBlock?.id === node.id;
		return (
			<div key={ node.id } className="ctb-nav-node-container">
				<button
					type="button"
					className={ `ctb-nav-node ${
						isSelected ? 'is-selected' : ''
					}` }
					data-block-id={ node.id }
					style={ { paddingLeft: `${ depth * 12 + 8 }px` } }
					onClick={ () => selectBlock( node.id ) }
				>
					{ node.tag } { node.id.substring( 0, 4 ) }
				</button>
				{ node.children &&
					node.children
						.filter( ( child ) => child.kind !== 'text' )
						.map( ( child ) =>
							renderNavigatorNode( child, depth + 1 )
						) }
			</div>
		);
	};

	const originalUpdateHistoryStatus = updateHistoryStatus;
	const localUpdateHistoryStatus = ( action ) => {
		originalUpdateHistoryStatus( action );
	};

	function addPrimitiveAtSelection( primitive ) {
		const before = useEditorStore.getState().document;
		insertPrimitive( selectedBlock.id, primitive );
		if ( useEditorStore.getState().document !== before ) {
			setPersistenceStatus( 'Element added. Unsaved changes.' );
		}
	}

	return (
		<section
			className={ `h-screen w-screen flex flex-col overflow-hidden bg-white text-gray-800 font-poppins${
				activeId ? ' cursor-grabbing' : ''
			}` }
			aria-label="Code to Block visual editor"
		>
			<TopHeader
				documentName={ document.name }
				previewBreakpoint={ previewBreakpoint }
				setPreviewBreakpoint={ setPreviewBreakpoint }
				canUndo={ canUndo }
				canRedo={ canRedo }
				undoChange={ undoChange }
				redoChange={ redoChange }
				persistenceStatus={ persistenceStatus }
				canPreview={ Boolean( editorSettings.previewUrl ) }
				canPublish={ Boolean( editorSettings.canPublish ) }
				postStatus={ postStatus }
				editorAction={ editorAction }
				previewDocument={ previewDocument }
				publishDocument={ publishDocument }
				setIsImporterOpen={ setIsImporterOpen }
				setIsRevisionsOpen={ setIsRevisionsOpen }
				isDirty={ isDirty }
			>
				<BreakpointSwitcher
					value={ previewBreakpoint }
					onChange={ setPreviewBreakpoint }
					compact
				/>
			</TopHeader>

			{ hasNewerAutosave && (
				<div className="ctb-autosave-notice p-4 bg-yellow-50 border-b border-yellow-200 flex justify-between items-center text-sm text-yellow-800">
					<p>
						An autosave of this page is newer than the saved
						version.
					</p>
					<div className="flex gap-2">
						<button
							onClick={ recoverAutosave }
							className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 border border-yellow-300 rounded text-yellow-900 transition-colors"
						>
							Recover Autosave
						</button>
						<button
							onClick={ () => setHasNewerAutosave( false ) }
							className="px-3 py-1 hover:bg-yellow-100 rounded text-yellow-800 transition-colors"
						>
							Dismiss
						</button>
					</div>
				</div>
			) }

			{ isRevisionsOpen && (
				<div
					className="ctb-import-panel"
					role="dialog"
					aria-labelledby="ctb-revisions-title"
				>
					<div className="ctb-import-heading">
						<div>
							<h3 id="ctb-revisions-title">Revision History</h3>
						</div>
						<div className="ctb-import-actions">
							<button
								type="button"
								className="ctb-import-close"
								onClick={ () => setIsRevisionsOpen( false ) }
							>
								Close
							</button>
						</div>
					</div>
					<RevisionHistory
						postId={ postId }
						apiFetch={ apiFetch }
						onRestore={ ( restoredDoc ) => {
							resetDocument( restoredDoc );
							setIsRevisionsOpen( false );
							setPersistenceStatus(
								'Revision loaded. Save to keep these changes.'
							);
						} }
					/>
				</div>
			) }

			{ isImporterOpen &&
				( () => {
					const analyzed =
						importReview?.source === unifiedInput
							? importReview.result
							: null;
					const detection = analyzed?.session.detection;
					const detectedHtml = detection?.containsHtml
						? [ analyzed.session.normalizedSource ]
						: [];
					const detectedCss = (
						analyzed?.session.stylesheets || []
					).map( ( stylesheet ) => stylesheet.source_text );
					const detectedJs = ( analyzed?.session.scripts || [] ).map(
						( script ) =>
							script.src
								? `<script src="${ script.src }"></script>`
								: script.source
					);
					const detectedPhp = ( analyzed?.phpDetections || [] ).map(
						( detectionItem ) => detectionItem.code
					);
					const hasDetected =
						detectedHtml.length > 0 ||
						detectedCss.length > 0 ||
						detectedJs.length > 0 ||
						detectedPhp.length > 0;
					return (
						<form
							className="ctb-import-panel"
							onSubmit={ importCode }
							role="dialog"
							aria-labelledby="ctb-import-title"
						>
							<div className="ctb-import-heading">
								<div>
									<p className="ctb-kicker">
										Unified Importer
									</p>
									<h3 id="ctb-import-title">
										Paste your code
									</h3>
									<p className="ctb-import-description">
										Paste a complete HTML document, an HTML
										fragment, CSS, JavaScript, or PHP. The
										latest source is parsed and displayed in
										the isolated builder canvas in one step.
										Scripts remain disabled while editing.
									</p>
									<p
										className="ctb-import-live-status"
										aria-live="polite"
									>
										{ importActivity }
									</p>
								</div>
								<div className="ctb-import-actions">
									<button
										type="button"
										className="ctb-import-close"
										onClick={ () =>
											setIsImporterOpen( false )
										}
									>
										Close
									</button>
								</div>
							</div>
							<div className="ctb-import-commit-bar">
								<p id="ctb-import-commit-help">
									{ importReview?.source === unifiedInput
										? `${ importReview.result.session.review.builder_nodes } builder nodes are ready to display.`
										: 'The latest HTML will be parsed before it is displayed.' }
								</p>
								<button
									type="submit"
									disabled={ ! unifiedInput.trim() }
									aria-describedby="ctb-import-commit-help"
								>
									Apply HTML &amp; Display Full Screen
								</button>
							</div>
							<div className="ctb-import-fields">
								<label htmlFor="ctb-import-unified">
									<span className="screen-reader-text">
										Combined HTML, CSS, JS, PHP
									</span>
									<textarea
										id="ctb-import-unified"
										aria-label="Code to import"
										placeholder="Paste your combined code here..."
										value={ unifiedInput }
										onChange={ ( event ) => {
											setUnifiedInput(
												event.target.value
											);
											setParseError( '' );
											setParseWarnings( [] );
											setImportReview( null );
											setScriptDetections( [] );
										} }
										autoFocus
										style={ { minHeight: '250px' } }
									/>
								</label>
								{ importReview?.source === unifiedInput ? (
									<section
										className="ctb-import-review"
										aria-label="Import review"
									>
										<div className="ctb-import-review-grid">
											<span>
												Document
												<strong>
													{ importReview.result
														.session.review
														.document_type ===
													'full-document'
														? 'Full HTML document'
														: 'Fragment / generated root' }
												</strong>
											</span>
											<span>
												Detected
												<strong>
													{
														importReview.result
															.session.review
															.source_type
													}{ ' ' }
													·{ ' ' }
													{ importReview.result.session.review.detected_languages.join(
														', '
													) || 'plain text' }
												</strong>
											</span>
											<span>
												Builder nodes
												<strong>
													{
														importReview.result
															.session.review
															.builder_nodes
													}
												</strong>
											</span>
											<span>
												Stylesheets
												<strong>
													{
														importReview.result
															.session.review
															.stylesheets
													}
												</strong>
											</span>
											<span>
												CSS variables
												<strong>
													{
														importReview.result
															.session.review
															.css_variables
													}
												</strong>
											</span>
											<span>
												Mapped responsive rules
												<strong>
													{
														importReview.result
															.session.review
															.mapped_responsive
													}
												</strong>
											</span>
											<span>
												Mapped state rules
												<strong>
													{
														importReview.result
															.session.review
															.mapped_states
													}
												</strong>
											</span>
											<span>
												Deferred custom CSS
												<strong>
													{
														importReview.result
															.session.review
															.custom_css
													}
												</strong>
											</span>
											<span>
												Unsupported elements
												<strong>
													{
														importReview.result
															.session.review
															.unsupported_elements
													}
												</strong>
											</span>
											<span>
												Media conditions
												<strong>
													{
														importReview.result
															.session.review
															.media_conditions
															.length
													}
												</strong>
											</span>
											<span>
												Keyframes
												<strong>
													{
														importReview.result
															.session.review
															.keyframes.length
													}
												</strong>
											</span>
											<span>
												Scripts
												<strong>
													{
														importReview.result
															.session.review
															.scripts
													}{ ' ' }
													(Preview/Publish only)
												</strong>
											</span>
											<span>
												External assets
												<strong>
													{
														importReview.result
															.session.review
															.external_assets
													}
												</strong>
											</span>
										</div>
										{ importReview.result.session.pageMeta
											.title ? (
											<p>
												<strong>Page title:</strong>{ ' ' }
												{
													importReview.result.session
														.pageMeta.title
												}
											</p>
										) : null }
										<details>
											<summary>Normalized source</summary>
											<pre>
												{
													importReview.result.session
														.normalizedSource
												}
											</pre>
										</details>
										<details>
											<summary>
												Structure, styles, and
												diagnostics
											</summary>
											<p>
												Roots:{ ' ' }
												{ importReview.result.document.root.children
													?.filter(
														( child ) =>
															child.kind !==
															'text'
													)
													.map(
														( child ) => child.tag
													)
													.join( ', ' ) ||
													importReview.result.document
														.root.tag }
											</p>
											<p>
												Media:{ ' ' }
												{ importReview.result.session.review.media_conditions.join(
													', '
												) || 'None' }
											</p>
											<p>
												Keyframes:{ ' ' }
												{ importReview.result.session.review.keyframes.join(
													', '
												) || 'None' }
											</p>
										</details>
									</section>
								) : null }
								{ hasDetected && (
									<div
										className="ctb-import-detection"
										style={ {
											marginTop: '12px',
											padding: '12px',
											background: '#f8f9fa',
											borderRadius: '4px',
											fontSize: '13px',
										} }
									>
										<strong>Detected blocks:</strong>
										<ul
											style={ {
												margin: '8px 0 0',
												paddingLeft: '20px',
											} }
										>
											{ detectedHtml.map( ( source ) => (
												<li key="html-structure">
													<details>
														<summary>
															HTML structure
														</summary>
														<pre>{ source }</pre>
													</details>
												</li>
											) ) }
											{ detectedCss.map(
												( source, index ) => (
													<li
														key={ `css-${ index }` }
													>
														<details>
															<summary>
																Stylesheet{ ' ' }
																{ index + 1 }
															</summary>
															<pre>
																{ source }
															</pre>
														</details>
													</li>
												)
											) }
											{ detectedJs.map(
												( source, index ) => (
													<li key={ `js-${ index }` }>
														<details>
															<summary>
																Script block{ ' ' }
																{ index + 1 }
															</summary>
															<pre>
																{ source }
															</pre>
														</details>
													</li>
												)
											) }
											{ detectedPhp.map(
												( source, index ) => (
													<li
														key={ `php-${ index }` }
													>
														<details>
															<summary>
																PHP snippet{ ' ' }
																{ index + 1 }
															</summary>
															<pre>
																{ source }
															</pre>
														</details>
													</li>
												)
											) }
										</ul>
										{ detectedPhp.length > 0 && (
											<p
												style={ {
													marginTop: '8px',
													color: '#8a3b16',
													background:
														'rgba(255, 241, 223, 0.9)',
													padding: '8px',
													borderRadius: '4px',
												} }
											>
												PHP code requires your explicit
												confirmation before it's
												registered.
											</p>
										) }
									</div>
								) }
							</div>
							{ parseError ? (
								<p
									className="ctb-import-message is-error"
									role="alert"
								>
									{ parseError }
								</p>
							) : null }
							{ parseWarnings.length > 0 ? (
								<div
									className="ctb-import-message is-warning"
									role="status"
								>
									<strong>Imported with warnings:</strong>
									<ul>
										{ parseWarnings.map( ( warning ) => (
											<li key={ warning }>{ warning }</li>
										) ) }
									</ul>
								</div>
							) : null }
							<ScriptDetections
								detections={ scriptDetections }
								onMap={ mapDetectedAction }
							/>
							<PhpDetections
								detections={ phpDetections }
								onRegister={ registerPhpShortcode }
							/>
						</form>
					);
				} )() }
			<div className="flex-1 flex min-h-0 overflow-hidden">
				<LeftRail
					paletteDragging={ paletteDragging }
					addPrimitiveAtSelection={ addPrimitiveAtSelection }
					setPaletteDragging={ setPaletteDragging }
				/>

				{ /* CANVAS WITH BREADCRUMBS */ }
				<CenterCanvas
					previewStyles={ previewStyles }
					importedPageRoot={
						document.imported_assets?.page_meta || {}
					}
					breadcrumbPath={ breadcrumbPath }
					selectBlock={ selectBlock }
					DndContext={ DndContext }
					sensors={ sensors }
					collisionStrategy={ collisionStrategy }
					startDrag={ startDrag }
					updateDragIntent={ updateDragIntent }
					finishDrag={ finishDrag }
					cancelDrag={ cancelDrag }
					paletteDragging={ paletteDragging }
					previewBreakpoint={ previewBreakpoint }
					documentLoading={ documentLoading }
					SkeletonLoader={ SkeletonLoader }
					DragOverlay={ DragOverlay }
					activeBlock={ activeBlock }
					dropIntent={ dropIntent }
					updatePaletteDropIntent={ updatePaletteDropIntent }
					addPrimitiveAtDrop={ addPrimitiveAtDrop }
					clearDropIntent={ clearDropIntent }
					overlayModifiers={ [ cursorOffsetModifier ] }
				>
					{ documentLoading ? (
						<div className="ctb-editor-skeleton-layout">
							<SkeletonLoader type="image" />
							<SkeletonLoader type="rich_text" />
							<br />
							<SkeletonLoader type="text" />
							<SkeletonLoader type="link" />
							<br />
							<div
								style={ {
									display: 'flex',
									gap: '20px',
								} }
							>
								<div style={ { flex: 1 } }>
									<SkeletonLoader type="rich_text" />
								</div>
								<div style={ { flex: 1 } }>
									<SkeletonLoader type="rich_text" />
								</div>
							</div>
						</div>
					) : (
						<Block
							block={ viewDocument.root }
							styleIndexes={ previewStyles.indexes }
							isRoot
							onContextMenu={ handleBlockContextMenu }
							dropIntent={ dropIntent }
						/>
					) }
				</CenterCanvas>

				{ /* RIGHT PANEL - Inspector Tabs */ }
				<RightInspector
					BlockDynamicControl={ BlockDynamicControl }
					BlockSlotControl={ BlockSlotControl }
					navigatorDock={
						<NavigatorTree>
							{ renderNavigatorNode( document.root ) }
						</NavigatorTree>
					}
					selectedBlock={ selectedBlock }
					inspectorModel={ selectedInspector }
					activeTab={ activeTab }
					setActiveTab={ setActiveTab }
					duplicateBlock={ duplicateBlock }
					deleteBlock={ deleteBlock }
					documentRootId={ document.root.id }
					updateBlockContent={ updateBlockContent }
					updateBlockAttribute={ updateBlockAttribute }
					updateBlockProp={ updateBlockProp }
					updateBlockTag={ updateBlockTag }
					updateBlockMappedStyles={ updateBlockMappedStyles }
					setBlockHidden={ setBlockHidden }
					previewBreakpoint={ previewBreakpoint }
					setBlockDynamicProperties={ setBlockDynamicProperties }
					setBlockSlotProperties={ setBlockSlotProperties }
					localUpdateHistoryStatus={ localUpdateHistoryStatus }
					VOID_TAGS={ VOID_TAGS }
					styleTabContent={
						<div
							className="ctb-tab-pane"
							style={ { padding: '16px' } }
						>
							<h4>Style context</h4>
							<p className="ctb-muted">
								Target:{ ' ' }
								<strong>
									{
										selectedInspector.tabs.style
											.activeTarget
									}
								</strong>
							</p>
							<ExplainPanel block={ selectedBlock } />
							<BreakpointSwitcher
								value={ previewBreakpoint }
								onChange={ setPreviewBreakpoint }
								compact
							/>
							<p>{ selectedBreakpointSummary }</p>
							{ selectedInspector.tabs.style.properties.includes(
								'color'
							) ? (
								<ResponsiveColorOverride
									breakpoint={ previewBreakpoint }
									color={ selectedColor }
									ownColor={ selectedOwnColor }
									onClear={ clearColorOverride }
								/>
							) : null }
							{ guidedRolesEnabled( document ) ? (
								<GuidedRolePanel
									document={ document }
									block={ selectedBlock }
									styleSet={ selectedStyleSet }
									effectiveMapped={ selectedEffectiveMapped }
									onSelectRole={ selectGuidedRole }
									onAdjustRole={ adjustGuidedRole }
									onPreviewRole={ previewGuidedRole }
									onCancelPreview={ cancelGuidedRolePreview }
									onRejoin={ rejoinGuidedRole }
									onResolveImportReview={
										resolveGuidedImportReview
									}
								/>
							) : null }
							<h4>Element styles</h4>
							<MappedStyleControls
								key={ `${ selectedBlock.id }:${ previewBreakpoint }:${ selectedMappedStyleKey }` }
								styleSet={ selectedStyleSet }
								inheritedMapped={ selectedInheritedMapped }
								effectiveMapped={ selectedEffectiveMapped }
								effectiveBindings={ selectedEffectiveBindings }
								designTokens={ document.design_tokens }
								breakpoint={ previewBreakpoint }
								panelMode="advanced"
								searchQuery=""
								allowedProperties={
									selectedInspector.tabs.style.properties
								}
								parentDisplayValue={ selectedParentDisplay }
								onApply={ applyMappedStyles }
								onLinkToken={ linkSelectedToken }
								onRemoveToken={ unlinkSelectedToken }
								onOverrideToken={ overrideSelectedToken }
							/>
							<details className="ctb-document-design-system">
								<summary>Document design system</summary>
								<div className="ctb-document-design-system-content">
									<GuidedRolesManager
										document={ document }
										onRestoreRole={
											restoreGuidedRoleDefaults
										}
										onSelectElement={ selectBlock }
										onRejoinOverride={
											rejoinOverrideFromManager
										}
									/>
									<DesignTokenPanel
										document={ document }
										onSave={ saveDesignToken }
										onDelete={ removeDesignToken }
									/>
								</div>
							</details>
						</div>
					}
					advancedTabContent={
						<div
							className="ctb-tab-pane"
							style={ { padding: '16px' } }
						>
							<h4>Responsive</h4>
							<BreakpointSwitcher
								value={ previewBreakpoint }
								onChange={ setPreviewBreakpoint }
								compact
							/>
							<p className="ctb-muted">
								{ selectedBreakpointSummary }
							</p>
							<h4>Attributes & accessibility</h4>
							<fieldset
								disabled={ selectedBlock.permissions?.locked }
								className="ctb-inspector-fields ctb-attribute-fields"
							>
								{ [
									[ 'id', 'ID' ],
									[ 'class', 'CSS classes' ],
									[ 'title', 'Title' ],
									[ 'role', 'ARIA role' ],
									[ 'aria-label', 'ARIA label' ],
									[ 'tabindex', 'Tab index' ],
								].map( ( [ attribute, label ] ) => (
									<label key={ attribute }>
										<span>{ label }</span>
										<input
											key={ `${ selectedBlock.id }:${ attribute }` }
											defaultValue={
												selectedBlock.attributes?.[
													attribute
												] || ''
											}
											onBlur={ ( event ) =>
												updateBlockAttribute(
													selectedBlock.id,
													attribute,
													event.target.value
												)
											}
										/>
									</label>
								) ) }
								<div className="ctb-custom-attribute-row">
									<input
										aria-label="Custom attribute name"
										placeholder="data-name"
										value={ customAttributeName }
										onChange={ ( event ) =>
											setCustomAttributeName(
												event.target.value
											)
										}
									/>
									<input
										aria-label="Custom attribute value"
										placeholder="Value"
										value={ customAttributeValue }
										onChange={ ( event ) =>
											setCustomAttributeValue(
												event.target.value
											)
										}
									/>
									<button
										type="button"
										onClick={ () => {
											updateBlockAttribute(
												selectedBlock.id,
												customAttributeName,
												customAttributeValue
											);
											setCustomAttributeName( '' );
											setCustomAttributeValue( '' );
										} }
									>
										Add
									</button>
								</div>
							</fieldset>
							<h4>Custom CSS & behavior</h4>
							<RawCssControl
								key={ `${ selectedBlock.id }:${ previewBreakpoint }:raw` }
								styleSet={ selectedStyleSet }
								breakpoint={ previewBreakpoint }
								onApply={ applyCustomCss }
							/>
							<BlockAnimationControl block={ selectedBlock } />
							<BlockActions block={ selectedBlock } />
							<DiagnosticsPanel postId={ postId } />
							<ParityWarningsPanel
								warnings={ parityWarnings }
								onSelect={ selectBlock }
							/>
							<AccessibilityPanel
								issues={ a11yIssues }
								onSelect={ selectBlock }
							/>
						</div>
					}
				/>
				<RoleEditDecisionDialog
					pending={ pendingRoleEdit }
					affectedCount={
						pendingRoleEdit
							? countRoleUsage(
									document,
									pendingRoleEdit.binding.roleId
							  ).uses
							: 0
					}
					onGlobal={ applyPendingRoleEditGlobally }
					onLocal={ applyPendingRoleEditLocally }
					onCancel={ () => setPendingRoleEdit( null ) }
				/>

				{ /* FAR-RIGHT PANEL - Settings & Data */ }

				<ContextMenu
					menu={ contextMenu }
					onClose={ () => setContextMenu( null ) }
					onAction={ handleContextAction }
					hasClipboard={ !! clipboardBlock }
					hasStylesClipboard={ !! clipboardStyles }
				/>
			</div>
		</section>
	);
}

const rootElement = document.getElementById( 'code-to-block-editor-root' );
if ( rootElement ) {
	createRoot( rootElement ).render( <Editor /> );
}
