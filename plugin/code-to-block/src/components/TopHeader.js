import { useState, useEffect, useRef } from '@wordpress/element';
import { statusLabel } from '../editor-persistence.mjs';

export default function TopHeader( {
	documentName,
	canUndo,
	canRedo,
	undoChange,
	redoChange,
	persistenceStatus,
	canPreview,
	canPublish,
	postStatus,
	editorAction,
	previewDocument,
	publishDocument,
	setIsImporterOpen,
	setIsRevisionsOpen,
	isDirty,
	previewBreakpoint = 'desktop',
	setPreviewBreakpoint = () => {},
	onOpenDisplayConditions,
	onOpenSchedule,
	onOpenSaveTemplate,
	onSaveDraft,
	children,
} ) {
	const [ isProjectMenuOpen, setIsProjectMenuOpen ] = useState( false );
	const [ isPublishMenuOpen, setIsPublishMenuOpen ] = useState( false );
	const publishMenuRef = useRef( null );

	const isBusy = Boolean( editorAction );
	const isPublished = postStatus === 'publish';

	// Close publish menu on click outside
	useEffect( () => {
		if ( ! isPublishMenuOpen ) return;
		function handleClickOutside( event ) {
			if ( publishMenuRef.current && ! publishMenuRef.current.contains( event.target ) ) {
				setIsPublishMenuOpen( false );
			}
		}
		document.addEventListener( 'mousedown', handleClickOutside );
		return () => document.removeEventListener( 'mousedown', handleClickOutside );
	}, [ isPublishMenuOpen ] );

	const publishLabel = isPublished
		? 'Update'
		: canPublish
		? 'Publish'
		: 'Save draft';

	const activePublishLabel = canPublish
		? isPublished
			? 'Updating...'
			: 'Publishing...'
		: 'Saving...';

	const statusBadge = `${ statusLabel( postStatus ) } ${ isDirty ? '· Unsaved changes' : '· Saved' }`;
	const canSave = isDirty || ! isPublished;

	const handlePublishClick = () => {
		if ( canPublish ) {
			// Triggered Immediately After Clicking Publish: Display Conditions menu opens
			if ( onOpenDisplayConditions ) {
				onOpenDisplayConditions();
			} else {
				publishDocument( 'publish' );
			}
		} else if ( onSaveDraft ) {
			onSaveDraft();
		} else {
			publishDocument( 'draft' );
		}
	};

	return (
		<header
			className="relative z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-gray-200 bg-white px-2 sm:px-4"
			data-purpose="top-nav"
		>
			{ /* Left side: Brand + Document Title + Project Menu */ }
			<div className="relative flex min-w-0 items-center gap-3">
				<div
					className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600"
					aria-hidden="true"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"></path>
						<path d="m4 12 8 4.5 8-4.5"></path>
						<path d="m4 16.5 8 4.5 8-4.5"></path>
					</svg>
				</div>

				<button
					type="button"
					className="flex min-w-0 items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
					aria-expanded={ isProjectMenuOpen }
					onClick={ () => setIsProjectMenuOpen( ( open ) => ! open ) }
				>
					<span className="hidden max-w-48 truncate sm:inline">
						{ documentName || 'My Website' }
					</span>
					<i
						className="fa-solid fa-chevron-down text-[9px] text-gray-400"
						aria-hidden="true"
					></i>
				</button>

				{ isProjectMenuOpen ? (
					<div className="absolute left-10 top-10 w-44 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg z-30">
						<button
							type="button"
							className="flex w-full items-center gap-2 rounded-md border-0 bg-white px-3 py-2 text-left text-xs text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
							onClick={ () => {
								setIsImporterOpen( true );
								setIsProjectMenuOpen( false );
							} }
						>
							<i
								className="fa-solid fa-code text-gray-400"
								aria-hidden="true"
							></i>
							Import code
						</button>
					</div>
				) : null }
			</div>

			{ /* Center workspace slot (optional custom content) */ }
			<div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
				{ children }
			</div>

			{ /* Right side: Undo/Redo, Status, Adjacent Companion Buttons, Publish */ }
			<div className="flex items-center gap-1.5 sm:gap-2">
				<span
					className="mr-1 hidden max-w-36 truncate text-[10px] text-gray-400 2xl:inline"
					title={ persistenceStatus }
				>
					{ statusBadge }
				</span>

				{ /* Undo / Redo */ }
				<div className="flex items-center">
					<button
						type="button"
						className="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-30"
						disabled={ ! canUndo }
						title="Undo"
						onClick={ undoChange }
					>
						<i
							className="fa-solid fa-rotate-left text-xs"
							aria-hidden="true"
						></i>
						<span className="sr-only">Undo</span>
					</button>
					<button
						type="button"
						className="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-30"
						disabled={ ! canRedo }
						title="Redo"
						onClick={ redoChange }
					>
						<i
							className="fa-solid fa-rotate-right text-xs"
							aria-hidden="true"
						></i>
						<span className="sr-only">Redo</span>
					</button>
				</div>

				<div className="h-4 w-px bg-gray-200 mx-0.5 hidden sm:block" aria-hidden="true" />

				{ /* Adjacent Companion Buttons Group (Next to Publish) */ }
				<div className="flex items-center gap-1 sm:gap-1.5" role="toolbar" aria-label="Editor tools">
					{ /* 1. History / Revisions (Clock Icon) */ }
					<button
						type="button"
						className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 sm:px-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
						title="History / Revisions (Clock Icon): Opens a timeline of changes to undo mistakes or roll back to earlier saves."
						aria-label="History / Revisions: Opens a timeline of changes to undo mistakes or roll back to earlier saves"
						onClick={ () => setIsRevisionsOpen( true ) }
					>
						<i className="fa-solid fa-clock-rotate-left text-xs text-gray-500" aria-hidden="true"></i>
						<span className="hidden lg:inline text-[11px]">History</span>
					</button>

					{ /* 2. Responsive Mode: Toggles workspace between desktop, tablet, and mobile */ }
					<div
						className="flex items-center rounded-md border border-gray-300 bg-gray-50 p-0.5"
						role="group"
						aria-label="Responsive Mode: Toggles the editing workspace between desktop, tablet, and mobile layouts"
						title="Responsive Mode: Toggles the editing workspace between desktop, tablet, and mobile layouts"
					>
						<button
							type="button"
							className={ `flex h-7 w-7 items-center justify-center rounded transition-colors ${
								previewBreakpoint === 'desktop'
									? 'bg-white text-indigo-600 shadow-sm font-semibold'
									: 'text-gray-500 hover:text-gray-800'
							}` }
							title="Desktop layout"
							aria-label="Desktop layout"
							aria-pressed={ previewBreakpoint === 'desktop' }
							onClick={ () => setPreviewBreakpoint( 'desktop' ) }
						>
							<i className="fa-solid fa-display text-xs" aria-hidden="true"></i>
						</button>
						<button
							type="button"
							className={ `flex h-7 w-7 items-center justify-center rounded transition-colors ${
								previewBreakpoint === 'tablet'
									? 'bg-white text-indigo-600 shadow-sm font-semibold'
									: 'text-gray-500 hover:text-gray-800'
							}` }
							title="Tablet layout"
							aria-label="Tablet layout"
							aria-pressed={ previewBreakpoint === 'tablet' }
							onClick={ () => setPreviewBreakpoint( 'tablet' ) }
						>
							<i className="fa-solid fa-tablet-screen-button text-xs" aria-hidden="true"></i>
						</button>
						<button
							type="button"
							className={ `flex h-7 w-7 items-center justify-center rounded transition-colors ${
								previewBreakpoint === 'mobile'
									? 'bg-white text-indigo-600 shadow-sm font-semibold'
									: 'text-gray-500 hover:text-gray-800'
							}` }
							title="Mobile layout"
							aria-label="Mobile layout"
							aria-pressed={ previewBreakpoint === 'mobile' }
							onClick={ () => setPreviewBreakpoint( 'mobile' ) }
						>
							<i className="fa-solid fa-mobile-screen-button text-xs" aria-hidden="true"></i>
						</button>
					</div>

					{ /* 3. Preview Changes (Eye Icon) */ }
					<button
						type="button"
						className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 sm:px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
						disabled={ ! canPreview || isBusy }
						title="Preview Changes (Eye Icon): Opens a temporary front-end link to view the live design before publishing."
						aria-label="Preview Changes: Opens a temporary front-end link to view the live design before publishing"
						onClick={ previewDocument }
					>
						<i className="fa-solid fa-eye text-xs text-gray-500" aria-hidden="true"></i>
						<span className="hidden sm:inline text-[11px]">
							{ editorAction === 'preview' ? 'Preparing...' : 'Preview Changes' }
						</span>
					</button>
				</div>

				{ /* Publish Button with Dropdown Menu */ }
				<div ref={ publishMenuRef } className="relative ml-1 flex items-center">
					{ canPublish ? (
						<div className="flex items-center h-8 rounded-md border border-indigo-600 bg-indigo-600 text-white transition-colors hover:border-indigo-700 hover:bg-indigo-700 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2">
							{ /* Primary Publish Button: clicking immediately opens Display Conditions */ }
							<button
								type="button"
								className="px-3.5 text-xs font-semibold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-1.5"
								disabled={ isBusy || ! canSave }
								onClick={ handlePublishClick }
								title="Publish: Choose display conditions and publish live"
							>
								<span>
									{ editorAction === 'publish' ? activePublishLabel : publishLabel }
								</span>
							</button>

							{ /* Dropdown Menu Trigger Caret */ }
							<button
								type="button"
								className="flex h-full w-7 items-center justify-center border-l border-indigo-500/50 text-white hover:bg-indigo-700/80 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 rounded-r-md"
								disabled={ isBusy }
								title="More publish options"
								aria-expanded={ isPublishMenuOpen }
								aria-label="Publish options"
								onClick={ () => setIsPublishMenuOpen( ( prev ) => ! prev ) }
							>
								<i className="fa-solid fa-chevron-down text-[10px]" aria-hidden="true"></i>
							</button>
						</div>
					) : (
						<div className="flex items-center h-8 rounded-md border border-indigo-600 bg-indigo-600 text-white transition-colors hover:border-indigo-700 hover:bg-indigo-700 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2">
							<button
								type="button"
								className="px-3.5 text-xs font-semibold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
								disabled={ isBusy || ! canSave }
								onClick={ handlePublishClick }
								title="Save draft privately"
							>
								<span>
									{ editorAction === 'publish' ? activePublishLabel : publishLabel }
								</span>
							</button>
							<button
								type="button"
								className="flex h-full w-7 items-center justify-center border-l border-indigo-500/50 text-white hover:bg-indigo-700/80 transition-colors focus:outline-none rounded-r-md"
								disabled={ isBusy }
								title="More options"
								aria-expanded={ isPublishMenuOpen }
								onClick={ () => setIsPublishMenuOpen( ( prev ) => ! prev ) }
							>
								<i className="fa-solid fa-chevron-down text-[10px]" aria-hidden="true"></i>
							</button>
						</div>
					) }

					{ /* Inside the Publish Dropdown Menu */ }
					{ isPublishMenuOpen && (
						<div className="absolute right-0 top-10 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 text-gray-800">
							<div className="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
								Publish & Export Options
							</div>

							{ /* Save Draft */ }
							<button
								type="button"
								className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-gray-50 transition-colors group"
								onClick={ () => {
									setIsPublishMenuOpen( false );
									if ( onSaveDraft ) {
										onSaveDraft();
									} else {
										publishDocument( 'draft' );
									}
								} }
							>
								<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors mt-0.5">
									<i className="fa-solid fa-floppy-disk text-xs" aria-hidden="true"></i>
								</div>
								<div className="flex-1 min-w-0">
									<div className="text-xs font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">
										Save Draft
									</div>
									<div className="text-[11px] text-gray-500 leading-tight mt-0.5">
										Saves the current progress privately without pushing changes live to visitors.
									</div>
								</div>
							</button>

							{ /* Save as Template */ }
							<button
								type="button"
								className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-gray-50 transition-colors group"
								onClick={ () => {
									setIsPublishMenuOpen( false );
									if ( onOpenSaveTemplate ) {
										onOpenSaveTemplate();
									}
								} }
							>
								<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors mt-0.5">
									<i className="fa-solid fa-layer-group text-xs" aria-hidden="true"></i>
								</div>
								<div className="flex-1 min-w-0">
									<div className="text-xs font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">
										Save as Template
									</div>
									<div className="text-[11px] text-gray-500 leading-tight mt-0.5">
										Exports the entire page layout to the website's library to reuse on other pages.
									</div>
								</div>
							</button>

							{ /* Schedule */ }
							<button
								type="button"
								className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-gray-50 transition-colors group"
								onClick={ () => {
									setIsPublishMenuOpen( false );
									if ( onOpenSchedule ) {
										onOpenSchedule();
									}
								} }
							>
								<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors mt-0.5">
									<i className="fa-solid fa-calendar-days text-xs" aria-hidden="true"></i>
								</div>
								<div className="flex-1 min-w-0">
									<div className="text-xs font-semibold text-gray-800 group-hover:text-amber-600 transition-colors">
										Schedule
									</div>
									<div className="text-[11px] text-gray-500 leading-tight mt-0.5">
										Sets a future date and time for the page to automatically go live.
									</div>
								</div>
							</button>

							<div className="my-1 border-t border-gray-100" />

							{ /* Display Conditions */ }
							<button
								type="button"
								className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-gray-50 transition-colors group"
								onClick={ () => {
									setIsPublishMenuOpen( false );
									if ( onOpenDisplayConditions ) {
										onOpenDisplayConditions();
									}
								} }
							>
								<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors mt-0.5">
									<i className="fa-solid fa-sliders text-xs" aria-hidden="true"></i>
								</div>
								<div className="flex-1 min-w-0">
									<div className="text-xs font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
										Display Conditions
									</div>
									<div className="text-[11px] text-gray-500 leading-tight mt-0.5">
										Opens a menu to choose where the layout applies (e.g., specific pages, categories, or the entire site).
									</div>
								</div>
							</button>

							{ /* Secondary Status options */ }
							<div className="my-1 border-t border-gray-100" />
							<div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
								Other Statuses
							</div>
							<div className="flex items-center gap-1 px-1">
								<button
									type="button"
									className="flex-1 rounded-md px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
									onClick={ () => {
										setIsPublishMenuOpen( false );
										publishDocument( 'pending' );
									} }
								>
									Submit Review
								</button>
								<button
									type="button"
									className="flex-1 rounded-md px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
									onClick={ () => {
										setIsPublishMenuOpen( false );
										publishDocument( 'private' );
									} }
								>
									Make Private
								</button>
							</div>
						</div>
					) }
				</div>
			</div>
		</header>
	);
}
