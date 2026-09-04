import { useState, useEffect } from '@wordpress/element';

const DEFAULT_CONDITION = {
	id: 'default-1',
	type: 'include', // 'include' | 'exclude'
	target: 'entire_site', // 'entire_site' | 'singular' | 'archives' | 'woocommerce'
	subTarget: 'all',
	specifier: '',
};
const EMPTY_CONDITIONS = Object.freeze( [] );

export default function DisplayConditionsModal( {
	isOpen,
	onClose,
	initialConditions = EMPTY_CONDITIONS,
	onSave,
	isBusy = false,
	isPublished = false,
} ) {
	const [ conditions, setConditions ] = useState( () => {
		if (
			Array.isArray( initialConditions ) &&
			initialConditions.length > 0
		) {
			return initialConditions;
		}
		return [ { ...DEFAULT_CONDITION } ];
	} );

	useEffect( () => {
		if ( ! isOpen ) {
			return;
		}
		if (
			Array.isArray( initialConditions ) &&
			initialConditions.length > 0
		) {
			setConditions( initialConditions );
		} else {
			setConditions( [ { ...DEFAULT_CONDITION } ] );
		}
	}, [ initialConditions, isOpen ] );

	if ( ! isOpen ) {
		return null;
	}

	const addCondition = () => {
		setConditions( ( prev ) => [
			...prev,
			{
				id: `cond-${ Date.now() }-${ Math.random()
					.toString( 36 )
					.substr( 2, 5 ) }`,
				type: 'include',
				target: 'singular',
				subTarget: 'pages',
				specifier: '',
			},
		] );
	};

	const removeCondition = ( index ) => {
		setConditions( ( prev ) => {
			const next = prev.filter( ( _, i ) => i !== index );
			return next.length > 0 ? next : [ { ...DEFAULT_CONDITION } ];
		} );
	};

	const updateCondition = ( index, key, value ) => {
		setConditions( ( prev ) =>
			prev.map( ( item, i ) => {
				if ( i !== index ) return item;
				const updated = { ...item, [ key ]: value };
				if ( key === 'target' ) {
					if ( value === 'entire_site' ) updated.subTarget = 'all';
					else if ( value === 'singular' )
						updated.subTarget = 'pages';
					else if ( value === 'archives' )
						updated.subTarget = 'all_archives';
					else if ( value === 'woocommerce' )
						updated.subTarget = 'shop';
					updated.specifier = '';
				}
				return updated;
			} )
		);
	};

	const handleSaveOnly = () => {
		onSave( conditions, false );
		onClose();
	};

	const handleSaveAndPublish = () => {
		onSave( conditions, true );
		onClose();
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
			role="dialog"
			aria-modal="true"
			aria-labelledby="display-conditions-title"
		>
			<div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
				{ /* Header */ }
				<div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50/50">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
							<i
								className="fa-solid fa-sliders text-sm"
								aria-hidden="true"
							></i>
						</div>
						<div>
							<h3
								id="display-conditions-title"
								className="text-base font-semibold text-gray-900"
							>
								Display Conditions
							</h3>
							<p className="text-xs text-gray-500">
								Choose where this layout applies across your
								website.
							</p>
						</div>
					</div>
					<button
						type="button"
						className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
						onClick={ onClose }
						aria-label="Close modal"
					>
						<i
							className="fa-solid fa-xmark text-sm"
							aria-hidden="true"
						></i>
					</button>
				</div>

				{ /* Content body */ }
				<div className="p-6 overflow-y-auto space-y-4 flex-1">
					<div className="rounded-lg bg-blue-50/70 border border-blue-100 p-3.5 flex items-start gap-3 text-xs text-blue-800">
						<i
							className="fa-solid fa-circle-info text-blue-500 mt-0.5"
							aria-hidden="true"
						></i>
						<div>
							<strong>Layout application rules:</strong> Set
							whether this layout takes effect on the entire site,
							specific individual pages, or archive categories.
							Include rules apply the layout; Exclude rules take
							precedence.
						</div>
					</div>

					<div className="space-y-3">
						{ conditions.map( ( condition, index ) => (
							<div
								key={ condition.id || index }
								className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors shadow-sm"
							>
								{ /* Type: Include / Exclude */ }
								<select
									className="h-9 rounded-md border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0"
									value={ condition.type }
									onChange={ ( e ) =>
										updateCondition(
											index,
											'type',
											e.target.value
										)
									}
								>
									<option value="include">INCLUDE</option>
									<option value="exclude">EXCLUDE</option>
								</select>

								{ /* Target Selector */ }
								<select
									className="h-9 rounded-md border border-gray-300 bg-white px-2.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0"
									value={ condition.target }
									onChange={ ( e ) =>
										updateCondition(
											index,
											'target',
											e.target.value
										)
									}
								>
									<option value="entire_site">
										Entire Site
									</option>
									<option value="singular">
										Singular (Pages & Posts)
									</option>
									<option value="archives">
										Archives & Categories
									</option>
									<option value="woocommerce">
										WooCommerce
									</option>
								</select>

								{ /* SubTarget Selector */ }
								{ condition.target === 'singular' && (
									<select
										className="h-9 flex-1 min-w-[120px] rounded-md border border-gray-300 bg-white px-2.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
										value={ condition.subTarget }
										onChange={ ( e ) =>
											updateCondition(
												index,
												'subTarget',
												e.target.value
											)
										}
									>
										<option value="pages">All Pages</option>
										<option value="posts">All Posts</option>
										<option value="front_page">
											Front Page
										</option>
										<option value="blog_page">
											Blog / Posts Page
										</option>
										<option value="specific_page">
											Specific Page / Post ID
										</option>
									</select>
								) }

								{ condition.target === 'archives' && (
									<select
										className="h-9 flex-1 min-w-[120px] rounded-md border border-gray-300 bg-white px-2.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
										value={ condition.subTarget }
										onChange={ ( e ) =>
											updateCondition(
												index,
												'subTarget',
												e.target.value
											)
										}
									>
										<option value="all_archives">
											All Archives
										</option>
										<option value="categories">
											Category Archives
										</option>
										<option value="tags">
											Tag Archives
										</option>
										<option value="author">
											Author Archives
										</option>
									</select>
								) }

								{ condition.target === 'woocommerce' && (
									<select
										className="h-9 flex-1 min-w-[120px] rounded-md border border-gray-300 bg-white px-2.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
										value={ condition.subTarget }
										onChange={ ( e ) =>
											updateCondition(
												index,
												'subTarget',
												e.target.value
											)
										}
									>
										<option value="shop">Shop Page</option>
										<option value="products">
											All Single Products
										</option>
										<option value="cart">Cart Page</option>
										<option value="checkout">
											Checkout Page
										</option>
									</select>
								) }

								{ /* Specific ID / Slug Input if applicable */ }
								{ condition.subTarget === 'specific_page' && (
									<input
										type="text"
										className="h-9 w-28 rounded-md border border-gray-300 px-2.5 text-xs placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
										placeholder="e.g. 42"
										value={ condition.specifier || '' }
										onChange={ ( e ) =>
											updateCondition(
												index,
												'specifier',
												e.target.value
											)
										}
									/>
								) }

								{ /* Remove Row Button */ }
								<button
									type="button"
									className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors ml-auto"
									onClick={ () => removeCondition( index ) }
									title="Remove condition"
									aria-label="Remove condition"
								>
									<i
										className="fa-solid fa-trash-can text-xs"
										aria-hidden="true"
									></i>
								</button>
							</div>
						) ) }
					</div>

					<button
						type="button"
						className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-xs font-medium text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors w-full justify-center"
						onClick={ addCondition }
					>
						<i
							className="fa-solid fa-plus text-[10px]"
							aria-hidden="true"
						></i>
						Add Condition
					</button>
				</div>

				{ /* Footer */ }
				<div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 bg-gray-50">
					<button
						type="button"
						className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
						onClick={ onClose }
						disabled={ isBusy }
					>
						Cancel
					</button>
					<div className="flex items-center gap-2">
						<button
							type="button"
							className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
							onClick={ handleSaveOnly }
							disabled={ isBusy }
						>
							Save Conditions Only
						</button>
						<button
							type="button"
							className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60"
							onClick={ handleSaveAndPublish }
							disabled={ isBusy }
						>
							<i
								className="fa-solid fa-check text-xs"
								aria-hidden="true"
							></i>
							{ isPublished ? 'Save & Update' : 'Save & Publish' }
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
