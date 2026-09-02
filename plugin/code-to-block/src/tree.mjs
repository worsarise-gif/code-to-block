export function findBlock( block, id ) {
	if ( block.id === id ) {
		return block;
	}

	for ( const child of block.children ) {
		if ( child.kind !== 'text' ) {
			const match = findBlock( child, id );
			if ( match ) {
				return match;
			}
		}
	}

	return null;
}

export function findBlockLocation(
	block,
	id,
	parentId = null,
	index = 0,
	depth = 0,
	ancestorIds = []
) {
	if ( block.id === id ) {
		return { block, parentId, index, depth, ancestorIds };
	}

	let blockIndex = 0;
	for ( const child of block.children || [] ) {
		if ( child.kind === 'text' ) {
			continue;
		}
		const match = findBlockLocation(
			child,
			id,
			block.id,
			blockIndex,
			depth + 1,
			[ ...ancestorIds, block.id ]
		);
		if ( match ) {
			return match;
		}
		blockIndex += 1;
	}

	return null;
}

export function countBlocks( block ) {
	return (
		1 +
		block.children.reduce(
			( total, child ) =>
				total + ( child.kind === 'text' ? 0 : countBlocks( child ) ),
			0
		)
	);
}

function findParent( block, id ) {
	for ( const child of block.children ) {
		if ( child.kind === 'text' ) {
			continue;
		}
		if ( child.id === id ) {
			return block;
		}
		const parent = findParent( child, id );
		if ( parent ) {
			return parent;
		}
	}

	return null;
}

function siblingBlockIndex( children, start, direction ) {
	for (
		let index = start + direction;
		index >= 0 && index < children.length;
		index += direction
	) {
		if ( children[ index ].kind !== 'text' ) {
			return index;
		}
	}

	return -1;
}

export function canMoveBlock( root, id, direction ) {
	const parent = findParent( root, id );
	if ( ! parent ) {
		return false;
	}
	const index = parent.children.findIndex(
		( child ) => child.kind !== 'text' && child.id === id
	);
	return siblingBlockIndex( parent.children, index, direction ) !== -1;
}

export function moveBlockSibling( root, id, direction ) {
	const parent = findParent( root, id );
	if ( ! parent ) {
		return false;
	}
	const index = parent.children.findIndex(
		( child ) => child.kind !== 'text' && child.id === id
	);
	const siblingIndex = siblingBlockIndex( parent.children, index, direction );
	if ( siblingIndex === -1 ) {
		return false;
	}

	const [ moved ] = parent.children.splice( index, 1 );
	const insertionIndex = direction < 0 ? siblingIndex : siblingIndex;
	parent.children.splice( insertionIndex, 0, moved );
	return true;
}
