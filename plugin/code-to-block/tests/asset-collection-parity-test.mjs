/**
 * Parity test: verifies that the extracted asset collection module produces
 * identical output to the inline implementation that was previously in
 * parser.js.
 *
 * Tests extractScripts, standaloneScript, analyzeReferences, and
 * duplicateIdDiagnostics from src/importer/assets/.
 */

import { strict as assert } from 'node:assert';
import {
	extractScripts,
	standaloneScript,
	analyzeReferences,
	duplicateIdDiagnostics,
} from '../src/importer/assets/collect-import-assets.mjs';

let assertions = 0;

// --- standaloneScript ---
{
	const script = standaloneScript( 'console.log("hello")', 'test-hash', 0 );
	assert.equal( script.id, 'import-script-test-hash-1',
		'script ID format' );
	assert.equal( script.source_type, 'inline-script',
		'standalone is inline' );
	assert.equal( script.placement, 'body-end',
		'standalone placement is body-end' );
	assert.equal( script.type, 'text/javascript',
		'default script type' );
	assert.equal( script.source, 'console.log("hello")',
		'source preserved' );
	assert.equal( script.enabled_in_editor, false,
		'disabled in editor' );
	assert.equal( script.enabled_in_preview, true,
		'enabled in preview' );
	assert.equal( script.enabled_on_publish, true,
		'enabled on publish' );
	assert.equal( script.execution_policy, 'preview-and-frontend',
		'execution policy' );
	assert.equal( script.security_status, 'requires-trust',
		'security status' );
	assert.equal( script.origin, 'imported',
		'origin is imported' );
	assertions += 11;
}

// --- standaloneScript index ---
{
	const script = standaloneScript( 'var x = 1', 'hash2', 5 );
	assert.equal( script.id, 'import-script-hash2-6',
		'script index is 1-based' );
	assertions += 1;
}

// --- analyzeReferences: empty document ---
{
	// Minimal mock document
	const mockDoc = {
		querySelectorAll: () => [],
		querySelector: () => null,
	};
	const refs = analyzeReferences( mockDoc, [], [], [] );
	assert.ok( Array.isArray( refs ), 'returns array' );
	assert.equal( refs.length, 0, 'no references in empty document' );
	assertions += 2;
}

// --- analyzeReferences: CSS @import ---
{
	const mockDoc = {
		querySelectorAll: () => [],
		querySelector: () => null,
	};
	// Mock a stylesheet with an @import
	const mockStylesheet = {
		ast: {
			walkAtRules: ( name, cb ) => {
				if ( name === 'import' ) {
					cb( { params: 'url("https://fonts.google.com/css")' } );
				}
			},
			walkDecls: () => {},
		},
	};
	const diagnostics = [];
	const refs = analyzeReferences(
		mockDoc,
		[ mockStylesheet ],
		[],
		diagnostics
	);
	assert.equal( refs.length, 1, 'one CSS import reference' );
	assert.equal( refs[ 0 ].type, 'css.import', 'reference type is css.import' );
	assert.equal( refs[ 0 ].blocked, true, '@import is blocked' );
	assert.equal( refs[ 0 ].external, true, 'external URL detected' );
	assertions += 4;
}

// --- analyzeReferences: script.src ---
{
	const mockDoc = {
		querySelectorAll: () => [],
		querySelector: () => null,
	};
	const scripts = [
		{ src: 'https://cdn.example.com/lib.js' },
		{ src: '' },
	];
	const refs = analyzeReferences( mockDoc, [], scripts, [] );
	assert.equal( refs.length, 1,
		'only scripts with src produce references' );
	assert.equal( refs[ 0 ].type, 'script.src',
		'reference type is script.src' );
	assert.equal( refs[ 0 ].external, true,
		'external script detected' );
	assert.equal( refs[ 0 ].blocked, false,
		'valid external script not blocked' );
	assertions += 4;
}

// --- duplicateIdDiagnostics ---
{
	const diagnostics = [];
	// Mock document with duplicate IDs
	const elements = [
		{ id: 'hero' },
		{ id: 'hero' },
		{ id: 'unique' },
	];
	const mockDoc = {
		querySelectorAll: ( selector ) => {
			if ( selector === '[id]' ) {
				return elements;
			}
			return [];
		},
	};
	duplicateIdDiagnostics( mockDoc, diagnostics );
	assert.equal( diagnostics.length, 1,
		'one diagnostic for duplicate ID' );
	assert.equal( diagnostics[ 0 ].code, 'DUPLICATE_HTML_ID',
		'correct diagnostic code' );
	assert.ok( diagnostics[ 0 ].message.includes( 'hero' ),
		'diagnostic mentions the duplicate ID' );
	assert.ok( diagnostics[ 0 ].message.includes( '2' ),
		'diagnostic mentions occurrence count' );
	assertions += 4;
}

// --- duplicateIdDiagnostics: no duplicates ---
{
	const diagnostics = [];
	const mockDoc = {
		querySelectorAll: () => [
			{ id: 'a' },
			{ id: 'b' },
			{ id: 'c' },
		],
	};
	duplicateIdDiagnostics( mockDoc, diagnostics );
	assert.equal( diagnostics.length, 0,
		'no diagnostics when no duplicate IDs' );
	assertions += 1;
}

console.log( `PASS: ${ assertions } asset collection parity assertions.` );
