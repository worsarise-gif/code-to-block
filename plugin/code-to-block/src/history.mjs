export const HISTORY_LIMIT = 50;
export const PERSISTENT_HISTORY_LIMIT = 100;

let historySequence = 0;

function blockIndex( root, index = new Map(), parentId = '' ) {
	index.set( root.id, { block: root, parentId } );
	for ( const child of root.children || [] ) {
		if ( child.kind !== 'text' ) {
			blockIndex( child, index, root.id );
		}
	}
	return index;
}

function textValue( block ) {
	return ( block?.children || [] )
		.filter( ( child ) => child.kind === 'text' )
		.map( ( child ) => child.value )
		.join( '' );
}

function changed( left, right, key ) {
	return JSON.stringify( left?.[ key ] ) !== JSON.stringify( right?.[ key ] );
}

export function describeDocumentChange( previous, next, selectedBlockId ) {
	const before = blockIndex( previous.root );
	const after = blockIndex( next.root );
	if ( after.size > before.size ) return 'Element added';
	if ( after.size < before.size ) return 'Element deleted';
	for ( const [ id, entry ] of after ) {
		if ( before.get( id )?.parentId !== entry.parentId ) return 'Element moved';
	}
	if ( changed( previous, next, 'seo' ) ) return 'SEO settings updated';
	const id = selectedBlockId || next.root.id;
	const oldBlock = before.get( id )?.block;
	const newBlock = after.get( id )?.block;
	if ( oldBlock && newBlock ) {
		if ( textValue( oldBlock ) !== textValue( newBlock ) ) return 'Text edited';
		if ( oldBlock.attributes?.src !== newBlock.attributes?.src ) return 'Image changed';
		if ( changed( oldBlock, newBlock, 'permissions' ) ) return 'Permissions updated';
		if ( changed( oldBlock, newBlock, 'visibility_conditions' ) ) return 'Visibility conditions updated';
		if ( changed( oldBlock, newBlock, 'performance' ) ) return 'Performance settings updated';
		if ( changed( oldBlock, newBlock, 'states' ) || changed( oldBlock, newBlock, 'styles' ) || changed( oldBlock, newBlock, 'responsive_overrides' ) ) return 'Style updated';
		if ( changed( oldBlock, newBlock, 'attributes' ) ) return 'Attributes updated';
		if ( changed( oldBlock, newBlock, 'is_dynamic' ) || changed( oldBlock, newBlock, 'dynamic_source' ) || changed( oldBlock, newBlock, 'is_content_slot' ) ) return 'Dynamic data updated';
	}
	return 'Page updated';
}

export function appendPersistentHistory( document, action, blockId ) {
	const history = Array.isArray( document.history ) ? document.history : [];
	document.history = [
		...history,
		{
			id: `history-${ Date.now().toString( 36 ) }-${ ++historySequence }`,
			action,
			timestamp: new Date().toISOString(),
			...( blockId ? { block_id: blockId } : {} ),
		},
	].slice( -PERSISTENT_HISTORY_LIMIT );
	return document;
}

function containsBlock( block, id ) {
	if ( block.id === id ) {
		return true;
	}

	return block.children.some(
		( child ) => child.kind !== 'text' && containsBlock( child, id )
	);
}

function selectedBlockIdFor( document, selectedBlockId ) {
	return containsBlock( document.root, selectedBlockId )
		? selectedBlockId
		: document.root.id;
}

export function commitDocument( state, document, selectedBlockId ) {
	if ( document === state.document ) {
		return state;
	}

	const selection = selectedBlockId || state.selectedBlockId;
	appendPersistentHistory(
		document,
		describeDocumentChange( state.document, document, selection ),
		selection
	);
	return {
		document,
		past: [ ...state.past, state.document ].slice( -HISTORY_LIMIT ),
		future: [],
		selectedBlockId: selectedBlockIdFor(
			document,
			selection
		),
	};
}

export function resetDocumentHistory( document ) {
	return {
		document,
		past: [],
		future: [],
		selectedBlockId: document.root.id,
		savedDocument: document,
	};
}

export function syncSavedDocument( state, document ) {
	return {
		document,
		selectedBlockId: selectedBlockIdFor( document, state.selectedBlockId ),
		savedDocument: document,
	};
}

export function markSavedSnapshot( state, snapshot, savedDocument ) {
	return {
		savedDocument,
		past: state.past.map( ( document ) =>
			document === snapshot ? savedDocument : document
		),
		future: state.future.map( ( document ) =>
			document === snapshot ? savedDocument : document
		),
	};
}

export function undoDocument( state ) {
	if ( state.past.length === 0 ) {
		return state;
	}

	const document = state.past[ state.past.length - 1 ];
	document.history = [ ...( state.document.history || [] ) ];
	appendPersistentHistory( document, 'Undo applied', state.selectedBlockId );
	return {
		document,
		past: state.past.slice( 0, -1 ),
		future: [ state.document, ...state.future ],
		selectedBlockId: selectedBlockIdFor( document, state.selectedBlockId ),
	};
}

export function redoDocument( state ) {
	if ( state.future.length === 0 ) {
		return state;
	}

	const document = state.future[ 0 ];
	document.history = [ ...( state.document.history || [] ) ];
	appendPersistentHistory( document, 'Redo applied', state.selectedBlockId );
	return {
		document,
		past: [ ...state.past, state.document ].slice( -HISTORY_LIMIT ),
		future: state.future.slice( 1 ),
		selectedBlockId: selectedBlockIdFor( document, state.selectedBlockId ),
	};
}
