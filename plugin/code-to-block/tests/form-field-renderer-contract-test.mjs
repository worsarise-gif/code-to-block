import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement, renderToString } from '@wordpress/element';

import {
	createFormFieldTargetNodes,
	resolveFormFieldRenderModel,
} from '../src/elements/form-field-renderer.mjs';
import { elementRootTargetAttributes } from '../src/elements/targets.mjs';

const fixtures = JSON.parse(
	await readFile(
		new URL(
			'./fixtures/form-field-renderer-contract.json',
			import.meta.url
		),
		'utf8'
	)
);

let assertions = 0;
function check( condition, message ) {
	assert.ok( condition, message );
	assertions += 1;
}

for ( const [ fixtureIndex, fixture ] of fixtures.entries() ) {
	const block = {
		id: `field-contract-${ fixtureIndex }`,
		element: 'forms/field-group',
		attributes: fixture.attributes,
		props: fixture.props,
	};
	const model = resolveFormFieldRenderModel( block );
	const html = renderToString(
		createElement(
			'div',
			elementRootTargetAttributes( block ),
			createFormFieldTargetNodes( block, createElement )
		)
	);
	check(
		model !== null,
		`${ fixture.name } resolves the Form Field renderer`
	);
	assert.deepEqual(
		{
			fieldType: model.fieldType,
			label: model.label,
			name: model.name,
			placeholder: model.placeholder,
			help: model.help,
			required: model.required,
			options: model.options,
		},
		{
			fieldType: fixture.expected.fieldType,
			label: fixture.expected.label,
			name: fixture.expected.name,
			placeholder: fixture.expected.placeholder,
			help: fixture.expected.help,
			required: fixture.expected.required,
			options: fixture.expected.options,
		},
		`${ fixture.name } resolves semantic values and compatibility fallbacks`
	);
	assertions += 1;
	for ( const part of [ 'root', 'row', 'label', 'help', 'error' ] ) {
		assert.equal(
			(
				html.match( new RegExp( `data-ctb-part="${ part }"`, 'g' ) ) ||
				[]
			).length,
			1,
			`${ fixture.name } emits its ${ part } target exactly once`
		);
		assertions += 1;
	}
	assert.equal(
		( html.match( /data-ctb-part="control"/g ) || [] ).length,
		fixture.expected.controlCount,
		`${ fixture.name } emits the expected control target count`
	);
	assertions += 1;
	assert.equal(
		( html.match( /data-ctb-part="requiredMark"/g ) || [] ).length,
		fixture.expected.requiredMarkCount,
		`${ fixture.name } emits the required mark only when required`
	);
	assertions += 1;
	check(
		html.includes( `<${ fixture.expected.controlTag }` ),
		`${ fixture.name } emits the expected native control`
	);
	check(
		! html.includes( 'data-ctb-part="placeholder"' ),
		`${ fixture.name } never emits a synthetic placeholder node`
	);
	check(
		html.includes( `aria-errormessage="${ model.errorId }"` ),
		`${ fixture.name } associates controls with the error target`
	);
}

assert.equal(
	resolveFormFieldRenderModel( { element: 'forms/input' } ),
	null,
	'standalone controls do not claim the field-group renderer contract'
);
assertions += 1;
assert.equal( createFormFieldTargetNodes( {}, null ), null );
assertions += 1;

// eslint-disable-next-line no-console
console.log( `PASS: ${ assertions } Form Field renderer contract assertions.` );
