import { useEffect, useState } from '@wordpress/element';
import '../../editor.css';
import { controlVisibilityReason, isMappedControlVisible, normalizeCustomCssFallback, STYLE_CONTROL_FIELDS } from '../../custom-css.mjs';
import { tokenCssValue } from '../../design-tokens.mjs';
import { createImportCodeService } from '../../importer/ImportCodeService.mjs';
import { BREAKPOINTS, isBlockHidden, isHiddenOverridden } from '../../responsive-styles.mjs';
import { roleBindingForProperty } from '../../semantic-roles.mjs';
import { TokenBindingControl } from '../controls/TokenControls.js';
import { ScrubbableInput } from '../controls/ScrubbableInput.js';

export function BlockVisibilityControl( { block, breakpoint, onToggle } ) {
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

export function BreakpointSwitcher( { value, onChange, compact = false } ) {
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

export function ResponsiveColorOverride( { breakpoint, color, ownColor, onClear } ) {
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

export function MappedStyleControls( {
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

export function RawCssControl( { styleSet, breakpoint, onApply } ) {
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

