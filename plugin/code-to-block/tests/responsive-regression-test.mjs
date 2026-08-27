import assert from 'node:assert/strict';

import {
	isBlockHidden,
	isHiddenOverridden,
	ownStyleSet,
	setOwnStyleSet,
} from '../src/responsive-styles.mjs';

let assertions = 0;
function ok( condition, message ) {
	assert.ok( condition, message );
	assertions += 1;
}
function equal( actual, expected, message ) {
	assert.deepEqual( actual, expected, message );
	assertions += 1;
}

function clone( value ) {
	return JSON.parse( JSON.stringify( value ) );
}

function setHiddenInFallback( fallback, hidden ) {
	const declarations = String( fallback || '' )
		.split( ';' )
		.map( ( part ) => part.trim() )
		.filter( Boolean )
		.filter(
			( part ) => ! /^display\s*:\s*none\s*(?:!important)?\s*$/i.test( part )
		);
	if ( hidden ) {
		declarations.push( 'display: none' );
	}
	return declarations.length ? declarations.join( '; ' ) + ';' : '';
}

// Test 1: tablet override persists after save/reload (simulated via JSON round-trip)
{
	const block = {
		id: 'test-1',
		styles: { mapped: { padding: '40px' }, custom_css_fallback: '' },
	};
	const tabletStyle = { mapped: { padding: '24px' }, custom_css_fallback: '' };
	setOwnStyleSet( block, 'tablet', tabletStyle );
	// Simulate save: JSON stringify and parse (like REST would)
	const saved = clone( block );
	const reloaded = clone( saved );
	// Simulate reload: check that tablet override is still there
	equal(
		reloaded.responsive_overrides.tablet.mapped.padding,
		'24px',
		'Tablet override must persist after save/reload.'
	);
	// And that switching to tablet view still shows the override, not desktop
	equal(
		ownStyleSet( reloaded, 'tablet' ).mapped.padding,
		'24px',
		'Tablet view must still show the override after reload, not reverted to desktop.'
	);
}

// Test 2: mobile hide persists after save/reload
{
	const block = {
		id: 'test-2',
		styles: { mapped: {}, custom_css_fallback: '' },
	};
	const mobileHidden = {
		mapped: {},
		custom_css_fallback: setHiddenInFallback( '', true ),
	};
	setOwnStyleSet( block, 'mobile', mobileHidden );
	ok(
		isHiddenOverridden( block, 'mobile' ),
		'Mobile hide must be considered overridden when set.'
	);
	ok( isBlockHidden( block, 'mobile' ), 'Mobile must be hidden when hide is set.' );
	// Simulate save/reload
	const saved = clone( block );
	const reloaded = clone( saved );
	ok(
		isHiddenOverridden( reloaded, 'mobile' ),
		'Mobile hide must still be hidden after save/reload, not silently reset.'
	);
	ok(
		isBlockHidden( reloaded, 'mobile' ),
		'Mobile hidden state must persist after reload.'
	);
}

// Test 3: mobile edit must not affect desktop or tablet
{
	const block = {
		id: 'test-3',
		styles: { mapped: { padding: '40px', color: 'red' }, custom_css_fallback: '' },
		responsive_overrides: {
			tablet: { mapped: { padding: '24px' }, custom_css_fallback: '' },
		},
	};
	const desktopBefore = clone( block.styles );
	const tabletBefore = clone( block.responsive_overrides.tablet );
	// Edit mobile
	const mobileStyle = { mapped: { padding: '12px' }, custom_css_fallback: '' };
	setOwnStyleSet( block, 'mobile', mobileStyle );
	// Check desktop unchanged
	equal( block.styles, desktopBefore, 'Desktop must remain unchanged after mobile edit.' );
	// Check tablet unchanged
	equal(
		block.responsive_overrides.tablet,
		tabletBefore,
		'Tablet must remain unchanged after mobile edit.'
	);
	// And mobile has the new value
	equal(
		ownStyleSet( block, 'mobile' ).mapped.padding,
		'12px',
		'Mobile must have the new value.'
	);
	// And desktop and tablet still have their original values when viewed
	equal( ownStyleSet( block, 'desktop' ).mapped.padding, '40px', 'Desktop still 40px.' );
	equal( ownStyleSet( block, 'tablet' ).mapped.padding, '24px', 'Tablet still 24px.' );
}

console.log( `PASS: ${ assertions } responsive regression assertions.` );
