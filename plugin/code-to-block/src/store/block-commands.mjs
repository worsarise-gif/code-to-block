import { createElementBlock } from '../elements/registry.mjs';
import { commitDocument } from '../history.mjs';
import { ownStyleSet, setOwnStyleSet } from '../responsive-styles.mjs';
import { findBlock } from '../tree.mjs';

export function updateBlockStyleSet( state, id, breakpoint, update ) {
	const currentBlock = findBlock( state.document.root, id );
	if ( ! currentBlock || currentBlock.permissions?.locked ) {
		return state;
	}
	const currentStyleSet = ownStyleSet( currentBlock, breakpoint );
	const editableStyleSet = {
		...currentStyleSet,
		mapped: { ...currentStyleSet.mapped },
		custom_css_fallback: currentStyleSet.custom_css_fallback || '',
	};
	if ( currentStyleSet.token_bindings ) {
		editableStyleSet.token_bindings = {
			...currentStyleSet.token_bindings,
		};
	}
	if ( currentStyleSet.role_bindings ) {
		editableStyleSet.role_bindings = JSON.parse(
			JSON.stringify( currentStyleSet.role_bindings )
		);
	}
	if ( currentStyleSet.import_review_flags ) {
		editableStyleSet.import_review_flags = JSON.parse(
			JSON.stringify( currentStyleSet.import_review_flags )
		);
	}
	const nextStyleSet = update( editableStyleSet );
	if (
		JSON.stringify( currentStyleSet ) === JSON.stringify( nextStyleSet )
	) {
		return state;
	}

	const document = JSON.parse( JSON.stringify( state.document ) );
	setOwnStyleSet( findBlock( document.root, id ), breakpoint, nextStyleSet );
	return commitDocument( state, document, id );
}

export function updateEditableBlock( state, id, mutate, allowLocked = false ) {
	const current = findBlock( state.document.root, id );
	if ( ! current || ( current.permissions?.locked && ! allowLocked ) ) {
		return state;
	}
	const document = JSON.parse( JSON.stringify( state.document ) );
	const block = findBlock( document.root, id );
	mutate( block, document );
	return commitDocument( state, document, id );
}

export function createPrimitiveBlock( primitive ) {
	return createElementBlock( primitive );
}

export function setStyleSetBindings( styleSet, bindings ) {
	if ( Object.keys( bindings ).length ) {
		styleSet.token_bindings = bindings;
	} else {
		delete styleSet.token_bindings;
	}
	return styleSet;
}

export function setHiddenInFallback( fallback, hidden, visibleDisplay = '' ) {
	const declarations = String( fallback || '' )
		.split( ';' )
		.map( ( part ) => part.trim() )
		.filter( Boolean )
		.filter( ( part ) => ! /^display\s*:/i.test( part ) );
	if ( hidden ) {
		declarations.push( 'display: none !important' );
	} else if ( visibleDisplay ) {
		declarations.push( `display: ${ visibleDisplay } !important` );
	}
	return declarations.length ? declarations.join( '; ' ) + ';' : '';
}
