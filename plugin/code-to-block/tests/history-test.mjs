import assert from 'node:assert/strict';

import {
	commitDocument,
	HISTORY_LIMIT,
	markSavedSnapshot,
	redoDocument,
	resetDocumentHistory,
	syncSavedDocument,
	undoDocument,
} from '../src/history.mjs';

function document( name, childId = `${ name }-child` ) {
	return {
		name,
		root: {
			id: `${ name }-root`,
			children: [ { id: childId, children: [] } ],
		},
	};
}

const first = document( 'first', 'shared-child' );
const second = document( 'second', 'shared-child' );
const third = document( 'third' );
const fourth = document( 'fourth' );
let state = {
	...resetDocumentHistory( first ),
	selectedBlockId: 'shared-child',
};

state = { ...state, ...commitDocument( state, second ) };
state = { ...state, ...commitDocument( state, third ) };
assert.deepEqual( state.past, [ first, second ] );
assert.equal( state.future.length, 0 );
assert.equal( state.selectedBlockId, third.root.id, 'Missing selections fall back to the root.' );

state = { ...state, ...undoDocument( state ) };
assert.equal( state.document, second );
assert.deepEqual( state.past, [ first ] );
assert.deepEqual( state.future, [ third ] );

state = { ...state, ...undoDocument( state ) };
assert.equal( state.document, first );
assert.deepEqual( state.future, [ second, third ] );

state = { ...state, ...redoDocument( state ) };
assert.equal( state.document, second );
assert.deepEqual( state.future, [ third ] );

state = { ...state, ...commitDocument( state, fourth ) };
assert.equal( state.document, fourth );
assert.equal( state.future.length, 0, 'A new edit must clear the redo branch.' );

const saved = document( 'saved' );
state = { ...state, ...syncSavedDocument( state, saved ) };
assert.equal( state.savedDocument, saved );
assert.equal( state.past.length, 2, 'Saving must preserve undo history.' );

const newer = document( 'newer' );
const submitted = state.document;
state = { ...state, ...commitDocument( state, newer ) };
state = {
	...state,
	...markSavedSnapshot( state, submitted, saved ),
};
assert.equal( state.past[ state.past.length - 1 ], saved );
assert.equal( state.document, newer, 'In-flight edits must remain current.' );

state = { ...state, ...resetDocumentHistory( first ) };
assert.equal( state.past.length, 0, 'Loading must reset stale history.' );
assert.equal( state.future.length, 0 );
assert.equal( state.savedDocument, first );

for ( let index = 0; index < HISTORY_LIMIT + 5; index++ ) {
	const next = document( `limit-${ index }` );
	state = { ...state, ...commitDocument( state, next ) };
}
assert.equal( state.past.length, HISTORY_LIMIT, 'History must stay bounded.' );

const unchanged = undoDocument( { ...state, past: [] } );
assert.equal( unchanged.document, state.document, 'Undo without history must be a no-op.' );

console.log( 'PASS: 19 bounded history assertions.' );
