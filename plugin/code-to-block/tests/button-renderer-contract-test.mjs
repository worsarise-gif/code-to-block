import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement, renderToString } from '@wordpress/element';

import {
	createButtonTargetNodes,
	resolveButtonRenderModel,
} from '../src/elements/button-renderer.mjs';
import { elementRootTargetAttributes } from '../src/elements/targets.mjs';

const fixtures = JSON.parse(
	await readFile(
		new URL( './fixtures/button-renderer-contract.json', import.meta.url ),
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
		props: fixture.props,
	};
	const rootAttributes = elementRootTargetAttributes( block );
	const model = resolveButtonRenderModel( block );
	const html = renderToString(
		createElement(
			fixture.tag,
			rootAttributes,
			createButtonTargetNodes( block, fixture.text, createElement )
		)
	);
	check( model !== null, `${ fixture.name } resolves the button renderer` );
	assert.deepEqual(
		model.parts,
		fixture.expectedParts,
		`${ fixture.name } emits its targets in DOM order`
	);
	assertions += 1;
	check(
		model.loadingLabel ===
			( fixture.expectedLabel === fixture.text
				? ''
				: fixture.expectedLabel ),
		`${ fixture.name } resolves its label override`
	);
	assert.deepEqual(
		rootAttributes,
		{
			'data-ctb-element': fixture.element,
			'data-ctb-part': 'root',
		},
		`${ fixture.name } emits the editor root target contract`
	);
	assertions += 1;
	for ( const targetPart of [ 'root', 'label', 'icon', 'spinner' ] ) {
		const expectedCount =
			targetPart === 'root' ||
			fixture.expectedParts.includes( targetPart )
				? 1
				: 0;
		assert.equal(
			(
				html.match(
					new RegExp( `data-ctb-part="${ targetPart }"`, 'g' )
				) || []
			).length,
			expectedCount,
			`${ fixture.name } emits only its expected ${ targetPart } editor target`
		);
		assertions += 1;
	}
	let previousPosition = -1;
	for ( const expectedPart of fixture.expectedParts ) {
		const partPosition = html.indexOf(
			`data-ctb-part="${ expectedPart }"`
		);
		check(
			partPosition > previousPosition,
			`${ fixture.name } preserves editor target DOM order`
		);
		previousPosition = partPosition;
	}
	check(
		html.includes(
			`<span data-ctb-part="label">${ fixture.expectedLabel }</span>`
		),
		`${ fixture.name } renders its expected editor label content`
	);
}

assert.equal( resolveButtonRenderModel( { element: 'core/image' } ), null );
assertions += 1;
assert.equal( createButtonTargetNodes( {}, '', null ), null );
assertions += 1;
assert.deepEqual( elementRootTargetAttributes( { type: 'button' } ), {} );
assertions += 1;

// eslint-disable-next-line no-console
console.log( `PASS: ${ assertions } button renderer contract assertions.` );
