import assert from 'node:assert/strict';

import {
	COMPONENT_FAILURE_MESSAGE,
	createComponentDocument,
	insertComponent,
	materializeComponents,
} from '../src/reusable-components.mjs';

let assertions = 0;
function check( actual, expected, message ) {
	assert.deepEqual( actual, expected, message );
	assertions += 1;
}

function block( id, children = [] ) {
	return {
		id,
		type: 'container',
		tag: 'div',
		attributes: {},
		children,
		styles: { mapped: {}, custom_css_fallback: '' },
		meta: { source: 'test' },
	};
}

const child = block( 'child', [ { kind: 'text', value: 'Reusable' } ] );
child.attributes.id = 'shared-heading';
child.is_content_slot = true;
child.slot_label = 'Callout text';
child.slot_content_type = 'text';
const label = block( 'label' );
label.tag = 'label';
label.attributes = { for: 'shared-heading' };
child.children.push( label );
child.styles = {
	mapped: { color: 'var(--ctb-token-colors-brand)' },
	custom_css_fallback: '',
	token_bindings: { color: 'colors.brand' },
};
child.actions = [
	{
		trigger: 'click',
		behavior: 'toggle-visibility',
		params: { target_block_id: 'child' },
	},
];
child.meta.css_mapping = {
	version: 1,
	declarations: [
		{
			property: 'color',
			value: '#6558d3',
			important: false,
			origin: 'stylesheet',
			destination: 'style-control',
			control: 'color',
		},
	],
};
const page = {
	schema_version: 1,
	name: 'Page',
	design_tokens: {
		colors: { brand: { label: 'Brand', value: '#6558d3' } },
	},
	root: block( 'root', [ child, block( 'sibling' ) ] ),
};

const saved = createComponentDocument( page, child, 'Callout' );
check( saved.name, 'Callout', 'The supplied component name is retained.' );
check(
	saved.design_tokens.colors.brand.value,
	'#6558d3',
	'Only required token definitions are bundled.'
);
check(
	saved.root.actions[ 0 ].params.target_block_id,
	'child',
	'Internal actions remain canonical in storage.'
);
check(
	saved.root.meta.css_mapping.declarations[ 0 ].control,
	'color',
	'CSS mapping provenance travels with a saved component.'
);

const inserted = insertComponent( page, 'sibling', 7, 'instance-a' );
check(
	inserted.root.children[ 1 ].children[ 0 ].meta.saved_component_id,
	7,
	'A container target receives a lightweight linked placeholder.'
);
check(
	inserted.root.children[ 1 ].children[ 0 ].children,
	[],
	'Component content is not duplicated into the page document.'
);

const library = [ { id: 7, name: 'Callout', status: 'ready', document: saved } ];
const resolved = materializeComponents( inserted, library );
const wrapper = resolved.root.children[ 1 ].children[ 0 ];
const renderedRoot = wrapper.children[ 0 ];
check( renderedRoot.children[ 0 ].value, 'Reusable', 'A linked instance resolves in place.' );
check(
	renderedRoot.actions[ 0 ].params.target_block_id,
	renderedRoot.id,
	'Runtime action targets follow regenerated instance IDs.'
);
check(
	renderedRoot.styles.token_bindings.color,
	'colors.saved-7-brand',
	'Component token references are namespaced.'
);
check(
	renderedRoot.meta.css_mapping.declarations[ 0 ].destination,
	'style-control',
	'Materialization preserves component CSS mapping provenance.'
);
check(
	renderedRoot.styles.mapped.color,
	'var(--ctb-token-colors-saved-7-brand)',
	'Linked CSS values follow namespaced token references.'
);
check(
	resolved.design_tokens.colors[ 'saved-7-brand' ].value,
	'#6558d3',
	'Namespaced component token definitions are merged for rendering.'
);
check(
	renderedRoot.children[ 1 ].attributes.for,
	renderedRoot.attributes.id,
	'HTML ID references follow the regenerated DOM ID.'
);

