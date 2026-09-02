import assert from 'node:assert/strict';

import {
	createPrimitiveBlock,
	setHiddenInFallback,
	setStyleSetBindings,
	updateBlockStyleSet,
	updateEditableBlock,
} from '../src/store/block-commands.mjs';
import { findBlock } from '../src/tree.mjs';

const child = {
	id: 'child',
	type: 'text',
	tag: 'p',
	attributes: {},
	children: [ { kind: 'text', value: 'Original' } ],
	styles: {
		mapped: { color: 'red' },
		custom_css_fallback: 'margin: 1px;',
		token_bindings: { color: 'brand' },
		role_bindings: { color: { role: 'body' } },
		import_review_flags: { color: { reason: 'fixture' } },
	},
};
const locked = {
	...JSON.parse( JSON.stringify( child ) ),
	id: 'locked',
	permissions: { locked: true },
};
const document = {
	schema_version: 2,
	root: {
		id: 'root',
		type: 'container',
		tag: 'main',
		attributes: {},
		children: [ child, locked ],
		styles: { mapped: {}, custom_css_fallback: '' },
	},
};
const state = {
	document,
	past: [],
	future: [ document ],
	selectedBlockId: 'root',
};

assert.equal(
	updateBlockStyleSet( state, 'missing', 'desktop', ( value ) => value ),
	state
);
assert.equal(
	updateBlockStyleSet( state, 'locked', 'desktop', ( value ) => value ),
	state
);
assert.equal(
	updateBlockStyleSet( state, 'child', 'desktop', ( value ) => value ),
	state
);

let editableStyleSet;
const styleResult = updateBlockStyleSet(
	state,
	'child',
	'desktop',
	( styleSet ) => {
		editableStyleSet = styleSet;
		styleSet.mapped.color = 'green';
		styleSet.role_bindings.color.role = 'heading';
		return styleSet;
	}
);
const updatedChild = findBlock( styleResult.document.root, 'child' );
assert.notEqual( styleResult, state );
assert.notEqual( editableStyleSet, child.styles );
assert.notEqual( editableStyleSet.mapped, child.styles.mapped );
assert.notEqual( editableStyleSet.role_bindings, child.styles.role_bindings );
assert.equal( child.styles.mapped.color, 'red' );
assert.equal( updatedChild.styles.mapped.color, 'green' );
assert.equal( updatedChild.styles.role_bindings.color.role, 'heading' );
assert.equal( styleResult.past[ 0 ], document );
assert.deepEqual( styleResult.future, [] );
assert.equal( styleResult.selectedBlockId, 'child' );
assert.equal( styleResult.document.history.at( -1 ).action, 'Style updated' );

assert.equal(
	updateEditableBlock( state, 'missing', () => {} ),
	state
);
assert.equal(
	updateEditableBlock( state, 'locked', () => {} ),
	state
);
const editResult = updateEditableBlock( state, 'child', ( block ) => {
	block.attributes.title = 'Changed';
} );
assert.equal( child.attributes.title, undefined );
assert.equal(
	findBlock( editResult.document.root, 'child' ).attributes.title,
	'Changed'
);
const lockedResult = updateEditableBlock(
	state,
	'locked',
	( block ) => {
		block.attributes.title = 'Allowed';
	},
	true
);
assert.equal(
	findBlock( lockedResult.document.root, 'locked' ).attributes.title,
	'Allowed'
);

const boundStyleSet = { mapped: {}, custom_css_fallback: '' };
assert.equal(
	setStyleSetBindings( boundStyleSet, { color: 'brand' } ),
	boundStyleSet
);
assert.deepEqual( boundStyleSet.token_bindings, { color: 'brand' } );
assert.equal( setStyleSetBindings( boundStyleSet, {} ), boundStyleSet );
assert.equal( boundStyleSet.token_bindings, undefined );

assert.equal(
	setHiddenInFallback( 'color: red; display: grid;', true ),
	'color: red; display: none !important;'
);
assert.equal(
	setHiddenInFallback( 'color: red; display: none;', false, 'grid' ),
	'color: red; display: grid !important;'
);
assert.equal( setHiddenInFallback( '', false ), '' );

const primitive = createPrimitiveBlock( 'button' );
assert.equal( primitive.type, 'button' );
assert.equal( primitive.tag, 'a' );

console.log( 'PASS: 28 store block-command assertions.' );
