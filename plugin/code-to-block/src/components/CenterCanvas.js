import { createPortal, useEffect, useRef, useState } from '@wordpress/element';

import {
	createEditorCanvasDocument,
	EDITOR_CANVAS_SANDBOX,
	applyImportedPageRoot,
} from '../canvas-isolation.mjs';

const EDITOR_CANVAS_DOCUMENT = createEditorCanvasDocument();

function IsolatedCanvasFrame( {
	children,
	previewStyles,
	importedPageRoot,
	onDragOver,
	onDragLeave,
	onDrop,
} ) {
	const frameRef = useRef( null );
	const [ mountNode, setMountNode ] = useState( null );

	function connectFrame() {
		applyImportedPageRoot(
			frameRef.current?.contentDocument,
			importedPageRoot
		);
		setMountNode(
			frameRef.current?.contentDocument?.getElementById(
				'ctb-canvas-root'
			) || null
		);
	}

	useEffect( () => {
		applyImportedPageRoot(
			frameRef.current?.contentDocument,
			importedPageRoot
		);
	}, [ importedPageRoot, mountNode ] );

	return (
		<>
			<iframe
				ref={ frameRef }
				className="block h-[720px] min-h-[720px] w-full border-0 bg-white"
				title="Isolated builder canvas"
				sandbox={ EDITOR_CANVAS_SANDBOX }
				referrerPolicy="no-referrer"
				srcDoc={ EDITOR_CANVAS_DOCUMENT }
				onLoad={ connectFrame }
			/>
			{ mountNode
				? createPortal(
						<>
							<style data-ctb-preview-styles="1">
								{ previewStyles }
							</style>
							<div
								className="ctb-canvas-document"
								onDragOver={ onDragOver }
								onDragLeave={ onDragLeave }
								onDrop={ onDrop }
							>
								{ children }
							</div>
						</>,
						mountNode
				  )
				: null }
		</>
	);
}

export default function CenterCanvas( {
	previewStyles,
	importedPageRoot,
	breadcrumbPath,
	selectBlock,
	DndContext,
	sensors,
	collisionStrategy,
	startDrag,
	updateDragIntent,
	finishDrag,
	cancelDrag,
	paletteDragging,
	previewBreakpoint,
	documentLoading,
	SkeletonLoader,
	DragOverlay,
	activeBlock,
	dropIntent,
	updatePaletteDropIntent,
	addPrimitiveAtDrop,
	clearDropIntent,
	overlayModifiers,
	children,
} ) {
	let viewportWidth = '100%';
	if ( previewBreakpoint === 'tablet' ) {
		viewportWidth = '768px';
	} else if ( previewBreakpoint === 'mobile' ) {
		viewportWidth = '390px';
	}

	function handleCanvasDragOver( event ) {
		if (
			event.dataTransfer.types.includes( 'application/x-ctb-element' )
		) {
			event.preventDefault();
			event.dataTransfer.dropEffect = 'copy';
			updatePaletteDropIntent( event );
		}
	}

	function handleCanvasDragLeave( event ) {
		if ( ! event.currentTarget.contains( event.relatedTarget ) ) {
			clearDropIntent();
		}
	}

	function handleCanvasDrop( event ) {
		const primitive = event.dataTransfer.getData(
			'application/x-ctb-element'
		);
		if ( primitive ) {
			event.preventDefault();
			addPrimitiveAtDrop( primitive, event );
		}
	}

	let dragOverlayLabel = activeBlock
		? `Moving ${ activeBlock.id }`
		: 'Moving block';
	if ( dropIntent ) {
		dragOverlayLabel = dropIntent.valid
			? `Move ${ dropIntent.position } ${ dropIntent.targetId }`
			: dropIntent.reason;
	}

	return (
		<main className="flex-1 min-w-0 bg-gray-50 flex items-center justify-center p-8 overflow-auto relative">
			<DndContext
				sensors={ sensors }
				collisionDetection={ collisionStrategy }
				onDragStart={ startDrag }
				onDragMove={ updateDragIntent }
				onDragOver={ updateDragIntent }
				onDragEnd={ finishDrag }
				onDragCancel={ cancelDrag }
			>
				<div
					className={ `relative my-auto w-full shrink-0 overflow-hidden rounded-lg border bg-white shadow-sm transition-[max-width,border-color,box-shadow] duration-300 ${
						paletteDragging
							? 'border-indigo-400 ring-4 ring-indigo-100'
							: 'border-gray-200'
					}` }
					style={ {
						maxWidth: viewportWidth,
						minHeight: '720px',
					} }
					onDragOver={ handleCanvasDragOver }
					onDragLeave={ handleCanvasDragLeave }
					onDrop={ handleCanvasDrop }
				>
					{ breadcrumbPath?.length ? (
						<nav
							className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center overflow-hidden rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-medium text-white shadow-sm"
							aria-label="Selected element path"
						>
							{ breadcrumbPath.map( ( block, index ) => (
								<span
									key={ block.id }
									className="flex min-w-0 items-center"
								>
									<button
										type="button"
										className="truncate rounded border-0 bg-transparent px-1 py-0.5 text-[10px] text-white hover:bg-white/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
										onClick={ () =>
											selectBlock( block.id )
										}
									>
										{ block.tag }
									</button>
									{ index < breadcrumbPath.length - 1 ? (
										<i
											className="fa-solid fa-chevron-right mx-0.5 text-[7px] text-indigo-200"
											aria-hidden="true"
										></i>
									) : null }
								</span>
							) ) }
						</nav>
					) : null }

					<div
						className={ `h-full min-h-[720px] w-full overflow-auto is-${ previewBreakpoint }` }
					>
						{ documentLoading && SkeletonLoader ? (
							<div className="p-8">
								<SkeletonLoader type="image" />
								<SkeletonLoader type="rich_text" />
								<br />
								<SkeletonLoader type="text" />
								<SkeletonLoader type="link" />
							</div>
						) : (
							<IsolatedCanvasFrame
								previewStyles={ previewStyles?.css || '' }
								importedPageRoot={ importedPageRoot }
								onDragOver={ handleCanvasDragOver }
								onDragLeave={ handleCanvasDragLeave }
								onDrop={ handleCanvasDrop }
							>
								{ children }
							</IsolatedCanvasFrame>
						) }
					</div>
				</div>

				{ DragOverlay && activeBlock ? (
					<DragOverlay modifiers={ overlayModifiers }>
						<div
							className={ `rounded-md px-3 py-2 text-xs font-medium text-white shadow-lg ${
								dropIntent && ! dropIntent.valid
									? 'bg-red-600'
									: 'bg-indigo-600'
							}` }
						>
							{ dragOverlayLabel }
						</div>
					</DragOverlay>
				) : null }
			</DndContext>
		</main>
	);
}
