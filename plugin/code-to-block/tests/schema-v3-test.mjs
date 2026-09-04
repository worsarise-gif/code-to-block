import assert from 'node:assert/strict';

import { createElementBlock } from '../src/elements/registry.mjs';
import {
	migrateDocumentToV3,
	stableStringify,
} from '../src/migrations/adapter.mjs';
import {
	canonicalize,
	formatContextKey,
	parseContextKey,
	validateDocumentV3,
} from '../src/schema-v3.mjs';
import {
	clearStyleContext,
	contextCascade,
	resolveStyleContext,
	setStyleDeclaration,
} from '../src/styles/context.mjs';
import {
	compileDocumentStyles,
	stableElementClass,
} from '../src/styles/compiler.mjs';

let assertions = 0;
function check( condition, message ) {
	assert.ok( condition, message );
	assertions += 1;
}

assert.deepEqual( parseContextKey( 'base' ), {
	key: 'base',
	breakpoint: 'desktop',
	state: 'default',
} );
assertions += 1;
check(
	formatContextKey( 'tablet', 'hover' ) === 'bp:tablet|state:hover',
	'intersection context formats canonically'
);
check(
	parseContextKey( 'bp:watch' ) === null,
	'unknown breakpoint is rejected'
);
assert.deepEqual( contextCascade( 'bp:mobile|state:hover' ), [
	'base',
	'bp:tablet',
	'bp:mobile',
	'state:hover',
	'bp:tablet|state:hover',
	'bp:mobile|state:hover',
] );
assertions += 1;

const legacy = {
	schema_version: 2,
	name: 'Migration fixture',
	root: {
		id: 'hero-title',
		type: 'text',
		tag: 'h2',
		attributes: {},
		children: [ { kind: 'text', value: 'A stable title' } ],
		styles: {
			mapped: { color: '#123456', 'font-size': '2rem' },
			custom_css_fallback: 'text-wrap: balance;',
		},
		responsive_overrides: {
			tablet: {
				mapped: { 'font-size': '1.75rem' },
				custom_css_fallback: '',
			},
		},
		states: {
			hover: { mapped: { color: '#345678' }, custom_css_fallback: '' },
		},
		meta: { source: 'fixture' },
	},
};
const migrated = migrateDocumentToV3( legacy );
check( migrated.document.schema_version === 3, 'migration writes schema v3' );
check(
	migrated.document.root.element === 'core/heading',
	'migration infers heading'
);
check(
	migrated.document.root.style.targets.root.contexts.base.declarations
		.color === '#123456',
	'base declaration migrates'
);
check(
	migrated.document.root.style.targets.root.contexts[ 'bp:tablet' ]
		.declarations[ 'font-size' ] === '1.75rem',
	'responsive declaration migrates'
);
check(
	migrated.document.root.style.targets.root.contexts[ 'state:hover' ]
		.declarations.color === '#345678',
	'state declaration migrates'
);
check(
	migrated.document.root.style.targets.root.contexts.base
		.custom_declarations === 'text-wrap: balance;',
	'fallback declaration is preserved'
);
assert.deepEqual( validateDocumentV3( migrated.document ), [] );
assertions += 1;
const nonCanonical = JSON.parse( JSON.stringify( migrated.document ) );
nonCanonical.root.style.targets.root.contexts[ 'state:hover|bp:tablet' ] =
	nonCanonical.root.style.targets.root.contexts[ 'state:hover' ];
check(
	validateDocumentV3( nonCanonical ).some( ( error ) =>
		error.includes( 'state:hover|bp:tablet is invalid' )
	),
	'validation rejects context aliases that the server cannot persist'
);
check(
	migrateDocumentToV3( migrated.document ).alreadyCurrent,
	'migration is idempotent for v3'
);

let block = createElementBlock( 'button', 'style-test' );
block = { ...block, style: { targets: {} } };
block = setStyleDeclaration( block, 'root', 'base', 'color', '#111111' );
block = setStyleDeclaration( block, 'root', 'bp:tablet', 'color', '#222222' );
block = setStyleDeclaration(
	block,
	'root',
	'bp:tablet|state:hover',
	'color',
	'#333333'
);
const resolved = resolveStyleContext( block, 'root', 'bp:tablet|state:hover', {
	global: { color: '#000000' },
} );
check(
	resolved.declarations.color === '#333333',
	'intersection wins the cascade'
);
check(
	resolved.sources.color === 'bp:tablet|state:hover',
	'resolver reports exact source'
);
const cleared = clearStyleContext( block, 'root', 'bp:tablet|state:hover' );
check(
	resolveStyleContext( cleared, 'root', 'bp:tablet|state:hover' ).declarations
		.color === '#222222',
	'clearing restores lower layer'
);

const document = {
	schema_version: 3,
	registry_version: 1,
	name: 'CSS',
	root: block,
};
const compiled = compileDocumentStyles( document, 39 );
check(
	compiled.css.includes( `.${ stableElementClass( block.id ) }` ),
	'compiler uses stable block identity'
);
check(
	compiled.css.includes( '@media(max-width:768px)' ),
	'compiler emits tablet media query'
);
check( compiled.css.includes( ':hover' ), 'compiler emits state selector' );
check(
	! compiled.css.includes( '!important' ),
	'ordinary v3 declarations do not use important'
);
check(
	stableStringify( canonicalize( document ) ) ===
		stableStringify(
			canonicalize( JSON.parse( stableStringify( document ) ) )
		),
	'canonical serialization is byte stable'
);

console.log(
	`PASS: ${ assertions } schema v3, migration, context, and compiler assertions.`
);
