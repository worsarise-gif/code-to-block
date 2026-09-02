import { createElement } from '@wordpress/element';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import '../../editor.css';
import { blockHasTokenOverride } from '../../design-tokens.mjs';
import { createImportCodeService } from '../../importer/ImportCodeService.mjs';
import { sanitizeRichTextHtml } from '../../rich-text.mjs';
import { normalizeReactAttributes } from '../../react-attributes.mjs';
import { ownStyleSet } from '../../responsive-styles.mjs';
import { findBlock } from '../../tree.mjs';
import { COMPONENT_FAILURE_MESSAGE, isSavedComponentBlock } from '../../reusable-components.mjs';
import { roleBindingForProperty, rolePreviewStyles, semanticDetentFromPointerDelta } from '../../semantic-roles.mjs';
import { useEditorStore } from '../../store/editor-store.mjs';
import { toReactStyles, normalizeResourceUrl } from '../../utils/editor-utils.js';

export function SkeletonLoader( { type, block } ) {
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

export function Block( props ) {
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

export function CanvasDragHandles( { blockId } ) {
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

export function BlockContent( {
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

