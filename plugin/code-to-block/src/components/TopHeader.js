import { useState } from '@wordpress/element';
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
	children,
} ) {
	const [ isProjectMenuOpen, setIsProjectMenuOpen ] = useState( false );
	const isBusy = Boolean( editorAction );
	const isPublished = postStatus === 'publish';

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

	return (
		<header
			className="relative z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-gray-200 bg-white px-2 sm:px-4"
			data-purpose="top-nav"
		>
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
					<div className="absolute left-10 top-10 w-44 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg">
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

			<div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 sm:block">
				{ children }
			</div>

			<div className="flex items-center gap-1.5">
				<span className="mr-1 hidden max-w-40 truncate text-[10px] text-gray-400 2xl:inline" title={ persistenceStatus }>
					{ statusBadge }
				</span>
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

				<button
					type="button"
					className="ml-2 hidden h-8 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:inline-flex"
					onClick={ () => setIsRevisionsOpen( true ) }
				>
					Revisions
				</button>

				<button
					type="button"
					className="ml-1 hidden h-8 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 sm:inline-flex"
					disabled={ ! canPreview || isBusy }
					title={
						canPreview
							? 'Save changes and open a fresh preview'
							: 'Preview is unavailable for this page'
					}
					onClick={ previewDocument }
				>
					{ editorAction === 'preview' ? 'Preparing...' : 'Preview' }
				</button>

				{ canPublish ? (
					<div className="ml-1 relative flex items-center h-8 rounded-md border border-indigo-600 bg-indigo-600 text-white transition-colors hover:border-indigo-700 hover:bg-indigo-700 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2">
						<button
							type="button"
							className="px-4 text-xs font-semibold focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
							disabled={ isBusy || ! canSave }
							onClick={ () => publishDocument( 'publish' ) }
						>
							{ editorAction === 'publish'
								? activePublishLabel
								: publishLabel }
						</button>
						<select
							className="bg-indigo-700 text-white text-xs border-0 outline-none rounded-r-md cursor-pointer hover:bg-indigo-800 px-1 py-1 h-full appearance-none disabled:cursor-not-allowed disabled:opacity-60"
							disabled={ isBusy }
							title="More status options"
							value=""
							onChange={ ( e ) => {
								if ( e.target.value ) {
									if ( e.target.value === 'draft' ) {
										if ( ! window.confirm( 'Are you sure you want to unpublish this page and revert it to a draft?' ) ) {
											return;
										}
									}
									publishDocument( e.target.value );
									e.target.value = '';
								}
							} }
						>
							<option value="" disabled>▼</option>
							<option value="pending">Submit for Review</option>
							<option value="private">Make Private</option>
							<option value="draft">Switch to Draft</option>
						</select>
					</div>
				) : (
					<button
						type="button"
						className="ml-1 h-8 rounded-md border border-indigo-600 bg-indigo-600 px-4 text-xs font-semibold text-white transition-colors hover:border-indigo-700 hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
						disabled={ isBusy || ! canSave }
						onClick={ () => publishDocument( 'draft' ) }
					>
						{ editorAction === 'publish'
							? activePublishLabel
							: publishLabel }
					</button>
				) }
			</div>
		</header>
	);
}
