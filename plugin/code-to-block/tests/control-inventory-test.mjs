import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	MAPPED_STYLE_PROPERTIES,
	STYLE_CONTROL_FIELDS,
} from '../src/custom-css.mjs';
import {
	ELEMENT_DEFINITIONS,
	canInsertElement,
	registryManifest,
} from '../src/elements/registry.mjs';
import { SUPPORTED_HTML_TAGS } from '../src/html-policy.mjs';
import { WIDGET_LIBRARY } from '../src/widget-library.mjs';

const testDirectory = path.dirname( fileURLToPath( import.meta.url ) );
const pluginDirectory = path.dirname( testDirectory );
const fixtureDirectory = path.join( testDirectory, 'fixtures', 'migrations' );
const fixtureNames = [ 'compat-v2.fixture.json', 'legacy-v1.fixture.json' ];
const fixturePaths = fixtureNames.map( ( name ) =>
	path.join( fixtureDirectory, name )
);
const manifestPath = path.join( fixtureDirectory, 'coverage-manifest.json' );
const snapshotPath = path.join(
	fixtureDirectory,
	'control-inventory.snapshot.json'
);
const sourcePaths = [
	path.join( pluginDirectory, 'src', 'custom-css.mjs' ),
	path.join( pluginDirectory, 'src', 'elements', 'registry.mjs' ),
	path.join( pluginDirectory, 'src', 'html-policy.mjs' ),
	path.join( pluginDirectory, 'src', 'widget-library.mjs' ),
];

const sha256 = ( value ) =>
	createHash( 'sha256' ).update( value ).digest( 'hex' );
const sorted = ( values ) => [ ...new Set( values ) ].sort();

function canonicalize( value ) {
	if ( Array.isArray( value ) ) {
		return value.map( canonicalize );
	}
	if ( value && typeof value === 'object' ) {
		return Object.fromEntries(
			Object.keys( value )
				.sort()
				.map( ( key ) => [ key, canonicalize( value[ key ] ) ] )
		);
	}
	return value;
}

function deepFreeze( value ) {
	if ( value && typeof value === 'object' && ! Object.isFrozen( value ) ) {
		Object.freeze( value );
		Object.values( value ).forEach( deepFreeze );
	}
	return value;
}

async function hashesFor( paths ) {
	return Object.fromEntries(
		await Promise.all(
			paths.map( async ( filePath ) => [
				path.relative( pluginDirectory, filePath ).replaceAll( '\\', '/' ),
				sha256( await readFile( filePath ) ),
			] )
		)
	);
}

function walkBlocks( block, visit, parent = null ) {
	visit( block, parent );
	for ( const child of block.children || [] ) {
		if ( child && typeof child === 'object' && ! ( 'kind' in child ) ) {
			walkBlocks( child, visit, block );
		}
	}
}

function styleSetsFor( block ) {
	return [
		block.styles,
		...Object.values( block.responsive_overrides || {} ),
		...Object.values( block.states || {} ),
	].filter( Boolean );
}

const allReadPaths = [ ...sourcePaths, ...fixturePaths, manifestPath ];
const fileHashesBefore = await hashesFor( allReadPaths );
const sourceStateBefore = JSON.stringify( {
	controls: STYLE_CONTROL_FIELDS,
	definitions: ELEMENT_DEFINITIONS,
	tags: [ ...SUPPORTED_HTML_TAGS ],
	widgets: WIDGET_LIBRARY,
} );
const fixtures = await Promise.all(
	fixturePaths.map( async ( filePath ) => ( {
		name: path.basename( filePath ),
		raw: await readFile( filePath, 'utf8' ),
		document: deepFreeze( JSON.parse( await readFile( filePath, 'utf8' ) ) ),
	} ) )
);
const coverageManifest = deepFreeze(
	JSON.parse( await readFile( manifestPath, 'utf8' ) )
);

const sourceBroadTypes = sorted(
	ELEMENT_DEFINITIONS.map( ( definition ) => definition.rendererFamily )
);
const sourceTags = sorted( SUPPORTED_HTML_TAGS );
const sourceMappedProperties = sorted( MAPPED_STYLE_PROPERTIES );
const sourceWidgets = WIDGET_LIBRARY.map( ( widget ) => ( {
	widget_id: widget.id,
	root_id: widget.block.id,
	class: widget.block.attributes.class,
} ) ).sort( ( left, right ) => left.widget_id.localeCompare( right.widget_id ) );
const controlOptions = new Map(
	STYLE_CONTROL_FIELDS.filter( ( field ) => field.options ).map( ( field ) => [
		field.property,
		field.options,
	] )
);

