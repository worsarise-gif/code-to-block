import { useState } from '@wordpress/element';

import { panelSearch } from '../elements/resolver.mjs';
import { isBlockHidden } from '../responsive-styles.mjs';

const INPUT_CLASS =
	'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 shadow-none outline-none transition-colors placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400';
const LABEL_CLASS = 'mb-1.5 block text-[11px] font-medium text-gray-600';

function InspectorToggle( { checked, label, disabled, onClick } ) {
	return (
		<button
			type="button"
			disabled={ disabled }
			className={ `relative h-5 w-9 shrink-0 rounded-full border-0 p-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
				checked ? 'bg-indigo-600' : 'bg-gray-200'
			}` }
			role="switch"
			aria-checked={ checked }
			aria-label={ label }
			onClick={ onClick }
		>
			<span
				className={ `absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
					checked ? 'translate-x-[18px]' : 'translate-x-0.5'
				}` }
			></span>
		</button>
	);
}

function StructuredField( { control, disabled, onCommit } ) {
	const initial =
		control.value && typeof control.value === 'object'
			? JSON.stringify( control.value, null, 2 )
			: '';
	const [ value, setValue ] = useState( initial );
	const [ error, setError ] = useState( '' );

	function commit() {
		if ( ! value.trim() ) {
			onCommit( '' );
			setError( '' );
			return;
		}
		try {
			onCommit( JSON.parse( value ) );
			setError( '' );
		} catch ( parseError ) {
			setError( 'Enter valid JSON for this structured value.' );
		}
	}

	return (
		<label className="block" htmlFor={ `ctb-content-${ control.id }` }>
			<span className={ LABEL_CLASS }>{ control.label }</span>
			<textarea
				id={ `ctb-content-${ control.id }` }
				className={ `${ INPUT_CLASS } resize-y font-mono` }
				rows="5"
				disabled={ disabled }
				value={ value }
				onChange={ ( event ) => setValue( event.target.value ) }
				onBlur={ commit }
			/>
			{ error ? (
				<span
					className="mt-1 block text-[10px] text-red-600"
					role="alert"
				>
					{ error }
				</span>
			) : null }
		</label>
	);
}

function ContentField( { control, disabled, onCommit } ) {
	const id = `ctb-content-${ control.id }`;
	if ( control.type === 'toggle' ) {
		return (
			<div className="flex items-center justify-between gap-4">
				<span className="text-[11px] font-medium text-gray-600">
					{ control.label }
				</span>
				<InspectorToggle
					checked={ Boolean( control.value ) }
					label={ control.label }
					disabled={ disabled }
					onClick={ () => onCommit( ! control.value ) }
				/>
			</div>
		);
	}
	if ( control.type === 'select' ) {
		return (
			<label className="block" htmlFor={ id }>
				<span className={ LABEL_CLASS }>{ control.label }</span>
				<select
					id={ id }
					className={ INPUT_CLASS }
					disabled={ disabled }
					value={ control.value ?? '' }
					onChange={ ( event ) => onCommit( event.target.value ) }
				>
					{ ! control.required ? (
						<option value="">Default</option>
					) : null }
					{ ( control.options || [] ).map( ( option ) => (
						<option key={ option } value={ option }>
							{ option }
						</option>
					) ) }
				</select>
			</label>
		);
	}
	if ( control.type === 'multiSelect' ) {
		const selected = Array.isArray( control.value ) ? control.value : [];
		return (
			<fieldset
				className="m-0 space-y-2 border-0 p-0"
				disabled={ disabled }
			>
				<legend className={ LABEL_CLASS }>{ control.label }</legend>
				{ ( control.options || [] ).map( ( option ) => (
					<label
						key={ option }
						className="flex items-center gap-2 text-[11px] text-gray-600"
					>
						<input
							type="checkbox"
							checked={ selected.includes( option ) }
							onChange={ () =>
								onCommit(
									selected.includes( option )
										? selected.filter(
												( item ) => item !== option
										  )
										: [ ...selected, option ]
								)
							}
						/>
						{ option }
					</label>
				) ) }
			</fieldset>
		);
	}
	if (
		[
			'repeater',
			'mediaCollection',
			'keyValue',
			'conditionBuilder',
			'sortableList',
		].includes( control.type )
	) {
		return (
			<StructuredField
				control={ control }
				disabled={ disabled }
				onCommit={ onCommit }
			/>
		);
	}
	if ( control.type === 'textarea' ) {
		return (
			<label className="block" htmlFor={ id }>
				<span className={ LABEL_CLASS }>{ control.label }</span>
				<textarea
					id={ id }
					key={ `${ id }:${ control.value }` }
					rows="4"
					className={ `${ INPUT_CLASS } resize-y` }
					disabled={ disabled }
					defaultValue={ control.value ?? '' }
					onBlur={ ( event ) => onCommit( event.target.value ) }
				/>
			</label>
		);
	}
	return (
		<label className="block" htmlFor={ id }>
			<span className={ LABEL_CLASS }>{ control.label }</span>
			<input
				id={ id }
				key={ `${ id }:${ control.value }` }
				type={
					control.type === 'url'
						? 'url'
						: control.type === 'number'
						? 'number'
						: control.type === 'datetime'
						? 'datetime-local'
						: 'text'
				}
				className={ INPUT_CLASS }
				disabled={ disabled }
				min={ control.min }
				max={ control.max }
				required={ control.required }
				defaultValue={ control.value ?? '' }
				onBlur={ ( event ) => {
					const value =
						control.type === 'number' && event.target.value !== ''
							? Number( event.target.value )
							: event.target.value;
					onCommit( value );
				} }
			/>
		</label>
	);
}

