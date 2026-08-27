import assert from 'node:assert/strict';

import { canMoveBlock, moveBlockSibling } from '../src/tree.mjs';

const text = ( value ) => ( { kind: 'text', value } );
const block = ( id, children = [] ) => ( { id, children } );
const root = block( 'root', [
	block( 'first' ),
	text( 'between' ),
	block( 'second', [ block( 'nested' ) ] ),
	block( 'third' ),
] );

assert.equal( canMoveBlock( root, 'root', -1 ), false );
assert.equal( canMoveBlock( root, 'first', -1 ), false );
assert.equal( canMoveBlock( root, 'first', 1 ), true );
assert.equal( canMoveBlock( root, 'second', -1 ), true );
assert.equal( canMoveBlock( root, 'third', 1 ), false );
assert.equal( canMoveBlock( root, 'nested', -1 ), false );

assert.equal( moveBlockSibling( root, 'second', -1 ), true );
assert.deepEqual(
	root.children.filter( ( child ) => child.kind !== 'text' ).map( ( child ) => child.id ),
	[ 'second', 'first', 'third' ]
);
assert.equal( moveBlockSibling( root, 'second', 1 ), true );
assert.deepEqual(
	root.children.filter( ( child ) => child.kind !== 'text' ).map( ( child ) => child.id ),
	[ 'first', 'second', 'third' ]
);
assert.equal( moveBlockSibling( root, 'missing', 1 ), false );

console.log( 'PASS: 10 sibling tree-order assertions.' );
