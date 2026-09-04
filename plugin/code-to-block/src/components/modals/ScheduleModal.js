import { useState, useEffect } from '@wordpress/element';

export default function ScheduleModal( {
	isOpen,
	onClose,
	onSchedule,
	isBusy = false,
} ) {
	// Default to tomorrow at 09:00 local time
	const getDefaultDateTime = () => {
		const date = new Date();
		date.setDate( date.getDate() + 1 );
		date.setHours( 9, 0, 0, 0 );
		const pad = ( n ) => String( n ).padStart( 2, '0' );
		return `${ date.getFullYear() }-${ pad( date.getMonth() + 1 ) }-${ pad( date.getDate() ) }T${ pad( date.getHours() ) }:${ pad( date.getMinutes() ) }`;
	};

	const [ scheduleDateTime, setScheduleDateTime ] = useState( getDefaultDateTime );
	const [ error, setError ] = useState( '' );

	useEffect( () => {
		if ( isOpen ) {
			setScheduleDateTime( getDefaultDateTime() );
			setError( '' );
		}
	}, [ isOpen ] );

	if ( ! isOpen ) {
		return null;
	}

	const handleSubmit = ( e ) => {
		e?.preventDefault();
		if ( ! scheduleDateTime ) {
			setError( 'Please select a valid date and time.' );
			return;
		}
		const chosen = new Date( scheduleDateTime );
		if ( isNaN( chosen.getTime() ) || chosen <= new Date() ) {
			setError( 'Scheduled time must be in the future.' );
			return;
		}
		setError( '' );
		onSchedule( chosen.toISOString() );
		onClose();
	};

	const setQuickSchedule = ( daysAhead, hour = 9 ) => {
		const date = new Date();
		date.setDate( date.getDate() + daysAhead );
		date.setHours( hour, 0, 0, 0 );
		const pad = ( n ) => String( n ).padStart( 2, '0' );
		setScheduleDateTime(
			`${ date.getFullYear() }-${ pad( date.getMonth() + 1 ) }-${ pad( date.getDate() ) }T${ pad( date.getHours() ) }:${ pad( date.getMinutes() ) }`
		);
		setError( '' );
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
			role="dialog"
			aria-modal="true"
			aria-labelledby="schedule-modal-title"
		>
			<div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
				{ /* Header */ }
				<div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50/50">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
							<i className="fa-solid fa-calendar-days text-sm" aria-hidden="true"></i>
						</div>
						<div>
							<h3 id="schedule-modal-title" className="text-base font-semibold text-gray-900">
								Schedule
							</h3>
							<p className="text-xs text-gray-500">
								Sets a future date and time for the page to automatically go live.
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
						<label htmlFor="schedule-datetime-input" className="block text-xs font-semibold text-gray-700 mb-1.5">
							Publication Date & Time
						</label>
						<input
							id="schedule-datetime-input"
							type="datetime-local"
							className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
							value={ scheduleDateTime }
							onChange={ ( e ) => {
								setScheduleDateTime( e.target.value );
								setError( '' );
							} }
							required
						/>
					</div>

					{ /* Quick Presets */ }
					<div className="space-y-1.5">
						<span className="text-[11px] font-medium text-gray-400">Quick presets:</span>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
								onClick={ () => setQuickSchedule( 1, 9 ) }
							>
								Tomorrow, 9:00 AM
							</button>
							<button
								type="button"
								className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
								onClick={ () => setQuickSchedule( 3, 9 ) }
							>
								In 3 days
							</button>
							<button
								type="button"
								className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
								onClick={ () => setQuickSchedule( 7, 9 ) }
							>
								Next week
							</button>
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
							<i className="fa-solid fa-clock text-xs" aria-hidden="true"></i>
							Schedule Publish
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
