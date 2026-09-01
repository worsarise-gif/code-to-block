import assert from 'node:assert/strict';

import { validateCatalog } from '../src/controls/catalog.mjs';
import {
	ELEMENT_DEFINITIONS,
	FIRST_CLASS_ELEMENT_COUNT,
	createElementBlock,
	getElementDefinition,
	inferElementDefinition,
	paletteGroups,
	registryManifest,
	validateElementRegistry,
} from '../src/elements/registry.mjs';
import { resolveInspector } from '../src/elements/resolver.mjs';

let assertions = 0;
function check( condition, message ) {
	assert.ok( condition, message );
	assertions += 1;
}

assert.deepEqual( validateCatalog(), [] );
assertions += 1;
assert.deepEqual( validateElementRegistry(), [] );
assertions += 1;
check(
	FIRST_CLASS_ELEMENT_COUNT === 58,
	'registry must include all 58 first-class elements'
);
check(
	ELEMENT_DEFINITIONS.length === 59,
	'registry must include the limited legacy fallback'
);
check(
	paletteGroups().flatMap( ( group ) => group.items ).length === 58,
	'all first-class elements are discoverable in the palette'
);
check(
	Object.keys( registryManifest().elements ).length === 59,
	'manifest includes every definition'
);

const button = createElementBlock( 'button', 'fixture' );
check(
	button.element === 'core/button',
	'button factory stores stable element identity'
);
check(
	button.definition_version === 1,
	'button factory stores independent definition version'
);
check(
	button.type === 'button' && button.tag === 'a',
	'button preserves renderer family and semantics'
);
const buttonPanel = resolveInspector( button );
check(
	buttonPanel.tabs.content.groups[ 0 ].controls.some(
		( control ) => control.id === 'mode'
	),
	'button content includes mode'
);
check(
	buttonPanel.tabs.style.groups.some(
		( group ) => group.id === 'typography'
	),
	'button grants typography'
);
check(
	buttonPanel.tabs.style.states.includes( 'loading' ),
	'button grants loading state'
);
check(
	! buttonPanel.tabs.advanced.groups.some(
		( group ) => group.id === 'typography'
	),
	'advanced never contains style groups'
);

const spacer = createElementBlock( 'spacer', 'fixture' );
const spacerPanel = resolveInspector( spacer );
check(
	spacerPanel.tabs.style.groups.length === 1 &&
		spacerPanel.tabs.style.groups[ 0 ].id === 'sizing',
	'spacer exposes sizing only'
);
check(
	! spacerPanel.tabs.style.properties.includes( 'font-size' ),
	'spacer excludes typography'
);

const image = createElementBlock( 'image', 'fixture' );
const imagePanel = resolveInspector( image );
check(
	imagePanel.tabs.content.groups[ 0 ].controls.some(
		( control ) => control.id === 'alt'
	),
	'image includes alt text'
);
check(
	! imagePanel.tabs.style.properties.includes( 'font-family' ),
	'image excludes root typography'
);
check(
	imagePanel.tabs.advanced.groups.some(
		( group ) => group.id === 'performance'
	),
	'image includes performance'
);

check(
	inferElementDefinition( { type: 'text', tag: 'h4' } ).definition.id ===
		'core/heading',
	'heading matcher is deterministic'
);
check(
	inferElementDefinition( {
		type: 'form_field',
		tag: 'input',
		attributes: { type: 'checkbox' },
	} ).definition.id === 'forms/checkbox',
	'checkbox matcher is deterministic'
);
check(
	inferElementDefinition( { type: 'container', tag: 'table' } ).definition
		.id === 'legacy/html-node',
	'ambiguous native table uses compatibility fallback'
);
check(
	getElementDefinition( 'missing/definition' ).id === 'legacy/html-node',
	'unknown definition uses safe fallback'
);

console.log( `PASS: ${ assertions } control registry assertions.` );
