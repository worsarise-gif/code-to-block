import { useEffect, useRef, useState } from '@wordpress/element';

import {
	auditGuidedRoles,
	blockText,
	diagnoseGuidedStyles,
	evaluateRoleFit,
	recommendStyleRoles,
	roleCatalog,
	roleDescription,
	roleLabel,
	roleTokenReferences,
} from '../semantic-roles.mjs';

const BREAKPOINT_WIDTHS = {
	desktop: 720,
	tablet: 560,
	mobile: 320,
};

const ROLE_FONT_SIZES = {
	'type.page-title': { desktop: 80, tablet: 58, mobile: 40 },
	'type.section-heading': { desktop: 52, tablet: 42, mobile: 32 },
	'type.card-heading': { desktop: 28, tablet: 25, mobile: 20 },
	'type.intro': { desktop: 22, tablet: 20, mobile: 18 },
	'type.body': { desktop: 18, tablet: 17, mobile: 16 },
	'type.supporting': { desktop: 16, tablet: 15, mobile: 14 },
	'type.action': { desktop: 16, tablet: 16, mobile: 16 },
	'type.label': { desktop: 14, tablet: 14, mobile: 14 },
};

function tokenValue( designTokens, reference ) {
	const [ category, id ] = String( reference || '' ).split( '.' );
	return designTokens?.[ category ]?.[ id ]?.value || '';
}

function previewStyle( document, roleId, breakpoint ) {
	const recipe = roleCatalog( document )[ roleId ];
	if ( ! recipe || recipe.kind !== 'typography' ) {
		return {};
	}
	const binding = {
		roleId,
		kind: 'typography',
		typographyAdjustment: { size: 0, density: 0 },
		overrides: [],
	};
	const references = roleTokenReferences( recipe, binding, 'typography' );
	return {
		fontFamily: tokenValue(
			document.design_tokens,
			references[ 'font-family' ]
		),
		fontSize: `${ ROLE_FONT_SIZES[ roleId ]?.[ breakpoint ] || 16 }px`,
		fontWeight: tokenValue(
			document.design_tokens,
			references[ 'font-weight' ]
		),
		lineHeight: tokenValue(
			document.design_tokens,
			references[ 'line-height' ]
		),
		letterSpacing: tokenValue(
			document.design_tokens,
			references[ 'letter-spacing' ]
		),
	};
}

function moveRadioFocus( event ) {
	if (
		! [ 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft' ].includes(
			event.key
		)
	) {
		return;
	}
	event.preventDefault();
	const buttons = Array.from(
		event.currentTarget
			.closest( '[role="radiogroup"]' )
			?.querySelectorAll( '[role="radio"]:not(:disabled)' ) || []
	);
	const current = buttons.indexOf( event.currentTarget );
	const direction = [ 'ArrowDown', 'ArrowRight' ].includes( event.key )
		? 1
		: -1;
	buttons[
		( current + direction + buttons.length ) % buttons.length
	]?.focus();
}

function RoleCard( {
	document,
	role,
	selected,
	text,
	previewBreakpoint,
	onSelect,
	onPreview,
	onCancelPreview,
} ) {
	const isTypography = role.roleId.startsWith( 'type.' );
	const fontSize =
		ROLE_FONT_SIZES[ role.roleId ]?.[ previewBreakpoint ] || 16;
	const fit = isTypography
		? evaluateRoleFit( {
				roleId: role.roleId,
				text,
				containerWidth: BREAKPOINT_WIDTHS[ previewBreakpoint ],
				breakpoint: previewBreakpoint,
				fontSizePx: fontSize,
				lineHeight: 1.2,
		  } )
		: { status: 'safe' };
	return (
		<button
			type="button"
			role="radio"
			aria-checked={ selected }
			className={ `ctb-guided-role-card${
				selected ? ' is-selected' : ''
			}${ role.recommended ? ' is-recommended' : '' }` }
			onMouseEnter={ () => onPreview( role.roleId ) }
			onMouseLeave={ onCancelPreview }
			onFocus={ () => onPreview( role.roleId ) }
			onBlur={ onCancelPreview }
			onKeyDown={ ( event ) => {
				if ( event.key === 'Escape' ) {
					event.preventDefault();
					onCancelPreview();
					event.currentTarget.blur();
					return;
				}
				moveRadioFocus( event );
			} }
			onClick={ () => onSelect( role.roleId ) }
		>
			<span className="ctb-guided-role-card-heading">
				<strong>{ roleLabel( role.roleId ) }</strong>
				{ role.recommended ? <span>Recommended</span> : null }
			</span>
			{ isTypography ? (
				<span
					className="ctb-guided-role-preview"
					style={ previewStyle(
						document,
						role.roleId,
						previewBreakpoint
					) }
				>
					{ text || 'Your text appears here' }
				</span>
			) : (
				<span
					className={ `ctb-guided-spacing-preview is-${ role.roleId.replace(
						'.',
						'-'
					) }` }
				>
					<span></span>
					<span></span>
				</span>
			) }
			<span className="ctb-guided-role-description">
				{ roleDescription( role.roleId ) }
			</span>
			{ role.recommended ? (
				<span className="ctb-guided-role-reason">{ role.reason }</span>
			) : null }
			<span className="ctb-guided-role-meta">
				Responsive and globally linked
				{ fit.status !== 'safe'
					? ` | ${ fit.status } at ${ previewBreakpoint }`
					: '' }
			</span>
		</button>
	);
}

