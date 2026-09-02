import assert from 'node:assert/strict';

import {
	canMoveBlock,
	countBlocks,
	findBlock,
	findBlockLocation,
	moveBlockSibling,
} from '../src/tree.mjs';

const text = ( value ) => ( { kind: 'text', value } );
const block = ( id, children = [] ) => ( { id, children } );
const root = block( 'root', [
	block( 'first' ),
	text( 'between' ),
	block( 'second', [ block( 'nested' ) ] ),
	block( 'third' ),
] );

const selectorRoot = block( 'selector-root', [
	block( 'alpha' ),
	text( 'between selectors' ),
	block( 'beta', [
		text( 'nested text' ),
		block( 'nested', [ block( 'leaf' ) ] ),
	] ),
] );
const selectorSnapshot = JSON.stringify( selectorRoot );
const nestedBlock = selectorRoot.children[ 2 ].children[ 1 ];

assert.equal( findBlock( selectorRoot, 'selector-root' ), selectorRoot );
assert.equal( findBlock( selectorRoot, 'nested' ), nestedBlock );
assert.equal( findBlock( selectorRoot, 'missing' ), null );

const nestedLocation = findBlockLocation( selectorRoot, 'nested' );
assert.equal( nestedLocation.block, nestedBlock );
assert.equal( nestedLocation.parentId, 'beta' );
assert.equal( nestedLocation.index, 0 );
assert.equal( nestedLocation.depth, 2 );
assert.deepEqual( nestedLocation.ancestorIds, [ 'selector-root', 'beta' ] );

const rootLocation = findBlockLocation( selectorRoot, 'selector-root' );
assert.equal( rootLocation.parentId, null );
assert.equal( rootLocation.index, 0 );
assert.equal( rootLocation.depth, 0 );
assert.deepEqual( rootLocation.ancestorIds, [] );
assert.equal( findBlockLocation( selectorRoot, 'missing' ), null );
assert.equal( countBlocks( selectorRoot ), 5 );
assert.equal( JSON.stringify( selectorRoot ), selectorSnapshot );

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

console.log( 'PASS: 25 tree query and sibling-order assertions.' );
