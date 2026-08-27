import assert from 'node:assert/strict';

import {
	BREAKPOINTS,
	breakpointCascade,
	countStyleOverrides,
	effectiveMappedStyles,
	inheritedMappedStyles,
	ownStyleSet,
	setOwnStyleSet,
	styleSetIsEmpty,
} from '../src/responsive-styles.mjs';

let assertions = 0;
function equal( actual, expected, message ) {
	assert.deepEqual( actual, expected, message );
	assertions += 1;
}

const block = {
	styles: {
		mapped: { color: '#111111', padding: '40px', 'font-size': '32px' },
		custom_css_fallback: 'display: grid;',
	},
	responsive_overrides: {
		tablet: {
			mapped: { padding: '24px', 'font-size': '26px' },
			custom_css_fallback: 'gap: 18px;',
		},
		mobile: {
			mapped: { padding: '14px' },
			custom_css_fallback: '',
		},
	},
};

equal( BREAKPOINTS.map( ( item ) => item.id ), [ 'desktop', 'tablet', 'mobile' ], 'The editor must expose all three modes.' );
equal( breakpointCascade( 'desktop' ), [], 'Desktop has no responsive cascade.' );
equal( breakpointCascade( 'tablet' ), [ 'tablet' ], 'Tablet applies only its own override.' );
equal( breakpointCascade( 'mobile' ), [ 'tablet', 'mobile' ], 'Mobile must inherit the tablet media rule before its own.' );
equal( ownStyleSet( block, 'desktop' ), block.styles, 'Desktop edits the required base style set.' );
equal( ownStyleSet( block, 'tablet' ), block.responsive_overrides.tablet, 'Tablet edits only the tablet branch.' );
equal( ownStyleSet( { styles: block.styles }, 'mobile' ), { mapped: {}, custom_css_fallback: '' }, 'Missing optional branches must read as empty overrides.' );
equal( inheritedMappedStyles( block, 'tablet' ), block.styles.mapped, 'Tablet inherits desktop values.' );
equal(
	inheritedMappedStyles( block, 'mobile' ),
	{ color: '#111111', padding: '24px', 'font-size': '26px' },
	'Mobile inherits the effective tablet values.'
);
equal(
	effectiveMappedStyles( block, 'mobile' ),
	{ color: '#111111', padding: '14px', 'font-size': '26px' },
	'Mobile values must override the inherited tablet cascade.'
);
equal( styleSetIsEmpty( { mapped: {}, custom_css_fallback: '' } ), true, 'An empty style set must be removable.' );
equal( styleSetIsEmpty( { mapped: { color: 'red' }, custom_css_fallback: '' } ), false, 'Mapped values make an override non-empty.' );
equal( styleSetIsEmpty( { mapped: {}, token_bindings: { color: 'colors.brand' }, custom_css_fallback: '' } ), false, 'Token metadata must keep its responsive branch.' );
equal( countStyleOverrides( block.responsive_overrides.tablet ), 3, 'Mapped declarations and raw CSS must be counted.' );

const created = { styles: block.styles };
setOwnStyleSet( created, 'tablet', { mapped: { margin: '20px' }, custom_css_fallback: '' } );
equal( created.responsive_overrides.tablet.mapped.margin, '20px', 'Setting tablet styles must create the optional branch.' );
setOwnStyleSet( created, 'mobile', { mapped: { padding: '12px' }, custom_css_fallback: '' } );
equal( Object.keys( created.responsive_overrides ), [ 'tablet', 'mobile' ], 'Breakpoint branches must coexist.' );
setOwnStyleSet( created, 'mobile', { mapped: { padding: 'var(--ctb-token-spacing-section)' }, token_bindings: { padding: 'spacing.section' }, custom_css_fallback: '' } );
equal( created.responsive_overrides.mobile.token_bindings.padding, 'spacing.section', 'Responsive token bindings must persist with their mapped value.' );
setOwnStyleSet( created, 'tablet', { mapped: {}, custom_css_fallback: '' } );
equal( Object.keys( created.responsive_overrides ), [ 'mobile' ], 'Clearing tablet must preserve mobile.' );
setOwnStyleSet( created, 'mobile', { mapped: {}, custom_css_fallback: '' } );
equal( 'responsive_overrides' in created, false, 'Clearing the last override must remove the optional container.' );

const desktop = { styles: block.styles };
const replacement = { mapped: { color: '#ffffff' }, custom_css_fallback: '' };
setOwnStyleSet( desktop, 'desktop', replacement );
equal( desktop.styles, replacement, 'Desktop replacement must not create responsive metadata.' );

console.log( `PASS: ${ assertions } responsive style assertions.` );
