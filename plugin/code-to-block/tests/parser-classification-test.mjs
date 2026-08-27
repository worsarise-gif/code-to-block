import assert from 'node:assert/strict';

import { blockTypeFor } from '../src/block-type.mjs';

function element( tagName, { className = '', role = null, children = 0 } = {} ) {
	return {
		tagName: tagName.toUpperCase(),
		children: Array.from( { length: children } ),
		getAttribute( name ) {
			if ( name === 'class' ) {
				return className || null;
			}
			if ( name === 'role' ) {
				return role;
			}
			return null;
		},
	};
}

const testimonial = [
	[ element( 'figure', { children: 3 } ), 'container' ],
	[ element( 'img', { className: 'avatar' } ), 'image' ],
	[ element( 'blockquote' ), 'text' ],
	[ element( 'figcaption', { children: 2 } ), 'container' ],
	[ element( 'strong' ), 'text' ],
	[ element( 'span' ), 'text' ],
];

const navigation = [
	[ element( 'nav', { children: 2 } ), 'container' ],
	[ element( 'a', { className: 'logo' } ), 'text' ],
	[ element( 'ul', { className: 'menu', children: 3 } ), 'container' ],
	[ element( 'li', { children: 1 } ), 'container' ],
	[ element( 'a', { className: 'menu-link' } ), 'text' ],
];

const buttons = [
	[ element( 'button' ), 'button' ],
	[ element( 'a', { className: 'cta' } ), 'button' ],
	[ element( 'a', { className: 'mvp-button-primary' } ), 'button' ],
	[ element( 'a', { className: 'btn btn-small' } ), 'button' ],
	[ element( 'a', { role: 'button' } ), 'button' ],
];

for ( const [ source, expected ] of [
	...testimonial,
	...navigation,
	...buttons,
] ) {
	assert.equal(
		blockTypeFor( source ),
		expected,
		`<${ source.tagName.toLowerCase() }> should classify as ${ expected }`
	);
}

console.log( 'PASS: 16 parser block-type classifications.' );