function RelativeControl( { binding, scope, onAdjust } ) {
	if ( binding.kind === 'typography' ) {
		const size = binding.typographyAdjustment?.size || 0;
		const density = binding.typographyAdjustment?.density || 0;
		return (
			<div
				className="ctb-guided-adjustments"
				aria-label="Relative typography adjustments"
			>
				<fieldset>
					<legend>Size</legend>
					{ [
						[ -1, 'Smaller' ],
						[ 0, 'Default' ],
						[ 1, 'Larger' ],
					].map( ( [ value, label ] ) => (
						<button
							key={ label }
							type="button"
							aria-pressed={ size === value }
							onClick={ () => onAdjust( scope, { size: value } ) }
						>
							{ label }
						</button>
					) ) }
				</fieldset>
				<fieldset>
					<legend>Density</legend>
					{ [
						[ -1, 'Tighter' ],
						[ 0, 'Default' ],
						[ 1, 'Looser' ],
					].map( ( [ value, label ] ) => (
						<button
							key={ label }
							type="button"
							aria-pressed={ density === value }
							onClick={ () =>
								onAdjust( scope, { density: value } )
							}
						>
							{ label }
						</button>
					) ) }
				</fieldset>
			</div>
		);
	}
	const distance = binding.spacingAdjustment?.distance || 0;
	return (
		<fieldset className="ctb-guided-adjustments is-spacing">
			<legend>Distance</legend>
			{ [
				[ -1, 'Closer' ],
				[ 0, 'Default' ],
				[ 1, 'Farther' ],
			].map( ( [ value, label ] ) => (
				<button
					key={ label }
					type="button"
					aria-pressed={ distance === value }
					onClick={ () => onAdjust( scope, { distance: value } ) }
				>
					{ label }
				</button>
			) ) }
		</fieldset>
	);
}

function RolePicker( {
	document,
	block,
	styleSet,
	property,
	scope,
	label,
	previewBreakpoint,
	onSelect,
	onAdjust,
	onPreview,
	onCancelPreview,
} ) {
	const candidates = recommendStyleRoles( document, block.id, { property } );
	const binding = styleSet.role_bindings?.[ scope ];
	const candidateIds = new Set( candidates.map( ( item ) => item.roleId ) );
	const text = blockText( block );
	return (
		<section
			className="ctb-guided-role-picker"
			aria-labelledby={ `ctb-guided-${ block.id }-${ scope }` }
		>
			<div className="ctb-guided-role-picker-heading">
				<div>
					<h5 id={ `ctb-guided-${ block.id }-${ scope }` }>
						{ label }
					</h5>
					<p>
						Choose by purpose. The responsive values stay linked to
						your site.
					</p>
				</div>
				{ binding ? (
					<span className="ctb-guided-linked-badge">Linked</span>
				) : null }
			</div>
			{ binding && ! candidateIds.has( binding.roleId ) ? (
				<div className="ctb-guided-current-role">
					<span>Current role</span>
					<strong>{ roleLabel( binding.roleId ) }</strong>
				</div>
			) : null }
			<div
				role="radiogroup"
				aria-label={ `${ label } choices` }
				className="ctb-guided-role-list"
			>
				{ candidates.map( ( role ) => (
					<RoleCard
						key={ role.roleId }
						document={ document }
						role={ role }
						selected={ binding?.roleId === role.roleId }
						text={ text }
						previewBreakpoint={ previewBreakpoint }
						onSelect={ ( roleId ) => onSelect( roleId, scope ) }
						onPreview={ ( roleId ) => onPreview( roleId, scope ) }
						onCancelPreview={ onCancelPreview }
					/>
				) ) }
			</div>
			{ binding ? (
				<RelativeControl
					binding={ binding }
					scope={ scope }
					onAdjust={ onAdjust }
				/>
			) : null }
		</section>
	);
}

