import { useState, useEffect } from '@wordpress/element';

export default function SaveTemplateModal( {
	isOpen,
	onClose,
	onSaveTemplate,
	defaultName = 'Page Template',
	isBusy = false,
} ) {
	const [ templateName, setTemplateName ] = useState( defaultName );
	const [ error, setError ] = useState( '' );

	useEffect( () => {
		if ( isOpen ) {
			setTemplateName( defaultName || 'Page Template' );
			setError( '' );
		}
	}, [ isOpen, defaultName ] );

	if ( ! isOpen ) {
		return null;
	}

	const handleSubmit = async ( e ) => {
		e?.preventDefault();
		const trimmed = templateName.trim();
		if ( ! trimmed ) {
			setError( 'Please enter a template name.' );
			return;
		}
		setError( '' );
		try {
			await onSaveTemplate( trimmed );
			onClose();
		} catch ( err ) {
			setError( err.message || 'Failed to save template.' );
		}
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
			role="dialog"
			aria-modal="true"
			aria-labelledby="save-template-title"
		>
			<div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
				{ /* Header */ }
				<div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50/50">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
							<i className="fa-solid fa-layer-group text-sm" aria-hidden="true"></i>
						</div>
						<div>
							<h3 id="save-template-title" className="text-base font-semibold text-gray-900">
								Save as Template
							</h3>
							<p className="text-xs text-gray-500">
								Exports the entire page layout to the website's library to reuse on other pages.
							</p>
						</div>
					</div>
					<button
						type="button"
						className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
						onClick={ onClose }
						aria-label="Close modal"
					>
						<i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
					</button>
				</div>

				{ /* Form Body */ }
				<form onSubmit={ handleSubmit } className="p-6 space-y-4">
					<div>
						<label htmlFor="template-name-input" className="block text-xs font-semibold text-gray-700 mb-1.5">
							Template Name
						</label>
						<input
							id="template-name-input"
							type="text"
							className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
							placeholder="e.g. Landing Page Hero Layout"
							value={ templateName }
							onChange={ ( e ) => {
								setTemplateName( e.target.value );
								setError( '' );
							} }
							required
							autoFocus
						/>
					</div>

					<div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 flex items-start gap-2.5">
						<i className="fa-solid fa-circle-check text-indigo-600 mt-0.5" aria-hidden="true"></i>
						<div>
							All blocks, layout structures, and referenced design tokens will be packaged into your reusable library.
						</div>
					</div>

					{ error && (
						<div className="rounded-md bg-red-50 p-2.5 text-xs text-red-600 flex items-center gap-2">
							<i className="fa-solid fa-circle-exclamation text-xs" aria-hidden="true"></i>
							<span>{ error }</span>
						</div>
					) }

					{ /* Footer */ }
					<div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
						<button
							type="button"
							className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
							onClick={ onClose }
							disabled={ isBusy }
						>
							Cancel
						</button>
						<button
							type="submit"
							className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60"
							disabled={ isBusy }
						>
							<i className="fa-solid fa-floppy-disk text-xs" aria-hidden="true"></i>
							{ isBusy ? 'Saving...' : 'Save to Library' }
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
