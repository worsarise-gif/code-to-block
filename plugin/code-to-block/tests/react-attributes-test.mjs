import assert from 'node:assert/strict';

import { normalizeReactAttributes } from '../src/react-attributes.mjs';

assert.deepEqual(
	normalizeReactAttributes( {
		class: 'contact-form',
		for: 'email',
		tabindex: '0',
		novalidate: true,
		autocomplete: 'email',
		maxlength: '120',
		readonly: true,
		'aria-label': 'Email address',
		'data-filter': 'all',
	} ),
	{
		className: 'contact-form',
		htmlFor: 'email',
		tabIndex: '0',
		noValidate: true,
		autoComplete: 'email',
		maxLength: '120',
		readOnly: true,
		'aria-label': 'Email address',
		'data-filter': 'all',
	}
);

assert.deepEqual(
	normalizeReactAttributes( {
		viewbox: '0 0 24 24',
		'stroke-width': '2',
		'stroke-linecap': 'round',
		'xlink:href': '#icon',
	} ),
	{
		viewBox: '0 0 24 24',
		strokeWidth: '2',
		strokeLinecap: 'round',
		xlinkHref: '#icon',
	}
);

// eslint-disable-next-line no-console
console.log( 'PASS: imported HTML attributes normalize for React rendering.' );
