export const BREAKPOINTS = [
	{ id: 'desktop', label: 'Desktop', width: '100%' },
	{ id: 'tablet', label: 'Tablet', width: '768px' },
	{ id: 'mobile', label: 'Mobile', width: '390px' },
];

const EMPTY_STYLE_SET = Object.freeze( {
	mapped: Object.freeze( {} ),
	custom_css_fallback: '',
} );

export function breakpointCascade( breakpoint ) {
	if ( breakpoint === 'mobile' ) {
		return [ 'tablet', 'mobile' ];
	}
	return breakpoint === 'tablet' ? [ 'tablet' ] : [];
}

export function ownStyleSet( block, breakpoint ) {
	if ( breakpoint === 'desktop' ) {
		return block.styles;
	}
	return block.responsive_overrides?.[ breakpoint ] || EMPTY_STYLE_SET;
}

export function inheritedMappedStyles( block, breakpoint ) {
	if ( breakpoint === 'desktop' ) {
		return {};
	}
	const inherited = { ...block.styles.mapped };
	if ( breakpoint === 'mobile' ) {
		Object.assign(
			inherited,
			block.responsive_overrides?.tablet?.mapped || {}
		);
	}
	return inherited;
}

export function effectiveMappedStyles( block, breakpoint ) {
	return {
		...inheritedMappedStyles( block, breakpoint ),
		...ownStyleSet( block, breakpoint ).mapped,
	};
}

export function styleSetIsEmpty( styleSet ) {
	return (
		Object.keys( styleSet.mapped || {} ).length === 0 &&
		Object.keys( styleSet.token_bindings || {} ).length === 0 &&
		! String( styleSet.custom_css_fallback || '' ).trim()
	);
}

/**
 * Mutates a cloned block and removes optional empty responsive branches.
 *
 * @param {Object} block      Block from a cloned document.
 * @param {string} breakpoint Active editor breakpoint.
 * @param {Object} styleSet   Replacement style set.
 */
export function setOwnStyleSet( block, breakpoint, styleSet ) {
	if ( breakpoint === 'desktop' ) {
		block.styles = styleSet;
		return;
	}

	if ( styleSetIsEmpty( styleSet ) ) {
		if ( block.responsive_overrides ) {
			delete block.responsive_overrides[ breakpoint ];
			if ( Object.keys( block.responsive_overrides ).length === 0 ) {
				delete block.responsive_overrides;
			}
		}
		return;
	}

	block.responsive_overrides = {
		...( block.responsive_overrides || {} ),
		[ breakpoint ]: styleSet,
	};
}

export function countStyleOverrides( styleSet ) {
	return (
		Object.keys( styleSet.mapped || {} ).length +
		( String( styleSet.custom_css_fallback || '' ).trim() ? 1 : 0 )
	);
}

function fallbackContainsDisplayNone( fallback ) {
	return String( fallback || '' )
		.split( ';' )
		.some( ( part ) =>
			/^display\s*:\s*none\s*(?:!important)?\s*$/i.test( part.trim() )
		);
}

export function isBlockHidden( block, breakpoint ) {
	const own = ownStyleSet( block, breakpoint );
	if ( fallbackContainsDisplayNone( own.custom_css_fallback ) ) {
		return true;
	}
	if ( breakpoint === 'tablet' ) {
		const baseHidden = fallbackContainsDisplayNone(
			block.styles.custom_css_fallback
		);
		if ( baseHidden ) {
			const tabletHasDisplayBlock = String(
				own.custom_css_fallback || ''
			)
				.split( ';' )
				.some( ( part ) =>
					/^display\s*:\s*block\s*(?:!important)?\s*$/i.test(
						part.trim()
					)
				);
			if ( ! tabletHasDisplayBlock ) {
				return true;
			}
		}
	}
	if ( breakpoint === 'mobile' ) {
		const baseHidden = fallbackContainsDisplayNone(
			block.styles.custom_css_fallback
		);
		const tabletHidden = fallbackContainsDisplayNone(
			block.responsive_overrides?.tablet?.custom_css_fallback
		);
		if ( baseHidden || tabletHidden ) {
			const mobileHasDisplayBlock = String(
				own.custom_css_fallback || ''
			)
				.split( ';' )
				.some( ( part ) =>
					/^display\s*:\s*block\s*(?:!important)?\s*$/i.test(
						part.trim()
					)
				);
			if ( ! mobileHasDisplayBlock ) {
				return true;
			}
		}
	}
	return false;
}

export function isHiddenOverridden( block, breakpoint ) {
	return fallbackContainsDisplayNone(
		ownStyleSet( block, breakpoint ).custom_css_fallback
	);
}