function ElementContentPanel( {
	inspectorModel,
	selectedBlock,
	updateBlockContent,
	updateBlockAttribute,
	updateBlockProp,
	updateBlockTag,
	localUpdateHistoryStatus,
	BlockDynamicControl,
	BlockSlotControl,
	setBlockDynamicProperties,
	setBlockSlotProperties,
} ) {
	const controls = inspectorModel.tabs.content.groups.flatMap(
		( group ) => group.controls || []
	);
	const disabled = Boolean( selectedBlock.permissions?.locked );

	function commitControl( control, value ) {
		if ( control.storage === 'content' )
			updateBlockContent( selectedBlock.id, value );
		else if ( control.storage === 'tag' )
			updateBlockTag( selectedBlock.id, value );
		else if ( control.storage.startsWith( 'attributes.' ) )
			updateBlockAttribute(
				selectedBlock.id,
				control.storage.slice( 11 ),
				value
			);
		else if ( control.storage.startsWith( 'props.' ) )
			updateBlockProp(
				selectedBlock.id,
				control.storage.slice( 6 ),
				value
			);
		localUpdateHistoryStatus( `Updated ${ control.label.toLowerCase() }` );
	}

	return (
		<div className="space-y-5 p-4">
			{ disabled ? (
				<p className="m-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
					This element is locked and its stored fields are read-only.
				</p>
			) : null }
			{ inspectorModel.identity.legacy ? (
				<p className="m-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
					This imported element is preserved through the compatibility
					inspector. Its unknown structure is not converted into
					generic controls.
				</p>
			) : null }
			<fieldset
				disabled={ disabled }
				className="m-0 space-y-5 border-0 p-0"
			>
				{ controls.map( ( control ) => (
					<ContentField
						key={ `${ selectedBlock.id }:${ control.id }` }
						control={ control }
						disabled={ disabled }
						onCommit={ ( value ) =>
							commitControl( control, value )
						}
					/>
				) ) }
				{ ! controls.length && ! inspectorModel.identity.legacy ? (
					<p className="m-0 text-[11px] leading-5 text-gray-500">
						This element has no editable content. Use Style for its
						dimensions and Advanced for visibility or attributes.
					</p>
				) : null }
			</fieldset>
			{ ! inspectorModel.identity.legacy ? (
				<details className="border-t border-gray-100 pt-4">
					<summary className="cursor-pointer text-[11px] font-medium text-gray-600">
						Dynamic and reusable content
					</summary>
					<div className="mt-4 space-y-4">
						<BlockDynamicControl
							block={ selectedBlock }
							onChange={ ( id, isDynamic, dynamicSource ) => {
								setBlockDynamicProperties(
									id,
									isDynamic,
									dynamicSource
								);
								localUpdateHistoryStatus(
									'Updated dynamic binding'
								);
							} }
						/>
						<BlockSlotControl
							block={ selectedBlock }
							onChange={ ( id, isSlot, label, type ) => {
								setBlockSlotProperties(
									id,
									isSlot,
									label,
									type
								);
								localUpdateHistoryStatus(
									'Updated slot properties'
								);
							} }
						/>
					</div>
				</details>
			) : null }
		</div>
	);
}

