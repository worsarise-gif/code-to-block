import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	ADVANCED_GROUPS,
	STYLE_GROUPS,
	validateCatalog,
} from '../src/controls/catalog.mjs';
import {
	ELEMENT_DEFINITIONS,
	registryManifest,
	validateElementRegistry,
} from '../src/elements/registry.mjs';
import {
	CONTEXT_STATES,
	DOCUMENT_SCHEMA_VERSION,
	REGISTRY_VERSION,
} from '../src/schema-v3.mjs';
import { contextCascade } from '../src/styles/context.mjs';
import { stableElementClass } from '../src/styles/compiler.mjs';

const testDirectory = path.dirname( fileURLToPath( import.meta.url ) );
const pluginDirectory = path.dirname( testDirectory );
const repositoryDirectory = path.dirname( path.dirname( pluginDirectory ) );
const registryContractPath = path.join(
	repositoryDirectory,
	'docs',
	'control-registry-contract.md'
);
const styleContractPath = path.join(
	repositoryDirectory,
	'docs',
	'style-context-contract.md'
);
const decisionLogPath = path.join(
	repositoryDirectory,
	'design-decisions-log.md'
);
const generatedManifestPath = path.join(
	pluginDirectory,
	'includes',
	'generated',
	'control-registry.json'
);
const phpRegistryPath = path.join(
	pluginDirectory,
	'includes',
	'class-code-to-block-registry.php'
);
const phpSchemaPath = path.join(
	pluginDirectory,
	'includes',
	'class-code-to-block-schema.php'
);

const [
	registryContract,
	styleContract,
	decisionLog,
	diskManifestSource,
	phpRegistry,
	phpSchema,
] = await Promise.all( [
	readFile( registryContractPath, 'utf8' ),
	readFile( styleContractPath, 'utf8' ),
	readFile( decisionLogPath, 'utf8' ),
	readFile( generatedManifestPath, 'utf8' ),
	readFile( phpRegistryPath, 'utf8' ),
	readFile( phpSchemaPath, 'utf8' ),
] );

let assertions = 0;
function check( condition, message ) {
	assert.ok( condition, message );
	assertions += 1;
}

function contractJson( source, name ) {
	const expression = new RegExp(
		'<!-- contract:' +
			name +
			' -->\\s*```json\\s*([\\s\\S]*?)```'
	);
	const match = source.match( expression );
	assert.ok( match, `Missing machine-readable ${ name } contract.` );
	assertions += 1;
	return JSON.parse( match[ 1 ] );
}

const elementIdPattern = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/;
const targetIdPattern = /^[a-z][A-Za-z0-9]*$/;
const breakpointIds = new Set( [ 'tablet', 'mobile' ] );
const stateIds = new Set( CONTEXT_STATES.filter( ( state ) => state !== 'expired' ) );

function parseStrictContext( key ) {
	if ( key === 'base' ) return { breakpoint: 'desktop', state: 'default' };
	let match = key.match( /^bp:([a-z][a-z0-9-]*)$/ );
	if ( match ) {
		return breakpointIds.has( match[ 1 ] )
			? { breakpoint: match[ 1 ], state: 'default' }
			: null;
	}
	match = key.match( /^state:([a-z][A-Za-z0-9]*)$/ );
	if ( match ) {
		return stateIds.has( match[ 1 ] )
			? { breakpoint: 'desktop', state: match[ 1 ] }
			: null;
	}
	match = key.match(
		/^bp:([a-z][a-z0-9-]*)\|state:([a-z][A-Za-z0-9]*)$/
	);
	if (
		match &&
		breakpointIds.has( match[ 1 ] ) &&
		stateIds.has( match[ 2 ] )
	) {
		return { breakpoint: match[ 1 ], state: match[ 2 ] };
	}
	return null;
}

function formatStrictContext( context ) {
	if ( context.breakpoint === 'desktop' && context.state === 'default' )
		return 'base';
	const segments = [];
	if ( context.breakpoint !== 'desktop' )
		segments.push( `bp:${ context.breakpoint }` );
	if ( context.state !== 'default' )
		segments.push( `state:${ context.state }` );
	return segments.join( '|' );
}