const collected = {
	schemaVersions: [],
	types: [],
	tags: [],
	classes: [],
	mappedProperties: [],
	breakpoints: [],
	states: [],
	attributes: [],
	sources: [],
	tokenBindings: [],
	roleBindings: [],
	unsupportedProperties: [],
	unsupportedValues: [],
	importedSelectors: [],
	importedMediaConditions: [],
	customCssFallbacks: [],
};
const fixtureTypes = {};
const blocksById = new Map();
const nestedFormPairs = [];
const storageBranches = new Set();
let importedAssetCount = 0;
let linkedLockedComponentCount = 0;

for ( const fixture of fixtures ) {
	collected.schemaVersions.push( fixture.document.schema_version );
	for ( const branch of [
		'design_tokens',
		'feature_flags',
		'history',
		'imported_assets',
		'seo',
		'slot_values',
		'style_roles',
	] ) {
		if ( branch in fixture.document ) {
			storageBranches.add( `document.${ branch }` );
		}
	}
	fixtureTypes[ fixture.name ] = [];
	const stylesheets = fixture.document.imported_assets?.stylesheets || [];
	importedAssetCount += stylesheets.length;
	for ( const stylesheet of stylesheets ) {
		collected.importedSelectors.push( ...( stylesheet.selectors || [] ) );
		collected.importedMediaConditions.push(
			...( stylesheet.media_conditions || [] )
		);
	}
	walkBlocks( fixture.document.root, ( block, parent ) => {
		blocksById.set( block.id, block );
		fixtureTypes[ fixture.name ].push( block.type );
		collected.types.push( block.type );
		collected.tags.push( block.tag );
		collected.attributes.push( ...Object.keys( block.attributes || {} ) );
		collected.sources.push( block.meta?.source );
		collected.breakpoints.push(
			...Object.keys( block.responsive_overrides || {} )
		);
		collected.states.push( ...Object.keys( block.states || {} ) );
		for ( const branch of [
			'actions',
			'is_content_slot',
			'is_dynamic',
			'performance',
			'permissions',
			'responsive_overrides',
			'states',
			'visibility_conditions',
		] ) {
			if ( branch in block ) {
				storageBranches.add( `block.${ branch }` );
			}
		}
		for ( const branch of [
			'css_mapping',
			'imported_css_rules',
			'imported_native_html',
			'imported_original_tag',
			'saved_component_id',
		] ) {
			if ( branch in ( block.meta || {} ) ) {
				storageBranches.add( `block.meta.${ branch }` );
			}
		}
		if ( typeof block.attributes?.class === 'string' ) {
			collected.classes.push(
				...block.attributes.class.split( /\s+/ ).filter( Boolean )
			);
		}
		if ( parent?.type === 'form' && block.type === 'form' ) {
			nestedFormPairs.push( [ parent, block ] );
		}
		if (
			block.meta?.saved_component_id &&
			block.permissions?.locked === true
		) {
			linkedLockedComponentCount += 1;
		}
		for ( const rule of block.meta?.imported_css_rules || [] ) {
			collected.importedSelectors.push( rule.selector );
			if ( rule.condition && rule.condition !== 'base' ) {
				collected.importedMediaConditions.push( rule.condition );
			}
		}
		for ( const styleSet of styleSetsFor( block ) ) {
			for ( const branch of [
				'import_review_flags',
				'role_bindings',
				'token_bindings',
			] ) {
				if ( branch in styleSet ) {
					storageBranches.add( `style.${ branch }` );
				}
			}
			if ( styleSet.custom_css_fallback ) {
				collected.customCssFallbacks.push( styleSet.custom_css_fallback );
			}
			for ( const [ property, value ] of Object.entries(
				styleSet.mapped || {}
			) ) {
				collected.mappedProperties.push( property );
				if ( ! MAPPED_STYLE_PROPERTIES.has( property ) ) {
					collected.unsupportedProperties.push( `${ property }=${ value }` );
				}
				const options = controlOptions.get( property );
				if (
					options &&
					! options.includes( value ) &&
					! String( value ).includes( 'var(' )
				) {
					collected.unsupportedValues.push( `${ property }=${ value }` );
				}
			}
			for ( const [ property, reference ] of Object.entries(
				styleSet.token_bindings || {}
			) ) {
				collected.tokenBindings.push( `${ property }=${ reference }` );
			}
			for ( const [ scope, binding ] of Object.entries(
				styleSet.role_bindings || {}
			) ) {
				collected.roleBindings.push( `${ scope }=${ binding.roleId }` );
			}
		}
	} );
}