function VisibilityPanel( {
	selectedBlock,
	setBlockHidden,
	localUpdateHistoryStatus,
} ) {
	return (
		<section className="border-b border-gray-100 p-4">
			<h3 className="m-0 mb-3 text-xs font-semibold text-gray-800">
				Visibility
			</h3>
			<div className="rounded-md border border-gray-200">
				{ [ 'desktop', 'tablet', 'mobile' ].map( ( device, index ) => (
					<div
						key={ device }
						className={ `flex items-center justify-between px-3 py-2.5 ${
							index ? 'border-t border-gray-100' : ''
						}` }
					>
						<span className="text-[11px] capitalize text-gray-600">
							{ device }
						</span>
						<InspectorToggle
							checked={ ! isBlockHidden( selectedBlock, device ) }
							label={ `Show on ${ device }` }
							disabled={ selectedBlock.permissions?.locked }
							onClick={ () => {
								const visible = ! isBlockHidden(
									selectedBlock,
									device
								);
								setBlockHidden(
									selectedBlock.id,
									device,
									visible
								);
								localUpdateHistoryStatus(
									`${
										visible ? 'Hidden' : 'Shown'
									} on ${ device }`
								);
							} }
						/>
					</div>
				) ) }
			</div>
		</section>
	);
}

export default function RightInspector( {
	BlockDynamicControl,
	BlockSlotControl,
	selectedBlock,
	inspectorModel,
	activeTab,
	setActiveTab,
	duplicateBlock,
	deleteBlock,
	documentRootId,
	updateBlockContent,
	updateBlockAttribute,
	updateBlockProp,
	updateBlockTag,
	setBlockHidden,
	setBlockDynamicProperties,
	setBlockSlotProperties,
	localUpdateHistoryStatus,
	styleTabContent,
	advancedTabContent,
	navigatorDock,
} ) {
	const [ searchQuery, setSearchQuery ] = useState( '' );
	if ( ! selectedBlock || ! inspectorModel ) {
		return (
			<aside
				className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white md:flex"
				data-purpose="right-panel"
			>
				<div className="flex flex-1 items-center justify-center p-8 text-center text-xs leading-5 text-gray-400">
					Select an element to edit its content and styles.
				</div>
			</aside>
		);
	}
	const isRootOrLocked =
		selectedBlock.id === documentRootId ||
		selectedBlock.permissions?.locked;
	const tabLabels = inspectorModel.tabs;
	const contentPanel = panelSearch(
		inspectorModel.tabs.content,
		searchQuery
	);
	const advancedPanel = panelSearch(
		inspectorModel.tabs.advanced,
		searchQuery
	);
	const advancedGroupIds = advancedPanel.groups.map( ( group ) => group.id );
	const resolvedStyleTabContent =
		typeof styleTabContent === 'function'
			? styleTabContent( searchQuery )
			: styleTabContent;
	const resolvedAdvancedTabContent =
		typeof advancedTabContent === 'function'
			? advancedTabContent( {
					searchQuery,
					groupIds: advancedGroupIds,
			  } )
			: advancedTabContent;

	return (
		<aside
			className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white md:flex"
			data-purpose="right-panel"
		>
			<header className="shrink-0 border-b border-gray-200 px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div className="min-w-0">
						<h2 className="m-0 truncate text-sm font-semibold text-gray-900">
							{ inspectorModel.identity.label }
						</h2>
						<p className="m-0 mt-0.5 truncate text-[10px] text-gray-400">
							{ inspectorModel.identity.id } · #
							{ selectedBlock.id }
						</p>
					</div>
					<div className="flex items-center gap-1">
						<button
							type="button"
							className="flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-30"
							disabled={ isRootOrLocked }
							title="Duplicate element"
							onClick={ () => {
								duplicateBlock( selectedBlock.id );
								localUpdateHistoryStatus(
									'Duplicated element'
								);
							} }
						>
							<i
								className="fa-regular fa-clone text-xs"
								aria-hidden="true"
							></i>
						</button>
						<button
							type="button"
							className="flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-30"
							disabled={ isRootOrLocked }
							title="Delete element"
							onClick={ () => {
								deleteBlock( selectedBlock.id );
								localUpdateHistoryStatus( 'Deleted element' );
							} }
						>
							<i
								className="fa-regular fa-trash-can text-xs"
								aria-hidden="true"
							></i>
						</button>
					</div>
				</div>
				{ inspectorModel.inference.confidence < 1 ? (
					<p className="m-0 mt-2 text-[10px] leading-4 text-amber-700">
						Detected from { inspectorModel.inference.reason }.
					</p>
				) : null }
			</header>

			<div
				className="grid shrink-0 grid-cols-3 border-b border-gray-200 bg-white px-3"
				role="tablist"
				aria-label="Element settings"
			>
				{ [ 'content', 'style', 'advanced' ].map( ( tab ) => (
					<button
						key={ tab }
						type="button"
						className={ `border-0 border-b-2 bg-transparent px-2 py-3 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
							activeTab === tab
								? 'border-indigo-600 text-indigo-600'
								: 'border-transparent text-gray-500 hover:text-gray-800'
						}` }
						role="tab"
						aria-selected={ activeTab === tab }
						onClick={ () => setActiveTab( tab ) }
					>
						{ tabLabels[ tab ].label }
					</button>
				) ) }
			</div>

			<div className="shrink-0 border-b border-gray-100 p-3">
				<label
					className="relative block"
					htmlFor="ctb-inspector-search"
				>
					<span className="sr-only">
						Search this element's settings
					</span>
					<input
						id="ctb-inspector-search"
						type="search"
						value={ searchQuery }
						onChange={ ( event ) =>
							setSearchQuery( event.target.value )
						}
						placeholder={ `Search ${ inspectorModel.identity.label } settings` }
						className={ INPUT_CLASS }
					/>
				</label>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{ activeTab === 'content' ? (
					<ElementContentPanel
						inspectorModel={ {
							...inspectorModel,
							tabs: {
								...inspectorModel.tabs,
								content: contentPanel,
							},
						} }
						selectedBlock={ selectedBlock }
						updateBlockContent={ updateBlockContent }
						updateBlockAttribute={ updateBlockAttribute }
						updateBlockProp={ updateBlockProp }
						updateBlockTag={ updateBlockTag }
						localUpdateHistoryStatus={ localUpdateHistoryStatus }
						BlockDynamicControl={ BlockDynamicControl }
						BlockSlotControl={ BlockSlotControl }
						setBlockDynamicProperties={ setBlockDynamicProperties }
						setBlockSlotProperties={ setBlockSlotProperties }
					/>
				) : null }
				{ activeTab === 'style' ? resolvedStyleTabContent : null }
				{ activeTab === 'advanced' ? (
					<>
						{ advancedGroupIds.includes( 'visibility' ) ? (
							<VisibilityPanel
								selectedBlock={ selectedBlock }
								setBlockHidden={ setBlockHidden }
								localUpdateHistoryStatus={
									localUpdateHistoryStatus
								}
							/>
						) : null }
						{ resolvedAdvancedTabContent }
						{ navigatorDock ? (
							<div className="border-t border-gray-200">
								{ navigatorDock }
							</div>
						) : null }
					</>
				) : null }
			</div>
		</aside>
	);
}