check(
	registryContract.includes( 'Accepted and normative' ) &&
		registryContract.includes( 'Current Implementation Status' ),
	'registry contract declares normative status and implementation gaps'
);
check(
	styleContract.includes( 'Accepted and normative' ) &&
		styleContract.includes( 'Current Implementation Status' ),
	'style contract declares normative status and implementation gaps'
);
for ( const required of [
	'docs/control-registry-contract.md',
	'docs/style-context-contract.md',
	'Content owns',
	'Advanced never mounts Style groups',
	'no last-write-wins',
	'dual-read',
	'atomic',
] ) {
	check( decisionLog.includes( required ), `decision log records ${ required }` );
}
check(
	( decisionLog.match( /Historical legacy behavior/g ) || [] ).length >= 2,
	'both duplicated legacy Simple/Advanced decisions are marked historical'
);

const registryExample = contractJson( registryContract, 'registry-example' );
check( elementIdPattern.test( registryExample.id ), 'example element ID is valid' );
check(
	Number.isInteger( registryExample.version ) && registryExample.version >= 1,
	'example definition version is positive'
);
check(
	targetIdPattern.test( registryExample.primaryTarget ),
	'example primary target is valid'
);
const exampleTargetIds = registryExample.targets.map( ( target ) => target.id );
check(
	new Set( exampleTargetIds ).size === exampleTargetIds.length,
	'example target IDs are unique'
);
check( exampleTargetIds.includes( 'root' ), 'example registers root target' );
check(
	exampleTargetIds.includes( registryExample.primaryTarget ),
	'example primary target is registered'
);
for ( const target of registryExample.targets ) {
	check( targetIdPattern.test( target.id ), `target ${ target.id } is valid` );
}
const grantedFields = new Map();
for ( const grant of registryExample.grants ) {
	check( exampleTargetIds.includes( grant.target ), `${ grant.group } target exists` );
	check( Boolean( STYLE_GROUPS[ grant.group ] ), `${ grant.group } group exists` );
	check(
		[ 'primary', 'recommended', 'optional' ].includes( grant.tier ),
		`${ grant.group } has a valid disclosure tier`
	);
	check(
		typeof grant.responsive === 'boolean',
		`${ grant.group } declares responsive eligibility`
	);
	check( grant.fields.length > 0, `${ grant.group } grants explicit fields` );
	check(
		grant.fields.every( ( field ) =>
			STYLE_GROUPS[ grant.group ].properties.includes( field )
		),
		`${ grant.group } fields belong to the registered group`
	);
	check(
		grant.states.every( ( state ) => stateIds.has( state ) ),
		`${ grant.group } states are registered`
	);
	for ( const field of grant.fields ) {
		if ( grantedFields.has( field ) )
			check(
				Boolean( grant.mergeStrategy ),
				`${ field } collision declares a merge strategy`
			);
		grantedFields.set( field, grant.group );
	}
}

const authority = contractJson( registryContract, 'authority' );
assert.deepEqual( authority, {
	clientValidation: 'advisory-and-development',
	persistenceAuthority: 'php',
	renderAuthority: 'php',
	manifestSource: 'javascript-build-registry',
	missingManifestV3Policy: 'fail-closed',
	legacyManifestPolicy: 'continue-legacy-adapter',
} );
assertions += 1;

const conflictPolicy = contractJson( registryContract, 'conflict-policy' );
assert.deepEqual( conflictPolicy, {
	duplicate: 'reject-fragment',
	aliasCollision: 'reject-fragment',
	reservedNamespace: 'reject-fragment',
	lastWriteWins: false,
	unknownProductionElement: 'read-only-diagnostic',
	preserveNamespacedData: true,
} );
assertions += 1;
check( elementIdPattern.test( 'acme/widget' ), 'extension namespace example is valid' );
check(
	conflictPolicy.reservedNamespace === 'reject-fragment',
	'first-party namespace claims are rejected'
);

const migrationFailure = contractJson(
	registryContract,
	'migration-failure'
);
assert.deepEqual( migrationFailure, {
	sourceDocumentMutated: false,
	existingCssMutated: false,
	canonicalSaveAllowed: false,
	reportRequired: true,
	revisionRequiredBeforeApply: true,
	validateBeforeWrite: true,
	compileBeforeWrite: true,
	parityBeforeWrite: true,
	rollbackUsesSourceRevision: true,
} );
assertions += 1;

