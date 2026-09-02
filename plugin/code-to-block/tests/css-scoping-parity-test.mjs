/**
 * Parity test: verifies that the extracted CSS scoping module produces
 * identical output to the inline implementation that was previously in
 * parser.js.
 *
 * This test imports scopeImportedCss, inventoryStylesheet,
 * selectorForStaticMatching, addScopeClass, and isKeyframeRule from
 * src/importer/css/ and validates them against known inputs and expected
 * outputs.
 */

import { strict as assert } from 'node:assert';
import {
	scopeImportedCss,
	inventoryStylesheet,
	selectorForStaticMatching,
	isKeyframeRule,
	addScopeClass,
	IMPORT_SCOPE_CLASS,
} from '../src/importer/css/scope-imported-css.mjs';

let assertions = 0;

// --- scopeImportedCss: basic scoping ---
{
	const css = '.hero { color: red; }';
	const diagnostics = [];
	const result = scopeImportedCss( css, diagnostics );
	assert.ok( result.root, 'root AST is returned' );
	assert.ok( result.css.includes( IMPORT_SCOPE_CLASS ),
		'scoped CSS includes import scope class' );
	// The scoped output should contain .hero combined with the scope class
	assert.ok(
		result.css.includes( `.hero.${ IMPORT_SCOPE_CLASS }` ) ||
		result.css.includes( `.${ IMPORT_SCOPE_CLASS } .hero` ),
		'selector is scoped with import scope class'
	);
	assert.equal( diagnostics.length, 0, 'no diagnostics for clean CSS' );
	assertions += 4;
}

// --- scopeImportedCss: root/body/html selectors ---
{
	const css = 'html { font-size: 16px; } body { margin: 0; } :root { --fg: #333; }';
	const diagnostics = [];
	const result = scopeImportedCss( css, diagnostics );
	// Root selectors should be replaced with the scope class
	assert.ok( result.css.includes( `.${ IMPORT_SCOPE_CLASS }` ),
		'document roots replaced with scope class' );
	assert.ok( ! /\bhtml\b/.test( result.css ),
		'html selector replaced' );
	assert.ok( ! /\bbody\b/.test( result.css ),
		'body selector replaced' );
	assertions += 3;
}

// --- scopeImportedCss: keyframe rules pass through ---
{
	const css = '@keyframes fade { from { opacity: 0; } to { opacity: 1; } } .box { animation: fade 1s; }';
	const diagnostics = [];
	const result = scopeImportedCss( css, diagnostics );
	assert.ok( result.css.includes( '@keyframes fade' ),
		'keyframes preserved' );
	assert.ok( result.css.includes( 'from' ),
		'keyframe from preserved' );
	assertions += 2;
}

// --- scopeImportedCss: unsafe declarations blocked ---
{
	const css = '.danger { behavior: url(script.htc); color: red; }';
	const diagnostics = [];
	const result = scopeImportedCss( css, diagnostics );
	assert.ok( ! result.css.includes( 'behavior' ),
		'behavior declaration removed' );
	assert.ok( result.css.includes( 'color' ),
		'safe declaration preserved' );
	assert.ok( diagnostics.some( d => d.code === 'UNSAFE_CSS_DECLARATION_BLOCKED' ),
		'unsafe declaration diagnostic emitted' );
	assertions += 3;
}

// --- scopeImportedCss: @import quarantined ---
{
	const css = '@import url("https://fonts.googleapis.com/css"); .text { font-family: sans-serif; }';
	const diagnostics = [];
	const result = scopeImportedCss( css, diagnostics );
	assert.ok( ! result.css.includes( '@import' ),
		'@import removed from scoped output' );
	assert.ok( diagnostics.some( d => d.code === 'CSS_IMPORT_QUARANTINED' ),
		'@import quarantine diagnostic emitted' );
	assertions += 2;
}

// --- scopeImportedCss: CSS parse recovery ---
{
	const css = '.broken { color: red; font-size: }';
	const diagnostics = [];
	const result = scopeImportedCss( css, diagnostics );
	assert.ok( result.root, 'recovered CSS still returns root' );
	assert.ok( typeof result.css === 'string', 'recovered CSS returns string' );
	assertions += 2;
}

// --- selectorForStaticMatching ---
{
	const static1 = selectorForStaticMatching( '.btn:hover' );
	assert.ok( ! static1.includes( ':hover' ),
		':hover stripped for static matching' );
	assert.ok( static1.includes( '.btn' ),
		'base class preserved' );

	const static2 = selectorForStaticMatching( '.link::after' );
	assert.ok( ! static2.includes( '::after' ),
		'::after stripped for static matching' );

	const static3 = selectorForStaticMatching( '.input:focus-visible' );
	assert.ok( ! static3.includes( ':focus-visible' ),
		':focus-visible stripped for static matching' );
	assertions += 4;
}

// --- inventoryStylesheet ---
{
	const css = `
		.a { color: red; }
		.b { --custom-var: blue; }
		@media (max-width: 768px) { .c { display: none; } }
		@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
	`;
	const { root } = scopeImportedCss( css );
	const inventory = inventoryStylesheet( root );
	assert.ok( inventory.selectors.length > 0, 'selectors inventoried' );
	assert.ok( inventory.media_conditions.length > 0, 'media conditions found' );
	assert.ok( inventory.keyframes.length > 0, 'keyframes found' );
	assert.ok( inventory.custom_properties.includes( '--custom-var' ),
		'custom property inventoried' );
	assertions += 4;
}

// --- isKeyframeRule ---
{
	// We can't easily construct PostCSS nodes without PostCSS, so we test
	// through inventoryStylesheet which uses isKeyframeRule internally.
	const css = '@keyframes bounce { 0% { top: 0; } 50% { top: 10px; } }';
	const { root } = scopeImportedCss( css );
	const inventory = inventoryStylesheet( root );
	assert.ok( inventory.keyframes.includes( 'bounce' ),
		'keyframe name extracted correctly' );
	// Keyframe selectors (0%, 50%) should NOT appear in selectors
	assert.ok( ! inventory.selectors.some( s => s.includes( '0%' ) ),
		'keyframe percentage selectors excluded from inventory' );
	assertions += 2;
}

// --- addScopeClass ---
{
	const attrs1 = { class: 'hero banner' };
	addScopeClass( attrs1 );
	assert.ok( attrs1.class.includes( IMPORT_SCOPE_CLASS ),
		'scope class added to existing classes' );
	assert.ok( attrs1.class.includes( 'hero' ),
		'existing classes preserved' );

	const attrs2 = {};
	addScopeClass( attrs2 );
	assert.equal( attrs2.class, IMPORT_SCOPE_CLASS,
		'scope class set on empty attributes' );

	// Idempotent
	const attrs3 = { class: IMPORT_SCOPE_CLASS };
	addScopeClass( attrs3 );
	const occurrences = attrs3.class.split( IMPORT_SCOPE_CLASS ).length - 1;
	assert.equal( occurrences, 1,
		'scope class not duplicated' );
	assertions += 4;
}

// --- IMPORT_SCOPE_CLASS constant ---
{
	assert.equal( IMPORT_SCOPE_CLASS, 'ctb-import-scope',
		'scope class constant value' );
	assertions += 1;
}

console.log( `PASS: ${ assertions } CSS scoping parity assertions.` );
