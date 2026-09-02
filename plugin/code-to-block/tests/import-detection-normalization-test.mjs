import assert from 'node:assert/strict';

import {
	detectDocumentShape,
	detectImportedSource,
	detectTransportEncoding,
} from '../src/importer/detection/detect-imported-source.mjs';
import { normalizeImportedSource } from '../src/importer/normalization/normalize-imported-source.mjs';

assert.equal(
	detectDocumentShape( '<!doctype html><html><body></body></html>' ),
	'full-document'
);
assert.equal(
	detectDocumentShape( '<body><main>Body only</main></body>' ),
	'body-document'
);
assert.equal(
	detectDocumentShape( '<style>.x{color:red}</style><main>X</main>' ),
	'headless-document'
);
assert.equal( detectDocumentShape( '<div>Hello</div>' ), 'single-node' );
assert.equal( detectDocumentShape( '<h1>One</h1><p>Two</p>' ), 'fragment' );

const mixed = detectImportedSource(
	'<style>:root{--brand:red}</style><main>Page</main><script>window.app=true</script>'
);
assert.equal( mixed.containsHtml, true );
assert.equal( mixed.containsCss, true );
assert.equal( mixed.containsJavaScript, true );
assert.equal( mixed.documentShape, 'headless-document' );
assert.equal( mixed.styleBlocks, 1 );
assert.equal( mixed.scriptBlocks, 1 );
assert.deepEqual( mixed.languages, [ 'html', 'css', 'javascript' ] );

assert.equal(
	detectTransportEncoding( '```html\n\\<div>Hi\\</div>\n```' ),
	'mixed'
);
assert.equal(
	detectTransportEncoding( '\\<div>Escaped\\</div>' ),
	'escaped-rich-text'
);
assert.equal(
	detectTransportEncoding( '<div>Raw</div>\\<span>Escaped\\</span>' ),
	'mixed'
);
const escaped = String.raw`\<script>
const decimal = /\d+\.\d+/;
const path = "C:\\Users\\example";
window\.app = "ok";
\</script>
\<style>
\--brand: red;
\</style>`;
const normalized = normalizeImportedSource( escaped );
assert.match( normalized, /<script>/ );
assert.match( normalized, /window\.app/ );
assert.match( normalized, /--brand/ );
assert.match( normalized, /\/\\d\+\\\.\\d\+\// );
assert.match( normalized, /C:\\\\Users\\\\example/ );
assert.doesNotMatch( normalized, /\\<script>/ );

assert.equal(
	normalizeImportedSource( 'const path = "C:\\\\Users\\\\example";' ),
	'const path = "C:\\\\Users\\\\example";'
);

// eslint-disable-next-line no-console
console.log( 'PASS: 26 import detection and normalization assertions.' );