contractJson( styleContract, 'style-storage' );
const contextContract = contractJson( styleContract, 'style-context' );
for ( const key of contextContract.validContextKeys ) {
	const parsed = parseStrictContext( key );
	check( Boolean( parsed ), `${ key } is accepted by strict context grammar` );
	check(
		formatStrictContext( parsed ) === key,
		`${ key } is already canonical`
	);
}
for ( const key of contextContract.invalidContextKeys ) {
	check(
		parseStrictContext( key ) === null,
		`${ key || '<empty>' } is rejected by strict context grammar`
	);
}
assert.deepEqual( contextContract.sourcePrecedence, [
	'browserTheme',
	'builderBaseline',
	'definition',
	'globalElementStyle',
	'groupPresetStack',
	'elementPreset',
	'localBase',
	'localBreakpoint',
	'localState',
	'localBreakpointState',
	'customDeclarations',
	'legacyImportant',
] );
assertions += 1;
assert.deepEqual( contextContract.mobileHoverSequence, [
	'base',
	'bp:tablet',
	'bp:mobile',
	'state:hover',
	'bp:tablet|state:hover',
	'bp:mobile|state:hover',
] );
assertions += 1;
assert.deepEqual(
	contextCascade( 'bp:mobile|state:hover' ),
	contextContract.mobileHoverSequence
);
assertions += 1;

assert.deepEqual( validateCatalog(), [] );
assertions += 1;
assert.deepEqual( validateElementRegistry(), [] );
assertions += 1;
check(
	new Set( ELEMENT_DEFINITIONS.map( ( definition ) => definition.id ) ).size ===
		ELEMENT_DEFINITIONS.length,
	'live definition IDs are unique'
);
for ( const definition of ELEMENT_DEFINITIONS ) {
	check(
		elementIdPattern.test( definition.id ),
		`${ definition.id } uses the approved element-ID grammar`
	);
	check(
		Number.isInteger( definition.version ) && definition.version >= 1,
		`${ definition.id } has a positive definition version`
	);
	const targets = definition.styleTargets.map( ( target ) => target.id );
	check(
		targets.filter( ( target ) => target === 'root' ).length === 1,
		`${ definition.id } has exactly one root target`
	);
	check(
		new Set( targets ).size === targets.length,
		`${ definition.id } target IDs are unique`
	);
	check(
		targets.every( ( target ) => targetIdPattern.test( target ) ),
		`${ definition.id } target IDs use the approved grammar`
	);
	check(
		definition.styleGroups.every( ( group ) => STYLE_GROUPS[ group ] ),
		`${ definition.id } references known style groups`
	);
	check(
		definition.advancedGroups.every( ( group ) => ADVANCED_GROUPS[ group ] ),
		`${ definition.id } references known Advanced groups`
	);
	check(
		definition.states.every( ( state ) => CONTEXT_STATES.includes( state ) ),
		`${ definition.id } references known states`
	);
}
check(
	Object.keys( STYLE_GROUPS ).every(
		( group ) => ! Object.hasOwn( ADVANCED_GROUPS, group )
	),
	'Style and Advanced group namespaces do not overlap'
);

const diskManifest = JSON.parse( diskManifestSource );
assert.deepEqual( diskManifest, registryManifest() );
assertions += 1;
check(
	diskManifest.registry_version === REGISTRY_VERSION,
	'disk manifest matches JS registry version'
);
check(
	Object.keys( diskManifest.elements ).length === ELEMENT_DEFINITIONS.length,
	'disk manifest contains every live definition'
);
const phpRegistryVersion = Number(
	phpRegistry.match( /const VERSION\s*=\s*(\d+)\s*;/ )?.[ 1 ]
);
const phpSchemaVersion = Number(
	phpSchema.match( /const VERSION\s*=\s*(\d+)\s*;/ )?.[ 1 ]
);
check(
	phpRegistryVersion === REGISTRY_VERSION,
	'PHP and JS registry versions match'
);
check(
	phpSchemaVersion === DOCUMENT_SCHEMA_VERSION,
	'PHP and JS document schema versions match'
);

check(
	stableElementClass( 'stable-button' ) === 'ctb-e-aedec5d5',
	'stable selector fixture remains unchanged'
);
check(
	stableElementClass( 'stable-button-copy' ) !==
		stableElementClass( 'stable-button' ),
	'duplicated block identity produces a distinct stable selector'
);

const gapIds = Array.from(
	{ length: 15 },
	( _, index ) => `A2-GAP-${ String( index + 1 ).padStart( 3, '0' ) }`
);
for ( const gapId of gapIds ) {
	check( registryContract.includes( gapId ), `${ gapId } is in registry status` );
	check( styleContract.includes( gapId ), `${ gapId } is in style status` );
}

console.log( `PASS: ${ assertions } architecture contract assertions.` );
