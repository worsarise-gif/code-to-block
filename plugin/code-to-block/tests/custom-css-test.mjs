import assert from 'node:assert/strict';

import {
	assertSafeCssDeclaration,
	mergeMappedStyleUpdates,
	normalizeCustomCssFallback,
	previewCustomCssFallback,
	splitResolvedStyles,
	styleControlLabel,
} from '../src/custom-css.mjs';

const resolved = new Map( [
	[ 'padding', { value: '24px', important: false, origin: 'stylesheet' } ],
	[ 'color', { value: '#123456', important: false, origin: 'inline' } ],
	[ 'display', { value: 'grid', important: true, origin: 'stylesheet' } ],
	[ '--card-gap', { value: '12px', important: false, origin: 'inherited' } ],
] );
const split = splitResolvedStyles( resolved );

assert.deepEqual( split.mapped, { color: '#123456', padding: '24px', display: 'grid' } );
assert.equal(
	split.custom_css_fallback,
	'--card-gap: 12px;'
);
assert.deepEqual( split.explanation, [
	{
		property: '--card-gap',
		value: '12px',
		important: false,
		origin: 'inherited',
		destination: 'raw-css',
	},
	{
		property: 'color',
		value: '#123456',
		important: false,
		origin: 'inline',
		destination: 'style-control',
		control: 'color',
	},
	{
		property: 'display',
		value: 'grid',
		important: true,
		origin: 'stylesheet',
		destination: 'style-control',
		control: 'display',
	},
	{
		property: 'padding',
		value: '24px',
		important: false,
		origin: 'stylesheet',
		destination: 'style-control',
		control: 'padding',
	},
] );
assert.equal( styleControlLabel( 'color' ), 'Color' );
assert.equal( styleControlLabel( 'border-radius' ), 'Border radius' );
assert.deepEqual( splitResolvedStyles( new Map() ).explanation, [] );
assert.equal(
	normalizeCustomCssFallback( ' padding: 12px;\nfont-size: 18px !important ' ),
	'padding: 12px;\nfont-size: 18px !important;'
);
assert.equal( normalizeCustomCssFallback( '  ' ), '' );
assert.throws(
	() => normalizeCustomCssFallback( 'color: red;} body {display:none' ),
	/declarations only|Invalid CSS/
);
assert.throws(
	() => normalizeCustomCssFallback( '@media (max-width: 600px) {}' ),
	/declarations only/
);
assert.throws(
	() => normalizeCustomCssFallback( '/* hidden */ color: red;' ),
	/declarations only/
);
assert.equal(
	previewCustomCssFallback( 'font-size: 24px; color: red;' ),
	'font-size: 24px;\ncolor: red;'
);
assert.deepEqual(
	mergeMappedStyleUpdates(
		{ color: 'red', padding: '12px', display: 'grid' },
		{ padding: '24px', margin: '0 auto', border: '', display: 'block' }
	),
	{ color: 'red', padding: '24px', display: 'block', margin: '0 auto' }
);
assert.throws(
	() => normalizeCustomCssFallback( 'behavior: url(exploit.htc);' ),
	/Unsupported CSS property/
);
assert.throws(
	() => normalizeCustomCssFallback( 'width: expression(alert(1));' ),
	/Unsafe CSS value/
);
assert.throws(
	() => normalizeCustomCssFallback( 'background: url(javascript:alert(1));' ),
	/Unsafe CSS URL|Malformed CSS URL/
);
assert.doesNotThrow( () =>
	assertSafeCssDeclaration( 'background', 'url("/images/hero.jpg") center' )
);

console.log( 'PASS: 17 CSS mapping assertions.' );
