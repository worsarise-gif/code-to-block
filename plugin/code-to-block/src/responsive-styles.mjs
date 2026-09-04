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
		return block?.styles || EMPTY_STYLE_SET;
	}
	return block?.responsive_overrides?.[ breakpoint ] || EMPTY_STYLE_SET;
}

export function inheritedMappedStyles( block, breakpoint ) {
	if ( breakpoint === 'desktop' ) {
		return {};
	}
	const inherited = { ...( block?.styles?.mapped || {} ) };
	if ( breakpoint === 'mobile' ) {
		Object.assign(
			inherited,
			block?.responsive_overrides?.tablet?.mapped || {}
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

function fallbackDisplay( fallback ) {
	let display = null;
	for ( const part of String( fallback || '' ).split( ';' ) ) {
		const match = /^display\s*:\s*([^;!]+?)\s*(!important)?\s*$/i.exec(
			part.trim()
		);
		if ( match ) {
			display = {
				value: match[ 1 ].trim().toLowerCase(),
				important: Boolean( match[ 2 ] ),
			};
		}
	}
	return display;
}

function styleSetDisplay( styleSet ) {
	const mapped = String( styleSet?.mapped?.display || '' )
		.replace( /\s*!important\s*$/i, '' )
		.trim()
		.toLowerCase();
	const fallback = fallbackDisplay( styleSet?.custom_css_fallback );
	if ( fallback && ( fallback.important || ! mapped ) ) {
		return fallback.value;
	}
	return mapped || null;
}

export function isBlockHidden( block, breakpoint ) {
	let hidden = false;
	for ( const styleSet of [
		block?.styles,
		...breakpointCascade( breakpoint ).map(
			( viewport ) => block?.responsive_overrides?.[ viewport ]
		),
	] ) {
		const display = styleSetDisplay( styleSet );
		if ( display ) {
			hidden = display === 'none';
		}
	}
	return hidden;
}

export function isHiddenOverridden( block, breakpoint ) {
	return styleSetDisplay( ownStyleSet( block, breakpoint ) ) === 'none';
}
