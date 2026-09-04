/**
 * Content hash for deterministic dirty-state tracking.
 * Only canonical document data is hashed — UI state such as selection,
 * zoom, or panel layout must NOT be included.
 *
 * @param {Object} document Builder document.
 * @return {string} Stable hash string.
 */
export function contentHash( document ) {
	const json = JSON.stringify( document );
	let hash = 2166136261;
	for ( let i = 0; i < json.length; i++ ) {
		hash ^= json.charCodeAt( i );
		hash = Math.imul( hash, 16777619 );
	}
	return ( hash >>> 0 ).toString( 36 );
}

export function freshPreviewUrl( previewUrl, baseUrl, requestId = Date.now() ) {
	const url = new URL( previewUrl, baseUrl );
	url.searchParams.set( 'ctb-preview', String( requestId ) );
	return url.toString();
}

export async function publishSavedDocument( {
	apiFetch,
	postRestPath,
	postStatus,
	targetStatus = 'publish',
	extraData = {},
	saveDocument,
} ) {
	const saveResult = await saveDocument( 'Saving before status change...' );
	if ( ! saveResult ) {
		return null;
	}
	const hasExtraData = Boolean( extraData && Object.keys( extraData ).length > 0 );
	if ( postStatus === targetStatus && ! hasExtraData ) {
		return { post: { status: targetStatus }, saveResult };
	}
	if ( ! postRestPath ) {
		throw new Error( 'The WordPress publishing endpoint is unavailable.' );
	}

	const post = await apiFetch( {
		path: postRestPath,
		method: 'POST',
		data: { status: targetStatus, ...( extraData || {} ) },
	} );
	return { post, saveResult };
}

/**
 * Installs / removes a beforeunload listener based on dirty state.
 * Returns an unsubscribe function.
 *
 * @param {() => boolean} isDirtyFn Callback returning current dirty state.
 * @return {() => void} Unsubscribe function.
 */
export function installNavigationGuard( isDirtyFn ) {
	function handler( event ) {
		if ( isDirtyFn() ) {
			event.preventDefault();
			// Legacy browsers need returnValue.
			event.returnValue = '';
		}
	}
	window.addEventListener( 'beforeunload', handler );
	return () => window.removeEventListener( 'beforeunload', handler );
}

/**
 * Maps a WordPress post status to a user-facing label.
 *
 * @param {string} status WordPress post_status value.
 * @return {string} Display label.
 */
export function statusLabel( status ) {
	const labels = {
		'auto-draft': 'Unsaved page',
		draft: 'Draft',
		pending: 'Pending review',
		publish: 'Published',
		private: 'Private',
		future: 'Scheduled',
		trash: 'Trashed',
	};
	return labels[ status ] || status;
}

/**
 * Persists the block tree as a WordPress autosave.
 * Fails silently if the network request fails.
 *
 * @param {Object} args
 * @param {Function} args.apiFetch WordPress apiFetch client.
 * @param {number} args.postId WordPress post ID.
 * @param {Object} args.document Block tree document to autosave.
 * @return {Promise<Object|null>} The API response, or null on failure.
 */
export async function autosaveDocument( { apiFetch, postId, document } ) {
	if ( ! postId ) {
		return null;
	}
	try {
		const response = await apiFetch( {
			path: `/code-to-block/v1/pages/${ postId }/autosave`,
			method: 'POST',
			data: { document },
		} );
		return response;
	} catch ( error ) {
		// Autosaves should fail silently
		return null;
	}
}