export function GuidedRolePanel( {
	document,
	block,
	styleSet,
	effectiveMapped,
	onSelectRole,
	onAdjustRole,
	onPreviewRole,
	onCancelPreview,
	onRejoin,
	onResolveImportReview,
} ) {
	const [ previewBreakpoint, setPreviewBreakpoint ] = useState( 'desktop' );
	const typographyVisible =
		block.type === 'text' ||
		block.type === 'button' ||
		/^h[1-6]$/.test( block.tag ) ||
		[ 'p', 'label', 'small', 'a', 'button' ].includes( block.tag );
	const spacingScopes = [];
	if ( block.type === 'container' || block.type === 'button' ) {
		spacingScopes.push( {
			property: 'padding',
			scope: 'padding',
			label:
				block.tag === 'section'
					? 'Section spacing'
					: 'Component padding',
		} );
	}
	if (
		[ 'flex', 'inline-flex', 'grid', 'inline-grid' ].includes(
			effectiveMapped.display
		)
	) {
		spacingScopes.push( {
			property: 'gap',
			scope: 'gap',
			label: 'Content gap',
		} );
	}
	const diagnostics = diagnoseGuidedStyles( document, block.id );
	return (
		<div className="ctb-guided-role-panel">
			<div
				className="ctb-guided-preview-breakpoints"
				aria-label="Role preview breakpoint"
			>
				<span>Preview</span>
				{ [ 'desktop', 'tablet', 'mobile' ].map( ( item ) => (
					<button
						key={ item }
						type="button"
						aria-pressed={ previewBreakpoint === item }
						onClick={ () => setPreviewBreakpoint( item ) }
					>
						{ item }
					</button>
				) ) }
			</div>
			{ typographyVisible ? (
				<RolePicker
					document={ document }
					block={ block }
					styleSet={ styleSet }
					property="font-size"
					scope="typography"
					label="Visual role"
					previewBreakpoint={ previewBreakpoint }
					onSelect={ onSelectRole }
					onAdjust={ onAdjustRole }
					onPreview={ onPreviewRole }
					onCancelPreview={ onCancelPreview }
				/>
			) : null }
			{ spacingScopes.map( ( item ) => (
				<RolePicker
					key={ item.scope }
					document={ document }
					block={ block }
					styleSet={ styleSet }
					property={ item.property }
					scope={ item.scope }
					label={ item.label }
					previewBreakpoint={ previewBreakpoint }
					onSelect={ onSelectRole }
					onAdjust={ onAdjustRole }
					onPreview={ onPreviewRole }
					onCancelPreview={ onCancelPreview }
				/>
			) ) }
			{ styleSet.import_review_flags?.length ? (
				<section
					className="ctb-guided-import-review"
					aria-label="Imported style review"
				>
					<h5>Review imported differences</h5>
					{ styleSet.import_review_flags.map( ( flag ) => (
						<div key={ flag.id }>
							<p>{ flag.message }</p>
							<small>
								{ flag.property } · { roleLabel( flag.roleId ) }
							</small>
							<span>
								<button
									type="button"
									onClick={ () =>
										onResolveImportReview( flag.id, true )
									}
								>
									Use site role — Recommended
								</button>
								<button
									type="button"
									onClick={ () =>
										onResolveImportReview( flag.id, false )
									}
								>
									Keep imported difference
								</button>
							</span>
						</div>
					) ) }
				</section>
			) : null }
			{ diagnostics.length ? (
				<section
					className="ctb-guided-diagnostics"
					aria-label="Guided style notices"
				>
					<h5>Style notices</h5>
					{ diagnostics.map( ( issue, index ) => (
						<div
							key={ `${ issue.id }-${ index }` }
							className={ `is-${ issue.severity }` }
						>
							<p>{ issue.message }</p>
							{ issue.fix === 'rejoin' ? (
								<button
									type="button"
									onClick={ () =>
										onRejoin( issue.scope, issue.property )
									}
								>
									{ issue.action }
								</button>
							) : (
								<span>{ issue.action }</span>
							) }
						</div>
					) ) }
				</section>
			) : null }
		</div>
	);
}

export function GuidedRoleStatus( { styleSet, onRejoin } ) {
	const bindings = Object.entries( styleSet.role_bindings || {} );
	if ( ! bindings.length ) {
		return (
			<div className="ctb-guided-advanced-status is-unbound">
				<strong>No guided role selected</strong>
				<span>Exact values are local to this element.</span>
			</div>
		);
	}
	return (
		<div className="ctb-guided-advanced-status">
			{ bindings.map( ( [ scope, binding ] ) => (
				<div key={ scope }>
					<span>{ scope }</span>
					<strong>{ roleLabel( binding.roleId ) }</strong>
					{ binding.overrides?.length ? (
						<>
							<em>Local override</em>
							{ binding.overrides.map( ( override ) => (
								<button
									key={ `${ override.property }-${
										override.breakpoint || ''
									}-${ override.state || '' }` }
									type="button"
									onClick={ () =>
										onRejoin( scope, override.property )
									}
								>
									Rejoin { roleLabel( binding.roleId ) } for{ ' ' }
									{ override.property }
								</button>
							) ) }
						</>
					) : (
						<small>Globally linked</small>
					) }
				</div>
			) ) }
		</div>
	);
}

