import assert from 'node:assert/strict';

import {
	freshPreviewUrl,
	publishSavedDocument,
} from '../src/editor-persistence.mjs';

let assertions = 0;
function equal( actual, expected, message ) {
	assert.deepEqual( actual, expected, message );
	assertions += 1;
}

const previewUrl = freshPreviewUrl(
	'/built-page/example/?preview=true',
	'https://example.com/wp-admin/admin.php',
	1234
);
const parsedPreviewUrl = new URL( previewUrl );
equal(
	parsedPreviewUrl.origin + parsedPreviewUrl.pathname,
	'https://example.com/built-page/example/',
	'Preview URLs resolve against the current WordPress origin.'
);
equal(
	parsedPreviewUrl.searchParams.get( 'preview' ),
	'true',
	'Existing WordPress preview authorization parameters are preserved.'
);
equal(
	parsedPreviewUrl.searchParams.get( 'ctb-preview' ),
	'1234',
	'Each preview request receives a cache-busting value.'
);

const calls = [];
const saveResult = { hasUnsavedChanges: false };
const published = await publishSavedDocument( {
	apiFetch: async ( request ) => {
		calls.push( [ 'publish', request ] );
		return { id: 27, status: 'publish' };
	},
	postRestPath: '/wp/v2/ctb-pages/27',
	postStatus: 'draft',
	saveDocument: async ( status ) => {
		calls.push( [ 'save', status ] );
		return saveResult;
	},
} );
equal(
	calls,
	[
		[ 'save', 'Saving before status change...' ],
		[
			'publish',
			{
				path: '/wp/v2/ctb-pages/27',
				method: 'POST',
				data: { status: 'publish' },
			},
		],
	],
	'The current block tree saves before WordPress publishes the post.'
);
equal(
	published,
	{ post: { id: 27, status: 'publish' }, saveResult },
	'Publishing returns both post and save state for accurate editor feedback.'
);

let publishRequests = 0;
const failedSave = await publishSavedDocument( {
	apiFetch: async () => {
		publishRequests += 1;
	},
	postRestPath: '/wp/v2/ctb-pages/27',
	postStatus: 'draft',
	saveDocument: async () => null,
} );
equal( failedSave, null, 'A failed block-tree save cancels publishing.' );
equal( publishRequests, 0, 'WordPress is not called after a failed save.' );

const updated = await publishSavedDocument( {
	apiFetch: async () => {
		publishRequests += 1;
	},
	postRestPath: '/wp/v2/ctb-pages/27',
	postStatus: 'publish',
	saveDocument: async () => saveResult,
} );
equal(
	updated,
	{ post: { status: 'publish' }, saveResult },
	'Updating an already-published page only needs the block-tree save.'
);
equal(
	publishRequests,
	0,
	'Already-published pages do not make a redundant status request.'
);

console.log( `PASS: ${ assertions } editor persistence assertions.` );
