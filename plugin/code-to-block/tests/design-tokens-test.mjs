import assert from 'node:assert/strict';

import {
	blockHasTokenOverride,
	countTokenConsumers,
	designTokenDeclarations,
	effectiveTokenBindings,
	getDesignToken,
	parseTokenReference,
	styleSetHasTokenOverride,
	tokenCssName,
	tokenCssValue,
	tokenIdFromLabel,
	tokenIdIsValid,
	tokenReference,
	tokensForProperty,
} from '../src/design-tokens.mjs';

let assertions = 0;
function equal( actual, expected, message ) {
	assert.deepEqual( actual, expected, message );
	assertions += 1;
}

const designTokens = {
	colors: {
		brand: { label: 'Brand', value: '#6558d3' },
	},
	typography: {
		'heading-size': { label: 'Heading size', value: '44px' },
	},
	spacing: {
		section: { label: 'Section', value: '48px' },
	},
};

equal( tokenIdFromLabel( ' Heading / Large ' ), 'heading-large', 'Labels must become stable lowercase slugs.' );
equal( tokenIdIsValid( 'heading-large' ), true, 'Generated token IDs must validate.' );
equal( tokenIdIsValid( '9-heading' ), false, 'Token IDs must begin with a letter.' );
equal( tokenReference( 'colors', 'brand' ), 'colors.brand', 'References must include category and ID.' );
equal( parseTokenReference( 'colors.brand' ), { category: 'colors', id: 'brand' }, 'Valid references must parse.' );
equal( parseTokenReference( 'colors.bad.value' ), null, 'Malformed references must fail closed.' );
equal( tokenCssName( 'colors.brand' ), '--ctb-token-colors-brand', 'References need deterministic scoped CSS names.' );
equal( tokenCssValue( 'colors.brand' ), 'var(--ctb-token-colors-brand)', 'References need CSS var() values.' );
equal( getDesignToken( designTokens, 'colors.brand' ), designTokens.colors.brand, 'Referenced definitions must resolve.' );
equal( tokensForProperty( designTokens, 'color' ).map( ( token ) => token.reference ), [ 'colors.brand' ], 'Color controls must only list color tokens.' );
equal( tokensForProperty( designTokens, 'padding' ).map( ( token ) => token.reference ), [ 'spacing.section' ], 'Spacing controls must only list spacing tokens.' );

const linked = {
	mapped: { color: tokenCssValue( 'colors.brand' ) },
	token_bindings: { color: 'colors.brand' },
	custom_css_fallback: '',
};
const overridden = {
	mapped: { color: '#222222' },
	token_bindings: { color: 'colors.brand' },
	custom_css_fallback: '',
};
const document = {
	design_tokens: designTokens,
	root: {
		styles: linked,
		responsive_overrides: {
			tablet: {
				mapped: { padding: tokenCssValue( 'spacing.section' ) },
				token_bindings: { padding: 'spacing.section' },
				custom_css_fallback: '',
			},
			mobile: {
				mapped: { color: '#222222' },
				token_bindings: { color: 'colors.brand' },
				custom_css_fallback: '',
			},
		},
		children: [
			{
				styles: linked,
				children: [],
			},
			{
				styles: overridden,
				children: [],
			},
		],
	},
};

equal( effectiveTokenBindings( document.root, 'desktop' ), { color: 'colors.brand' }, 'Desktop bindings come from base styles.' );
equal( effectiveTokenBindings( document.root, 'tablet' ), { color: 'colors.brand', padding: 'spacing.section' }, 'Tablet bindings extend desktop.' );
equal( effectiveTokenBindings( document.root, 'mobile' ), { color: 'colors.brand', padding: 'spacing.section' }, 'Mobile bindings apply after tablet.' );
equal( styleSetHasTokenOverride( linked, 'color' ), false, 'A var() value remains linked to its token.' );
equal( styleSetHasTokenOverride( overridden, 'color' ), true, 'A raw value with binding metadata is an explicit override.' );
equal( blockHasTokenOverride( document.root ), true, 'Responsive token divergence must mark its block.' );
equal( countTokenConsumers( document, 'colors.brand' ), 4, 'Consumers must be counted across base and responsive style sets.' );
equal(
	designTokenDeclarations( designTokens ),
	'--ctb-token-colors-brand:#6558d3;--ctb-token-typography-heading-size:44px;--ctb-token-spacing-section:48px;',
	'Token declarations must be stable and category ordered.'
);

console.log( `PASS: ${ assertions } design-token assertions.` );
