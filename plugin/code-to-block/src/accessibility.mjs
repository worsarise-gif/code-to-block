/**
 * Accessibility checker — helps identify common issues, never claims compliance.
 * Language intentionally avoids "compliant/compliance" per FTC accessiBe precedent.
 */

function hexToRgb( hex ) {
	hex = hex.trim().replace( /^#/, '' );
	if ( hex.length === 3 ) {
		hex = hex
			.split( '' )
			.map( ( c ) => c + c )
			.join( '' );
	}
	if ( hex.length !== 6 ) {
		return null;
	}
	const n = parseInt( hex, 16 );
	if ( isNaN( n ) ) {
		return null;
	}
	return { r: ( n >> 16 ) & 255, g: ( n >> 8 ) & 255, b: n & 255 };
}

function parseRgb( str ) {
	const m = String( str )
		.trim()
		.match(
			/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+)?\s*\)$/i
		);
	if ( ! m ) {
		return null;
	}
	return {
		r: parseInt( m[ 1 ], 10 ),
		g: parseInt( m[ 2 ], 10 ),
		b: parseInt( m[ 3 ], 10 ),
	};
}

function parseColor( value ) {
	value = String( value ).trim().toLowerCase();
	if ( value.startsWith( '#' ) ) {
		return hexToRgb( value );
	}
	if ( value.startsWith( 'rgb' ) ) {
		return parseRgb( value );
	}
	// named colors minimal
	const named = {
		black: { r: 0, g: 0, b: 0 },
		white: { r: 255, g: 255, b: 255 },
		red: { r: 255, g: 0, b: 0 },
		blue: { r: 0, g: 0, b: 255 },
		gray: { r: 128, g: 128, b: 128 },
		grey: { r: 128, g: 128, b: 128 },
	};
	if ( named[ value ] ) {
		return named[ value ];
	}
	return null;
}

function luminance( { r, g, b } ) {
	const s = [ r, g, b ].map( ( v ) => {
		v /= 255;
		return v <= 0.03928
			? v / 12.92
			: Math.pow( ( v + 0.055 ) / 1.055, 2.4 );
	} );
	return 0.2126 * s[ 0 ] + 0.7152 * s[ 1 ] + 0.0722 * s[ 2 ];
}
function contrastRatio( c1, c2 ) {
	const L1 = luminance( c1 ),
		L2 = luminance( c2 );
	const lighter = Math.max( L1, L2 ),
		darker = Math.min( L1, L2 );
	return ( lighter + 0.05 ) / ( darker + 0.05 );
}

function extractBackground( block ) {
	// Check mapped background/background-color, then fallback parsing
	const bg =
		block.styles?.mapped?.[ 'background-color' ] ||
		block.styles?.mapped?.background ||
		'';
	if ( bg ) {
		// background may be gradient + url — try to extract first color token
		const first = String( bg ).split( ',' )[ 0 ].trim();
		if ( parseColor( first ) || parseColor( bg ) ) {
			return parseColor( first ) || parseColor( bg );
		}
	}
	const fallback = String( block.styles?.custom_css_fallback || '' );
	const m = fallback.match( /background(?:-color)?\s*:\s*([^;]+)/i );
	if ( m ) {
		const val = m[ 1 ].trim().split( /\s+/ )[ 0 ];
		return parseColor( val );
	}
	return null;
}
function effectiveColor( block ) {
	return block.styles?.mapped?.color
		? String( block.styles.mapped.color ).trim()
		: '';
}

function isDecorativeImage( block ) {
	// alt empty and no title, and role presentation implied by empty alt is okay — we treat missing alt differently
	return (
		block.type === 'image' &&
		( ! block.attributes?.alt ||
			'' === String( block.attributes.alt ).trim() )
	);
}

export function checkAltText( document ) {
	const issues = [];
	function visit( block ) {
		if ( block.type === 'image' ) {
			const alt = block.attributes?.alt;
			if (
				alt === undefined ||
				( typeof alt === 'string' &&
					'' === alt.trim() &&
					! block.attributes?.[ 'aria-hidden' ] )
			) {
				// If alt is missing entirely (undefined) flag; if empty string but not aria-hidden, it's ambiguous — still flag as missing unless explicitly decorative
				// We consider alt=="" with image inside button with text alternative as okay, but we flag generic missing
				const isExplicitDecorative =
					alt === '' &&
					block.attributes?.[ 'aria-hidden' ] === 'true';
				if ( ! isExplicitDecorative ) {
					issues.push( {
						block_id: block.id,
						type: 'alt',
						message:
							'Image is missing alt text — screen readers will not know what it shows',
						why: 'Alt text describes the image for people who cannot see it. Empty alt hides decorative images, descriptive alt conveys meaning.',
					} );
				}
			}
		}
		for ( const child of block.children || [] ) {
			if ( ! child.kind ) {
				visit( child );
			}
		}
	}
	visit( document.root );
	return issues;
}

export function checkContrast( document ) {
	const issues = [];
	function visit( block ) {
		const colorStr = effectiveColor( block );
		if ( colorStr ) {
			const fg = parseColor( colorStr );
			const bg = extractBackground( block ) || parseColor( '#ffffff' );
			if ( fg && bg ) {
				const ratio = contrastRatio( fg, bg );
				if ( ratio < 4.5 ) {
					issues.push( {
						block_id: block.id,
						type: 'contrast',
						message: `Text contrast ${ ratio.toFixed(
							2
						) }:1 is below 4.5:1 — low contrast text is hard to read`,
						why: `Low contrast makes text harder to read, especially for low vision. Try a darker text or lighter background (4.5:1 is the AA threshold for normal text). Colors: ${ colorStr } on ${
							bg ? JSON.stringify( bg ) : 'background'
						}.`,
						ratio: ratio.toFixed( 2 ),
					} );
				}
			}
		}
		for ( const child of block.children || [] ) {
			if ( ! child.kind ) {
				visit( child );
			}
		}
	}
	visit( document.root );
	return issues;
}

