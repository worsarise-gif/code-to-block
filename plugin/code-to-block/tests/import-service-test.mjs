import assert from 'node:assert/strict';

import { ImportCodeService } from '../src/importer/ImportCodeService.mjs';

function candidate( source ) {
	const script = {
		id: 'script-1',
		enabled_in_editor: false,
		enabled_in_preview: true,
		enabled_on_publish: true,
	};
	const session = {
		id: `session-${ source }`,
		state: 'analyzed',
		scripts: [ script ],
		errors: [],
		scriptDetections: [ { id: 'script-1', status: 'preserved' } ],
	};
	return {
		document: {
			root: { id: 'root' },
			imported_assets: { scripts: [ script ] },
		},
		session,
		scriptDetections: session.scriptDetections,
		warnings: [],
	};
}

const service = new ImportCodeService( {
	parse: ( source ) => candidate( source ),
} );
const analysis = await service.analyze( 'one', { canExecuteScripts: false } );
assert.equal( analysis.session.state, 'analyzed' );
assert.equal( analysis.session.scripts[ 0 ].enabled_in_preview, false );
assert.equal( analysis.session.scripts[ 0 ].execution_policy, 'disabled' );
assert.equal( analysis.scriptDetections[ 0 ].status, 'blocked' );
assert.equal( service.get( analysis.session.id ), analysis );

let commits = 0;
const committed = service.commit( analysis.session.id, {
	transformCandidate: ( document ) => ( {
		...document,
		name: 'Transformed',
	} ),
	commitDocument: ( document ) => {
		commits += 1;
		assert.equal( document.name, 'Transformed' );
	},
} );
assert.equal( commits, 1 );
assert.equal( committed.session.state, 'committed' );
assert.throws( () => service.commit( analysis.session.id ), /already/ );

const cancelled = await service.analyze( 'two' );
assert.equal( service.cancel( cancelled.session.id ), true );
assert.equal( service.get( cancelled.session.id ), null );

// eslint-disable-next-line no-console
console.log( 'PASS: 11 transactional import-service assertions.' );
