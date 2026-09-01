import assert from 'node:assert/strict';

import {
	dropPositionForPoint,
	rankDropCandidates,
	resolveDropIntent,
} from '../src/drop-intent.mjs';

let assertions = 0;
function equal( actual, expected, message ) {
	assert.equal( actual, expected, message );
	assertions += 1;
}

const rect = { left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 };

equal( dropPositionForPoint( { x: 50, y: 10 }, rect, true ), 'before', 'A container top edge inserts before.' );
equal( dropPositionForPoint( { x: 50, y: 25 }, rect, true ), 'inside', 'The top-edge seam deterministically belongs to inside.' );
equal( dropPositionForPoint( { x: 50, y: 50 }, rect, true ), 'inside', 'A container center inserts inside.' );
equal( dropPositionForPoint( { x: 50, y: 76 }, rect, true ), 'after', 'The bottom-edge seam deterministically belongs to after.' );
equal( dropPositionForPoint( { x: 50, y: 90 }, rect, true ), 'after', 'A container bottom edge inserts after.' );
equal( dropPositionForPoint( { x: 50, y: 49 }, rect, false ), 'before', 'A leaf top half inserts before.' );
equal( dropPositionForPoint( { x: 50, y: 50 }, rect, false ), 'after', 'A leaf midpoint deterministically inserts after.' );
equal( dropPositionForPoint( { x: 0, y: 0 }, { left: 0, top: 0, width: 0, height: 0 }, true ), 'inside', 'An empty container still accepts an inside drop.' );

const parent = {
	id: 'parent',
	rect,
	depth: 1,
	order: 0,
	parentId: 'root',
	index: 0,
	childCount: 2,
	canContain: true,
	valid: true,
};
const child = {
	id: 'child',
	rect: { left: 20, top: 20, right: 180, bottom: 80, width: 160, height: 60 },
	depth: 2,
	order: 1,
	parentId: 'parent',
	index: 1,
	childCount: 0,
	canContain: false,
	valid: true,
};

equal( rankDropCandidates( [ parent, child ] )[ 0 ].id, 'child', 'The deepest target wins nested overlap.' );
equal( rankDropCandidates( [ { ...child, id: 'wide' }, { ...child, id: 'narrow', rect: { left: 40, top: 30, right: 100, bottom: 60, width: 60, height: 30 } } ] )[ 0 ].id, 'narrow', 'The smallest target breaks equal-depth ties.' );
equal( rankDropCandidates( [ { ...child, id: 'invalid', valid: false }, child ] )[ 0 ].id, 'child', 'A valid target wins an equal-depth tie.' );

let intent = resolveDropIntent( { point: { x: 50, y: 30 }, candidates: [ parent, child ] } );
equal( intent.targetId, 'child', 'Intent uses the deepest hovered target.' );
equal( intent.position, 'before', 'Leaf geometry is retained in the resolved intent.' );
equal( intent.parentId, 'parent', 'Before resolves to the target parent.' );
equal( intent.index, 1, 'Before resolves to the target index.' );
equal( intent.valid, true, 'A valid candidate produces valid intent.' );

intent = resolveDropIntent( { point: { x: 10, y: 50 }, candidates: [ parent ] } );
equal( intent.position, 'inside', 'Container middle resolves inside.' );
equal( intent.parentId, 'parent', 'Inside makes the target the destination parent.' );
equal( intent.index, 2, 'Inside appends after existing block children.' );

intent = resolveDropIntent( {
	point: { x: 50, y: 30 },
	candidates: [ { ...child, valid: false, reason: 'Cannot move into a descendant.' } ],
} );
equal( intent.valid, false, 'Invalid target metadata remains invalid.' );
equal( intent.reason, 'Cannot move into a descendant.', 'Invalid intent preserves a useful reason.' );

intent = resolveDropIntent( {
	point: { x: 50, y: 2 },
	candidates: [ { ...parent, id: 'root', parentId: null, allowSibling: false } ],
} );
equal( intent.position, 'inside', 'The root always resolves to an inside drop.' );
equal( intent.parentId, 'root', 'The root can be the destination parent.' );
equal( intent.valid, true, 'A root inside drop is valid.' );

equal( resolveDropIntent( { point: { x: 500, y: 500 }, candidates: [ parent ] } ), null, 'A point outside all targets has no intent.' );
equal( resolveDropIntent( { point: null, candidates: [ parent ] } ), null, 'Missing pointer geometry has no intent.' );

console.log( `PASS: ${ assertions } drop-intent assertions.` );
