import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement, renderToString } from '@wordpress/element';

import { elementRootTargetAttributes } from '../src/elements/targets.mjs';
import {
	createTextTargetNodes,
	resolveTextRenderModel,
} from '../src/elements/text-renderer.mjs';

const fixtures = JSON.parse(
	await readFile(
		new URL( './fixtures/text-renderer-contract.json', import.meta.url ),
		'utf8'
	)
);

let assertions = 0;
function check( condition, message ) {
	assert.ok( condition, message );
	assertions += 1;
}

for ( const fixture of fixtures ) {
	const block = {
		element: fixture.element,
		attributes: fixture.attributes,
	};
	const model = resolveTextRenderModel( block );
	const html = renderToString(
		createElement(
			fixture.tag,
			elementRootTargetAttributes( block ),
			createTextTargetNodes( block, fixture.text, createElement )
		)
	);
	check( model !== null, `${ fixture.name } resolves the text renderer` );
	assert.deepEqual(
		model,
		{ tag: fixture.expectedTag, href: fixture.expectedHref },
		`${ fixture.name } resolves its target element`
	);
	assertions += 1;
	assert.equal(
		( html.match( /data-ctb-part="root"/g ) || [] ).length,
		1,
		`${ fixture.name } emits one root editor target`
	);
	assertions += 1;
	assert.equal(
		( html.match( /data-ctb-part="text"/g ) || [] ).length,
		1,
		`${ fixture.name } emits one text editor target`
	);
	assertions += 1;
	check(
		html.includes(
			`<${ fixture.expectedTag } data-ctb-part="text"${
				fixture.expectedHref ? ` href="${ fixture.expectedHref }"` : ''
			}>${ fixture.text }</${ fixture.expectedTag }>`
		),
		`${ fixture.name } renders the expected target content`
	);
}

assert.equal( resolveTextRenderModel( { element: 'core/image' } ), null );
assertions += 1;
assert.equal( createTextTargetNodes( {}, '', null ), null );
assertions += 1;

// eslint-disable-next-line no-console
console.log( `PASS: ${ assertions } text renderer contract assertions.` );
