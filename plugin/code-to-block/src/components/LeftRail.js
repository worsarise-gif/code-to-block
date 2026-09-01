import { useEffect, useMemo, useRef, useState } from '@wordpress/element';

import { paletteGroups } from '../elements/registry.mjs';

const ELEMENT_GROUPS = paletteGroups();

export default function LeftRail( {
	paletteDragging,
	addPrimitiveAtSelection,
	setPaletteDragging,
} ) {
	const [ query, setQuery ] = useState( '' );
	const [ openSections, setOpenSections ] = useState( () =>
		Object.fromEntries(
			ELEMENT_GROUPS.map( ( group, index ) => [ group.id, index < 3 ] )
		)
	);
	const searchRef = useRef( null );

	useEffect( () => {
		function focusSearch( event ) {
			if (
				( event.metaKey || event.ctrlKey ) &&
				event.key.toLowerCase() === 'k'
			) {
				event.preventDefault();
				searchRef.current?.focus();
			}
		}

		window.addEventListener( 'keydown', focusSearch );
		return () => window.removeEventListener( 'keydown', focusSearch );
	}, [] );

	const filteredGroups = useMemo( () => {
		const normalizedQuery = query.trim().toLowerCase();
		if ( ! normalizedQuery ) {
			return ELEMENT_GROUPS;
		}

		return ELEMENT_GROUPS.map( ( group ) => ( {
			...group,
			items: group.items.filter( ( item ) =>
				item[ 2 ].toLowerCase().includes( normalizedQuery )
			),
		} ) ).filter( ( group ) => group.items.length > 0 );
	}, [ query ] );

	function toggleSection( sectionId ) {
		setOpenSections( ( current ) => ( {
			...current,
			[ sectionId ]: ! current[ sectionId ],
		} ) );
	}

	function startPaletteDrag( event, type ) {
		event.dataTransfer.setData( 'application/x-ctb-element', type );
		event.dataTransfer.effectAllowed = 'copy';
		setPaletteDragging( type );
	}

	return (
		<aside
			className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white lg:flex"
			aria-label="Add elements"
		>
			<header className="border-b border-gray-200 p-4">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="m-0 text-sm font-semibold text-gray-900">
						Add Elements
					</h2>
					<span className="text-[10px] font-medium text-gray-400">
						Drag or click
					</span>
				</div>
				<label className="relative block" htmlFor="ctb-element-search">
					<span className="sr-only">Search elements</span>
					<i
						className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400"
						aria-hidden="true"
					></i>
					<input
						id="ctb-element-search"
						ref={ searchRef }
						type="search"
						value={ query }
						onChange={ ( event ) => setQuery( event.target.value ) }
						placeholder="Search elements..."
						className="h-9 w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-14 text-xs text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
					/>
					<kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[9px] text-gray-400">
						Ctrl K
					</kbd>
				</label>
			</header>

			<div className="flex-1">
				{ filteredGroups.map( ( group ) => {
					const isOpen = query ? true : openSections[ group.id ];
					return (
						<section
							key={ group.id }
							className="border-b border-gray-100"
						>
							<button
								type="button"
								className="flex w-full items-center justify-between bg-white px-4 py-3 text-left text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
								aria-expanded={ isOpen }
								onClick={ () => toggleSection( group.id ) }
							>
								<span>{ group.label }</span>
								<i
									className={ `fa-solid fa-chevron-down text-[9px] text-gray-400 transition-transform ${
										isOpen ? '' : '-rotate-90'
									}` }
									aria-hidden="true"
								></i>
							</button>

							{ isOpen ? (
								<div className="grid grid-cols-2 gap-2 p-4 pt-1">
									{ group.items.map(
										( [ type, icon, label ] ) => (
											<button
												key={ type }
												type="button"
												draggable
												className={ `group flex min-h-20 cursor-grab flex-col items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-3 text-[11px] font-medium text-gray-600 transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:cursor-grabbing active:scale-[0.98] ${
													paletteDragging === type
														? 'opacity-50'
														: ''
												}` }
												onClick={ () =>
													addPrimitiveAtSelection(
														type
													)
												}
												onDragStart={ ( event ) =>
													startPaletteDrag(
														event,
														type
													)
												}
												onDragEnd={ () =>
													setPaletteDragging( null )
												}
											>
												<i
													className={ `${ icon } text-base text-gray-500 transition-colors group-hover:text-indigo-600` }
													aria-hidden="true"
												></i>
												<span>{ label }</span>
											</button>
										)
									) }
								</div>
							) : null }
						</section>
					);
				} ) }

				{ filteredGroups.length === 0 ? (
					<p className="px-4 py-8 text-center text-xs text-gray-400">
						No matching elements.
					</p>
				) : null }
			</div>
		</aside>
	);
}