const secondInstance = insertComponent( inserted, 'sibling', 7, 'instance-b' );
const twice = materializeComponents( secondInstance, library );
const firstId = twice.root.children[ 1 ].children[ 0 ].children[ 0 ].id;
const secondId = twice.root.children[ 1 ].children[ 1 ].children[ 0 ].id;
check( firstId === secondId, false, 'Every instance receives unique block IDs.' );
const overriddenInstances = materializeComponents(
	{ ...secondInstance, slot_values: { [ firstId ]: 'Personalized' } },
	library
);
check(
	overriddenInstances.root.children[ 1 ].children[ 0 ].children[ 0 ].children[ 0 ].value,
	'Personalized',
	'A page-local value overrides one linked component slot.'
);
check(
	overriddenInstances.root.children[ 1 ].children[ 1 ].children[ 0 ].children[ 0 ].value,
	'Reusable',
	'A linked slot override does not mutate another instance.'
);
const firstDomId = twice.root.children[ 1 ].children[ 0 ].children[ 0 ].attributes.id;
const secondDomId = twice.root.children[ 1 ].children[ 1 ].children[ 0 ].attributes.id;
check( firstDomId === secondDomId, false, 'Every instance receives unique DOM IDs.' );

const collisionPage = cloneForTest( inserted );
collisionPage.root.children.push( block( 'saved-7-instance-a-1' ) );
const collisionResolved = materializeComponents( collisionPage, library );
check(
	collisionResolved.root.children[ 1 ].children[ 0 ].children[ 0 ].id,
	'saved-7-instance-a-1-2',
	'Generated IDs cannot collide with existing page block IDs.'
);

const corrupted = [
	{ id: 7, name: 'Callout', status: 'ready', document: { root: { id: 3 } } },
];
const isolated = materializeComponents( inserted, corrupted );
check(
	isolated.root.children[ 0 ].children[ 0 ].value,
	'Reusable',
	'A sibling outside the corrupt component remains intact.'
);
check(
	isolated.root.children[ 1 ].children[ 0 ].children[ 0 ].value,
	COMPONENT_FAILURE_MESSAGE,
	'Corrupt data becomes the required contained fallback.'
);
check(
	isolated.root.children[ 1 ].children[ 0 ].meta.component_error,
	true,
	'The failed position is explicitly marked for isolated rendering.'
);

const wideRoot = block( 'wide-root' );
for ( let index = 0; index < 999; index++ ) {
	wideRoot.children.push( block( `wide-${ index }` ) );
}
const overLimit = materializeComponents( inserted, [
	{
		id: 7,
		name: 'Too wide',
		status: 'ready',
		document: { schema_version: 1, name: 'Too wide', root: wideRoot },
	},
] );
check(
	overLimit.root.children[ 1 ].children[ 0 ].children[ 0 ].value,
	COMPONENT_FAILURE_MESSAGE,
	'Aggregate expansion beyond 1000 blocks fails only that instance.'
);

const tokenLimitPage = cloneForTest( inserted );
for ( let index = 0; index < 99; index++ ) {
	tokenLimitPage.design_tokens.colors[ `extra-${ index }` ] = {
		label: `Extra ${ index }`,
		value: '#111111',
	};
}
const tokenLimited = materializeComponents( tokenLimitPage, library );
check(
	tokenLimited.root.children[ 1 ].children[ 0 ].children[ 0 ].value,
	COMPONENT_FAILURE_MESSAGE,
	'Component token merging cannot exceed the 100-token document limit.'
);

let nestedError = '';
try {
	createComponentDocument( inserted, inserted.root.children[ 1 ], 'Nested' );
} catch ( error ) {
	nestedError = error.message;
}
check( nestedError, '', 'Client extraction remains lossless; the server owns canonical rejection.' );

console.log( `PASS: ${ assertions } reusable-component assertions.` );

function cloneForTest( value ) {
	return JSON.parse( JSON.stringify( value ) );
}
