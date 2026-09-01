import assert from 'node:assert/strict';

import {
	attributeIsAllowed,
	sanitizeResourceUrl,
	sanitizeSrcset,
	SUPPORTED_HTML_TAGS,
} from '../src/html-policy.mjs';

assert.equal( SUPPORTED_HTML_TAGS.has( 'section' ), true );
assert.equal( SUPPORTED_HTML_TAGS.has( 'form' ), true );
assert.equal( SUPPORTED_HTML_TAGS.has( 'input' ), true );
assert.equal( SUPPORTED_HTML_TAGS.has( 'textarea' ), true );
assert.equal( SUPPORTED_HTML_TAGS.has( 'select' ), true );
assert.equal( SUPPORTED_HTML_TAGS.has( 'script' ), false );
assert.equal( attributeIsAllowed( 'a', 'href' ), true );
assert.equal( attributeIsAllowed( 'div', 'onclick' ), false );
assert.equal( attributeIsAllowed( 'img', 'srcset' ), true );
assert.equal( attributeIsAllowed( 'form', 'method' ), true );
assert.equal( attributeIsAllowed( 'input', 'required' ), true );
assert.equal( sanitizeResourceUrl( 'javascript:alert(1)', true ), '' );
assert.equal( sanitizeResourceUrl( ' java\nscript:alert(1)', true ), '' );
assert.equal( sanitizeResourceUrl( 'mailto:team@example.test', true ), 'mailto:team@example.test' );
assert.equal( sanitizeResourceUrl( 'mailto:team@example.test', false ), '' );
assert.equal( sanitizeResourceUrl( '/images/hero.jpg', false ), '/images/hero.jpg' );
assert.equal(
	sanitizeSrcset( 'small.jpg 1x, javascript:alert(1) 2x, wide.jpg 900w' ),
	'small.jpg 1x, wide.jpg 900w'
);
assert.equal( sanitizeSrcset( 'photo.jpg invalid' ), '' );

console.log( 'PASS: 18 HTML policy assertions.' );
