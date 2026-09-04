import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement, renderToString } from '@wordpress/element';

import {
	createImageTargetElement,
	resolveImageRenderModel,
} from '../src/elements/image-renderer.mjs';
import { elementRootTargetAttributes } from '../src/elements/targets.mjs';

const fixtures = JSON.parse(
	await readFile(
		new URL( './fixtures/image-renderer-contract.json', import.meta.url ),
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
		element: 'core/image',
		attributes: fixture.attributes,
		props: fixture.props,
		styles: { mapped: { width: '100%' } },
	};
	const model = resolveImageRenderModel( block );
	const html = renderToString(
		createImageTargetElement(
			block,
			{
				...fixture.attributes,
				...elementRootTargetAttributes( block ),
				className: 'ctb-preview-block-1',
				style: { width: '100%' },
			},
			createElement
		)
	);
	check( model !== null, `${ fixture.name } resolves the Image renderer` );
	assert.deepEqual(
		model,
		{
			caption: fixture.expectedCaption,
			decorative: fixture.expectedAlt === '',
			link: fixture.expectedLink,
		},
		`${ fixture.name } resolves safe Image props`
	);
	assertions += 1;
	assert.equal(
		( html.match( /data-ctb-part="root"/g ) || [] ).length,
		1,
		`${ fixture.name } emits one root editor target`
	);
	assertions += 1;
	assert.equal(
		( html.match( /data-ctb-part="media"/g ) || [] ).length,
		1,
		`${ fixture.name } emits one media editor target`
	);
	assertions += 1;
	assert.equal(
		( html.match( /data-ctb-part="caption"/g ) || [] ).length,
		fixture.expectedCaption ? 1 : 0,
		`${ fixture.name } emits only its expected caption target`
	);
	assertions += 1;
	check(
		html.includes( `alt="${ fixture.expectedAlt }"` ),
		`${ fixture.name } renders the expected accessible alternative`
	);
	assert.equal(
		( html.match( /class="ctb-image-link"/g ) || [] ).length,
		fixture.expectedLink ? 1 : 0,
		`${ fixture.name } emits only its expected safe link wrapper`
	);
	assertions += 1;
	if ( fixture.expectedLink ) {
		check(
			html.includes( `href="${ fixture.expectedLink }"` ),
			`${ fixture.name } renders its safe destination`
		);
	}
	if ( fixture.expectedCaption ) {
		check(
			html.includes(
				`<figcaption data-ctb-part="caption">${ fixture.expectedCaption }</figcaption>`
			),
			`${ fixture.name } renders its caption content`
		);
	}
	check(
		html.includes( '<figure' ) && html.includes( '<img' ),
		`${ fixture.name } uses semantic figure and image markup`
	);
}

assert.equal( resolveImageRenderModel( { element: 'core/button' } ), null );
assertions += 1;
assert.equal( createImageTargetElement( {}, {}, null ), null );
assertions += 1;

// eslint-disable-next-line no-console
console.log( `PASS: ${ assertions } image renderer contract assertions.` );
