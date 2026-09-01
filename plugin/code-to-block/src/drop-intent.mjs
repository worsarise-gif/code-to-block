const DEFAULT_EDGE_RATIO = 0.25;
const MIN_EDGE_SIZE = 8;
const MAX_EDGE_SIZE = 24;

function finiteNumber( value, fallback = 0 ) {
	return Number.isFinite( Number( value ) ) ? Number( value ) : fallback;
}

function normalizeRect( rect ) {
	const left = finiteNumber( rect?.left );
	const top = finiteNumber( rect?.top );
	const width = Math.max(
		0,
		finiteNumber( rect?.width, finiteNumber( rect?.right ) - left )
	);
	const height = Math.max(
		0,
		finiteNumber( rect?.height, finiteNumber( rect?.bottom ) - top )
	);

	return {
		left,
		top,
		right: finiteNumber( rect?.right, left + width ),
		bottom: finiteNumber( rect?.bottom, top + height ),
		width,
		height,
	};
}

function containsPoint( rect, point ) {
	return (
		point.x >= rect.left &&
		point.x <= rect.right &&
		point.y >= rect.top &&
		point.y <= rect.bottom
	);
}

function candidatePriority( left, right ) {
	const depthDifference =
		finiteNumber( right.depth ) - finiteNumber( left.depth );
	if ( depthDifference ) {
		return depthDifference;
	}

	if ( Boolean( left.valid ) !== Boolean( right.valid ) ) {
		return left.valid ? -1 : 1;
	}

	const leftRect = normalizeRect( left.rect );
	const rightRect = normalizeRect( right.rect );
	const areaDifference =
		leftRect.width * leftRect.height - rightRect.width * rightRect.height;
	if ( areaDifference ) {
		return areaDifference;
	}

	const orderDifference =
		finiteNumber( left.order ) - finiteNumber( right.order );
	if ( orderDifference ) {
		return orderDifference;
	}

	return String( left.id ).localeCompare( String( right.id ) );
}

export function rankDropCandidates( candidates ) {
	return [ ...( candidates || [] ) ].sort( candidatePriority );
}

export function dropPositionForPoint( point, rect, canContain ) {
	const normalizedRect = normalizeRect( rect );
	if ( normalizedRect.height <= 0 ) {
		return canContain ? 'inside' : 'after';
	}

	if ( ! canContain ) {
		return point.y < normalizedRect.top + normalizedRect.height / 2
			? 'before'
			: 'after';
	}

	const edgeSize = Math.min(
		normalizedRect.height / 2,
		MAX_EDGE_SIZE,
		Math.max(
			MIN_EDGE_SIZE,
			normalizedRect.height * DEFAULT_EDGE_RATIO
		)
	);
	if ( point.y < normalizedRect.top + edgeSize ) {
		return 'before';
	}
	if ( point.y >= normalizedRect.bottom - edgeSize ) {
		return 'after';
	}
	return 'inside';
}

export function resolveDropIntent( { point, candidates } ) {
	if ( ! point || ! Number.isFinite( point.x ) || ! Number.isFinite( point.y ) ) {
		return null;
	}

	const ranked = rankDropCandidates(
		( candidates || [] ).filter( ( candidate ) =>
			containsPoint( normalizeRect( candidate.rect ), point )
		)
	);
	const target = ranked[ 0 ];
	if ( ! target ) {
		return null;
	}

	let position = dropPositionForPoint(
		point,
		target.rect,
		Boolean( target.canContain )
	);
	if ( target.allowSibling === false ) {
		position = target.canContain ? 'inside' : position;
	}

	const parentId = position === 'inside' ? target.id : target.parentId || null;
	const index =
		position === 'inside'
			? finiteNumber( target.childCount )
			: finiteNumber( target.index ) + ( position === 'after' ? 1 : 0 );
	const valid = Boolean( target.valid ) && Boolean( parentId );

	return {
		targetId: target.id,
		position,
		parentId,
		index,
		valid,
		reason: valid ? '' : target.reason || 'This is not a valid drop target.',
	};
}