export function GuidedRolesManager( {
	document,
	onRestoreRole,
	onSelectElement,
	onRejoinOverride,
} ) {
	const roles = auditGuidedRoles( document );
	return (
		<details className="ctb-guided-manager">
			<summary>
				<span>Guided roles</span>
				<small>{ roles.length } roles</small>
			</summary>
			<p className="ctb-guided-manager-help">
				Roles reuse the design tokens below. Global token edits update
				every linked use.
			</p>
			<div className="ctb-guided-manager-list">
				{ roles.map( ( role ) => (
					<details key={ role.id }>
						<summary>
							<span>
								<strong>{ role.label }</strong>
								<small>{ role.kind }</small>
							</span>
							<span>
								{ role.uses } uses, { role.overriddenElements }{ ' ' }
								overridden
							</span>
						</summary>
						<p>{ role.description }</p>
						<div className="ctb-guided-manager-references">
							<strong>Backing tokens</strong>
							<span>{ role.tokenReferences.join( ', ' ) }</span>
						</div>
						<div className="ctb-guided-manager-meta">
							<span>
								{ role.builtIn ? 'Built in' : 'User role' }
							</span>
							{ role.userModified ? (
								<span>User modified</span>
							) : null }
						</div>
						{ role.builtIn && role.userModified ? (
							<button
								type="button"
								onClick={ () => onRestoreRole( role.id ) }
							>
								Restore Balanced defaults
							</button>
						) : null }
						{ role.elements.length ? (
							<div className="ctb-guided-manager-uses">
								<strong>Linked elements</strong>
								{ role.elements.map( ( element, index ) => (
									<div
										key={ `${ element.blockId }-${
											element.scope
										}-${ element.breakpoint || '' }-${
											element.state || ''
										}-${ index }` }
									>
										<button
											type="button"
											onClick={ () =>
												onSelectElement(
													element.blockId
												)
											}
										>
											{ element.tag } ·{ ' ' }
											{ element.blockId }
										</button>
										<small>
											{ element.scope }
											{ element.breakpoint
												? ` · ${ element.breakpoint }`
												: '' }
											{ element.state
												? ` · ${ element.state }`
												: '' }
										</small>
										{ element.overrides.map(
											( override ) => (
												<button
													key={ `${
														override.property
													}-${
														override.breakpoint ||
														''
													}-${
														override.state || ''
													}` }
													type="button"
													onClick={ () =>
														onRejoinOverride(
															element,
															override
														)
													}
												>
													Rejoin { override.property }
												</button>
											)
										) }
									</div>
								) ) }
							</div>
						) : null }
					</details>
				) ) }
			</div>
		</details>
	);
}

export function RoleEditDecisionDialog( {
	pending,
	affectedCount,
	onGlobal,
	onLocal,
	onCancel,
} ) {
	const firstButton = useRef( null );
	useEffect( () => {
		if ( ! pending ) {
			return undefined;
		}
		firstButton.current?.focus();
		const handleKeyDown = ( event ) => {
			if ( event.key === 'Escape' ) {
				event.preventDefault();
				onCancel();
			}
		};
		window.addEventListener( 'keydown', handleKeyDown );
		return () => window.removeEventListener( 'keydown', handleKeyDown );
	}, [ onCancel, pending ] );
	if ( ! pending ) {
		return null;
	}
	const label = roleLabel( pending.binding.roleId );
	return (
		<div className="ctb-guided-dialog-backdrop">
			<section
				className="ctb-guided-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="ctb-guided-edit-title"
			>
				<h3 id="ctb-guided-edit-title">
					Where should this exact change apply?
				</h3>
				<p>
					This { pending.property } currently comes from { label }.
					Choose whether to change every linked use or only this
					element.
				</p>
				<div className="ctb-guided-dialog-actions">
					<button
						ref={ firstButton }
						type="button"
						className="is-primary"
						onClick={ onGlobal }
					>
						Update { label } everywhere
						<small>
							{ affectedCount } affected element
							{ affectedCount === 1 ? '' : 's' }
						</small>
					</button>
					<button type="button" onClick={ onLocal }>
						Create a local override for this element
					</button>
					<button
						type="button"
						className="is-cancel"
						onClick={ onCancel }
					>
						Cancel
					</button>
				</div>
			</section>
		</div>
	);
}