export function checkLinkText( document ) {
	const issues = [];
	const vague = /^(click here|read more|learn more|more|here|link)$/i;
	function textOf( block ) {
		let t = '';
		for ( const child of block.children || [] ) {
			if ( child.kind === 'text' ) {
				t += child.value;
			} else {
				t += textOf( child );
			}
		}
		return t.trim();
	}
	function visit( block ) {
		const isLink =
			block.tag === 'a' ||
			( block.attributes?.href && block.type === 'button' );
		if ( isLink ) {
			const txt = textOf( block );
			if ( vague.test( txt ) ) {
				issues.push( {
					block_id: block.id,
					type: 'link',
					message: `Link text "${ txt }" is vague — it doesn’t say where the link goes`,
					why: 'Screen reader users often skim links out of context. Descriptive text like “View pricing” or “Read the accessibility guide” helps everyone know the destination without reading surrounding text.',
				} );
			}
		}
		for ( const child of block.children || [] ) {
			if ( ! child.kind ) {
				visit( child );
			}
		}
	}
	visit( document.root );
	return issues;
}

export function checkIconLabels( document ) {
	const issues = [];
	function textOf( block ) {
		let t = '';
		for ( const child of block.children || [] ) {
			if ( child.kind === 'text' ) {
				t += child.value;
			} else if ( child.type !== 'image' ) {
				t += textOf( child );
			} // ignore img alt for this specific icon text check
		}
		return t.trim();
	}
	function visit( block ) {
		if ( block.tag === 'button' || block.tag === 'a' ) {
			const txt = textOf( block );
			const label = block.attributes?.[ 'aria-label' ] || '';
			const hasImg = ( block.children || [] ).some(
				( c ) =>
					c.type === 'image' ||
					c.tag === 'svg' ||
					c.tag === 'img' ||
					( c.attributes?.class || '' ).includes( 'icon' ) ||
					( c.attributes?.className || '' ).includes( 'icon' )
			);
			if ( ! txt && ! label && hasImg ) {
				issues.push( {
					block_id: block.id,
					type: 'label',
					message: `${ block.tag.toUpperCase() } contains an icon but no text and no aria-label`,
					why: 'Buttons and links with only icons must have an aria-label so screen readers know what they do.',
				} );
			} else if ( ! txt && ! label ) {
				issues.push( {
					block_id: block.id,
					type: 'label',
					message: `${ block.tag.toUpperCase() } has no text and no aria-label`,
					why: 'Interactive elements without text must have an aria-label.',
				} );
			}
		}
		for ( const child of block.children || [] ) {
			if ( ! child.kind ) {
				visit( child );
			}
		}
	}
	visit( document.root );
	return issues;
}

export function checkHeadingLevels( document ) {
	const issues = [];
	const headings = [];
	function visit( block ) {
		const m = String( block.tag || '' ).match( /^h([1-6])$/i );
		if ( m ) {
			headings.push( {
				level: parseInt( m[ 1 ], 10 ),
				id: block.id,
				tag: block.tag,
			} );
		}
		for ( const child of block.children || [] ) {
			if ( ! child.kind ) {
				visit( child );
			}
		}
	}
	visit( document.root );
	for ( let i = 1; i < headings.length; i++ ) {
		const prev = headings[ i - 1 ].level,
			cur = headings[ i ].level;
		if ( cur > prev + 1 ) {
			issues.push( {
				block_id: headings[ i ].id,
				type: 'heading',
				message: `Heading ${ headings[
					i
				].tag.toUpperCase() } follows H${ prev } — skipped H${
					prev + 1
				}`,
				why: `Skipping heading levels makes the page outline confusing for screen readers and keyboard navigation. Use H${
					prev + 1
				} next, or keep the level sequence logical (H1 → H2 → H3).`,
			} );
		}
	}
	// Also flag no H1
	if ( headings.length && ! headings.some( ( h ) => h.level === 1 ) ) {
		issues.push( {
			block_id: headings[ 0 ].id,
			type: 'heading',
			message: 'No H1 found — pages should have one main heading',
			why: 'An H1 describes the main topic so screen readers and search engines understand the page hierarchy.',
		} );
	}
	return issues;
}

export function checkFocusIndicators( document ) {
	const issues = [];
	function visit( block ) {
		const fallback = String( block.styles?.custom_css_fallback || '' );
		if (
			/outline\s*:\s*(none|0)\b/i.test( fallback ) &&
			! /outline\s*:\s*[^;]*solid|outline-offset/i.test( fallback )
		) {
			issues.push( {
				block_id: block.id,
				type: 'focus',
				message:
					'Custom CSS removes focus outline without a replacement — keyboard users will not see where focus is',
				why: 'A visible focus indicator shows keyboard users where they are. If you hide the outline, provide a clear alternative (e.g. box-shadow or border) so focus remains visible.',
			} );
		}
		for ( const child of block.children || [] ) {
			if ( ! child.kind ) {
				visit( child );
			}
		}
	}
	visit( document.root );
	return issues;
}

export function runAccessibilityChecks( document ) {
	if ( ! document || ! document.root ) {
		return [];
	}
	return [
		...checkAltText( document ),
		...checkContrast( document ),
		...checkLinkText( document ),
		...checkHeadingLevels( document ),
		...checkFocusIndicators( document ),
		...checkIconLabels( document ),
	];
}
