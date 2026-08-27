import assert from 'node:assert/strict';

import {
	STARTER_TEMPLATES,
	getStarterTemplate,
	insertStarter,
	prepareStarterDocument,
} from '../src/starter-templates.mjs';
import { resetDocumentHistory, commitDocument } from '../src/history.mjs';

let assertions = 0;
function check( actual, expected, message ) {
	assert.deepEqual( actual, expected, message );
	assertions += 1;
}
function ok( condition, message ) {
	assert.ok( condition, message );
	assertions += 1;
}

ok(
	STARTER_TEMPLATES.length >= 3 && STARTER_TEMPLATES.length <= 5,
	'Starter library has 3 to 5 templates.'
);
for ( const template of STARTER_TEMPLATES ) {
	ok( typeof template.id === 'string' && template.id.length, `${ template.id } has an id.` );
	ok( typeof template.label === 'string' && template.label.length, `${ template.id } has a label.` );
	ok( typeof template.description === 'string' && template.description.length, `${ template.id } has a description.` );
	ok( template.document.schema_version === 1, `${ template.id } schema_version is 1.` );
	ok( typeof template.document.name === 'string' && template.document.name.length, `${ template.id } has a name.` );
	ok( template.document.root && typeof template.document.root.id === 'string', `${ template.id } has a root.` );
	ok( template.document.root.meta.source === 'starter-template', `${ template.id } root source is starter-template.` );
}

const hero = getStarterTemplate( 'starter-hero' );
ok( hero && hero.label === 'Hero landing', 'getStarterTemplate resolves by id.' );
check( getStarterTemplate( 'missing' ), null, 'Unknown starter returns null.' );

const pricingDoc = prepareStarterDocument( 'starter-pricing' );
ok( pricingDoc.root.id.startsWith( 'starter-starter-pricing-' ), 'Prepared starter root is namespaced.' );
ok( pricingDoc.root.meta.source === 'starter-template', 'Prepared root retains starter source.' );
ok( pricingDoc.root.id !== 'starter-pricing-root', 'Prepared ids are regenerated from template ids.' );

function block( id, children = [] ) {
	return {
		id,
		type: 'container',
		tag: 'div',
		attributes: {},
		children,
		styles: { mapped: {}, custom_css_fallback: '' },
		meta: { source: 'test' },
	};
}
const page = {
	schema_version: 1,
	name: 'Page',
	root: block( 'root', [ block( 'existing' ) ] ),
};

const inserted = insertStarter( page, 'existing', 'starter-testimonial' );
ok(
	inserted.root.children.length === 2,
	'Starter insert adds a new sibling block.'
);
ok(
	inserted.root.children[ 1 ].id.startsWith( 'starter-starter-testimonial-' ),
	'Inserted starter ids are namespaced and unique.'
);
ok(
	inserted.root.children[ 0 ].id === 'existing',
	'Existing blocks retain their ids.'
);
const insertedAgain = insertStarter( inserted, 'existing', 'starter-testimonial' );
ok(
	inserted.root.children[ 1 ].id !== insertedAgain.root.children[ 1 ].id,
	'Second insertion gets fresh ids.'
);

// History semantics: replace resets, insert commits
const replaced = prepareStarterDocument( 'starter-hero' );
const resetState = resetDocumentHistory( replaced );
check( resetState.past.length, 0, 'Replace resets history past.' );
check( resetState.future.length, 0, 'Replace resets history future.' );

const initialState = {
	document: page,
	past: [],
	future: [],
	selectedBlockId: 'root',
};
const committed = commitDocument( initialState, inserted, 'existing' );
ok( committed.past.length === 1, 'Insert commits one history entry.' );
ok( committed.future.length === 0, 'Insert clears future.' );

// Budget guard
const wideRoot = block( 'wide-root' );
for ( let index = 0; index < 998; index++ ) {
	wideRoot.children.push( block( `wide-${ index }` ) );
}
const widePage = {
	schema_version: 1,
	name: 'Wide',
	root: wideRoot,
};
let threw = false;
try {
	insertStarter( widePage, 'wide-root', 'starter-pricing' );
} catch ( error ) {
	threw = /1000 block/.test( error.message );
}
ok( threw, 'Starter insert respects the 1000 block budget.' );

console.log( `PASS: ${ assertions } starter-template assertions.` );
