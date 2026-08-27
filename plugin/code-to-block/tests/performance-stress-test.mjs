import assert from 'node:assert/strict';

function generateDeepTree( depth, breadth, counter = { id: 0 } ) {
	if ( depth === 0 ) {
		return {
			id: `perf-leaf-${ counter.id++ }`,
			type: 'text',
			tag: 'p',
			attributes: {},
			children: [ { kind: 'text', value: `Leaf ${ counter.id }` } ],
			styles: { mapped: { padding: '8px' }, custom_css_fallback: '' },
			meta: { source: 'perf-test' },
		};
	}
	const children = [];
	for ( let i = 0; i < breadth; i++ ) {
		children.push( generateDeepTree( depth - 1, breadth, counter ) );
	}
	return {
		id: `perf-container-${ depth }-${ counter.id++ }`,
		type: 'container',
		tag: 'div',
		attributes: {},
		children,
		styles: { mapped: {}, custom_css_fallback: '' },
		meta: { source: 'perf-test' },
	};
}

function countBlocks( block ) {
	let count = 1;
	for ( const child of block.children ) {
		if ( child.kind !== 'text' ) {
			count += countBlocks( child );
		}
	}
	return count;
}

function maxDepth( block, depth = 1 ) {
	let max = depth;
	for ( const child of block.children ) {
		if ( child.kind !== 'text' ) {
			max = Math.max( max, maxDepth( child, depth + 1 ) );
		}
	}
	return max;
}

// Generate synthetic document: 8 levels, ~150 blocks
// Use depth 8, breadth 2 gives ~255 blocks, but we can trim to 150
const counter = { id: 0 };
const root = generateDeepTree( 8, 2, counter );
// Trim to ~160 blocks by pruning
function trimToCount( block, target, counter ) {
	let count = countBlocks( block );
	if ( count <= target ) return;
	for ( const child of block.children ) {
		if ( child.kind !== 'text' && count > target ) {
			const childCount = countBlocks( child );
			if ( count - childCount >= target ) {
				// Remove this child
				block.children = block.children.filter( ( c ) => c !== child );
				count -= childCount;
			} else {
				trimToCount( child, target - ( count - childCount ), counter );
				count = countBlocks( block );
			}
		}
	}
}
trimToCount( root, 160, counter);

const document = {
	schema_version: 1,
	name: 'Perf stress test',
	root,
};

const totalBlocks = countBlocks( document.root );
const depth = maxDepth( document.root );

console.log( `Generated document: ${ totalBlocks } blocks, ${ depth } levels` );

assert.ok( totalBlocks >= 150, `Synthetic page must have at least 150 blocks (got ${ totalBlocks })` );
assert.ok( depth >= 8, `Synthetic page must have at least 8 levels (got ${ depth })` );

// Simple in-memory performance sanity checks (without browser)
// Measure time to clone and count (simulates editor operations)
function measure( fn, iterations = 100 ) {
	const start = performance.now();
	for ( let i = 0; i < iterations; i++ ) {
		fn();
	}
	return ( performance.now() - start ) / iterations;
}

const cloneTime = measure( () => JSON.parse( JSON.stringify( document ) ), 50 );
console.log( `Clone time (avg of 50): ${ cloneTime.toFixed(2) }ms` );

const countTime = measure( () => countBlocks( document.root ), 200 );
console.log( `Count blocks time (avg of 200): ${ countTime.toFixed(3) }ms` );

// Simulate selection: find a deeply nested block
function findDeepBlock( block, targetDepth, currentDepth = 1 ) {
	if ( currentDepth === targetDepth ) return block;
	for ( const child of block.children ) {
		if ( child.kind !== 'text' ) {
			const found = findDeepBlock( child, targetDepth, currentDepth + 1 );
			if ( found ) return found;
		}
	}
	return null;
}
const deepBlock = findDeepBlock( document.root, 8 );
assert.ok( deepBlock, 'Must find a deeply nested block at depth 8' );

const findTime = measure( () => findDeepBlock( document.root, 8 ), 200 );
console.log( `Find deep block time (avg of 200): ${ findTime.toFixed(3) }ms` );

console.log( `PASS: Synthetic page generation and in-memory ops within expected bounds.` );
console.log( `Note: Full browser measurements (initial load, selection, drag, memory over 10m) require Playwright. Run with dedicated editor at http://localhost:8090/wp-admin/admin.php?page=code-to-block-dedicated&post=PERF_POST_ID` );
console.log( `To create the perf post, run: docker exec ctb-phase4-wp php -r "require \"/var/www/html/wp-load.php\"; echo wp_insert_post(array(\"post_type\"=>\"ctb_page\",\"post_status\"=>\"publish\",\"post_title\"=>\"Perf Stress Test\",\"post_name\"=>\"perf-stress-test\",\"post_author\"=>1));"` );