const unsupportedSelectors = sorted( [
	...collected.importedSelectors.filter( ( selector ) => selector.includes( '::' ) ),
	...collected.importedMediaConditions.map( ( condition ) =>
		condition.startsWith( '@media' ) ? condition : `@media ${ condition }`
	),
] );
const inventory = canonicalize( {
	source: {
		broad_types: sourceBroadTypes,
		mapped_properties: sourceMappedProperties,
		native_tags: sourceTags,
		registry_elements: Object.keys( registryManifest().elements ).sort(),
		widget_roots: sourceWidgets,
	},
	fixtures: {
		attributes: sorted( collected.attributes ),
		breakpoints: sorted( collected.breakpoints ),
		classes: sorted( collected.classes ),
		custom_css_fallbacks: sorted( collected.customCssFallbacks ),
		file_sha256: Object.fromEntries(
			fixtures.map( ( fixture ) => [ fixture.name, sha256( fixture.raw ) ] )
		),
		imported_media_conditions: sorted( collected.importedMediaConditions ),
		imported_selectors: sorted( collected.importedSelectors ),
		mapped_properties: sorted( collected.mappedProperties ),
		role_bindings: sorted( collected.roleBindings ),
		schema_versions: sorted( collected.schemaVersions ),
		sources: sorted( collected.sources.filter( Boolean ) ),
		states: sorted( collected.states ),
		storage_branches: sorted( storageBranches ),
		tags: sorted( collected.tags ),
		token_bindings: sorted( collected.tokenBindings ),
		types: sorted( collected.types ),
		unsupported_properties: sorted( collected.unsupportedProperties ),
		unsupported_selectors: unsupportedSelectors,
		unsupported_values: sorted( collected.unsupportedValues ),
	},
	tag_families: coverageManifest.allowed_tag_families,
	known_baseline_gaps: [
		'Legacy v1/v2 schema accepts nested forms; the v3 JS registry rejects form-inside-form.',
	],
} );
const inventoryJson = JSON.stringify( inventory );
const inventoryHash = sha256( inventoryJson );

let assertions = 0;
function check( condition, message ) {
	assert.ok( condition, message );
	assertions += 1;
}

check( sourceBroadTypes.length === 10, 'source registry exposes ten broad types' );
check( sourceTags.length === 103, 'HTML policy exposes 103 native tags' );
check(
	sourceMappedProperties.length === 92,
	'control sources expose 92 mapped properties'
);
check( sourceWidgets.length === 8, 'widget source exposes eight roots' );
check(
	JSON.stringify( Object.keys( coverageManifest.allowed_tag_families ).sort() ) ===
		JSON.stringify( sourceTags ),
	'tag-to-family manifest exhaustively matches the live HTML policy'
);
check(
	JSON.stringify( coverageManifest.widget_roots ) ===
		JSON.stringify( sourceWidgets ),
	'widget-root inventory exactly matches the live widget library'
);
const sourceTagFamilies = sorted( Object.values( coverageManifest.allowed_tag_families ) );
check(
	JSON.stringify( Object.keys( coverageManifest.tag_family_representatives ).sort() ) ===
		JSON.stringify( sourceTagFamilies ),
	'every allowed native tag family has an immutable fixture representative'
);
for ( const [ family, blockId ] of Object.entries(
	coverageManifest.tag_family_representatives
) ) {
	const representative = blocksById.get( blockId );
	check( Boolean( representative ), `${ family } family representative exists` );
	check(
		coverageManifest.allowed_tag_families[ representative.tag ] === family,
		`${ representative.tag } represents the ${ family } family`
	);
}
for ( const [ fixtureName, types ] of Object.entries( fixtureTypes ) ) {
	check(
		JSON.stringify( sorted( types ) ) === JSON.stringify( sourceBroadTypes ),
		`${ fixtureName } covers every broad type`
	);
}
check(
	JSON.stringify( sorted( collected.schemaVersions ) ) === JSON.stringify( [ 1, 2 ] ),
	'fixtures cover schema versions 1 and 2'
);
check(
	JSON.stringify( sorted( collected.breakpoints ) ) ===
		JSON.stringify( [ 'mobile', 'tablet' ] ),
	'fixtures cover tablet and mobile branches'
);
check(
	JSON.stringify( sorted( collected.states ) ) ===
		JSON.stringify( [ 'active', 'focus', 'hover' ] ),
	'fixtures cover hover, focus, and active branches'
);
check( collected.tokenBindings.length > 0, 'fixtures contain token bindings' );
check( collected.roleBindings.length > 0, 'fixtures contain role bindings' );
check(
	collected.customCssFallbacks.length > 0,
	'fixtures contain nonempty custom CSS fallback declarations'
);
check( importedAssetCount > 0, 'fixtures contain imported assets' );
const requiredStorageBranches = [
	'block.actions',
	'block.is_content_slot',
	'block.is_dynamic',
	'block.meta.css_mapping',
	'block.meta.imported_css_rules',
	'block.meta.imported_native_html',
	'block.meta.imported_original_tag',
	'block.meta.saved_component_id',
	'block.performance',
	'block.permissions',
	'block.responsive_overrides',
	'block.states',
	'block.visibility_conditions',
	'document.design_tokens',
	'document.feature_flags',
	'document.history',
	'document.imported_assets',
	'document.seo',
	'document.slot_values',
	'document.style_roles',
	'style.import_review_flags',
	'style.role_bindings',
	'style.token_bindings',
];
check(
	JSON.stringify( sorted( storageBranches ) ) ===
		JSON.stringify( requiredStorageBranches ),
	'every current optional legacy storage branch has fixture evidence'
);
check(
	linkedLockedComponentCount >= 2,
	'each fixture contains a linked and locked component'
);
check( nestedFormPairs.length >= 2, 'each fixture records a nested form' );
for ( const [ outerForm, nestedForm ] of nestedFormPairs ) {
	check(
		canInsertElement( outerForm, nestedForm ) === false,
		'actual v3 registry rejects form-inside-form'
	);
}
check(
	collected.unsupportedProperties.includes( 'float=left' ),
	'unsupported mapped property is recorded rather than discarded'
);
check(
	collected.unsupportedValues.includes( 'display=contents' ),
	'arbitrary display value is recorded rather than confused with visibility'
);
check(
	unsupportedSelectors.includes( '.import-card::before' ) &&
		unsupportedSelectors.some( ( selector ) => selector.startsWith( '@media' ) ),
	'imported pseudo and media selectors are recorded'
);
for ( const tag of collected.tags ) {
	check( SUPPORTED_HTML_TAGS.has( tag ), `fixture tag ${ tag } is allowed` );
}

