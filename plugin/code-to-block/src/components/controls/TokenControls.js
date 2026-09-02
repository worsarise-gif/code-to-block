import '../../editor.css';
import { getDesignToken, tokenCssValue, tokensForProperty } from '../../design-tokens.mjs';
import { createImportCodeService } from '../../importer/ImportCodeService.mjs';

export function TokenBindingControl( {
	designTokens,
	property,
	breakpoint,
	styleSet,
	effectiveMapped,
	effectiveBindings,
	onLink,
	onRemove,
	onOverride,
} ) {
	const ownReference = styleSet.token_bindings?.[ property ] || '';
	const effectiveReference = effectiveBindings[ property ] || '';
	const compatibleTokens = tokensForProperty( designTokens, property ).filter(
		( token ) =>
			token.reference === effectiveReference ||
			window.CSS.supports( property, token.value )
	);
	if ( ! compatibleTokens.length && ! effectiveReference ) {
		return null;
	}
	const activeToken = getDesignToken( designTokens, effectiveReference );
	const isOverride = Boolean(
		effectiveReference &&
			effectiveMapped[ property ] !== tokenCssValue( effectiveReference )
	);

	function changeBinding( nextReference ) {
		if ( nextReference ) {
			onLink( property, nextReference );
		} else if ( ownReference ) {
			onRemove( property, ownReference );
		} else if ( effectiveReference ) {
			onOverride( property, effectiveReference );
		}
	}

	let status = 'Local value';
	if ( activeToken ) {
		let mode = 'inherited';
		if ( isOverride ) {
			mode = ownReference ? 'overridden here' : 'inherited override';
		} else if ( ownReference || breakpoint === 'desktop' ) {
			mode = 'linked';
		}
		status = `${ activeToken.label } · ${ mode }`;
	}

	return (
		<div
			className={ `ctb-token-binding${
				isOverride ? ' is-overridden' : ''
			}` }
		>
			<label htmlFor={ `ctb-${ breakpoint }-${ property }-token` }>
				<span>Global token</span>
				<select
					id={ `ctb-${ breakpoint }-${ property }-token` }
					aria-label={ `${ breakpoint } ${ property } global token` }
					value={ effectiveReference }
					onChange={ ( event ) =>
						changeBinding( event.target.value )
					}
				>
					<option value="">Local value</option>
					{ compatibleTokens.map( ( token ) => (
						<option
							key={ token.reference }
							value={ token.reference }
						>
							{ token.label } · { token.value }
						</option>
					) ) }
				</select>
			</label>
			<div className="ctb-token-binding-status">
				<span>{ status }</span>
				{ effectiveReference ? (
					<button
						type="button"
						onClick={ () =>
							isOverride
								? onLink( property, effectiveReference )
								: onOverride( property, effectiveReference )
						}
					>
						{ isOverride
							? 'Restore global'
							: 'Override this block' }
					</button>
				) : null }
			</div>
		</div>
	);
}