const edgeCases = coverageManifest.edge_cases;
const titleA = blocksById.get( edgeCases.duplicate_looking_titles[ 0 ] );
const titleB = blocksById.get( edgeCases.duplicate_looking_titles[ 1 ] );
check(
	titleA.id !== titleB.id &&
		titleA.children[ 0 ].value === titleB.children[ 0 ].value,
	'duplicate-looking titles retain distinct identities'
);
const anchorButton = blocksById.get( edgeCases.button_like_anchor );
check(
	anchorButton.type === 'button' && anchorButton.tag === 'a',
	'button-like anchor evidence is present'
);
check(
	blocksById.get( edgeCases.decorative_image ).attributes.alt === '',
	'decorative image retains an explicit empty alt'
);
const visibilityBlock = blocksById.get( edgeCases.visibility_display_none );
check(
	visibilityBlock.responsive_overrides.mobile.mapped.display === 'none' &&
		visibilityBlock.styles.mapped.display === 'contents',
	'visibility display:none and arbitrary display remain distinct branches'
);
check(
	blocksById.get( edgeCases.linked_locked_component ).permissions.locked === true,
	'linked component lock evidence is present'
);
check(
	blocksById
		.get( edgeCases.imported_pseudo_media )
		.meta.imported_css_rules.some( ( rule ) => rule.selector.includes( '::' ) ),
	'imported pseudo/media block metadata is present'
);

const fileHashesAfter = await hashesFor( allReadPaths );
const sourceStateAfter = JSON.stringify( {
	controls: STYLE_CONTROL_FIELDS,
	definitions: ELEMENT_DEFINITIONS,
	tags: [ ...SUPPORTED_HTML_TAGS ],
	widgets: WIDGET_LIBRARY,
} );
check(
	JSON.stringify( fileHashesAfter ) === JSON.stringify( fileHashesBefore ),
	'source and immutable fixture files are byte-identical after inventory'
);
check(
	sourceStateAfter === sourceStateBefore,
	'imported JS control, tag, widget, and registry values are not mutated'
);

if ( process.argv.includes( '--print' ) ) {
	console.log( JSON.stringify( inventory, null, 2 ) );
} else if ( process.argv.includes( '--hash' ) ) {
	console.log( inventoryHash );
} else {
	const snapshot = JSON.parse( await readFile( snapshotPath, 'utf8' ) );
	assert.equal(
		inventoryHash,
		snapshot.sha256,
		'control inventory changed; inspect --print output and update the snapshot intentionally'
	);
	assert.deepEqual( snapshot.counts, {
		broad_types: sourceBroadTypes.length,
		mapped_properties: sourceMappedProperties.length,
		native_tags: sourceTags.length,
		widget_roots: sourceWidgets.length,
	} );
	assertions += 2;
	console.log( `PASS: ${ assertions } control inventory assertions.` );
}
